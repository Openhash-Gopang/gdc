import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateIssuance } from '../js/gdc-issuance.js';

// 증권 발행·가격 명세 v0.1(library/labs/method/issuance_v0_1.md) 구현 테스트.
const base = { issuerId: 'co', grade: 'A', valuation: { low: 0, mid: 1000, high: 3000 }, issuedUnits: 500, requestUnits: 100, subscriptions: [] };

describe('발행가와 배정 (손계산)', () => {
  test('기존 500단위, 중간 1000₮ → 발행가 200센트', () => {
    const r = evaluateIssuance({ ...base, subscriptions: [{ id: 'a', units: 30 }, { id: 'b', units: 40 }] });
    assert.equal(r.priceCents, 200);
    assert.deepEqual(r.allocations, [{ id: 'a', units: 30 }, { id: 'b', units: 40 }]);
    assert.equal(r.raisedCents, 14000);
    assert.equal(r.newIssuedUnits, 570);
    assert.equal(r.unallocatedUnits, 30);
  });
  test('초과 청약은 안분(버림), 내부자는 20% 상한', () => {
    const r = evaluateIssuance({ ...base, subscriptions: [{ id: 'a', units: 60 }, { id: 'co', units: 50 }] });
    assert.deepEqual(r.allocations, [{ id: 'a', units: 54 }, { id: 'co', units: 20 }]);
    assert.equal(r.unallocatedUnits, 26);
  });
  test('최초 발행가는 100센트', () => {
    const r = evaluateIssuance({ ...base, issuedUnits: 0, requestUnits: 300, subscriptions: [{ id: 'a', units: 100 }] });
    assert.equal(r.priceCents, 100);
  });
});

describe('거절', () => {
  test('C 등급, mid 0, 규모 한도(경계 포함)', () => {
    assert.equal(evaluateIssuance({ ...base, grade: 'C' }).reason, 'GRADE_C');
    assert.equal(evaluateIssuance({ ...base, valuation: { low: 0, mid: 0, high: 5 } }).reason, 'VALUATION_ZERO');
    assert.equal(evaluateIssuance({ ...base, requestUnits: 250 }).status, 'issued');
    assert.equal(evaluateIssuance({ ...base, requestUnits: 251 }).reason, 'RAISE_CAP');
  });
  test('발행가가 0이 되면 PRICE_ZERO', () => {
    assert.equal(evaluateIssuance({ ...base, valuation: { low: 0, mid: 1, high: 1 }, issuedUnits: 101, requestUnits: 1 }).reason, 'PRICE_ZERO');
  });
  test('거절은 상태를 바꾸지 않는다', () => {
    const r = evaluateIssuance({ ...base, grade: 'C', subscriptions: [{ id: 'a', units: 10 }] });
    assert.deepEqual(r.allocations, []);
    assert.equal(r.raisedCents, 0);
    assert.equal(r.newIssuedUnits, 500);
    assert.equal(r.postPriceCents, null);
  });
});

describe('입력 검사', () => {
  test('오류 코드와 순서', () => {
    assert.equal(evaluateIssuance(null).error, 'ISSUER_INVALID');
    assert.equal(evaluateIssuance({ ...base, grade: 'D' }).error, 'GRADE_INVALID');
    assert.equal(evaluateIssuance({ ...base, valuation: { low: 5, mid: 4, high: 9 } }).error, 'VALUATION_INVALID');
    assert.equal(evaluateIssuance({ ...base, issuedUnits: -1 }).error, 'ISSUED_INVALID');
    assert.equal(evaluateIssuance({ ...base, requestUnits: 0 }).error, 'REQUEST_INVALID');
    assert.equal(evaluateIssuance({ ...base, subscriptions: [{ id: 'a', units: 1 }, { id: 'a', units: 1 }] }).error, 'SUBSCRIPTIONS_INVALID');
    assert.equal(evaluateIssuance({ ...base, grade: 'C', subscriptions: 'x' }).error, 'SUBSCRIPTIONS_INVALID');
  });
});

describe('불변식', () => {
  test('배정 합계 + 미배정 = 요청, 내부자 ≤ 20%, 조달 = 배정 × 발행가', () => {
    const r = evaluateIssuance({ ...base, requestUnits: 97, subscriptions: [{ id: 'a', units: 70 }, { id: 'co', units: 90 }, { id: 'b', units: 5 }] });
    const A = r.allocations.reduce((s, x) => s + x.units, 0);
    assert.equal(A + r.unallocatedUnits, 97);
    assert.ok(r.allocations.find(x => x.id === 'co').units <= Math.floor(97 * 20 / 100));
    assert.equal(r.raisedCents, A * r.priceCents);
  });
  test('발행 후 가격은 발행가와 버림 오차 이내', () => {
    const r = evaluateIssuance({ ...base, subscriptions: [{ id: 'a', units: 100 }] });
    assert.ok(Math.abs(r.postPriceCents - r.priceCents) <= 1);
  });
  test('순수 함수', () => {
    const i = { ...base, subscriptions: [{ id: 'a', units: 40 }] };
    assert.deepEqual(evaluateIssuance(i), evaluateIssuance(i));
  });
});

describe('R08 시나리오·독립 검수와 일치', () => {
  test('시나리오 expected와 독립 검수 결과가 구현과 같다', async () => {
    const sc = JSON.parse(await readFile(new URL('../library/labs/rounds/r08/scenarios.json', import.meta.url), 'utf8')).scenarios;
    const chk = JSON.parse(await readFile(new URL('../library/labs/rounds/r08-check/results_check.json', import.meta.url), 'utf8')).results;
    const byId = new Map(chk.map(r => [r.id, r]));
    assert.ok(sc.length >= 50);
    for (const s of sc) {
      const a = evaluateIssuance(s.inputs);
      assert.deepEqual(a, s.expected, s.id);
      const { id, ...c } = byId.get(s.id);
      assert.deepEqual(a, c, s.id + ' (검수)');
    }
  });
});
