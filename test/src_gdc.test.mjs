import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calcInflationRate, calcNewIssuance, burn, BURN_PATH, getTotalBurned, _resetBurnLog, calcGEI } from '../src/gdc/tokenomics.js';
// currencyPool.js v1(exchange/depositGDC 등, 자체 풀 보유 모델)은
// 2026-07-18 법적 검토로 v2(사용자 간 매칭 중개, 비custodial)로 전면
// 재설계됐다 — 아래 v1 전용 테스트는 제거했다. v2 테스트는
// test/activated_features.test.mjs 참고.
import { createProposal, vote, finalizeProposal, _resetDAO } from '../src/gdc/dao.js';
import { createVault, calcExpectedVolatility, VAULT_ALLOCATION, _resetVaults } from '../src/gdc/smartVault.js';
import { createEscrow, executeFromKLaw, _resetEscrows } from '../src/gdc/escrow.js';

describe('tokenomics.js', () => {
  test('inflation clamps to 0 at high burn rate', () => {
    const r = calcInflationRate(0.30, 1.0, 0.01); // burnRate=1.0 (100%) is absurd input but should clamp
    assert.equal(r, 0);
  });
  test('inflation clamps to MAX_INFLATION (0.02) at high growth', () => {
    const r = calcInflationRate(5.0, 0, 0.01);
    assert.equal(r, 0.02);
  });
  test('calcNewIssuance respects MAX_SUPPLY cap', () => {
    _resetBurnLog();
    const iss = calcNewIssuance(199_999_999, 0.02);
    assert.equal(iss, 1); // capped to MAX_SUPPLY - currentSupply
  });
  test('burn rejects unknown path', () => {
    assert.throws(() => burn('NOT_A_PATH', 10));
  });
  test('burn rejects non-positive amount', () => {
    assert.throws(() => burn(BURN_PATH.MSG_FEE, 0));
    assert.throws(() => burn(BURN_PATH.MSG_FEE, -5));
  });
  test('getTotalBurned sums correctly', () => {
    _resetBurnLog();
    burn(BURN_PATH.MSG_FEE, 1.5);
    burn(BURN_PATH.STAKING_SLASH, 2.5);
    assert.equal(getTotalBurned(), 4);
  });
  test('calcGEI averages two indices', () => {
    assert.equal(calcGEI(100, 110), 105);
  });
});

describe('dao.js', () => {
  test('blocks OWNERSHIP_TRANSFER proposals (DAWN principle)', () => {
    _resetDAO();
    assert.throws(() => createProposal('p1', 't', 'u1', { type: 'OWNERSHIP_TRANSFER' }));
  });
  test('vote requires MIN_STAKE_VOTE=1000', () => {
    _resetDAO();
    createProposal('p2', 't2', 'u1');
    const r = vote('p2', 'u2', 999, 'yes');
    assert.equal(r.success, false);
  });
  test('BUG CHECK: vote() trusts caller-supplied stakeGDC with no server-side balance check', () => {
    _resetDAO();
    createProposal('p3', 't3', 'u1');
    // vote() trusts the caller-supplied stakeGDC with no server-side balance check against actual GDC holdings
    const r = vote('p3', 'u2', 1000000, 'yes'); // any caller can claim any stake
    assert.equal(r.success, true, 'vote() has no mechanism to verify stakeGDC against real balance -- self-reported stake is trusted');
  });
  test('finalizeProposal: tie (yes===no) resolves to REJECTED', () => {
    _resetDAO();
    createProposal('p4', 't4', 'u1');
    vote('p4', 'a', 1000, 'yes');
    vote('p4', 'b', 1000, 'no');
    const f = finalizeProposal('p4');
    assert.equal(f.status, 'REJECTED');
  });
});

describe('smartVault.js', () => {
  test('all VAULT_ALLOCATION rows sum to 1.0', () => {
    for (const [type, alloc] of Object.entries(VAULT_ALLOCATION)) {
      const sum = Object.values(alloc).reduce((a,b) => a+b, 0);
      assert.ok(Math.abs(sum - 1.0) < 1e-9, `${type} allocation sums to ${sum}, not 1.0`);
    }
  });
  test('createVault rejects unknown type / non-positive amount', () => {
    _resetVaults();
    assert.throws(() => createVault('u1', 'bogus', 100));
    assert.throws(() => createVault('u1', 'stable', 0));
  });
  test('calcExpectedVolatility matches README claim (<5% for stable)', () => {
    assert.ok(calcExpectedVolatility('stable') < 0.05);
  });
});

describe('escrow.js', () => {
  test('executeFromKLaw on nonexistent escrow returns failure, not throw', () => {
    _resetEscrows();
    const r = executeFromKLaw('nope', 'RELEASE');
    assert.equal(r.success, false);
  });
  test('double-execution: second call after already RELEASED returns status-error, not silent re-execution', () => {
    _resetEscrows();
    createEscrow('e1', 'buyer', 'seller', 100, 'cond', 'msg1');
    executeFromKLaw('e1', 'RELEASE');
    const r2 = executeFromKLaw('e1', 'REFUND');
    assert.equal(r2.success, false);
  });
});
