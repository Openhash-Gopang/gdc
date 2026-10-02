# 고팡 서브서비스 업무 인수인계 지시서
## Gopang Sub-Service Handover Document

**작성일** 2026-06-03  
**작성자** AI City Inc. (팀 주피터)  
**수신** 다음 대화창 (새 세션)  
**분류** 내부 개발 지침

---

## 1. 현재 상태 요약

### 1.1 공통 인프라 (변경 금지)

| 구성 요소 | 값 | 비고 |
|-----------|-----|------|
| 고팡 메인 | hondi.net (Openhash-Gopang/gopang_v2) | GWP 허브 |
| Supabase | ebbecjfrwaswbdybbgiu.supabase.co | 공통 DB |
| Cloudflare Worker | gopang-proxy.tensor-city.workers.dev | AI 프록시·PDV 게이트웨이 |
| 고팡 SSO | hondi.net/auth/subsystem-auth.js | 모든 서브서비스 공용 |
| PDV 엔드포인트 | gopang-proxy.../pdv/report (POST) | 공통 PDV 기록 |
| AI 모델 | deepseek-chat (기본) | gopang-proxy/deepseek 경유 |

> ⚠️ **worker.js는 모든 서브서비스가 공유하는 단일 파일이다.** 수정 시 전 서비스에 영향. 반드시 변경 최소화, 수정 후 전 서비스 동작 확인 필수.

---

## 2. 서브서비스 완료 현황

### ✅ 완료 (인증 + PDV + 사이트 디자인 갱신)

| 시스템 | 도메인 | GitHub 레포 | 완료 항목 |
|--------|--------|-------------|----------|
| **K-Police** | police.hondi.net | Openhash-Gopang/police | 인증·PDV·디자인 |
| **K-Health** | health.hondi.net | Openhash-Gopang/health | 인증·PDV·디자인 |
| **K-School** | school.hondi.net | Openhash-Gopang/school | 인증·PDV(T2~T7)·디자인 |
| **K-Law** | klaw.hondi.net / openhash.kr/law | Openhash-Gopang/klaw | 인증·PDV·디자인 |
| **K-Market** | market.hondi.net | Openhash-Gopang/market | 인증·PDV·디자인 |
| **K-Traffic** | traffic.hondi.net | Openhash-Gopang/traffic | 인증·PDV·디자인 |

### ❌ 미완료 (작업 필요)

| 우선순위 | 시스템 | 예정 도메인 | 특이사항 |
|----------|--------|-------------|---------|
| 1 | **K-Tax** | tax.hondi.net | K-Market·K-School과 연동 예정 |
| 2 | **K-Finance** | finance.hondi.net | SEOM 디지털 화폐 연동 |
| 3 | **K-Labor** | labor.hondi.net | K-Tax 의존 |
| 4 | **K-Welfare** | welfare.hondi.net | K-Health·K-Labor 연동 |
| 5 | **K-Patent** | patent.hondi.net | K-Law 연동 |
| 6 | **K-Environment** | environment.hondi.net | |
| 7 | **K-Gov** | gov.hondi.net | 행정 민원 통합 |
| 8 | **K-Immigration** | immigration.hondi.net | |
| 9 | **K-Customs** | customs.hondi.net | K-Market 연동 |
| 10 | **K-Energy** | energy.hondi.net | K-Environment 연동 |
| 11 | **K-Defense** | defense.hondi.net | |
| 12 | **K-Diplomacy** | diplomacy.hondi.net | |

---

## 3. 완료 시스템에서 검증된 표준 패턴

아래 내용은 K-School T2~T7 테스트를 통해 확정된 **표준 구현 방식**이다. 모든 미완료 시스템에 동일하게 적용한다.

### 3.1 디렉토리 구조 표준

