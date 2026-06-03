# GDC 백서 (Whitepaper) v1.0
## Gopang Digital Currency — Global Digital Currency

> **발행:** AI City Inc. / OpenHash Network  
> **도메인:** `gdc.gopang.net`  
> **저장소:** `Openhash-Gopang/gdc`  
> **최초 발행:** 2026년 6월  
> **법적 성격:** 고팡 플랫폼 내 결제·저축·대출·투자 단위  
> **통화 기호:** T (GDC)  
> **기준가:** T1 = KRW 1,000원 (런칭 기준)

---

## 목차

1. [개요 및 비전](#1-개요-및-비전)
2. [GDC 발행 메커니즘](#2-gdc-발행-메커니즘)
3. [FIAT POOL 구조](#3-fiat-pool-구조)
4. [핵심 서비스](#4-핵심-서비스)
5. [재무제표 기반 신용평가](#5-재무제표-기반-신용평가)
6. [디지털 서명 메커니즘](#6-디지털-서명-메커니즘)
7. [고팡 SSO 인증 연동](#7-고팡-sso-인증-연동)
8. [PDV 연동](#8-pdv-연동)
9. [데이터 모델](#9-데이터-모델)
10. [시스템 아키텍처](#10-시스템-아키텍처)
11. [GWP 레지스트리 연동](#11-gwp-레지스트리-연동)
12. [대시보드 시스템](#12-대시보드-시스템)
13. [인증 및 PDV 테스트 결과](#13-인증-및-pdv-테스트-결과)
14. [보안 원칙](#14-보안-원칙)
15. [로드맵](#15-로드맵)
16. [오픈소스 및 DAWN 원칙](#16-오픈소스-및-dawn-원칙)

---

## 1. 개요 및 비전

### 1-1. GDC란?

GDC(Global Digital Currency / Gopang Digital Currency)는 고팡(gopang.net) 생태계의 글로벌 디지털 통화입니다.

```
T (GDC) = Gopang Digital Currency
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 기준가:   T1 = KRW 1,000원 (런칭 시점)
• 이후:     시장 수익률에 연동하여 자율 변동
• 대차대조표 bs-cash = GDC 잔액
• OpenHash 분산원장 → 위변조 불가
• 은행·증권·보험 기능 통합
• 전 세계 동시 사용 (FIAT POOL)
• 193개 UN 가입 국가 모두 지원
```

### 1-2. 핵심 원칙

| 원칙 | 내용 |
|------|------|
| **사전 발행 없음** | GDC는 사전에 발행되지 않습니다. 사용자 입금 즉시 발행됩니다 |
| **재무제표 = 신용** | `user_profiles.extra.fs` 재무제표가 유일한 신용 평가 근거 |
| **결합 재무제표** | 5천만 인구와 5백만 기관의 재무제표가 상호 연동 |
| **위변조 불가** | 어느 한 재무제표를 위변조하려면 세상의 모든 재무제표를 동시에 위변조해야 함 |
| **PDV 연동** | 모든 GDC 거래는 PDV에 6하 원칙으로 기록 |
| **디지털 서명** | 이체·대출 등 모든 거래에 ED25519 개인키 서명 필수 |
| **무지점** | 지점·직원·주주 없음 → 예금 이자 현저히 높음, 대출 이자 현저히 낮음 |
| **오픈소스** | 모든 메커니즘과 소스코드는 오픈소스로 공개 |

### 1-3. 고팡 생태계에서의 위치

```
고팡(gopang.net) — 현실 세계의 AI 쌍둥이들로 구성된 평행 세계
        │
        ├─ 고팡 마켓(market.gopang.net) — 현실의 모든 시장을 통합한 AI 쌍둥이
        │         └─ GDC — 고팡 마켓의 결제 통화
        │
        ├─ K-Law, K-Health, K-School, K-Police ...
        │
        └─ GDC(gdc.gopang.net) — 글로벌 디지털 통화 플랫폼
```

---

## 2. GDC 발행 메커니즘

### 2-1. 기본 원칙

**GDC는 사전에 발행된 화폐가 아닙니다.**

고팡 마켓 이용자가 국적 통화(예: KRW 10,000원)를 입금하는 순간, 교환비(T1 = KRW 1,000)에 따라 해당 금액만큼 GDC가 즉시 발행되어 사용자 계좌로 귀속됩니다.

```
런칭 시점 POOL 잔고: 0
        │
        ▼
사용자 A: KRW 10,000원 입금
        │
        ▼
교환비 적용: 10,000 ÷ 1,000 = T10 발행
        │
        ▼
사용자 A 계좌: T10 귀속
POOL 잔고: KRW 10,000원
GDC 총 발행량: T10
```

### 2-2. 발행량 공식

```
GDC 발행량 = 누적 입금액 ÷ 교환비
교환비: T1 = KRW 1,000원 (기준가)
이후: 시장 수익률에 연동하여 변동
```

### 2-3. 사전 채굴·중앙 발행 없음

- 어떠한 형태의 사전 채굴 없음
- 중앙 발행 없음
- POOL 잔고가 발행된 GDC의 유일한 담보
- 인플레이션 위험이 구조적으로 차단됨

---

## 3. FIAT POOL 구조

### 3-1. 개요

```
사용자 법정화폐 납입 (193개국)
        │
        ▼
┌──────────────────────────────────────────────┐
│              GDC FIAT POOL                   │
│                                              │
│  KRW 풀 │ USD 풀 │ EUR 풀 │ JPY 풀 │ ...    │
│                                              │
│  실시간 환율 API 연동 → 사용자간 즉시 교환    │
│  별도 환전 절차 없음                         │
└──────────────────────────────────────────────┘
        │
        ├── 지불준비금 (20%) → 즉시 출금 보장
        │
        └── 투자 자산 (80%)
                ├── 각국 주가지수 ETF
                │   ├── KOSPI200 (한국) — 2026년 연초 대비 +107% 추산
                │   ├── S&P500 (미국) — +19.9%
                │   ├── FTSE100 (영국) — +6.9%
                │   └── 닛케이 (일본) — -2.5%
                └── 각국 국민성장펀드
```

### 3-2. 투자 수익 반영

- 각국 국적 통화는 각국 주요 은행 계좌에 입금
- 입금 즉시 해당 국가의 Index 증권에 투자
- 투자 수익은 GDC의 가치에 즉시 반영
- 예금 이자 = Index 투자 수익 − 고팡 네트워크 비용

### 3-3. 환전 메커니즘

```
A (KRW 보유) → B (USD 보유) 이체 시:
1. A의 GDC 잔액에서 차감
2. 실시간 KRW/USD 환율 조회
3. B의 GDC 잔액에 가산 (USD 기준 GDC 가치 환산)
4. POOL 내 KRW↔USD 비율 자동 재조정
5. OpenHash 원장에 양방향 기록
6. 양측 PDV에 이체 내역 기록
→ 수수료 없음 / 0.1초 내 완료
```

### 3-4. 지원 통화

| 통화 | 국가 | 비고 |
|------|------|------|
| KRW | 대한민국 | 런칭 기준 통화 |
| USD | 미국 | |
| EUR | 유럽연합 | |
| JPY | 일본 | |
| CNY | 중국 | |
| GBP | 영국 | |
| ... | 193개국 | UN 가입 전체 국가 |

---

## 4. 핵심 서비스

### 4-1. 예금

| 항목 | 스펙 |
|------|------|
| 예금 단위 | GDC (T) |
| 이자 산정 | 각국 Index 수익 − 네트워크 비용 |
| 2026년 추산 수익률 | 연 +107% ① |
| 정산 주기 | 매일 자동 정산 |
| 시중은행 대비 | 수십 배 이상 (시장 연동이므로 변동) |
| 예금 보호 | OpenHash 원장 불변성으로 보장 |
| 최소 예치금 | 없음 (T1 이상) |

> ① 추산 근거: KOSPI 2026년 1월 2일 시초가 4,224.53 → 2026년 6월 3일 종가 8,732.46 기준 약 +107% (배당 미포함, 네트워크 비용 미차감). 실제 지급 이자는 매일 변동합니다.

### 4-2. 대출

| 항목 | 스펙 |
|------|------|
| 신용 평가 | 재무제표(extra.fs) 기반 AI 즉시 평가 (0.1초) |
| AAA 금리 | 연 0.5% |
| AA 금리 | 연 1.0% |
| A 금리 | 연 1.5% |
| BBB 금리 | 연 2.5% |
| BB 금리 | 연 3.5% |
| C 금리 | 연 5.0% |
| 시중은행 대비 | 현저히 낮음 (시중은행 신용대출 연 5~8%) |
| 대출 한도 | 순자산(bs-equity)의 최대 70% |
| 상환 방식 | 원리금균등 / 원금균등 / 만기일시 선택 |

### 4-3. 이체

| 항목 | 스펙 |
|------|------|
| 서명 방식 | ED25519 디지털 서명 |
| 처리 속도 | 즉시 (OpenHash 원장 기록) |
| 수수료 | 없음 (GDC 내부 이체) |
| 해외 이체 | FIAT POOL 내 실시간 환율 적용 |
| 최소 이체 | 없음 |

### 4-4. 신용평가 알고리즘 (0.1초)

```
신용점수 = f(재무제표)

입력 (user_profiles.extra.fs):
  유동비율    = (bs-cash + bs-ar) / bs-ap     (가중치 25%)
  부채비율    = bs-debt / bs-equity            (가중치 25%)
  영업이익률  = (pl-revenue - pl-cogs - pl-opex) / pl-revenue  (가중치 30%)
  현금흐름비율 = cf-op / bs-debt               (가중치 20%)

신용등급:
  950+ → AAA: 대출금리 0.5%
  900+ → AA : 대출금리 1.0%
  800+ → A  : 대출금리 1.5%
  700+ → BBB: 대출금리 2.5%
  600+ → BB : 대출금리 3.5%
  600↓ → C  : 대출금리 5.0%
```

---

## 5. 재무제표 기반 신용평가

### 5-1. 결합 재무제표의 의미

고팡은 모든 사용자의 재무제표를 자동으로 생성하고, 매 거래마다 갱신하며, 전체 인구와 기관의 재무제표를 상호 연동합니다.

따라서, **어느 한 재무제표를 위변조하려면, 세상의 모든 재무제표를 동시에 위변조해야 합니다.**

### 5-2. 재무제표 구조

```
user_profiles.extra.fs
├── bs (대차대조표)
│   ├── bs-cash      ← GDC 잔액 (원장)
│   ├── bs-ar        ← 매출채권
│   ├── bs-ap        ← 매입채무
│   ├── bs-debt      ← 차입금
│   ├── bs-equity    ← 순자산
│   └── bs-inventory ← 재고
├── pl (손익계산서)
│   ├── pl-revenue   ← 매출
│   ├── pl-cogs      ← 원가
│   └── pl-opex      ← 판관비
└── cf (현금흐름표)
    └── cf-op        ← 영업현금흐름
```

### 5-3. IASB 기준 재무제표 제공

사용자 대시보드(`user-dashboard.html`)에서 IASB 기준 6종 재무제표를 제공합니다:

- 재무상태표 (IAS 1 §54)
- 포괄손익계산서 (IAS 1 §81A)
- 현금흐름표 (IAS 7 간접법)
- 자본변동표 (IAS 1 §106)
- 이익잉여금처분계산서 (K-IFRS)
- 재무분석 보고서 (유동성·수익성·안정성·신용등급)

---

## 6. 디지털 서명 메커니즘

### 6-1. 키 생성 (최초 1회)

```javascript
// ED25519 키쌍 생성
const keyPair = await crypto.subtle.generateKey(
  { name: 'Ed25519' }, true, ['sign', 'verify']
);
// 공개키 → gdc_keys 테이블 등록 (Supabase)
// 개인키 → 사용자 브라우저 IndexedDB (암호화 저장)
```

### 6-2. 이체 서명

```javascript
// 이체 메시지 구성
const message = {
  op: 'gdc_transfer',
  from: fromGuid,
  to: toGuid,
  amount,
  nonce,          // 재전송 공격 방지
  timestamp: Date.now(),
};
// ED25519 서명
const signature = await signMessage(userGuid, message);
// 서버 검증 후 원장 기록
```

### 6-3. 보안 원칙

- 개인키는 서버에 절대 전송되지 않음
- 모든 서명은 브라우저 내에서만 생성
- nonce로 재전송 공격 방지
- `gdc_signatures` 테이블에 검증 로그 저장

---

## 7. 고팡 SSO 인증 연동

### 7-1. 인증 방식

GDC는 고팡 SSO(`subsystem-auth.js`)를 사용하며, HTML에 **한 줄**만 삽입합니다.

```html
<script type="module"
  src="https://gopang.net/auth/subsystem-auth.js">
</script>
```

### 7-2. 인증 경로 (5단계 폭포)

```
gopangAuth.require('L0') 호출
│
├─ ① GWP 토큰 확인     (URL ?gwp_token= 파싱 + HMAC 검증)
├─ ② 세션 캐시 확인    (sessionStorage['gopang_sso_token'])
├─ ③ 로컬 기기 확인    (localStorage['gopang_user_v3'] + 기기 핑거프린트)
├─ ④ Silent iframe     (gopang.net/auth/silent-auth.html, postMessage)
└─ ⑤ 리다이렉트        (최후 수단: gopang.net/auth/silent-auth.html?return=현재URL)
```

### 7-3. 인증 콜백

```javascript
window._onGopangAuth = async function(user) {
  // user.ipv6  : 사용자 GUID (IPv6 형식)
  // user.level : 인증 레벨 (L0~L3)
  // user.via   : 인증 경로 (session/iframe/gwp)

  const guid = user?.ipv6 || user?.guid || null;
  if (!guid) return; // 게스트 접속

  GUID = guid;
  await loadHome();        // GDC 잔액·거래내역 로드
  await sendPDV(guid, user); // PDV 접속 이벤트 기록
};
```

### 7-4. 인증 레벨

| 레벨 | 인증 방법 | GDC 허용 기능 |
|------|----------|--------------|
| L0 | 기기 자동 인식 | 잔액 조회, AI 상담 |
| L1 | L0 + 얼굴 인증 | 이체, 예금, 신용평가 |
| L2 | L1 + 지문(WebAuthn) | 대출, 투자 |
| L3 | L2 + 4단어 시드 | 계정 복원 |

### 7-5. 기기 핑거프린트

```javascript
// 8가지 기기 정보를 SHA-256 해시로 변환
const raw = [
  navigator.userAgent,
  navigator.language,
  screen.width + 'x' + screen.height,
  screen.colorDepth,
  Intl.DateTimeFormat().resolvedOptions().timeZone,
  navigator.hardwareConcurrency,
  navigator.deviceMemory,
  screen.pixelDepth,
].join('|');
// → 64자리 16진수 → IPv6 형식 GUID
```

---

## 8. PDV 연동

### 8-1. PDV란?

PDV(Personal Data Vault)는 고팡의 개인 데이터 저장소입니다. 모든 GDC 거래는 PDV에 6하 원칙(누가·언제·어디서·무엇을·어떻게·왜)으로 기록됩니다.

### 8-2. PDV 기록 형식

```json
{
  "report": {
    "svc":  "gdc",
    "type": "transaction",
    "who": {
      "ipv6":       "2601:db80:...",
      "role":       "user",
      "level":      "L0",
      "recipients": ["gopang-pdv"]
    },
    "when": {
      "period_start": "2026-06-03T16:55:48Z",
      "period_end":   "2026-06-03T16:55:48Z"
    },
    "where": { "svc_url": "https://gdc.gopang.net/webapp.html" },
    "what":  { "summary": "GDC 이체 ₮100 → 2601:db80:0000:0…" },
    "how":   { "method": "GDC 이체 (fs_ledger 차변·대변)" },
    "why":   { "goal": "PDV 이체 테스트" }
  }
}
```

### 8-3. PDV 엔드포인트

```
POST https://gopang-proxy.tensor-city.workers.dev/pdv/report
Content-Type: application/json
```

- Cloudflare Worker `gopang-proxy` v4.1 경유
- `gdc.gopang.net` → Level 3 서비스로 등록
- PDV 저장: Supabase `pdv_log` 테이블

### 8-4. 거래별 PDV 기록

| 거래 | type | summary 예시 |
|------|------|-------------|
| 앱 접속 | event | GDC 앱 접속 — 지갑·금융 서비스 이용 |
| 이체 | transaction | GDC 이체 ₮100 → 2601:db80:0000:0… |
| 예금 개설 | transaction | GDC 예금 개설 ₮5 (demand) |
| 대출 신청 | transaction | GDC 대출 신청 ₮10,000 (12개월) |

---

## 9. 데이터 모델

### 9-1. Supabase 테이블 구조

#### 기존 연동 테이블 (고팡 공유)
| 테이블 | 역할 |
|--------|------|
| `user_profiles.extra.fs.bs['bs-cash']` | GDC 잔액 (원장) |
| `fs_ledger` | GDC 거래 원장 |
| `pdv_log` | PDV 6하 원칙 기록 |

#### GDC 전용 테이블
| 테이블 | 역할 |
|--------|------|
| `gdc_keys` | 사용자 ED25519 공개키 등록 |
| `gdc_deposits` | 예금 계좌 |
| `gdc_loans` | 대출 계좌 |
| `gdc_loan_payments` | 대출 상환 내역 |
| `gdc_pool` | FIAT POOL 집계 |
| `gdc_fx_rates` | 실시간 환율 캐시 |
| `gdc_investments` | 투자 포트폴리오 |
| `gdc_signatures` | 이체 서명 검증 로그 |
| `gdc_credit_history` | 신용평가 이력 |

### 9-2. pdv_log 컬럼

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | text | PDV-{guid일부}-{timestamp} |
| guid | text | 사용자 IPv6 GUID |
| source | text | 서비스 ID (gdc) |
| type | text | event / transaction |
| summary | text | 6W 요약 |
| summary_6w | text | 6하 원칙 JSON |
| risk_level | text | low / medium / high |
| created_at | timestamptz | 생성 시각 |

---

## 10. 시스템 아키텍처

### 10-1. 파일 구조

```
gdc/                              ← GitHub: Openhash-Gopang/gdc
│
├── index.html                    ← 기기 감지 라우터
│     width > 768px → desktop.html
│     width ≤ 768px → webapp.html
│
├── desktop.html                  ← PC 랜딩 페이지
│     사이드바 (Supabase 스타일)
│     GDC 발행 메커니즘 설명
│     DeepSeek V4 Pro AI 상담 채팅
│
├── webapp.html                   ← 모바일 PWA
│     고팡 SSO 인증 연동
│     PDV 거래 기록 (이체·예금·대출)
│     ED25519 디지털 서명
│
├── dashboard.html                ← 관리자 대시보드
├── user-dashboard.html           ← 사용자 IASB 재무제표
├── pool-dashboard.html           ← FIAT POOL 현황
├── nation-dashboard.html         ← 국가 통화정책 대시보드
│
├── js/
│   ├── gdc-core.js               ← 잔액·이체·서명 검증
│   ├── gdc-bank.js               ← 예금·대출·이자 계산
│   ├── gdc-pool.js               ← FIAT POOL·환율 연동
│   ├── gdc-credit.js             ← 재무제표 신용평가 (0.1초)
│   └── gdc-crypto.js             ← ED25519 키쌍·서명·검증
│
├── prompts/
│   ├── SP-GDC_v2_0.txt           ← AI 상담사 시스템 프롬프트
│   └── SP-GDC_kbank_v1.0.txt     ← 구버전 보관
│
└── sql/
    └── 01_gdc_schema.sql         ← Supabase 스키마
```

### 10-2. 인증 인프라

```
gopang_v2/                        ← GitHub: Openhash-Gopang/gopang_v2
│
├── gwp-registry.js               ← 16개 서비스 자기 서술 레지스트리
├── gopang/prompts/
│   └── SP-00-ROUTER-v4_0.txt    ← 알고리즘 전용 초경량 라우터
│
└── src/
    └── gopang-sso.js             ← SSO 핵심 라이브러리
```

### 10-3. 백엔드 인프라

```
Cloudflare Worker: gopang-proxy
├── /auth/issue, /verify, /refresh  ← SSO 토큰 관리
├── /auth/webauthn/*                ← WebAuthn 지문 인증
├── /pdv/report                     ← PDV 기록 수신
├── /deepseek                       ← DeepSeek V4 Pro 프록시
└── /geocode                        ← 카카오 역지오코딩

Supabase (PostgreSQL)
├── user_profiles                   ← 사용자 재무제표
├── fs_ledger                       ← GDC 거래 원장
├── pdv_log                         ← PDV 기록
└── gdc_* 테이블들                   ← GDC 전용
```

---

## 11. GWP 레지스트리 연동

### 11-1. 자기 서술 레지스트리

고팡은 수백 종의 하위 시스템으로 구성됩니다. GDC는 `gwp-registry.js`에 다음과 같이 자기 서술합니다.

```javascript
{
  id:          'kgdc',
  name:        'GDC',
  category:    'ECO',
  url:         'https://gdc.gopang.net/webapp.html',
  minAuth:     'L0',
  pdv:         true,
  priority:    4,
  description: 'GDC 지갑. 잔액·이체·예금·대출·환전·신용평가.',
  triggers: [
    '잔액', '얼마 있어', '내 GDC', 'GDC 얼마',
    '이체', '이체해줘', '송금', '보내줘',
    '예금', '저금', '적금', '이자',
    '대출', '빌리다', '빌려줘', '대출 한도',
    '신용등급', '신용평가', '신용점수',
    '환전', 'FIAT', 'GDC', '고팡 화폐', ...
  ],
}
```

### 11-2. 라우팅 원리

```
사용자: "잔액 얼마야?"
        │
        ▼
SP-00-ROUTER-v4_0.txt (알고리즘 전용)
        │  gwp-registry.js 순회
        │  kgdc.triggers에 '잔액' 매칭
        ▼
service_id: "kgdc"
service_url: "https://gdc.gopang.net/webapp.html"
        │
        ▼
GWP 토큰 + ctx → gdc.gopang.net/webapp.html?gwp=1
```

### 11-3. GWP 파라미터

```
https://gdc.gopang.net/webapp.html
  ?gwp=1                          ← GWP 호출 표시
  &gwp_token=HMAC-SHA256-TOKEN    ← 인증 토큰
  &svc=kgdc                       ← 서비스 ID
  &ctx=잔액%20얼마야              ← 사용자 원문
  &return=https://gopang.net      ← 복귀 URL
```

---

## 12. 대시보드 시스템

### 12-1. 구성

| 대시보드 | URL | 대상 |
|---------|-----|------|
| 관리자 | `gdc.gopang.net/dashboard.html` | 운영자 |
| 사용자 재무제표 | `gdc.gopang.net/user-dashboard.html` | 개인 사용자 |
| FIAT POOL | `gdc.gopang.net/pool-dashboard.html` | 운영자·정책 담당자 |
| 국가 통화정책 | `gdc.gopang.net/nation-dashboard.html` | 통화정책 담당자 |

### 12-2. 국가 대시보드 특징

- 17개 광역자치단체 → 시군구 → 읍면동 3단계 드릴다운
- 제주시 한림읍 단위 소비 카테고리 분류 (식비·교통·의료·교육·생활·연구개발)
- 통화정책 지표 6종 (유동성·대출금리·물가연동·지역편차·신규사용자·실물결제)
- 지역간 자금 흐름 수평 바 차트
- 전국 신용점수 분포 히스토그램

### 12-3. AI 상담 채팅

`desktop.html`에 DeepSeek V4 Pro 기반 AI 상담 채팅 모달이 탑재되어 있습니다.

- 시스템 프롬프트: `prompts/SP-GDC_v2_0.txt` (비동기 fetch 로드)
- 대화 히스토리 12턴 유지
- API: `gopang-proxy/deepseek` → DeepSeek V4 Pro
- API 키: Cloudflare Worker `DEEPSEEK_API_KEY` 시크릿 (프론트엔드 미노출)

---

## 13. 인증 및 PDV 테스트 결과

### 13-1. 테스트 환경

| 항목 | 내용 |
|------|------|
| 테스트 일시 | 2026-06-03 |
| 브라우저 | MS Edge (PC) |
| 접속 URL | `https://gdc.gopang.net/webapp.html` |
| GUID | `2601:db80:8995:1e1f:bc7e:764f:502a:f231` |
| 인증 레벨 | L0 |

### 13-2. 테스트 체크리스트

| 단계 | 내용 | 결과 |
|------|------|------|
| T1 | `subsystem-auth.js` + `_onGopangAuth` 삽입 | ✅ |
| T2 | 모바일 UI (375px) 렌더링 | ✅ |
| T3 | Silent iframe 자동 인증 (경로2B) | ✅ |
| T4 | `_onGopangAuth(user.ipv6)` GUID 수신 | ✅ |
| T5 | PDV `/pdv/report` 200 성공 | ✅ |
| T6 | Supabase `pdv_log` 저장 확인 | ✅ |
| T7 | 이체 거래 PDV (`type: transaction`) | ✅ |
| T8 | 예금 개설 PDV | ✅ |
| T9 | 대출 신청 PDV | ✅ |

### 13-3. 주요 해결 과제 및 해결 방법

| 문제 | 원인 | 해결 |
|------|------|------|
| `user.guid` 없음 | `subsystem-auth.js`가 `ipv6` 필드 사용 | `user?.ipv6 \|\| user?.guid`로 수정 |
| PDV 403 Forbidden | Worker가 `report.who.ipv6` 요구하는데 구조 불일치 | Worker 표준 구조로 `sendPDV` 재작성 |
| `loadHome()` null 오류 | GUID null인 채로 Supabase 호출 | `if (!GUID) return` 가드 추가 |
| `file://` 리다이렉트 | 로컬 파일을 브라우저로 직접 열어 테스트 | `https://gdc.gopang.net`으로 접속 |
| `username` 컬럼 없음 | `user_profiles`에 `name` 컬럼 사용 | `user.name`으로 수정 |

### 13-4. Supabase pdv_log 실제 기록

```json
[
  {
    "id":         "PDV-2601db808995-1780506191448",
    "type":       "transaction",
    "summary":    "GDC 대출 신청 ₮10,000 (12개월)",
    "created_at": "2026-06-03 17:03:11+00"
  },
  {
    "id":         "PDV-2601db808995-1780506058105",
    "type":       "transaction",
    "summary":    "GDC 예금 개설 ₮5 (demand)",
    "created_at": "2026-06-03 17:00:58+00"
  },
  {
    "id":         "PDV-2601db808995-1780505748610",
    "type":       "transaction",
    "summary":    "GDC 이체 ₮100 → 2601:db80:0000:0…",
    "created_at": "2026-06-03 16:55:48+00"
  },
  {
    "id":         "PDV-2601db808995-1780502594542",
    "type":       "event",
    "summary":    "GDC 앱 접속 — 지갑·금융 서비스 이용",
    "created_at": "2026-06-03 16:03:14+00"
  }
]
```

---

## 14. 보안 원칙

### 14-1. 개인키 보호

- ED25519 개인키는 브라우저 IndexedDB에만 저장
- 서버에 절대 전송되지 않음
- `gdc-crypto.js`가 모든 서명 처리

### 14-2. API 키 보호

- Supabase anon key는 `gopang-proxy` Worker를 통해 사용 권장
- DeepSeek API key는 Cloudflare Worker 시크릿으로만 관리
- `config.js`는 `.gitignore`로 보호

### 14-3. CORS 정책

```javascript
// gopang-proxy ALLOWED_ORIGINS
'https://gdc.gopang.net'  ← Level 3 서비스
// *.gopang.net 패턴 자동 허용
```

### 14-4. PDV 보안

- 모든 거래 기록은 OpenHash 분산 원장에 앵커링
- 수학적으로 변경 불가
- 법적 증거 수준의 인증 기록 생성

---

## 15. 로드맵

### Phase 1 — 완료 (2026 Q2)
- ✅ GDC 핵심 모듈 구현 (잔액·이체·예금·대출·신용평가)
- ✅ 고팡 SSO 인증 연동 (T1~T9 전체 통과)
- ✅ PDV 거래 기록 (접속·이체·예금·대출)
- ✅ 5종 대시보드 (관리자·사용자·POOL·국가·재무제표)
- ✅ GWP 레지스트리 자기 서술 구조
- ✅ DeepSeek V4 Pro AI 상담 채팅
- ✅ GitHub Pages 배포 (`gdc.gopang.net`)

### Phase 2 — 단기 (2026 Q3)
- 🔲 `user_profiles` 최초 SSO 시 자동 생성
- 🔲 KRW 입금 → GDC 발행 실플로우
- 🔲 ED25519 서명 이체 실연동
- 🔲 예금·대출 실거래 (`gdc_loans` 테이블)
- 🔲 모바일 T3~T9 테스트

### Phase 3 — 중기 (2026 Q4)
- 🔲 FIAT POOL 실운용
- 🔲 193개국 국제 이체
- 🔲 실시간 환율 API 연동
- 🔲 L1 인증 (얼굴 인증) 금융 거래 적용

### Phase 4 — 장기 (2027)
- 🔲 투자 모듈·국민성장펀드 연동
- 🔲 증권·보험 모듈 (별도 저장소)
- 🔲 DAWN 거버넌스 — GDC 투표권 시스템

---

## 16. 오픈소스 및 DAWN 원칙

### 16-1. 오픈소스 선언

GDC(Global Digital Currency)는 오픈소스 공동체이며, 누구나 기능 개선에 참여할 수 있습니다.

- 저장소: `https://github.com/Openhash-Gopang/gdc`
- 라이선스: GPL-3.0

### 16-2. DAWN 철학

GDC는 사람이 아니라, 지침(Guideline)에 의해 동작하며, 누구나 언제나 어디서나 해당 지침의 개정과 갱신에 참여할 수 있습니다.

**DAWN: Democracy is All We Need**  
→ `https://democracy.gopang.net`

### 16-3. 이상의 모든 과정

이상의 모든 과정은 사람의 개입없이 오직 GDC 시스템에 의해 진행되며, 그 메커니즘과 소스코드는 오픈소스입니다.

---

## 부록 A — 핵심 API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `gopang-proxy/auth/issue` | POST | SSO 토큰 발급 |
| `gopang-proxy/auth/verify` | GET | 토큰 검증 |
| `gopang-proxy/pdv/report` | POST | PDV 기록 |
| `gopang-proxy/deepseek` | POST | AI 상담 |
| `supabase/rest/v1/user_profiles` | GET/PATCH | 재무제표 조회·갱신 |
| `supabase/rest/v1/fs_ledger` | GET/POST | 거래 원장 |
| `supabase/rest/v1/gdc_deposits` | GET/POST | 예금 계좌 |
| `supabase/rest/v1/gdc_loans` | GET/POST | 대출 계좌 |
| `supabase/rest/v1/pdv_log` | GET | PDV 조회 |

## 부록 B — 용어 정의

| 용어 | 정의 |
|------|------|
| GDC | Gopang Digital Currency / Global Digital Currency |
| T | GDC 통화 기호 |
| FIAT POOL | 각국 국적 통화 집합 운용 풀 |
| PDV | Personal Data Vault — 개인 데이터 저장소 |
| GWP | Gopang Widget Portal — 하위 서비스 호출 프로토콜 |
| GUID | 기기 핑거프린트 기반 IPv6 형식 고유 식별자 |
| DAWN | Democracy is All We Need |
| OpenHash | 고팡의 PHLD 분산 원장 |
| bs-cash | 대차대조표 현금 계정 = GDC 잔액 |

---

*GDC is powered by OpenHash — Probabilistic Hierarchical Distributed Ledger*  
*© 2026 AI City Inc. · DAWN: Democracy is All We Need*  
*이 문서의 모든 내용은 공개 초안이며, 실제 서비스 출시 전 변경될 수 있습니다.*  
*어떠한 내용도 투자 권유로 해석되어서는 안 됩니다.*
