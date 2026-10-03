# r05-check 대조 결과 (파이프라인 2단계 — 독립 검수 vs 실행)

검수자는 방법론·명세 문서(credit: gdc_credit_v1_0.md, savings: savings_v0_1.md, valuation: gdc_valuation_v0_1.md, insurance: insurance_v0_1.md와 그것이 인용하는 신용평가 문서)와 시나리오 입력만 받았고 expected 값과 구현 코드는 보지 못했다.
**일치 73 / 73**

## 검수자가 짚은 문서의 모호한 곳

1. §1 정수 판정: JSON 1000.0 같은 정수값 float는 정수로 인정, bool·문자열·비정수 float는 거부(명세대로). NaN/Infinity는 비정수로 처리.
2. §1 riskClass·outcomes 원소는 대소문자 구분 정확 일치로 판정('a'는 CLASS_INVALID) — 명세가 대소문자 규칙을 명시하지 않음.
3. §1 outcomes 길이가 termMonths보다 작은 것은 허용(오류 아님, 끝나면 active), 빈 배열도 허용 — 명세는 '큼'만 오류로 규정.
4. §1 claims 원소의 추가 키(month·loss 외)는 허용으로 가정 — 명세 침묵.
5. §1 claims 원소의 month 상한은 outcomes 길이(termMonths 아님); outcomes가 비면 claims 원소가 하나라도 있으면 CLAIMS_INVALID.
6. §1 CLAIMS_INVALID 하위 조건(객체·키·month·loss·순서) 간 검사 순서는 결과 코드가 같아 무관; 순서 검사는 앞 원소 month와만 비교(비감소).
7. §1 claims가 null 원소를 담은 배열([null])은 '원소가 객체가 아님'으로 CLAIMS_INVALID; claims 자체가 객체({...})면 배열 아님으로 CLAIMS_INVALID.
8. §1 cancelAt이 키는 있으나 null이면 해지 없음(명세 문구대로); termMonths가 null/누락이면 TERM_INVALID, riskClass·outcomes 누락도 각 코드.
9. §1 오류 시 검사 순서상 첫 오류 코드 하나만 반환(ins5-061처럼 여러 필드가 틀려도 COVERAGE_INVALID).
10. §2 종료 판정 (가)~(라) 우선순위 그대로 적용: 실효 달에 지급으로 한도가 0이 되어도 lapsed, 소진 달이 cancelAt 달이면 exhausted.
11. §2 실효 판정의 '직전 달'은 outcomes[k-1](항상 처리된 달)이며 그 사이 계약 상태는 무관.
12. §3 사고 처리 순서 3(R==0)은 '같은 달 앞선 사고로 소진'이라 설명되나, R==0이면 그 달 끝에 exhausted로 종료되므로 실제로는 같은 달에서만 발생 — 조건 그대로 R==0으로 판정.
13. §3 claimResults의 loss는 입력값을 정수로 정규화해 출력(1000.0 → 1000).
14. §4 premiumTotal은 '소수 둘째 자리까지 JSON 숫자'이나 JSON 숫자는 후행 0을 보존할 수 없어 값으로만 비교(예: 4.2는 4.20과 동치). 센트 단위 정수에서 나눠 반올림 오차 없음.
15. §4 endMonth: 종료된 경우 종료 달, active면 마지막 처리 달, outcomes가 비면 0.

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
| ins5-063 | 일치 |  |
| ins5-064 | 일치 |  |
| ins5-065 | 일치 |  |
| ins5-066 | 일치 |  |
| ins5-067 | 일치 |  |
| ins5-068 | 일치 |  |
| ins5-069 | 일치 |  |
| ins5-070 | 일치 |  |
| ins5-071 | 일치 |  |
| ins5-072 | 일치 |  |
| ins5-073 | 일치 |  |
