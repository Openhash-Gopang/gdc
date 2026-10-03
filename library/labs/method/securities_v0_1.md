# 증권 운용·이자 재원 규칙 v0.1 (2026-10-03, P3d)

예치·적금 금고의 자금을 증권 포트폴리오로 운용하고, 그 **현금 수익**에서 비용을 뺀 만큼을 이자 재원으로 배분하는 규칙의 **시뮬레이션용 명세**다.
[`securities_funding_memo.md`](securities_funding_memo.md)의 설계 메모를 계산 가능한 규칙으로 옮긴 것이며, 서버에는 없다. 이 문서의 값은 모두 **GDC 설계값**이다.
상용 금융 서비스가 아니고 투자 판단·인허가를 대체하지 않는다. 금액 단위는 GDC(₮), 1₮ = KRW 1,000, 이자는 1/100 ₮(센트) 정수로 계산한다.

## 0. 이 버전이 정한 것과 정하지 않은 것

- **이자 지급 방식**: 대표 결정이 아직 없어 두 방식을 **같은 입력으로 함께 계산해 비교**한다. 수익 연동형(§3 `poolCents`와 `shares`)이 기본이고, 확정 이율형은 약정 이자 합계가 재원으로 충당되는지(§3 `shortfallCents`)만 본다. 어느 쪽으로 지급할지는 정하지 않는다.
- **증권의 단위와 발행 주체**: 정하지 않았다. 이 버전의 "종목"(position)은 등급과 취득원가, 기간 현금수익만 가진 추상 단위다(누가 발행하는지, 쪼갤 수 있는지 규정하지 않는다).
- **시장가격·평가 손익·매매 체결**은 다루지 않는다. 재원이 되는 것은 **받은 현금 수익**(배당·이자)뿐이고 평가이익은 재원이 아니다. 매매 체결·가격 결정·평가 갱신 주기는 이 버전의 범위 밖이다.
- **원금 보호 원칙**: 이자는 현금 수익에서만 나가며, 이 규칙은 어떤 경우에도 예치 원금(`principal`)을 줄이는 출력을 만들지 않는다.
- 실제 잔액으로 운용하지 않는다(시뮬레이션 전용). 기간은 한 번의 정산 기간이다(길이는 입력에 없다).

## 1. 입력

| 필드 | 값 | 설명 |
|------|----|------|
| `principal` | 0 이상 정수 (₮) | 금고의 예치 원금 합계 |
| `positions` | 배열 (없음/`null`이면 빈 배열) | 원소 `{ "id": 비어 있지 않은 문자열, "grade": 등급, "cost": 1 이상 정수, "income": 0 이상 정수 }`. `cost`는 취득원가(₮), `income`은 이번 기간에 받은 현금 수익(₮). `id`는 서로 달라야 한다 |
| `serverCost` | 0 이상 정수 (₮) | 이번 기간의 운영 비용 |
| `carryDeficit` | 0 이상 정수 (₮) | 앞선 기간에서 넘어온 이월 결손 |
| `payoutBp` | 0 이상 8000 이하 정수 | 이자 배분율(bp). 순수익 중 이자로 나눌 비율. 상한 80%는 GDC 설계값 |
| `depositors` | 배열 (없음/`null`이면 빈 배열) | 원소 `{ "id": 비어 있지 않은 문자열, "weight": 0 이상 정수, "promised": 0 이상 정수 }`. `weight`는 배분 가중치(예: 예치액×개월), `promised`는 확정 이율형으로 약정된 이자(센트). `id`는 서로 달라야 한다 |

등급은 `AAA` `AA` `A` `BBB` `BB` `C` 중 하나(대소문자까지 정확히 같아야 한다). "정수"는 값이 정수이면 된다(JSON `500.0`은 500). 불리언·문자열·NaN·무한대는 정수가 아니다. 객체의 추가 키는 무시한다. `id`는 길이가 1 이상인 문자열이면 되며 공백만 있어도 비어 있지 않은 것으로 본다. 입력 전체가 객체가 아니면 모든 필수 필드가 없는 것으로 보아 `PRINCIPAL_INVALID`다. 종목·예치자 원소의 필수 필드가 없거나 `null`이면 그 필드가 조건을 만족하지 않은 것으로 보아 해당 오류 코드(`POSITIONS_INVALID`/`DEPOSITORS_INVALID`)다.
`principal` `serverCost` `carryDeficit` `payoutBp`는 필수이고 없거나 `null`이면 그 오류 코드다. `positions`와 `depositors`만 생략할 수 있다.

검사 순서와 오류 코드:

| 오류 코드 | 조건 |
|-----------|------|
| `PRINCIPAL_INVALID` | `principal`이 정수가 아니거나 음수 |
| `POSITIONS_INVALID` | `positions`가 (없음·null이 아니면서) 배열이 아니거나, 원소가 객체가 아니거나, `id`가 비어 있지 않은 문자열이 아니거나, `grade`가 목록에 없거나, `cost`가 1 미만 또는 정수가 아니거나, `income`이 음수 또는 정수가 아니거나, `id`가 중복 |
| `COST_INVALID` | `serverCost`가 정수가 아니거나 음수 |
| `CARRY_INVALID` | `carryDeficit`가 정수가 아니거나 음수 |
| `PAYOUT_INVALID` | `payoutBp`가 정수가 아니거나 범위 밖 |
| `DEPOSITORS_INVALID` | `depositors`가 (없음·null이 아니면서) 배열이 아니거나, 원소가 객체가 아니거나, `id`가 비어 있지 않은 문자열이 아니거나, `weight`/`promised`가 음수 또는 정수가 아니거나, `id`가 중복 |

