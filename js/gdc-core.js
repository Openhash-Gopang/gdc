// ══════════════════════════════════════════════════════════════
// gdc-core.js — GDC 핵심 모듈 v2.0
// v2.0: fs_account 표준 코드, source 추가, 서명검증 제거
//       PDV는 Worker /pdv/report 경유, gdc_settle_ledger RPC 사용
// ══════════════════════════════════════════════════════════════

import { SUPABASE_URL, SUPABASE_KEY, WORKER_URL } from '../config.js';

const H = {
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json',
};

// ── 서명된 요청 공용 헬퍼 ────────────────────────────────────
// 2026-07-14 신설 — "Supabase는 더 이상 사용하면 안됩니다" 지시 반영.
// getBalance/getFinancials/settleLedger 세 함수가 전부 Worker의
// 서명 인증 엔드포인트(L1 PocketBase 기반)를 호출하므로, 공통 서명
// 로직을 한 곳으로 뺐다. window.gopangWallet은 /gopang-wallet.js가
// 이 페이지 어딘가에서 이미 비동기 자동초기화해뒀다고 가정한다 —
// 초기화 전에 호출되면 null을 반환하고 호출부가 처리한다.
async function _signedFinancialsGet(userGuid) {
  const wallet = window.gopangWallet;
  if (!wallet || typeof wallet.signPayload !== 'function' || wallet.guid !== userGuid) {
    console.warn('[GDC] financials: 지갑 미초기화 또는 guid 불일치 — 건너뜀');
    return null;
  }
  const ts = String(Date.now());
  const sigMsg = `financials:${userGuid}:${wallet.publicKeyB64u}:${ts}`;
  const signature = await wallet.signPayload(sigMsg);
  const qs = new URLSearchParams({ guid: userGuid, pubkey: wallet.publicKeyB64u, signature, ts });
  const res = await fetch(`${WORKER_URL}/biz/financials?${qs}`);
  return res.json();
}

// ── 잔액 조회 ─────────────────────────────────────────────────
// 2026-07-14 재작성(2차) — 직전 버전은 L1 profiles.extra.fs['bs-cash']를
// 읽으려 했는데, 검증해보니 그 필드엔 아무 것도 쓰지 않는다(bs-cash는
// L1 blocks 원장을 재생해서 계산하는 값이지, profiles 레코드에 저장되는
// 값이 아니다) — 그대로 뒀으면 잔액이 항상 0으로 보였을 것이다. 이미
// 있던 GET /biz/balance(L1 /api/balance 프록시, 재대사용으로 07-07에
// 신설됨, 서명 불필요)를 대신 쓴다 — 이게 K-Market 결제와 동일한, L1이
// 실제로 계산하는 진짜 잔액이다.
export async function getBalance(userGuid) {
  try {
    const res  = await fetch(`${WORKER_URL}/biz/balance?guid=${encodeURIComponent(userGuid)}`);
    const data = await res.json().catch(() => null);
    return data?.ok ? (data.balance || 0) : 0;
  } catch (e) {
    console.warn('[GDC] getBalance 실패:', e.message);
    return 0;
  }
}

// ── 재무제표 전체 조회 ────────────────────────────────────────
// 2026-07-14 재작성(2차) — bs(잔액)는 L1 blocks 원장(GET /biz/balance)에서,
// pl(매출·매출원가)은 L1 profiles.extra.fs.pl(GET /biz/financials,
// handleSettleLedger가 씀)에서 각각 가져와 합친다 — 서로 다른 저장소라
// 병렬로 조회한다.
export async function getFinancials(userGuid) {
  const [balanceData, plData] = await Promise.all([
    fetch(`${WORKER_URL}/biz/balance?guid=${encodeURIComponent(userGuid)}`).then(r => r.json()).catch(() => null),
    _signedFinancialsGet(userGuid),
  ]);
  return {
    bs: { 'bs-cash': balanceData?.ok ? balanceData.balance : 0 },
    pl: plData?.ok ? (plData.fs?.pl || {}) : {},
  };
}

