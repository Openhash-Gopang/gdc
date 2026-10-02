import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LIMITS, CODE, checkTransfer, checkLoan, monthlyPayment } from '../js/gdc-limits.js';

// 한도 규칙 단위 테스트. 시나리오 라운드(library/labs/rounds/r01)와 별개로,
// 규칙 자체의 불변식과 시나리오 파일과의 일치를 확인한다.

describe('LIMITS 불변식', () => {
  test('값은 동결되어 있고 서로 모순되지 않는다', () => {
    assert.ok(Object.isFrozen(LIMITS));
    assert.ok(LIMITS.newRecipientPerTx <= LIMITS.transferPerTx);
    assert.ok(LIMITS.transferPerTx <= LIMITS.outflowPerDay);
    assert.ok(LIMITS.loanPerLoan <= LIMITS.loanOutstandingTotal);
    assert.ok(LIMITS.dsrCap > 0 && LIMITS.dsrCap < 1);
  });
});

describe('checkTransfer', () => {
  test('경계값은 통과하고 +1은 거부된다', () => {
    assert.equal(checkTransfer({ amount: LIMITS.transferPerTx }).ok, true);
    assert.equal(checkTransfer({ amount: LIMITS.transferPerTx + 1 }).code, CODE.PER_TX_LIMIT);
  });
  test('1일 누적은 합이 상한과 같으면 통과, 넘으면 거부', () => {
    assert.equal(checkTransfer({ amount: 500, outflowToday: 1500 }).ok, true);
    assert.equal(checkTransfer({ amount: 501, outflowToday: 1500 }).code, CODE.DAILY_LIMIT);
  });
  test('NaN, Infinity, 문자열, null, 0, 음수는 모두 AMOUNT_INVALID', () => {
    for (const amount of [NaN, Infinity, -Infinity, '100', null, undefined, 0, -1]) {
      assert.equal(checkTransfer({ amount }).code, CODE.AMOUNT_INVALID, String(amount));
    }
  });
  test('처음 보내는 수취인은 소액만', () => {
    assert.equal(checkTransfer({ amount: 100, recipientKnown: false }).ok, true);
    assert.equal(checkTransfer({ amount: 101, recipientKnown: false }).code, CODE.NEW_RECIPIENT_LIMIT);
  });
});

describe('checkLoan', () => {
  const base = { principal: 1000, outstanding: 0, annualRate: 0.015, annualIncome: 5000, equity: 5000 };
  test('정상 대출은 통과하고 DSR을 돌려준다', () => {
    const r = checkLoan(base);
    assert.equal(r.ok, true);
    assert.ok(r.dsr > 0 && r.dsr < LIMITS.dsrCap);
  });
  test('순자산이 없거나 음수이면 거부된다', () => {
    assert.equal(checkLoan({ ...base, equity: 0 }).code, CODE.LOAN_EQUITY_LIMIT);
    assert.equal(checkLoan({ ...base, equity: -100 }).code, CODE.LOAN_EQUITY_LIMIT);
  });
  test('기존 상환액이 DSR에 더해진다', () => {
    assert.equal(checkLoan(base).ok, true);
    assert.equal(checkLoan({ ...base, existingAnnualDebtService: 5000 }).code, CODE.DSR_EXCEEDED);
  });
  test('원리금균등 월상환액: 금리 0이면 원금/개월수, 양수면 그보다 크다', () => {
    assert.equal(monthlyPayment(1200, 0, 12), 100);
    assert.ok(monthlyPayment(1200, 0.06, 12) > 100);
  });
});

describe('R01 시나리오 파일과의 일치', () => {
  test('transfer / loan_limit 시나리오의 expected가 기준 구현과 같다', async () => {
    const spec = JSON.parse(await readFile(new URL('../library/labs/rounds/r01/scenarios.json', import.meta.url), 'utf8'));
    let n = 0;
    for (const s of spec.scenarios) {
      if (s.kind !== 'transfer' && s.kind !== 'loan_limit') continue;
      const actual = s.kind === 'transfer' ? checkTransfer(s.inputs) : checkLoan(s.inputs);
      assert.equal(actual.ok, s.expected.ok, s.id);
      assert.equal(actual.code, s.expected.code, s.id);
      n++;
    }
    assert.ok(n >= 20, '한도 시나리오 수가 줄었다: ' + n);
  });
});
