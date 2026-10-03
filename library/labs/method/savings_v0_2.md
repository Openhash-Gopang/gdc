# 적금(정액 적립·수익 연동 이자) 상품 명세 v0.2 (2026-10-03, P3e)

[`savings_v0_1.md`](savings_v0_1.md)의 후속이다. **이자를 약정 이율이 아니라 증권 운용 수익의 배분 몫으로 정한다**
(2026-10-03 [설계 결정 1](decisions_2026-10-03.md): 이자 지급은 수익 연동형). **시뮬레이션용 명세**이며 서버에는 없다. 이 문서의 값은 모두 **GDC 설계값**이고
외부 상품에서 가져온 참고값이 아니다. 상용 금융 서비스가 아니고 인허가를 대체하지 않는다. 금액은 GDC(₮), 1₮ = KRW 1,000, 이자는 1/100 ₮(센트) 정수로 계산한다.

## 0. v0.1과의 차이와 현재 승인 범위

- v0.1의 `rateBp`(약정 이율)와 만기·해지 이자 공식(S ÷ 1200)은 **쓰지 않는다.** v0.1은 확정 이율형 가정의 기록(라운드 3)으로 남는다.
- 이자는 매달 증권 운용 정산([`securities_v0_1.md`](securities_v0_1.md) §3)에서 나온 **이자 재원**(`poolCents`)을 예치자들의 **잔액 비중**으로 나눈 몫이다. 재원이 0이면 이자는 0이고, **원금은 어떤 경우에도 전액 돌려준다.**
- 이 명세는 정산 입력(그 달의 재원과 전체 잔액)을 **입력으로 받는다.** 정산을 만들어 내는 규칙은 증권 운용 명세가 정하고, 이 명세는 그 결과를 계약 하나에 어떻게 적용하는지만 정한다.
- 예금 이자 지급은 `js/gdc-bank.js`에서 LEGAL-HOLD이고 이자 재원이 서버에 없다. 이 명세는 서버에 올리지 않는다(시뮬레이션 전용).
- 납입은 사용자 → 예금금고 이체이므로 서버에 올리면 납입마다 이체 한도를 받는다(v0.1 §6과 같다). 한도로 거절된 납입의 처리는 미결정이다(v0.1 §7-4).

## 1. 계약 입력

| 필드 | 값 | 설명 |
|------|----|------|
| `monthlyAmount` | 정수 100 이상 1000 이하 (₮) | 월 납입액 (v0.1과 같다) |
| `termMonths` | 6 또는 12 | 약정 기간(개월) |
| `outcomes` | 배열, 원소는 `"paid"` 또는 `"missed"` | 1회차부터 차례로 각 달 납입 결과 (v0.1과 같다) |
| `settlements` | 배열, 길이는 `outcomes`와 같다 | 달 k의 운용 정산. 원소 `{ "poolCents": 0 이상 정수, "totalBalance": 0 이상 정수 }`. `poolCents`는 그 달 예치자 전체에 배분할 이자 재원(센트), `totalBalance`는 그 달 모든 예치자의 잔액 합(₮, 이 계약의 잔액 포함) |
| `cancelAt` | 선택, 정수 1 이상 | v0.1과 같다 |

"정수"는 값이 정수이면 된다(JSON `500.0`은 500). 불리언·문자열·NaN·무한대는 정수가 아니다. 객체의 추가 키(예: v0.1의 `rateBp`)는 무시한다.
`settlements`의 원소에 `poolCents`나 `totalBalance`가 없거나 `null`이면 정수가 아닌 것으로 보아 `SETTLEMENTS_INVALID`다. `outcomes`가 빈 배열이면 `settlements`도 빈 배열이어야 하며 유효하다(계약은 `active`, `endMonth` 0). `active`이면 `accruedCents`는 그때까지의 누적값이다. `monthlyAmount` `termMonths` `outcomes` `settlements`는 필수이고 없거나 `null`이면 그 오류 코드다. 검사 순서는 아래 표의 순서다.

| 오류 코드 | 조건 |
|-----------|------|
| `AMOUNT_INVALID` | `monthlyAmount`가 정수가 아니거나 범위 밖 |
| `TERM_INVALID` | `termMonths`가 6, 12가 아님 |
| `OUTCOMES_INVALID` | `outcomes`가 배열이 아니거나, 원소가 `paid`/`missed`가 아니거나, 길이가 `termMonths`보다 큼 |
| `SETTLEMENTS_INVALID` | `settlements`가 배열이 아니거나, 길이가 `outcomes`와 다르거나, 원소가 객체가 아니거나 `poolCents`/`totalBalance`가 음수이거나 정수가 아님 |
| `CANCEL_INVALID` | `cancelAt`이 (없음·null이 아니면서) 정수가 아니거나 1 미만이거나 `termMonths` 초과이거나 `outcomes` 길이보다 큼 |
| `SETTLEMENT_INCONSISTENT` | 달을 처리하는 중, 이 계약의 그 달 잔액이 그 달 `totalBalance`보다 큼 (계약의 잔액은 전체 잔액의 일부여야 한다). 이 오류는 계약이 끝나기 전에 처리한 달에서만 생긴다 |

`outcomes`·`settlements`의 형식 검사는 계약이 중간에 끝나 읽지 않게 되는 뒷 달의 원소까지 포함해 배열 전체에 적용한다.

## 2. 달의 진행