// ── 재무제표 갱신 (L1 pending_claims 기반, Worker /biz/settle-ledger 경유) ──
// 2026-07-14 재작성 — Supabase RPC gdc_settle_ledger는 fs_ledger에서
// revenue/purchase/opex/cogs를 집계했는데, K-Market 주문 파이프라인이
// 2026-07-07 L1로 이관되며 그 계정들에 더 이상 아무것도 쓰이지 않아 이
// RPC가 계속 공허한 결과만 반환하고 있었다(2026-07-14 검증에서 발견).
// 이제 실제 매출·매출원가가 쌓이는 L1 pending_claims를 Worker가 직접
// 서명검증·집계하는 새 엔드포인트를 호출한다. Supabase 쓰기는 없다.
export async function settleLedger(userGuid) {
  const wallet = window.gopangWallet;
  if (!wallet || typeof wallet.signPayload !== 'function' || wallet.guid !== userGuid) {
    console.warn('[GDC] settleLedger: 지갑 미초기화 또는 guid 불일치 — 건너뜀');
    return null;
  }
  const ts = String(Date.now());
  const sigMsg = `settle:${userGuid}:${wallet.publicKeyB64u}:${ts}`;
  const signature = await wallet.signPayload(sigMsg);

  const res = await fetch(`${WORKER_URL}/biz/settle-ledger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guid: userGuid, pubkey: wallet.publicKeyB64u, signature, ts }),
  });
  return res.json();
}

// ── GDC 이체 (메인) ──────────────────────────────────────────
// 2026-07-14 재작성 — Supabase fs_ledger 직접 쓰기(bs-cash 차변/대변)를
// 걷어냈다. 검증 결과 bs-cash의 실제 갱신은 지금까지 그 fs_ledger 기록을
// (구)gdc_settle_ledger RPC가 읽어서 처리해왔는데, 이 RPC 호출 경로가
// 이번 이관으로 사라지므로 그대로 두면 이체해도 잔액이 실제로는 바뀌지
// 않는 상태가 될 뻔했다(2026-07-14 지시로 발견·수정).
//
// 새 경로: K-Market 결제가 쓰는 것과 동일한 L1 원장(POST /biz/order →
// L1 /api/tx)을 그대로 재사용한다 — tx.items를 빈 배열로 보내면
// handleBizOrder가 카탈로그/가격 검증을 건너뛰고 순수 송금으로 처리한다
// (이미 그렇게 설계돼 있었다 — worker.js 3448행 부근 주석 참고). 새
// Worker 엔드포인트를 만들 필요가 없었다.
//
// ⚠️ 알려진 부작용(고치지 않고 남겨둠) — main.pb.js가 tx_2party 블록의
// 청구권을 무조건 fs_account:'pl-purchase'(구매자)/'pl-revenue'(판매자)로
// 태그한다. 즉 이 경로로 보낸 개인 간 이체가 받는 사람 쪽엔 "매출"로
// 잡힌다 — 시장 거래와 개인 송금을 구분하는 tx_type이 main.pb.js(L1
// PocketBase 훅, Cloudflare Worker와 별도 배포 대상)에 없기 때문이다.
// 근본 수정은 후속 작업.
export async function transfer({ fromGuid, toGuid, amount, memo, sessionId }) {
  if (amount <= 0) throw new Error('이체 금액은 0보다 커야 합니다.');
  // 2026-07-14 사고실험에서 발견 — 자기 자신에게 보내면 L1 computeBalance상
  // 순액은 0(더하고 바로 빼서 상쇄)이지만, main.pb.js가 buyer_claim(부채)과
  // seller_claim(매출)을 같은 guid에 둘 다 발행해버려 pl-revenue가 허위로
  // 부풀어 오른다(자기 자신과의 무의미한 거래가 "매출"로 잡힘). 클라이언트
  // 단에서 원천 차단한다.
  if (fromGuid === toGuid) throw new Error('자기 자신에게는 이체할 수 없습니다.');

  const wallet = window.gopangWallet;
  if (!wallet || typeof wallet.sign !== 'function' || wallet.guid !== fromGuid) {
    throw new Error('[GDC] transfer: 지갑 미초기화 또는 guid 불일치');
  }

  const fromBalance = await getBalance(fromGuid);
  if (fromBalance < amount) throw new Error(`잔액 부족: 보유 ₮${fromBalance.toLocaleString()}`);

  // wallet.sign()이 prev_settle_hash 주입·UTXO tx 빌드·Ed25519 서명까지
  // 전부 처리한다(profile.html _submitOrder와 동일한, 이미 검증된 경로) —
  // items를 비워서 카탈로그 검증을 건너뛴다.
  const signedTx = await wallet.sign({
    outputs:     [{ recipient_guid: toGuid, amount }],
    items:       [],
    seller_guid: toGuid,
  });

  const res = await fetch(`${WORKER_URL}/biz/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tx:               signedTx.tx,
      tx_hash:          signedTx.tx_hash,
      buyer_sig:        signedTx.buyer_sig,
      buyer_public_key: signedTx.buyer_public_key,
      prev_settle_hash: signedTx.prev_settle_hash,
      from_guid:        fromGuid,
      seller_guid:      toGuid,
      memo:             memo || 'GDC 이체',
      session_id:       sessionId || signedTx.tx_hash,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.detail || data.error || `이체 실패 (HTTP ${res.status})`);
  }

  // 송신자(나) 쪽 로컬 지갑 자기갱신 — buyer_claim만 내 것이다.
  // seller_claim(수신자 몫)은 여기서 적용하지 않는다 — 수신자가 다른
  // 기기/세션일 수 있어서다. Worker가 이미 seller_claim을 L1
  // pending_claims에 넣어뒀으므로(handleBizOrder 참고) 수신자는 다음
  // 접속 시 GET /biz/claims로 받아간다.
  if (data.buyer_claim) {
    try {
      await wallet.redeemClaim({
        block_hash: data.block_hash,
        block_id:   data.block_id,
        tx_hash:    data.tx_hash,
        claims:     [data.buyer_claim],
      });
    } catch (e) {
      console.warn('[GDC] transfer: 로컬 지갑 자기갱신 실패(결제 자체는 완료됨):', e.message);
    }
  }

  // PDV 기록 — Worker /pdv/report 경유 (P2 원칙)
  await _pdvViaWorker({
    ipv6:      fromGuid,
    sessionId: sessionId || data.tx_hash,
    summary:   `GDC 이체 ₮${amount.toLocaleString()} → ${toGuid.slice(0,8)}…`,
    what:      `GDC 이체 ₮${amount.toLocaleString()}`,
    how:       'GDC 이체 트랜잭션 (L1 /biz/order)',
    why:       memo || 'GDC 이체',
    svc:       'kgdc',
  });

  return {
    txId:      data.tx_hash,
    from:      fromGuid,
    to:        toGuid,
    amount,
    blockHash: data.block_hash,
    timestamp: new Date().toISOString(),
  };
}

