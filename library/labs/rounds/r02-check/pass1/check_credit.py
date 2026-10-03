import json
from fractions import Fraction as F
from decimal import Decimal, ROUND_HALF_UP
D='/tmp/claude-0/-home-claude/712d7069-ecad-54cf-8362-390b701dbf1a/scratchpad/'
inp=json.load(open(D+'check-in/inputs.json'))
def tiers(r,t,low):
    for th,s in t:
        if r>=th: return s
    return low
def fl(x): return None if x is None else float(x)
out=[]
for sc in inp:
    if not sc['tester']:
        out.append({"id":sc['id'],"error":"TESTER_ONLY"}); continue
    fs=sc['fs']; g=lambda k:F(fs.get(k,0) or 0)
    cash=F(sc['bsCash']); ar,ap,debt,eq,rev,cogs,opex,cf=[g(k) for k in ['bs_ar','bs_ap','bs_debt','bs_equity','pl_revenue','pl_cogs','pl_opex','cf_op']]
    # liquidity
    if ap<=0: lr=None; ls=0
    else: lr=(cash+ar)/ap; ls=tiers(lr,[(F(2),100),(F(3,2),80),(F(1),60),(F(1,2),30)],10)
    # debt
    if eq<0: dr=None; ds=5
    elif eq==0: dr=None; ds=5 if debt>0 else 50
    else:
        dr=debt/eq
        ds=100 if dr<=F(3,10) else 80 if dr<=F(7,10) else 55 if dr<=F(3,2) else 25 if dr<=3 else 5
    # margin
    if rev<=0: mr=None; ms=0
    else:
        mr=(rev-cogs-opex)/rev
        ms=tiers(mr,[(F(1,5),100),(F(1,10),75),(F(1,20),50),(F(0),25)],0)
    # cash flow
    if debt<=0: cr=None; cs=50
    else:
        cr=cf/debt; cs=tiers(cr,[(F(1,2),100),(F(1,4),75),(F(1,10),50),(F(0),20)],0)
    tot=ls*F(1,4)+ds*F(1,4)+ms*F(3,10)+cs*F(1,5)
    grade,rate=next((gr,rt) for th,gr,rt in [(90,'AAA',0.5),(78,'AA',1.0),(65,'A',1.5),(50,'BBB',2.5),(35,'BB',3.5),(-10**9,'C',5.0)] if tot>=th)
    disp=float((Decimal(tot.numerator)/Decimal(tot.denominator)).quantize(Decimal('0.1'),ROUND_HALF_UP))
    out.append({"id":sc['id'],"ratios":{"liquidity":fl(lr),"debtRatio":fl(dr),"operatingMargin":fl(mr),"cashFlowRatio":fl(cr)},
      "componentScores":{"liquidity":ls,"debt":ds,"operatingMargin":ms,"cashFlow":cs},
      "total":float(tot),"totalExact":str(tot),"grade":grade,"annualRate":rate,"score":disp})
amb=[
"Display rounding: '소수 첫째 자리로 반올림' does not specify the tie rule. Totals are multiples of 0.25, so x.25/x.75 ties occur; assumed round-half-up (conventional meaning of 반올림), not banker's rounding or JS toFixed binary behaviour.",
"annualRate unit: table gives percent; output annualRate as the percent number (e.g. 1.5 means 1.5%/yr). §4 also requires rates to equal the table posted at gdc.hondi.net, which cannot be verified from the document alone.",
"Debt-ratio table rows after '`bs_equity` > 0 이고 비율 ≤ 0.3' (≤0.7, ≤1.5, ≤3.0, >3.0) do not repeat the equity>0 condition; assumed they apply only when bs_equity > 0 (the only case where the ratio is defined). debtRatio reported as null whenever bs_equity ≤ 0.",
"§2 says 'denominator ≤ 0 → ratio undefined, scored per §3', while §3 debt rule splits equity<0 vs =0 by bs_debt; followed §3. bs_equity < 0 with bs_debt = 0 (cred2-003) gets 5 per the table row 'bs_equity < 0 → 5', consistent with §6's affected-input statement.",
"§4 claims '900 combinations' of component scores; distinct score values per metric are 5 (liquidity: 0,10,30,60,80,100 = 6 actually), so the count depends on how one enumerates (e.g. liquidity 6 values incl. 0, debt 6 distinct, margin 5, cash flow 5 distinct -> 900 only with 6x6x5x5). Not used in computation; noted only as an unverifiable claim. Also totals are actually multiples of 0.25, not merely 0.05 (consistent with the claim, not contradicting it).",
"Inputs are passed with bsCash outside fs and an extra 'tester' flag; the document defines tester eligibility as having a gdc_test_financial_statements record, assumed equivalent to tester=true. No inputs contain non-numeric/missing values, negative bs_debt, or bs_inventory, so those undefined/unused cases were not exercised.",
"pl_*/cf_op period (annual vs quarterly) is undefined (§7.5); ratios computed directly from the given numbers with no annualisation."
]
json.dump({"results":out,"ambiguities":amb},open(D+'check-out/results_check.json','w'),ensure_ascii=False,indent=1)
for r in out: print(r['id'],r.get('componentScores'),r.get('totalExact'),r.get('grade'),r.get('score'),r.get('error',''))
