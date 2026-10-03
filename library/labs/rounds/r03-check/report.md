# r03-check 대조 결과 (파이프라인 2단계 — 독립 검수 vs 실행)

검수자는 방법론·명세 문서(credit: gdc_credit_v1_0.md, savings: savings_v0_1.md)와 시나리오 입력만 받았고 expected 값과 구현 코드는 보지 못했다.
**일치 49 / 49**

## 검수자가 짚은 문서의 모호한 곳

1. §1 '정수': JSON 불리언(true/false)은 정수로 보지 않는다고 가정(입력에 해당 사례 없음).
2. §1 rateBp '기본 0': 필드가 없으면 0으로 간주한다고 가정(입력에 해당 사례 없음). monthlyAmount·termMonths·outcomes 누락은 각 *_INVALID로 처리.
3. §1 cancelAt == termMonths 이면서 outcomes 길이 < termMonths 인 경우는 'outcomes 길이보다 큼' 규칙으로 CANCEL_INVALID(해당 사례 없음). cancelAt은 outcomes 길이 이하이면 유효(뒤에 남은 달은 해지 후 읽지 않음).
4. §5 active의 principal은 그때까지 납입한 원금(paidCount×monthlyAmount)으로 출력한다고 가정(명세는 active의 interest=0, payout=null만 명시).
5. §2 cancelAt 이전 달에 자동 해지가 먼저 일어나면 cancelAt은 무시(계약이 이미 끝남).

| ID | 결과 | 차이 |
|---|---|---|
| sav3-001 | 일치 |  |
| sav3-002 | 일치 |  |
| sav3-003 | 일치 |  |
| sav3-004 | 일치 |  |
| sav3-005 | 일치 |  |
| sav3-006 | 일치 |  |
| sav3-007 | 일치 |  |
| sav3-008 | 일치 |  |
| sav3-009 | 일치 |  |
| sav3-010 | 일치 |  |
| sav3-011 | 일치 |  |
| sav3-012 | 일치 |  |
| sav3-013 | 일치 |  |
| sav3-014 | 일치 |  |
| sav3-015 | 일치 |  |
| sav3-016 | 일치 |  |
| sav3-017 | 일치 |  |
| sav3-018 | 일치 |  |
| sav3-019 | 일치 |  |
| sav3-020 | 일치 |  |
| sav3-021 | 일치 |  |
| sav3-022 | 일치 |  |
| sav3-023 | 일치 |  |
| sav3-024 | 일치 |  |
| sav3-025 | 일치 |  |
| sav3-026 | 일치 |  |
| sav3-027 | 일치 |  |
| sav3-028 | 일치 |  |
| sav3-029 | 일치 |  |
| sav3-030 | 일치 |  |
| sav3-031 | 일치 |  |
| sav3-032 | 일치 |  |
| sav3-033 | 일치 |  |
| sav3-034 | 일치 |  |
| sav3-035 | 일치 |  |
| sav3-036 | 일치 |  |
| sav3-037 | 일치 |  |
| sav3-038 | 일치 |  |
| sav3-039 | 일치 |  |
| sav3-040 | 일치 |  |
| sav3-041 | 일치 |  |
| sav3-042 | 일치 |  |
| sav3-043 | 일치 |  |
| sav3-044 | 일치 |  |
| sav3-045 | 일치 |  |
| sav3-046 | 일치 |  |
| sav3-047 | 일치 |  |
| sav3-048 | 일치 |  |
| sav3-049 | 일치 |  |
