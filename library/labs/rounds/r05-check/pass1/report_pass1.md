# r05-check 대조 결과 (파이프라인 2단계 — 독립 검수 vs 실행)

검수자는 방법론·명세 문서(credit: gdc_credit_v1_0.md, savings: savings_v0_1.md, valuation: gdc_valuation_v0_1.md, insurance: insurance_v0_1.md와 그것이 인용하는 신용평가 문서)와 시나리오 입력만 받았고 expected 값과 구현 코드는 보지 못했다.
**일치 62 / 62**

## 검수자가 짚은 문서의 모호한 곳

1. premiumTotal를 JSON 숫자(float, 소수 둘째 자리 반올림 — 센트/100이라 항상 정확)로 출력함. 문자열 "0.84" 형식인지 숫자인지 명세가 침묵.
2. 필수 필드(coverageAmount/termMonths/riskClass/outcomes)가 없거나 null인 경우 각 필드의 *_INVALID로 처리(명세는 claims/cancelAt만 누락 규정).
3. claims 원소가 객체가 아니거나 month/loss 키가 없으면 CLAIMS_INVALID로 처리(명세는 키 누락을 명시하지 않음).
4. CLAIMS_INVALID 하위 조건(month·loss·순서) 사이의 검사 순서는 명세에 없음 — 어느 쪽이든 같은 코드라 결과 영향 없음.
5. §2-3(나) '이 달 처리 후 잔여 0'은 그 달에 claims 원소가 하나라도 처리된 달(지급 0인 WAITING/UNPAID 포함)로 해석. 실제로는 R이 0이 되는 순간 계약이 끝나므로 차이 없음.
6. 실효(lapsed) 달에도 그 달의 사고는 종료 판정 전에 처리되어 claimResults에 기록됨(§2 순서 1→2→3을 문자 그대로 적용). 그 달은 missed이므로 UNPAID.
7. cancelAt이 outcomes 길이 이내이지만 그 전에 실효·소진된 경우 cancelAt은 단순히 읽히지 않는 것으로 봄(오류 아님).
8. status=active일 때 endMonth = outcomes 길이(마지막 처리 달), 빈 outcomes면 0.

| ID | 결과 | 차이 |
|---|---|---|
| ins5-001 | 일치 |  |
| ins5-002 | 일치 |  |
| ins5-003 | 일치 |  |
| ins5-004 | 일치 |  |
| ins5-005 | 일치 |  |
| ins5-006 | 일치 |  |
| ins5-007 | 일치 |  |
| ins5-008 | 일치 |  |
| ins5-009 | 일치 |  |
| ins5-010 | 일치 |  |
| ins5-011 | 일치 |  |
| ins5-012 | 일치 |  |
| ins5-013 | 일치 |  |
| ins5-014 | 일치 |  |
| ins5-015 | 일치 |  |
| ins5-016 | 일치 |  |
| ins5-017 | 일치 |  |
| ins5-018 | 일치 |  |
| ins5-019 | 일치 |  |
| ins5-020 | 일치 |  |
| ins5-021 | 일치 |  |
| ins5-022 | 일치 |  |
| ins5-023 | 일치 |  |
| ins5-024 | 일치 |  |
| ins5-025 | 일치 |  |
| ins5-026 | 일치 |  |
| ins5-027 | 일치 |  |
| ins5-028 | 일치 |  |
| ins5-029 | 일치 |  |
| ins5-030 | 일치 |  |
| ins5-031 | 일치 |  |
| ins5-032 | 일치 |  |
| ins5-033 | 일치 |  |
| ins5-034 | 일치 |  |
| ins5-035 | 일치 |  |
| ins5-036 | 일치 |  |
| ins5-037 | 일치 |  |
| ins5-038 | 일치 |  |
| ins5-039 | 일치 |  |
| ins5-040 | 일치 |  |
| ins5-041 | 일치 |  |
| ins5-042 | 일치 |  |
| ins5-043 | 일치 |  |
| ins5-044 | 일치 |  |
| ins5-045 | 일치 |  |
| ins5-046 | 일치 |  |
| ins5-047 | 일치 |  |
| ins5-048 | 일치 |  |
| ins5-049 | 일치 |  |
| ins5-050 | 일치 |  |
| ins5-051 | 일치 |  |
| ins5-052 | 일치 |  |
| ins5-053 | 일치 |  |
| ins5-054 | 일치 |  |
| ins5-055 | 일치 |  |
| ins5-056 | 일치 |  |
| ins5-057 | 일치 |  |
| ins5-058 | 일치 |  |
| ins5-059 | 일치 |  |
| ins5-060 | 일치 |  |
| ins5-061 | 일치 |  |
| ins5-062 | 일치 |  |
