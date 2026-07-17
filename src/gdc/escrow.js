/**
 * 🔒 LEGAL-HOLD (2026-07-18, 재검토 후 유지)
 * dao.js·tokenomics.js는 이번에 활성화됐지만 이 모듈은 계속 보류한다.
 * 사유(재검토 결과, 근거 구체화): createEscrow()가 "제3자 자금을 조건부로
 * 보관했다가 조건 성취 시 지급"하는 구조를 표현한다 — 지금 코드 자체는
 * 상태값만 기록하고 실제 GDC를 이체하지 않지만, 의도된 용도(K-Law 판결
 * 결과에 따른 자동 지급/환불)대로 실제 이체와 연결하면 전자금융거래법상
 * "결제대금예치업(에스크로)" 등록 대상에 해당할 가능성이 높다. dao.js
 * (자금 이동 없음)·tokenomics.js(계산만, 발행 집행 없음)와 달리 이
 * 모듈은 활성화 즉시 실질적인 자금 보관 서비스가 될 소지가 있어
 * 계속 보류한다.
 */
/**
 * @file escrow.js
 * @description K-Law 연동 자동 집행 에스크로
 * @version 1.0.0
 * 근거: GDC §1.2 K-Law 판결 → 스마트 컨트랙트 자동 반영
 */

// (2026-07-15: hondi.net 크로스오리진 시도했다가 되돌림 — event-bus.js는
//  이 저장소의 src/gdc/*.js(currencyPool/dao/offlineQueue/tokenomics)
//  만 쓰는 gdc 고유 유틸리티다. gopang 쪽엔 이제 이 값을 쓰는 코드가
//  없어(GDC 모듈 전체가 이 저장소로 이관됨) "드리프트"라는 개념 자체가
//  성립하지 않는다 — 크로스오리진으로 gopang의 K-Law 등 무관한 범용
//  상수까지 끌고 오는 부수효과만 생겨 로컬 사본으로 되돌렸다.
//  gopang-wallet.js/pdv-history-client.js처럼 "어디서 실행되든 반드시
//  동일해야 하는" 파일에만 크로스오리진을 적용한다.)
import { EventBus, EVENTS } from '../core/event-bus.js'

const _escrows = new Map()  // escrowId → { amount, condition, status, msgId }

export function createEscrow(escrowId, fromUserId, toUserId, amountGDC, condition, msgId) {
  if (_escrows.has(escrowId)) throw new Error(`에스크로 중복: ${escrowId}`)
  const escrow = {
    escrowId, fromUserId, toUserId, amountGDC,
    condition, msgId, status: 'LOCKED', createdAt: Date.now()
  }
  _escrows.set(escrowId, escrow)
  return escrow
}

/**
 * K-Law 판결 결과 → 에스크로 자동 집행
 * EventBus.on(GDC_KLAW_EXECUTED) 에서 호출
 */
export function executeFromKLaw(escrowId, verdict) {
  const escrow = _escrows.get(escrowId)
  if (!escrow) return { success: false, reason: '에스크로 없음' }
  if (escrow.status !== 'LOCKED') return { success: false, reason: `상태 오류: ${escrow.status}` }

  escrow.status  = verdict === 'RELEASE' ? 'RELEASED' : 'REFUNDED'
  escrow.verdict = verdict
  escrow.executedAt = Date.now()

  return { success: true, escrow }
}

export function getEscrow(escrowId) { return _escrows.get(escrowId) ?? null }

// K-Law 판결 이벤트 구독 등록
EventBus.on(EVENTS.GDC_KLAW_EXECUTED, (data) => {
  if (data?.escrowId && data?.verdict) {
    executeFromKLaw(data.escrowId, data.verdict)
  }
}, 'gdc-escrow')

export function _resetEscrows() { _escrows.clear() }
