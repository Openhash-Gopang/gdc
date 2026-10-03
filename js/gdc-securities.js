// ══════════════════════════════════════════════════════════════
// gdc-securities.js — 증권 운용·이자 재원 규칙의 기준 구현 (순수 함수, 네트워크·지갑 의존 없음)
//
// library/labs/method/securities_v0_1.md 명세의 "실행 가능한 기준 구현"이다. 시나리오 라운드
// (library/labs/scripts/run_round.mjs)의 채점 대상이며, gdc-core.js / gdc-bank.js 에 연결되어 있지 않다.
// 실제 잔액을 움직이지 않고 서버에도 없다. 이자는 현금 수익에서만 나가며 원금을 줄이지 않는다.
// 금액은 정수 ₮, 이자는 1/100 ₮(센트) 정수.
// ══════════════════════════════════════════════════════════════

export const SECURITIES = Object.freeze({
  grades: Object.freeze(['AAA', 'AA', 'A', 'BBB', 'BB', 'C']),
  maxPayoutBp: 8000,
  issuerMaxNum: 1,   // 한 종목 ≤ 원금의 1/5
  issuerMaxDen: 5,
  investedMaxNum: 7, // 운용 원가 ≤ 원금의 7/10
  investedMaxDen: 10,
});

const isInt = (x) => typeof x === 'number' && Number.isInteger(x);
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const nonEmptyStr = (x) => typeof x === 'string' && x.length > 0;

export function evaluateSecurities(input) {
  const { principal, positions, serverCost, carryDeficit, payoutBp, depositors } = isObj(input) ? input : {};
  if (!isInt(principal) || principal < 0) return { error: 'PRINCIPAL_INVALID' };
  const pos = positions === undefined || positions === null ? [] : positions;
  if (!Array.isArray(pos)) return { error: 'POSITIONS_INVALID' };
  const seenP = new Set();
  for (const p of pos) {
    if (!isObj(p) || !nonEmptyStr(p.id) || !SECURITIES.grades.includes(p.grade) || !isInt(p.cost) || p.cost < 1 || !isInt(p.income) || p.income < 0 || seenP.has(p.id)) return { error: 'POSITIONS_INVALID' };
    seenP.add(p.id);
  }
  if (!isInt(serverCost) || serverCost < 0) return { error: 'COST_INVALID' };
  if (!isInt(carryDeficit) || carryDeficit < 0) return { error: 'CARRY_INVALID' };
  if (!isInt(payoutBp) || payoutBp < 0 || payoutBp > SECURITIES.maxPayoutBp) return { error: 'PAYOUT_INVALID' };
  const dep = depositors === undefined || depositors === null ? [] : depositors;
  if (!Array.isArray(dep)) return { error: 'DEPOSITORS_INVALID' };
  const seenD = new Set();
  for (const d of dep) {
    if (!isObj(d) || !nonEmptyStr(d.id) || !isInt(d.weight) || d.weight < 0 || !isInt(d.promised) || d.promised < 0 || seenD.has(d.id)) return { error: 'DEPOSITORS_INVALID' };
    seenD.add(d.id);
  }

  const investedCost = pos.reduce((s, p) => s + p.cost, 0);
  const violations = [];
  if (pos.some(p => p.grade === 'C')) violations.push('GRADE_C');
  if (pos.some(p => p.cost * SECURITIES.issuerMaxDen > principal * SECURITIES.issuerMaxNum)) violations.push('ISSUER_CONCENTRATION');
  if (investedCost * SECURITIES.investedMaxDen > principal * SECURITIES.investedMaxNum) violations.push('INVESTED_CAP');

  const grossIncome = pos.reduce((s, p) => s + p.income, 0);
  const net = grossIncome - serverCost;
  const afterCarry = net - carryDeficit;
  const distributable = afterCarry >= 0 ? afterCarry : 0;
  const newCarry = afterCarry >= 0 ? 0 : -afterCarry;
  const poolCents = Math.floor((distributable * payoutBp) / 100);
  const W = dep.reduce((s, d) => s + d.weight, 0);
  const shares = dep.map(d => ({ id: d.id, cents: W > 0 ? Math.floor((poolCents * d.weight) / W) : 0 }));
  const paid = shares.reduce((s, x) => s + x.cents, 0);
  const obligationCents = dep.reduce((s, d) => s + d.promised, 0);
  return {
    compliant: violations.length === 0, violations, investedCost, grossIncome, net, distributable, newCarry, poolCents,
    shares, undistributedCents: distributable * 100 - paid, obligationCents,
    shortfallCents: Math.max(0, obligationCents - distributable * 100),
  };
}
