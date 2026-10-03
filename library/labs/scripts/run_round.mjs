#!/usr/bin/env node
// run_round.mjs — 라운드 시나리오 실행기 (파이프라인 1단계: 실행)
//
// 사용법:  node library/labs/scripts/run_round.mjs r01
// 입력:    library/labs/rounds/<R>/scenarios.json
// 출력:    library/labs/rounds/<R>/results.json, results.md
//
// 이 실행기는 네트워크·지갑·실제 잔액에 접근하지 않는다. 신용평가는 js/gdc-credit.js 의
// evaluateCredit()을 실제로 호출하되, 서버 응답(fetch)만 시나리오 입력으로 대체한다.
// 한도 검사는 js/gdc-limits.js 를 호출한다. 따라서 결과는 "시뮬레이션"이며,
// 실제 GDC 잔액이 움직이는 거래의 시험이 아니다.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const round = process.argv[2] || 'r01';
const dir = path.join(root, 'library/labs/rounds', round);

const { evaluateCredit } = await import(pathToFileURL(path.join(root, 'js/gdc-credit.js')));
const { checkTransfer, checkLoan } = await import(pathToFileURL(path.join(root, 'js/gdc-limits.js')));

const SCORE_TOL = 0.001; // 점수는 소수 첫째 자리 반올림값이므로 사실상 정확히 일치해야 한다. (R01 때는 0.1이어서 동점 반올림 차이를 가렸다)
const DSR_TOL = 0.0005;

function installFetchMock(inputs) {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/biz/gdc-test-financial-statement')) {
      if (inputs.tester === false) return { ok: false, status: 404, json: async () => ({ ok: false }) };
      return { ok: true, status: 200, json: async () => ({ ok: true, record: inputs.fs }) };
    }
    if (u.includes('/biz/balance')) {
      return { ok: true, status: 200, json: async () => ({ ok: true, balance: inputs.bsCash ?? 0 }) };
    }
    throw new Error('mock에 없는 URL: ' + u);
  };
}

async function runOne(s) {
  if (s.kind === 'credit') {
    installFetchMock(s.inputs);
    try {
      const r = await evaluateCredit('scenario-' + s.id);
      return { grade: r.grade, annualRate: r.annualRate, score: r.score };
    } catch (e) {
      const m = /TESTER_ONLY/.test(e.message) ? 'TESTER_ONLY' : 'ERROR: ' + e.message;
      return { error: m };
    }
  }
  if (s.kind === 'transfer') return checkTransfer(s.inputs);
  if (s.kind === 'loan_limit') return checkLoan(s.inputs);
  return { error: 'unknown kind ' + s.kind };
}

function compare(expected, actual) {
  const diffs = [];
  for (const [k, v] of Object.entries(expected)) {
    const a = actual[k];
    // expected 점수는 반올림 전 총점으로 적혀 있을 수 있어(예: 61.25), 방법론 §4대로 소수 첫째 자리에서 올림(동점) 반올림해 비교한다.
    if (k === 'score') { if (!(typeof a === 'number' && Math.abs(a - Math.round(v * 10 + 1e-9) / 10) <= SCORE_TOL)) diffs.push(`${k}: 기대 ${v}, 실제 ${a}`); }
    else if (k === 'dsr') { if (!(typeof a === 'number' && Math.abs(a - v) <= DSR_TOL)) diffs.push(`${k}: 기대 ${v}, 실제 ${a}`); }
    else if (a !== v) diffs.push(`${k}: 기대 ${v}, 실제 ${a}`);
  }
  return diffs;
}

const spec = JSON.parse(await readFile(path.join(dir, 'scenarios.json'), 'utf8'));
const results = [];
for (const s of spec.scenarios) {
  const actual = await runOne(s);
  const diffs = compare(s.expected, actual);
  results.push({ id: s.id, kind: s.kind, note: s.note, pass: diffs.length === 0, diffs, expected: s.expected, actual });
}

const passed = results.filter(r => r.pass).length;
const byKind = {};
for (const r of results) { (byKind[r.kind] ||= { total: 0, pass: 0 }); byKind[r.kind].total++; if (r.pass) byKind[r.kind].pass++; }

await writeFile(path.join(dir, 'results.json'),
  JSON.stringify({ round, executed_mode: 'simulation', total: results.length, passed, byKind, results }, null, 2) + '\n');

const lines = [
  `# ${round} 실행 결과 (파이프라인 1단계 — 실행)`, '',
  '실행 방식: 시뮬레이션 (실제 GDC 잔액 이동 없음, 서버 응답은 시나리오 입력으로 대체).',
  '독립 검수(2단계)와 재검토(3단계)는 아직 하지 않았다. expected 값은 시나리오 작성자가 실행 전에 적었다.', '',
  `**통과 ${passed} / ${results.length}**  ` + Object.entries(byKind).map(([k, v]) => `${k} ${v.pass}/${v.total}`).join(' · '), '',
  '| ID | 종류 | 결과 | 차이 |', '|---|---|---|---|',
  ...results.map(r => `| ${r.id} | ${r.kind} | ${r.pass ? '통과' : '**불일치**'} | ${r.diffs.join('; ') || ''} |`), '',
];
await writeFile(path.join(dir, 'results.md'), lines.join('\n'));
console.log(lines.slice(0, 6).join('\n'));
for (const r of results.filter(x => !x.pass)) console.log('불일치', r.id, r.diffs.join('; '));
process.exitCode = 0;
