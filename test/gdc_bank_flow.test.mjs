import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

// gdc-bank.js -> gdc-core.js의 transfer()는 브라우저 전역(window.gopangWallet,
// fetch)에 의존한다. Node 테스트 환경이라 최소한으로 흉내낸다
// (지시서 §1.3: LLM/네트워크 호출 지점은 mock으로 결정론적 테스트).

let capturedRequests = [];

function installMocks() {
  capturedRequests = [];

  global.window = {
    gopangWallet: {
      guid: 'user-guid-1',
      sign: async ({ outputs }) => ({
        tx: { outputs }, tx_hash: 'mocked-tx-hash-abc',
        buyer_sig: 'sig', buyer_public_key: 'pub', prev_settle_hash: null,
      }),
      redeemClaim: async () => {},
    },
  };

  // global.crypto는 Node 내장 getter라 재할당 불가 — randomUUID는
  // 이미 Node 표준으로 존재하므로 별도 스텁 불필요.

  global.fetch = async (url, opts) => {
    const u = String(url);
    capturedRequests.push({ url: u, opts, body: opts?.body ? JSON.parse(opts.body) : null });

    if (u.includes('/biz/balance')) {
      return { ok: true, json: async () => ({ ok: true, balance: 50000 }) };
    }
    if (u.includes('/biz/order')) {
      return {
        ok: true,
        json: async () => ({
          ok: true, tx_hash: 'mocked-tx-hash-abc', block_hash: 'block-1',
          buyer_claim: null,
        }),
      };
    }
    if (u.includes('/biz/gdc-deposit') && !u.includes('gdc-deposits')) {
      return { ok: true, json: async () => ({ ok: true, id: 'dep-1' }) };
    }
    if (u.includes('/biz/gdc-deposits')) {
      return { ok: true, json: async () => ({ ok: true, items: [{ id: 'dep-1', principal: 10000, interest_rate: 0 }] }) };
    }
    if (u.includes('/pdv/report')) {
      return { ok: true, json: async () => ({ ok: true }) };
    }
    throw new Error('예상치 못한 fetch 호출: ' + u);
  };
}

describe('gdc-bank.js openDeposit() 실제 흐름 (fetch/wallet mock)', () => {
  before(installMocks);

  test('요청 payload의 interest_rate가 항상 0으로 강제된다', async () => {
    const { openDeposit } = await import('../js/gdc-bank.js?t=' + Date.now());
    const result = await openDeposit({ userGuid: 'user-guid-1', amount: 10000, productType: 'time_365' });

    const depositReq = capturedRequests.find(r => r.url.includes('/biz/gdc-deposit') && !r.url.includes('gdc-deposits'));
    assert.ok(depositReq, '예치 등록 요청이 전송되어야 함');
    assert.equal(depositReq.body.interest_rate, 0,
      'productType=time_365(원래 연 6.5%)을 선택해도 서버에는 0으로 전송되어야 함');
    assert.equal(result.rate, 0);
  });

  test('예치 전 실제 GDC 이체(/biz/order)가 먼저 일어난다', async () => {
    const orderReq = capturedRequests.find(r => r.url.includes('/biz/order'));
    assert.ok(orderReq, '이체 요청이 있어야 함');
    assert.equal(orderReq.body.seller_guid, 'gdc-deposit-vault');
  });

  test('최소 예치금(₮1,000) 미만은 거부', async () => {
    const { openDeposit } = await import('../js/gdc-bank.js?t=' + Date.now());
    await assert.rejects(() => openDeposit({ userGuid: 'user-guid-1', amount: 500 }), /최소 예치금/);
  });

  test('listDeposits가 서버 목록을 그대로 반환', async () => {
    const { listDeposits } = await import('../js/gdc-bank.js?t=' + Date.now());
    const items = await listDeposits('user-guid-1');
    assert.equal(items.length, 1);
    assert.equal(items[0].interest_rate, 0);
  });
});
