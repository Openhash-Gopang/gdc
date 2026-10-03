import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateSavingsLinked } from '../js/gdc-savings.js';

// 적금 명세 v0.2(library/labs/method/savings_v0_2.md, 수익 연동 이자) 구현 테스트.
const P = 'paid', M = 'missed';
const sett = (k, pool = 100, tb = 10000) => Array.from({ length: k }, () => ({ poolCents: pool, totalBalance: tb }));
const mk = (o) => ({ monthlyAmount: 500, termMonths: 6, ...o });

describe('이자 발생 (손계산)', () => {
  test('잔액 500..3000, 재원 100, 전체 10000 → 5+10+15+20+25+30 = 105센트 (6개월 만기)', () => {
    const r = evaluateSavingsLinked(mk({ outcomes: Array(6).fill(P), settlements: sett(6) }));
    assert.equal(r.accruedCents, 105);
    assert.equal(r.interest, 1.05);
    assert.equal(r.payout, 3001.05);
    assert.equal(r.status, 'matured');
  });
  test('달마다 센트 버림 후 합산', () => {
    const r = evaluateSavingsLinked(mk({ outcomes: [P, P, P], settlements: [{ poolCents: 100, totalBalance: 1000 }, { poolCents: 100, totalBalance: 1500 }, { poolCents: 0, totalBalance: 2000 }] }));
    assert.equal(r.accruedCents, 116);
  });
  test('재원이 0이면 이자 0, 원금은 전액', () => {
    const r = evaluateSavingsLinked(mk({ outcomes: Array(6).fill(P), settlements: sett(6, 0) }));
    assert.equal(r.interest, 0);
    assert.equal(r.payout, r.principal);
  });
});

describe('해지', () => {
  test('해지·자동 해지는 발생분의 절반(버림)이고 원금은 전액', () => {
    const c = evaluateSavingsLinked(mk({ termMonths: 12, outcomes: [P, P], settlements: [{ poolCents: 3, totalBalance: 500 }, { poolCents: 3, totalBalance: 1000 }], cancelAt: 2 }));
    assert.equal(c.accruedCents, 3 + 3); // floor(3*500/500)=3, floor(3*1000/1000)=3
    assert.equal(c.interest, 0.03);
    assert.equal(c.principal, 1000);
    const a = evaluateSavingsLinked(mk({ termMonths: 12, outcomes: [P, P, M, M], settlements: sett(4, 100, 4000) }));
    assert.equal(a.status, 'auto_terminated');
    assert.equal(a.interest, Math.floor(a.accruedCents / 2) / 100);
  });
});

describe('입력 검사', () => {
  const ok = mk({ outcomes: [P, P], settlements: sett(2) });
  test('오류 코드', () => {
    assert.equal(evaluateSavingsLinked(null).error, 'AMOUNT_INVALID');
    assert.equal(evaluateSavingsLinked({ ...ok, monthlyAmount: 99 }).error, 'AMOUNT_INVALID');
    assert.equal(evaluateSavingsLinked({ ...ok, termMonths: 9 }).error, 'TERM_INVALID');
    assert.equal(evaluateSavingsLinked({ ...ok, outcomes: Array(7).fill(P) }).error, 'OUTCOMES_INVALID');
    assert.equal(evaluateSavingsLinked({ ...ok, settlements: sett(1) }).error, 'SETTLEMENTS_INVALID');
    assert.equal(evaluateSavingsLinked({ ...ok, settlements: undefined }).error, 'SETTLEMENTS_INVALID');
    assert.equal(evaluateSavingsLinked({ ...ok, cancelAt: 3 }).error, 'CANCEL_INVALID');
    assert.equal(evaluateSavingsLinked({ ...ok, settlements: [{ poolCents: 1, totalBalance: 499 }, ok.settlements[1]] }).error, 'SETTLEMENT_INCONSISTENT');
  });
});

describe('불변식', () => {
  test('원금은 항상 전액 반환되고 지급액 ≥ 원금, 해지 이자 ≤ 발생분', () => {
    for (const n of [1, 3, 5]) {
      const r = evaluateSavingsLinked(mk({ termMonths: 12, outcomes: Array(n).fill(P), settlements: sett(n, 37, 3000), cancelAt: n }));
      assert.equal(Math.round(r.payout * 100) - Math.round(r.interest * 100), r.principal * 100);
      assert.ok(Math.round(r.interest * 100) <= r.accruedCents);
    }
  });
  test('순수 함수', () => {
    const i = mk({ outcomes: [P, M, P], settlements: sett(3, 77, 2000) });
    assert.deepEqual(evaluateSavingsLinked(i), evaluateSavingsLinked(i));
  });
});

describe('R07 시나리오·독립 검수와 일치', () => {
  test('시나리오 expected와 독립 검수 결과가 구현과 같다', async () => {
    const sc = JSON.parse(await readFile(new URL('../library/labs/rounds/r07/scenarios.json', import.meta.url), 'utf8')).scenarios;
    const chk = JSON.parse(await readFile(new URL('../library/labs/rounds/r07-check/results_check.json', import.meta.url), 'utf8')).results;
    const byId = new Map(chk.map(r => [r.id, r]));
    assert.ok(sc.length >= 40);
    for (const s of sc) {
      const a = evaluateSavingsLinked(s.inputs);
      assert.deepEqual(a, s.expected, s.id);
      const { id, ...c } = byId.get(s.id);
      assert.deepEqual(a, c, s.id + ' (검수)');
    }
  });
});
