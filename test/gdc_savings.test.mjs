import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateSavings, SAVINGS } from '../js/gdc-savings.js';

// 적금 명세 v0.1(library/labs/method/savings_v0_1.md) 구현 테스트.
// 시나리오 라운드 R03와 별개로 손계산 값, 불변식, 시나리오 파일·독립 검수 결과와의 일치를 확인한다.

const P = 'paid', M = 'missed';
const all = (n) => Array(n).fill(P);

describe('만기 지급 (손계산)', () => {
  test('월 ₮1,000 x 12개월, 연 0.5% 단리 → 이자 ₮32.50', () => {
    const r = evaluateSavings({ monthlyAmount: 1000, termMonths: 12, rateBp: 50, outcomes: all(12) });
    assert.deepEqual(r, { status: 'matured', endMonth: 12, paidCount: 12, principal: 12000, interest: 32.5, payout: 12032.5 });
  });
  test('이율 0이면 이자 0, 원금만 돌려준다', () => {
    const r = evaluateSavings({ monthlyAmount: 700, termMonths: 6, rateBp: 0, outcomes: all(6) });
    assert.equal(r.interest, 0);
    assert.equal(r.payout, 4200);
  });
  test('이자는 0.01₮ 미만을 버린다', () => {
    // 333 x 10bp x (12+11+...+1 = 78) = 259,740 → /1200 = 216.45 → 216센트 = ₮2.16 (올림이면 2.17)
    const r = evaluateSavings({ monthlyAmount: 333, termMonths: 12, rateBp: 10, outcomes: all(12) });
    assert.equal(r.interest, 2.16);
  });
});

describe('해지', () => {
  test('중도해지 이율은 약정의 50%, 원금은 전액', () => {
    const r = evaluateSavings({ monthlyAmount: 1000, termMonths: 12, rateBp: 50, outcomes: all(6), cancelAt: 6 });
    assert.equal(r.status, 'cancelled');
    assert.equal(r.principal, 6000);
    assert.equal(r.interest, 4.37); // 50*1000*21 = 1,050,000 / 2400 = 437.5 → 437센트
  });
  test('2회 연속 미납이면 그 달 끝에 자동 해지', () => {
    const r = evaluateSavings({ monthlyAmount: 1000, termMonths: 12, rateBp: 0, outcomes: [P, P, M, M, P] });
    assert.equal(r.status, 'auto_terminated');
    assert.equal(r.endMonth, 4);
    assert.equal(r.paidCount, 2);
  });
  test('비연속 미납은 해지가 아니다', () => {
    const r = evaluateSavings({ monthlyAmount: 500, termMonths: 6, rateBp: 0, outcomes: [P, M, P, M, P, P] });
    assert.equal(r.status, 'matured');
    assert.equal(r.paidCount, 4);
  });
  test('만기 달에 cancelAt = termMonths 이면 만기', () => {
    const r = evaluateSavings({ monthlyAmount: 500, termMonths: 6, rateBp: 20, outcomes: all(6), cancelAt: 6 });
    assert.equal(r.status, 'matured');
  });
});

describe('입력 검사', () => {
  const ok = { monthlyAmount: 500, termMonths: 6, rateBp: 0, outcomes: all(3) };
  test('범위 밖·형식 오류 코드', () => {
    assert.equal(evaluateSavings({ ...ok, monthlyAmount: SAVINGS.minMonthly - 1 }).error, 'AMOUNT_INVALID');
    assert.equal(evaluateSavings({ ...ok, monthlyAmount: SAVINGS.maxMonthly + 1 }).error, 'AMOUNT_INVALID');
    assert.equal(evaluateSavings({ ...ok, termMonths: 9 }).error, 'TERM_INVALID');
    assert.equal(evaluateSavings({ ...ok, rateBp: SAVINGS.maxRateBp + 1 }).error, 'RATE_INVALID');
    assert.equal(evaluateSavings({ ...ok, rateBp: undefined }).error, 'RATE_INVALID');
    assert.equal(evaluateSavings({ ...ok, outcomes: all(7) }).error, 'OUTCOMES_INVALID');
    assert.equal(evaluateSavings({ ...ok, cancelAt: 4 }).error, 'CANCEL_INVALID');
    assert.equal(evaluateSavings({ ...ok, cancelAt: null }).status, 'active');
  });
  test('월 납입 상한은 1회 이체 상한과 같다', async () => {
    const { LIMITS } = await import('../js/gdc-limits.js');
    assert.equal(SAVINGS.maxMonthly, LIMITS.transferPerTx);
  });
});

describe('불변식', () => {
  test('원금은 항상 전액 반환되고 지급액 ≥ 원금 (이율 > 0 이면 해지 이자 ≤ 만기 이자)', () => {
    for (const n of [1, 3, 5, 11]) {
      const base = { monthlyAmount: 900, termMonths: 12, rateBp: 40 };
      const c = evaluateSavings({ ...base, outcomes: all(n), cancelAt: n });
      const m = evaluateSavings({ ...base, outcomes: all(12) });
      assert.equal(c.payout - c.interest, c.principal);
      assert.ok(c.interest <= m.interest);
    }
  });
  test('같은 입력은 같은 출력 (순수 함수)', () => {
    const i = { monthlyAmount: 333, termMonths: 12, rateBp: 13, outcomes: [P, P, P, P, P], cancelAt: 5 };
    assert.deepEqual(evaluateSavings(i), evaluateSavings(i));
  });
});

describe('R03 시나리오·독립 검수와 일치', () => {
  test('시나리오 expected와 독립 검수 결과가 구현과 같다', async () => {
    const sc = JSON.parse(await readFile(new URL('../library/labs/rounds/r03/scenarios.json', import.meta.url), 'utf8')).scenarios;
    const chk = JSON.parse(await readFile(new URL('../library/labs/rounds/r03-check/results_check.json', import.meta.url), 'utf8')).results;
    const byId = new Map(chk.map(r => [r.id, r]));
    assert.ok(sc.length >= 40);
    for (const s of sc) {
      const a = evaluateSavings(s.inputs);
      assert.deepEqual(a, s.expected, s.id);
      const { id, ...c } = byId.get(s.id);
      assert.deepEqual(a, c, s.id + ' (검수)');
    }
  });
});
