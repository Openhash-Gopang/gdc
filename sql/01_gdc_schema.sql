-- ══════════════════════════════════════════════════════════════
-- GDC 은행 모듈 — Supabase PostgreSQL 스키마 v1.0
-- 저장소: Openhash-Gopang/gdc
-- 주의: user_profiles, fs_ledger, pdv_log 는 gopang DB 공유
-- ══════════════════════════════════════════════════════════════

-- ── 1. 사용자 공개키 등록 ────────────────────────────────────
CREATE TABLE IF NOT EXISTS gdc_keys (
  id            BIGSERIAL PRIMARY KEY,
  user_guid     TEXT        NOT NULL UNIQUE,       -- user_profiles.guid 참조
  public_key    TEXT        NOT NULL,              -- ED25519 공개키 (base64)
  key_version   INTEGER     NOT NULL DEFAULT 1,    -- 키 교체 횟수
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at    TIMESTAMPTZ,                       -- 키 폐기 시각
  CONSTRAINT fk_user FOREIGN KEY (user_guid)
    REFERENCES user_profiles(guid) ON DELETE CASCADE
);

CREATE INDEX idx_gdc_keys_guid ON gdc_keys(user_guid);

-- ── 2. 예금 계좌 ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gdc_deposits (
  id              BIGSERIAL PRIMARY KEY,
  account_id      TEXT        NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  user_guid       TEXT        NOT NULL,
  product_type    TEXT        NOT NULL DEFAULT 'demand',
    -- demand: 요구불(언제든 출금)
    -- time_7:  7일 정기
    -- time_30: 30일 정기
    -- time_365: 365일 정기
  principal       NUMERIC(20,4) NOT NULL DEFAULT 0,   -- 원금 (₮)
  interest_rate   NUMERIC(6,4)  NOT NULL DEFAULT 0.05, -- 연이율 (기본 5%)
  accrued_interest NUMERIC(20,4) NOT NULL DEFAULT 0,  -- 누적 이자
  maturity_date   DATE,                               -- 정기 예금 만기일
  status          TEXT        NOT NULL DEFAULT 'active',
    -- active | matured | closed
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at       TIMESTAMPTZ,
  last_interest_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_dep_user FOREIGN KEY (user_guid)
    REFERENCES user_profiles(guid) ON DELETE CASCADE
);

CREATE INDEX idx_gdc_dep_user ON gdc_deposits(user_guid);
CREATE INDEX idx_gdc_dep_status ON gdc_deposits(status);

-- ── 3. 대출 계좌 ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gdc_loans (
  id              BIGSERIAL PRIMARY KEY,
  loan_id         TEXT        NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  user_guid       TEXT        NOT NULL,
  principal       NUMERIC(20,4) NOT NULL,           -- 대출 원금 (₮)
  outstanding     NUMERIC(20,4) NOT NULL,           -- 잔여 원금
  interest_rate   NUMERIC(6,4)  NOT NULL,           -- 연이율 (신용등급별)
  credit_score    INTEGER       NOT NULL,           -- 대출 시점 신용점수
  credit_grade    TEXT          NOT NULL,           -- AAA | AA | A | BBB | BB | C
  repay_method    TEXT          NOT NULL DEFAULT 'equal_payment',
    -- equal_payment: 원리금균등
    -- equal_principal: 원금균등
    -- bullet: 만기일시
  monthly_payment NUMERIC(20,4),                   -- 월 상환액
  term_months     INTEGER       NOT NULL,           -- 대출 기간(월)
  remaining_months INTEGER      NOT NULL,           -- 잔여 기간
  status          TEXT          NOT NULL DEFAULT 'active',
    -- active | repaid | overdue | default
  disbursed_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  maturity_date   DATE          NOT NULL,
  last_payment_at TIMESTAMPTZ,
  overdue_days    INTEGER       NOT NULL DEFAULT 0,
  CONSTRAINT fk_loan_user FOREIGN KEY (user_guid)
    REFERENCES user_profiles(guid) ON DELETE CASCADE
);

CREATE INDEX idx_gdc_loans_user ON gdc_loans(user_guid);
CREATE INDEX idx_gdc_loans_status ON gdc_loans(status);

-- ── 4. 대출 상환 내역 ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gdc_loan_payments (
  id          BIGSERIAL PRIMARY KEY,
  loan_id     TEXT          NOT NULL,
  user_guid   TEXT          NOT NULL,
  payment_seq INTEGER       NOT NULL,              -- 회차
  principal   NUMERIC(20,4) NOT NULL,              -- 원금 상환액
  interest    NUMERIC(20,4) NOT NULL,              -- 이자 상환액
  total       NUMERIC(20,4) NOT NULL,              -- 합계
  paid_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  tx_id       TEXT,                                -- fs_ledger 연동
  CONSTRAINT fk_lp_loan FOREIGN KEY (loan_id)
    REFERENCES gdc_loans(loan_id)
);

CREATE INDEX idx_gdc_lp_loan ON gdc_loan_payments(loan_id);

