# GDC 추가 갱신 계획서
## Gopang Digital Currency — Development Roadmap v1.1

> **저장소:** `Openhash-Gopang/gdc`  
> **도메인:** `gdc.hondi.net`  
> **작성일:** 2026-06-03  
> **작성자:** AI City Inc. (팀 주피터)  
> **현재 버전:** v1.0 (T1~T6 테스트 완료)

---

## § 1. 현재 완료 상태 (v1.0)

### 1-1. 프론트엔드

| 파일 | 상태 | 내용 |
|------|------|------|
| `index.html` | ✅ 완료 | 기기 감지 라우터 (PC → desktop / Mobile → webapp) |
| `desktop.html` | ✅ 완료 | PC 랜딩 페이지 (SSO, 사이드바, GDC 발행 메커니즘 설명) |
| `webapp.html` | ✅ 완료 | 모바일 PWA (SSO 인증, PDV 연동, 고팡 복귀 버튼) |
| `dashboard.html` | ✅ 완료 | 관리자 대시보드 |
| `user-dashboard.html` | ✅ 완료 | 사용자 재무제표 (IASB 기준 6종) |
| `pool-dashboard.html` | ✅ 완료 | FIAT POOL 현황 (도넛·추세선·투자수익률) |
| `nation-dashboard.html` | ✅ 완료 | 국가 통화정책 대시보드 (17개 광역 드릴다운) |

### 1-2. 인증 · PDV

| 항목 | 상태 | 내용 |
|------|------|------|
| Gopang SSO 연동 | ✅ 완료 | `subsystem-auth.js` 경로2A (세션 캐시) 확인 |
| `_onGopangAuth` 콜백 | ✅ 완료 | `user.ipv6` → GUID 수신 |
| PDV `/pdv/report` | ✅ 완료 | Worker 표준 구조 적용, Level 3 저장 성공 |
| Supabase `pdv_log` 저장 | ✅ 완료 | `PDV-2601db808995-1780502594542` 확인 |

### 1-3. 시스템 프롬프트

| 파일 | 상태 | 내용 |
|------|------|------|
| `prompts/SP-GDC_v2_0.txt` | ✅ 완료 | DeepSeek V4 Pro AI 상담사, GDC 발행 메커니즘 포함 |

---

## § 2. 단기 갱신 계획 (v1.1) — 2026 Q3

### 2-1. 🔴 Critical — 즉시 필요

#### A. `user_profiles` 자동 생성
최초 SSO 인증 시 `user_profiles` row가 없으면 자동 INSERT.

```javascript
// webapp.html _onGopangAuth 내부
const profile = await getExtra();
if (!_profile.guid) {
  await fetch(`${S}/rest/v1/user_profiles`, {
    method: 'POST',
    headers: { ...H, 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      guid:        guid,
      entity_type: 'individual',
      name:        guid.slice(0, 16),
      extra:       { fs: { bs: { 'bs-cash': '0' }, pl: {}, cf: {} } }
    })
  });
}
```

**담당:** `webapp.html`  
**우선순위:** P0

---

#### B. GDC 발행 메커니즘 구현
KRW 입금 → GDC 즉시 발행 플로우.

```
사용자 KRW 입금 (고팡 마켓)
        │
        ▼
gdc-pool.js depositToPool()
        │  KRW → GDC 환산 (1,000:1)
        ▼
user_profiles.extra.fs.bs.bs-cash += gdcAmount
        │
        ▼
gdc_pool 테이블 잔고 증가
        │
        ▼
PDV 기록 (gdc_deposit_fiat)
```

**담당:** `js/gdc-pool.js`, `webapp.html`  
**우선순위:** P0

---

#### C. favicon.ico 추가
현재 404 오류 발생 중.

```
gdc/favicon.ico  ← T 마크 SVG 기반 16×16 ICO
gdc/favicon.svg  ← SVG 버전
```

**우선순위:** P1

---

### 2-2. 🟡 Important — 2주 내

#### D. 이체 기능 실거래 테스트
현재 두 개의 `user_profiles` row 필요.

- 송신자: `2601:db80:8995:1e1f:bc7e:764f:502a:f231`
- 수신자: 테스트 계정 생성 후 이체 실행
- `fs_ledger` 차변·대변 양방향 기록 확인
- ED25519 서명 (`gdc-crypto.js`) 연동

**담당:** `webapp.html` → `js/gdc-core.js`  
**우선순위:** P1

---

#### E. 예금 기능 연동
현재 UI만 존재, 실제 Supabase 연동 미완.

- `gdc_deposits` 테이블 row 생성
- `gdc-bank.js openDeposit()` 호출
- 일일 이자 자동 지급 (`accrueInterest()`) Cron 설정

**담당:** `js/gdc-bank.js`, Supabase Edge Function  
**우선순위:** P1

---

#### F. 대출 기능 연동
- `gdc_loans` 테이블 row 생성
- 신용평가 → 대출 한도 → 실행 플로우
- `gdc-credit.js evaluateCredit()` 실거래 연동

**담당:** `js/gdc-bank.js`, `js/gdc-credit.js`  
**우선순위:** P1

---

### 2-3. 🟢 Enhancement — 1개월 내

#### G. 모바일 테스트 완료
스마트폰에서 T3~T6 동일 테스트 실행.

- iOS Safari: Silent iframe 동작 확인
- Android Chrome: GWP 토큰 경로 확인
- PWA 설치 (`manifest.json`) 동작 확인

**우선순위:** P2

---

#### H. `user-dashboard.html` PDV 연동
현재 양식만 표시, 실데이터 미연동.

