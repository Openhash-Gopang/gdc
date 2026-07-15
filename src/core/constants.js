/**
 * @file constants.js
 * @description gdc 저장소 전용 축소판 — gopang(hondi.net) 저장소의
 *   src/core/constants.js는 K-Law/K-Health/ai-secretary 등 훨씬 넓은
 *   범위에서 공유되는 범용 코어 모듈이라 통째로 옮길 수 없었다. 이
 *   파일은 그중 src/gdc/*.js(currencyPool/dao/escrow/offlineQueue/
 *   tokenomics)가 실제로 쓰는 export(QUEUE, GDC_POLICY, ZKP, HISTORY,
 *   EVENTS)만 그대로 옮겨 gdc 저장소를 자기완결적으로 만들었다
 *   (2026-07-15, gopang→gdc 파일 이동).
 *
 *   ⚠️ gopang 쪽 원본이 이 값들을 바꾸면 이 사본도 수동으로 맞춰야
 *   한다 — 지금은 src/gdc/*.js 자체가 어디서도 import되지 않는 미완성
 *   스텁이라 드리프트 위험이 낮지만, 나중에 실제로 이 모듈들을 쓰기
 *   시작하면 값 동기화 절차를 별도로 정해야 한다.
 * @version 1.0.0
 */

export const QUEUE = Object.freeze({
  RATE: 0.0001,          // GDC/KB/h
  DELAY_WEIGHT: {
    L2: 0.0,
    L1: 0.5,
    L0: 2.0,
  },
  MAX_HOLD_HOURS: 720,   // 최대 30일
})

export const GDC_POLICY = Object.freeze({
  INFLATION_ALPHA: 0.20,
  INFLATION_BETA:  0.50,
  MAX_INFLATION:   0.02,   // 연 최대 2%
  GENESIS_SUPPLY:  100_000_000,
  MAX_SUPPLY:      200_000_000,
})

// ── ZKP 수수료 ────────────────────────────────────────────────────────────
export const ZKP = Object.freeze({
  VERIFY_FEE_GDC: 0.01,   // 0.01 GDC / 1회 검증
})

// ── KYC 이력 기간 ─────────────────────────────────────────────────────────
export const HISTORY = Object.freeze({
  RISK_LOOKBACK_DAYS: 30,   // S2 이상 이력 조회 기간
})

// ── 표준 이벤트명 (event-bus.js가 사용) ───────────────────────────────────
export const EVENTS = Object.freeze({
  PLUGIN_REGISTERED:    'plugin:registered',
  PLUGIN_UPDATED:       'plugin:updated',
  PLUGIN_ERROR:         'plugin:error',

  MSG_RECEIVED:         'msg:received',
  MSG_RISK_ASSESSED:    'msg:risk-assessed',
  MSG_BLOCKED:          'msg:blocked',
  MSG_ANCHORED:         'msg:anchored',

  LEGAL_DISPUTE:        'domain:legal-dispute',
  MEDICAL_ALERT:        'domain:medical-alert',
  FINANCIAL_ALERT:      'domain:financial-alert',

  GDC_ESCROW_CREATED:   'gdc:escrow-created',
  GDC_KLAW_EXECUTED:    'gdc:klaw-executed',
})
