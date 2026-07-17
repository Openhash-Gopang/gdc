/**
 * 🔒 LEGAL-HOLD (2026-07-18)
 * 이 모듈은 아직 어떤 HTML/엔트리포인트에서도 배선되지 않은 상태이며,
 * 법률 검토 완료 전까지 배선하지 않는다.
 * 사유: 주식·채권·금 등을 편입한 자산배분 상품은 집합투자기구(자본시장법)에 해당할 소지가 커 가장 리스크가 높음
 * 활성화된 기능(무이자 예치·보관, 사용자 간 환전 매칭 중개)과 달리
 * 이 모듈은 이번 활성화 대상에서 제외됨 — 로직 자체는 유지하되
 * 실서비스 진입점에 연결하지 말 것.
 */
/**
 * @file smartVault.js
 * @description GDC Smart Vault — 4가지 자산 바스켓
 * @version 1.0.0
 * 근거: GDC §11
 */

export const VAULT_TYPE = Object.freeze({
  STABLE:   'stable',    // 안정형: 채권50%+금30%+GDC20%, 변동성<5%
  BALANCED: 'balanced',  // 균형형: 주식30%+채권30%+금20%+GDC20%
  GROWTH:   'growth',    // 성장형: 주식60%+REIT20%+금10%+GDC10%
  CURRENCY: 'currency',  // 통화형: 다국적 통화 풀 100%
})

export const VAULT_ALLOCATION = Object.freeze({
  stable:   { bonds:0.50, gold:0.30, gdc:0.20, stocks:0,    reit:0,    pool:0    },
  balanced: { bonds:0.30, gold:0.20, gdc:0.20, stocks:0.30, reit:0,    pool:0    },
  growth:   { bonds:0,    gold:0.10, gdc:0.10, stocks:0.60, reit:0.20, pool:0    },
  currency: { bonds:0,    gold:0,    gdc:0,    stocks:0,    reit:0,    pool:1.00 },
})

const _vaults = new Map()  // userId → { type, amount, createdAt }

export function createVault(userId, type, amountGDC) {
  if (!Object.values(VAULT_TYPE).includes(type))
    throw new Error(`[SmartVault] 알 수 없는 바스켓 유형: ${type}`)
  if (amountGDC <= 0)
    throw new Error(`[SmartVault] 금액은 양수여야 함: ${amountGDC}`)

  const vault = { type, amount: amountGDC, allocation: VAULT_ALLOCATION[type], createdAt: Date.now() }
  _vaults.set(userId, vault)
  return vault
}

export function getVault(userId) { return _vaults.get(userId) ?? null }

export function calcExpectedVolatility(type) {
  const vol = { stable:0.05, balanced:0.125, growth:0.225, currency:0.03 }
  return vol[type] ?? 0
}

export function _resetVaults() { _vaults.clear() }