- SSO 인증 → `user.ipv6`로 Supabase 조회
- `user_profiles.extra.fs.*` → IASB 재무제표 자동 채움
- `fs_ledger` → 거래 내역 자동 분류

**담당:** `user-dashboard.html`  
**우선순위:** P2

---

#### I. AI 상담 채팅 실연동
현재 `desktop.html`에 DeepSeek V4 Pro 채팅 모달 삽입.

- `gopang-proxy/deepseek` 엔드포인트 실연동 테스트
- `prompts/SP-GDC_v2_0.txt` fetch 로딩 확인
- 대화 히스토리 12턴 유지 확인

**담당:** `desktop.html`, `prompts/SP-GDC_v2_0.txt`  
**우선순위:** P2

---

## § 3. 중기 갱신 계획 (v1.2) — 2026 Q4

### 3-1. FIAT POOL 실운용

| 항목 | 내용 |
|------|------|
| 실시간 환율 API | Cloudflare Worker `/gdc-fx` 엔드포인트 구현 |
| KRW POOL 입금 | 실제 KRW 계좌 연동 (은행 API) |
| Index ETF 투자 | 각국 증시 API 연동, 수익률 실시간 반영 |
| GDC 가치 갱신 | 일일 정산 후 `gdc_pool.gdc_base_rate` 갱신 |

### 3-2. 국제 이체

| 항목 | 내용 |
|------|------|
| 다국 POOL 환전 | USD·EUR·JPY·CNY·GBP POOL 실운용 |
| 크로스-POOL 이체 | KRW 보유자 → USD 보유자 즉시 이체 |
| 193개국 확장 | UN 가입 전체 국가 국적 통화 지원 |

### 3-3. 보안 강화

| 항목 | 내용 |
|------|------|
| ED25519 서명 의무화 | 모든 이체에 `gdc-crypto.js` 서명 필수 |
| L1 인증 요구 | 금융 거래 시 얼굴 인증 추가 |
| `gdc_signatures` 연동 | 서명 검증 로그 Supabase 저장 |

---

## § 4. 장기 로드맵 (v2.0) — 2027

| Phase | 내용 | 시기 |
|-------|------|------|
| Phase 3 | 국제 이체·다국 POOL 실운용 | 2027 Q1 |
| Phase 4 | 투자 모듈·국민성장펀드 연동 | 2027 Q2 |
| Phase 5 | 증권·보험 모듈 (별도 저장소) | 2027 Q3~ |
| Phase 6 | DAWN 거버넌스 — 지침 개정 투표 시스템 | 2027 Q4 |

---

## § 5. 기술 부채 목록

| ID | 항목 | 설명 | 우선순위 |
|----|------|------|----------|
| TD-01 | `gdc-bank.js` import 경로 | `../config.js` → 환경변수로 전환 필요 | P2 |
| TD-02 | Supabase anon key 노출 | `webapp.html` 내 하드코딩 → Worker 프록시 경유로 전환 | P1 |
| TD-03 | `loadHome()` 직접 Supabase 호출 | gopang-proxy 경유로 전환 필요 | P2 |
| TD-04 | `nation-dashboard` 실데이터 미연동 | PDV 집계 API 구현 후 연동 | P3 |
| TD-05 | `pool-dashboard` 시뮬레이션 데이터 | `gdc_pool` 테이블 실데이터 연동 | P2 |
| TD-06 | `user-dashboard` PDV 미연동 | `_onGopangAuth` 후 자동 로드 구현 | P2 |

---

## § 6. 파일 구조 현황

```
gdc/
├── index.html              ✅ 라우터
├── desktop.html            ✅ PC 랜딩
├── webapp.html             ✅ 모바일 PWA (SSO+PDV)
├── dashboard.html          ✅ 관리자
├── user-dashboard.html     ✅ 재무제표
├── pool-dashboard.html     ✅ FIAT POOL
├── nation-dashboard.html   ✅ 국가 통화정책
├── GDC_ROADMAP.md          ✅ 본 문서
│
├── js/
│   ├── gdc-core.js         ✅ 잔액·이체·서명
│   ├── gdc-bank.js         ✅ 예금·대출
│   ├── gdc-pool.js         ✅ FIAT POOL
│   ├── gdc-credit.js       ✅ 신용평가
│   └── gdc-crypto.js       ✅ ED25519
│
├── prompts/
│   ├── SP-GDC_v2_0.txt     ✅ AI 상담사 (현행)
│   └── SP-GDC_kbank_v1.0.txt
│
├── sql/
│   └── 01_gdc_schema.sql   ✅ Supabase 스키마
│
└── docs/
    └── GOPANG_HANDOVER.md
```

---

## § 7. 테스트 완료 기록

| 테스트 | 환경 | 결과 | 일시 |
|--------|------|------|------|
| T1 SSO 코드 삽입 | PC Edge | ✅ | 2026-06-03 |
| T2 모바일 UI (375px) | PC DevTools | ✅ | 2026-06-03 |
| T3 Silent iframe 인증 | PC Edge | ✅ 경로2A | 2026-06-03 |
| T4 `_onGopangAuth` ipv6 수신 | PC Edge | ✅ | 2026-06-03 |
| T5 PDV `/pdv/report` 저장 | PC Edge | ✅ Level 3 | 2026-06-03 |
| T6 Supabase `pdv_log` 확인 | SQL Editor | ✅ | 2026-06-03 |
| 모바일 T3~T6 | iOS/Android | 🔲 예정 | — |

---

*GDC is powered by OpenHash — Probabilistic Hierarchical Distributed Ledger*  
*DAWN: Democracy is All We Need — democracy.hondi.net*
