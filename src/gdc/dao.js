/**
 * ✅ 활성화 (2026-07-18) — 법적 검토 판단: 이 모듈은 자금을 보유·이동시키지
 * 않고(투표 자체가 GDC를 이체하지 않음), 이익 배당이나 수익 분배 약정도
 * 없다(GDC ≥1000 보유자에게 플랫폼 정책 제안에 대한 의결권만 부여 —
 * 협동조합 총회 표결과 유사한 거버넌스 구조). 예금·대출·법정화폐
 * 발행처럼 특정 인허가 규정에 곧바로 걸리는 항목이 아니라고 판단해
 * 활성화한다. 다만 "GDC 보유량 연동 의결권"이 자본시장법상 투자계약증권
 * 요건(공동사업 + 타인의 노력에 의한 수익 기대)에 해당하는지는 여전히
 * 확정적이지 않으므로 — GDC 자체가 투자상품이 아니라 선불 잔액이라는
 * 기존 설계 원칙과 일관되게, 이 모듈도 "수익 기대 없는 순수 거버넌스
 * 참여"로만 운용해야 한다. 향후 GDC에 배당·수익분배 성격이 조금이라도
 * 추가되면 이 판단을 재검토해야 한다.
 *
 * @file dao.js
 * @description DAO 거버넌스 — DAWN 비영리 원칙 기술적 강제
 * @version 2.0.0 (2026-07-18 L1 영속화 + 서버 잔액 검증으로 재작성)
 * 근거: GDC §19.2 / OpenHash SCI 논문 부록 D
 *   - GDC ≥1000 보유자: 1인1표
 *   - AI City Inc.: 제안권만 (거부권 없음)
 *   - 통화 풀 소유권 이전: 스마트 컨트랙트 수준에서 차단
 *
 * v1.0(메모리 Map 버전)의 알려진 버그 수정: vote()가 호출자가 자기신고한
 * stakeGDC를 그대로 신뢰했다 — 이제 서버(Worker)가 GET /biz/balance로
 * 실제 잔액을 재조회해서 stake_gdc를 직접 채운다. 클라이언트가 보낸 값은
 * 무시된다.
 */

import { WORKER_URL } from '../../config.js'

const MIN_STAKE_VOTE = 1000  // 투표 참여 최소 스테이킹

/**
 * 제안 생성 (AI City Inc. 포함 누구나 가능 — 본인 서명 인증 필요)
 * @param {{title, proposerGuid, params, wallet}} args - wallet: window.gopangWallet
 */
export async function createProposal({ title, proposerGuid, params = {}, wallet }) {
  if (params.type === 'OWNERSHIP_TRANSFER') {
    throw new Error('[DAO] DAWN 원칙 위반: 통화 풀 소유권 이전 제안 불가')
  }
  if (!wallet || typeof wallet.signPayload !== 'function' || wallet.guid !== proposerGuid) {
    throw new Error('[DAO] createProposal: 지갑 미초기화 또는 guid 불일치')
  }
  const ts = String(Date.now())
  const sigMsg = `gdc-dao-proposal:${proposerGuid}:${wallet.publicKeyB64u}:${ts}`
  const signature = await wallet.signPayload(sigMsg)

  const res = await fetch(`${WORKER_URL}/biz/gdc-dao/proposal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title, proposer_guid: proposerGuid, params,
      pubkey: wallet.publicKeyB64u, signature, ts,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) {
    throw new Error(data.detail || data.error || `제안 생성 실패 (HTTP ${res.status})`)
  }
  return data.proposal
}

/**
 * 투표 (GDC ≥1000 보유자만 — 서버가 실제 잔액을 재검증한다)
 * @param {{proposalId, userGuid, choice, wallet}} args
 */
export async function vote({ proposalId, userGuid, choice, wallet }) {
  if (!['yes', 'no', 'abstain'].includes(choice)) {
    throw new Error(`[DAO] 알 수 없는 선택지: ${choice}`)
  }
  if (!wallet || typeof wallet.signPayload !== 'function' || wallet.guid !== userGuid) {
    throw new Error('[DAO] vote: 지갑 미초기화 또는 guid 불일치')
  }
  const ts = String(Date.now())
  const sigMsg = `gdc-dao-vote:${userGuid}:${proposalId}:${wallet.publicKeyB64u}:${ts}`
  const signature = await wallet.signPayload(sigMsg)

  const res = await fetch(`${WORKER_URL}/biz/gdc-dao/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      proposal_id: proposalId, user_guid: userGuid, choice,
      pubkey: wallet.publicKeyB64u, signature, ts,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) {
    return { success: false, reason: data.detail || data.error || `HTTP ${res.status}` }
  }
  return { success: true, votes: data.votes, stakeGdc: data.stake_gdc }
}

/**
 * 제안 조회 — 서버가 투표를 실시간 집계하고 상태(ACTIVE/PASSED/REJECTED)를
 * 만료시각·득표 기준으로 계산해 반환한다(별도 "확정" 쓰기 작업 불필요).
 */
export async function getProposal(proposalId) {
  const qs = new URLSearchParams({ proposal_id: proposalId })
  const res = await fetch(`${WORKER_URL}/biz/gdc-dao/proposals?${qs}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) {
    throw new Error(data.detail || data.error || `제안 조회 실패 (HTTP ${res.status})`)
  }
  return data.items?.[0] ?? null
}

/** 전체 제안 목록 조회 */
export async function listProposals(limit = 20) {
  const qs = new URLSearchParams({ limit: String(limit) })
  const res = await fetch(`${WORKER_URL}/biz/gdc-dao/proposals?${qs}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) {
    throw new Error(data.detail || data.error || `제안 목록 조회 실패 (HTTP ${res.status})`)
  }
  return data.items || []
}

export { MIN_STAKE_VOTE }
