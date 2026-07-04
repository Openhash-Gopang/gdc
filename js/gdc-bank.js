// ══════════════════════════════════════════════════════════════
// gdc-bank.js — GDC 예금·대출·이자 모듈
// ══════════════════════════════════════════════════════════════

import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { getBalance, settleLedger, _pdvViaWorker, _ledger } from './gdc-core.js';
import { evaluateCredit } from './gdc-credit.js';

const H = {
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json',
};

// 예금 금리 테이블
const DEPOSIT_RATES = {
  demand:   0.030,  // 요구불 연 3.0%
  time_7:   0.040,  // 7일 정기 연 4.0%
  time_30:  0.050,  // 30일 정기 연 5.0%
  time_365: 0.065,  // 365일 정기 연 6.5%
};

// ── 예금 개설 ─────────────────────────────────────────────────
export async function openDeposit({ userGuid, amount, productType = 'demand' }) {
  if (amount < 1000) throw new Error('최소 예치금은 ₮1,000 입니다.');

  const balance = await getBalance(userGuid);
  if (balance < amount) throw new Error(`잔액 부족: 보유 ₮${balance.toLocaleString()}`);

  const rate     = DEPOSIT_RATES[productType] || DEPOSIT_RATES.demand;
  const maturity = productType === 'time_7'   ? _addDays(7)
                 : productType === 'time_30'  ? _addDays(30)
                 : productType === 'time_365' ? _addDays(365)
                 : null;

  // 예금 계좌 생성
  const res = await fetch(`${SUPABASE_URL}/rest/v1/gdc_deposits`, {
    method: 'POST',
    headers: { ...H, 'Prefer': 'return=representation' },
    body: JSON.stringify({
      user_guid: userGuid, product_type: productType,
      principal: amount, interest_rate: rate,
      maturity_date: maturity?.toISOString().slice(0,10),
    })
  });
  const dep = (await res.json())[0];

  // 잔액 차감 (예금으로 이동)
  await _updateBalance(userGuid, -amount);

  // PDV 기록
  await _pdv(userGuid, 'gdc_deposit', `예금 개설 ₮${amount.toLocaleString()} (${_productLabel(productType)})`,
    { accountId: dep.account_id, amount, productType, rate, maturityDate: maturity });

  return dep;
}

