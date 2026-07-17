/**
 * @file currencyPool.js
 * @description 사용자 간 환전 주문 매칭 중개 (플랫폼 비custodial)
 * @version 2.0.0 (2026-07-18 법적 검토 반영 재설계)
 *
 * 이전 버전(v1.0.0)은 플랫폼이 법정화폐 풀을 직접 보유하고 스스로
 * 상대방이 되어 환전해주는 방식(depositGDC/exchange, 내부 _pool Map)
 * 이었다 — 외국환거래법상 외국환업무취급기관/소액해외송금업자 등록이
 * 필요할 수 있다는 법적 검토 결과에 따라 전면 재설계했다.
 *
 * v2.0 원칙: 플랫폼은 어떤 통화도 보유·이동시키지 않는다. 사용자가
 * "내가 가진 것"과 "원하는 것"을 직접 금액으로 지정해 주문을 올리고
 * (환율도 사용자가 스스로 정함 — 플랫폼이 환율을 산정·제시하지 않음),
 * 조건이 정확히 맞아떨어지는 두 주문을 "소개"만 한다. 실제 정산은
 * 두 사용자가 직접(예: GDC는 gdc-core.js의 transfer(), 법정화폐는
 * 당사자 간 별도 방법으로) 처리한다 — 플랫폼은 그 정산이 되었다고
 * 서로 "확인"한 기록만 남긴다.
 */

const _orders  = new Map()  // orderId → order
const _matches = new Map()  // matchId → match
let _orderSeq = 0

export const ORDER_STATUS = Object.freeze({
  OPEN: 'OPEN', MATCHED: 'MATCHED', CANCELLED: 'CANCELLED',
})

/**
 * 환전 주문 등록 — haveAmount/wantAmount 둘 다 사용자가 직접 지정
 * (플랫폼은 환율을 계산·추천하지 않는다).
 */
export function postExchangeOrder(userId, haveCurrency, haveAmount, wantCurrency, wantAmount) {
  if (!userId) throw new Error('userId 필수')
  if (haveAmount <= 0 || wantAmount <= 0) throw new Error('금액은 양수여야 함')
  if (haveCurrency === wantCurrency) throw new Error('동일 통화는 매칭 대상이 아님')

  const orderId = `ord_${++_orderSeq}`
  const order = {
    orderId, userId, haveCurrency, haveAmount, wantCurrency, wantAmount,
    status: ORDER_STATUS.OPEN, createdAt: Date.now(),
  }
  _orders.set(orderId, order)
  return order
}

export function cancelOrder(orderId, userId) {
  const o = _orders.get(orderId)
  if (!o) return { success: false, reason: '주문 없음' }
  if (o.userId !== userId) return { success: false, reason: '본인 주문만 취소 가능' }
  if (o.status !== ORDER_STATUS.OPEN) return { success: false, reason: `이미 ${o.status} 상태` }
  o.status = ORDER_STATUS.CANCELLED
  return { success: true }
}

/**
 * 정확히 반대로 맞아떨어지는 두 주문(A가 가진 것=B가 원하는 것 &&
 * 금액 일치, 그 반대도 동일)을 찾아 매칭시킨다. 부분 체결/환율
 * 허용범위 매칭은 v2에서 다루지 않음(의도적 단순화 — 자금 이동이
 * 없는 소개 기능이라 오매칭 리스크를 최소화하는 쪽을 택함).
 */
export function matchOrders() {
  const open = [..._orders.values()].filter(o => o.status === ORDER_STATUS.OPEN)
  const newMatches = []

  for (let i = 0; i < open.length; i++) {
    const a = open[i]
    if (a.status !== ORDER_STATUS.OPEN) continue
    for (let j = i + 1; j < open.length; j++) {
      const b = open[j]
      if (b.status !== ORDER_STATUS.OPEN) continue
      if (a.userId === b.userId) continue // 자기 자신과는 매칭하지 않음

      const reciprocal =
        a.haveCurrency === b.wantCurrency && a.haveAmount === b.wantAmount &&
        b.haveCurrency === a.wantCurrency && b.haveAmount === a.wantAmount

      if (reciprocal) {
        a.status = ORDER_STATUS.MATCHED
        b.status = ORDER_STATUS.MATCHED
        const matchId = `match_${a.orderId}_${b.orderId}`
        const match = {
          matchId,
          orderA: a.orderId, orderB: b.orderId,
          userA: a.userId,   userB: b.userId,
          aGives: { currency: a.haveCurrency, amount: a.haveAmount },
          bGives: { currency: b.haveCurrency, amount: b.haveAmount },
          confirmedBy: [],           // 정산 확인한 당사자 목록 (양쪽 다 확인해야 SETTLED)
          status: 'MATCHED',
          matchedAt: Date.now(),
        }
        _matches.set(matchId, match)
        newMatches.push(match)
        break
      }
    }
  }
  return newMatches
}

/**
 * 당사자가 "직접 정산 완료했다"고 알리는 확인 기록. 플랫폼은 실제
 * 송금을 처리하지 않으므로, 양쪽 다 확인해야 SETTLED로 표시된다.
 * 분쟁(한쪽만 확인) 발생 시 자동 해결 로직은 없음 — 사람이 개입해야
 * 하는 영역이라 여기서 임의로 처리하지 않는다.
 */
export function confirmSettlement(matchId, userId) {
  const m = _matches.get(matchId)
  if (!m) return { success: false, reason: '매칭 없음' }
  if (![m.userA, m.userB].includes(userId)) return { success: false, reason: '매칭 당사자가 아님' }
  if (!m.confirmedBy.includes(userId)) m.confirmedBy.push(userId)
  if (m.confirmedBy.length === 2) m.status = 'SETTLED'
  return { success: true, status: m.status, confirmedBy: [...m.confirmedBy] }
}

export function getOrder(orderId) { return _orders.get(orderId) ?? null }
export function getMatch(matchId) { return _matches.get(matchId) ?? null }
export function getOpenOrders() { return [..._orders.values()].filter(o => o.status === ORDER_STATUS.OPEN) }
export function _resetExchange() { _orders.clear(); _matches.clear(); _orderSeq = 0 }
