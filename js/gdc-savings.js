// ══════════════════════════════════════════════════════════════
// gdc-savings.js — 적금(정액 적립) 규칙의 기준 구현 (순수 함수, 네트워크·지갑 의존 없음)
//
// library/labs/method/savings_v0_1.md 명세의 "실행 가능한 기준 구현"이다. 시나리오 라운드
// (library/labs/scripts/run_round.mjs)의 채점 대상이며, 이 모듈은 gdc-core.js / gdc-bank.js 에 연결되어
// 있지 않다. 실제 잔액을 움직이지 않고, 서버에도 아직 없다.
// 예금 이자 지급은 LEGAL-HOLD(gdc-bank.js 상단)이므로 rateBp > 0 은 시뮬레이션에서만 쓴다.
//
// 금액은 정수 ₮, 이율은 정수 bp, 이자는 1/100 ₮(센트) 정수로 계산한 뒤 마지막에만 나눈다 (부동소수점 오차 없음).
// ══════════════════════════════════════════════════════════════

export const SAVINGS = Object.freeze({
  minMonthly: 100,
  maxMonthly: 1000,   // 1회 이체 상한(LIMITS.transferPerTx)과 같다
  terms: Object.freeze([6, 12]),
  maxRateBp: 50,
  earlyRateNum: 1,    // 중도해지 이율 = 약정 이율의 1/2
  earlyRateDen: 2,
  autoTerminateConsecutiveMisses: 2,
});

const isInt = (x) => typeof x === 'number' && Number.isInteger(x);

export function evaluateSavings({ monthlyAmount, termMonths, rateBp, outcomes, cancelAt }) {
  if (!isInt(monthlyAmount) || monthlyAmount < SAVINGS.minMonthly || monthlyAmount > SAVINGS.maxMonthly) return { error: 'AMOUNT_INVALID' };
  if (!SAVINGS.terms.includes(termMonths)) return { error: 'TERM_INVALID' };
  if (!isInt(rateBp) || rateBp < 0 || rateBp > SAVINGS.maxRateBp) return { error: 'RATE_INVALID' };
  if (!Array.isArray(outcomes) || outcomes.length > termMonths || outcomes.some(o => o !== 'paid' && o !== 'missed')) return { error: 'OUTCOMES_INVALID' };
  if (cancelAt !== undefined && cancelAt !== null) {
    if (!isInt(cancelAt) || cancelAt < 1 || cancelAt > termMonths || cancelAt > outcomes.length) return { error: 'CANCEL_INVALID' };
  }

  const paidMonths = [];
  let status = 'active';
  let endMonth = 0;
  for (let k = 1; k <= outcomes.length; k++) {
    endMonth = k;
    if (outcomes[k - 1] === 'paid') paidMonths.push(k);
    if (outcomes[k - 1] === 'missed' && k >= 2 && outcomes[k - 2] === 'missed') { status = 'auto_terminated'; break; }
    if (cancelAt === k && k < termMonths) { status = 'cancelled'; break; }
    if (k === termMonths) { status = 'matured'; break; }
  }

  const paidCount = paidMonths.length;
  const principal = paidCount * monthlyAmount;
  if (status === 'active') return { status, endMonth, paidCount, principal, interest: 0, payout: null };

  let interestCents;
  if (status === 'matured') {
    let s = 0;
    for (const j of paidMonths) s += monthlyAmount * rateBp * (termMonths - j + 1);
    interestCents = Math.floor(s / 1200);
  } else {
    let s = 0;
    for (const j of paidMonths) s += monthlyAmount * rateBp * (endMonth - j + 1);
    interestCents = Math.floor((s * SAVINGS.earlyRateNum) / (1200 * SAVINGS.earlyRateDen));
  }
  const interest = interestCents / 100;
  return { status, endMonth, paidCount, principal, interest, payout: (principal * 100 + interestCents) / 100 };
}
