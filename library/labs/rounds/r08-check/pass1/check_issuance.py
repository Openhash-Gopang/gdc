import json, math

GRADES = ["AAA", "AA", "A", "BBB", "BB", "C"]


def as_int(v):
    """Return int if v is an integer value (500.0 ok), else None."""
    if isinstance(v, bool) or v is None:
        return None
    if isinstance(v, int):
        return v
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v) or not v.is_integer():
            return None
        return int(v)
    return None


def nonempty_str(v):
    return isinstance(v, str) and len(v) > 0


def validate(inp):
    if not isinstance(inp, dict):
        return "ISSUER_INVALID", None
    if not nonempty_str(inp.get("issuerId")):
        return "ISSUER_INVALID", None
    g = inp.get("grade")
    if not isinstance(g, str) or g not in GRADES:
        return "GRADE_INVALID", None
    val = inp.get("valuation")
    if not isinstance(val, dict):
        return "VALUATION_INVALID", None
    lo, mi, hi = (as_int(val.get(k)) for k in ("low", "mid", "high"))
    if lo is None or mi is None or hi is None or lo < 0 or mi < 0 or hi < 0 or not (lo <= mi <= hi):
        return "VALUATION_INVALID", None
    iu = as_int(inp.get("issuedUnits"))
    if iu is None or iu < 0:
        return "ISSUED_INVALID", None
    ru = as_int(inp.get("requestUnits"))
    if ru is None or ru < 1 or ru > 100000:
        return "REQUEST_INVALID", None
    subs = inp.get("subscriptions")
    if subs is None:
        subs = []
    if not isinstance(subs, list):
        return "SUBSCRIPTIONS_INVALID", None
    clean, seen = [], set()
    for s in subs:
        if not isinstance(s, dict):
            return "SUBSCRIPTIONS_INVALID", None
        sid = s.get("id")
        if not nonempty_str(sid):
            return "SUBSCRIPTIONS_INVALID", None
        u = as_int(s.get("units"))
        if u is None or u < 1:
            return "SUBSCRIPTIONS_INVALID", None
        if sid in seen:
            return "SUBSCRIPTIONS_INVALID", None
        seen.add(sid)
        clean.append((sid, u))
    return None, dict(issuer=inp["issuerId"], grade=g, low=lo, mid=mi, high=hi,
                      issued=iu, req=ru, subs=clean)


def rejected(d, reason, price):
    return dict(status="rejected", reason=reason, priceCents=price, allocations=[],
                unallocatedUnits=d["req"], raisedCents=0, newIssuedUnits=d["issued"],
                postPriceCents=None, bandLowCents=None, bandHighCents=None)


def compute(inp):
    err, d = validate(inp)
    if err:
        return {"error": err}
    if d["grade"] == "C":
        return rejected(d, "GRADE_C", None)
    if d["mid"] == 0:
        return rejected(d, "VALUATION_ZERO", None)
    price = 100 if d["issued"] == 0 else (d["mid"] * 100) // d["issued"]
    if price == 0:
        return rejected(d, "PRICE_ZERO", 0)
    if d["req"] * price * 2 > d["mid"] * 100:
        return rejected(d, "RAISE_CAP", price)
    req = d["req"]
    T = sum(u for _, u in d["subs"])
    cap = (req * 20) // 100
    allocs = []
    for sid, u in d["subs"]:
        cand = u if T <= req else (u * req) // T
        a = min(cand, cap) if sid == d["issuer"] else cand
        allocs.append({"id": sid, "units": a})
    A = sum(x["units"] for x in allocs)
    raised = A * price
    new = d["issued"] + A
    if new == 0:
        post = bl = bh = None
    else:
        post = (d["mid"] * 100 + raised) // new
        bl = (d["low"] * 100 + raised) // new
        bh = -((-(d["high"] * 100 + raised)) // new)
    return dict(status="issued", reason=None, priceCents=price, allocations=allocs,
                unallocatedUnits=req - A, raisedCents=raised, newIssuedUnits=new,
                postPriceCents=post, bandLowCents=bl, bandHighCents=bh)


AMBIGUITIES = [
    "오류 검사(§1)는 발행 판정(§2) 거절보다 먼저 한다고 가정함(예: grade C이면서 subscriptions 오류인 경우 error 반환).",
    "valuation 객체에서 low/mid/high 중 하나가 없거나 null이면 VALUATION_INVALID로 봄(원소 규칙 '조건 불만족'을 valuation 하위 키에도 적용).",
    "내부자 상한은 1단계 안분 후보에 적용하고, 상한으로 줄어든 수량을 다른 청약자에게 재배분하지 않음(명세 문장대로 미배정 처리).",
    "배정이 0인 청약자도 allocations에 units 0으로 포함함(입력 순서 유지).",
    "내부자 판정의 '같다'는 대소문자 구분 정확 일치로 봄(\"CO\" ≠ \"co\").",
    "issuedUnits=0이고 배정 A>0일 때 newIssuedUnits=A, post/band 계산은 그대로 적용(명세상 특례 없음).",
    "valuation이 객체가 아닌 null(필드 존재하지만 null)도 VALUATION_INVALID로 봄.",
]


def main():
    with open("inputs.json") as f:
        cases = json.load(f)
    results = []
    for c in cases:
        r = {"id": c["id"]}
        r.update(compute(c.get("inputs")))
        results.append(r)
    with open("results_check.json", "w") as f:
        json.dump({"results": results, "ambiguities": AMBIGUITIES}, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
