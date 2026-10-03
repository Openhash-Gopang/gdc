import json, math
GRADES = {"AAA","AA","A","BBB","BB","C"}
def toint(v):
    if isinstance(v, bool): return None
    if isinstance(v, int): return v
    if isinstance(v, float) and math.isfinite(v) and v.is_integer(): return int(v)
    return None
def nonneg(v):
    i = toint(v); return i if i is not None and i >= 0 else None
def ok_id(v): return isinstance(v, str) and v != ""

def run(inp):
    principal = nonneg(inp.get("principal"))
    if principal is None: return {"error":"PRINCIPAL_INVALID"}
    pos = inp.get("positions")
    if pos is None: pos = []
    if not isinstance(pos, list): return {"error":"POSITIONS_INVALID"}
    P=[]; seen=set()
    for e in pos:
        if not isinstance(e, dict) or not ok_id(e.get("id")) or e.get("grade") not in GRADES:
            return {"error":"POSITIONS_INVALID"}
        c = toint(e.get("cost")); inc = nonneg(e.get("income"))
        if c is None or c < 1 or inc is None or e["id"] in seen: return {"error":"POSITIONS_INVALID"}
        seen.add(e["id"]); P.append((e["grade"], c, inc))
    sc = nonneg(inp.get("serverCost"))
    if sc is None: return {"error":"COST_INVALID"}
    cd = nonneg(inp.get("carryDeficit"))
    if cd is None: return {"error":"CARRY_INVALID"}
    bp = nonneg(inp.get("payoutBp"))
    if bp is None or bp > 8000: return {"error":"PAYOUT_INVALID"}
    dep = inp.get("depositors")
    if dep is None: dep = []
    if not isinstance(dep, list): return {"error":"DEPOSITORS_INVALID"}
    D=[]; seen=set()
    for e in dep:
        if not isinstance(e, dict) or not ok_id(e.get("id")): return {"error":"DEPOSITORS_INVALID"}
        w = nonneg(e.get("weight")); pr = nonneg(e.get("promised"))
        if w is None or pr is None or e["id"] in seen: return {"error":"DEPOSITORS_INVALID"}
        seen.add(e["id"]); D.append((e["id"], w, pr))
    invested = sum(c for _,c,_ in P)
    v=[]
    if any(g=="C" for g,_,_ in P): v.append("GRADE_C")
    if P and (principal==0 or any(c*5>principal for _,c,_ in P)): v.append("ISSUER_CONCENTRATION")
    if P and (principal==0 or invested*10>principal*7): v.append("INVESTED_CAP")
    gross = sum(i for _,_,i in P)
    net = gross - sc
    ac = net - cd
    if ac >= 0: dist, newc = ac, 0
    else: dist, newc = 0, -ac
    pool = (dist*bp)//100
    W = sum(w for _,w,_ in D)
    shares = [{"id":i,"cents": (pool*w)//W if W>0 else 0} for i,w,_ in D]
    und = dist*100 - sum(s["cents"] for s in shares)
    obl = sum(p for *_,p in D)
    return {"compliant": not v, "violations": v, "investedCost": invested, "grossIncome": gross,
            "net": net, "distributable": dist, "newCarry": newc, "poolCents": pool, "shares": shares,
            "undistributedCents": und, "obligationCents": obl, "shortfallCents": max(0, obl - dist*100)}

amb = [
 "오류 검사는 표의 행 순서(필드 단위)대로 첫 실패를 반환한다고 해석함 (예: payoutBp 9000 + depositors 문자열 → PAYOUT_INVALID). 한 필드 내 원소 검사 순서는 같은 코드라 결과 무관.",
 "positions/depositors 생략·null이면 shares=[] , W=0 → undistributedCents = distributable×100 으로 계산.",
 "id '비어 있지 않은 문자열': 공백만 있는 문자열(예: ' ')도 비어 있지 않은 것으로 봄(명세 침묵; 시나리오에는 없음).",
 "정수형 실수(1000.0)는 출력에서 정수로 정규화함. JSON 지수표기/매우 큰 수(정밀도 손실 float)의 처리 기준은 명세가 침묵.",
 "principal=0이고 종목이 있으면 ISSUER_CONCENTRATION과 INVESTED_CAP이 둘 다 위반(cost≥1이므로 식으로도 동일)으로 둘 다 기록.",
 "net이 음수여도 출력 net은 음수 그대로, poolCents는 distributable(≥0) 기준이라 floor 음수 처리 문제 없음.",
 "최상위 inputs가 객체가 아닌 경우의 처리는 명세가 침묵(시나리오에는 없음).",
]
inputs = json.load(open("inputs.json"))
out = {"results":[dict({"id":s["id"]}, **run(s["inputs"])) for s in inputs], "ambiguities": amb}
json.dump(out, open("results_check.json","w"), ensure_ascii=False, indent=1)
for r in out["results"]: print(json.dumps(r, ensure_ascii=False))
