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

// ── 잔액 조회 ─────────────────────────────────────────────────
export async function getBalance(userGuid) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_profiles?primary_guid=eq.${userGuid}&select=extra&limit=1`,
    { headers: H }
  );
  const rows = await res.json();
  if (!rows[0]) return 0;
  return parseFloat(rows[0].extra?.fs?.['bs-cash'] ?? '0') || 0;
}

// ── 재무제표 전체 조회 ────────────────────────────────────────
export async function getFinancials(userGuid) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_profiles?primary_guid=eq.${userGuid}&select=extra&limit=1`,
    { headers: H }
  );
  const rows = await res.json();
  return rows[0]?.extra?.fs || {};
}

// ── 재무제표 갱신 (gdc_settle_ledger RPC 호출) ───────────────
// P6: 서버는 청구권 발행에 그침. Phase 1 타협으로 RPC가 bs-cash 갱신.
export async function settleLedger(userGuid) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/gdc_settle_ledger`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ p_guid: userGuid }),
  });
  return res.json();
}

// ── GDC 이체 (메인) ──────────────────────────────────────────
// v2.0: 서명 검증 제거 (L1 담당), fsAccount 표준 코드 사용
export async function transfer({ fromGuid, toGuid, amount, memo, sessionId }) {
  if (amount <= 0) throw new Error('이체 금액은 0보다 커야 합니다.');

  const fromBalance = await getBalance(fromGuid);
  if (fromBalance < amount) throw new Error(`잔액 부족: 보유 ₮${fromBalance.toLocaleString()}`);

  const txId = await _sha256(`${fromGuid}${toGuid}${amount}${Date.now()}`);
  const now  = new Date().toISOString();

  // fs_ledger 차변 (송신자)
  await _ledger({
    txId, guid: fromGuid, counterpart: toGuid,
    direction: 'debit', amount,
    fsAccount: 'bs-cash', source: 'gdc',
    memo: memo || 'GDC 이체', txAt: now,
  });

  // fs_ledger 대변 (수신자)
  await _ledger({
    txId, guid: toGuid, counterpart: fromGuid,
    direction: 'credit', amount,
    fsAccount: 'bs-cash', source: 'gdc',
    memo: memo || 'GDC 이체 수신', txAt: now,
  });

  // 재무제표 갱신 (RPC)
  await Promise.all([
    settleLedger(fromGuid),
    settleLedger(toGuid),
  ]);

  // PDV 기록 — Worker /pdv/report 경유 (P2 원칙)
  await _pdvViaWorker({
    ipv6:      fromGuid,
    sessionId: sessionId || txId,
    summary:   `GDC 이체 ₮${amount.toLocaleString()} → ${toGuid.slice(0,8)}…`,
    what:      `GDC 이체 ₮${amount.toLocaleString()}`,
    how:       'GDC 이체 트랜잭션',
    why:       memo || 'GDC 이체',
    svc:       'kgdc',
  });

  return { txId, from: fromGuid, to: toGuid, amount, timestamp: now };
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