## 2. 포트폴리오 규칙 (위반은 오류가 아니라 `violations`로 보고하고 계산은 계속한다)

운용 원가 `investedCost` = 모든 종목 `cost`의 합. 아래 위반을 **이 순서로**, 각각 해당하면 한 번씩만 목록에 넣는다.

1. `GRADE_C`: 등급이 `C`인 종목이 하나라도 있다 (C 등급은 투자 대상이 아니다).
2. `ISSUER_CONCENTRATION`: 어떤 종목의 `cost × 5`가 `principal`보다 크다 (한 종목이 원금의 20%를 넘음). `principal`이 0이면 종목이 하나라도 있을 때 위반이다.
3. `INVESTED_CAP`: `investedCost × 10`이 `principal × 7`보다 크다 (운용 원가가 원금의 70%를 넘음 — 나머지는 현금으로 남겨야 한다). `principal`이 0이면 종목이 하나라도 있을 때 위반이다.

`compliant` = 위반이 하나도 없음. 비교는 모두 엄격한 "보다 큼"이라 경계와 정확히 같으면 위반이 아니다. 종목이 없으면(`positions`가 없음·`null`·빈 배열) `investedCost`와 `grossIncome`은 0이고 위반도 없다(`principal`이 0이어도 같다).

## 3. 정산

1. **총수익** `grossIncome` = 모든 종목 `income`의 합.
2. **순수익** `net` = `grossIncome` − `serverCost` (음수일 수 있다).
3. **이월 결손 반영**: `afterCarry` = `net` − `carryDeficit`.
   - `afterCarry` ≥ 0이면 `distributable` = `afterCarry`, `newCarry` = 0.
   - `afterCarry` < 0이면 `distributable` = 0, `newCarry` = −`afterCarry`.
4. **이자 재원**(센트) `poolCents` = floor(`distributable` × `payoutBp` ÷ 100). (₮ → 센트 ×100, bp ÷10000 이므로 합쳐서 ÷100.)
5. **배분**: 가중치 합 W = Σ `weight`. W > 0이면 예치자 i의 몫 `cents_i` = floor(`poolCents` × `weight_i` ÷ W) (센트, 버림). W = 0이면 모든 몫이 0이다. 출력 `shares`는 `depositors` 입력 순서의 `{ id, cents }`이다.
6. **남는 금액** `undistributedCents` = `distributable` × 100 − Σ `cents_i` (배분하지 않고 금고에 남는 금액: 배분율로 남긴 몫과 버림 나머지 포함. `poolCents`가 아니라 `distributable`을 기준으로 하므로, 가중치 합이 0이면 `distributable` × 100 전액이 남는다).
7. **확정 이율형 비교**: `obligationCents` = Σ `promised`. `shortfallCents` = max(0, `obligationCents` − `distributable` × 100). (확정 이율형은 `payoutBp`와 상관없이 `distributable`(순수익에서 이월 결손을 뺀 값) 전부를 재원으로 본다. 0이 아니면 약정을 이행할 재원이 모자란다.)

## 4. 출력

`compliant`, `violations`(문자열 배열), `investedCost`, `grossIncome`, `net`, `distributable`, `newCarry`, `poolCents`, `shares`, `undistributedCents`, `obligationCents`, `shortfallCents`. 오류이면 `error`만 돌려준다.

## 5. 알려진 한계

1. 값(집중도 20%, 운용 상한 70%, 배분율 상한 80%, C 등급 제외)은 모두 GDC 설계값이며 근거 자료가 없다.
2. 이 규칙은 **현금 수익이 어디서 오는지** 검증하지 않는다. 종목의 `income`은 입력이며, 수익이 실제로 발생했는지(특수관계자 순환 거래로 부풀린 수익 등)는 이 명세가 막지 못한다.
3. 평가손실·매매손익·종목 부도는 다루지 않는다. 원금 손실이 발생하는 경우의 처리가 없다.
4. 이월 결손은 입력으로만 받는다. 기간 간 상태(결손·적립 잔액)를 저장하는 구조는 정의하지 않는다.
5. 종목의 등급은 입력이다. 신용평가 v1.0·기업가치 v0.1과 자동으로 연결하지 않는다.
6. 가중치 `weight`와 약정 `promised`는 입력이며, 적금·예치 상품에서 이 값을 만드는 규칙은 정의하지 않는다.
7. 서버 스키마·엔드포인트가 없다. 시뮬레이터(`js/gdc-securities.js`)와 라운드 6 시나리오로만 검증된다.
8. 검증 이력: 라운드 6(`rounds/r06`), 독립 검수 `rounds/r06-check`, 재검토 `rounds/r06-final` — 같은 제작사의 다른 모델이 한 검수이며 제3자 검증은 아니다.
