#!/usr/bin/env node
// compare_check.mjs — 파이프라인 2단계(독립 검수) 결과와 1단계(실행) 결과를 대조한다.
//
// 사용법:  node library/labs/scripts/compare_check.mjs r02
// 입력:    rounds/<R>/results.json       (1단계: 구현을 실제로 돌린 결과, expected 포함)
//          rounds/<R>-check/results_check.json  (2단계: 방법론 문서만 보고 계산한 독립 검수자의 결과)
// 출력:    rounds/<R>-check/report.md
//
// 검수자는 expected 값과 구현 코드를 보지 않는다. credit 시나리오는 등급·연 금리·표시 점수를, savings 시나리오는
// 오류 코드 또는 status/endMonth/paidCount/principal/interest/payout 을, insurance 시나리오는 오류 코드 또는 status/endMonth/paidCount/premiumTotal/claimResults/totalPayout/remainingCoverage 를, valuation 시나리오는 오류 코드 또는
// grade/multiple/nav/earningsValue/cashFlowValue/low/mid/high 를 비교한다.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const round = process.argv[2] || 'r02';
const run = JSON.parse(await readFile(path.join(root, 'library/labs/rounds', round, 'results.json'), 'utf8'));
const chk = JSON.parse(await readFile(path.join(root, 'library/labs/rounds', `${round}-check`, 'results_check.json'), 'utf8'));
const byId = new Map(chk.results.map(r => [r.id, r]));

const SAV = ['status', 'endMonth', 'paidCount', 'principal', 'interest', 'payout'];
const INS = ['status', 'endMonth', 'paidCount', 'premiumTotal', 'claimResults', 'totalPayout', 'remainingCoverage'];
const SEC = ['compliant', 'violations', 'investedCost', 'grossIncome', 'net', 'distributable', 'newCarry', 'poolCents', 'shares', 'undistributedCents', 'obligationCents', 'shortfallCents'];
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
const VAL = ['grade', 'multiple', 'nav', 'earningsValue', 'cashFlowValue', 'low', 'mid', 'high'];
const rows = [];
for (const r of run.results) {
  const c = byId.get(r.id);
  const diffs = [];
  if (!c) { diffs.push('검수 결과 없음'); }
  else if (r.kind === 'savings' || r.kind === 'valuation' || r.kind === 'insurance' || r.kind === 'securities') {
    if (r.expected.error || c.error || r.actual.error) {
      if ((r.actual.error || null) !== (c.error || null)) diffs.push(`오류: 구현 ${r.actual.error}, 검수 ${c.error}`);
      if ((r.expected.error || null) !== (c.error || null)) diffs.push(`오류: expected ${r.expected.error}, 검수 ${c.error}`);
    } else {
      for (const k of (r.kind === 'valuation' ? VAL : r.kind === 'insurance' ? INS : r.kind === 'securities' ? SEC : SAV)) {
        if (!same(c[k], r.actual[k])) diffs.push(`${k}: 구현 ${JSON.stringify(r.actual[k])}, 검수 ${JSON.stringify(c[k])}`);
        if (!same(c[k], r.expected[k])) diffs.push(`${k}: expected ${JSON.stringify(r.expected[k])}, 검수 ${JSON.stringify(c[k])}`);
      }
    }
  }
  else if (r.expected.error || c.error) {
    if ((r.actual.error || null) !== (c.error || null)) diffs.push(`오류: 구현 ${r.actual.error}, 검수 ${c.error}`);
    if ((r.expected.error || null) !== (c.error || null)) diffs.push(`오류: expected ${r.expected.error}, 검수 ${c.error}`);
  } else {
    if (c.grade !== r.actual.grade) diffs.push(`등급: 구현 ${r.actual.grade}, 검수 ${c.grade}`);
    if (c.annualRate !== r.actual.annualRate) diffs.push(`금리: 구현 ${r.actual.annualRate}, 검수 ${c.annualRate}`);
    if (c.score !== r.actual.score) diffs.push(`점수: 구현 ${r.actual.score}, 검수 ${c.score}`);
    if (c.grade !== r.expected.grade) diffs.push(`등급: expected ${r.expected.grade}, 검수 ${c.grade}`);
    if (c.score !== r.expected.score && Math.abs(c.score - Math.round(r.expected.score * 10 + 1e-9) / 10) > 1e-9) diffs.push(`점수: expected ${r.expected.score}, 검수 ${c.score}`);
  }
  rows.push({ id: r.id, ok: diffs.length === 0, diffs });
}
const okCount = rows.filter(r => r.ok).length;
const lines = [
  `# ${round}-check 대조 결과 (파이프라인 2단계 — 독립 검수 vs 실행)`, '',
  `검수자는 방법론·명세 문서(credit: gdc_credit_v1_0.md, savings: savings_v0_1.md, valuation: gdc_valuation_v0_1.md, insurance: insurance_v0_1.md, securities: securities_v0_1.md와 그것이 인용하는 신용평가 문서)와 시나리오 입력만 받았고 expected 값과 구현 코드는 보지 못했다.`,
  `**일치 ${okCount} / ${rows.length}**`, '',
  ...(chk.ambiguities?.length ? ['## 검수자가 짚은 문서의 모호한 곳', '', ...chk.ambiguities.map((a, i) => `${i + 1}. ${a}`), ''] : ['검수자가 짚은 모호한 곳: 없음', '']),
  '| ID | 결과 | 차이 |', '|---|---|---|',
  ...rows.map(r => `| ${r.id} | ${r.ok ? '일치' : '**불일치**'} | ${r.diffs.join('; ')} |`), '',
];
await writeFile(path.join(root, 'library/labs/rounds', `${round}-check`, 'report.md'), lines.join('\n'));
console.log(`일치 ${okCount} / ${rows.length}`);
for (const r of rows.filter(x => !x.ok)) console.log('불일치', r.id, r.diffs.join('; '));