```
{service}.hondi.net/  (Openhash-Gopang/{service})
├── .nojekyll
├── CNAME                     → {service}.hondi.net
├── LICENSE                   → GPL-3.0
├── index.html                → 리디렉터 (PWA 진입점)
├── desktop.html              → 랜딩 페이지
├── webapp.html               → AI 채팅 앱 (PWA)
├── dashboard.html            → 서비스별 대시보드
├── config.js                 → Supabase·프록시 설정
├── css/
│   └── {service}.css
├── js/
│   ├── app.js                → 메인 로직
│   ├── auth.js               → SSO 보조 (선택)
│   └── report.js             → PDV 전송
├── data/
│   └── (서비스별 데이터 파일)
├── docs/
│   └── (백서, 매뉴얼)
└── prompts/
    └── system_prompt.txt     → AI 비서 시스템 프롬프트
```

---

## 4. 인증 프로세스 표준

### 4.1 구현 방법 (HTML 한 줄)

모든 서브서비스 `webapp.html` (및 `desktop.html`) 의 `</body>` 직전에 아래 한 줄만 추가:

```html
<script type="module"
  src="https://hondi.net/auth/subsystem-auth.js">
</script>
```

### 4.2 인증 완료 콜백

```javascript
// webapp.html 인라인 스크립트에 반드시 포함
window._onGopangAuth = async function(user) {
  // subsystem-auth.js가 인증 완료 시 이 함수를 호출
  // user: { guid, level, exp, via }
  _user = user;

  // 서비스별 초기화 (예시 — K-School 패턴)
  await initServiceDB(user);    // Supabase 프로필 조회
  await initPDV(user);          // PDV 모듈 초기화
  await initGWP(user);          // GWP 연동 초기화
  renderUserBadge(user);        // UI 갱신
};
```

### 4.3 인증 4가지 경로 (subsystem-auth.js 자동 처리)

| 경로 | 트리거 | 설명 |
|------|--------|------|
| 경로 2B | Silent iframe | hondi.net 세션 쿠키 자동 검증 — 가장 일반적 |
| 경로 2A | 세션 캐시 | localStorage 토큰 (30일 유효) |
| 경로 D | 게스트 | 비로그인, 열람 전용 |
| 경로 GWP | GWP 토큰 | hondi.net에서 GWP로 호출 시 자동 전달 |

### 4.4 인증 레벨 요구 설정

```javascript
// config.js 또는 app.js 상단
const REQUIRED_LEVEL = 'L0';  // 기본: L0 이상 누구나

// 특정 기능에 더 높은 레벨 요구 시
if (user.level < 'L3') {
  showUpgradePrompt();
  return;
}
```

---

## 5. PDV 저장 프로세스 표준

### 5.1 PDV 설계 원칙 (변경 불가)

```
원본 데이터  →  각 서비스 Supabase 테이블 ({service}_reports 등)
PDV 저장     →  6W 요약만 pdv_log에 저장 (원본 없음)
```

### 5.2 PDV 전송 코드 표준 (report.js)

```javascript
// 올바른 PDV 전송 패턴 (K-School T6에서 확정)
async function sendPDVReport(user_guid, reportData) {
  const res = await fetch(
    'https://gopang-proxy.tensor-city.workers.dev/pdv/report',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_guid: user_guid,
        source: '{service}',        // ← 서비스명 (tax, finance, labor...)
        report: {                   // ← 반드시 중첩 객체
          pdv_6w: {
            who:   '사용자명 (직군/나이)',
            what:  '핵심 처리 내용',
            when:  '처리 기간 (YYYY-MM-DD ~ YYYY-MM-DD)',
            where: '{service}.hondi.net',
            why:   '처리 목적',
            how:   '처리 방식 요약'
          },
          summary: { ...집계 데이터 },
          pdv_type: 'weekly_report'  // 또는 'monthly_report', 'event'
        }
      })
    }
  );

  const data = await res.json();
  return data.pdv_entry;  // "PDV-{guid}-{timestamp}"
}
```

### 5.3 절대 금지 패턴 (K-School T6 오류 교훈)

