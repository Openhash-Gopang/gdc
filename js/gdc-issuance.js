// ══════════════════════════════════════════════════════════════
// gdc-issuance.js — 증권 발행·가격 규칙의 기준 구현 (순수 함수, 네트워크·지갑 의존 없음)
//
// library/labs/method/issuance_v0_1.md 명세의 "실행 가능한 기준 구현"이다. 시나리오 라운드
// (library/labs/scripts/run_round.mjs)의 채점 대상이며, gdc-core.js / gdc-bank.js 에 연결되어 있지 않다.
// 실제 잔액을 움직이지 않고 서버에도 없다. 가격은 1/100 ₮(센트) 정수.
// ══════════════════════════════════════════════════════════════

export const ISSUANCE = Object.freeze({
  grades: Object.freeze(['AAA', 'AA', 'A', 'BBB', 'BB', 'C']),
  nominalCents: 100,       // 최초 발행가 ₮1
  maxRequestUnits: 100000,
  raiseCapNum: 1,          // 한 번의 발행 ≤ 중간 평가값의 1/2
  raiseCapDen: 2,
  insiderPct: 20,
});

const isInt = (x) => typeof x === 'number' && Number.isInteger(x);
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const nonEmptyStr = (x) => typeof x === 'string' && x.length > 0;

export function evaluateIssuance(input) {
  const { issuerId, grade, valuation, issuedUnits, requestUnits, subscriptions } = isObj(input) ? input : {};
  if (!nonEmptyStr(issuerId)) return { error: 'ISSUER_INVALID' };
  if (!ISSUANCE.grades.includes(grade)) return { error: 'GRADE_INVALID' };
  if (!isObj(valuation) || !isInt(valuation.low) || !isInt(valuation.mid) || !isInt(valuation.high)
    || valuation.low < 0 || !(valuation.low <= valuation.mid && valuation.mid <= valuation.high)) return { error: 'VALUATION_INVALID' };
  if (!isInt(issuedUnits) || issuedUnits < 0) return { error: 'ISSUED_INVALID' };
  if (!isInt(requestUnits) || requestUnits < 1 || requestUnits > ISSUANCE.maxRequestUnits) return { error: 'REQUEST_INVALID' };
  const subs = subscriptions === undefined || subscriptions === null ? [] : subscriptions;
  if (!Array.isArray(subs)) return { error: 'SUBSCRIPTIONS_INVALID' };
  const seen = new Set();
  for (const s of subs) {
    if (!isObj(s) || !nonEmptyStr(s.id) || !isInt(s.units) || s.units < 1 || seen.has(s.id)) return { error: 'SUBSCRIPTIONS_INVALID' };
    seen.add(s.id);
  }
  const { low, mid, high } = valuation;

  const rejected = (reason, priceCents) => ({
    status: 'rejected', reason, priceCents, allocations: [], unallocatedUnits: requestUnits, raisedCents: 0,
    newIssuedUnits: issuedUnits, postPriceCents: null, bandLowCents: null, bandHighCents: null,
  });
  if (grade === 'C') return rejected('GRADE_C', null);
  if (mid === 0) return rejected('VALUATION_ZERO', null);
  const priceCents = issuedUnits === 0 ? ISSUANCE.nominalCents : Math.floor((mid * 100) / issuedUnits);
  if (priceCents === 0) return rejected('PRICE_ZERO', 0);
  if (requestUnits * priceCents * ISSUANCE.raiseCapDen > mid * 100 * ISSUANCE.raiseCapNum) return rejected('RAISE_CAP', priceCents);

  const T = subs.reduce((s, x) => s + x.units, 0);
  const insiderCap = Math.floor((requestUnits * ISSUANCE.insiderPct) / 100);
  const allocations = subs.map(s => {
    let u = T <= requestUnits ? s.units : Math.floor((s.units * requestUnits) / T);
    if (s.id === issuerId) u = Math.min(u, insiderCap);
    return { id: s.id, units: u };
  });
  const A = allocations.reduce((s, x) => s + x.units, 0);
  const raisedCents = A * priceCents;
  const newIssuedUnits = issuedUnits + A;
  const out = { status: 'issued', reason: null, priceCents, allocations, unallocatedUnits: requestUnits - A, raisedCents, newIssuedUnits };
  if (newIssuedUnits === 0) return { ...out, postPriceCents: null, bandLowCents: null, bandHighCents: null };
  return {
    ...out,
    postPriceCents: Math.floor((mid * 100 + raisedCents) / newIssuedUnits),
    bandLowCents: Math.floor((low * 100 + raisedCents) / newIssuedUnits),
    bandHighCents: Math.ceil((high * 100 + raisedCents) / newIssuedUnits),
  };
}
