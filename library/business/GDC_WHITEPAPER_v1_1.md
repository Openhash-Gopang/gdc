# GDC 백서 (Whitepaper) v1.1
## Gopang Digital Currency — Global Digital Currency

> **발행:** AI City Inc. / OpenHash Network  
> **도메인:** `gdc.hondi.net`  
> **저장소:** `Openhash-Gopang/gdc`  
> **최초 발행:** 2026년 6월  
> **v1.1 갱신:** 2026년 6월 4일 — market→gdc→tax 3시스템 연동 파이프라인 추가  
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
6. [settleLedger — 재무제표 정산 엔진](#6-settleledger--재무제표-정산-엔진)
7. [디지털 서명 메커니즘](#7-디지털-서명-메커니즘)
8. [고팡 SSO 인증 연동](#8-고팡-sso-인증-연동)
9. [PDV 연동](#9-pdv-연동)
10. [데이터 모델](#10-데이터-모델)
11. [시스템 아키텍처](#11-시스템-아키텍처)
12. [GWP 레지스트리 연동](#12-gwp-레지스트리-연동)
13. [대시보드 시스템](#13-대시보드-시스템)
14. [인증 및 PDV 테스트 결과](#14-인증-및-pdv-테스트-결과)
15. [보안 원칙](#15-보안-원칙)
16. [로드맵](#16-로드맵)
17. [오픈소스 및 DAWN 원칙](#17-오픈소스-및-dawn-원칙)

---

## 1. 개요 및 비전

### 1-1. GDC란?

GDC(Global Digital Currency / Gopang Digital Currency)는 고팡(hondi.net) 생태계의 글로벌 디지털 통화입니다.

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
| **[v1.1] 재무제표 정산** | market 거래를 fs_ledger에서 집계하여 extra.fs 자동 갱신 |

### 1-3. 고팡 생태계에서의 위치 (v1.1 갱신)

```
고팡(hondi.net) — 현실 세계의 AI 쌍둥이들로 구성된 평행 세계
        │
        ├─ market.hondi.net — 거래 발생 → fs_ledger 기록
        │         │
        │         ▼ INSERT (revenue/purchase/opex)
        │    Supabase: fs_ledger  ←──────────────────────┐
        │         │ READ (집계)                           │
        │         ▼                                       │
        ├─ GDC(gdc.hondi.net)                           │
        │    settleLedger()                               │
        │    → user_profiles.extra.fs PATCH              │
        │         │ READ                                  │
        │         ▼                                       │
        └─ tax.hondi.net                                │
             세금 계산 → 납세 → fs_ledger INSERT ────────┘
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
1. A의 GDC 잔액에서 차감 → fs_ledger debit 기록
2. 실시간 KRW/USD 환율 조회
3. B의 GDC 잔액에 가산 → fs_ledger credit 기록
4. POOL 내 KRW↔USD 비율 자동 재조정
5. OpenHash 원장에 양방향 기록
6. 양측 PDV에 이체 내역 기록
→ 수수료 없음 / 0.1초 내 완료
```

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
| 대출 한도 | 순자산(bs-equity)의 최대 70% |
| 상환 방식 | 원리금균등 / 원금균등 / 만기일시 선택 |

### 4-3. 이체

| 항목 | 스펙 |
|------|------|
| 서명 방식 | ED25519 디지털 서명 |
| 처리 속도 | 즉시 (OpenHash 원장 기록) |
| 수수료 | 없음 (GDC 내부 이체) |
| 해외 이체 | FIAT POOL 내 실시간 환율 적용 |
| 원장 기록 | fs_ledger 차변(송신자) + 대변(수신자) 동시 기록 |

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

**신용평가 정확도 향상 (v1.1):** market 거래가 fs_ledger → settleLedger → extra.fs 경로로 실시간 반영되므로, 신용평가의 기반이 되는 `pl-revenue`·`pl-opex` 값이 실거래 데이터로 자동 갱신됩니다.

---

## 5. 재무제표 기반 신용평가

### 5-1. 결합 재무제표의 의미

고팡은 모든 사용자의 재무제표를 자동으로 생성하고, 매 거래마다 갱신하며, 전체 인구와 기관의 재무제표를 상호 연동합니다.

**어느 한 재무제표를 위변조하려면, 세상의 모든 재무제표를 동시에 위변조해야 합니다.**

### 5-2. 재무제표 구조 (v1.1 갱신)

```
user_profiles.extra.fs
├── bs (대차대조표)
│   ├── bs-cash      ← GDC 잔액 (gdc가 관리)
│   ├── bs-ar        ← 매출채권
│   ├── bs-ap        ← 매입채무
│   ├── bs-debt      ← 차입금
│   ├── bs-equity    ← 순자산
│   └── bs-inventory ← 재고
├── pl (손익계산서)
│   ├── pl-revenue       ← 매출 (market 거래 → gdc settleLedger가 갱신)
│   ├── pl-cogs          ← 매출원가
│   ├── pl-opex          ← 판관비 (market 거래 → gdc settleLedger가 갱신)
│   ├── pl-gross-profit  ← 매출총이익 (v1.1 신규)
│   └── pl-net-income    ← 순이익 (v1.1 신규)
├── cf (현금흐름표)
│   └── cf-op        ← 영업현금흐름
└── tax (납세 이력)
    ├── 2026-H1-VAT  ← { status, paid_at, tx_id, amount }
    ├── 2026-H2-VAT  ← { status, paid_at, tx_id, amount }
    └── 2026-IT      ← { status, paid_at, tx_id, amount }
```

### 5-3. 재무제표 갱신 주체 (v1.1 명확화)

| 계정 | 갱신 주체 | 갱신 시점 |
|------|----------|----------|
| `bs-cash` | **gdc** | 이체·예금·대출 완료 시 즉시 |
| `pl-revenue` | **gdc** (settleLedger) | loadHome() 시 fs_ledger 집계 |
| `pl-opex` | **gdc** (settleLedger) | loadHome() 시 fs_ledger 집계 |
| `pl-gross-profit` | **gdc** (settleLedger) | loadHome() 시 계산 |
| `pl-net-income` | **gdc** (settleLedger) | loadHome() 시 계산 |
| `tax.*` | **tax** | 납세 완료 시 |

### 5-4. IASB 기준 재무제표 제공

사용자 대시보드(`user-dashboard.html`)에서 IASB 기준 6종 재무제표를 제공합니다:

- 재무상태표 (IAS 1 §54)
- 포괄손익계산서 (IAS 1 §81A)
- 현금흐름표 (IAS 7 간접법)
- 자본변동표 (IAS 1 §106)
- 이익잉여금처분계산서 (K-IFRS)
- 재무분석 보고서 (유동성·수익성·안정성·신용등급)

---

## 6. settleLedger — 재무제표 정산 엔진

> **v1.1 신규 섹션** — GDC의 핵심 신규 기능

### 6-1. 역할

```
GDC는 고팡 경제의 재무제표 관리자입니다.

market AI가 [TRADE] 블록을 파싱하여 fs_ledger에 기록한 거래
    → GDC settleLedger()가 집계
    → user_profiles.extra.fs 갱신
    → tax가 읽어 세금 계산

market이 기록한 거래 (fs_ledger)
    → GDC가 집계 (settleLedger)
    → user_profiles.extra.fs 갱신
    → tax가 읽어 세금 계산
```

### 6-2. 호출 시점

`loadHome()` 호출 시 자동 실행. 앱 진입 시마다 최신 거래가 재무제표에 반영된다.

```javascript
async function loadHome() {
  if (!GUID) return;
  await settleLedger(GUID);   // ← 재무제표 정산 먼저
  const ex = await getExtra();
  // UI 갱신...
}
```

### 6-3. 구현 (gdc/webapp.html)

```javascript
async function settleLedger(guid) {
  if (!guid) return;

  // ① fs_ledger READ — revenue/purchase/opex/cogs 집계
  //    gdc_transfer, tax_payment 제외 (별도 처리)
  const res = await fetch(
    `${S}/rest/v1/fs_ledger`
    + `?guid=eq.${guid}`
    + `&fs_account=in.(revenue,purchase,opex,cogs,service_fee,interest_income)`
    + `&select=direction,amount,fs_account`,
    { headers: Hd }
  );
  const rows = await res.json();

  // ② 집계
  let revenue = 0, opex = 0, cogs = 0;
  for (const r of rows) {
    const amt = parseFloat(r.amount) || 0;
    if (r.direction === 'credit') {
      revenue += amt;
    } else {
      if (r.fs_account === 'cogs') cogs += amt;
      else                         opex += amt;
    }
  }
  const grossProfit = Math.max(0, revenue - cogs);
  const netIncome   = Math.max(0, grossProfit - opex);

  // ③ user_profiles 현재 extra 읽기
  const profRes  = await fetch(
    `${S}/rest/v1/user_profiles?guid=eq.${guid}&select=extra`,
    { headers: Hd }
  );
  const profRows = await profRes.json();
  const ex = profRows[0].extra || {};
  ex.fs    = ex.fs    || {};
  ex.fs.pl = ex.fs.pl || {};
  ex.fs.bs = ex.fs.bs || {};

  // ④ PL 갱신 (bs-cash는 건드리지 않음 — gdc_transfer로 별도 관리)
  ex.fs.pl['pl-revenue']      = String(revenue);
  ex.fs.pl['pl-opex']         = String(opex);
  ex.fs.pl['pl-cogs']         = String(cogs);
  ex.fs.pl['pl-gross-profit'] = String(grossProfit);
  ex.fs.pl['pl-net-income']   = String(netIncome);

  // ⑤ PATCH
  await fetch(
    `${S}/rest/v1/user_profiles?guid=eq.${guid}`,
    { method: 'PATCH', headers: H, body: JSON.stringify({ extra: ex }) }
  );

  console.log('[GDC Settle] ✅',
    `revenue ₮${revenue.toLocaleString()}`,
    `opex ₮${opex.toLocaleString()}`,
    `net ₮${netIncome.toLocaleString()}`
  );
}
```

### 6-4. 설계 원칙 — 느슨한 결합

```
GDC는 market을 모릅니다.
GDC는 tax를 모릅니다.
GDC는 fs_ledger만 읽고, extra.fs만 씁니다.

market → fs_ledger INSERT → (GDC가 알아서 읽음)
tax    → extra.fs READ    → (GDC가 갱신한 값)
```

### 6-5. bs-cash 처리 원칙

```
bs-cash는 settleLedger에서 건드리지 않습니다.

이유:
  bs-cash = GDC 잔액
  GDC 잔액은 이체(gdc_transfer)로만 변경됩니다.
  market 거래는 GDC 잔액에 직접 영향을 주지 않습니다.
  (거래 대금은 GDC 이체로 별도 처리)

bs-cash 갱신 주체: doTransfer(), openDep(), applyLoan()
```

---

## 7. 디지털 서명 메커니즘

### 7-1. 키 생성 (최초 1회)

```javascript
const keyPair = await crypto.subtle.generateKey(
  { name: 'Ed25519' }, true, ['sign', 'verify']
);
// 공개키 → gdc_keys 테이블 등록 (Supabase)
// 개인키 → 사용자 브라우저 IndexedDB (암호화 저장)
```

### 7-2. 이체 서명

```javascript
const message = {
  op:        'gdc_transfer',
  from:      fromGuid,
  to:        toGuid,
  amount,
  nonce,          // 재전송 공격 방지
  timestamp: Date.now(),
};
const signature = await signMessage(userGuid, message);
// 서버 검증 후 원장 기록
```

### 7-3. 보안 원칙

- 개인키는 서버에 절대 전송되지 않음
- 모든 서명은 브라우저 내에서만 생성
- nonce로 재전송 공격 방지
- `gdc_signatures` 테이블에 검증 로그 저장

---

## 8. 고팡 SSO 인증 연동

### 8-1. 인증 방식

GDC는 고팡 SSO(`subsystem-auth.js`)를 사용하며, HTML에 **한 줄**만 삽입합니다.

```html
<script type="module"
  src="https://hondi.net/auth/subsystem-auth.js">
</script>
```

### 8-2. 인증 경로 (5단계 폭포)

```
gopangAuth.require('L0') 호출
│
├─ ① GWP 토큰 확인     (URL ?gwp_token= 파싱 + HMAC 검증)
├─ ② 세션 캐시 확인    (sessionStorage['gopang_sso_token'])
├─ ③ 로컬 기기 확인    (localStorage['gopang_user_v3'] + 기기 핑거프린트)
├─ ④ Silent iframe     (hondi.net/auth/silent-auth.html, postMessage)
└─ ⑤ 리다이렉트        (최후 수단)
```

### 8-3. 인증 콜백 (v1.1 갱신)

```javascript
window._onGopangAuth = async function(user) {
  // user.ipv6  : 사용자 GUID (IPv6 형식) ← user.guid 아님 주의
  // user.level : 인증 레벨 (L0~L3)
  // user.via   : 인증 경로 (session/iframe/gwp)

  const guid = user?.ipv6 || user?.guid || null;
  if (!guid) return;

  GUID = guid;

  // 앱 초기화 — settleLedger() 포함
  await loadHome();

  // PDV 접속 이벤트 기록
  await sendPDV(guid, user);
};
```

---

## 9. PDV 연동

### 9-1. PDV 전송 구조

```javascript
async function sendPDV(ipv6, user, reportOverride = null) {
  const report = reportOverride || {
    svc:  'gdc',
    type: 'event',
    who: {
      ipv6:       ipv6,
      role:       'user',
      level:      user?.level || 'L0',
      recipients: ['gopang-pdv'],
    },
    when:  { period_start: now, period_end: now },
    where: { svc_url: 'https://gdc.hondi.net/webapp.html' },
    what:  { summary: 'GDC 앱 접속 — 지갑·금융 서비스 이용' },
    how:   { method: '고팡 SSO 자동 인증' },
    why:   { goal: 'GDC 잔액 조회 및 금융 서비스 이용' },
  };

  await fetch(PROXY_BASE + '/pdv/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ report }),
  });
}
```

### 9-2. PDV 기록 포인트

| 시점 | `type` | summary 예시 |
|------|--------|------|
| 앱 접속 | `event` | GDC 앱 접속 — 지갑·금융 서비스 이용 |
| GDC 이체 | `transaction` | GDC 이체 ₮100 → 2601:db80:0000:... |
| 예금 개설 | `transaction` | GDC 예금 개설 ₮5 (demand) |
| 대출 신청 | `transaction` | GDC 대출 신청 ₮10,000 (12개월) |

---

## 10. 데이터 모델

### 10-1. Supabase 테이블 구조

#### user_profiles

| 컬럼 | 타입 | 설명 |
|------|------|------|
| guid | TEXT PK | IPv6 형식 사용자 식별자 |
| name | TEXT | 사용자/기관명 |
| entity_type | TEXT | person / org / thing |
| address | TEXT | 주소 |
| extra | JSONB | 재무제표 포함 확장 데이터 |

#### fs_ledger (거래 원장 — 3시스템 공유)

| 컬럼 | 타입 | 기록 주체 | 설명 |
|------|------|----------|------|
| tx_id | TEXT | 모두 | 거래 UUID |
| guid | TEXT | 모두 | 사용자 GUID |
| counterpart | TEXT | 모두 | 거래 상대방 |
| direction | TEXT | 모두 | credit / debit |
| amount | NUMERIC | 모두 | 거래 금액 |
| item_name | TEXT | 모두 | 품목명 |
| fs_account | TEXT | 모두 | 계정과목 (표준 코드) |
| memo | TEXT | 모두 | 메모 |
| tx_at | TIMESTAMPTZ | 모두 | 거래 시각 |

#### fs_account 표준 코드

| 코드 | 의미 | 기록 주체 |
|------|------|----------|
| `revenue` | 매출 | market |
| `purchase` | 매입 | market |
| `opex` | 판매비와관리비 | market |
| `cogs` | 매출원가 | market |
| `gdc_transfer` | GDC 이체 | **gdc** |
| `tax_payment` | 납세 (차변) | tax |
| `tax_revenue` | 세수 수납 (대변) | tax |
| `interest_income` | 예금 이자 | gdc |
| `loan_proceeds` | 대출 실행 | gdc |
| `loan_repayment` | 대출 상환 | gdc |

#### pdv_log

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT PK | PDV-{guid12}-{timestamp} |
| guid | TEXT | 사용자 GUID |
| source | TEXT | 서비스 ID (정규화: gdc/tax/market) |
| type | TEXT | event / transaction |
| summary | TEXT | 6W 요약 |
| summary_6w | JSONB | 6하 원칙 JSON |
| risk_level | TEXT | low / medium / high |
| created_at | TIMESTAMPTZ | 생성 시각 |

### 10-2. extra.fs 전체 구조

```json
{
  "fs": {
    "bs": {
      "bs-cash":      "5680720",
      "bs-ar":        "0",
      "bs-ap":        "0",
      "bs-debt":      "0",
      "bs-equity":    "5000000",
      "bs-inventory": "0"
    },
    "pl": {
      "pl-revenue":      "4039000",
      "pl-cogs":         "0",
      "pl-opex":         "8078",
      "pl-gross-profit": "4039000",
      "pl-net-income":   "4030922"
    },
    "cf": {
      "cf-op": "0"
    },
    "tax": {
      "2026-H1-VAT": {
        "status":   "paid",
        "paid_at":  "2026-05-29T08:49:51.195Z",
        "tx_id":    "d8e6dd7f-90e0-4786-b335-8edf70237cd6",
        "amount":   232000
      },
      "2026-IT": {
        "status":   "paid",
        "paid_at":  "2026-05-29T08:49:53.787Z",
        "tx_id":    "1a64527a-3d09-4635-a7d4-0ccde24a3c36",
        "amount":   546302
      }
    }
  }
}
```

---

## 11. 시스템 아키텍처

### 11-1. 파일 구조

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
├── webapp.html                   ← 모바일 PWA (v1.1 갱신)
│     고팡 SSO 인증 연동
│     settleLedger() — fs_ledger 집계 → extra.fs 갱신 (신규)
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
└── docs/
    └── GDC_WHITEPAPER_v1_1.md    ← 본 문서
```

### 11-2. 백엔드 인프라 (v1.1 갱신)

```
Cloudflare Worker: gopang-proxy v4.3
├── /auth/issue, /verify, /refresh  ← SSO 토큰 관리
├── /auth/webauthn/*                ← WebAuthn 지문 인증
├── /pdv/report                     ← PDV 기록 수신
│     SVC_ALIAS: 'kgdc' → 'gdc'   ← v4.3 자동 변환
├── /deepseek                       ← DeepSeek V4 Pro 프록시
└── /geocode                        ← 카카오 역지오코딩

Supabase (PostgreSQL)
├── user_profiles                   ← 사용자 재무제표 (extra.fs)
│     → gdc가 pl-revenue/opex 갱신 (settleLedger)
│     → gdc가 bs-cash 갱신 (이체·예금·대출)
│     → tax가 tax.* 갱신 (납세 완료)
├── fs_ledger                       ← 3시스템 공유 원장
│     → market이 revenue/purchase/opex 기록
│     → gdc가 gdc_transfer 기록
│     → tax가 tax_payment 기록
├── pdv_log                         ← PDV 원장
│     → gdc: source='gdc'
│     → market: source='market'
│     → tax: source='tax'
└── gdc_* 테이블들                   ← GDC 전용
    ├── gdc_deposits
    ├── gdc_loans
    ├── gdc_keys
    └── gdc_signatures
```

---

## 12. GWP 레지스트리 연동

### 12-1. 자기 서술 레지스트리

```javascript
// gwp-registry.js
{
  id:          'kgdc',           // gwp-registry.js ID
  name:        'GDC',
  category:    'ECO',
  url:         'https://gdc.hondi.net/webapp.html',
  minAuth:     'L0',
  pdv:         true,
  priority:    4,
  description: 'GDC 지갑. 잔액·이체·예금·대출·환전·신용평가.',
  triggers: ['잔액', '이체', '송금', '예금', '대출', 'GDC', ...],
}
```

### 12-2. Worker v4.3 SVC_ALIAS

```javascript
// gopang-proxy worker.js v4.3
const SVC_ALIAS = {
  'kgdc': 'gdc',   // gwp id → REGISTERED_SERVICES key
  'ktax': 'tax',
  ...
};
// PDV 전송 시: svc='kgdc' → resolvedId='gdc' → Level 3 서비스 확인
```

---

## 13. 대시보드 시스템

### 13-1. 구성

| 대시보드 | URL | 대상 |
|---------|-----|------|
| 관리자 | `gdc.hondi.net/dashboard.html` | 운영자 |
| 사용자 재무제표 | `gdc.hondi.net/user-dashboard.html` | 개인 사용자 |
| FIAT POOL | `gdc.hondi.net/pool-dashboard.html` | 운영자·정책 담당자 |
| 국가 통화정책 | `gdc.hondi.net/nation-dashboard.html` | 통화정책 담당자 |

### 13-2. 국가 대시보드 특징

- 17개 광역자치단체 → 시군구 → 읍면동 3단계 드릴다운
- 제주시 한림읍 단위 소비 카테고리 분류
- 통화정책 지표 6종
- 지역간 자금 흐름 수평 바 차트
- 전국 신용점수 분포 히스토그램

---

## 14. 인증 및 PDV 테스트 결과

### 14-1. 테스트 환경

| 항목 | 내용 |
|------|------|
| 테스트 일시 | 2026-06-03 ~ 2026-06-04 |
| 브라우저 | MS Edge (PC) |
| GUID | `2601:db80:8995:1e1f:bc7e:764f:502a:f231` |
| 인증 레벨 | L0 |

### 14-2. GDC 자체 테스트 (T1~T9)

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

### 14-3. 통합 파이프라인 테스트 (v1.1 신규)

**테스트 스크립트:** `test_full_pipeline.py`

| 단계 | 내용 | 결과 |
|------|------|------|
| T1 | market fs_ledger INSERT (판매 2건, 구매 1건) | ✅ |
| T2 | gdc settleLedger — extra.fs PL 갱신 | ✅ |
| T3 | tax 세금 계산 (갱신된 재무제표 기준) | ✅ |
| T4 | 롤백 — 테스트 데이터 원복 | ✅ |

**실제 테스트 수치:**

```
Test_A 기준값:
  pl-revenue: ₮4,039,000
  pl-opex:    ₮8,078
  bs-cash:    ₮5,680,720

market 거래 추가 후 gdc 정산:
  pl-revenue: ₮4,239,000  (+₮200,000 판매)
  pl-opex:    ₮23,078     (+₮15,000 구매)
  pl-net-income: ₮4,215,922

tax 세금 계산:
  부가세:    ₮423,900
  소득세:    ₮252,955 (누진세율)
  지방소득세: ₮25,296
  납부 총액:  ₮702,151 (납세율 16.6%)
```

### 14-4. PDV 실제 기록

```json
[
  {
    "id":         "PDV-2601db808995-1780506191448",
    "source":     "gdc",
    "type":       "transaction",
    "summary":    "GDC 대출 신청 ₮10,000 (12개월)",
    "created_at": "2026-06-03 17:03:11+00"
  },
  {
    "id":         "PDV-2601db808995-1780506058105",
    "source":     "gdc",
    "type":       "transaction",
    "summary":    "GDC 예금 개설 ₮5 (demand)",
    "created_at": "2026-06-03 17:00:58+00"
  },
  {
    "id":         "PDV-2601db808995-1780505748610",
    "source":     "gdc",
    "type":       "transaction",
    "summary":    "GDC 이체 ₮100 → 2601:db80:0000:0…",
    "created_at": "2026-06-03 16:55:48+00"
  }
]
```

---

## 15. 보안 원칙

### 15-1. 개인키 보호

- ED25519 개인키는 브라우저 IndexedDB에만 저장
- 서버에 절대 전송되지 않음

### 15-2. API 키 보호

- Supabase anon key: `gopang-proxy` Worker를 통해 사용 권장
- DeepSeek API key: Cloudflare Worker 시크릿으로만 관리

### 15-3. CORS 정책 (Worker v4.3)

```javascript
// ALLOWED_ORIGINS
'https://gdc.hondi.net'  // Level 3 서비스
// *.hondi.net 패턴 자동 허용
// SVC_ALIAS: 'kgdc' → 'gdc' 자동 변환
```

### 15-4. RLS (Row Level Security)

Supabase `fs_ledger` 테이블은 anon key 직접 SELECT 시 `guid` 필터 없이 조회 불가. `settleLedger()`는 브라우저 세션 컨텍스트에서 `guid=eq.{자신의 GUID}` 필터로 조회하므로 정상 동작.

---

## 16. 로드맵

### Phase 1 — 완료 (2026 Q2)

- ✅ GDC 핵심 모듈 구현 (잔액·이체·예금·대출·신용평가)
- ✅ 고팡 SSO 인증 연동 (T1~T9 전체 통과)
- ✅ PDV 거래 기록 (접속·이체·예금·대출)
- ✅ 5종 대시보드
- ✅ GWP 레지스트리 자기 서술
- ✅ DeepSeek V4 Pro AI 상담 채팅
- ✅ GitHub Pages 배포
- ✅ **settleLedger() — fs_ledger 집계 → extra.fs PL 갱신 (v1.1)**
- ✅ **market→gdc→tax 통합 파이프라인 테스트 통과 (v1.1)**

### Phase 2 — 단기 (2026 Q3)

- 🔲 `user_profiles` 최초 SSO 시 자동 생성
- 🔲 KRW 입금 → GDC 발행 실플로우
- 🔲 ED25519 서명 이체 실연동
- 🔲 Supabase Realtime 구독 → market 거래 즉시 정산
- 🔲 예금·대출 실거래 (`gdc_loans` 테이블)

### Phase 3 — 중기 (2026 Q4)

- 🔲 FIAT POOL 실운용
- 🔲 193개국 국제 이체
- 🔲 실시간 환율 API 연동
- 🔲 L1 인증 (얼굴 인증) 금융 거래 적용

### Phase 4 — 장기 (2027)

- 🔲 투자 모듈·국민성장펀드 연동
- 🔲 증권·보험 모듈
- 🔲 DAWN 거버넌스 — GDC 투표권 시스템

---

## 17. 오픈소스 및 DAWN 원칙

### 17-1. 오픈소스 선언

- 저장소: `https://github.com/Openhash-Gopang/gdc`
- 라이선스: GPL-3.0

### 17-2. DAWN 철학

**DAWN: Democracy is All We Need**

GDC는 사람이 아니라, 지침(Guideline)에 의해 동작하며, 누구나 언제나 어디서나 해당 지침의 개정과 갱신에 참여할 수 있습니다.

---

## 부록 A — 핵심 API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `gopang-proxy/auth/issue` | POST | SSO 토큰 발급 |
| `gopang-proxy/auth/verify` | GET | 토큰 검증 |
| `gopang-proxy/pdv/report` | POST | PDV 기록 (svc: 'gdc') |
| `gopang-proxy/deepseek` | POST | AI 상담 |
| `supabase/rest/v1/user_profiles` | GET/PATCH | 재무제표 조회·갱신 |
| `supabase/rest/v1/fs_ledger` | GET/POST | 거래 원장 (3시스템 공유) |
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
| settleLedger | fs_ledger 집계 → extra.fs PL 갱신 함수 (gdc) |
| fs_ledger | market·gdc·tax 3시스템 공유 거래 원장 테이블 |
| SVC_ALIAS | Worker v4.3 — gwp-registry ID → REGISTERED_SERVICES key 변환 |

---

*GDC is powered by OpenHash — Probabilistic Hierarchical Distributed Ledger*  
*© 2026 AI City Inc. · DAWN: Democracy is All We Need*  
*v1.1 갱신: settleLedger 재무제표 정산 엔진 + market→gdc→tax 파이프라인 추가 (2026-06-04)*  
*이 문서의 모든 내용은 공개 초안이며, 실제 서비스 출시 전 변경될 수 있습니다.*  
*어떠한 내용도 투자 권유로 해석되어서는 안 됩니다.*
