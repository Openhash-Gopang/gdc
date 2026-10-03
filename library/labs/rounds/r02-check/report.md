# r02-check 대조 결과 (파이프라인 2단계 — 독립 검수 vs 실행)

검수자는 방법론 문서(gdc_credit_v1_0.md)와 시나리오 입력만 받았고 expected 값과 구현 코드는 보지 못했다.
**일치 57 / 57**

## 검수자가 짚은 문서의 모호한 곳

1. §3 debt table: bs_equity = 0 with bs_debt < 0 is not covered (only debt > 0 and debt = 0). Not present in inputs; script treats it as 50 (not > 0).
2. §3 says boundaries are inclusive 'to the better side'; debt table uses explicit </<= that agree with this (0.3 -> 100, 0.7 -> 80, 1.5 -> 55, 3.0 -> 25). Applied as written; no conflict found.
3. §4 says annualRate must match the grade table posted on gdc.hondi.net; that table cannot be checked from these two files. Used the document's '구현 값' column.
4. Output type of the displayed score is not specified (number vs. string); emitted as a number rounded half-up to 1 decimal.
5. §1/§7: period of pl_* and cf_op (annual vs quarterly) is undefined; it does not change any ratio computed here, so no assumption needed for these results.

| ID | 결과 | 차이 |
|---|---|---|
| cred2-001 | 일치 |  |
| cred2-002 | 일치 |  |
| cred2-003 | 일치 |  |
| cred2-004 | 일치 |  |
| cred2-005 | 일치 |  |
| cred2-006 | 일치 |  |
| cred2-007 | 일치 |  |
| cred2-008 | 일치 |  |
| cred2-009 | 일치 |  |
| cred2-010 | 일치 |  |
| cred2-011 | 일치 |  |
| cred2-012 | 일치 |  |
| cred2-013 | 일치 |  |
| cred2-014 | 일치 |  |
| cred2-015 | 일치 |  |
| cred2-016 | 일치 |  |
| cred2-017 | 일치 |  |
| cred2-018 | 일치 |  |
| cred2-019 | 일치 |  |
| cred2-020 | 일치 |  |
| cred2-021 | 일치 |  |
| cred2-022 | 일치 |  |
| cred2-023 | 일치 |  |
| cred2-024 | 일치 |  |
| cred2-025 | 일치 |  |
| cred2-026 | 일치 |  |
| cred2-027 | 일치 |  |
| cred2-028 | 일치 |  |
| cred2-029 | 일치 |  |
| cred2-030 | 일치 |  |
| cred2-031 | 일치 |  |
| cred2-032 | 일치 |  |
| cred2-033 | 일치 |  |
| cred2-034 | 일치 |  |
| cred2-035 | 일치 |  |
| cred2-036 | 일치 |  |
| cred2-037 | 일치 |  |
| cred2-038 | 일치 |  |
| cred2-039 | 일치 |  |
| cred2-040 | 일치 |  |
| cred2-041 | 일치 |  |
| cred2-042 | 일치 |  |
| cred2-043 | 일치 |  |
| cred2-044 | 일치 |  |
| cred2-045 | 일치 |  |
| cred2-046 | 일치 |  |
| cred2-047 | 일치 |  |
| cred2-048 | 일치 |  |
| cred2-049 | 일치 |  |
| cred2-050 | 일치 |  |
| cred2-051 | 일치 |  |
| cred2-052 | 일치 |  |
| cred2-053 | 일치 |  |
| cred2-054 | 일치 |  |
| cred2-055 | 일치 |  |
| cred2-056 | 일치 |  |
| cred2-057 | 일치 |  |
