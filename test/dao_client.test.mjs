import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

describe('src/gdc/dao.js (v2, 서버 연동 클라이언트)', () => {
  let createProposal, vote, getProposal, listProposals;
  let requests;

  before(async () => {
    requests = [];
    global.fetch = async (url, opts) => {
      const u = String(url);
      requests.push({ url: u, body: opts?.body ? JSON.parse(opts.body) : null });
      if (u.includes('/biz/gdc-dao/proposals')) {
        return { ok: true, json: async () => ({ ok: true, items: [{ proposalId: 'prop_x', status: 'ACTIVE' }] }) };
      }
      if (u.includes('/biz/gdc-dao/proposal')) {
        return { ok: true, json: async () => ({ ok: true, proposal: { proposalId: 'prop_x', title: 't' } }) };
      }
      if (u.includes('/biz/gdc-dao/vote')) {
        return { ok: true, json: async () => ({ ok: true, votes: { yes: 1, no: 0, abstain: 0 }, stake_gdc: 1500 }) };
      }
      throw new Error('unexpected fetch: ' + u);
    };
    ({ createProposal, vote, getProposal, listProposals } = await import('../src/gdc/dao.js?t=' + Date.now()));
  });

  const wallet = { guid: 'u1', publicKeyB64u: 'pk', signPayload: async (m) => 'sig:' + m };

  test('createProposal — OWNERSHIP_TRANSFER는 네트워크 호출 전에 클라이언트에서 즉시 차단', async () => {
    requests.length = 0;
    await assert.rejects(() => createProposal({ title: 't', proposerGuid: 'u1', params: { type: 'OWNERSHIP_TRANSFER' }, wallet }));
    assert.equal(requests.length, 0, '서버 호출 자체가 발생하지 않아야 함');
  });

  test('createProposal — 지갑 없으면 즉시 실패', async () => {
    await assert.rejects(() => createProposal({ title: 't', proposerGuid: 'u1', params: {}, wallet: null }));
  });

  test('createProposal — 정상 흐름은 서명을 포함해 서버에 전송', async () => {
    requests.length = 0;
    const p = await createProposal({ title: '수수료 조정', proposerGuid: 'u1', params: { rate: 0.02 }, wallet });
    assert.equal(p.proposalId, 'prop_x');
    const req = requests.find(r => r.url.includes('/proposal'));
    assert.ok(req.body.signature);
  });

  test('vote — 잘못된 choice는 네트워크 호출 없이 즉시 실패', async () => {
    requests.length = 0;
    await assert.rejects(() => vote({ proposalId: 'prop_x', userGuid: 'u1', choice: 'maybe', wallet }));
    assert.equal(requests.length, 0);
  });

  test('vote — 정상 흐름, 서버가 반환한 stake_gdc를 그대로 노출(클라이언트가 값을 만들어내지 않음)', async () => {
    const r = await vote({ proposalId: 'prop_x', userGuid: 'u1', choice: 'yes', wallet });
    assert.equal(r.success, true);
    assert.equal(r.stakeGdc, 1500);
  });

  test('getProposal / listProposals가 서버 응답을 그대로 전달', async () => {
    const p = await getProposal('prop_x');
    assert.equal(p.status, 'ACTIVE');
    const list = await listProposals();
    assert.equal(list.length, 1);
  });
});
