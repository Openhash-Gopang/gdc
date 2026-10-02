import { test, describe, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ─────────────────────────────────────────────────────────────
// 1) src/gdc/currencyPool.js — 사용자 간 환전 매칭 (비custodial)
// ─────────────────────────────────────────────────────────────
import {
  postExchangeOrder, cancelOrder, matchOrders, confirmSettlement,
  getOrder, getMatch, getOpenOrders, _resetExchange, ORDER_STATUS,
} from '../src/gdc/currencyPool.js';

describe('currencyPool.js v2 — 매칭 중개 (자금 미보유)', () => {
  beforeEach(() => _resetExchange());

  test('정확히 반대로 맞는 두 주문은 매칭된다', () => {
    postExchangeOrder('u1', 'KRW', 130000, 'USD', 100);
    postExchangeOrder('u2', 'USD', 100, 'KRW', 130000);
    const matches = matchOrders();
    assert.equal(matches.length, 1);
    assert.equal(matches[0].userA, 'u1');
    assert.equal(matches[0].userB, 'u2');
    assert.equal(getOpenOrders().length, 0); // 둘 다 MATCHED로 빠짐
  });

  test('금액이 안 맞으면 매칭되지 않는다', () => {
    postExchangeOrder('u1', 'KRW', 130000, 'USD', 100);
    postExchangeOrder('u2', 'USD', 100, 'KRW', 125000); // 5000원 차이
    const matches = matchOrders();
    assert.equal(matches.length, 0);
    assert.equal(getOpenOrders().length, 2);
  });

  test('같은 사용자의 주문끼리는 매칭되지 않는다(자전거래 방지)', () => {
    postExchangeOrder('u1', 'KRW', 130000, 'USD', 100);
    postExchangeOrder('u1', 'USD', 100, 'KRW', 130000);
    const matches = matchOrders();
    assert.equal(matches.length, 0);
  });

  test('매칭 결과에 플랫폼 보유 자금/풀 잔액 개념이 전혀 없다 — 소개 정보만 존재', () => {
    postExchangeOrder('u1', 'KRW', 130000, 'USD', 100);
    postExchangeOrder('u2', 'USD', 100, 'KRW', 130000);
    const [m] = matchOrders();
    // aGives/bGives는 "누가 무엇을 줘야 하는지" 정보일 뿐, 실제 자금은
    // 플랫폼을 거치지 않는다 — 이 객체에 poolBalance/fee 같은 필드가 없어야 함.
    assert.equal('poolBalance' in m, false);
    assert.equal('fee' in m, false);
    assert.deepEqual(m.aGives, { currency: 'KRW', amount: 130000 });
    assert.deepEqual(m.bGives, { currency: 'USD', amount: 100 });
  });

  test('양쪽 당사자가 모두 확인해야 SETTLED', () => {
    postExchangeOrder('u1', 'KRW', 130000, 'USD', 100);
    postExchangeOrder('u2', 'USD', 100, 'KRW', 130000);
    const [m] = matchOrders();
    const r1 = confirmSettlement(m.matchId, 'u1');
    assert.equal(r1.status, 'MATCHED');
    const r2 = confirmSettlement(m.matchId, 'u2');
    assert.equal(r2.status, 'SETTLED');
  });

  test('매칭 당사자가 아니면 정산 확인 불가', () => {
    postExchangeOrder('u1', 'KRW', 130000, 'USD', 100);
    postExchangeOrder('u2', 'USD', 100, 'KRW', 130000);
    const [m] = matchOrders();
    const r = confirmSettlement(m.matchId, 'u3');
    assert.equal(r.success, false);
  });

  test('본인 주문만 취소 가능', () => {
    const o = postExchangeOrder('u1', 'KRW', 130000, 'USD', 100);
    const r = cancelOrder(o.orderId, 'u2');
    assert.equal(r.success, false);
    assert.equal(getOrder(o.orderId).status, ORDER_STATUS.OPEN);
  });

  test('동일 통화 주문은 거부', () => {
    assert.throws(() => postExchangeOrder('u1', 'KRW', 1000, 'KRW', 1000));
  });

  test('비양수 금액은 거부', () => {
    assert.throws(() => postExchangeOrder('u1', 'KRW', 0, 'USD', 100));
  });
});

// ─────────────────────────────────────────────────────────────
// 2) js/gdc-bank.js — 무이자 예치·보관 (loan/interest 제거 확인 포함)
// ─────────────────────────────────────────────────────────────
// 2026-10-03 갱신(P1): 이 블록은 2026-07-18 LEGAL-HOLD 상태(대출 export 없음,
// evaluateCredit 항상 실패)를 단언하고 있었는데, 2026-09-06 필드테스트 승인으로
// 코드가 바뀌고도 테스트가 따라가지 못해 실패 중이었다. 현재 승인 범위
// (대출·신용평가는 필드테스터 한정, 예금 이자 지급은 계속 보류)로 다시 썼다.
describe('gdc-bank.js — 필드테스트 승인 범위', () => {
  test('예금 이자 지급(accrueInterest)은 여전히 export되지 않는다', async () => {
    const mod = await import('../js/gdc-bank.js');
    assert.equal(mod.accrueInterest, undefined);
  });
  test('예치와 대출 함수는 export된다 (대출은 서버가 필드테스터로 게이트)', async () => {
    const mod = await import('../js/gdc-bank.js');
    for (const name of ['openDeposit', 'listDeposits', 'closeDeposit', 'applyLoan', 'repayLoan']) {
      assert.equal(typeof mod[name], 'function', name);
    }
  });
  test('applyLoan은 지갑 미초기화 상태에서 서버를 부르기 전에 실패한다', async () => {
    const { applyLoan } = await import('../js/gdc-bank.js');
    const savedWindow = global.window;
    global.window = {};
    try {
      await assert.rejects(() => applyLoan({ userGuid: 'u1', principal: 100 }), /지갑 미초기화/);
      await assert.rejects(() => applyLoan({ userGuid: 'u1', principal: 0 }), /0보다 커야/);
    } finally {
      if (savedWindow === undefined) delete global.window; else global.window = savedWindow;
    }
  });
});

describe('gdc-credit.js / gdc-pool.js — 승인 범위 확인', () => {
  test('evaluateCredit()는 필드테스터가 아니면 값을 돌려주지 않고 TESTER_ONLY로 실패한다', async () => {
    const { evaluateCredit } = await import('../js/gdc-credit.js');
    const savedFetch = global.fetch;
    global.fetch = async () => ({ ok: false, status: 404, json: async () => ({ ok: false }) });
    try {
      await assert.rejects(() => evaluateCredit('non-tester-guid'), /TESTER_ONLY/);
      await assert.rejects(() => evaluateCredit(), /userGuid 필수/);
    } finally {
      global.fetch = savedFetch;
    }
  });
  test('depositToPool()도 명시적으로 실패한다', async () => {
    const { depositToPool } = await import('../js/gdc-pool.js');
    await assert.rejects(() => depositToPool(), /LEGAL-HOLD|법적 검토/);
  });
});
