import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateSecurities } from '../js/gdc-securities.js';

// 증권 운용·이자 재원 명세 v0.1(library/labs/method/securities_v0_1.md) 구현 테스트.
const pos = (id, grade = 'A', cost = 100, income = 10) => ({ id, grade, cost, income });
const base = { principal: 1000, serverCost: 0, carryDeficit: 0, payoutBp: 5000 };

describe('정산 (손계산)', () => {
  test('수익 40 − 비용 10 = 순수익 30, 배분율 50% → 재원 ₮15 = 1500센트, 가중 1:2 → 500/1000', () => {
    const r = evaluateSecurities({ ...base, positions: [pos('a', 'A', 200, 40)], serverCost: 10, depositors: [{ id: 'x', weight: 1, promised: 0 }, { id: 'y', weight: 2, promised: 0 }] });
    assert.equal(r.net, 30);
    assert.equal(r.poolCents, 1500);
    assert.deepEqual(r.shares, [{ id: 'x', cents: 500 }, { id: 'y', cents: 1000 }]);
    assert.equal(r.undistributedCents, 1500);
  });
  test('손실이면 분배 0, 부족분은 새 이월 결손', () => {
    const r = evaluateSecurities({ ...base, positions: [pos('a', 'A', 100, 5)], serverCost: 20, carryDeficit: 7 });
    assert.equal(r.distributable, 0);
    assert.equal(r.newCarry, 22);
    assert.equal(r.poolCents, 0);
  });
  test('확정 이율형 부족액', () => {
    const r = evaluateSecurities({ ...base, positions: [pos('a')], depositors: [{ id: 'x', weight: 1, promised: 1500 }] });
    assert.equal(r.shortfallCents, 500);
  });
});

describe('포트폴리오 규칙', () => {
  test('경계는 위반이 아니다 (한 종목 20%, 운용 70%)', () => {
    const r = evaluateSecurities({ ...base, positions: [pos('a', 'A', 200), pos('b', 'A', 200), pos('c', 'A', 200), pos('d', 'A', 100)] });
    assert.deepEqual(r.violations, []);
    assert.equal(evaluateSecurities({ ...base, positions: [pos('a', 'A', 201)] }).violations[0], 'ISSUER_CONCENTRATION');
  });
  test('C 등급은 위반이지만 계산은 계속한다', () => {
    const r = evaluateSecurities({ ...base, positions: [pos('a', 'C')] });
    assert.deepEqual(r.violations, ['GRADE_C']);
    assert.equal(r.grossIncome, 10);
  });
});

describe('입력 검사', () => {
  test('오류 코드와 검사 순서', () => {
    assert.equal(evaluateSecurities(null).error, 'PRINCIPAL_INVALID');
    assert.equal(evaluateSecurities(undefined).error, 'PRINCIPAL_INVALID');
    assert.equal(evaluateSecurities({ ...base, positions: [pos('a'), pos('a')] }).error, 'POSITIONS_INVALID');
    assert.equal(evaluateSecurities({ ...base, payoutBp: 8001 }).error, 'PAYOUT_INVALID');
    assert.equal(evaluateSecurities({ ...base, depositors: [{ id: 'x', weight: -1, promised: 0 }] }).error, 'DEPOSITORS_INVALID');
    assert.equal(evaluateSecurities({ ...base, payoutBp: 9000, depositors: 'x' }).error, 'PAYOUT_INVALID');
  });
});

describe('불변식', () => {
  test('몫의 합 + 남는 금액 = distributable × 100, 몫의 합 ≤ 재원', () => {
    const r = evaluateSecurities({ ...base, positions: [pos('a', 'A', 100, 37)], serverCost: 3, depositors: [{ id: 'x', weight: 1, promised: 0 }, { id: 'y', weight: 1, promised: 0 }, { id: 'z', weight: 1, promised: 0 }] });
    const paid = r.shares.reduce((s, x) => s + x.cents, 0);
    assert.equal(paid + r.undistributedCents, r.distributable * 100);
    assert.ok(paid <= r.poolCents);
  });
  test('순수 함수', () => {
    const i = { ...base, positions: [pos('a', 'BB', 150, 12)], depositors: [{ id: 'x', weight: 3, promised: 5 }] };
    assert.deepEqual(evaluateSecurities(i), evaluateSecurities(i));
  });
});

describe('R06 시나리오·독립 검수와 일치', () => {
  test('시나리오 expected와 독립 검수 결과가 구현과 같다', async () => {
    const sc = JSON.parse(await readFile(new URL('../library/labs/rounds/r06/scenarios.json', import.meta.url), 'utf8')).scenarios;
    const chk = JSON.parse(await readFile(new URL('../library/labs/rounds/r06-check/results_check.json', import.meta.url), 'utf8')).results;
    const byId = new Map(chk.map(r => [r.id, r]));
    assert.ok(sc.length >= 60);
    for (const s of sc) {
      const a = evaluateSecurities(s.inputs);
      assert.deepEqual(a, s.expected, s.id);
      const { id, ...c } = byId.get(s.id);
      assert.deepEqual(a, c, s.id + ' (검수)');
    }
  });
});