```javascript
// ❌ 금지: sbFetch()로 pdv_log 직접 INSERT
// → Prefer: resolution=merge-duplicates가 pdv_log에서 503 유발
await sbFetch('/rest/v1/pdv_log', { method: 'POST', body: ... });

// ✅ 허용: 직접 fetch로 Worker 경유
await fetch(PROXY_BASE + '/pdv/report', { method: 'POST', body: ... });

// ❌ 금지: flat JSON으로 PDV 전송
body: JSON.stringify({ user_guid, what: '...', when: '...' })

// ✅ 허용: 중첩 report 객체
body: JSON.stringify({ user_guid, source, report: { pdv_6w: {...} } })
```

### 5.4 Worker try-catch 필수 (공통 규칙)

```javascript
// worker.js의 모든 핸들러 — catch에도 corsHeaders 필수
async function handleXxx(request, corsHeaders) {
  try {
    // ... 처리 ...
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    // corsHeaders 누락 시 → 브라우저에서 CORS 오류로 오인됨
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: corsHeaders   // ← 필수
    });
  }
}
```

### 5.5 Supabase 원본 저장 패턴

```javascript
// 서비스 자체 DB에 원본 저장 (sbFetch 사용 가능)
async function saveToServiceDB(user_guid, reportData) {
  await sbFetch('/rest/v1/{service}_reports', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'      // pdv_log 아닌 경우 OK
    },
    body: JSON.stringify({
      user_guid,
      report_type: 'weekly',
      content: reportData,
      report_hash: await hashReport(reportData),  // SHA-256 중복 방지
    })
  });
}
```

---

## 6. 사이트 디자인 표준

### 6.1 디자인 시스템 (Supabase 계열)

완료된 6개 시스템이 공통으로 사용하는 디자인 시스템이다.

```css
/* 공통 CSS 변수 — 각 서비스의 --tint만 변경 */
:root {
  /* 배경 */
  --bg:            #F8F9FA;
  --bg-elevated:   #FFFFFF;
  --bg-subtle:     #F1F3F5;

  /* 텍스트 */
  --label:         #111827;
  --label-2:       #374151;
  --label-3:       #6B7280;
  --label-4:       #9CA3AF;

  /* 헤더·사이드바 */
  --header-bg:     #1A1F29;   /* Supabase 짙은 네이비 */
  --header-mid:    #1A1F29;

  /* 구분선 */
  --sep:           #E4E4E7;
  --sep-strong:    #D1D5DB;

  /* 버블 */
  --bubble-out-bg:   #ECFDF5;
  --bubble-out-text: #065F46;
  --bubble-in-bg:    #FFFFFF;
  --bubble-in-text:  #111827;

  /* 반경 */
  --r-sm: 4px;  --r-md: 6px;  --r-lg: 8px;  --r-xl: 12px;

  /* 폰트 */
  --font:       'Noto Sans KR', -apple-system, 'Helvetica Neue', sans-serif;
  --font-mono:  'IBM Plex Mono', 'SF Mono', monospace;

  /* ★ 서비스별 브랜드 색상 (아래 6.2 참조) */
  --tint:      #3ECF8E;   /* 기본: 고팡 초록 */
  --tint-dark: #29A374;
}
```

### 6.2 서비스별 브랜드 색상 (--tint)

완료 시스템과 미완료 시스템의 색상 배정이다.

| 시스템 | --tint | --tint-dark | 근거 |
|--------|--------|-------------|------|
| K-Police ✅ | `#1D4ED8` (파랑) | `#1E40AF` | 경찰 파랑 |
| K-Health ✅ | `#DC2626` (빨강) | `#B91C1C` | 의료 적십자 |
| K-School ✅ | `#3ECF8E` (초록) | `#29A374` | 성장·학습 |
| K-Law ✅ | `#003087` (정부 청색) | `#00236B` | 정부 공식색 |
| K-Market ✅ | `#EA580C` (주황) | `#C2410C` | 시장·거래 |
| K-Traffic ✅ | `#7C3AED` (보라) | `#6D28D9` | 교통 신호 |
| **K-Tax** ❌ | `#B45309` (황갈) | `#92400E` | 세금·재정 |
| **K-Finance** ❌ | `#0369A1` (하늘) | `#075985` | 금융·은행 |
| **K-Labor** ❌ | `#065F46` (짙은 초록) | `#064E3B` | 노동·고용 |
| **K-Welfare** ❌ | `#7E22CE` (자주) | `#6B21A8` | 복지·지원 |
| **K-Patent** ❌ | `#9F1239` (크랜베리) | `#881337` | 특허·지식재산 |
| **K-Environment** ❌ | `#166534` (산림 초록) | `#14532D` | 환경 |
| **K-Gov** ❌ | `#374151` (회색 계열) | `#1F2937` | 행정 |
| **K-Immigration** ❌ | `#1E3A5F` (남색) | `#172B45` | 출입국 |
| **K-Customs** ❌ | `#78350F` (갈색) | `#5C2C0A` | 세관·관세 |
| **K-Energy** ❌ | `#F59E0B` (노랑) | `#D97706` | 에너지 |
| **K-Defense** ❌ | `#4B5563` (군복) | `#374151` | 국방 |
| **K-Diplomacy** ❌ | `#1D4ED8` (파랑) | `#1E40AF` | 외교 (K-Police와 구분 위해 채도 조정) |

