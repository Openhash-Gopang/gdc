#!/usr/bin/env python3
"""Independent check: GDC valuation v0.1 (+ credit v1.0 grading). Exact arithmetic only."""
import json, os
from decimal import Decimal
from fractions import Fraction as F

BASE = os.path.dirname(os.path.abspath(__file__))
IN = os.path.join(BASE, '..', 'check4-in', 'inputs.json')
OUT = os.path.join(BASE, 'results_check.json')

FS_FIELDS = ['bs_ar', 'bs_ap', 'bs_debt', 'bs_equity', 'pl_revenue', 'pl_cogs', 'pl_opex', 'cf_op']
NONNEG = {'bsCash', 'bs_ar', 'bs_ap', 'bs_debt', 'pl_revenue', 'pl_cogs', 'pl_opex'}
MULT = {'AAA': 12, 'AA': 10, 'A': 8, 'BBB': 6, 'BB': 4, 'C': 2}

class Invalid(Exception):
    pass

def to_int(v):
    """valuation §1: integers only; integer-valued real (1000.0) is integer; bool/str/null are not."""
    if isinstance(v, bool) or v is None:
        raise Invalid
    if isinstance(v, int):
        return v
    if isinstance(v, Decimal):          # JSON reals parsed exactly
        if not v.is_finite() or v != v.to_integral_value():
            raise Invalid
        return int(v)
    raise Invalid                       # str, list, dict ...

def score_current(cash, ar, ap):
    if ap <= 0:
        return 0
    r = F(cash + ar, ap)
    if r >= 2: return 100
    if r >= F(3, 2): return 80
    if r >= 1: return 60
    if r >= F(1, 2): return 30
    return 10

def score_debt(debt, eq):
    if eq < 0: return 5
    if eq == 0: return 5 if debt > 0 else 50   # debt<0 impossible after validation
    r = F(debt, eq)
    if r <= F(3, 10): return 100
    if r <= F(7, 10): return 80
    if r <= F(3, 2): return 55
    if r <= 3: return 25
    return 5

def score_margin(rev, cogs, opex):
    if rev <= 0:
        return 0
    r = F(rev - cogs - opex, rev)
    if r >= F(1, 5): return 100
    if r >= F(1, 10): return 75
    if r >= F(1, 20): return 50
    if r >= 0: return 25
    return 0

def score_cf(cf, debt):
    if debt <= 0:
        return 50
    r = F(cf, debt)
    if r >= F(1, 2): return 100
    if r >= F(1, 4): return 75
    if r >= F(1, 10): return 50
    if r >= 0: return 20
    return 0

def grade_of(v):
    s = (F(25, 100) * score_current(v['bsCash'], v['bs_ar'], v['bs_ap'])
         + F(25, 100) * score_debt(v['bs_debt'], v['bs_equity'])
         + F(30, 100) * score_margin(v['pl_revenue'], v['pl_cogs'], v['pl_opex'])
         + F(20, 100) * score_cf(v['cf_op'], v['bs_debt']))
    for th, g in ((90, 'AAA'), (78, 'AA'), (65, 'A'), (50, 'BBB'), (35, 'BB')):
        if s >= th:
            return g, s
    return 'C', s

def evaluate(inp):
    # ① tester (only boolean true counts)
    if inp.get('tester') is not True:
        return {'error': 'TESTER_ONLY'}
    # ② validity
    fs = inp.get('fs') or {}
    raw = {'bsCash': inp.get('bsCash', 0)} if 'bsCash' in inp else {'bsCash': 0}
    for k in FS_FIELDS:
        raw[k] = fs[k] if k in fs else 0
    v = {}
    try:
        for k, x in raw.items():
            n = to_int(x)
            if k in NONNEG and n < 0:
                raise Invalid
            v[k] = n
    except Invalid:
        return {'error': 'INPUT_INVALID'}
    # ③ compute
    g, _ = grade_of(v)
    m = MULT[g]
    nav = max(0, v['bs_equity'])
    op = v['pl_revenue'] - v['pl_cogs'] - v['pl_opex']
    ev = max(0, op) * m
    cv = max(0, v['cf_op']) * m
    n = 40 * nav + 30 * ev + 30 * cv
    mid = (n + 50) // 100
    lo, hi = min(nav, ev, cv), max(nav, ev, cv)
    assert lo <= mid <= hi
    return {'grade': g, 'multiple': m, 'nav': nav, 'earningsValue': ev, 'cashFlowValue': cv,
            'low': lo, 'mid': mid, 'high': hi}

AMBIGUITIES = [
    "테스터 판정: 문서는 '테스터 여부'만 말함. inputs.tester가 불리언 true일 때만 테스터로 보고, false·누락·기타 값은 TESTER_ONLY로 가정.",
    "null 값: '필드가 없으면 0'과 '숫자가 아님→INPUT_INVALID' 중 어느 쪽인지 침묵. 키가 있고 값이 null이면 숫자가 아니므로 INPUT_INVALID로 가정(이번 입력에는 해당 사례 없음).",
    "bsCash 누락: 신용 v1.0 §1은 bsCash 누락 시 처리를 '정의하지 않음'이나 가치평가 v0.1 §1 '필드가 없으면 0'이 우선한다고 보고 0으로 가정(이번 입력에는 해당 사례 없음).",
    "정수값 실수(1000.0)는 정수로 받아 계산(val4-032). 큰 지수 표기·NaN/Infinity 등은 다루지 않음(입력에 없음).",
    "등급 계산은 신용 v1.0 §2~§4를 정확한 유리수로 수행(경계 '이상/이하' 포함, 반올림 없는 총점으로 등급). 신용 v1.0 §1의 '정의하지 않음' 영역은 가치평가 v0.1 §1의 유효성 검사로 먼저 걸러진다고 가정.",
]

def main():
    with open(IN, encoding='utf-8') as f:
        scen = json.load(f, parse_float=Decimal)
    results = []
    for s in scen:
        r = {'id': s['id']}
        r.update(evaluate(s['inputs']))
        results.append(r)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump({'ambiguities': AMBIGUITIES, 'results': results}, f, ensure_ascii=False, indent=1)
    for r in results:
        print(r)
    print(len(results), 'scenarios')

if __name__ == '__main__':
    main()
