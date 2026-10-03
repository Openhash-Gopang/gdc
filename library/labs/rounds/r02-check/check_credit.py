# Independent check of GDC credit methodology v1.0 (gdc_credit_v1_0.md), exact arithmetic.
import json, os
from fractions import Fraction as F
from decimal import Decimal, ROUND_HALF_UP

BASE = os.path.dirname(os.path.abspath(__file__))
IN = os.path.join(BASE, '..', 'check-in', 'inputs.json')
OUT = os.path.join(BASE, 'results_check.json')

def num(fs, k):  # §1: bs_ar, bs_debt, pl_cogs, pl_opex empty -> 0
    v = fs.get(k)
    return F(0) if v in (None, '') else F(str(v))

def liquidity(cash, ar, ap):
    if ap <= 0: return 0
    r = (cash + ar) / ap
    if r >= F(2): return 100
    if r >= F(3, 2): return 80
    if r >= F(1): return 60
    if r >= F(1, 2): return 30
    return 10

def debt(d, eq):
    if eq < 0: return 5
    if eq == 0: return 5 if d > 0 else 50   # d<0 with eq=0: not covered; not in inputs
    r = d / eq
    if r <= F(3, 10): return 100
    if r <= F(7, 10): return 80
    if r <= F(3, 2): return 55
    if r <= F(3): return 25
    return 5

def margin(rev, cogs, opex):
    if rev <= 0: return 0
    r = (rev - cogs - opex) / rev
    if r >= F(1, 5): return 100
    if r >= F(1, 10): return 75
    if r >= F(1, 20): return 50
    if r >= 0: return 25
    return 0

def cashflow(cf, d):
    if d <= 0: return 50
    r = cf / d
    if r >= F(1, 2): return 100
    if r >= F(1, 4): return 75
    if r >= F(1, 10): return 50
    if r >= 0: return 20
    return 0

GRADES = [(90, 'AAA', '0.005'), (78, 'AA', '0.01'), (65, 'A', '0.015'),
          (50, 'BBB', '0.025'), (35, 'BB', '0.035'), (None, 'C', '0.05')]

def evaluate(s):
    if not s.get('tester'): return {'id': s['id'], 'error': 'TESTER_ONLY'}
    fs = s['fs']; cash = F(str(s['bsCash']))
    c = {'liquidity': liquidity(cash, num(fs, 'bs_ar'), num(fs, 'bs_ap')),
         'debt': debt(num(fs, 'bs_debt'), num(fs, 'bs_equity')),
         'operatingMargin': margin(num(fs, 'pl_revenue'), num(fs, 'pl_cogs'), num(fs, 'pl_opex')),
         'cashFlow': cashflow(num(fs, 'cf_op'), num(fs, 'bs_debt'))}
    total = (c['liquidity'] * F(1, 4) + c['debt'] * F(1, 4)
             + c['operatingMargin'] * F(3, 10) + c['cashFlow'] * F(1, 5))
    for th, g, rate in GRADES:
        if th is None or total >= th: break
    dec = Decimal(total.numerator) / Decimal(total.denominator)
    shown = dec.quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)
    return {'id': s['id'], 'grade': g, 'annualRate': float(rate), 'score': float(shown),
            'total': float(dec), 'totalExact': str(total), 'componentScores': c}

AMBIG = [
  "§3 debt table: bs_equity = 0 with bs_debt < 0 is not covered (only debt > 0 and debt = 0). Not present in inputs; script treats it as 50 (not > 0).",
  "§3 says boundaries are inclusive 'to the better side'; debt table uses explicit </<= that agree with this (0.3 -> 100, 0.7 -> 80, 1.5 -> 55, 3.0 -> 25). Applied as written; no conflict found.",
  "§4 says annualRate must match the grade table posted on gdc.hondi.net; that table cannot be checked from these two files. Used the document's '구현 값' column.",
  "Output type of the displayed score is not specified (number vs. string); emitted as a number rounded half-up to 1 decimal.",
  "§1/§7: period of pl_* and cf_op (annual vs quarterly) is undefined; it does not change any ratio computed here, so no assumption needed for these results.",
]

if __name__ == '__main__':
    data = json.load(open(IN))
    res = [evaluate(s) for s in data]
    json.dump({'results': res, 'ambiguities': AMBIG}, open(OUT, 'w'), ensure_ascii=False, indent=1)
    for r in res: print(r['id'], r.get('error') or (r['componentScores'], r['totalExact'], r['grade'], r['annualRate'], r['score']))
