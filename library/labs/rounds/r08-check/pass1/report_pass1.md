# r08-check 대조 결과 (파이프라인 2단계 — 독립 검수 vs 실행)

검수자는 방법론·명세 문서(credit: gdc_credit_v1_0.md, savings: savings_v0_1.md, valuation: gdc_valuation_v0_1.md, insurance: insurance_v0_1.md, securities: securities_v0_1.md, savings_linked: savings_v0_2.md, issuance: issuance_v0_1.md와 그것이 인용하는 신용평가 문서)와 시나리오 입력만 받았고 expected 값과 구현 코드는 보지 못했다.
**일치 62 / 62**

## 검수자가 짚은 문서의 모호한 곳

1. 오류 검사(§1)는 발행 판정(§2) 거절보다 먼저 한다고 가정함(예: grade C이면서 subscriptions 오류인 경우 error 반환).
2. valuation 객체에서 low/mid/high 중 하나가 없거나 null이면 VALUATION_INVALID로 봄(원소 규칙 '조건 불만족'을 valuation 하위 키에도 적용).
3. 내부자 상한은 1단계 안분 후보에 적용하고, 상한으로 줄어든 수량을 다른 청약자에게 재배분하지 않음(명세 문장대로 미배정 처리).
4. 배정이 0인 청약자도 allocations에 units 0으로 포함함(입력 순서 유지).
5. 내부자 판정의 '같다'는 대소문자 구분 정확 일치로 봄("CO" ≠ "co").
6. issuedUnits=0이고 배정 A>0일 때 newIssuedUnits=A, post/band 계산은 그대로 적용(명세상 특례 없음).
7. valuation이 객체가 아닌 null(필드 존재하지만 null)도 VALUATION_INVALID로 봄.

| ID | 결과 | 차이 |
|---|---|---|
| iss8-001 | 일치 |  |
| iss8-002 | 일치 |  |
| iss8-003 | 일치 |  |
| iss8-004 | 일치 |  |
| iss8-005 | 일치 |  |
| iss8-006 | 일치 |  |
| iss8-007 | 일치 |  |
| iss8-008 | 일치 |  |
| iss8-009 | 일치 |  |
| iss8-010 | 일치 |  |
| iss8-011 | 일치 |  |
| iss8-012 | 일치 |  |
| iss8-013 | 일치 |  |
| iss8-014 | 일치 |  |
| iss8-015 | 일치 |  |
| iss8-016 | 일치 |  |
| iss8-017 | 일치 |  |
| iss8-018 | 일치 |  |
| iss8-019 | 일치 |  |
| iss8-020 | 일치 |  |
| iss8-021 | 일치 |  |
| iss8-022 | 일치 |  |
| iss8-023 | 일치 |  |
| iss8-024 | 일치 |  |
| iss8-025 | 일치 |  |
| iss8-026 | 일치 |  |
| iss8-027 | 일치 |  |
| iss8-028 | 일치 |  |
| iss8-029 | 일치 |  |
| iss8-030 | 일치 |  |
| iss8-031 | 일치 |  |
| iss8-032 | 일치 |  |
| iss8-033 | 일치 |  |
| iss8-034 | 일치 |  |
| iss8-035 | 일치 |  |
| iss8-036 | 일치 |  |
| iss8-037 | 일치 |  |
| iss8-038 | 일치 |  |
| iss8-039 | 일치 |  |
| iss8-040 | 일치 |  |
| iss8-041 | 일치 |  |
| iss8-042 | 일치 |  |
| iss8-043 | 일치 |  |
| iss8-044 | 일치 |  |
| iss8-045 | 일치 |  |
| iss8-046 | 일치 |  |
| iss8-047 | 일치 |  |
| iss8-048 | 일치 |  |
| iss8-049 | 일치 |  |
| iss8-050 | 일치 |  |
| iss8-051 | 일치 |  |
| iss8-052 | 일치 |  |
| iss8-053 | 일치 |  |
| iss8-054 | 일치 |  |
| iss8-055 | 일치 |  |
| iss8-056 | 일치 |  |
| iss8-057 | 일치 |  |
| iss8-058 | 일치 |  |
| iss8-059 | 일치 |  |
| iss8-060 | 일치 |  |
| iss8-061 | 일치 |  |
| iss8-062 | 일치 |  |
