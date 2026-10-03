#!/usr/bin/env python3
"""R08 증권 발행·가격 시나리오 생성기. expected는 구현(js)을 보지 않고 명세 issuance_v0_1.md 를 따로 옮긴 참조 계산(정수 산술)이 낸다."""
import json, os
GR = ('AAA', 'AA', 'A', 'BBB', 'BB', 'C')

def isint(v):
    return not isinstance(v, bool) and (isinstance(v, int) or (isinstance(v, float) and v.is_integer()))
def nes(v): return isinstance(v, str) and len(v) > 0

def ref(i):
    if not isinstance(i, dict): return {'error': 'ISSUER_INVALID'}
    iss, gr, val, iu, ru, subs = (i.get(k) for k in ('issuerId', 'grade', 'valuation', 'issuedUnits', 'requestUnits', 'subscriptions'))
    if not nes(iss): return {'error': 'ISSUER_INVALID'}
    if gr not in GR: return {'error': 'GRADE_INVALID'}
    if not isinstance(val, dict) or not all(isint(val.get(k)) for k in ('low', 'mid', 'high')) or val['low'] < 0 or not (val['low'] <= val['mid'] <= val['high']): return {'error': 'VALUATION_INVALID'}
    if not isint(iu) or iu < 0: return {'error': 'ISSUED_INVALID'}
    if not isint(ru) or ru < 1 or ru > 100000: return {'error': 'REQUEST_INVALID'}
    subs = [] if subs is None else subs
    if not isinstance(subs, list): return {'error': 'SUBSCRIPTIONS_INVALID'}
    seen = set()
    for s in subs:
        if not isinstance(s, dict) or not nes(s.get('id')) or not isint(s.get('units')) or s['units'] < 1 or s['id'] in seen: return {'error': 'SUBSCRIPTIONS_INVALID'}
        seen.add(s['id'])
    low, mid, high, iu, ru = int(val['low']), int(val['mid']), int(val['high']), int(iu), int(ru)
    def rej(reason, price):
        return {'status': 'rejected', 'reason': reason, 'priceCents': price, 'allocations': [], 'unallocatedUnits': ru, 'raisedCents': 0, 'newIssuedUnits': iu, 'postPriceCents': None, 'bandLowCents': None, 'bandHighCents': None}
    if gr == 'C': return rej('GRADE_C', None)
    if mid == 0: return rej('VALUATION_ZERO', None)
    price = 100 if iu == 0 else mid * 100 // iu
    if price == 0: return rej('PRICE_ZERO', 0)
    if ru * price * 2 > mid * 100: return rej('RAISE_CAP', price)
    T = sum(int(s['units']) for s in subs)
    cap = ru * 20 // 100
    al = []
    for s in subs:
        u = int(s['units']) if T <= ru else int(s['units']) * ru // T
        if s['id'] == iss: u = min(u, cap)
        al.append({'id': s['id'], 'units': u})
    A = sum(a['units'] for a in al)
    raised = A * price
    niu = iu + A
    out = {'status': 'issued', 'reason': None, 'priceCents': price, 'allocations': al, 'unallocatedUnits': ru - A, 'raisedCents': raised, 'newIssuedUnits': niu}
    if niu == 0: out.update(postPriceCents=None, bandLowCents=None, bandHighCents=None)
    else:
        out.update(postPriceCents=(mid * 100 + raised) // niu, bandLowCents=(low * 100 + raised) // niu, bandHighCents=-(-(high * 100 + raised) // niu))
    return out

S = []
def add(note, **inp): S.append((note, inp))
def sub(i, u): return {'id': i, 'units': u}
def b(**kw):
    d = dict(issuerId='co', grade='A', valuation={'low': 0, 'mid': 1000, 'high': 3000}, issuedUnits=500, requestUnits=100, subscriptions=[])
    d.update(kw); return d

add('기본 발행: 기존 500단위, 중간 1000₮ → 발행가 200센트, 청약 합계가 요청 이하면 그대로 배정', **b(subscriptions=[sub('a', 30), sub('b', 40)]))
add('초과 청약: 안분 배정(버림)', **b(subscriptions=[sub('a', 60), sub('b', 70), sub('c', 20)]))
add('청약 없음 → 배정 0, 조달 0, 가격 띠는 기존 단위 기준', **b())
add('subscriptions null', **b(subscriptions=None))
add('내부자 청약이 20%를 넘으면 상한 (요청 100 → 20)', **b(subscriptions=[sub('co', 50), sub('a', 30)]))
add('내부자 청약이 상한 이하면 그대로', **b(subscriptions=[sub('co', 15), sub('a', 30)]))
add('초과 청약 + 내부자 상한 동시 (T=110)', **b(subscriptions=[sub('a', 60), sub('co', 50)]))
add('내부자만 청약, 상한 20으로 잘림, 나머지 미배정', **b(subscriptions=[sub('co', 100)]))
add('요청 7단위: 내부자 상한 floor(1.4)=1', **b(requestUnits=7, subscriptions=[sub('co', 7)]))
add('요청 4단위: 내부자 상한 0 → 내부자 배정 0', **b(requestUnits=4, subscriptions=[sub('co', 4), sub('a', 4)]))
add('최초 발행(issuedUnits 0): 발행가 100센트', **b(issuedUnits=0, requestUnits=300, subscriptions=[sub('a', 100), sub('b', 150)]))
add('최초 발행인데 청약 없음 → 가격 null', **b(issuedUnits=0, requestUnits=100))
add('최초 발행, 발행 규모가 중간의 50%와 같으면 허용 (mid 1000, 500단위 * 100센트 * 2 = 100000 = 1000*100)', **b(issuedUnits=0, requestUnits=500, subscriptions=[sub('a', 500)]))
add('최초 발행, 501단위 → RAISE_CAP', **b(issuedUnits=0, requestUnits=501, subscriptions=[sub('a', 501)]))
add('기존 있는 발행: 경계 (price 200, 250단위 * 200 * 2 = 100000)', **b(requestUnits=250, subscriptions=[sub('a', 250)]))
add('기존 있는 발행: 251단위 → RAISE_CAP', **b(requestUnits=251, subscriptions=[sub('a', 251)]))
add('C 등급 → GRADE_C', **b(grade='C', subscriptions=[sub('a', 10)]))
add('C 등급이고 mid 0이면 GRADE_C가 먼저', **b(grade='C', valuation={'low': 0, 'mid': 0, 'high': 0}))
add('mid 0 → VALUATION_ZERO', **b(valuation={'low': 0, 'mid': 0, 'high': 100}))
add('발행가가 0이 되는 경우: mid 1, 기존 101단위 → floor(100/101)=0 → PRICE_ZERO', **b(valuation={'low': 0, 'mid': 1, 'high': 1}, issuedUnits=101, requestUnits=1))
add('mid 1, 기존 100단위 → 발행가 1센트', **b(valuation={'low': 0, 'mid': 1, 'high': 1}, issuedUnits=100, requestUnits=1, subscriptions=[sub('a', 1)]))
add('RAISE_CAP이 PRICE_ZERO보다 뒤: PRICE_ZERO 우선', **b(valuation={'low': 0, 'mid': 1, 'high': 1}, issuedUnits=200, requestUnits=100000))
add('가격 띠: low > 0, high > mid', **b(valuation={'low': 400, 'mid': 1000, 'high': 2500}, subscriptions=[sub('a', 100)]))
add('가격 띠 올림: high*100+조달 이 나누어떨어지지 않음', **b(valuation={'low': 3, 'mid': 7, 'high': 11}, issuedUnits=3, requestUnits=1, subscriptions=[sub('a', 1)]))
add('low = mid = high', **b(valuation={'low': 1000, 'mid': 1000, 'high': 1000}, subscriptions=[sub('a', 100)]))
add('청약 수량이 요청과 같으면 안분 아님 (T == 요청)', **b(subscriptions=[sub('a', 50), sub('b', 50)]))
add('안분에서 버림으로 전부 미배정 (T=3 요청 2: 각 floor(2/3)=0)', **b(requestUnits=2, subscriptions=[sub('a', 1), sub('b', 1), sub('c', 1)]))
add('큰 발행: 요청 100000, 기존 0, mid 100000', **b(issuedUnits=0, valuation={'low': 0, 'mid': 100000, 'high': 100000}, requestUnits=100000, subscriptions=[sub('a', 100000)]))
add('청약자 id가 issuerId와 같은 대소문자 다름은 내부자 아님', **b(subscriptions=[sub('CO', 100)]))
add('청약 순서가 결과 순서', **b(subscriptions=[sub('z', 10), sub('a', 20)]))
add('추가 키는 무시', **b(extra='x', valuation={'low': 0, 'mid': 1000, 'high': 3000, 'note': 'x'}, subscriptions=[{'id': 'a', 'units': 5, 'memo': 'x'}]))
add('requestUnits 100.0 은 정수', **b(requestUnits=100.0, subscriptions=[sub('a', 10)]))
# 오류
add('ISSUER 빈 문자열', **b(issuerId=''))
add('ISSUER 누락', grade='A', valuation={'low': 0, 'mid': 1, 'high': 1}, issuedUnits=0, requestUnits=1)
add('ISSUER 숫자', **b(issuerId=5))
add('ISSUER 공백만 → 유효', **b(issuerId=' ', subscriptions=[sub('a', 1)]))
add('GRADE D', **b(grade='D'))
add('GRADE 소문자', **b(grade='a'))
add('GRADE 누락', issuerId='co', valuation={'low': 0, 'mid': 1, 'high': 1}, issuedUnits=0, requestUnits=1)
add('VALUATION 객체 아님', **b(valuation=5))
add('VALUATION 누락', issuerId='co', grade='A', issuedUnits=0, requestUnits=1)
add('VALUATION low > mid', **b(valuation={'low': 5, 'mid': 4, 'high': 9}))
add('VALUATION mid > high', **b(valuation={'low': 0, 'mid': 9, 'high': 4}))
add('VALUATION 음수', **b(valuation={'low': -1, 'mid': 1, 'high': 2}))
add('VALUATION 소수', **b(valuation={'low': 0, 'mid': 1.5, 'high': 2}))
add('VALUATION 키 누락', **b(valuation={'low': 0, 'mid': 1}))
add('ISSUED 음수', **b(issuedUnits=-1))
add('ISSUED 소수', **b(issuedUnits=1.5))
add('ISSUED 누락', issuerId='co', grade='A', valuation={'low': 0, 'mid': 1, 'high': 1}, requestUnits=1)
add('REQUEST 0', **b(requestUnits=0))
add('REQUEST 100001', **b(requestUnits=100001))
add('REQUEST 누락', issuerId='co', grade='A', valuation={'low': 0, 'mid': 1, 'high': 1}, issuedUnits=0)
add('SUBSCRIPTIONS 배열 아님', **b(subscriptions='x'))
add('SUBSCRIPTIONS units 0', **b(subscriptions=[sub('a', 0)]))
add('SUBSCRIPTIONS units 소수', **b(subscriptions=[{'id': 'a', 'units': 1.5}]))
add('SUBSCRIPTIONS id 중복', **b(subscriptions=[sub('a', 1), sub('a', 2)]))
add('SUBSCRIPTIONS 원소 null', **b(subscriptions=[None]))
add('SUBSCRIPTIONS id 빈 문자열', **b(subscriptions=[sub('', 1)]))
add('입력 오류가 거절 판정보다 먼저다 (C 등급 + 청약 오류)', **b(grade='C', subscriptions=[sub('a', 0)]))
add('검사 순서: ISSUER와 GRADE가 모두 틀리면 ISSUER', **b(issuerId='', grade='D'))
add('검사 순서: VALUATION과 REQUEST가 모두 틀리면 VALUATION', **b(valuation=None, requestUnits=0))
add('검사 순서: REQUEST와 SUBSCRIPTIONS가 모두 틀리면 REQUEST', **b(requestUnits=0, subscriptions='x'))

scen = [{'id': f'iss8-{i+1:03d}', 'kind': 'issuance', 'product': 'securities', 'moves_balance': False, 'note': n, 'inputs': inp, 'expected': ref(inp)} for i, (n, inp) in enumerate(S)]
here = os.path.dirname(os.path.abspath(__file__))
json.dump({'schema': 1, 'round': 'r08', 'authored': '2026-10-03', 'note': '증권 발행·가격 명세 v0.1(issuance_v0_1.md) 기준. expected는 gen_scenarios.py의 참조 계산(명세를 구현 코드와 별개로 옮김)이 실행 전에 냈다.', 'scenarios': scen},
          open(os.path.join(here, 'scenarios.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(scen), 'scenarios')
