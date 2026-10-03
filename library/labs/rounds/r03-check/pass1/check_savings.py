#!/usr/bin/env python3
"""Independent check of savings_v0_1.md scenarios (integer arithmetic only)."""
import json, os, sys
from decimal import Decimal

HERE = os.path.dirname(os.path.abspath(__file__))
IN = os.path.join(HERE, "..", "check3-in", "inputs.json")
OUT = os.path.join(HERE, "results_check.json")

def is_int(v):
    # JSON integer only (bool excluded). 500.5, 2.5 -> not integer.
    # Assumption: a float with integral value (e.g. 500.0) is NOT treated as integer here; none appear in inputs.
    return isinstance(v, int) and not isinstance(v, bool)

def validate(x):
    a = x.get("monthlyAmount")
    if not is_int(a) or not (100 <= a <= 1000):
        return "AMOUNT_INVALID"
    t = x.get("termMonths")
    if not is_int(t) or t not in (6, 12):
        return "TERM_INVALID"
    r = x.get("rateBp")
    if not is_int(r) or not (0 <= r <= 50):
        return "RATE_INVALID"
    o = x.get("outcomes")
    if not isinstance(o, list) or any(e not in ("paid", "missed") for e in o) or len(o) > t:
        return "OUTCOMES_INVALID"
    if "cancelAt" in x:
        c = x["cancelAt"]
        if not is_int(c) or c < 1 or c > t or c > len(o):
            return "CANCEL_INVALID"
    return None

def money(cents):
    return float(Decimal(cents) / 100)

def run(x):
    err = validate(x)
    if err:
        return {"error": err}
    A, T, R, O = x["monthlyAmount"], x["termMonths"], x["rateBp"], x["outcomes"]
    C = x.get("cancelAt")
    paid = []
    status, end = None, None
    for k in range(1, len(O) + 1):
        cur = O[k - 1]
        if cur == "paid":
            paid.append(k)
        if cur == "missed" and k >= 2 and O[k - 2] == "missed":
            status, end = "auto_terminated", k
        elif C == k and k != T:
            status, end = "cancelled", k
        elif k == T:
            status, end = "matured", k
        if status:
            break
    principal = len(paid) * A
    if status is None:
        end = len(O)
        return {"status": "active", "endMonth": end, "paidCount": len(paid),
                "principal": principal, "interest": 0, "payout": None}
    if status == "matured":
        S = sum(A * R * (T - j + 1) for j in paid)
        cents = S // 1200
    else:
        S = sum(A * R * (end - j + 1) for j in paid)
        cents = S // 2400
    interest = money(cents)
    payout = money(principal * 100 + cents)
    return {"status": status, "endMonth": end, "paidCount": len(paid),
            "principal": principal, "interest": interest, "payout": payout}

AMBIGUITIES = [
    "§2의 outcomes[k]는 1부터 센 k번째 달(배열 인덱스 k-1)로 해석함. k=1이 missed일 때 outcomes[0](직전 달)은 없으므로 연속 미납으로 보지 않음.",
    "active 상태의 interest 값을 명세 §5가 정하지 않음(payout만 null로 규정). 미확정 이자이므로 0으로 출력함.",
    "'정수'의 판정: JSON에서 500.0처럼 정수값인 실수를 정수로 볼지 명세가 침묵함(이번 입력에는 없음; 500.5, 2.5는 비정수로 처리).",
    "만기 달(k==termMonths)에 2회 연속 미납이 성립하면 §2 규칙 순서(2번이 4번보다 먼저)에 따라 만기가 아닌 auto_terminated로 처리함. §2의 '만기 달 cancelAt'만 명시되고 이 경우는 명시되지 않음.",
    "OUTCOMES_INVALID 검사는 계약 종료 후 읽지 않는 달의 원소까지 포함해 배열 전체에 적용한다고 해석함.",
    "cancelAt 필드가 null로 주어진 경우의 처리(부재로 볼지 CANCEL_INVALID로 볼지) 명세 침묵(이번 입력에는 없음).",
]

def main():
    data = json.load(open(IN, encoding="utf-8"))
    results = [{"id": s["id"], **run(s["inputs"])} for s in data]
    json.dump({"ambiguities": AMBIGUITIES, "results": results}, open(OUT, "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    for r in results:
        print(json.dumps(r, ensure_ascii=False))
    print(len(results), "scenarios")

if __name__ == "__main__":
    main()