달 번호 k는 1부터 시작한다. 달 k를 처리할 때 순서는 다음과 같다.

1. **납입**: `outcomes[k]`가 `paid`이면 월 납입액이 적립된다. `missed`이면 아무것도 적립되지 않는다. 후납·선납은 허용하지 않는다.
2. **잔액** B_k = (k까지 납입한 달의 수) × `monthlyAmount` (₮). 그 달 납입분은 그 달 정산의 잔액에 포함된다.
3. **이자 발생**: B_k > `totalBalance`이면 `SETTLEMENT_INCONSISTENT`로 계산을 멈춘다. 아니면 달 k의 발생 이자(센트) = B_k > 0 이면 floor(`poolCents` × B_k ÷ `totalBalance`), B_k = 0 이면 0. (B_k > 0 이면 위 검사로 `totalBalance` ≥ B_k > 0 이다.) 발생 이자는 누적한다(`accruedCents`). 이자는 계약이 끝나기 전에는 지급되지 않는다.
4. **종료 판정**(v0.1 §2와 같은 순서·조건):
   - `outcomes[k]`와 `outcomes[k-1]`이 모두 `missed`(2회 연속 미납)이면 이 달 끝에 **자동 해지**(`auto_terminated`). k = 1 이면 직전 달이 없으므로 연속 미납이 아니다.
   - 자동 해지가 아니고 `cancelAt == k`이고 k < `termMonths`이면 사용자 **해지**(`cancelled`).
   - 위에 해당하지 않고 k == `termMonths`이면 **만기**(`matured`).
   - 어디에도 해당하지 않으면 다음 달로 간다. `outcomes`가 끝났는데 종료되지 않았으면 `active`다.
5. 종료된 계약은 이후 달의 `outcomes`·`settlements`를 읽지 않는다. 계약이 `cancelAt`보다 앞서 자동 해지로 끝나면 `cancelAt`은 무시한다(오류가 아니다). 만기 달에 `cancelAt == termMonths`이면 만기로 본다.

## 3. 지급

- **원금** = 납입한 달의 수 × `monthlyAmount` — 모든 종료 상태에서 **전액 돌려준다.** `active`이면 그때까지 낸 원금.
- **이자**: 만기(`matured`)이면 `accruedCents` 전부. 해지(`cancelled`)·자동 해지(`auto_terminated`)이면 `floor(accruedCents ÷ 2)` (중도해지 이자는 발생분의 50%, GDC 설계값). 센트 → ₮ 변환은 ÷ 100 (소수 둘째 자리). `active`이면 이자 0.
  해지로 포기한 이자(발생분의 나머지)는 이 계약이 받지 않으며, 그 돈이 어디로 가는지는 정하지 않았다(§5-3).
- **지급액** = 원금 + 이자. `active`이면 `null`.
- 해지에 위약금은 없다.

## 4. 출력

| 필드 | 설명 |
|------|------|
| `status` | `matured` / `cancelled` / `auto_terminated` / `active` |
| `endMonth` | 계약이 끝난 달 번호 (`active`면 처리한 마지막 달 번호, `outcomes`가 비어 있으면 0) |
| `paidCount` | 납입한 달의 수 |
| `principal` | 원금(₮) |
| `accruedCents` | 처리한 달까지 발생한 이자 합계(센트, 정수). 지급 전의 값이며 해지이면 이 값의 절반만 지급된다 |
| `interest` | 지급 이자(₮, 소수 둘째 자리). `active`이면 0 |
| `payout` | 지급액(₮). `active`이면 `null` |

오류이면 `error`만 돌려준다.

## 5. 알려진 한계

1. 값(월 납입액 ₮100~1,000, 중도해지 이자 50%, 연속 2회 미납 해지)은 모두 GDC 설계값이다. 중도해지 이자 비율은 확정 이율형 때의 값을 그대로 가져온 것이라 수익 연동형에 맞는지 시험하지 않았다.
2. 이자는 변동하고 0일 수 있다. 이 명세는 "적금 이율"을 보장하지 않는다. 사용자에게 보이는 표현은 이율이 아니라 **배분 몫**이어야 한다.
3. 해지로 포기한 이자(§3)와 버림 나머지의 귀속은 정하지 않았다(증권 운용 명세의 `undistributedCents`와 연결해야 한다).
4. `poolCents`에는 상한도 `totalBalance`와의 관계 제약도 없다. 한 달 재원이 계약 하나의 잔액에 비해 비현실적으로 커도 그대로 계산한다(정산이 증권 운용 규칙의 결과라는 가정에 의존한다). 월별 정산(`settlements`)은 입력이며, 이 명세는 정산이 증권 운용 명세 §3의 결과인지 확인하지 않는다. 달마다 `totalBalance`가 예치 상품 전체의 잔액 합이어야 정산 합계가 일치한다.
5. 잔액은 달 단위로만 본다(일 단위 이자, 납입일은 다루지 않는다). 달 안에서 납입한 날과 무관하게 그 달 잔액에 전액 포함된다.
6. 한도로 거절된 납입의 처리, 서버 스키마·엔드포인트가 없다(v0.1과 같다).
7. 검증 이력: 라운드 7(`rounds/r07`), 독립 검수 `rounds/r07-check`, 재검토 `rounds/r07-final` — 같은 제작사의 다른 모델이 한 검수이며 제3자 검증은 아니다.