// ── 이자 지급 (일별 자동 실행) ───────────────────────────────
export async function accrueInterest() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/gdc_deposits?status=eq.active&select=*`,
    { headers: H }
  );
  const deposits = await res.json();
  let totalPaid = 0;

  for (const dep of deposits) {
    const dailyRate    = dep.interest_rate / 365;
    const dailyInterest = Math.round(dep.principal * dailyRate * 10000) / 10000;
    if (dailyInterest <= 0) continue;

    // 이자 지급: 잔액에 가산
    await _updateBalance(dep.user_guid, dailyInterest);

    // 예금 계좌 누적 이자 업데이트
    await fetch(`${SUPABASE_URL}/rest/v1/gdc_deposits?account_id=eq.${dep.account_id}`, {
      method: 'PATCH', headers: H,
      body: JSON.stringify({
        accrued_interest: +dep.accrued_interest + dailyInterest,
        last_interest_at: new Date().toISOString(),
      })
    });

    // fs_ledger 이자 대변
    const txId = crypto.randomUUID();
    await fetch(`${SUPABASE_URL}/rest/v1/fs_ledger`, {
      method: 'POST', headers: { ...H, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        tx_id: txId, guid: dep.user_guid, counterpart: 'gdc-bank',
        direction: 'credit', amount: dailyInterest,
        item_name: '예금 이자', fs_account: 'pl-interest_income',
        source: 'gdc',
        memo: `${dep.account_id.slice(0,8)}… 일일 이자`, tx_at: new Date().toISOString(),
      })
    });
    totalPaid += dailyInterest;
  }
  return { processedCount: deposits.length, totalInterestPaid: totalPaid };
}

// ── 대출 신청 ─────────────────────────────────────────────────
export async function applyLoan({ userGuid, amount, termMonths, repayMethod = 'equal_payment' }) {
  // 신용 평가 (0.1초)
  const credit = await evaluateCredit(userGuid);

  if (amount > credit.maxLoanAmount) {
    throw new Error(
      `대출 한도 초과. 최대 ₮${credit.maxLoanAmount.toLocaleString()} (신용등급 ${credit.grade})`
    );
  }

  const rate          = credit.loanRate;
  const monthlyRate   = rate / 12;
  const maturityDate  = _addDays(termMonths * 30);
  let   monthlyPayment = 0;

  if (repayMethod === 'equal_payment' && monthlyRate > 0) {
    // 원리금균등 공식: P × r(1+r)^n / ((1+r)^n - 1)
    const factor = Math.pow(1 + monthlyRate, termMonths);
    monthlyPayment = Math.round(amount * monthlyRate * factor / (factor - 1) * 100) / 100;
  }

  // 대출 계좌 생성
  const res = await fetch(`${SUPABASE_URL}/rest/v1/gdc_loans`, {
    method: 'POST',
    headers: { ...H, 'Prefer': 'return=representation' },
    body: JSON.stringify({
      user_guid: userGuid, principal: amount, outstanding: amount,
      interest_rate: rate, credit_score: credit.creditScore,
      credit_grade: credit.grade, repay_method: repayMethod,
      monthly_payment: monthlyPayment, term_months: termMonths,
      remaining_months: termMonths,
      maturity_date: maturityDate.toISOString().slice(0,10),
    })
  });
  const loan = (await res.json())[0];

  // 대출 실행: 잔액 가산
  await _updateBalance(userGuid, amount);

  // fs_ledger 대출 대변
  const txId = crypto.randomUUID();
  await fetch(`${SUPABASE_URL}/rest/v1/fs_ledger`, {
    method: 'POST', headers: { ...H, 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      tx_id: txId, guid: userGuid, counterpart: 'gdc-bank',
      direction: 'credit', amount, item_name: 'GDC 대출 실행',
      fs_account: 'bs-loan',
      source: 'gdc', memo: `대출 ${loan.loan_id.slice(0,8)}…`,
      tx_at: new Date().toISOString(),
    })
  });

  // PDV 기록
  await _pdv(userGuid, 'gdc_loan', `대출 실행 ₮${amount.toLocaleString()} (${termMonths}개월, 연${(rate*100).toFixed(1)}%)`,
    { loanId: loan.loan_id, amount, termMonths, rate, grade: credit.grade,
      monthlyPayment, creditScore: credit.creditScore });

  await settleLedger(userGuid);
  return { loan, credit };
}

// ── 대출 상환 ─────────────────────────────────────────────────
export async function repayLoan({ userGuid, loanId, paymentSeq }) {
  const res   = await fetch(
    `${SUPABASE_URL}/rest/v1/gdc_loans?loan_id=eq.${loanId}&user_guid=eq.${userGuid}&limit=1`,
    { headers: H }
  );
  const loans = await res.json();
  const loan  = loans[0];
  if (!loan) throw new Error('대출 계좌를 찾을 수 없습니다.');
  if (loan.status !== 'active') throw new Error('이미 상환 완료된 대출입니다.');

  const monthlyRate = loan.interest_rate / 12;
  const interest    = Math.round(loan.outstanding * monthlyRate * 100) / 100;
  const principal   = Math.round((loan.monthly_payment - interest) * 100) / 100;
  const total       = loan.monthly_payment;
  const balance     = await getBalance(userGuid);

  if (balance < total) throw new Error(`잔액 부족: 상환액 ₮${total.toLocaleString()}`);

  const newOutstanding    = Math.max(0, loan.outstanding - principal);
  const newRemainingMonths = loan.remaining_months - 1;
  const newStatus         = newRemainingMonths <= 0 ? 'repaid' : 'active';
  const txId              = crypto.randomUUID();

  // 잔액 차감
  await _updateBalance(userGuid, -total);

  // 대출 잔액 업데이트
  await fetch(`${SUPABASE_URL}/rest/v1/gdc_loans?loan_id=eq.${loanId}`, {
    method: 'PATCH', headers: H,
    body: JSON.stringify({
      outstanding: newOutstanding, remaining_months: newRemainingMonths,
      status: newStatus, last_payment_at: new Date().toISOString(),
    })
  });

  // 상환 내역 기록
  await fetch(`${SUPABASE_URL}/rest/v1/gdc_loan_payments`, {
    method: 'POST', headers: { ...H, 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      loan_id: loanId, user_guid: userGuid, payment_seq: paymentSeq,
      principal, interest, total: total, paid_at: new Date().toISOString(), tx_id: txId,
    })
  });

  // fs_ledger 차변
  await fetch(`${SUPABASE_URL}/rest/v1/fs_ledger`, {
    method: 'POST', headers: { ...H, 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      tx_id: txId, guid: userGuid, counterpart: 'gdc-bank',
      direction: 'debit', amount: total, item_name: `대출 상환 ${paymentSeq}회차`,
      fs_account: 'pl-loan_repayment',
      source: 'gdc', memo: loanId.slice(0,8)+'…',
      tx_at: new Date().toISOString(),
    })
  });

  await _pdv(userGuid, 'gdc_loan_repay',
    `대출 상환 ${paymentSeq}회차 ₮${total.toLocaleString()} (원금 ₮${principal.toLocaleString()} / 이자 ₮${interest.toLocaleString()})`,
    { loanId, paymentSeq, principal, interest, total, remaining: newOutstanding });

  await settleLedger(userGuid);
  return { loanId, paymentSeq, principal, interest, total,
           remaining: newOutstanding, status: newStatus };
}

// ── 내부 유틸 ─────────────────────────────────────────────────
function _addDays(days) {
  const d = new Date(); d.setDate(d.getDate() + days); return d;
}
function _productLabel(t) {
  return { demand:'요구불', time_7:'7일 정기', time_30:'30일 정기', time_365:'365일 정기' }[t] || t;
}
async function _pdv(userGuid, recordType, summary, extra) {
  return _pdvViaWorker({
    ipv6:      userGuid,
    sessionId: extra?.txId || extra?.loanId || extra?.accountId || null,
    summary,
    what:      summary.split(' ')[0],
    how:       'GDC 자동',
    why:       '은행 거래',
    svc:       'kgdc',
  });
}



