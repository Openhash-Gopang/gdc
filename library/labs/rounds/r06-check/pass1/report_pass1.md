# r06-check 대조 결과 (파이프라인 2단계 — 독립 검수 vs 실행)

검수자는 방법론·명세 문서(credit: gdc_credit_v1_0.md, savings: savings_v0_1.md, valuation: gdc_valuation_v0_1.md, insurance: insurance_v0_1.md, securities: securities_v0_1.md와 그것이 인용하는 신용평가 문서)와 시나리오 입력만 받았고 expected 값과 구현 코드는 보지 못했다.
**일치 64 / 64**

## 검수자가 짚은 문서의 모호한 곳

1. 필수 필드(principal 등)가 없거나 null이면 해당 코드; depositors/positions 원소의 필드(weight, promised, cost, income, grade, id)가 없거나 null이면 '정수가 아님/목록에 없음'으로 보아 해당 *_INVALID로 처리(§1은 원소 필드 누락을 명시하지 않음, 예: sec6-060).
2. 오류가 여러 개면 §1 표의 검사 순서상 첫 번째 코드만 반환(표가 '검사 순서'라 하므로; 예: sec6-061/062/063은 앞선 필드 오류 우선). 같은 POSITIONS_INVALID 안의 하위 조건 순서는 결과에 영향 없음.
3. 500.0 같은 정수값 실수는 int로 변환해 출력(출력 필드는 정수로 표기). NaN/Infinity는 정수가 아닌 것으로 봄.
4. undistributedCents는 명세대로 distributable×100 − Σcents로 계산(poolCents 기준이 아님; 배분율로 남긴 몫 포함). W=0이면 distributable×100 전액.
5. shortfallCents는 payoutBp와 무관하게 distributable×100 기준(명세 §3.7 문장대로).
6. ISSUER_CONCENTRATION·INVESTED_CAP 경계는 엄격한 '>'(같으면 위반 아님). principal=0이고 종목 없으면 위반 없음.
7. positions 빈 배열/생략 시 investedCost=grossIncome=0, compliant=true.

| ID | 결과 | 차이 |
|---|---|---|
| sec6-001 | 일치 |  |
| sec6-002 | 일치 |  |
| sec6-003 | 일치 |  |
| sec6-004 | 일치 |  |
| sec6-005 | 일치 |  |
| sec6-006 | 일치 |  |
| sec6-007 | 일치 |  |
| sec6-008 | 일치 |  |
| sec6-009 | 일치 |  |
| sec6-010 | 일치 |  |
| sec6-011 | 일치 |  |
| sec6-012 | 일치 |  |
| sec6-013 | 일치 |  |
| sec6-014 | 일치 |  |
| sec6-015 | 일치 |  |
| sec6-016 | 일치 |  |
| sec6-017 | 일치 |  |
| sec6-018 | 일치 |  |
| sec6-019 | 일치 |  |
| sec6-020 | 일치 |  |
| sec6-021 | 일치 |  |
| sec6-022 | 일치 |  |
| sec6-023 | 일치 |  |
| sec6-024 | 일치 |  |
| sec6-025 | 일치 |  |
| sec6-026 | 일치 |  |
| sec6-027 | 일치 |  |
| sec6-028 | 일치 |  |
| sec6-029 | 일치 |  |
| sec6-030 | 일치 |  |
| sec6-031 | 일치 |  |
| sec6-032 | 일치 |  |
| sec6-033 | 일치 |  |
| sec6-034 | 일치 |  |
| sec6-035 | 일치 |  |
| sec6-036 | 일치 |  |
| sec6-037 | 일치 |  |
| sec6-038 | 일치 |  |
| sec6-039 | 일치 |  |
| sec6-040 | 일치 |  |
| sec6-041 | 일치 |  |
| sec6-042 | 일치 |  |
| sec6-043 | 일치 |  |
| sec6-044 | 일치 |  |
| sec6-045 | 일치 |  |
| sec6-046 | 일치 |  |
| sec6-047 | 일치 |  |
| sec6-048 | 일치 |  |
| sec6-049 | 일치 |  |
| sec6-050 | 일치 |  |
| sec6-051 | 일치 |  |
| sec6-052 | 일치 |  |
| sec6-053 | 일치 |  |
| sec6-054 | 일치 |  |
| sec6-055 | 일치 |  |
| sec6-056 | 일치 |  |
| sec6-057 | 일치 |  |
| sec6-058 | 일치 |  |
| sec6-059 | 일치 |  |
| sec6-060 | 일치 |  |
| sec6-061 | 일치 |  |
| sec6-062 | 일치 |  |
| sec6-063 | 일치 |  |
| sec6-064 | 일치 |  |
