// ══════════════════════════════════════════════════════════════
// gdc-valuation.js — 기업가치 평가(순수 함수, 네트워크·지갑 의존 없음)
//
// gdc_valuation_v0_1.md 방법론의 기준 구현이다. 신용평가 v1.0(computeCredit)의 등급으로 배수를 정한다.
// 시뮬레이션 전용이며 gdc-core / gdc-bank 에 연결되어 있지 않다. 실제 증권 평가나 매매에 쓰지 않는다.
// 정수 산술만 쓴다(부동소수점 오차 없음).
// ══════════════════════════════════════════════════════════════
import { computeCredit } from './gdc-credit.js';

export const MULTIPLE = Object.freeze({ AAA: 12, AA: 10, A: 8, BBB: 6, BB: 4, C: 2 });
const NONNEG = ['bs_ar', 'bs_ap', 'bs_debt', 'pl_revenue', 'pl_cogs', 'pl_opex'];
const ANY = ['bs_equity', 'cf_op'];

export function computeValuation(bsCash, fs, { tester = false } = {}) {
  if (tester !== true) return { error: 'TESTER_ONLY' };
  if (fs !== undefined && fs !== null && (typeof fs !== 'object' || Array.isArray(fs))) return { error: 'INPUT_INVALID' };
  const f = fs || {};
  const v = (k) => (f[k] === undefined || f[k] === null ? 0 : f[k]);
  const cash = bsCash === undefined || bsCash === null ? 0 : bsCash;
  const isInt = (x) => typeof x === 'number' && Number.isInteger(x);
  if (!isInt(cash) || cash < 0) return { error: 'INPUT_INVALID' };
  for (const k of NONNEG) if (!isInt(v(k)) || v(k) < 0) return { error: 'INPUT_INVALID' };
  for (const k of ANY) if (!isInt(v(k))) return { error: 'INPUT_INVALID' };

  const norm = {}; for (const k of [...NONNEG, ...ANY]) norm[k] = v(k);
  const { grade } = computeCredit(cash, norm);
  const m = MULTIPLE[grade];
  const nav = Math.max(0, norm.bs_equity);
  const op = norm.pl_revenue - norm.pl_cogs - norm.pl_opex;
  const earningsValue = Math.max(0, op) * m;
  const cashFlowValue = Math.max(0, norm.cf_op) * m;
  const low = Math.min(nav, earningsValue, cashFlowValue);
  const high = Math.max(nav, earningsValue, cashFlowValue);
  const mid = Math.floor((40 * nav + 30 * earningsValue + 30 * cashFlowValue + 50) / 100);
  return { grade, multiple: m, nav, earningsValue, cashFlowValue, low, mid, high };
}
