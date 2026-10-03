#!/usr/bin/env python3
"""R06 증권 운용·이자 재원 시나리오 생성기. expected는 구현(js)을 보지 않고 명세 securities_v0_1.md 를 따로 옮긴 참조 계산(정수 산술)이 낸다."""
import json, os
GR = ('AAA', 'AA', 'A', 'BBB', 'BB', 'C')

def isint(v):
    return not isinstance(v, bool) and (isinstance(v, int) or (isinstance(v, float) and v.is_integer()))
def nes(v): return isinstance(v, str) and len(v) > 0

def ref(i):
    pr, pos, sc, cd, pb, dep = (i.get(k) for k in ('principal', 'positions', 'serverCost', 'carryDeficit', 'payoutBp', 'depositors'))
    if not isint(pr) or pr < 0: return {'error': 'PRINCIPAL_INVALID'}
    pos = [] if pos is None else pos
    if not isinstance(pos, list): return {'error': 'POSITIONS_INVALID'}
    seen = set()
    for p in pos:
        if not isinstance(p, dict) or not nes(p.get('id')) or p.get('grade') not in GR or not isint(p.get('cost')) or p['cost'] < 1 or not isint(p.get('income')) or p['income'] < 0 or p['id'] in seen:
            return {'error': 'POSITIONS_INVALID'}
        seen.add(p['id'])
    if not isint(sc) or sc < 0: return {'error': 'COST_INVALID'}
    if not isint(cd) or cd < 0: return {'error': 'CARRY_INVALID'}
    if not isint(pb) or pb < 0 or pb > 8000: return {'error': 'PAYOUT_INVALID'}
    dep = [] if dep is None else dep
    if not isinstance(dep, list): return {'error': 'DEPOSITORS_INVALID'}
    seen = set()
    for d in dep:
        if not isinstance(d, dict) or not nes(d.get('id')) or not isint(d.get('weight')) or d['weight'] < 0 or not isint(d.get('promised')) or d['promised'] < 0 or d['id'] in seen:
            return {'error': 'DEPOSITORS_INVALID'}
        seen.add(d['id'])
    pr = int(pr); sc = int(sc); cd = int(cd); pb = int(pb)
    inv = sum(int(p['cost']) for p in pos)
    v = []
    if any(p['grade'] == 'C' for p in pos): v.append('GRADE_C')
    if any(int(p['cost']) * 5 > pr for p in pos): v.append('ISSUER_CONCENTRATION')
    if inv * 10 > pr * 7: v.append('INVESTED_CAP')
    g = sum(int(p['income']) for p in pos)
    net = g - sc
    ac = net - cd
    dist = ac if ac >= 0 else 0
    carry = 0 if ac >= 0 else -ac
    pool = dist * pb // 100
    W = sum(int(d['weight']) for d in dep)
    shares = [{'id': d['id'], 'cents': (pool * int(d['weight']) // W) if W > 0 else 0} for d in dep]
    paid = sum(s['cents'] for s in shares)
    ob = sum(int(d['promised']) for d in dep)
    return {'compliant': not v, 'violations': v, 'investedCost': inv, 'grossIncome': g, 'net': net, 'distributable': dist, 'newCarry': carry,
            'poolCents': pool, 'shares': shares, 'undistributedCents': dist * 100 - paid, 'obligationCents': ob, 'shortfallCents': max(0, ob - dist * 100)}

S = []
def add(note, **inp): S.append((note, inp))
def pos(i, g='A', c=100, inc=10): return {'id': i, 'grade': g, 'cost': c, 'income': inc}
def dep(i, w=1, p=0): return {'id': i, 'weight': w, 'promised': p}
B = dict(principal=1000, serverCost=0, carryDeficit=0, payoutBp=5000)
def b(**kw): d = dict(B); d.update(kw); return d

add('기본: 수익 40, 비용 10 → 순수익 30, 배분율 50% → 재원 1500센트, 가중 1:2', **b(positions=[pos('a', 'A', 200, 40)], serverCost=10, depositors=[dep('x', 1, 100), dep('y', 2, 0)]))
add('종목·예치자 없음', **b())
add('종목 없음, positions null, depositors null', **b(positions=None, depositors=None))
add('수익 0 → 이자 0', **b(positions=[pos('a', 'A', 100, 0)], depositors=[dep('x', 1, 50)]))
add('비용이 수익보다 크면 순수익 음수, 분배 0, 부족분이 새 이월 결손', **b(positions=[pos('a', 'A', 100, 10)], serverCost=30, depositors=[dep('x', 1, 0)]))
add('이월 결손이 순수익보다 크면 남은 결손 이월', **b(positions=[pos('a', 'A', 100, 50)], serverCost=10, carryDeficit=100, depositors=[dep('x', 1, 0)]))
add('이월 결손이 순수익과 같으면 분배 0, newCarry 0', **b(positions=[pos('a', 'A', 100, 50)], serverCost=10, carryDeficit=40, depositors=[dep('x', 1, 0)]))
add('이월 결손이 순수익보다 작으면 차액 분배', **b(positions=[pos('a', 'A', 100, 50)], serverCost=10, carryDeficit=15, depositors=[dep('x', 1, 0)]))
add('순수익 음수 + 이월 결손 → newCarry는 합산', **b(positions=[pos('a', 'A', 100, 5)], serverCost=20, carryDeficit=7, depositors=[]))
add('배분율 0 → 재원 0, 전액 남음', **b(positions=[pos('a', 'A', 100, 100)], payoutBp=0, depositors=[dep('x', 1, 300)]))
add('배분율 8000(상한)', **b(positions=[pos('a', 'A', 100, 100)], payoutBp=8000, depositors=[dep('x', 1, 0)]))
add('배분율 1bp, 버림', **b(positions=[pos('a', 'A', 100, 99)], payoutBp=1, depositors=[dep('x', 1, 0)]))
add('재원 센트 버림: 7*3333/100=233.31→233', **b(positions=[pos('a', 'A', 100, 7)], payoutBp=3333, depositors=[dep('x', 1, 0)]))
add('몫 버림: 재원 100센트를 가중 1:1:1로 → 33,33,33 (남는 1센트는 undistributed)', **b(positions=[pos('a', 'A', 100, 2)], payoutBp=5000, depositors=[dep('x', 1, 0), dep('y', 1, 0), dep('z', 1, 0)]))
add('가중치 0인 예치자는 몫 0', **b(positions=[pos('a', 'A', 100, 20)], depositors=[dep('x', 0, 0), dep('y', 5, 0)]))
add('가중치 합 0 → 모두 0, 재원은 남음', **b(positions=[pos('a', 'A', 100, 20)], depositors=[dep('x', 0, 10), dep('y', 0, 10)]))
add('예치자 한 명', **b(positions=[pos('a', 'A', 100, 20)], depositors=[dep('x', 7, 0)]))
add('확정 이율형: 약정 합계가 순수익(센트)보다 크면 부족액', **b(positions=[pos('a', 'A', 100, 10)], depositors=[dep('x', 1, 800), dep('y', 1, 700)]))
add('확정 이율형: 약정이 정확히 순수익(센트)과 같으면 부족 0', **b(positions=[pos('a', 'A', 100, 10)], depositors=[dep('x', 1, 1000)]))
add('확정 이율형: 순수익 음수면 약정 전부가 부족', **b(positions=[pos('a', 'A', 100, 0)], serverCost=5, depositors=[dep('x', 1, 250)]))
add('여러 종목 합산', **b(positions=[pos('a', 'AAA', 100, 5), pos('b', 'BBB', 150, 12), pos('c', 'BB', 50, 0)], serverCost=4, depositors=[dep('x', 3, 0), dep('y', 1, 0)]))
# 규칙 위반
add('C 등급 종목 → GRADE_C (계산은 계속)', **b(positions=[pos('a', 'C', 100, 10)], depositors=[dep('x', 1, 0)]))
add('종목 하나가 원금의 20%와 같으면 위반 아님 (200 = 1000/5)', **b(positions=[pos('a', 'A', 200, 10)]))
add('종목 하나가 원금의 20%를 넘으면 ISSUER_CONCENTRATION (201)', **b(positions=[pos('a', 'A', 201, 10)]))
add('운용 원가가 원금의 70%와 같으면 위반 아님 (4종목 700... 단 각 ≤200)', **b(positions=[pos('a', 'A', 200), pos('b', 'A', 200), pos('c', 'A', 200), pos('d', 'A', 100)]))
add('운용 원가가 원금의 70%를 넘으면 INVESTED_CAP (701)', **b(positions=[pos('a', 'A', 200), pos('b', 'A', 200), pos('c', 'A', 200), pos('d', 'A', 101)]))
add('세 위반이 모두 있으면 순서대로 GRADE_C, ISSUER_CONCENTRATION, INVESTED_CAP', **b(principal=100, positions=[pos('a', 'C', 60, 5), pos('b', 'A', 20, 1)]))
add('집중도만 위반 (원금 100, 종목 21)', **b(principal=100, positions=[pos('a', 'A', 21, 1)]))
add('원금 0이고 종목이 있으면 집중도·운용 상한 위반', **b(principal=0, positions=[pos('a', 'A', 1, 1)]))
add('원금 0이고 종목 없으면 위반 없음', **b(principal=0))
add('원금 5, 종목 cost 1 (1*5=5 > 5 아님) 집중도 위반 아님', **b(principal=5, positions=[pos('a', 'A', 1, 1)]))
add('원금 10, 종목 cost 7 → 운용 상한 경계(70 = 70)는 위반 아님, 집중도(35>10)만 위반', **b(principal=10, positions=[pos('a', 'A', 7, 1)]))
# 오류
add('PRINCIPAL 음수', **b(principal=-1))
add('PRINCIPAL 누락', serverCost=0, carryDeficit=0, payoutBp=0)
add('PRINCIPAL 소수', **b(principal=10.5))
add('PRINCIPAL 1000.0 은 정수', **b(principal=1000.0, positions=[pos('a', 'A', 100, 10)]))
add('PRINCIPAL true', **b(principal=True))
add('POSITIONS 배열 아님', **b(positions={'id': 'a'}))
add('POSITIONS 원소 null', **b(positions=[None]))
add('POSITIONS id 빈 문자열', **b(positions=[pos('', 'A', 100, 1)]))
add('POSITIONS id 숫자', **b(positions=[{'id': 1, 'grade': 'A', 'cost': 100, 'income': 1}]))
add('POSITIONS 등급 소문자', **b(positions=[pos('a', 'a', 100, 1)]))
add('POSITIONS 등급 없음(D)', **b(positions=[pos('a', 'D', 100, 1)]))
add('POSITIONS cost 0', **b(positions=[pos('a', 'A', 0, 1)]))
add('POSITIONS income 음수', **b(positions=[pos('a', 'A', 100, -1)]))
add('POSITIONS income 소수', **b(positions=[pos('a', 'A', 100, 1.5)]))
add('POSITIONS id 중복', **b(positions=[pos('a'), pos('a')]))
add('POSITIONS 추가 키는 무시', **b(positions=[{'id': 'a', 'grade': 'A', 'cost': 100, 'income': 5, 'memo': 'x'}]))
add('COST 음수', **b(serverCost=-1))
add('COST 누락', principal=1000, carryDeficit=0, payoutBp=0)
add('CARRY 음수', **b(carryDeficit=-1))
add('CARRY null', **b(carryDeficit=None))
add('PAYOUT 8001', **b(payoutBp=8001))
add('PAYOUT 음수', **b(payoutBp=-1))
add('PAYOUT 누락', principal=1000, serverCost=0, carryDeficit=0)
add('DEPOSITORS 배열 아님', **b(depositors='x'))
add('DEPOSITORS weight 음수', **b(depositors=[dep('x', -1, 0)]))
add('DEPOSITORS promised 소수', **b(depositors=[{'id': 'x', 'weight': 1, 'promised': 0.5}]))
add('DEPOSITORS id 중복', **b(depositors=[dep('x'), dep('x')]))
add('DEPOSITORS weight 누락', **b(depositors=[{'id': 'x', 'promised': 0}]))
add('검사 순서: PRINCIPAL과 POSITIONS가 모두 틀리면 PRINCIPAL', **b(principal=-5, positions=['x']))
add('검사 순서: POSITIONS와 COST가 모두 틀리면 POSITIONS', **b(positions=['x'], serverCost=-1))
add('검사 순서: PAYOUT과 DEPOSITORS가 모두 틀리면 PAYOUT', **b(payoutBp=9000, depositors='x'))
add('위반이 있어도 입력 오류가 먼저다', **b(positions=[pos('a', 'C', 100, 1), pos('a', 'C', 100, 1)]))
add('POSITIONS 원소에 grade 키 없음', **b(positions=[{'id': 'a', 'cost': 100, 'income': 1}]))
add('POSITIONS 원소에 income null', **b(positions=[{'id': 'a', 'grade': 'A', 'cost': 100, 'income': None}]))
add('DEPOSITORS 원소에 promised null', **b(depositors=[{'id': 'x', 'weight': 1, 'promised': None}]))
add('positions 빈 배열 + 원금 0 → 위반 없음', **b(principal=0, positions=[]))
add('가중치 합 0이면 distributable 전액이 남는다', **b(positions=[pos('a', 'A', 100, 30)], depositors=[dep('x', 0, 0)]))
add('확정 이율형 부족액은 payoutBp와 무관 (payoutBp 0)', **b(positions=[pos('a', 'A', 100, 10)], payoutBp=0, depositors=[dep('x', 1, 1500)]))
add('운용 원가 경계와 집중도 경계가 동시에 정확히 같음 (원금 1000: 종목 200 x 3 + 100 = 700, 각 ≤ 200)', **b(positions=[pos('a', 'A', 200), pos('b', 'A', 200), pos('c', 'A', 200), pos('d', 'A', 100)]))
scen = [{'id': f'sec6-{i+1:03d}', 'kind': 'securities', 'product': 'securities', 'moves_balance': False, 'note': n, 'inputs': inp, 'expected': ref(inp)} for i, (n, inp) in enumerate(S)]
here = os.path.dirname(os.path.abspath(__file__))
json.dump({'schema': 1, 'round': 'r06', 'authored': '2026-10-03', 'note': '증권 운용·이자 재원 명세 v0.1(securities_v0_1.md) 기준. expected는 gen_scenarios.py의 참조 계산(명세를 구현 코드와 별개로 옮김)이 실행 전에 냈다.', 'scenarios': scen},
          open(os.path.join(here, 'scenarios.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(scen), 'scenarios')
