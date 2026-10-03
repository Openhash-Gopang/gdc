#!/usr/bin/env python3
"""Independent check of insurance spec v0.1 — computed from spec.md text only."""
import json, os
from fractions import Fraction

HERE = os.path.dirname(os.path.abspath(__file__))
RATE_BP = {"A": 100, "B": 200, "C": 400}


def as_int(v):
    """Return int if v is an integer value (bool/str excluded), else None."""
    if isinstance(v, bool):
        return None
    if isinstance(v, int):
        return v
    if isinstance(v, float) and v == v and v not in (float("inf"), float("-inf")) and v.is_integer():
        return int(v)
    return None


def ceil_div(a, b):
    return -((-a) // b)


def validate(inp):
    cov = as_int(inp.get("coverageAmount"))
    if cov is None or cov < 100 or cov > 10000 or cov % 100 != 0:
        return "COVERAGE_INVALID", None
    term = as_int(inp.get("termMonths"))
    if term not in (6, 12):
        return "TERM_INVALID", None
    rc = inp.get("riskClass")
    if not isinstance(rc, str) or rc not in RATE_BP:
        return "CLASS_INVALID", None
    outs = inp.get("outcomes")
    if not isinstance(outs, list) or any(o not in ("paid", "missed") or not isinstance(o, str) for o in outs) or len(outs) > term:
        return "OUTCOMES_INVALID", None
    claims = inp.get("claims")
    if claims is None:
        claims = []
    if not isinstance(claims, list):
        return "CLAIMS_INVALID", None
    parsed = []
    prev = None
    for c in claims:
        if not isinstance(c, dict) or "month" not in c or "loss" not in c:
            return "CLAIMS_INVALID", None
        m = as_int(c["month"])
        if m is None or m < 1 or m > len(outs):
            return "CLAIMS_INVALID", None
        loss = as_int(c["loss"])
        if loss is None or loss < 1:
            return "CLAIMS_INVALID", None
        if prev is not None and m < prev:
            return "CLAIMS_INVALID", None
        prev = m
        parsed.append((m, loss))
    cancel = None
    if "cancelAt" in inp and inp["cancelAt"] is not None:
        cancel = as_int(inp["cancelAt"])
        if cancel is None or cancel < 1 or cancel > term or cancel > len(outs):
            return "CANCEL_INVALID", None
    return None, (cov, term, rc, outs, parsed, cancel)


def simulate(cov, term, rc, outs, claims, cancel):
    monthly_cents = ceil_div(cov * RATE_BP[rc], 1200)
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
        for (m, loss) in claims:
            if m != k:
                continue
            if m == 1:
                reason, pay = "WAITING", 0
            elif outs[m - 1] == "missed":
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
            results.append({"month": m, "loss": loss, "payout": pay, "reason": reason})
        end = k
        if k >= 2 and o == "missed" and outs[k - 2] == "missed":
            status = "lapsed"
        elif R == 0:
            status = "exhausted"
        elif cancel == k and k < term:
            status = "cancelled"
        elif k == term:
            status = "matured"
        if status:
            break
    if status is None:
        status = "active"
    total = sum(r["payout"] for r in results)
    prem = Fraction(monthly_cents * paid, 100)
    return {
        "status": status,
        "endMonth": end,
        "paidCount": paid,
        "premiumTotal": round(float(prem), 2),
        "claimResults": results,
        "totalPayout": total,
        "remainingCoverage": cov - total,
    }


AMBIGUITIES = [
    "§1 정수 판정: JSON 1000.0 같은 정수값 float는 정수로 인정, bool·문자열·비정수 float는 거부(명세대로). NaN/Infinity는 비정수로 처리.",
    "§1 riskClass·outcomes 원소는 대소문자 구분 정확 일치로 판정('a'는 CLASS_INVALID) — 명세가 대소문자 규칙을 명시하지 않음.",
    "§1 outcomes 길이가 termMonths보다 작은 것은 허용(오류 아님, 끝나면 active), 빈 배열도 허용 — 명세는 '큼'만 오류로 규정.",
    "§1 claims 원소의 추가 키(month·loss 외)는 허용으로 가정 — 명세 침묵.",
    "§1 claims 원소의 month 상한은 outcomes 길이(termMonths 아님); outcomes가 비면 claims 원소가 하나라도 있으면 CLAIMS_INVALID.",
    "§1 CLAIMS_INVALID 하위 조건(객체·키·month·loss·순서) 간 검사 순서는 결과 코드가 같아 무관; 순서 검사는 앞 원소 month와만 비교(비감소).",
    "§1 claims가 null 원소를 담은 배열([null])은 '원소가 객체가 아님'으로 CLAIMS_INVALID; claims 자체가 객체({...})면 배열 아님으로 CLAIMS_INVALID.",
    "§1 cancelAt이 키는 있으나 null이면 해지 없음(명세 문구대로); termMonths가 null/누락이면 TERM_INVALID, riskClass·outcomes 누락도 각 코드.",
    "§1 오류 시 검사 순서상 첫 오류 코드 하나만 반환(ins5-061처럼 여러 필드가 틀려도 COVERAGE_INVALID).",
    "§2 종료 판정 (가)~(라) 우선순위 그대로 적용: 실효 달에 지급으로 한도가 0이 되어도 lapsed, 소진 달이 cancelAt 달이면 exhausted.",
    "§2 실효 판정의 '직전 달'은 outcomes[k-1](항상 처리된 달)이며 그 사이 계약 상태는 무관.",
    "§3 사고 처리 순서 3(R==0)은 '같은 달 앞선 사고로 소진'이라 설명되나, R==0이면 그 달 끝에 exhausted로 종료되므로 실제로는 같은 달에서만 발생 — 조건 그대로 R==0으로 판정.",
    "§3 claimResults의 loss는 입력값을 정수로 정규화해 출력(1000.0 → 1000).",
    "§4 premiumTotal은 '소수 둘째 자리까지 JSON 숫자'이나 JSON 숫자는 후행 0을 보존할 수 없어 값으로만 비교(예: 4.2는 4.20과 동치). 센트 단위 정수에서 나눠 반올림 오차 없음.",
    "§4 endMonth: 종료된 경우 종료 달, active면 마지막 처리 달, outcomes가 비면 0.",
]


def main():
    with open(os.path.join(HERE, "inputs.json")) as f:
        scenarios = json.load(f)
    out = []
    for s in scenarios:
        err, args = validate(s["inputs"])
        if err:
            out.append({"id": s["id"], "error": err})
        else:
            r = simulate(*args)
            out.append({"id": s["id"], **r})
    with open(os.path.join(HERE, "results_check.json"), "w") as f:
        json.dump({"results": out, "ambiguities": AMBIGUITIES}, f, ensure_ascii=False, indent=1)
    for r in out:
        if "error" in r:
            print(r["id"], "ERR", r["error"])
        else:
            print(r["id"], r["status"], r["endMonth"], r["paidCount"], r["premiumTotal"],
                  r["totalPayout"], r["remainingCoverage"],
                  [(c["month"], c["loss"], c["payout"], c["reason"]) for c in r["claimResults"]])


if __name__ == "__main__":
    main()