// ── fs_ledger 기록 (내부) — 표준 코드 사용 ───────────────────
async function _ledger({ txId, guid, counterpart, direction, amount, fsAccount, source, memo, txAt }) {
  return fetch(`${SUPABASE_URL}/rest/v1/fs_ledger`, {
    method: 'POST',
    headers: { ...H, 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      tx_id:     txId,
      guid,
      counterpart,
      direction,
      amount,
      fs_account: fsAccount,   // 표준 코드: bs-cash, pl-revenue 등
      source:     source || 'gdc',
      item_name:  memo,
      quantity:   1,
      memo,
      tx_at:      txAt,
    }),
  });
}

// ── PDV 기록 — Worker /pdv/report 경유 (P2 원칙) ─────────────
async function _pdvViaWorker({ ipv6, sessionId, summary, what, how, why, svc, blockHash, blockId }) {
  const now = new Date().toISOString();
  return fetch(`${WORKER_URL}/pdv/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      report: {
        svc,
        session_id:   sessionId,
        reporter_svc: 'kgdc',
        who:  { ipv6, role: 'user' },
        when: { period_start: now, period_end: now },
        where:{ svc_url: 'https://gdc.gopang.net' },
        what: { summary },
        how:  { method: how },
        why:  { goal: why },
        // STEP 09: block_hash 있으면 동기 앵커링
        block_hash: blockHash || null,
        block_id:   blockId   || null,
      },
    }),
  }).catch(e => console.warn('[GDC] PDV 기록 실패:', e.message));
}

// ── SHA-256 해시 ─────────────────────────────────────────────
async function _sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2,'0')).join('');
}

// ── export (외부 모듈용) ──────────────────────────────────────
export { _pdvViaWorker, _ledger };
