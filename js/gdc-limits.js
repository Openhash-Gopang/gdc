// ══════════════════════════════════════════════════════════════
// gdc-limits.js — 필드테스트 한도 규칙 (순수 함수, 네트워크·지갑 의존 없음)
//
// 이 파일은 library/labs/method/limits_v0_1.md 명세의 "실행 가능한 기준
// 구현"이다. 두 가지 용도로만 쓴다.
//   1) 시나리오 라운드(library/labs/scripts/run_round.mjs)의 채점 대상
//   2) 서버(worker.js, 별도 저장소)에 같은 규칙을 이식할 때의 대조 기준
//
// ⚠️ 이 파일을 브라우저에서 부르는 것만으로는 한도가 강제되지 않는다.
// 한도는 서버가 강제해야 하며(클라이언트 검사는 우회 가능), 2026-10-03
// 시점에 이 모듈은 gdc-core.js / gdc-bank.js 에 연결되어 있지 않다.
// 연결 여부는 서버 이식 계획과 함께 정한다 (명세 §6).
//
// 금액 단위는 GDC(₮). 런칭 기준가 1₮ = KRW 1,000 (README §2).
// ══════════════════════════════════════════════════════════════

export const KRW_PER_GDC = 1000;

// 각 값의 근거·성격(참고값인지 GDC 설계값인지)은 명세 §2 표에 있다.
export const LIMITS = Object.freeze({
  transferPerTx:        1000,  // 1회 이체 상한
  outflowPerDay:        2000,  // 1일(KST 달력일) 유출 합계 상한
  newRecipientPerTx:     100,  // 처음 보내는 수취인에게 1회 상한
  loanPerLoan:          3000,  // 대출 1건 원금 상한
  loanOutstandingTotal: 5000,  // 미상환 원금 + 신규 원금 합계 상한
  loanEquityRatio:      0.7,   // 대출 원금 ≤ 순자산(bs_equity) × 0.7  (README §5-2 v1.0 스펙)
  dsrCap:               0.40,  // 연 원리금 상환액 / 연 소득 상한
  stressSpread:         0.015, // DSR 계산 시 금리에 더하는 가산금리
  assumedTermMonths:    12,    // 서버 스키마에 만기 필드가 없어 가정하는 만기
});

export const CODE = Object.freeze({
  OK:                  'OK',
  AMOUNT_INVALID:      'AMOUNT_INVALID',
  PER_TX_LIMIT:        'PER_TX_LIMIT',
  NEW_RECIPIENT_LIMIT: 'NEW_RECIPIENT_LIMIT',
  DAILY_LIMIT:         'DAILY_LIMIT',
  LOAN_PER_LIMIT:      'LOAN_PER_LIMIT',
  LOAN_TOTAL_LIMIT:    'LOAN_TOTAL_LIMIT',
  LOAN_EQUITY_LIMIT:   'LOAN_EQUITY_LIMIT',
  NO_INCOME:           'NO_INCOME',
  DSR_EXCEEDED:        'DSR_EXCEEDED',
});

function isPositiveNumber(x) {
  return typeof x === 'number' && Number.isFinite(x) && x > 0;
}
function fail(code, detail) { return { ok: false, code, detail }; }

/**
 * 유출 거래(이체·예치·대출 상환 등) 한도 검사. 검사 순서가 결과를 결정한다.
 *   금액 유효성 -> 1회 상한 -> 신규 수취인 상한 -> 1일 누적 상한
 * 경계값은 포함한다(상한과 같으면 통과).
 */
export function checkTransfer({ amount, outflowToday = 0, recipientKnown = true }) {
  if (!isPositiveNumber(amount)) return fail(CODE.AMOUNT_INVALID, '금액은 0보다 큰 유한한 숫자여야 합니다.');
  if (amount > LIMITS.transferPerTx) {
    return fail(CODE.PER_TX_LIMIT, `1회 한도 ₮${LIMITS.transferPerTx} 초과`);
  }
  if (!recipientKnown && amount > LIMITS.newRecipientPerTx) {
    return fail(CODE.NEW_RECIPIENT_LIMIT, `처음 보내는 수취인 한도 ₮${LIMITS.newRecipientPerTx} 초과`);
  }
  if (outflowToday + amount > LIMITS.outflowPerDay) {
    return fail(CODE.DAILY_LIMIT, `1일 한도 ₮${LIMITS.outflowPerDay} 초과 (오늘 누적 ₮${outflowToday})`);
  }
  return { ok: true, code: CODE.OK };
}

/** 원리금균등 월 상환액. annualRate는 연 이율(소수), n은 개월 수. */
export function monthlyPayment(principal, annualRate, n) {
  const r = annualRate / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

/**
 * 대출 한도 검사. 검사 순서:
 *   금액 유효성 -> 1건 상한 -> 잔액 합계 상한 -> 순자산 비율 -> 소득 유무 -> DSR
 *
 * annualIncome은 호출자가 정한다. 필드테스트에서는 재무제표의 영업이익
 * (pl_revenue - pl_cogs - pl_opex)을 연 소득 대용으로 쓴다 (명세 §3).
 * existingAnnualDebtService는 기존 대출의 연 원리금 상환액이며, 서버에
 * 상환 일정 데이터가 없어 지금은 호출자가 넘기는 값(기본 0)이다.
 */
export function checkLoan({
  principal, outstanding = 0, annualRate, annualIncome, equity,
  existingAnnualDebtService = 0, termMonths = LIMITS.assumedTermMonths,
}) {
  if (!isPositiveNumber(principal)) return fail(CODE.AMOUNT_INVALID, '대출 원금은 0보다 큰 유한한 숫자여야 합니다.');
  if (principal > LIMITS.loanPerLoan) {
    return fail(CODE.LOAN_PER_LIMIT, `1건 한도 ₮${LIMITS.loanPerLoan} 초과`);
  }
  if (outstanding + principal > LIMITS.loanOutstandingTotal) {
    return fail(CODE.LOAN_TOTAL_LIMIT, `잔액 합계 한도 ₮${LIMITS.loanOutstandingTotal} 초과`);
  }
  const equityCap = Math.max(0, equity || 0) * LIMITS.loanEquityRatio;
  if (principal > equityCap) {
    return fail(CODE.LOAN_EQUITY_LIMIT, `순자산의 ${LIMITS.loanEquityRatio * 100}% (₮${equityCap}) 초과`);
  }
  if (!(annualIncome > 0)) return fail(CODE.NO_INCOME, '소득(영업이익)이 0 이하여서 DSR을 계산할 수 없습니다.');

  const stressedRate = annualRate + LIMITS.stressSpread;
  const annualService = monthlyPayment(principal, stressedRate, termMonths) * 12;
  const dsr = (existingAnnualDebtService + annualService) / annualIncome;
  if (dsr > LIMITS.dsrCap) {
    return { ok: false, code: CODE.DSR_EXCEEDED, detail: `DSR ${(dsr * 100).toFixed(1)}% > ${LIMITS.dsrCap * 100}%`, dsr };
  }
  return { ok: true, code: CODE.OK, dsr };
}
