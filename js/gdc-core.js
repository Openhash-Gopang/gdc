// ══════════════════════════════════════════════════════════════
// gdc-core.js — GDC 핵심 모듈 (잔액·이체·서명)
// ══════════════════════════════════════════════════════════════

import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

const H = {
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json',
};

// ── 잔액 조회 ─────────────────────────────────────────────────
export async function getBalance(userGuid) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_profiles?guid=eq.${userGuid}&select=extra&limit=1`,
    { headers: H }
  );
  const rows = await res.json();
  if (!rows[0]) return 0;
  return parseFloat(rows[0].extra?.fs?.bs?.['bs-cash'] || '0') || 0;
}

// ── 재무제표 전체 조회 ────────────────────────────────────────
export async function getFinancials(userGuid) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_profiles?guid=eq.${userGuid}&select=extra&limit=1`,
    { headers: H }
  );
  const rows = await res.json();
  return rows[0]?.extra?.fs || { bs: {}, pl: {}, cf: {} };
}

// ── GDC 이체 (메인) ──────────────────────────────────────────
// 전제: 디지털 서명 검증 완료 후 호출
export async function transfer({ fromGuid, toGuid, amount, memo, signature, publicKey }) {
  if (amount <= 0) throw new Error('이체 금액은 0보다 커야 합니다.');

  // 1. 잔액 확인
  const fromBalance = await getBalance(fromGuid);
  if (fromBalance < amount) throw new Error(`잔액 부족: 보유 ₮${fromBalance.toLocaleString()}`);

  const txId  = crypto.randomUUID();
  const now   = new Date().toISOString();

  // 2. 서명 기록
  await _recordSignature({ txId, userGuid: fromGuid, publicKey, signature,
    messageHash: await _sha256(`${fromGuid}${toGuid}${amount}${now}`) });

  // 3. fs_ledger 차변 (송신자)
  await _ledger({ txId, guid: fromGuid, counterpart: toGuid,
    direction: 'debit', amount, fsAccount: 'cash',
    memo: memo || 'GDC 이체', txAt: now });

  // 4. fs_ledger 대변 (수신자)
  await _ledger({ txId, guid: toGuid, counterpart: fromGuid,
    direction: 'credit', amount, fsAccount: 'cash',
    memo: memo || 'GDC 이체 수신', txAt: now });

  // 5. user_profiles.extra.fs.bs.bs-cash 업데이트
  await _updateBalance(fromGuid, -amount);
  await _updateBalance(toGuid,    amount);

  // 6. PDV 기록 (송신자)
  await _pdv({ userGuid: fromGuid, recordType: 'gdc_transfer',
    summary: `GDC 이체 ₮${amount.toLocaleString()} → ${toGuid.slice(0,8)}…`,
    what: 'GDC 이체', how: 'ED25519 디지털 서명', why: memo || '이체',
    extra: { txId, fromGuid, toGuid, amount, currency: 'GDC',
             signature: signature?.slice(0,16)+'…', ophashBlock: null } });

  // 7. PDV 기록 (수신자)
  await _pdv({ userGuid: toGuid, recordType: 'gdc_transfer_receive',
    summary: `GDC 수신 ₮${amount.toLocaleString()} ← ${fromGuid.slice(0,8)}…`,
    what: 'GDC 수신', how: 'GDC 이체', why: '수신',
    extra: { txId, fromGuid, toGuid, amount, currency: 'GDC' } });

  return { txId, from: fromGuid, to: toGuid, amount, timestamp: now };
}

// ── 잔액 업데이트 (내부) ─────────────────────────────────────
async function _updateBalance(guid, delta) {
  const res  = await fetch(
    `${SUPABASE_URL}/rest/v1/user_profiles?guid=eq.${guid}&select=extra&limit=1`,
    { headers: H }
  );
  const rows = await res.json();
  const extra = rows[0]?.extra || {};
  const fs    = extra.fs || {};
  const bs    = fs.bs || {};
  const cur   = parseFloat(bs['bs-cash'] || '0') || 0;
  bs['bs-cash'] = String(Math.max(0, cur + delta));
  fs.bs = bs; extra.fs = fs;
  await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?guid=eq.${guid}`,
    { method: 'PATCH', headers: H, body: JSON.stringify({ extra }) });
}

// ── fs_ledger 기록 (내부) ─────────────────────────────────────
async function _ledger({ txId, guid, counterpart, direction, amount, fsAccount, memo, txAt }) {
  return fetch(`${SUPABASE_URL}/rest/v1/fs_ledger`, {
    method: 'POST',
    headers: { ...H, 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      tx_id: txId, guid, counterpart, direction, amount,
      item_name: memo, item_id: null, quantity: 1,
      pdv_log_id: null, fs_account: fsAccount, memo, tx_at: txAt
    })
  });
}

// ── PDV 기록 (내부) ───────────────────────────────────────────
async function _pdv({ userGuid, recordType, summary, what, how, why, extra }) {
  return fetch(`${SUPABASE_URL}/rest/v1/pdv_log`, {
    method: 'POST',
    headers: { ...H, 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      user_guid: userGuid, service_id: 'gopang-gdc',
      record_type: recordType, summary, what, how, why,
      category: 'gdc', extra
    })
  });
}

// ── 서명 기록 (내부) ─────────────────────────────────────────
async function _recordSignature({ txId, userGuid, publicKey, signature, messageHash }) {
  return fetch(`${SUPABASE_URL}/rest/v1/gdc_signatures`, {
    method: 'POST',
    headers: { ...H, 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      tx_id: txId, user_guid: userGuid,
      public_key: publicKey, signature, message_hash: messageHash,
      verified: true, verified_at: new Date().toISOString()
    })
  });
}

// ── SHA-256 해시 ─────────────────────────────────────────────
async function _sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2,'0')).join('');
}
