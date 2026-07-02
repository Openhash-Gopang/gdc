# GDC — Gopang Digital Currency
## 중앙은행 + 시중은행 통합 모듈 v1.0

> **저장소:** `Openhash-Gopang/gdc`  
> **도메인:** `gdc.hondi.net`  
> **운영:** AI City Inc. / OpenHash Network  
> **최초 발행:** 2026년 (제주 시범)  
> **법적 성격:** 고팡 플랫폼 내 결제·저축·대출 단위 (GDC = ₮)

---

## § 1. 핵심 원칙

| 원칙 | 내용 |
|------|------|
| **불변성** | 모든 GDC 잔액은 OpenHash 분산 원장에 기록 — 위변조 불가 |
| **재무제표 = 신용** | `user_profiles.extra.fs` 재무제표가 유일한 신용 평가 근거 |
| **PDV 연동** | 모든 GDC 거래는 PDV에 6하 원칙으로 기록 |
| **디지털 서명** | 이체·대출 등 모든 거래에 ED25519 개인키 서명 필수 |
| **무지점** | 지점·직원 없음 → 예금 이자 현저히 높음, 대출 이자 현저히 낮음 |

---

## § 2. GDC 가치 체계

```
GDC 1₮ = KRW 1,000원 (런칭 기준가)
         이후 → 서비스 사용량 · FIAT POOL 규모 · 투자 수익에 따라 자율 변동
```

### FIAT POOL 구조

```
사용자 법정화폐 납입
        │
        ▼
┌──────────────────────────────────────────────┐
│              GDC FIAT POOL                   │
│                                              │
│  KRW 풀  │  USD 풀  │  EUR 풀  │  JPY 풀  …  │
│  (한국)  │  (미국)  │  (유럽)  │  (일본)      │
│                                              │
│  실시간 환율 API 연동 → 사용자간 즉시 교환     │
│  별도 환전 절차 없음                          │
└──────────────────────────────────────────────┘
        │
        ├── 지불준비금 (20%) → POOL 유지
        │
        └── 투자 자산 (80%)
                ├── 각국 주가지수 ETF (KOSPI, S&P500, FTSE …)
                └── 각국 국민성장펀드
                    └── 한국: 국민성장펀드 (기본값)
```

---

## § 3. 모듈 구조

```
gdc/
├── index.html              ← GDC 랜딩 (소개·지갑·잔액 조회)
├── dashboard.html          ← 관리자 대시보드 (POOL·발행량·투자현황)
├── webapp.html             ← 사용자 GDC 앱 (잔액·이체·예금·대출)
│
├── js/
│   ├── gdc-core.js         ← 잔액 조회·이체·서명 검증
│   ├── gdc-bank.js         ← 예금·대출·이자 계산
│   ├── gdc-pool.js         ← FIAT POOL 관리·환율 연동
│   ├── gdc-credit.js       ← 재무제표 기반 신용평가 (0.1초)
│   ├── gdc-invest.js       ← 투자 추천·실행
│   └── gdc-crypto.js       ← ED25519 키쌍 생성·서명·검증
│
├── prompts/
│   └── SP-GDC_kbank_v1.0.txt  ← GDC AI 은행 비서 프롬프트
│
├── sql/
│   ├── 01_gdc_schema.sql   ← Supabase 테이블 스키마
│   └── 02_gdc_rls.sql      ← RLS 정책 (보안)
│
├── api/
│   └── gdc-proxy.js        ← Cloudflare Worker (환율 API 프록시)
│
├── CNAME                   ← gdc.hondi.net
└── docs/
    ├── DESIGN.md           ← 상세 설계 (본 문서)
    ├── WHITEPAPER.md       ← GDC 백서
    └── API.md              ← REST API 명세
```

---

## § 4. Supabase 데이터 모델

### 기존 연동 테이블 (gopang 공유)
| 테이블 | 역할 |
|--------|------|
| `user_profiles.extra.fs.bs['bs-cash']` | GDC 잔액 (원장) |
| `fs_ledger` | GDC 거래 원장 |
| `pdv_log` | PDV 6하 원칙 기록 |

### GDC 전용 신규 테이블
| 테이블 | 역할 |
|--------|------|
| `gdc_keys` | 사용자 공개키 등록 |
| `gdc_deposits` | 예금 계좌 |
| `gdc_loans` | 대출 계좌 |
| `gdc_pool` | FIAT POOL 집계 |
| `gdc_fx_rates` | 실시간 환율 캐시 |
| `gdc_investments` | 투자 포트폴리오 |

---

## § 5. 은행 서비스 스펙

### 5-1. 예금 (Deposit)
| 항목 | 스펙 |
|------|------|
| 예금 단위 | GDC (₮) |
| 기본 금리 | 연 5.0% (시중은행 평균의 5배) |
| 이자 지급 | 매일 자정 자동 지급 (일복리) |
| 예금 보호 | OpenHash 원장 불변성으로 보장 |
| 최소 예치 | ₮1,000 |

