// ══════════════════════════════════════════════════════════════
// gdc-pool.js — GDC FIAT POOL 관리·환율 연동
// ══════════════════════════════════════════════════════════════

import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

const H = {
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json',
};

// GDC 기준 환율 (각국 통화 → GDC 1₮당 가치)
// 초기값: GDC 1₮ = KRW 1,000원 기준
const GDC_ANCHOR = { KRW: 1000 };

// ── 실시간 환율 조회 (Cloudflare Worker 프록시 경유) ──────────
export async function fetchFXRates(baseCurrency = 'KRW') {
  try {
    const res = await fetch(`/api/gdc-fx?base=${baseCurrency}`);
    return await res.json();
  } catch (e) {
    console.warn('[GDC-POOL] 환율 조회 실패, 캐시 사용:', e.message);
    return _getCachedRates(baseCurrency);
  }
}

// ── 캐시된 환율 조회 (Supabase) ─────────────────────────────
async function _getCachedRates(baseCurrency) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/gdc_fx_rates?base_currency=eq.${baseCurrency}&select=*`,
    { headers: H }
  );
  const rows = await res.json();
  return rows.reduce((acc, r) => {
    acc[r.quote_currency] = r.rate; return acc;
  }, {});
}

// ── 환율 캐시 업데이트 ────────────────────────────────────────
export async function updateFXCache(rates, baseCurrency = 'KRW') {
  const now = new Date().toISOString();
  const inserts = Object.entries(rates).map(([quote, rate]) => ({
    base_currency: baseCurrency, quote_currency: quote,
    rate, fetched_at: now,
  }));
  return fetch(
    `${SUPABASE_URL}/rest/v1/gdc_fx_rates`,
    {
      method: 'POST',
      headers: { ...H, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(inserts),
    }
  );
}

// ── 법정화폐 → GDC 환산 ──────────────────────────────────────
export async function fiatToGDC(amount, currencyCode) {
  const rates = await fetchFXRates('KRW');
  // currencyCode → KRW → GDC 변환
  const toKRW = currencyCode === 'KRW' ? 1 : (rates[currencyCode] ? 1 / rates[currencyCode] * 1000 : null);
  if (!toKRW) throw new Error(`지원하지 않는 통화: ${currencyCode}`);
  const krwAmount = amount * toKRW;
  const gdcAmount = krwAmount / GDC_ANCHOR.KRW;
  return { gdcAmount: Math.round(gdcAmount * 10000) / 10000, krwAmount, currencyCode, amount };
}

// ── GDC → 법정화폐 환산 ──────────────────────────────────────
export async function gdcToFiat(gdcAmount, targetCurrency) {
  const rates  = await fetchFXRates('KRW');
  const krwVal = gdcAmount * GDC_ANCHOR.KRW;
  if (targetCurrency === 'KRW') return krwVal;
  const rate = rates[targetCurrency];
  if (!rate) throw new Error(`지원하지 않는 통화: ${targetCurrency}`);
  return Math.round(krwVal / 1000 * rate * 100) / 100;
}

// ── FIAT POOL 입금 처리 ───────────────────────────────────────
export async function depositToPool({ userGuid, fiatAmount, currencyCode }) {
  const { gdcAmount } = await fiatToGDC(fiatAmount, currencyCode);

  // POOL 잔액 증가
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/gdc_pool?currency_code=eq.${currencyCode}&select=*&limit=1`,
    { headers: H }
  );
  const pools = await res.json();
  const pool  = pools[0];
  if (!pool) throw new Error(`POOL 없음: ${currencyCode}`);

  const newTotal    = +pool.total_deposited + fiatAmount;
  const newReserve  = Math.round(newTotal * pool.reserve_ratio * 100) / 100;
  const newInvested = newTotal - newReserve;
  const newIssued   = +pool.gdc_issued + gdcAmount;

  await fetch(`${SUPABASE_URL}/rest/v1/gdc_pool?currency_code=eq.${currencyCode}`, {
    method: 'PATCH', headers: H,
    body: JSON.stringify({
      total_deposited: newTotal, reserve_amount: newReserve,
      invested_amount: newInvested, gdc_issued: newIssued,
      last_updated: new Date().toISOString(),
    })
  });

  return { gdcAmount, fiatAmount, currencyCode, poolBalance: newTotal };
}

// ── POOL 현황 조회 ────────────────────────────────────────────
export async function getPoolStatus() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/gdc_pool?select=*&order=gdc_issued.desc`,
    { headers: H }
  );
  return res.json();
}

// ── GDC 총 발행량 조회 ────────────────────────────────────────
export async function getTotalGDCIssued() {
  const pools = await getPoolStatus();
  return pools.reduce((sum, p) => sum + +p.gdc_issued, 0);
}