-- ── 5. FIAT POOL ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gdc_pool (
  id              BIGSERIAL PRIMARY KEY,
  currency_code   TEXT          NOT NULL UNIQUE,   -- KRW, USD, EUR, JPY …
  currency_name   TEXT          NOT NULL,
  total_deposited NUMERIC(30,4) NOT NULL DEFAULT 0, -- 총 납입액 (법정화폐 단위)
  reserve_ratio   NUMERIC(5,4)  NOT NULL DEFAULT 0.20, -- 지불준비율 20%
  reserve_amount  NUMERIC(30,4) NOT NULL DEFAULT 0,
  invested_amount NUMERIC(30,4) NOT NULL DEFAULT 0,
  gdc_issued      NUMERIC(30,4) NOT NULL DEFAULT 0, -- 발행된 GDC 총량
  gdc_base_rate   NUMERIC(10,4) NOT NULL DEFAULT 1000, -- GDC 1₮ = {rate} 법정화폐
  last_updated    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 기본 통화 풀 초기화
INSERT INTO gdc_pool (currency_code, currency_name) VALUES
  ('KRW', '대한민국 원'),
  ('USD', '미국 달러'),
  ('EUR', '유럽 유로'),
  ('JPY', '일본 엔'),
  ('CNY', '중국 위안'),
  ('GBP', '영국 파운드')
ON CONFLICT (currency_code) DO NOTHING;

-- ── 6. 실시간 환율 캐시 ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS gdc_fx_rates (
  id            BIGSERIAL PRIMARY KEY,
  base_currency TEXT          NOT NULL,            -- 기준 통화
  quote_currency TEXT         NOT NULL,            -- 상대 통화
  rate          NUMERIC(20,8) NOT NULL,            -- 환율
  source        TEXT          NOT NULL DEFAULT 'openexchangerates',
  fetched_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (base_currency, quote_currency)
);

CREATE INDEX idx_gdc_fx_pair ON gdc_fx_rates(base_currency, quote_currency);

-- ── 7. 투자 포트폴리오 ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS gdc_investments (
  id              BIGSERIAL PRIMARY KEY,
  invest_id       TEXT          NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  user_guid       TEXT          NOT NULL,
  product_code    TEXT          NOT NULL,
    -- KR_GROWTH_FUND: 국민성장펀드
    -- KR_KOSPI200:    코스피200 ETF
    -- US_SP500:       S&P500 ETF
    -- UK_FTSE100:     FTSE100 ETF
    -- JP_NIKKEI:      닛케이 ETF
  product_name    TEXT          NOT NULL,
  amount_gdc      NUMERIC(20,4) NOT NULL,           -- 투자 금액 (₮)
  units           NUMERIC(20,8) NOT NULL,           -- 보유 좌수
  nav_at_buy      NUMERIC(20,8) NOT NULL,           -- 매입 기준가
  nav_current     NUMERIC(20,8) NOT NULL DEFAULT 0, -- 현재 기준가
  return_rate     NUMERIC(8,4)  NOT NULL DEFAULT 0, -- 수익률 (%)
  status          TEXT          NOT NULL DEFAULT 'active',
  invested_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  redeemed_at     TIMESTAMPTZ,
  CONSTRAINT fk_inv_user FOREIGN KEY (user_guid)
    REFERENCES user_profiles(guid) ON DELETE CASCADE
);

CREATE INDEX idx_gdc_inv_user ON gdc_investments(user_guid);

-- ── 8. 이체 서명 검증 로그 ───────────────────────────────────
CREATE TABLE IF NOT EXISTS gdc_signatures (
  id          BIGSERIAL PRIMARY KEY,
  tx_id       TEXT          NOT NULL UNIQUE,        -- fs_ledger.tx_id 연동
  user_guid   TEXT          NOT NULL,               -- 서명자
  public_key  TEXT          NOT NULL,               -- 서명 시점 공개키
  signature   TEXT          NOT NULL,               -- ED25519 서명 (base64)
  message_hash TEXT         NOT NULL,               -- 서명 대상 해시
  verified    BOOLEAN       NOT NULL DEFAULT FALSE,
  signed_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

CREATE INDEX idx_gdc_sig_tx ON gdc_signatures(tx_id);
CREATE INDEX idx_gdc_sig_user ON gdc_signatures(user_guid);

-- ── 9. 신용평가 이력 ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gdc_credit_history (
  id            BIGSERIAL PRIMARY KEY,
  user_guid     TEXT          NOT NULL,
  credit_score  INTEGER       NOT NULL,             -- 0~1000
  credit_grade  TEXT          NOT NULL,             -- AAA~C
  loan_rate     NUMERIC(6,4)  NOT NULL,             -- 적용 대출금리
  liquidity_ratio NUMERIC(10,4),                   -- 유동비율
  debt_ratio    NUMERIC(10,4),                     -- 부채비율
  op_margin     NUMERIC(10,4),                     -- 영업이익률
  cf_ratio      NUMERIC(10,4),                     -- 현금흐름비율
  evaluated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gdc_credit_user ON gdc_credit_history(user_guid);
