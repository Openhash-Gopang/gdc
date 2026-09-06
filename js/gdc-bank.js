// ══════════════════════════════════════════════════════════════
// gdc-bank.js — GDC 예치·보관·대출 모듈
//
// 2026-07-18 법적 검토에 따라 기능 범위를 조정했었고, 2026-09-06
// 대표 지시로 대출은 "현직 금융기관 종사자 필드테스터" 범위에 한해
// 재개했다(js/gdc-credit.js 상단 승인 문구 참고):
//   ✅ 활성화(전체 이용자): 무이자 예치·보관(custody) — openDeposit / listDeposits
//   ✅ 활성화(필드테스터 한정): 대출 신청·상환 — applyLoan / repayLoan
//      (서버가 gdc_test_financial_statements 레코드 존재로 재게이트)
//   🔒 유지: 예금 이자 지급(accrueInterest) — 정산(F: 대출수익-서버비용
//      =예금이자재원) 파이프라인이 별도로 구축되기 전까지는 무이자
//      예치·보관만 라이브다. 일반 상용화는 이 승인의 범위 밖이며 별도
//      법률 자문·인허가 검토가 다시 필요하다.
//
// 서버 연동: Supabase 직접 호출을 걷어내고, worker.js에 이미 구현된
// L1 기반 엔드포인트(POST /biz/gdc-deposit, GET /biz/gdc-deposits)를
// 사용한다. 예치금 이동 자체는 gdc-core.js의 transfer()(=/biz/order,
// K-Market 결제와 동일 경로)로 처리한 뒤, 그 tx_hash를 서버가 검증하는
// 2단계 흐름이다(handleGdcDepositCreate 참고).
// ══════════════════════════════════════════════════════════════

import { WORKER_URL } from '../config.js';
import { getBalance, transfer, _pdvViaWorker } from './gdc-core.js';

// gopang worker.js의 GDC_DEPOSIT_VAULT_GUID와 반드시 동일해야 한다.
const GDC_DEPOSIT_VAULT_GUID = 'gdc-deposit-vault';

// ── 예치 개설 (무이자) ───────────────────────────────────────
// productType은 더 이상 금리를 결정하지 않는다 — 전부 무이자
// 보관이며, 라벨링(요구불/기간 지정 보관)에만 쓰인다.
export async function openDeposit({ userGuid, amount, productType = 'demand' }) {
  if (!(amount > 0)) throw new Error('예치 금액은 0보다 커야 합니다.');
  if (amount < 1000) throw new Error('최소 예치금은 ₮1,000 입니다.');

  const balance = await getBalance(userGuid);
  if (balance < amount) throw new Error(`잔액 부족: 보유 ₮${balance.toLocaleString()}`);

  // 1) 실제 자금 이동 — 사용자 → 예치금고(GDC_DEPOSIT_VAULT_GUID),
  //    K-Market 결제와 동일한 서명·검증 경로(gdc-core.js transfer()).
  const tx = await transfer({
    fromGuid: userGuid,
    toGuid:   GDC_DEPOSIT_VAULT_GUID,
    amount,
    memo:     `GDC 예치 개설 (${_productLabel(productType)})`,
  });

  // 2) 예치 메타데이터 등록 — 서버가 위 tx_hash를 재검증한다
  //    (buyer_guid 일치 + vault 수신 output 금액 일치, handleGdcDepositCreate).
  const res = await fetch(`${WORKER_URL}/biz/gdc-deposit`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_guid:     userGuid,
      product_type:  productType,
      principal:     amount,
      interest_rate: 0,          // 무이자 고정 — LEGAL-HOLD 해제 전까지 절대 변경 금지
      vault_tx_hash: tx.txId,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.detail || data.error || `예치 등록 실패 (HTTP ${res.status})`);
  }

  await _pdv(userGuid, 'gdc_deposit_custody',
    `예치 개설(무이자) ₮${amount.toLocaleString()} (${_productLabel(productType)})`,
    { depositId: data.id, amount, productType, txHash: tx.txId });

  return { depositId: data.id, amount, productType, rate: 0, txHash: tx.txId };
}

// ── 예치 내역 조회 ───────────────────────────────────────────
export async function listDeposits(userGuid, limit = 10) {
  const qs  = new URLSearchParams({ user_guid: userGuid, limit: String(limit) });
  const res = await fetch(`${WORKER_URL}/biz/gdc-deposits?${qs}`);
  const data = await res.json().catch(() => ({ items: [] }));
  if (!res.ok || !data.ok) {
    throw new Error(data.detail || data.error || `예치 내역 조회 실패 (HTTP ${res.status})`);
  }
  return data.items || [];
}

// ── 내부 유틸 ─────────────────────────────────────────────────
function _productLabel(t) {
  return { demand:'요구불 보관', time_7:'7일 지정 보관', time_30:'30일 지정 보관', time_365:'365일 지정 보관' }[t] || t;
}
async function _pdv(userGuid, recordType, summary, extra) {
  return _pdvViaWorker({
    ipv6:      userGuid,
    sessionId: extra?.txHash || extra?.depositId || null,
    summary,
    what:      summary.split(' ')[0],
    how:       'GDC 자동',
    why:       '예치·보관',
    svc:       'kgdc',
  });
}

