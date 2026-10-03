#!/usr/bin/env python3
"""Independent check of savings_v0_1.md using exact integer arithmetic."""
import json, os
from fractions import Fraction

BASE = os.path.dirname(os.path.abspath(__file__))
IN = os.path.join(BASE, "..", "check3-in", "inputs.json")
OUT = os.path.join(BASE, "results_check.json")

def as_int(v):
    """Return int if v is an integer value (500.0 -> 500), else None. bool is rejected (assumption)."""
    if isinstance(v, bool):
        return None
    if isinstance(v, int):
        return v
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return None

def validate(inp):
    term_raw = inp.get("termMonths")
    a = as_int(inp.get("monthlyAmount"))
    if a is None or not (100 <= a <= 1000):
        return "AMOUNT_INVALID"
    t = as_int(term_raw)
    if t not in (6, 12):
        return "TERM_INVALID"
    rate_raw = inp.get("rateBp", 0)  # assumption: missing rateBp -> default 0
    r = as_int(rate_raw)
    if r is None or not (0 <= r <= 50):
        return "RATE_INVALID"
    o = inp.get("outcomes")
    if not isinstance(o, list) or any(x not in ("paid", "missed") for x in o) or len(o) > t:
        return "OUTCOMES_INVALID"
    c = inp.get("cancelAt")
    if c is not None:
        ci = as_int(c)
        if ci is None or ci < 1 or ci > t or ci > len(o):
            return "CANCEL_INVALID"
    return None

def cents_to_number(cents):
    # exact: cents/100 as Fraction, emitted as JSON number with <=2 decimals
    q = Fraction(cents, 100)
    return int(q) if q.denominator == 1 else float(f"{cents // 100}.{cents % 100:02d}")

def compute(inp):
    err = validate(inp)
    if err:
        return {"error": err}
    A = as_int(inp["monthlyAmount"]); T = as_int(inp["termMonths"])
    R = as_int(inp.get("rateBp", 0)); O = inp["outcomes"]
    C = inp.get("cancelAt"); C = as_int(C) if C is not None else None
    paid = []
    status = "active"; end = 0
    for k in range(1, len(O) + 1):
        end = k
        if O[k-1] == "paid":
            paid.append(k)
        if O[k-1] == "missed" and k >= 2 and O[k-2] == "missed":
            status = "auto_terminated"; break
        if C == k and k != T:
            status = "cancelled"; break
        if k == T:
            status = "matured"; break
    principal = len(paid) * A
    if status == "active":
        return {"status": "active", "endMonth": end, "paidCount": len(paid),
                "principal": principal, "interest": 0, "payout": None}
    if status == "matured":
        S = sum(A * R * (T - j + 1) for j in paid)
        cents = S // 1200
    else:
        S = sum(A * R * (end - j + 1) for j in paid)
        cents = S // 2400
    payout_cents = principal * 100 + cents
    return {"status": status, "endMonth": end, "paidCount": len(paid),
            "principal": principal, "interest": cents_to_number(cents),
            "payout": cents_to_number(payout_cents)}

AMBIGUITIES = [
    "§1 '정수': JSON 불리언(true/false)은 정수로 보지 않는다고 가정(입력에 해당 사례 없음).",
    "§1 rateBp '기본 0': 필드가 없으면 0으로 간주한다고 가정(입력에 해당 사례 없음). monthlyAmount·termMonths·outcomes 누락은 각 *_INVALID로 처리.",
    "§1 cancelAt == termMonths 이면서 outcomes 길이 < termMonths 인 경우는 'outcomes 길이보다 큼' 규칙으로 CANCEL_INVALID(해당 사례 없음). cancelAt은 outcomes 길이 이하이면 유효(뒤에 남은 달은 해지 후 읽지 않음).",
    "§5 active의 principal은 그때까지 납입한 원금(paidCount×monthlyAmount)으로 출력한다고 가정(명세는 active의 interest=0, payout=null만 명시).",
    "§2 cancelAt 이전 달에 자동 해지가 먼저 일어나면 cancelAt은 무시(계약이 이미 끝남)."
]

def main():
    data = json.load(open(IN, encoding="utf-8"))
    results = []
    for sc in data:
        r = {"id": sc["id"]}; r.update(compute(sc["inputs"])); results.append(r)
    json.dump({"ambiguities": AMBIGUITIES, "results": results},
              open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for r in results:
        print(json.dumps(r, ensure_ascii=False))
    print("scenarios:", len(results))

if __name__ == "__main__":
    main()
