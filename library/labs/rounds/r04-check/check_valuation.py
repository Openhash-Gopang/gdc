#!/usr/bin/env python3
"""Independent check of GDC valuation v0.1 (grade via credit v1.0). Exact arithmetic only."""
import json, sys, os
from decimal import Decimal
from fractions import Fraction as F

HERE = os.path.dirname(os.path.abspath(__file__))
IN = os.path.join(HERE, '..', 'check4-in', 'inputs.json')
OUT = os.path.join(HERE, 'results_check.json')

FIELDS = ['bs_ar', 'bs_ap', 'bs_debt', 'bs_equity', 'pl_revenue', 'pl_cogs', 'pl_opex', 'cf_op']
NONNEG = {'bsCash', 'bs_ar', 'bs_ap', 'bs_debt', 'pl_revenue', 'pl_cogs', 'pl_opex'}
MULT = {'AAA': 12, 'AA': 10, 'A': 8, 'BBB': 6, 'BB': 4, 'C': 2}

class Invalid(Exception):
    pass

def to_int(v):
    """valuation §1: missing/null -> 0; integer or integer-valued number -> int; else INPUT_INVALID."""
    if v is None:
        return 0
    if isinstance(v, bool):           # bool is not an integer (check before int)
        raise Invalid('bool')
    if isinstance(v, int):
        return v
    if isinstance(v, Decimal):        # JSON non-integer literal, parsed exactly
        if not v.is_finite() or v != v.to_integral_value():
            raise Invalid('non-integer')
        return int(v)
    raise Invalid('non-numeric')      # str, list, dict, ...

def credit_grade(c, ar, ap, debt, eq, rev, cogs, opex, cfo):
    # Liquidity
    if ap <= 0:
        L = 0
    else:
        r = F(c + ar, ap)
        L = 100 if r >= 2 else 80 if r >= F(3, 2) else 60 if r >= 1 else 30 if r >= F(1, 2) else 10
    # Debt ratio (equity sign first)
    if eq < 0:
        D = 5
    elif eq == 0:
        D = 5 if debt > 0 else 50
    else:
        r = F(debt, eq)
        D = 100 if r <= F(3, 10) else 80 if r <= F(7, 10) else 55 if r <= F(3, 2) else 25 if r <= 3 else 5
    # Operating margin
    if rev <= 0:
        P = 0
    else:
        r = F(rev - cogs - opex, rev)
        P = 100 if r >= F(1, 5) else 75 if r >= F(1, 10) else 50 if r >= F(1, 20) else 25 if r >= 0 else 0
    # Cash-flow ratio
    if debt <= 0:
        C = 50
    else:
        r = F(cfo, debt)
        C = 100 if r >= F(1, 2) else 75 if r >= F(1, 4) else 50 if r >= F(1, 10) else 20 if r >= 0 else 0
    total100 = 25 * L + 25 * D + 30 * P + 20 * C   # = total score x 100, exact
    if total100 >= 9000: g = 'AAA'
    elif total100 >= 7800: g = 'AA'
    elif total100 >= 6500: g = 'A'
    elif total100 >= 5000: g = 'BBB'
    elif total100 >= 3500: g = 'BB'
    else: g = 'C'
    return g, (L, D, P, C, F(total100, 100))

def evaluate(inp):
    # ① tester: only boolean true
    if inp.get('tester') is not True:
        return {'error': 'TESTER_ONLY'}
    # ② validity
    fs = inp.get('fs')
    if fs is None:
        fs = {}
    if not isinstance(fs, dict):
        return {'error': 'INPUT_INVALID'}
    try:
        vals = {'bsCash': to_int(inp.get('bsCash'))}
        for k in FIELDS:
            vals[k] = to_int(fs.get(k))
    except Invalid:
        return {'error': 'INPUT_INVALID'}
    for k in NONNEG:
        if vals[k] < 0:
            return {'error': 'INPUT_INVALID'}
    # ③ compute
    g, dbg = credit_grade(vals['bsCash'], vals['bs_ar'], vals['bs_ap'], vals['bs_debt'], vals['bs_equity'],
                          vals['pl_revenue'], vals['pl_cogs'], vals['pl_opex'], vals['cf_op'])
    m = MULT[g]
    nav = max(0, vals['bs_equity'])
    op = vals['pl_revenue'] - vals['pl_cogs'] - vals['pl_opex']
    ev = max(0, op) * m
    cv = max(0, vals['cf_op']) * m
    N = 40 * nav + 30 * ev + 30 * cv
    mid = (N + 50) // 100
    low, high = min(nav, ev, cv), max(nav, ev, cv)
    assert low <= mid <= high
    return {'grade': g, 'multiple': m, 'nav': nav, 'earningsValue': ev, 'cashFlowValue': cv,
            'low': low, 'mid': mid, 'high': high}, dbg

AMBIGUITIES = [
    "tester 값이 true/false/생략이 아닌 경우(예: 문자열 \"true\", 숫자 1, null)는 문서가 '불리언 tester'·'true일 때만'이라고만 함 -> 엄격히 불리언 true만 테스터로 가정 (이번 입력엔 해당 사례 없음)",
    "fs 객체 자체가 없거나 null/비객체인 경우 미정의 -> 없거나 null이면 모든 fs 필드 0, 비객체면 INPUT_INVALID로 가정 (해당 사례 없음)",
    "'그 밖의 비숫자 값'에 배열·객체가 포함되는지 명시 없음 -> INPUT_INVALID로 가정 (해당 사례 없음)",
    "정수값 실수 판정 기준: 1000.0 외에 1e3 같은 지수 표기, 2^53 초과 실수 등은 언급 없음 -> JSON 리터럴을 Decimal로 정확히 읽어 값이 정수이면 정수로 봄",
    "inputs.json에서 bsCash는 fs 밖 최상위, 나머지는 fs 안에 있음 -> fs 안의 bsCash나 최상위의 다른 필드는 무시한다고 가정 (해당 사례 없음)",
    "신용평가 v1.0 §1은 bsCash·bs_ap·bs_equity·pl_revenue·cf_op의 누락/비숫자, 음수 bs_debt 결과를 미정의로 두나, 가치평가 v0.1 §1(누락·null=0, 음수 불가 항목은 INPUT_INVALID)이 우선한다고 보고 적용함",
    "정의되지 않은 추가 필드(bs_inventory 등)는 유효성 검사 대상이 아니라고 가정 (해당 사례 없음)",
]

def main():
    with open(IN) as f:
        data = json.load(f, parse_float=Decimal)
    results = []
    for sc in data:
        r = evaluate(sc['inputs'])
        if isinstance(r, tuple):
            r, dbg = r
            print(sc['id'], 'scores L/D/P/C=', dbg[:4], 'total=', float(dbg[4]), r)
        else:
            print(sc['id'], r)
        results.append({'id': sc['id'], **r})
    with open(OUT, 'w') as f:
        json.dump({'ambiguities': AMBIGUITIES, 'results': results}, f, ensure_ascii=False, indent=1)
    print('scenarios:', len(results))

if __name__ == '__main__':
    main()
