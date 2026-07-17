// ══════════════════════════════════════════════════════════════
// gdc-pool.js — FIAT POOL 관리·GDC 발행 모듈
//
// 🔒 LEGAL-HOLD (2026-07-18) — 이 파일 전체가 "사용자 법정화폐를
// 모아 GDC를 발행"하는 기능(depositToPool)과 그 환율 변환
// (fiatToGDC/gdcToFiat)이다. 실질적으로 원화 연동 스테이블코인
// 발행 행위이며, 관련 법(디지털자산기본법 2단계)이 2026-07-18
// 기준 아직 국회 통과 전이라 발행주체 요건이 확정되지 않은
// 상태다. 환전 기능은 src/gdc/currencyPool.js의 "사용자 간 직접
// 매칭 중개"(플랫폼 비custodial) 방식으로 대체됐다 — 이 파일의
// 풀 기반 발행/환전 방식은 별도로 활성화하지 않는다.
//
// 원본 로직(Supabase 기반, 이미 실행 불가 상태였음)은 git 이력
// (이 커밋의 부모)에 보존. 활성화하려면 먼저 디지털자산기본법
// 통과 여부와 발행주체 요건을 법률 자문으로 확인할 것.
// ══════════════════════════════════════════════════════════════

export async function fetchFXRates()   { throw new Error('[GDC-POOL] LEGAL-HOLD — 활성화 금지'); }
export async function fiatToGDC()      { throw new Error('[GDC-POOL] LEGAL-HOLD — 활성화 금지'); }
export async function gdcToFiat()      { throw new Error('[GDC-POOL] LEGAL-HOLD — 활성화 금지'); }
export async function depositToPool()  { throw new Error('[GDC-POOL] LEGAL-HOLD — 활성화 금지(법정화폐 기반 GDC 발행, 디지털자산기본법 통과 전)'); }
export async function getPoolStatus()  { throw new Error('[GDC-POOL] LEGAL-HOLD — 활성화 금지'); }
export async function getTotalGDCIssued() { throw new Error('[GDC-POOL] LEGAL-HOLD — 활성화 금지'); }