### 5-2. 대출 (Loan)
| 항목 | 스펙 |
|------|------|
| 신용 평가 | 재무제표(`extra.fs`) 기반 AI 즉시 평가 (0.1초) |
| 기본 금리 | 연 2.0% (신용등급 AAA 기준) |
| 최고 금리 | 연 8.0% (신용등급 C 기준) |
| 대출 한도 | 순자산(`bs-equity`)의 최대 70% |
| 상환 방식 | 원리금균등 / 원금균등 / 만기일시 선택 |

### 5-3. 이체 (Transfer)
| 항목 | 스펙 |
|------|------|
| 서명 방식 | ED25519 디지털 서명 |
| 처리 속도 | 즉시 (OpenHash 원장 기록) |
| 수수료 | 없음 (GDC 내부 이체) |
| 해외 이체 | FIAT POOL 내 실시간 환율 적용 |

### 5-4. 신용평가 알고리즘 (0.1초)
```
신용점수 = f(재무제표)

입력:
  - 유동비율    = bs-cash / bs-ap          (가중치 25%)
  - 부채비율    = bs-debt / bs-equity       (가중치 25%)
  - 영업이익률  = (pl-revenue - pl-cogs - pl-opex) / pl-revenue  (가중치 30%)
  - 현금흐름비율 = cf-op / bs-debt          (가중치 20%)

신용등급:
  950+ → AAA: 대출금리 2.0%
  900+ → AA : 대출금리 3.0%
  800+ → A  : 대출금리 4.0%
  700+ → BBB: 대출금리 5.5%
  600+ → BB : 대출금리 7.0%
  600↓ → C  : 대출금리 8.0% / 한도 축소
```

---

## § 6. FIAT POOL 환율 교환

```
A (KRW 보유) → B (USD 보유) 이체 시:

1. A의 GDC 잔액에서 차감
2. 실시간 KRW/USD 환율 조회 (gdc-proxy Cloudflare Worker)
3. B의 GDC 잔액에 가산 (USD 기준 GDC 가치 환산)
4. FIAT POOL 내 KRW↔USD 비율 자동 재조정
5. OpenHash 원장에 양방향 기록
6. 양측 PDV에 이체 내역 기록

→ 사용자는 별도 환전 없이 즉시 수신
```

---

## § 7. 투자 모듈

| 투자 대상 | 국가 | 특징 |
|---------|------|------|
| 국민성장펀드 | 🇰🇷 한국 | 기본값 — 정부 보증, 안정적 |
| 코스피 인덱스 ETF | 🇰🇷 한국 | TIGER 200 연동 |
| S&P 500 ETF | 🇺🇸 미국 | VOO 연동 |
| FTSE 100 ETF | 🇬🇧 영국 | ISF 연동 |
| 닛케이 ETF | 🇯🇵 일본 | 1321 연동 |

투자 비율: FIAT POOL 총액의 80%  
지불준비금: 20% (즉시 출금 보장)

---

## § 8. 디지털 서명 메커니즘

```
키 생성 (최초 1회):
  [keypair] = ED25519.generateKeyPair()
  공개키 → gdc_keys 테이블 등록 (Supabase)
  개인키 → 사용자 브라우저 로컬 저장 (IndexedDB, 암호화)

이체 서명:
  message = {from, to, amount, nonce, timestamp}
  signature = ED25519.sign(message, privateKey)
  서버 검증: ED25519.verify(message, signature, publicKey)

보안 원칙:
  - 개인키는 서버에 절대 전송되지 않음
  - 모든 서명은 브라우저 내에서만 생성
  - nonce로 재전송 공격 방지
```

---

## § 9. PDV 연동 기록 형식

모든 GDC 거래는 `pdv_log`에 아래 형식으로 기록:

```json
{
  "user_guid": "...",
  "service_id": "gopang-gdc",
  "record_type": "gdc_transfer | gdc_deposit | gdc_loan | gdc_interest",
  "summary": "GDC 이체 ₮50,000 → bbbb…",
  "what": "GDC 이체",
  "how": "ED25519 디지털 서명",
  "why": "상품 대금 지급",
  "category": "gdc",
  "extra": {
    "tx_id": "uuid",
    "from_guid": "...",
    "to_guid": "...",
    "amount": 50000,
    "currency": "GDC",
    "signature": "ed25519:...",
    "fx_rate": null,
    "openhash_block": 9012844
  }
}
```

---

## § 10. 로드맵

| 단계 | 내용 | 시기 |
|------|------|------|
| Phase 1 | 제주 시범: 잔액 조회·이체·예금 | 2026 Q3 |
| Phase 2 | 대출·신용평가·FIAT POOL | 2026 Q4 |
| Phase 3 | 국제 이체·다국 POOL | 2027 Q1 |
| Phase 4 | 투자 모듈·국민성장펀드 연동 | 2027 Q2 |
| Phase 5 | 증권·보험 모듈 (별도 저장소) | 2027 Q3~ |

---

*GDC is powered by OpenHash — Probabilistic Hierarchical Distributed Ledger*
