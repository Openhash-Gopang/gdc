#!/usr/bin/env python3
"""R07 적금 v0.2(수익 연동 이자) 시나리오 생성기. expected는 구현(js)을 보지 않고 명세 savings_v0_2.md 를 따로 옮긴 참조 계산(정수 산술)이 낸다."""
import json, os
P, M = 'paid', 'missed'

def isint(v):
    return not isinstance(v, bool) and (isinstance(v, int) or (isinstance(v, float) and v.is_integer()))

def ref(i):
    amt, term, out, st, cancel = i.get('monthlyAmount'), i.get('termMonths'), i.get('outcomes'), i.get('settlements'), i.get('cancelAt')
    if not isint(amt) or not (100 <= amt <= 1000): return {'error': 'AMOUNT_INVALID'}
    if not isint(term) or term not in (6, 12): return {'error': 'TERM_INVALID'}
    if not isinstance(out, list) or len(out) > term or any(o not in (P, M) for o in out): return {'error': 'OUTCOMES_INVALID'}
    if not isinstance(st, list) or len(st) != len(out): return {'error': 'SETTLEMENTS_INVALID'}
    for s in st:
        if not isinstance(s, dict) or not isint(s.get('poolCents')) or s['poolCents'] < 0 or not isint(s.get('totalBalance')) or s['totalBalance'] < 0:
            return {'error': 'SETTLEMENTS_INVALID'}
    if cancel is not None and (not isint(cancel) or cancel < 1 or cancel > term or cancel > len(out)): return {'error': 'CANCEL_INVALID'}
    amt = int(amt)
    paid, acc, status, end = 0, 0, 'active', 0
    for k in range(1, len(out) + 1):
        end = k
        if out[k-1] == P: paid += 1
        bal = paid * amt
        tb = int(st[k-1]['totalBalance'])
        if bal > tb: return {'error': 'SETTLEMENT_INCONSISTENT'}
        if bal > 0: acc += int(st[k-1]['poolCents']) * bal // tb
        if out[k-1] == M and k >= 2 and out[k-2] == M: status = 'auto_terminated'; break
        if cancel == k and k < term: status = 'cancelled'; break
        if k == term: status = 'matured'; break
    principal = paid * amt
    if status == 'active': return {'status': status, 'endMonth': end, 'paidCount': paid, 'principal': principal, 'accruedCents': acc, 'interest': 0, 'payout': None}
    ic = acc if status == 'matured' else acc // 2
    return {'status': status, 'endMonth': end, 'paidCount': paid, 'principal': principal, 'accruedCents': acc, 'interest': ic / 100, 'payout': (principal * 100 + ic) / 100}

S = []
def add(note, **inp): S.append((note, inp))
def n(x, v=P): return [v] * x
def sett(k, pool=100, tb=10000): return [{'poolCents': pool, 'totalBalance': tb} for _ in range(k)]
def b(term=6, amt=500, out=None, st=None, **kw):
    out = n(term) if out is None else out
    d = dict(monthlyAmount=amt, termMonths=term, outcomes=out, settlements=sett(len(out)) if st is None else st)
    d.update(kw); return d