### 6.3 폰트 표준

```html
<!-- 모든 서비스 공통 Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet"/>
```

### 6.4 좌측 사이드바 구현 방식

완료 시스템들이 공통 사용하는 **hover 확장 사이드바** 패턴이다.

```css
/* 좌측 사이드바 — 기본 23px, hover 시 224px */
.sidebar {
  position: fixed;
  top: 0; left: 0; bottom: 0;
  width: 23px;                         /* 아이콘만 보임 */
  background: var(--header-bg);
  overflow: hidden;
  transition: width 0.25s ease;
  z-index: 200;
}
.sidebar:hover {
  width: 224px;                        /* 텍스트 포함 전체 표시 */
}

/* 사이드바 메뉴 항목 */
.sidebar-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  color: var(--label-on-dark);
  white-space: nowrap;
  cursor: pointer;
  border-radius: var(--r-md);
  transition: background 0.15s;
}
.sidebar-item:hover {
  background: var(--header-hover);
}
.sidebar-item .icon {
  flex-shrink: 0;
  width: 18px; height: 18px;
}
.sidebar-item .label {
  font-size: 13px;
  opacity: 0;
  transition: opacity 0.2s 0.05s;
}
.sidebar:hover .sidebar-item .label {
  opacity: 1;
}
```

```html
<!-- 사이드바 HTML 구조 (서비스별 메뉴 항목 교체) -->
<aside class="sidebar">
  <div class="sidebar-logo"><!-- 서비스 로고 --><!--/→ --></div>

  <nav class="sidebar-nav">
    <a class="sidebar-item" href="#overview">
      <svg class="icon"><!-- 아이콘 SVG --></svg>
      <span class="label">서비스 소개</span>
    </a>
    <a class="sidebar-item" href="#features">
      <svg class="icon"><!-- 아이콘 SVG --></svg>
      <span class="label">주요 기능</span>
    </a>
    <!-- 서비스별 항목 추가 -->
  </nav>

  <div class="sidebar-bottom">
    <a class="sidebar-item" href="https://hondi.net">
      <svg class="icon"><!-- 홈 아이콘 --></svg>
      <span class="label">고팡으로 돌아가기</span>
    </a>
  </div>
</aside>
```

### 6.5 상단 바 (top-bar) 표준

```css
.top-bar {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: calc(48px + var(--safe-top));
  padding-top: var(--safe-top);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--sep);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 14px; padding-right: 14px;
  z-index: 100;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
```

### 6.6 PWA 필수 메타태그

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
<meta name="apple-mobile-web-app-title" content="{서비스명}"/>
<meta name="theme-color" content="#1A1F29"/>
<link rel="manifest" href="/manifest.json"/>
```

---

## 7. 신규 서비스 구현 순서 (체크리스트)

미완료 시스템 하나를 구현할 때 아래 순서를 따른다.

### Step 1 — GitHub 레포 생성

```powershell
# 로컬 폴더 생성
mkdir {service}; cd {service}
git init
echo "school.hondi.net" | Out-File CNAME -Encoding utf8  # 도메인 교체

