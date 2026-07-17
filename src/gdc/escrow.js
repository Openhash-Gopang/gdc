/**
 * 🔒 LEGAL-HOLD (2026-07-18)
 * 이 모듈은 아직 어떤 HTML/엔트리포인트에서도 배선되지 않은 상태이며,
 * 법률 검토 완료 전까지 배선하지 않는다.
 * 사유: K-Law 판결 자동집행에 따른 자금 이동 자체는 결제·에스크로 성격이라 전자금융거래법상 등록 요건 해당 여부 확인 필요
 * 활성화된 기능(무이자 예치·보관, 사용자 간 환전 매칭 중개)과 달리
 * 이 모듈은 이번 활성화 대상에서 제외됨 — 로직 자체는 유지하되
 * 실서비스 진입점에 연결하지 말 것.
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
