// ══════════════════════════════════════════════════════════════
// gdc-insurance.js — 보험(정액 보험료·실손 보상) 규칙의 기준 구현 (순수 함수, 네트워크·지갑 의존 없음)
//
// library/labs/method/insurance_v0_1.md 명세의 "실행 가능한 기준 구현"이다. 시나리오 라운드
// (library/labs/scripts/run_round.mjs)의 채점 대상이며, 이 모듈은 gdc-core.js / gdc-bank.js 에 연결되어
// 있지 않다. 실제 잔액을 움직이지 않고, 서버에도 아직 없다. 보험금 재원이 정해지지 않았다(명세 §0).
//
// 보험료는 1/100 ₮(센트) 정수로 계산한다 (부동소수점 오차 없음).
// ══════════════════════════════════════════════════════════════

export const INSURANCE = Object.freeze({
  minCoverage: 100,
  maxCoverage: 10000,
  coverageStep: 100,
  terms: Object.freeze([6, 12]),
  rateBp: Object.freeze({ A: 100, B: 200, C: 400 }),
  deductibleDen: 10,       // 자기부담금 = 보상 한도 / 10
  waitingMonths: 1,        // 첫 달 사고는 면책
  lapseConsecutiveMisses: 2,
});

const isInt = (x) => typeof x === 'number' && Number.isInteger(x);

export function evaluateInsurance({ coverageAmount, termMonths, riskClass, outcomes, claims, cancelAt }) {
  if (!isInt(coverageAmount) || coverageAmount < INSURANCE.minCoverage || coverageAmount > INSURANCE.maxCoverage || coverageAmount % INSURANCE.coverageStep !== 0) return { error: 'COVERAGE_INVALID' };
  if (!INSURANCE.terms.includes(termMonths)) return { error: 'TERM_INVALID' };
  if (typeof riskClass !== 'string' || !Object.prototype.hasOwnProperty.call(INSURANCE.rateBp, riskClass)) return { error: 'CLASS_INVALID' };
  if (!Array.isArray(outcomes) || outcomes.length > termMonths || outcomes.some(o => o !== 'paid' && o !== 'missed')) return { error: 'OUTCOMES_INVALID' };
  let cl = claims;
  if (cl === undefined || cl === null) cl = [];
  if (!Array.isArray(cl)) return { error: 'CLAIMS_INVALID' };
  let prev = 1;
  for (const c of cl) {
    if (c === null || typeof c !== 'object' || !isInt(c.month) || c.month < 1 || c.month > outcomes.length || !isInt(c.loss) || c.loss < 1 || c.month < prev) return { error: 'CLAIMS_INVALID' };
    prev = c.month;
  }
  if (cancelAt !== undefined && cancelAt !== null) {
    if (!isInt(cancelAt) || cancelAt < 1 || cancelAt > termMonths || cancelAt > outcomes.length) return { error: 'CANCEL_INVALID' };
  }

  const monthlyCents = Math.ceil((coverageAmount * INSURANCE.rateBp[riskClass]) / 1200);
  const deductible = coverageAmount / INSURANCE.deductibleDen;
  let remaining = coverageAmount;
  let paidCount = 0;
  let status = 'active';
  let endMonth = 0;
  const claimResults = [];
  for (let k = 1; k <= outcomes.length; k++) {
    endMonth = k;
    if (outcomes[k - 1] === 'paid') paidCount++;
    for (const c of cl) {
      if (c.month !== k) continue;
      let reason, payout = 0;
      if (k <= INSURANCE.waitingMonths) reason = 'WAITING';
      else if (outcomes[k - 1] === 'missed') reason = 'UNPAID';
      else if (remaining === 0) reason = 'EXHAUSTED';
      else if (c.loss <= deductible) reason = 'BELOW_DEDUCTIBLE';
      else if (c.loss - deductible <= remaining) { reason = 'PAID'; payout = c.loss - deductible; }
      else { reason = 'PARTIAL'; payout = remaining; }
      remaining -= payout;
      claimResults.push({ month: c.month, loss: c.loss, payout, reason });
    }
    if (outcomes[k - 1] === 'missed' && k >= 2 && outcomes[k - 2] === 'missed') { status = 'lapsed'; break; }
    if (remaining === 0) { status = 'exhausted'; break; }
    if (cancelAt === k && k < termMonths) { status = 'cancelled'; break; }
    if (k === termMonths) { status = 'matured'; break; }
  }
  const totalPayout = coverageAmount - remaining;
  return { status, endMonth, paidCount, premiumTotal: (monthlyCents * paidCount) / 100, claimResults, totalPayout, remainingCoverage: remaining };
}
