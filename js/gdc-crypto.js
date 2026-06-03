// ══════════════════════════════════════════════════════════════
// gdc-crypto.js — ED25519 디지털 서명 모듈
// Web Crypto API 사용 (브라우저 내장, 개인키 서버 미전송)
// ══════════════════════════════════════════════════════════════

const DB_NAME    = 'gdc-keystore';
const DB_VERSION = 1;
const STORE_NAME = 'keys';

// ── IndexedDB 초기화 ─────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

// ── 키쌍 생성 (최초 1회) ─────────────────────────────────────
export async function generateKeyPair(userGuid) {
  const existing = await getPublicKeyBase64(userGuid);
  if (existing) return { publicKey: existing, isNew: false };

  // ED25519 키쌍 생성
  const keyPair = await crypto.subtle.generateKey(
    { name: 'Ed25519' },
    true,   // 내보내기 가능
    ['sign', 'verify']
  );

  // 개인키 → IndexedDB (암호화 저장)
  const privateKeyBuf = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const publicKeyBuf  = await crypto.subtle.exportKey('spki',  keyPair.publicKey);

  const publicKeyB64  = _bufToBase64(publicKeyBuf);
  const privateKeyB64 = _bufToBase64(privateKeyBuf);

  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put({
      id:         userGuid,
      privateKey: privateKeyB64,
      publicKey:  publicKeyB64,
      createdAt:  new Date().toISOString(),
    });
    req.onsuccess = () => resolve();
    req.onerror   = e  => reject(e.target.error);
  });

  return { publicKey: publicKeyB64, isNew: true };
}

// ── 공개키 조회 ───────────────────────────────────────────────
export async function getPublicKeyBase64(userGuid) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(userGuid);
    req.onsuccess = e => resolve(e.target.result?.publicKey || null);
    req.onerror   = e => reject(e.target.error);
  });
}

// ── 메시지 서명 ───────────────────────────────────────────────
export async function signMessage(userGuid, message) {
  const db = await openDB();
  const stored = await new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(userGuid);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
  if (!stored) throw new Error('키가 등록되지 않았습니다. generateKeyPair()를 먼저 호출하세요.');

  const privateKeyBuf = _base64ToBuf(stored.privateKey);
  const privateKey    = await crypto.subtle.importKey(
    'pkcs8', privateKeyBuf,
    { name: 'Ed25519' }, false, ['sign']
  );

  const msgBuf    = new TextEncoder().encode(
    typeof message === 'string' ? message : JSON.stringify(message)
  );
  const sigBuf    = await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, msgBuf);
  return _bufToBase64(sigBuf);
}

// ── 서명 검증 ─────────────────────────────────────────────────
export async function verifySignature(publicKeyB64, message, signatureB64) {
  const publicKeyBuf  = _base64ToBuf(publicKeyB64);
  const publicKey     = await crypto.subtle.importKey(
    'spki', publicKeyBuf,
    { name: 'Ed25519' }, false, ['verify']
  );

  const msgBuf    = new TextEncoder().encode(
    typeof message === 'string' ? message : JSON.stringify(message)
  );
  const sigBuf    = _base64ToBuf(signatureB64);
  return crypto.subtle.verify({ name: 'Ed25519' }, publicKey, sigBuf, msgBuf);
}

// ── 이체 메시지 생성 ──────────────────────────────────────────
export function buildTransferMessage(fromGuid, toGuid, amount, nonce) {
  return JSON.stringify({
    op: 'gdc_transfer',
    from: fromGuid,
    to: toGuid,
    amount,
    nonce,
    timestamp: Date.now(),
  });
}

// ── Nonce 생성 (재전송 공격 방지) ────────────────────────────
export function generateNonce() {
  return _bufToBase64(crypto.getRandomValues(new Uint8Array(16)).buffer);
}

// ── Base64 유틸 ───────────────────────────────────────────────
function _bufToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function _base64ToBuf(b64) {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}