// ── 예치 인출(해지) ──────────────────────────────────────────
// 2026-07-18: worker.js에 POST /biz/gdc-deposit-close 신설(vault→user
// 반환 블록을 서버 관리자 권한으로 생성 — vault는 실제 개인키가 없는
// 시스템 계정이라 사용자처럼 서명할 수 없음, mint와 동일 패턴).
// 본인 확인을 위해 사용자 지갑 서명이 필요하다.
export async function closeDeposit({ userGuid, depositId }) {
  const wallet = window.gopangWallet;
  if (!wallet || typeof wallet.signPayload !== 'function' || wallet.guid !== userGuid) {
    throw new Error('[GDC] closeDeposit: 지갑 미초기화 또는 guid 불일치');
  }
  const ts = String(Date.now());
  const sigMsg = `gdc-deposit-close:${userGuid}:${wallet.publicKeyB64u}:${ts}`;
  const signature = await wallet.signPayload(sigMsg);

  const res = await fetch(`${WORKER_URL}/biz/gdc-deposit-close`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_guid: userGuid, deposit_id: depositId,
      pubkey: wallet.publicKeyB64u, signature, ts,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.detail || data.error || `예치 인출 실패 (HTTP ${res.status})`);
  }

  await _pdv(userGuid, 'gdc_deposit_withdraw',
    `예치 인출 ₮${data.amount.toLocaleString()}`,
    { depositId, amount: data.amount, txHash: data.tx_hash });

  return { amount: data.amount, txHash: data.tx_hash };
}

/* ════════════════════════════════════════════════════════════
 * 🔬 필드테스트 승인 (2026-09-06, 대표 지시) — 위 LEGAL-HOLD 중 대출
 * 기능을 "현직 금융기관 종사자 필드테스터" 범위로 한정 해제한다.
 * 서버(handleGdcTestLoanApply/handleGdcTestLoanRepay)가 gdc_test_
 * financial_statements 레코드 존재 여부로 다시 한번 게이트를 건다 —
 * 클라이언트 쪽 이 파일만으로는 우회할 수 없다. 일반 상용화는 별도
 * 법률 검토·인허가 절차가 다시 필요하며 이 승인의 범위 밖이다.
 * ════════════════════════════════════════════════════════════ */

// gopang worker.js의 대출금 지급/상환 계정 GUID와 반드시 동일해야 한다.
const GDC_LOAN_VAULT_GUID = 'gdc-loan-vault';

// ── 대출 신청(목업) — evaluateCredit() 등급으로 즉시 실행 ─────────
export async function applyLoan({ userGuid, principal }) {
  if (!(principal > 0)) throw new Error('대출 원금은 0보다 커야 합니다.');

  const wallet = window.gopangWallet;
  if (!wallet || typeof wallet.signPayload !== 'function' || wallet.guid !== userGuid) {
    throw new Error('[GDC] applyLoan: 지갑 미초기화 또는 guid 불일치');
  }
  const ts = String(Date.now());
  const sigMsg = `gdc-test-loan-apply:${userGuid}:${principal}:${wallet.publicKeyB64u}:${ts}`;
  const signature = await wallet.signPayload(sigMsg);

  const res = await fetch(`${WORKER_URL}/biz/gdc-test-loan-apply`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_guid: userGuid, principal,
      pubkey: wallet.publicKeyB64u, signature, ts,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.detail || data.error || `대출 신청 실패 (HTTP ${res.status})`);
  }

  await _pdv(userGuid, 'gdc_test_loan_disbursed',
    `대출 실행(목업) ₮${principal.toLocaleString()} (등급 ${data.grade}, 연 ${(data.annual_rate * 100).toFixed(1)}%)`,
    { loanId: data.loan_id, principal, txHash: data.tx_hash });

  return data; // { loanId, grade, annual_rate, tx_hash, ... }
}

// ── 대출 상환(목업) — 사용자 → 대출금고, 원금/이자 분리는 서버가 계산 ──
export async function repayLoan({ userGuid, loanId, amount }) {
  if (!(amount > 0)) throw new Error('상환 금액은 0보다 커야 합니다.');

  // 1) 실제 자금 이동 — openDeposit()과 동일한 경로(K-Market 결제와 공용).
  const tx = await transfer({
    fromGuid: userGuid,
    toGuid:   GDC_LOAN_VAULT_GUID,
    amount,
    memo:     `GDC 대출 상환(목업) #${loanId}`,
  });

  // 2) 원금/이자 분리 기록 — 서버가 대출 잔액을 기준으로 계산한다.
  const res = await fetch(`${WORKER_URL}/biz/gdc-test-loan-repay`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_guid: userGuid, loan_id: loanId, amount, vault_tx_hash: tx.txId,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.detail || data.error || `대출 상환 처리 실패 (HTTP ${res.status})`);
  }

  await _pdv(userGuid, 'gdc_test_loan_repayment',
    `대출 상환(목업) ₮${amount.toLocaleString()} (원금 ${data.principal_portion}, 이자 ${data.interest_portion})`,
    { loanId, amount, txHash: tx.txId });

  return data; // { principal_portion, interest_portion, outstanding_principal, status }
}
