import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateInsurance, INSURANCE } from '../js/gdc-insurance.js';

// 보험 명세 v0.1(library/labs/method/insurance_v0_1.md) 구현 테스트.
const P = 'paid', M = 'missed';
const all = (n) => Array(n).fill(P);
const base = { coverageAmount: 1000, termMonths: 6, riskClass: 'A' };

describe('보험료 (손계산)', () => {
  test('1000/A: 월 ceil(83.33)=84센트, 6회 ₮5.04', () => {
    assert.equal(evaluateInsurance({ ...base, outcomes: all(6) }).premiumTotal, 5.04);
  });
  test('나누어떨어지면 올림하지 않는다 (600/B = 100센트)', () => {
    assert.equal(evaluateInsurance({ ...base, coverageAmount: 600, riskClass: 'B', outcomes: all(1) }).premiumTotal, 1);
  });
  test('최대 월 보험료는 ₮33.34 (10000/C)', () => {
    assert.equal(evaluateInsurance({ ...base, coverageAmount: 10000, riskClass: 'C', outcomes: all(1) }).premiumTotal, 33.34);
  });
});

describe('보상', () => {
  const claim = (month, loss, extra = {}) => evaluateInsurance({ ...base, outcomes: all(6), claims: [{ month, loss }], ...extra }).claimResults[0];
  test('첫 달 사고는 면책', () => assert.equal(claim(1, 900).reason, 'WAITING'));
  test('자기부담금 이하는 지급 없음, 초과분만 지급', () => {
    assert.equal(claim(2, 100).reason, 'BELOW_DEDUCTIBLE');
    assert.deepEqual(claim(2, 500), { month: 2, loss: 500, payout: 400, reason: 'PAID' });
  });
  test('한도 초과분은 PARTIAL 후 소진 종료', () => {
    const r = evaluateInsurance({ ...base, outcomes: all(6), claims: [{ month: 2, loss: 5000 }] });
    assert.equal(r.claimResults[0].reason, 'PARTIAL');
    assert.equal(r.status, 'exhausted');
    assert.equal(r.remainingCoverage, 0);
  });
  test('미납한 달의 사고는 UNPAID, 2회 연속 미납은 실효', () => {
    const r = evaluateInsurance({ ...base, outcomes: [P, P, M, M], claims: [{ month: 3, loss: 500 }] });
    assert.equal(r.claimResults[0].reason, 'UNPAID');
    assert.equal(r.status, 'lapsed');
    assert.equal(r.endMonth, 4);
  });
  test('환급은 없다: 해지해도 낸 보험료는 그대로 기록', () => {
    const r = evaluateInsurance({ ...base, termMonths: 12, outcomes: all(4), cancelAt: 4 });
    assert.equal(r.status, 'cancelled');
    assert.equal(r.premiumTotal, 3.36);
  });
});

describe('입력 검사', () => {
  const ok = { ...base, outcomes: all(3) };
  test('오류 코드', () => {
    assert.equal(evaluateInsurance({ ...ok, coverageAmount: 150 }).error, 'COVERAGE_INVALID');
    assert.equal(evaluateInsurance({ ...ok, coverageAmount: undefined }).error, 'COVERAGE_INVALID');
    assert.equal(evaluateInsurance({ ...ok, termMonths: 9 }).error, 'TERM_INVALID');
    assert.equal(evaluateInsurance({ ...ok, riskClass: 'a' }).error, 'CLASS_INVALID');
    assert.equal(evaluateInsurance({ ...ok, riskClass: 'toString' }).error, 'CLASS_INVALID');
    assert.equal(evaluateInsurance({ ...ok, outcomes: all(7) }).error, 'OUTCOMES_INVALID');
    assert.equal(evaluateInsurance({ ...ok, claims: [{ month: 4, loss: 100 }] }).error, 'CLAIMS_INVALID');
    assert.equal(evaluateInsurance({ ...ok, claims: [null] }).error, 'CLAIMS_INVALID');
    assert.equal(evaluateInsurance({ ...ok, cancelAt: 4 }).error, 'CANCEL_INVALID');
  });
});

describe('불변식', () => {
  test('지급 합계 + 잔여 한도 = 보상 한도, 지급 합계 ≤ 한도', () => {
    const r = evaluateInsurance({ ...base, termMonths: 12, outcomes: all(12), claims: [{ month: 2, loss: 300 }, { month: 5, loss: 700 }, { month: 9, loss: 900 }] });
    assert.equal(r.totalPayout + r.remainingCoverage, 1000);
    assert.equal(r.claimResults.reduce((s, c) => s + c.payout, 0), r.totalPayout);
  });
  test('순수 함수', () => {
    const i = { ...base, outcomes: all(4), claims: [{ month: 3, loss: 400 }] };
    assert.deepEqual(evaluateInsurance(i), evaluateInsurance(i));
  });
});

describe('R05 시나리오·독립 검수와 일치', () => {
  test('시나리오 expected와 독립 검수 결과가 구현과 같다', async () => {
    const sc = JSON.parse(await readFile(new URL('../library/labs/rounds/r05/scenarios.json', import.meta.url), 'utf8')).scenarios;
    const chk = JSON.parse(await readFile(new URL('../library/labs/rounds/r05-check/results_check.json', import.meta.url), 'utf8')).results;
    const byId = new Map(chk.map(r => [r.id, r]));
    assert.ok(sc.length >= 60);
    for (const s of sc) {
      const a = evaluateInsurance(s.inputs);
      assert.deepEqual(a, s.expected, s.id);
      const { id, ...c } = byId.get(s.id);
      assert.deepEqual(a, c, s.id + ' (검수)');
    }
  });
});
