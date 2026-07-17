// ══════════════════════════════════════════════════════════════
// gdc-bank.js — GDC 예치·보관 모듈 (LEGAL-HOLD 축소판)
//
// 2026-07-18 법적 검토에 따라 기능 범위를 조정했다:
//   ✅ 활성화: 무이자 예치·보관(custody) — openDeposit / listDeposits
//   🔒 LEGAL-HOLD: 이자 지급(accrueInterest), 대출(applyLoan/repayLoan)
//      은행법상 "예금+이자"는 은행업 인가 없이 취급 시 유사수신행위의
//      규제에 관한 법률 위반 소지, 대출은 대부업법상 미등록 대부업
//      영업 소지가 있어 법률 검토 완료 전까지 비활성화한다.
//      원본 로직은 파일 하단에 주석으로 보존 — 검토 통과 후 그대로
//      복구 가능하도록 남겨둔다. 활성화 전 별도 법률 자문 필수.
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
 * 🔒 LEGAL-HOLD — 아래는 이자 지급·대출 원본 로직(2026-07-17 이전
 * 버전에서 이관). Supabase 직접 호출 방식이라 그대로 되살릴 수는
 * 없고(config.js에 SUPABASE_URL/KEY 없음, _updateBalance()도 정의된
 * 적 없는 참조 오류였음 — 애초에 실행 불가 상태였다), 법률 검토
 * 통과 후 위 openDeposit()과 같은 방식(transfer() + 신규 Worker
 * 엔드포인트)으로 재작성할 것.
 *
 * export async function accrueInterest() { ... 일별 이자 지급 ... }
 * export async function applyLoan({ userGuid, amount, termMonths, repayMethod }) { ... }
 * export async function repayLoan({ userGuid, loanId, paymentSeq }) { ... }
 *
 * 전체 원본은 git 이력(이 커밋의 부모)에서 확인 가능.
 * ════════════════════════════════════════════════════════════ */
