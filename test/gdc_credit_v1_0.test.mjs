import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { computeCredit, GRADE_RATES } from '../js/gdc-credit.js';

// 신용평가 방법론 v1.0(gdc_credit_v1_0.md) 구현 테스트.
// 시나리오 라운드 R02(library/labs/rounds/r02)와 별개로, 변경된 부채비율 규칙의 불변식과
// 시나리오 파일·독립 검수 결과와의 일치를 확인한다.

const fs0 = { bs_ar: 0, bs_ap: 500, bs_debt: 0, bs_equity: 1000, pl_revenue: 10000, pl_cogs: 7000, pl_opex: 1000, cf_op: 0 };
const debtScore = (over) => computeCredit(1000, { ...fs0, ...over }).componentScores.debt;

describe('부채비율 점수 (v1.0 변경점)', () => {
  test('순자산이 0이고 부채가 있으면 최저 5점 (v0은 50점)', () => assert.equal(debtScore({ bs_equity: 0, bs_debt: 500 }), 5));
  test('순자산이 음수이면 부채 유무와 관계없이 5점', () => {
    assert.equal(debtScore({ bs_equity: -1, bs_debt: 500 }), 5);
    assert.equal(debtScore({ bs_equity: -1, bs_debt: 0 }), 5);
  });
  test('순자산 0, 부채 0은 판단 불가 50점', () => assert.equal(debtScore({ bs_equity: 0, bs_debt: 0 }), 50));
  test('순자산 양수에서는 v0과 같은 구간표', () => {
    const cases = [[0, 100], [300, 100], [301, 80], [700, 80], [701, 55], [1500, 55], [1501, 25], [3000, 25], [3001, 5]];
    for (const [debt, score] of cases) assert.equal(debtScore({ bs_equity: 1000, bs_debt: debt }), score, `debt=${debt}`);
  });
  test('순자산이 줄어드는 방향으로 점수가 오르지 않는다(단조성)', () => {
    let prev = Infinity;
    for (const eq of [10000, 1000, 500, 100, 1, 0, -1, -1000]) {
      const s = debtScore({ bs_debt: 500, bs_equity: eq });
      assert.ok(s <= prev, `equity=${eq}: ${s} > ${prev}`);
      prev = s;
    }
  });
});

describe('등급표와 금리', () => {
  test('금리는 게시된 등급표와 같다', () => {
    assert.deepEqual({ ...GRADE_RATES }, { AAA: 0.005, AA: 0.01, A: 0.015, BBB: 0.025, BB: 0.035, C: 0.05 });
  });
  test('표시 점수의 동점은 올림 (총점 71.25 → 71.3, 짝수 쪽 반올림이면 71.2)', () => {
    // 지표 점수 (유동 100, 부채 5, 마진 100, 현금흐름 75) -> 25 + 1.25 + 30 + 15 = 71.25
    const r = computeCredit(1000, { bs_ar: 0, bs_ap: 500, bs_debt: 500, bs_equity: 0, pl_revenue: 10000, pl_cogs: 7000, pl_opex: 1000, cf_op: 200 });
    assert.deepEqual(r.componentScores, { liquidity: 100, debt: 5, operatingMargin: 100, cashFlow: 75 });
    assert.equal(r.score, 71.3);
    assert.equal(r.grade, 'A');
  });
});

describe('R02 시나리오와 독립 검수 결과', () => {
  test('모든 신용평가 시나리오가 expected와 같고, 독립 검수 결과와도 같다', async () => {
    const scen = JSON.parse(await readFile(new URL('../library/labs/rounds/r02/scenarios.json', import.meta.url), 'utf8')).scenarios;
    const chk = JSON.parse(await readFile(new URL('../library/labs/rounds/r02-check/results_check.json', import.meta.url), 'utf8'));
    const byId = new Map(chk.results.map(r => [r.id, r]));
    assert.ok(scen.length >= 57, String(scen.length));
    for (const s of scen) {
      if (s.inputs.tester === false) { assert.equal(byId.get(s.id).error, 'TESTER_ONLY', s.id); continue; }
      const r = computeCredit(s.inputs.bsCash, s.inputs.fs);
      assert.equal(r.grade, s.expected.grade, s.id);
      assert.equal(r.annualRate, s.expected.annualRate, s.id);
      assert.equal(r.score, s.expected.score, s.id);
      const c = byId.get(s.id);
      assert.equal(r.grade, c.grade, s.id + ' (검수)');
      assert.equal(r.score, c.score, s.id + ' (검수)');
    }
  });
});
