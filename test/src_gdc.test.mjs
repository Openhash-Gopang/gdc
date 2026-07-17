import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calcInflationRate, calcNewIssuance, burn, BURN_PATH, getTotalBurned, _resetBurnLog, calcGEI } from '../src/gdc/tokenomics.js';
// currencyPool.js v1(exchange/depositGDC 등, 자체 풀 보유 모델)은
// 2026-07-18 법적 검토로 v2(사용자 간 매칭 중개, 비custodial)로 전면
// 재설계됐다 — 아래 v1 전용 테스트는 제거했다. v2 테스트는
// test/activated_features.test.mjs 참고.

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

// dao.js v1(메모리 Map, 자기신고 stakeGDC 신뢰)은 2026-07-18 서버 연동
// v2로 재작성됐다 — 그때 발견한 버그("BUG CHECK: vote() trusts
// caller-supplied stakeGDC")는 서버가 실제 잔액을 재조회하는 방식으로
// 수정됐다. v1 전용 테스트는 제거 — v2 테스트는 test/dao_client.test.mjs
// (클라이언트)와 gopang 저장소 test/gdc_dao.test.mjs(서버, 조작된
// stake_gdc가 무시되는지까지 검증) 참고.

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
