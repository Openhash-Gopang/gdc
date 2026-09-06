// ══════════════════════════════════════════════════════════════
// gdc-credit.js — 신용평가·대출금리 산정 모듈
//
// 🔬 필드테스트 승인 (2026-09-06, 대표 지시) — 2026-07-18 LEGAL-HOLD를
// 아래 조건으로 한정 해제한다:
//
//   대상: 현직 금융기관 종사자로 구성된 필드테스터 계정만. 일반 이용자
//   에게는 이 기능이 노출되지 않으며, evaluateCredit()은 해당 계정에
//   gdc_test_financial_statements 레코드가 없으면 항상 오류를 던진다.
//   목적: 상용 서비스 출시가 아니라, GDC 신용평가·대출 메커니즘 자체의
//   미비점을 금융 실무자가 찾아내는 연구개발 마지막 단계.
//   재무 데이터: bs-ar/ap/debt/equity/inventory, pl-*, cf-op는 테스터가
//   시나리오 검증을 위해 직접 입력하는 목업 값이다(실제 회계 연동 아님).
//   bs-cash만 실제 GDC 지갑 잔액에서 가져온다.
//
//   일반 대중 대상 상용 서비스 전환은 이 승인의 범위 밖이며, 별도의
//   법률 자문·은행업/대부업 인허가 검토가 다시 필요하다 — 이 파일을
//   고치는 것으로 그 절차를 대체할 수 없다.
//
// 원본 재무제표 기반 신용평가 로직(GRADE_RATES, 4대 지표 계산)은
// git 이력에 보존돼 있던 버전을 기반으로, 실제 동작하는 서버 스키마
// (gdc_test_financial_statements) 위에 재작성했다.
// ══════════════════════════════════════════════════════════════

import { WORKER_URL } from '../config.js';
import { getBalance } from './gdc-core.js';

// gdc.hondi.net §3 예금·대출 금리 절에 이미 게시된 등급표와 반드시
// 동일해야 한다 — 이 파일이 산정하는 등급의 금리를 사이트 표시값과
// 다르게 두면 안 된다. 등급 구간 대표값(연 이자율)을 쓴다.
export const GRADE_RATES = Object.freeze({
  AAA: 0.005,
  AA:  0.01,
  A:   0.015,
  BBB: 0.025,
  BB:  0.035,
  C:   0.05,
});

// 점수(0~100) → 등급. 배점 근거는 4대 지표 가중치와 동일한 철학으로
// 상위 구간에 후하게, 하위 구간에 촘촘하게 잡았다 — 확정 값이 아니라
// 필드테스트를 통해 조정될 기본값이다.
const GRADE_THRESHOLDS = [
  { min: 90, grade: 'AAA' },
  { min: 78, grade: 'AA'  },
  { min: 65, grade: 'A'   },
  { min: 50, grade: 'BBB' },
  { min: 35, grade: 'BB'  },
  { min: 0,  grade: 'C'   },
];

function scoreToGrade(score) {
  for (const t of GRADE_THRESHOLDS) if (score >= t.min) return t.grade;
  return 'C';
}

// 0으로 나누기 방지 — 분모가 0/음수면 해당 지표는 "판단 불가"로 0점.
function safeRatio(numerator, denominator) {
  if (!(denominator > 0)) return null;
  return numerator / denominator;
}

/**
 * 4대 지표를 계산한다. 사이트(§4 AI 신용평가)에 게시된 정의를 그대로 쓴다.
 *   유동비율(25%)   = (bs-cash + bs-ar) / bs-ap
 *   부채비율(25%)   = bs-debt / bs-equity   (낮을수록 좋음 — 역채점)
 *   영업이익률(30%) = (매출 - 원가 - 판관비) / 매출
 *   현금흐름비율(20%) = cf-op / bs-debt
 */
