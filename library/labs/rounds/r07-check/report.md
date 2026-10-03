# r07-check 대조 결과 (파이프라인 2단계 — 독립 검수 vs 실행)

검수자는 방법론·명세 문서(credit: gdc_credit_v1_0.md, savings: savings_v0_1.md, valuation: gdc_valuation_v0_1.md, insurance: insurance_v0_1.md, securities: securities_v0_1.md, savings_linked: savings_v0_2.md와 그것이 인용하는 신용평가 문서)와 시나리오 입력만 받았고 expected 값과 구현 코드는 보지 못했다.
**일치 48 / 48**

## 검수자가 짚은 문서의 모호한 곳

1. §2의 outcomes[k]·outcomes[k-1]는 1부터 세는 달 번호로 해석(0-기반 배열의 k-1번째 원소). 같은 방식으로 달 k의 정산은 settlements[k-1].
2. settlements 원소에 poolCents/totalBalance 키가 없으면(sav7-042) '정수가 아님'으로 보아 SETTLEMENTS_INVALID로 처리(명세는 키 누락을 명시하지 않음).
3. outcomes가 빈 배열(sav7-010)도 유효로 보고 active·endMonth 0으로 처리(§4가 이 경우를 언급하므로 허용으로 해석; 최소 길이 규정은 없음).
4. active일 때 accruedCents는 처리한 달까지의 누적값을 그대로 출력하고 interest는 0으로 둠.
5. interest·payout의 '₮ 숫자' 표현: 센트 정수 ÷100을 소수 둘째 자리 숫자(JSON number)로 출력; payout도 정수 ₮일 수 있으나 숫자형으로만 비교 가능(정수/실수 표기 구분은 명세가 정하지 않음).
6. principal 등 정수 출력은 monthlyAmount가 1000.0처럼 실수 표기여도 정수로 정규화(§1 '정수는 값이 정수이면 된다')해 출력.
7. cancelAt 검사에서 '정수가 아님'·범위 검사는 cancelAt 키가 없거나 null일 때 건너뜀(명세대로). 단 cancelAt 검사 기준인 outcomes 길이는 자동 해지 등으로 실제 처리되지 않는 달까지 포함한 배열 길이로 해석.
8. SETTLEMENT_INCONSISTENT 검사는 이자 계산 전에 매달 B_k > totalBalance로만 판정(B_k=0, totalBalance=0은 일관된 것으로 봄 — sav7-012/013).
9. poolCents의 상한이나 poolCents와 totalBalance의 관계에 제약이 없어, 비현실적으로 큰 재원(sav7-025: 계약 1건이 50,000센트 발생)도 그대로 계산함.

| ID | 결과 | 차이 |
|---|---|---|
| sav7-001 | 일치 |  |
| sav7-002 | 일치 |  |
| sav7-003 | 일치 |  |
| sav7-004 | 일치 |  |
| sav7-005 | 일치 |  |
| sav7-006 | 일치 |  |
| sav7-007 | 일치 |  |
| sav7-008 | 일치 |  |
| sav7-009 | 일치 |  |
| sav7-010 | 일치 |  |
| sav7-011 | 일치 |  |
| sav7-012 | 일치 |  |
| sav7-013 | 일치 |  |
| sav7-014 | 일치 |  |
| sav7-015 | 일치 |  |
| sav7-016 | 일치 |  |
| sav7-017 | 일치 |  |
| sav7-018 | 일치 |  |
| sav7-019 | 일치 |  |
| sav7-020 | 일치 |  |
| sav7-021 | 일치 |  |
| sav7-022 | 일치 |  |
| sav7-023 | 일치 |  |
| sav7-024 | 일치 |  |
| sav7-025 | 일치 |  |
| sav7-026 | 일치 |  |
| sav7-027 | 일치 |  |
| sav7-028 | 일치 |  |
| sav7-029 | 일치 |  |
| sav7-030 | 일치 |  |
| sav7-031 | 일치 |  |
| sav7-032 | 일치 |  |
| sav7-033 | 일치 |  |
| sav7-034 | 일치 |  |
| sav7-035 | 일치 |  |
| sav7-036 | 일치 |  |
| sav7-037 | 일치 |  |
| sav7-038 | 일치 |  |
| sav7-039 | 일치 |  |
| sav7-040 | 일치 |  |
| sav7-041 | 일치 |  |
| sav7-042 | 일치 |  |
| sav7-043 | 일치 |  |
| sav7-044 | 일치 |  |
| sav7-045 | 일치 |  |
| sav7-046 | 일치 |  |
| sav7-047 | 일치 |  |
| sav7-048 | 일치 |  |
