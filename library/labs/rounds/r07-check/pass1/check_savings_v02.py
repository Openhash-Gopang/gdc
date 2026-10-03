import json, math

def as_int(v):
    """Spec §1: integer if value is integral; bool/str/NaN/inf are not."""
    if isinstance(v, bool) or v is None:
        return None
    if isinstance(v, int):
        return v
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v) or v != int(v):
            return None
        return int(v)
    return None

def compute(inp):
    if not isinstance(inp, dict):
        inp = {}
    m = as_int(inp.get("monthlyAmount"))
    if m is None or m < 100 or m > 1000:
        return {"error": "AMOUNT_INVALID"}
    t = as_int(inp.get("termMonths"))
    if t not in (6, 12):
        return {"error": "TERM_INVALID"}
    outs = inp.get("outcomes")
    if not isinstance(outs, list) or any(o not in ("paid", "missed") for o in outs) or len(outs) > t:
        return {"error": "OUTCOMES_INVALID"}
    sets = inp.get("settlements")
    if not isinstance(sets, list) or len(sets) != len(outs):
        return {"error": "SETTLEMENTS_INVALID"}
    parsed = []
    for s in sets:
        if not isinstance(s, dict):
            return {"error": "SETTLEMENTS_INVALID"}
        p = as_int(s.get("poolCents"))
        tb = as_int(s.get("totalBalance"))
        if p is None or tb is None or p < 0 or tb < 0:
            return {"error": "SETTLEMENTS_INVALID"}
        parsed.append((p, tb))
    c_raw = inp.get("cancelAt")
    cancel = None
    if c_raw is not None:
        cancel = as_int(c_raw)
        if cancel is None or cancel < 1 or cancel > t or cancel > len(outs):
            return {"error": "CANCEL_INVALID"}

    paid = 0
    acc = 0
    status = "active"
    end = 0
    for i, o in enumerate(outs):
        k = i + 1
        if o == "paid":
            paid += 1
        B = paid * m
        pool, tb = parsed[i]
        if B > tb:
            return {"error": "SETTLEMENT_INCONSISTENT"}
        if B > 0:
            acc += (pool * B) // tb
        end = k
        if k >= 2 and o == "missed" and outs[i - 1] == "missed":
            status = "auto_terminated"; break
        if cancel == k and k < t:
            status = "cancelled"; break
        if k == t:
            status = "matured"; break

    principal = paid * m
    if status == "matured":
        icents = acc
    elif status in ("cancelled", "auto_terminated"):
        icents = acc // 2
    else:
        icents = 0
    interest = round(icents / 100, 2)
    payout = None if status == "active" else round((principal * 100 + icents) / 100, 2)
    return {"status": status, "endMonth": end, "paidCount": paid, "principal": principal,
            "accruedCents": acc, "interest": interest, "payout": payout}

AMBIG = [
    "§2의 outcomes[k]·outcomes[k-1]는 1부터 세는 달 번호로 해석(0-기반 배열의 k-1번째 원소). 같은 방식으로 달 k의 정산은 settlements[k-1].",
    "settlements 원소에 poolCents/totalBalance 키가 없으면(sav7-042) '정수가 아님'으로 보아 SETTLEMENTS_INVALID로 처리(명세는 키 누락을 명시하지 않음).",
    "outcomes가 빈 배열(sav7-010)도 유효로 보고 active·endMonth 0으로 처리(§4가 이 경우를 언급하므로 허용으로 해석; 최소 길이 규정은 없음).",
    "active일 때 accruedCents는 처리한 달까지의 누적값을 그대로 출력하고 interest는 0으로 둠.",
    "interest·payout의 '₮ 숫자' 표현: 센트 정수 ÷100을 소수 둘째 자리 숫자(JSON number)로 출력; payout도 정수 ₮일 수 있으나 숫자형으로만 비교 가능(정수/실수 표기 구분은 명세가 정하지 않음).",
    "principal 등 정수 출력은 monthlyAmount가 1000.0처럼 실수 표기여도 정수로 정규화(§1 '정수는 값이 정수이면 된다')해 출력.",
    "cancelAt 검사에서 '정수가 아님'·범위 검사는 cancelAt 키가 없거나 null일 때 건너뜀(명세대로). 단 cancelAt 검사 기준인 outcomes 길이는 자동 해지 등으로 실제 처리되지 않는 달까지 포함한 배열 길이로 해석.",
    "SETTLEMENT_INCONSISTENT 검사는 이자 계산 전에 매달 B_k > totalBalance로만 판정(B_k=0, totalBalance=0은 일관된 것으로 봄 — sav7-012/013).",
    "poolCents의 상한이나 poolCents와 totalBalance의 관계에 제약이 없어, 비현실적으로 큰 재원(sav7-025: 계약 1건이 50,000센트 발생)도 그대로 계산함.",
]

def main():
    with open("inputs.json", encoding="utf-8") as f:
        cases = json.load(f)
    results = []
    for c in cases:
        r = compute(c.get("inputs"))
        results.append({"id": c["id"], **r})
    with open("results_check.json", "w", encoding="utf-8") as f:
        json.dump({"results": results, "ambiguities": AMBIG}, f, ensure_ascii=False, indent=1)
    for r in results:
        print(json.dumps(r, ensure_ascii=False))

if __name__ == "__main__":
    main()
