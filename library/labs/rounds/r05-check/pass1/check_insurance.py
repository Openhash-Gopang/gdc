#!/usr/bin/env python3
"""Independent check of insurance spec v0.1 — integer/fraction arithmetic only."""
import json, os
from fractions import Fraction

HERE = os.path.dirname(os.path.abspath(__file__))
RATE = {"A": 100, "B": 200, "C": 400}
MISSING = object()


def as_int(v):
    """Return int if v is an integer value (500.0 ok), else None. bool/str are not integers."""
    if isinstance(v, bool):
        return None
    if isinstance(v, int):
        return v
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return None


def ceil_div(a, b):
    return -((-a) // b)


def validate(inp):
    cov = as_int(inp.get("coverageAmount", MISSING))
    if cov is None or cov < 100 or cov > 10000 or cov % 100 != 0:
        return "COVERAGE_INVALID", None
    term = as_int(inp.get("termMonths", MISSING))
    if term not in (6, 12):
        return "TERM_INVALID", None
    rc = inp.get("riskClass", MISSING)
    if not isinstance(rc, str) or rc not in RATE:
        return "CLASS_INVALID", None
    outs = inp.get("outcomes", MISSING)
    if not isinstance(outs, list) or any(o not in ("paid", "missed") or not isinstance(o, str) for o in outs) or len(outs) > term:
        return "OUTCOMES_INVALID", None
    claims = inp.get("claims", None)
    if claims is None:
        claims = []
    if not isinstance(claims, list):
        return "CLAIMS_INVALID", None
    norm = []
    prev = None
    for c in claims:
        if not isinstance(c, dict):
            return "CLAIMS_INVALID", None
        m = as_int(c.get("month", MISSING))
        if m is None or m < 1 or m > len(outs):
            return "CLAIMS_INVALID", None
        l = as_int(c.get("loss", MISSING))
        if l is None or l < 1:
            return "CLAIMS_INVALID", None
        if prev is not None and m < prev:
            return "CLAIMS_INVALID", None
        prev = m
        norm.append({"month": m, "loss": l})
    ca = inp.get("cancelAt", None)
    if ca is not None:
        ca = as_int(ca)
        if ca is None or ca < 1 or ca > term or ca > len(outs):
            return "CANCEL_INVALID", None
    return None, dict(cov=cov, term=term, rc=rc, outs=outs, claims=norm, cancel=ca)


def simulate(p):
    cov, term, outs, claims, cancel = p["cov"], p["term"], p["outs"], p["claims"], p["cancel"]
    monthly_cents = ceil_div(cov * RATE[p["rc"]], 1200)
    deductible = cov // 10
    R = cov
    paid = 0
    results = []
    status = None
    end = 0
    for k in range(1, len(outs) + 1):
        o = outs[k - 1]
        if o == "paid":
            paid += 1
        processed = False
        for c in claims:
            if c["month"] != k:
                continue
            processed = True
            loss = c["loss"]
            if k == 1:
                reason, pay = "WAITING", 0
            elif outs[k - 1] == "missed":
                reason, pay = "UNPAID", 0
            elif R == 0:
                reason, pay = "EXHAUSTED", 0
            elif loss <= deductible:
                reason, pay = "BELOW_DEDUCTIBLE", 0
            elif loss - deductible <= R:
                reason, pay = "PAID", loss - deductible
            else:
                reason, pay = "PARTIAL", R
            R -= pay
            results.append({"month": k, "loss": loss, "payout": pay, "reason": reason})
        end = k
        if k >= 2 and o == "missed" and outs[k - 2] == "missed":
            status = "lapsed"
        elif processed and R == 0:
            status = "exhausted"
        elif cancel == k and k < term:
            status = "cancelled"
        elif k == term:
            status = "matured"
        if status:
            break
    if status is None:
        status = "active"
    premium = Fraction(monthly_cents * paid, 100)
    total = sum(r["payout"] for r in results)
    return {
        "status": status,
        "endMonth": end,
        "paidCount": paid,
        "premiumTotal": round(float(premium), 2),
        "claimResults": results,
        "totalPayout": total,
        "remainingCoverage": cov - total,
    }


AMBIGUITIES = [
    "premiumTotal를 JSON 숫자(float, 소수 둘째 자리 반올림 — 센트/100이라 항상 정확)로 출력함. 문자열 \"0.84\" 형식인지 숫자인지 명세가 침묵.",
    "필수 필드(coverageAmount/termMonths/riskClass/outcomes)가 없거나 null인 경우 각 필드의 *_INVALID로 처리(명세는 claims/cancelAt만 누락 규정).",
    "claims 원소가 객체가 아니거나 month/loss 키가 없으면 CLAIMS_INVALID로 처리(명세는 키 누락을 명시하지 않음).",
    "CLAIMS_INVALID 하위 조건(month·loss·순서) 사이의 검사 순서는 명세에 없음 — 어느 쪽이든 같은 코드라 결과 영향 없음.",
    "§2-3(나) '이 달 처리 후 잔여 0'은 그 달에 claims 원소가 하나라도 처리된 달(지급 0인 WAITING/UNPAID 포함)로 해석. 실제로는 R이 0이 되는 순간 계약이 끝나므로 차이 없음.",
    "실효(lapsed) 달에도 그 달의 사고는 종료 판정 전에 처리되어 claimResults에 기록됨(§2 순서 1→2→3을 문자 그대로 적용). 그 달은 missed이므로 UNPAID.",
    "cancelAt이 outcomes 길이 이내이지만 그 전에 실효·소진된 경우 cancelAt은 단순히 읽히지 않는 것으로 봄(오류 아님).",
    "status=active일 때 endMonth = outcomes 길이(마지막 처리 달), 빈 outcomes면 0.",
]


def main():
    with open(os.path.join(HERE, "inputs.json")) as f:
        cases = json.load(f)
    out = []
    for c in cases:
        err, p = validate(c["inputs"])
        if err:
            out.append({"id": c["id"], "error": err})
        else:
            r = {"id": c["id"]}
            r.update(simulate(p))
            out.append(r)
    with open(os.path.join(HERE, "results_check.json"), "w") as f:
        json.dump({"results": out, "ambiguities": AMBIGUITIES}, f, ensure_ascii=False, indent=1)
    for r in out:
        if "error" in r:
            print(r["id"], r["error"])
        else:
            print(r["id"], r["status"], r["endMonth"], r["paidCount"], r["premiumTotal"],
                  [(x["month"], x["payout"], x["reason"]) for x in r["claimResults"]], r["totalPayout"], r["remainingCoverage"])


if __name__ == "__main__":
    main()