add('6개월 전부 납입, 재원 일정: 잔액 500..3000, 전체 10000, 재원 100센트/월', **b())
add('12개월 전부 납입, 재원 100/월, 전체 20000', **b(12, 1000, st=sett(12, 100, 20000)))
add('재원이 전부 0 → 이자 0, 원금만', **b(st=sett(6, 0, 10000)))
add('계약이 전체 잔액의 전부(totalBalance == 잔액): 재원 전부를 받는다', **b(6, 500, st=[{'poolCents': 77, 'totalBalance': 500 * (k + 1)} for k in range(6)]))
add('totalBalance가 잔액보다 작으면 SETTLEMENT_INCONSISTENT', **b(6, 500, st=[{'poolCents': 10, 'totalBalance': 499}] + sett(5)))
add('1월은 정상, 3월에 불일치(잔액 1500 > 1400) → 오류', **b(6, 500, st=[{'poolCents': 10, 'totalBalance': 1000}, {'poolCents': 10, 'totalBalance': 1000}, {'poolCents': 10, 'totalBalance': 1400}] + sett(3)))
add('몫 버림: 100*500/1500 = 33.33 → 33', **b(6, 500, out=n(1), st=[{'poolCents': 100, 'totalBalance': 1500}]))
add('달마다 버림 후 합산 (50 + 66 = 116 ...)', **b(6, 500, out=n(3), st=[{'poolCents': 100, 'totalBalance': 1000}, {'poolCents': 100, 'totalBalance': 1500}, {'poolCents': 0, 'totalBalance': 2000}]))
add('active: 이자 0, payout null, accruedCents는 보인다', **b(12, 300, out=n(4)))
add('outcomes 비어 있음 → active, endMonth 0', **b(12, 300, out=[], st=[]))
add('미납 달에도 잔액은 유지되어 이자가 계속 발생', **b(6, 400, out=[P, M, P, M, P, P], st=sett(6, 200, 5000)))
add('1월 미납: 잔액 0인 달은 이자 0 (totalBalance 0이어도 오류 아님)', **b(6, 400, out=[M, P, P, P, P, P], st=[{'poolCents': 50, 'totalBalance': 0}] + sett(5, 50, 5000)))
add('1월 미납, totalBalance 0, 잔액 0 → 0', **b(6, 400, out=[M], st=[{'poolCents': 50, 'totalBalance': 0}]))
add('2회 연속 미납 → 자동 해지, 이자는 발생분의 절반', **b(12, 500, out=[P, P, M, M, P], st=sett(5, 100, 4000)))
add('1월 미납 후 2월 미납 → 2월 끝 자동 해지, 원금 0, 이자 0', **b(6, 500, out=[M, M], st=sett(2, 100, 4000)))
add('1월 미납 후 2월 납입은 연속 아님', **b(6, 500, out=[M, P, P, P, P, P], st=sett(6, 100, 4000)))
add('사용자 해지: 4월 말, 이자는 발생분의 절반(버림)', **b(12, 600, out=n(4), st=sett(4, 101, 3000), cancelAt=4))
add('해지 이자 절반 버림: 발생분 홀수 센트', **b(12, 500, out=n(2), st=[{'poolCents': 3, 'totalBalance': 500}, {'poolCents': 3, 'totalBalance': 1000}], cancelAt=2))
add('cancelAt == termMonths → 만기 (이자 전부)', **b(6, 500, out=n(6), st=sett(6, 100, 4000), cancelAt=6))
add('자동 해지가 cancelAt보다 앞서면 cancelAt 무시', **b(12, 500, out=[P, M, M, P, P, P], st=sett(6, 100, 4000), cancelAt=6))
add('해지 뒤 달의 입력은 읽지 않는다 (불일치가 뒤에 있어도 오류 아님)', **b(12, 500, out=n(8), st=sett(3, 100, 4000) + [{'poolCents': 100, 'totalBalance': 1}] * 5, cancelAt=3))
add('만기 달 2회 연속 미납 → auto_terminated', **b(6, 500, out=[P, P, P, P, M, M], st=sett(6, 100, 4000)))
add('cancelAt null', **b(6, 500, st=sett(6, 100, 4000), cancelAt=None))
add('rateBp 같은 추가 키는 무시', **b(6, 500, st=sett(6, 100, 4000), rateBp=50))
add('큰 재원: poolCents 1000000, 잔액 비중 5%', **b(6, 500, out=n(1), st=[{'poolCents': 1000000, 'totalBalance': 10000}]))
add('totalBalance가 잔액과 같은 경계 (500 == 500) 허용', **b(6, 500, out=n(1), st=[{'poolCents': 10, 'totalBalance': 500}]))
add('최소 납입 100, 최대 1000 모두 정상', **b(6, 100, st=sett(6, 100, 5000)))
add('1000.0 은 정수', **b(6, 1000.0, out=n(1), st=sett(1, 10, 2000)))
# 오류
add('AMOUNT 99', **b(6, 99))
add('AMOUNT 1001', **b(6, 1001))
add('AMOUNT 누락', termMonths=6, outcomes=n(1), settlements=sett(1))
add('TERM 9', **b(9, 500, out=n(1)))
add('OUTCOMES 길이 초과', **b(6, 500, out=n(7), st=sett(7)))
add('OUTCOMES 원소 이상', **b(6, 500, out=['paid', 'late'], st=sett(2)))
add('SETTLEMENTS 누락', monthlyAmount=500, termMonths=6, outcomes=n(2))
add('SETTLEMENTS null', **b(6, 500, out=n(2), st=None) | {'settlements': None})
add('SETTLEMENTS 길이가 outcomes보다 짧음', **b(6, 500, out=n(3), st=sett(2)))
add('SETTLEMENTS 길이가 outcomes보다 김', **b(6, 500, out=n(2), st=sett(3)))
add('SETTLEMENTS poolCents 음수', **b(6, 500, out=n(1), st=[{'poolCents': -1, 'totalBalance': 1000}]))
add('SETTLEMENTS totalBalance 소수', **b(6, 500, out=n(1), st=[{'poolCents': 1, 'totalBalance': 1000.5}]))
add('SETTLEMENTS 원소 null', **b(6, 500, out=n(1), st=[None]))
add('SETTLEMENTS 키 누락', **b(6, 500, out=n(1), st=[{'poolCents': 1}]))
add('SETTLEMENTS 형식 오류는 종료 뒤 달에도 적용', **b(12, 500, out=n(8), st=sett(7) + [{'poolCents': -5, 'totalBalance': 1}], cancelAt=3))
add('CANCEL 0', **b(6, 500, st=sett(6), cancelAt=0))
add('CANCEL outcomes 길이 초과', **b(12, 500, out=n(3), st=sett(3), cancelAt=4))
add('검사 순서: AMOUNT와 SETTLEMENTS가 모두 틀리면 AMOUNT', monthlyAmount=50, termMonths=6, outcomes=n(2), settlements=[])
add('검사 순서: SETTLEMENTS와 CANCEL이 모두 틀리면 SETTLEMENTS', **b(6, 500, out=n(2), st=sett(1), cancelAt=9))
add('검사 순서: 형식이 맞고 불일치와 CANCEL 이 없으면 SETTLEMENT_INCONSISTENT 는 처리 중에만', **b(6, 500, out=n(1), st=[{'poolCents': 1, 'totalBalance': 100}]))

scen = [{'id': f'sav7-{i+1:03d}', 'kind': 'savings_linked', 'product': 'savings', 'moves_balance': False, 'note': nt, 'inputs': inp, 'expected': ref(inp)} for i, (nt, inp) in enumerate(S)]
here = os.path.dirname(os.path.abspath(__file__))
json.dump({'schema': 1, 'round': 'r07', 'authored': '2026-10-03', 'note': '적금 명세 v0.2(savings_v0_2.md, 수익 연동 이자) 기준. expected는 gen_scenarios.py의 참조 계산(명세를 구현 코드와 별개로 옮김)이 실행 전에 냈다.', 'scenarios': scen},
          open(os.path.join(here, 'scenarios.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(scen), 'scenarios')
