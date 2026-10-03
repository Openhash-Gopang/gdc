#!/usr/bin/env python3
"""Independent check of securities funding spec v0.1 (integer arithmetic only)."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
GRADES = {"AAA", "AA", "A", "BBB", "BB", "C"}
MISSING = object()


class Err(Exception):
    pass


def as_int(v):
    """Return int if v is an integer value (500.0 ok), else None. Bools/strings are not integers."""
    if isinstance(v, bool):
        return None
    if isinstance(v, int):
        return v
    if isinstance(v, float) and v == v and v not in (float("inf"), float("-inf")) and v.is_integer():
        return int(v)
    return None


def nonneg(v, code, lo=0, hi=None):
    n = as_int(v)
    if n is None or n < lo or (hi is not None and n > hi):
        raise Err(code)
    return n


def nonempty_str(v):
    return isinstance(v, str) and v != ""


def validate(inp):
    principal = nonneg(inp.get("principal"), "PRINCIPAL_INVALID")

    raw = inp.get("positions", None)
    positions = []
    if raw is not None:
        if not isinstance(raw, list):
            raise Err("POSITIONS_INVALID")
        seen = set()
        for p in raw:
            if not isinstance(p, dict) or not nonempty_str(p.get("id")):
                raise Err("POSITIONS_INVALID")
            if not isinstance(p.get("grade"), str) or p.get("grade") not in GRADES:
                raise Err("POSITIONS_INVALID")
            cost = as_int(p.get("cost"))
            income = as_int(p.get("income"))
            if cost is None or cost < 1 or income is None or income < 0:
                raise Err("POSITIONS_INVALID")
            if p["id"] in seen:
                raise Err("POSITIONS_INVALID")
            seen.add(p["id"])
            positions.append({"id": p["id"], "grade": p["grade"], "cost": cost, "income": income})

    server_cost = nonneg(inp.get("serverCost"), "COST_INVALID")
    carry = nonneg(inp.get("carryDeficit"), "CARRY_INVALID")
    payout = nonneg(inp.get("payoutBp"), "PAYOUT_INVALID", 0, 8000)

    raw = inp.get("depositors", None)
    deps = []
    if raw is not None:
        if not isinstance(raw, list):
            raise Err("DEPOSITORS_INVALID")
        seen = set()
        for d in raw:
            if not isinstance(d, dict) or not nonempty_str(d.get("id")):
                raise Err("DEPOSITORS_INVALID")
            w = as_int(d.get("weight"))
            pr = as_int(d.get("promised"))
            if w is None or w < 0 or pr is None or pr < 0:
                raise Err("DEPOSITORS_INVALID")
            if d["id"] in seen:
                raise Err("DEPOSITORS_INVALID")
            seen.add(d["id"])
            deps.append({"id": d["id"], "weight": w, "promised": pr})
    return principal, positions, server_cost, carry, payout, deps


def compute(inp):
    principal, positions, server_cost, carry, payout, deps = validate(inp)

    invested = sum(p["cost"] for p in positions)
    violations = []
    if any(p["grade"] == "C" for p in positions):
        violations.append("GRADE_C")
    if principal == 0:
        conc = len(positions) > 0
    else:
        conc = any(p["cost"] * 5 > principal for p in positions)
    if conc:
        violations.append("ISSUER_CONCENTRATION")
    if principal == 0:
        cap = len(positions) > 0
    else:
        cap = invested * 10 > principal * 7
    if cap:
        violations.append("INVESTED_CAP")

    gross = sum(p["income"] for p in positions)
    net = gross - server_cost
    after = net - carry
    if after >= 0:
        distributable, new_carry = after, 0
    else:
        distributable, new_carry = 0, -after
    pool = (distributable * payout) // 100
    W = sum(d["weight"] for d in deps)
    shares = []
    for d in deps:
        c = (pool * d["weight"]) // W if W > 0 else 0
        shares.append({"id": d["id"], "cents": c})
    undistributed = distributable * 100 - sum(s["cents"] for s in shares)
    obligation = sum(d["promised"] for d in deps)
    shortfall = max(0, obligation - distributable * 100)

    return {
        "compliant": not violations,
        "violations": violations,
        "investedCost": invested,
        "grossIncome": gross,
        "net": net,
        "distributable": distributable,
        "newCarry": new_carry,
        "poolCents": pool,
        "shares": shares,
        "undistributedCents": undistributed,
        "obligationCents": obligation,
        "shortfallCents": shortfall,
    }


AMBIGUITIES = [
    "필수 필드(principal 등)가 없거나 null이면 해당 코드; depositors/positions 원소의 필드(weight, promised, cost, income, grade, id)가 없거나 null이면 '정수가 아님/목록에 없음'으로 보아 해당 *_INVALID로 처리(§1은 원소 필드 누락을 명시하지 않음, 예: sec6-060).",
    "오류가 여러 개면 §1 표의 검사 순서상 첫 번째 코드만 반환(표가 '검사 순서'라 하므로; 예: sec6-061/062/063은 앞선 필드 오류 우선). 같은 POSITIONS_INVALID 안의 하위 조건 순서는 결과에 영향 없음.",
    "500.0 같은 정수값 실수는 int로 변환해 출력(출력 필드는 정수로 표기). NaN/Infinity는 정수가 아닌 것으로 봄.",
    "undistributedCents는 명세대로 distributable×100 − Σcents로 계산(poolCents 기준이 아님; 배분율로 남긴 몫 포함). W=0이면 distributable×100 전액.",
    "shortfallCents는 payoutBp와 무관하게 distributable×100 기준(명세 §3.7 문장대로).",
    "ISSUER_CONCENTRATION·INVESTED_CAP 경계는 엄격한 '>'(같으면 위반 아님). principal=0이고 종목 없으면 위반 없음.",
    "positions 빈 배열/생략 시 investedCost=grossIncome=0, compliant=true.",
]


def main():
    with open(os.path.join(HERE, "inputs.json"), encoding="utf-8") as f:
        scenarios = json.load(f)
    results = []
    for s in scenarios:
        try:
            r = {"id": s["id"], **compute(s.get("inputs") or {})}
        except Err as e:
            r = {"id": s["id"], "error": str(e)}
        results.append(r)
    with open(os.path.join(HERE, "results_check.json"), "w", encoding="utf-8") as f:
        json.dump({"results": results, "ambiguities": AMBIGUITIES}, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
