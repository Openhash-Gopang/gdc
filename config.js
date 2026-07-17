// ══════════════════════════════════════════════════════════════
// config.js — gdc 저장소 클라이언트 설정
// 2026-07-18: 이전에는 이 파일이 존재하지 않아 gdc-core.js/gdc-bank.js/
// gdc-credit.js/gdc-pool.js의 최상단 import가 전부 깨져 있었다(발견
// 경위는 HONDI_DOMAIN_DEEP_TEST_DIRECTIVE 실행 세션 gdc 리포트 참고).
// Supabase는 더 이상 쓰지 않으므로(gdc-core.js가 이미 L1/Worker 경유로
// 이관 완료) SUPABASE_URL/KEY는 신설하지 않는다 — 필요한 건 WORKER_URL
// 하나뿐이다.
// ══════════════════════════════════════════════════════════════
export const WORKER_URL = 'https://hondi-proxy.tensor-city.workers.dev';
