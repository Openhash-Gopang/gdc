import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { computeValuation, MULTIPLE } from '../js/gdc-valuation.js';

// 기업가치 평가 방법론 v0.1(gdc_valuation_v0_1.md) 구현 테스트. 시나리오 라운드 R04와 별개로 손계산 값,
// 입력 검사 순서, 불변식, 시나리오·독립 검수 결과와의 일치를 확인한다.

const fs0 = { bs_ar: 0, bs_ap: 500, bs_debt: 200, bs_equity: 1000, pl_revenue: 10000, pl_cogs: 7000, pl_opex: 1000, cf_op: 200 };
const T = { tester: true };

describe('세 가지 가치와 범위 (손계산)', () => {
  test('등급 AA, 배수 10: NAV 1000, EV 20000, CV 0 → 하한 0, 상한 20000, 중간 6400', () => {
    const r = computeValuation(1000, { ...fs0, cf_op: -500 }, T);
    assert.deepEqual(r, { grade: 'AA', multiple: 10, nav: 1000, earningsValue: 20000, cashFlowValue: 0, low: 0, mid: 6400, high: 20000 });
  });
  test('순자산이 음수여도 순자산가치는 0, 영업손실이면 수익가치 0', () => {
    const r = computeValuation(1000, { ...fs0, bs_equity: -300, pl_cogs: 9000, pl_opex: 2000 }, T);
    assert.equal(r.nav, 0);
    assert.equal(r.earningsValue, 0);
  });
  test('중간값은 소수 첫째 자리에서 반올림: N=40→0, 80→1, 120→1, 160→2, 200→2', () => {
    const only = (e) => computeValuation(0, { bs_equity: e }, T).mid;
    assert.deepEqual([1, 2, 3, 4, 5].map(only), [0, 1, 1, 2, 2]);
  });
});

describe('입력 검사', () => {
  test('테스터 검사가 입력 검사보다 먼저, 생략하면 비테스터', () => {
    assert.equal(computeValuation(1000, { ...fs0, bs_equity: 1.5 }, { tester: false }).error, 'TESTER_ONLY');
    assert.equal(computeValuation(1000, fs0).error, 'TESTER_ONLY');
    assert.equal(computeValuation(1000, fs0, { tester: 1 }).error, 'TESTER_ONLY'); // true 만 테스터
  });
  test('소수·문자열·불리언·음수 불가 항목의 음수는 INPUT_INVALID', () => {
    for (const bad of [{ bs_equity: 100.5 }, { bs_equity: 'abc' }, { bs_equity: true }, { pl_cogs: -1 }, { pl_revenue: -1 }, { cf_op: 0.5 }]) {
      assert.equal(computeValuation(1000, { ...fs0, ...bad }, T).error, 'INPUT_INVALID', JSON.stringify(bad));
    }
    assert.equal(computeValuation(-1, fs0, T).error, 'INPUT_INVALID');
    assert.equal(computeValuation(1000, 'abc', T).error, 'INPUT_INVALID');
    assert.equal(computeValuation(1000, [1], T).error, 'INPUT_INVALID');
  });
  test('null·생략은 0, fs 자체가 없어도 계산한다', () => {
    const a = computeValuation(1000, { ...fs0, bs_ar: null, bs_debt: null }, T);
    const b = computeValuation(1000, { ...fs0, bs_ar: 0, bs_debt: 0 }, T);
    assert.deepEqual(a, b);
    assert.equal(computeValuation(0, null, T).mid, 0);
  });
});

describe('불변식', () => {
  test('배수는 등급이 좋을수록 크다', () => {
    const order = ['AAA', 'AA', 'A', 'BBB', 'BB', 'C'].map(g => MULTIPLE[g]);
    for (let i = 1; i < order.length; i++) assert.ok(order[i - 1] > order[i]);
  });
  test('하한 ≤ 중간 ≤ 상한', () => {
    for (const eq of [-500, 0, 1, 700, 100000]) for (const cf of [-10, 0, 50, 5000]) for (const opx of [500, 1000, 9000]) {
      const r = computeValuation(1000, { ...fs0, bs_equity: eq, cf_op: cf, pl_opex: opx }, T);
      assert.ok(r.low <= r.mid && r.mid <= r.high, JSON.stringify([eq, cf, opx, r]));
    }
  });
});

describe('R04 시나리오·독립 검수와 일치', () => {
  test('expected와 독립 검수 결과가 구현과 같다', async () => {
    const sc = JSON.parse(await readFile(new URL('../library/labs/rounds/r04/scenarios.json', import.meta.url), 'utf8')).scenarios;
    const chk = JSON.parse(await readFile(new URL('../library/labs/rounds/r04-check/results_check.json', import.meta.url), 'utf8')).results;
    const byId = new Map(chk.map(r => [r.id, r]));
    assert.ok(sc.length >= 40);
    for (const s of sc) {
      const a = computeValuation(s.inputs.bsCash, s.inputs.fs, { tester: s.inputs.tester });
      assert.deepEqual(a, s.expected, s.id);
      const { id, ...c } = byId.get(s.id);
      assert.deepEqual(a, c, s.id + ' (검수)');
    }
  });
});
