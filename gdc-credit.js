// ══════════════════════════════════════════════════════════════
// gdc-credit.js — 재무제표 기반 신용평가 (목표: 0.1초 이내)
// ══════════════════════════════════════════════════════════════

import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };

// 신용등급별 대출금리
const GRADE_RATES = {
  AAA: 0.020, AA: 0.030, A:  0.040,
  BBB: 0.055, BB: 0.070, C:  0.080,
};

// 신용등급별 대출한도 배율 (순자산 대비)
const GRADE_LTV = {
  AAA: 0.70, AA: 0.65, A:  0.60,
  BBB: 0.50, BB: 0.35, C:  0.20,
};

// ── 메인: 신용평가 ───────────────────────────────────────────
export async function evaluateCredit(userGuid) {
  const t0 = performance.now();

  // 재무제표 로드
  const res  = await fetch(
    `${SUPABASE_URL}/rest/v1/user_profiles?guid=eq.${userGuid}&select=extra&limit=1`,
    { headers: H }
  );
  const rows = await res.json();
  const fs   = rows[0]?.extra?.fs || {};
  const bs   = fs.bs || {};
  const pl   = fs.pl || {};
  const cf   = fs.cf || {};

  const num = k => parseFloat(k || '0') || 0;

  // 재무 지표 추출
  const cash     = num(bs['bs-cash']);
  const ar       = num(bs['bs-ar']);
  const ap       = num(bs['bs-ap']);
  const debt     = num(bs['bs-debt']);
  const equity   = num(bs['bs-equity']);
  const inventory= num(bs['bs-inventory']);
  const revenue  = num(pl['pl-revenue']);
  const cogs     = num(pl['pl-cogs']);
  const opex     = num(pl['pl-opex']);
  const cfOp     = num(cf['cf-op']);

  // 4대 신용 지표 계산
  const liquidAssets  = cash + ar;
  const liquidityRatio = ap > 0 ? liquidAssets / ap : 10.0;         // 유동비율 (높을수록 좋음)
  const debtRatio      = equity > 0 ? debt / equity : 99.0;         // 부채비율 (낮을수록 좋음)
  const opMargin       = revenue > 0
    ? (revenue - cogs - opex) / revenue : 0.0;                       // 영업이익률 (높을수록 좋음)
  const cfRatio        = debt > 0 ? cfOp / debt : (cfOp > 0 ? 5.0 : 0.0); // 현금흐름비율

  // 점수 계산 (각 25점 만점, 총 100점 → 1000점 환산)
  const s1 = Math.min(25, liquidityRatio  * 10);   // 유동비율 가중치 25%
  const s2 = Math.min(25, Math.max(0, (2.0 - debtRatio) * 12.5)); // 부채비율 25%
  const s3 = Math.min(30, opMargin  * 100);         // 영업이익률 가중치 30%
  const s4 = Math.min(20, cfRatio   * 5);           // 현금흐름비율 20%
  const rawScore = Math.round((s1 + s2 + s3 + s4) * 10);
  const creditScore = Math.min(1000, Math.max(0, rawScore));

  // 등급 결정
  const grade = creditScore >= 950 ? 'AAA'
              : creditScore >= 900 ? 'AA'
              : creditScore >= 800 ? 'A'
              : creditScore >= 700 ? 'BBB'
              : creditScore >= 600 ? 'BB'
              : 'C';

  const loanRate   = GRADE_RATES[grade];
  const maxLoanAmt = Math.floor(equity * GRADE_LTV[grade]);
  const elapsed    = performance.now() - t0;

  const result = {
    userGuid,
    creditScore,
    grade,
    loanRate,
    loanRatePct: (loanRate * 100).toFixed(1) + '%',
    maxLoanAmount: maxLoanAmt,
    indicators: {
      liquidityRatio: +liquidityRatio.toFixed(4),
      debtRatio:      +debtRatio.toFixed(4),
      opMargin:       +opMargin.toFixed(4),
      cfRatio:        +cfRatio.toFixed(4),
    },
    scores: { s1, s2, s3, s4 },
    evaluatedAt: new Date().toISOString(),
    elapsedMs: +elapsed.toFixed(1),
  };

  // 신용평가 이력 저장
  await _saveHistory(userGuid, result);

  return result;
}

// ── 신용평가 이력 저장 ────────────────────────────────────────
async function _saveHistory(userGuid, r) {
  return fetch(`${SUPABASE_URL}/rest/v1/gdc_credit_history`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      user_guid:       userGuid,
      credit_score:    r.creditScore,
      credit_grade:    r.grade,
      loan_rate:       r.loanRate,
      liquidity_ratio: r.indicators.liquidityRatio,
      debt_ratio:      r.indicators.debtRatio,
      op_margin:       r.indicators.opMargin,
      cf_ratio:        r.indicators.cfRatio,
      evaluated_at:    r.evaluatedAt,
    })
  });
}

// ── 신용등급 설명 ─────────────────────────────────────────────
export function gradeDescription(grade) {
  return {
    AAA: '최우수 — 최저 금리 적용, 최대 한도',
    AA:  '우수 — 낮은 금리, 높은 한도',
    A:   '양호 — 표준 금리 적용',
    BBB: '보통 — 중간 금리, 제한적 한도',
    BB:  '주의 — 높은 금리, 낮은 한도',
    C:   '위험 — 최고 금리, 최소 한도',
  }[grade] || '평가 불가';
}