# .nojekyll (GitHub Pages Jekyll 비활성화)
New-Item .nojekyll

# 기본 파일 구조 생성
mkdir css, js, data, docs, prompts
```

### Step 2 — config.js 작성

```javascript
// js/config.js 또는 루트 config.js
const SUPA_URL  = 'https://ebbecjfrwaswbdybbgiu.supabase.co';
const SUPA_ANON = '{anon_key}';             // Supabase anon key
const HDR = { 'apikey': SUPA_ANON, 'Authorization': 'Bearer ' + SUPA_ANON };
const PROXY_BASE = 'https://gopang-proxy.tensor-city.workers.dev';
const SYSTEM_PROMPT_URL = '/prompts/system_prompt.txt';
```

### Step 3 — Supabase 테이블 생성

서비스별 테이블을 Supabase SQL Editor에서 생성한다.
K-School 패턴 참조:

```sql
-- 기본 구조 (테이블명만 교체)
CREATE TABLE {service}_profiles (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_guid UUID NOT NULL UNIQUE,
  ...
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE {service}_records (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_guid UUID REFERENCES {service}_profiles(user_guid),
  ...
);

CREATE TABLE {service}_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_guid   UUID REFERENCES {service}_profiles(user_guid),
  report_type TEXT CHECK (report_type IN ('weekly','monthly')),
  content     JSONB,
  report_hash TEXT UNIQUE,      -- SHA-256 중복 방지
  pdv_entry_id TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### Step 4 — system_prompt.txt 작성

```
# prompts/system_prompt.txt
당신은 {서비스명} AI 비서입니다.
[서비스 역할 정의]
[사용자 지원 범위]
[PDV 기록 안내]
[K-Law·K-Market 등 타 서비스 연동 시나리오]
```

### Step 5 — webapp.html 구현

K-Market 패턴 권장 — **올인원 단일 파일** (외부 JS 모듈 없음):
1. CSS: 6.1~6.4 디자인 표준 적용, `--tint`를 서비스 색상으로 교체
2. HTML: 좌측 사이드바 + 상단 바 + 채팅 영역
3. JS Block 1: config 인라인 + PDV 인라인 + AI callAI() 함수
4. JS Block 2: UI 핸들러 + `window._onGopangAuth` 콜백
5. `<script type="module" src="https://hondi.net/auth/subsystem-auth.js">`

### Step 6 — desktop.html 작성

랜딩 페이지 (K-School/K-Market 패턴):
- 히어로 섹션 (서비스 소개)
- 기존 방식 vs K-{Service} 비교표
- 주요 기능 카드 (4~6개)
- 동작 흐름도
- 좌측 사이드바 (hover 224px)
- webapp.html 진입 CTA

### Step 7 — 테스트 (T1~T7 체크리스트)

K-School T2~T7 결과에서 확정된 테스트 항목:

| 테스트 | 항목 | 확인 방법 |
|--------|------|----------|
| T1 | 랜딩 페이지 렌더링 | 브라우저 직접 확인 |
| T2 | 모바일 UI (375px) | Chrome DevTools |
| T3 | SSO 인증 (Silent iframe) | Console 로그 확인 |
| T4 | AI 채팅 (DeepSeek 응답) | webapp 대화 테스트 |
| T5 | Supabase INSERT | SQL Editor에서 수동 실행 |
| T6 | PDV 전송 | Console: `pdv_entry: PDV-...` 확인 |
| T7 | GWP 연동 | hondi.net에서 키워드 입력 |

### Step 8 — GWP_REGISTRY 등록

`gopang_v2/webapp.html` (또는 `app.js`)의 `GWP_REGISTRY`에 추가:

```javascript
// gopang_v2 GWP_REGISTRY에 추가
const GWP_REGISTRY = {
  // 기존 서비스들...
  '{service}': {
    url: 'https://{service}.hondi.net/webapp.html?gwp=1&ctx=',
    name: 'K-{Service}',
    keywords: ['키워드1', '키워드2', ...]
  }
};
```

### Step 9 — GitHub 업로드

```powershell
cd C:\Users\주피터\Downloads\{service}
git add -A
git commit -m "feat: K-{Service} v1.0 초기 구현
- 인증: gopang SSO (subsystem-auth.js)
- PDV: gopang-proxy/pdv/report 연동
- 디자인: Supabase 계열, --tint #{색상코드}"
git push origin main
```

---

## 8. 서비스별 우선순위 및 특이사항

### 8.1 K-Tax (우선순위 1)

```
특이사항:
- K-Market 구매 → K-Tax 자동 연동 (부가세 자동 계산)
- K-School 교육비 → K-Tax 교육비 공제 연동
- Supabase: tax_returns, tax_payments, tax_deductions 테이블
- AI 키워드: 세금, 부가세, 소득세, 종합소득세, 환급, 신고, 세무
- 브랜드색: #B45309 (황갈)
```

### 8.2 K-Finance (우선순위 2)

```
특이사항:
- SEOM (Sovereign Equity OpenHash Market) 디지털 화폐 연동 예정
- OpenHash 거래 증빙과 직접 연결
- Supabase: finance_accounts, finance_transactions, finance_reports
- AI 키워드: 대출, 투자, 계좌, 금리, 주식, 환율, 보험, 연금
- 브랜드색: #0369A1 (하늘)
```

### 8.3 K-Labor (우선순위 3)

```
특이사항:
- K-Tax 의존: 근로소득세 연동
- Supabase: labor_contracts, labor_disputes, labor_insurance
- AI 키워드: 근로계약, 임금체불, 4대보험, 퇴직금, 해고, 연차
- 브랜드색: #065F46 (짙은 초록)
```

### 8.4 K-Welfare (우선순위 4)

```
특이사항:
- K-Health + K-Labor 데이터 참조
- 복지 급여 자격 AI 심사
- AI 키워드: 복지, 지원금, 기초생활, 장애, 육아, 노인, 보조금
- 브랜드색: #7E22CE (자주)
```

### 8.5 K-Patent (우선순위 5)

```
특이사항:
- K-Law와 밀접 연동 (특허 분쟁 시 K-Law 자동 호출)
- KIPRIS 데이터베이스 연동 고려
- AI 키워드: 특허, 상표, 디자인권, 출원, 침해, 등록
- 브랜드색: #9F1239 (크랜베리)
```

---

## 9. 공통 주의사항 요약

1. **worker.js 수정 금지** — 필요 시 최소한의 변경만, 수정 후 전 서비스 테스트
2. **Supabase anon key 공개 주의** — RLS 미적용 테이블이 있으면 `.gitignore`에 `config.js` 추가
3. **GENERATED ALWAYS AS 컬럼** — INSERT 시 반드시 제외 (K-School 교훈)
4. **sbFetch vs 직접 fetch** — pdv_log는 직접 fetch만, 나머지는 sbFetch 가능
5. **report 중첩 구조** — PDV 전송 시 `{ user_guid, source, report: { pdv_6w: {...} } }` 형태 필수
6. **catch에 corsHeaders** — Worker 모든 핸들러의 catch 블록에 corsHeaders 포함
7. **서비스명 source 필드** — PDV 기록 시 `source: 'tax'` 등 명확한 서비스명 사용
8. **GWP 우선순위** — `gwpMatch()` 확인 후 AI 응답보다 먼저 실행

---

## 10. 참조 레포지토리

| 역할 | GitHub |
|------|--------|
| 고팡 메인 (GWP 허브) | Openhash-Gopang/gopang_v2 |
| K-School (표준 참조) | Openhash-Gopang/school |
| K-Market (올인원 참조) | Openhash-Gopang/market |
| K-Law | Openhash-Gopang/klaw |
| K-Police | Openhash-Gopang/police |
| K-Health | Openhash-Gopang/health |
| K-Traffic | Openhash-Gopang/traffic |
| Cloudflare Worker | (gopang-proxy — worker.js) |

---

*본 문서는 새 대화창에서 업무를 이어받는 개발자(AI 포함)를 위한 인수인계 지시서입니다.*  
*최종 업데이트: 2026-06-03 | AI City Inc. 팀 주피터*
