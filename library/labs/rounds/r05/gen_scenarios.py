#!/usr/bin/env python3
"""R05 보험 시나리오 생성기. expected는 구현(js)을 보지 않고 명세 insurance_v0_1.md를 따로 옮긴 이 참조 계산으로 낸다(정수·분수 산술)."""
import json, os, math
P, M = 'paid', 'missed'
RATE = {'A': 100, 'B': 200, 'C': 400}

def isint(v):
    return not isinstance(v, bool) and (isinstance(v, int) or (isinstance(v, float) and v.is_integer()))

def ref(i):
    cov, term, rc, out = i.get('coverageAmount'), i.get('termMonths'), i.get('riskClass'), i.get('outcomes')
    claims, cancel = i.get('claims'), i.get('cancelAt')
    if not isint(cov) or not (100 <= cov <= 10000) or cov % 100: return {'error': 'COVERAGE_INVALID'}
    if not isint(term) or term not in (6, 12): return {'error': 'TERM_INVALID'}
    if rc not in RATE: return {'error': 'CLASS_INVALID'}
    if not isinstance(out, list) or len(out) > term or any(o not in (P, M) for o in out): return {'error': 'OUTCOMES_INVALID'}
    cl = [] if claims is None else claims
    if not isinstance(cl, list): return {'error': 'CLAIMS_INVALID'}
    prev = 1
    for c in cl:
        if not isinstance(c, dict) or not isint(c.get('month')) or not isint(c.get('loss')): return {'error': 'CLAIMS_INVALID'}
        if c['month'] < 1 or c['month'] > len(out) or c['loss'] < 1 or c['month'] < prev: return {'error': 'CLAIMS_INVALID'}
        prev = c['month']
    if cancel is not None and (not isint(cancel) or cancel < 1 or cancel > term or cancel > len(out)): return {'error': 'CANCEL_INVALID'}
    cov = int(cov)
    monthly = -(-cov * RATE[rc] // 1200)
    ded, rem, paid, status, end, res = cov // 10, cov, 0, 'active', 0, []
    for k in range(1, len(out) + 1):
        end = k
        if out[k-1] == P: paid += 1
        for c in cl:
            if c['month'] != k: continue
            pay = 0
            if k == 1: r = 'WAITING'
            elif out[k-1] == M: r = 'UNPAID'
            elif rem == 0: r = 'EXHAUSTED'
            elif c['loss'] <= ded: r = 'BELOW_DEDUCTIBLE'
            elif c['loss'] - ded <= rem: r = 'PAID'; pay = c['loss'] - ded
            else: r = 'PARTIAL'; pay = rem
            rem -= pay
            res.append({'month': int(c['month']), 'loss': int(c['loss']), 'payout': int(pay), 'reason': r})
        if out[k-1] == M and k >= 2 and out[k-2] == M: status = 'lapsed'; break
        if rem == 0: status = 'exhausted'; break
        if cancel == k and k < term: status = 'cancelled'; break
        if k == term: status = 'matured'; break
    return {'status': status, 'endMonth': end, 'paidCount': paid, 'premiumTotal': monthly * paid / 100,
            'claimResults': res, 'totalPayout': cov - rem, 'remainingCoverage': rem}

def n(x, v=P): return [v] * x
S = []
def add(note, **inp):
    S.append((note, inp))

# 기본·만기
add('1000/12/A 전부 납입, 사고 없음 (월 보험료 ceil(83.33)=84센트, 12회 ₮10.08)', coverageAmount=1000, termMonths=12, riskClass='A', outcomes=n(12))
add('1000/12/B (167센트 올림 확인: 1000*200/1200=166.67)', coverageAmount=1000, termMonths=12, riskClass='B', outcomes=n(12))
add('1000/6/C (333.33→334센트)', coverageAmount=1000, termMonths=6, riskClass='C', outcomes=n(6))
add('10000/12/C 최대 (3333.33→3334센트=₮33.34)', coverageAmount=10000, termMonths=12, riskClass='C', outcomes=n(12))
add('100/6/A 최소 (100*100/1200=8.33→9센트)', coverageAmount=100, termMonths=6, riskClass='A', outcomes=n(6))
add('600/12/B: 600*200/1200=100센트 정확히 (올림 없음)', coverageAmount=600, termMonths=12, riskClass='B', outcomes=n(12))
# 사고 처리
add('면책 기간: 1월 사고는 WAITING', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(6), claims=[{'month': 1, 'loss': 900}])
add('2월 사고 PAID (손실 500 − 자기부담 100 = 400)', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(6), claims=[{'month': 2, 'loss': 500}])
add('손실이 자기부담금과 같으면 BELOW_DEDUCTIBLE', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(6), claims=[{'month': 2, 'loss': 100}])
add('손실이 자기부담금보다 1 크면 PAID 1', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(6), claims=[{'month': 2, 'loss': 101}])
add('손실 1, 최소', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(6), claims=[{'month': 3, 'loss': 1}])
add('손실이 한도+자기부담금과 정확히 같으면 PAID (1100−100=1000=R) → 소진 종료', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(6), claims=[{'month': 2, 'loss': 1100}])
add('손실이 한도+자기부담금보다 1 크면 PARTIAL 1000 → 소진', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(6), claims=[{'month': 2, 'loss': 1101}])
add('누적: 3월 PAID 600 후 4월 PARTIAL 400', coverageAmount=1000, termMonths=6, riskClass='B', outcomes=n(6), claims=[{'month': 3, 'loss': 700}, {'month': 4, 'loss': 900}])
add('같은 달 두 건: 앞 건이 한도를 소진하면 뒤 건은 EXHAUSTED', coverageAmount=500, termMonths=6, riskClass='A', outcomes=n(6), claims=[{'month': 2, 'loss': 1000}, {'month': 2, 'loss': 300}])
add('같은 달 두 건: 둘 다 PAID', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(6), claims=[{'month': 2, 'loss': 300}, {'month': 2, 'loss': 400}])
add('같은 달 두 건: PAID 후 PARTIAL (200 후 잔여 800 중 손실 1000−100=900>800)', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(6), claims=[{'month': 2, 'loss': 300}, {'month': 2, 'loss': 1000}])
add('소진 달이 만기 달이면 exhausted가 우선', coverageAmount=200, termMonths=6, riskClass='A', outcomes=n(6), claims=[{'month': 6, 'loss': 500}])
add('소진 달에 cancelAt이 겹쳐도 exhausted가 우선', coverageAmount=200, termMonths=12, riskClass='A', outcomes=n(5), claims=[{'month': 5, 'loss': 500}], cancelAt=5)
add('소진 뒤 달의 사고는 목록에 나타나지 않는다', coverageAmount=200, termMonths=12, riskClass='A', outcomes=n(8), claims=[{'month': 3, 'loss': 500}, {'month': 6, 'loss': 500}])
# 미납
add('미납한 달의 사고는 UNPAID', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=[P, P, M, P, P, P], claims=[{'month': 3, 'loss': 500}])
add('미납 다음 달 납입하면 다시 보상', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=[P, P, M, P, P, P], claims=[{'month': 4, 'loss': 500}])
add('1월 미납 + 1월 사고 → WAITING이 UNPAID보다 앞선다', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=[M, P, P, P, P, P], claims=[{'month': 1, 'loss': 500}])
add('1월 미납 후 2월 미납 → 2회 연속, 실효', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=[M, M, P, P], claims=[{'month': 2, 'loss': 500}])
add('1월 미납, 2월 납입은 연속 아님', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=[M, P, P, P, P, P])
add('2회 연속 미납 → 그 달 끝 실효, 그 달 사고는 UNPAID', coverageAmount=1000, termMonths=12, riskClass='B', outcomes=[P, P, M, M, P], claims=[{'month': 4, 'loss': 800}, {'month': 5, 'loss': 800}])
add('만기 달에 2회 연속 미납이면 lapsed (만기 아님)', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=[P, P, P, P, M, M])
add('3월 소진 후 종료하면 뒤의 연속 미납은 읽지 않는다', coverageAmount=200, termMonths=6, riskClass='A', outcomes=[P, P, P, M, M], claims=[{'month': 3, 'loss': 400}])
add('비연속 미납 두 번은 계속 유효', coverageAmount=1000, termMonths=12, riskClass='A', outcomes=[P, M, P, M, P, M, P, P, P, P, P, P])
# 해지
add('4월 말 해지: 환급 없음, 낸 보험료 4회', coverageAmount=1000, termMonths=12, riskClass='A', outcomes=n(4), cancelAt=4)
add('해지 달 사고는 처리한 뒤 해지', coverageAmount=1000, termMonths=12, riskClass='A', outcomes=n(4), claims=[{'month': 4, 'loss': 400}], cancelAt=4)
add('해지 뒤 달에 outcomes가 더 있어도 읽지 않는다', coverageAmount=1000, termMonths=12, riskClass='A', outcomes=n(8), claims=[{'month': 7, 'loss': 400}], cancelAt=3)
add('실효가 cancelAt보다 앞서면 cancelAt 무시', coverageAmount=1000, termMonths=12, riskClass='A', outcomes=[P, P, M, M, P, P], cancelAt=6)
add('cancelAt == termMonths (outcomes 가득) → 만기', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(6), cancelAt=6)
add('cancelAt null', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(6), cancelAt=None)
add('claims null', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(6), claims=None)
# active / 짧은 outcomes
add('outcomes 3개만 → active', coverageAmount=1000, termMonths=12, riskClass='A', outcomes=n(3), claims=[{'month': 2, 'loss': 300}])
add('outcomes 비어 있음 → active, endMonth 0', coverageAmount=1000, termMonths=12, riskClass='A', outcomes=[])
add('active에서 1회 미납', coverageAmount=1000, termMonths=12, riskClass='C', outcomes=[P, M, P])
add('active에서 소진되면 exhausted', coverageAmount=300, termMonths=12, riskClass='A', outcomes=n(4), claims=[{'month': 4, 'loss': 330}])
# 오류
add('COVERAGE 50', coverageAmount=50, termMonths=6, riskClass='A', outcomes=n(6))
add('COVERAGE 10100', coverageAmount=10100, termMonths=6, riskClass='A', outcomes=n(6))
add('COVERAGE 150 (100의 배수 아님)', coverageAmount=150, termMonths=6, riskClass='A', outcomes=n(6))
add('COVERAGE 문자열', coverageAmount='1000', termMonths=6, riskClass='A', outcomes=n(6))
add('COVERAGE 1000.0 = 정수 1000', coverageAmount=1000.0, termMonths=6, riskClass='A', outcomes=n(6))
add('COVERAGE true', coverageAmount=True, termMonths=6, riskClass='A', outcomes=n(6))
add('TERM 3', coverageAmount=1000, termMonths=3, riskClass='A', outcomes=n(3))
add('CLASS D', coverageAmount=1000, termMonths=6, riskClass='D', outcomes=n(6))
add('CLASS 소문자 a', coverageAmount=1000, termMonths=6, riskClass='a', outcomes=n(6))
add('OUTCOMES 길이 초과', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(7))
add('OUTCOMES 원소 이상', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=['paid', 'late'])
add('CLAIMS 월 0', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(6), claims=[{'month': 0, 'loss': 100}])
add('CLAIMS 월이 outcomes 길이 초과', coverageAmount=1000, termMonths=12, riskClass='A', outcomes=n(3), claims=[{'month': 4, 'loss': 100}])
add('CLAIMS loss 0', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(6), claims=[{'month': 2, 'loss': 0}])
add('CLAIMS loss 소수', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(6), claims=[{'month': 2, 'loss': 150.5}])
add('CLAIMS 월 순서 거꾸로', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(6), claims=[{'month': 3, 'loss': 200}, {'month': 2, 'loss': 200}])
add('CLAIMS 배열 아님', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(6), claims={'month': 2, 'loss': 200})
add('CLAIMS 오류는 계약 종료 뒤 사고에도 적용', coverageAmount=1000, termMonths=12, riskClass='A', outcomes=n(8), claims=[{'month': 7, 'loss': 0}], cancelAt=3)
add('CANCEL 0', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(6), cancelAt=0)
add('CANCEL outcomes 길이 초과', coverageAmount=1000, termMonths=12, riskClass='A', outcomes=n(3), cancelAt=4)
add('검사 순서: COVERAGE와 TERM이 모두 틀리면 COVERAGE', coverageAmount=50, termMonths=3, riskClass='D', outcomes=n(9))
add('검사 순서: CLAIMS와 CANCEL이 모두 틀리면 CLAIMS', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(6), claims=[{'month': 0, 'loss': 1}], cancelAt=9)

add('필수 필드 coverageAmount 누락', termMonths=6, riskClass='A', outcomes=n(6))
add('termMonths null', coverageAmount=1000, termMonths=None, riskClass='A', outcomes=n(6))
add('riskClass 누락', coverageAmount=1000, termMonths=6, outcomes=n(6))
add('outcomes 누락', coverageAmount=1000, termMonths=6, riskClass='A')
add('CLAIMS 원소가 null', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(6), claims=[None])
add('CLAIMS 원소에 loss 키 없음', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(6), claims=[{'month': 2}])
add('CLAIMS 원소가 숫자', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(6), claims=[5])
add('CLAIMS 빈 배열', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(6), claims=[])
add('CLAIMS loss가 1000.0 (정수값 실수) → 정수 1000', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(6), claims=[{'month': 2, 'loss': 1000.0}])
add('outcomes가 비어 있는데 사고가 있으면 CLAIMS_INVALID', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=[], claims=[{'month': 1, 'loss': 100}])
add('사고 원소의 추가 키는 무시', coverageAmount=1000, termMonths=6, riskClass='A', outcomes=n(6), claims=[{'month': 2, 'loss': 300, 'memo': 'x'}])
scen = []
for idx, (note, inp) in enumerate(x for x in S if x):
    scen.append({'id': f'ins5-{idx+1:03d}', 'kind': 'insurance', 'product': 'insurance', 'moves_balance': False, 'note': note, 'inputs': inp, 'expected': ref(inp)})
here = os.path.dirname(os.path.abspath(__file__))
json.dump({'schema': 1, 'round': 'r05', 'authored': '2026-10-03', 'note': '보험 명세 v0.1(insurance_v0_1.md) 기준. expected는 gen_scenarios.py의 참조 계산(명세를 구현 코드와 별개로 옮김)이 실행 전에 냈다.', 'scenarios': scen},
          open(os.path.join(here, 'scenarios.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(scen), 'scenarios')