function computeRatios({ bsCash, fs }) {
  const liquidity = safeRatio(bsCash + (fs.bs_ar || 0), fs.bs_ap);
  const debtRatio = safeRatio(fs.bs_debt || 0, fs.bs_equity);
  const operatingMargin = fs.pl_revenue > 0
    ? (fs.pl_revenue - (fs.pl_cogs || 0) - (fs.pl_opex || 0)) / fs.pl_revenue
    : null;
  const cashFlowRatio = safeRatio(fs.cf_op, fs.bs_debt || 0);

  return { liquidity, debtRatio, operatingMargin, cashFlowRatio };
}

// 각 지표를 0~100점으로 정규화한다 — 임계값은 git 이력의 원본 설계를
// 그대로 이관했다. 필드테스트로 조정될 값이다.
function scoreLiquidity(r) {
  if (r == null) return 0;
  if (r >= 2.0) return 100;
  if (r >= 1.5) return 80;
  if (r >= 1.0) return 60;
  if (r >= 0.5) return 30;
  return 10;
}
function scoreDebt(r) { // 낮을수록 고득점(역채점)
  if (r == null) return 50; // 부채가 아예 없으면(분모 미기재) 중립 처리
  if (r <= 0.3) return 100;
  if (r <= 0.7) return 80;
  if (r <= 1.5) return 55;
  if (r <= 3.0) return 25;
  return 5;
}
function scoreMargin(r) {
  if (r == null) return 0;
  if (r >= 0.20) return 100;
  if (r >= 0.10) return 75;
  if (r >= 0.05) return 50;
  if (r >= 0) return 25;
  return 0;
}
function scoreCashFlow(r) {
  if (r == null) return 50; // 무차입(분모 0)은 판단 유보 중립 처리
  if (r >= 0.5) return 100;
  if (r >= 0.25) return 75;
  if (r >= 0.1) return 50;
  if (r >= 0) return 20;
  return 0;
}

/**
 * 신용평가 실행. userGuid에 gdc_test_financial_statements 레코드가
 * 없으면 즉시 오류(TESTER_ONLY) — 일반 이용자 계정으로 이 함수를
 * 호출해도 절대 등급/금리를 반환하지 않는다.
 */
export async function evaluateCredit(userGuid) {
  if (!userGuid) throw new Error('[GDC-CREDIT] userGuid 필수');

  const res = await fetch(
    `${WORKER_URL}/biz/gdc-test-financial-statement?user_guid=${encodeURIComponent(userGuid)}`
  );
  if (res.status === 404) {
    throw new Error(
      '[GDC-CREDIT] TESTER_ONLY — 이 계정은 필드테스트 대상(금융기관 종사자)으로 ' +
      '등록되어 있지 않습니다. 신용평가·대출은 일반 이용자에게 아직 제공되지 않습니다.'
    );
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(data?.detail || data?.error || `재무제표 조회 실패 (HTTP ${res.status})`);
  }
  const fs = data.record;

  const bsCash = await getBalance(userGuid);
  const ratios = computeRatios({ bsCash, fs });

  const liquidityScore = scoreLiquidity(ratios.liquidity);
  const debtScore = scoreDebt(ratios.debtRatio);
  const marginScore = scoreMargin(ratios.operatingMargin);
  const cashFlowScore = scoreCashFlow(ratios.cashFlowRatio);

  const totalScore =
    liquidityScore * 0.25 +
    debtScore * 0.25 +
    marginScore * 0.30 +
    cashFlowScore * 0.20;

  const grade = scoreToGrade(totalScore);
  const rate = GRADE_RATES[grade];

  return {
    grade,
    annualRate: rate,
    score: Math.round(totalScore * 10) / 10,
    ratios,
    componentScores: {
      liquidity: liquidityScore, debt: debtScore,
      operatingMargin: marginScore, cashFlow: cashFlowScore,
    },
    inputs: { bsCash, ...fs },
    note: '테스트 목적 목업 신용평가 — 실제 금융감독 심사 결과가 아님. ' +
          'bs-cash를 제외한 재무 항목은 필드테스터가 입력한 시나리오 값.',
  };
}
