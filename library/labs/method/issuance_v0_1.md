# 증권 발행·가격 규칙 v0.1 (2026-10-03, P3f)

[설계 결정 2](decisions_2026-10-03.md)(테스터가 만든 가상 기업이 발행하는 ₮1 정액 지분, 시뮬레이션)를 계산 가능한 규칙으로 옮긴 **시뮬레이션용 명세**다. 서버에는 없다.
이 문서의 값은 모두 **GDC 설계값**이다. 상용 금융 서비스가 아니고 투자 판단·인허가를 대체하지 않는다. 금액은 GDC(₮), 1₮ = KRW 1,000, 가격은 1/100 ₮(센트) 정수로 계산한다.

## 0. 범위

- **다루는 것**: 한 번의 **신주 발행**(청약 접수 → 배정)과 발행 직후의 **참고 가격·가격 띠**. 가격의 근거는 [기업가치 평가 v0.1](../../../gdc_valuation_v0_1.md)의 하한·중간·상한이다.
- **다루지 않는 것**: 발행 후 매매(주문·체결·호가), 평가 갱신 주기, 배당, 자기 지분 취득, 상환, 종목 상장폐지. 이 규칙은 **발행 시점 한 번의 평가값**을 입력으로 받으므로 평가 갱신 주기와 무관하다(기업가치 v0.1의 연간 값 가정을 그대로 따른다).
- **실제 잔액을 움직이지 않는다.** 청약금·발행 대금의 이체는 정의하지 않는다(시뮬레이션 전용).
- 증권의 기본 단위는 **₮1 정액 지분 1단위**다. 최초 발행가는 단위당 ₮1(100센트)이다.

## 1. 입력

| 필드 | 값 | 설명 |
|------|----|------|
| `issuerId` | 비어 있지 않은 문자열 | 발행 기업(필드테스터의 가상 기업) |
| `grade` | `AAA` `AA` `A` `BBB` `BB` `C` | 신용평가 v1.0 등급 (대소문자까지 정확히 같아야 한다) |
| `valuation` | 객체 `{ low, mid, high }`, 각각 0 이상 정수(₮), `low ≤ mid ≤ high` | 기업가치 평가 v0.1의 출력 |
| `issuedUnits` | 0 이상 정수 | 이미 발행되어 있는 단위 수 |
| `requestUnits` | 1 이상 100000 이하 정수 | 이번에 발행하려는 단위 수 |
| `subscriptions` | 배열 (없음/`null`이면 빈 배열) | 원소 `{ "id": 비어 있지 않은 문자열, "units": 1 이상 정수 }`. 청약자 목록. `id`는 서로 달라야 한다. `id`가 `issuerId`와 같으면 **내부자 청약**이다 |

"정수"는 값이 정수이면 된다(JSON `500.0`은 500). 불리언·문자열·NaN·무한대는 정수가 아니다. 객체의 추가 키는 무시한다. 필수 필드(`subscriptions` 제외)가 없거나 `null`이면 그 필드의 오류 코드다. 입력 전체가 객체가 아니면 `ISSUER_INVALID`다.
원소의 필수 필드가 없거나 `null`이면 조건을 만족하지 않은 것으로 본다(`valuation`의 `low`/`mid`/`high`도 같다). §1의 입력 오류 검사가 §2의 거절 판정보다 **먼저**다 — 입력 오류가 있으면 등급과 상관없이 오류 코드를 돌려준다. `id`의 비교(내부자 판정, 중복)는 대소문자를 구분한다.

| 오류 코드 | 조건 (검사 순서) |
|-----------|------------------|
| `ISSUER_INVALID` | `issuerId`가 비어 있지 않은 문자열이 아님 (공백만 있어도 비어 있지 않은 것으로 본다) |
| `GRADE_INVALID` | `grade`가 목록에 없음 |
| `VALUATION_INVALID` | `valuation`이 객체가 아니거나, `low`/`mid`/`high`가 음수이거나 정수가 아니거나, `low ≤ mid ≤ high`가 아님 |
| `ISSUED_INVALID` | `issuedUnits`가 음수이거나 정수가 아님 |
| `REQUEST_INVALID` | `requestUnits`가 정수가 아니거나 범위 밖 |
| `SUBSCRIPTIONS_INVALID` | `subscriptions`가 (없음·null이 아니면서) 배열이 아니거나, 원소가 객체가 아니거나, `id`가 비어 있지 않은 문자열이 아니거나, `units`가 1 미만이거나 정수가 아니거나, `id`가 중복 |

## 2. 발행 판정

아래를 **순서대로** 보고 **처음 해당하는 것**으로 발행을 **거절**한다(`status` = `rejected`, `reason` = 코드). 거절은 오류가 아니다.

1. `GRADE_C`: `grade`가 `C` (C 등급은 발행할 수 없다 — 증권 운용 명세가 C 등급을 투자 대상에서 제외하는 것과 같다).
2. `VALUATION_ZERO`: `valuation.mid`가 0 (가격의 근거가 없다).
3. **발행가** 계산: `issuedUnits`가 0이면 `priceCents` = 100. 아니면 `priceCents` = floor(`mid` × 100 ÷ `issuedUnits`). `priceCents`가 0이면 `PRICE_ZERO`로 거절한다.
4. `RAISE_CAP`: `requestUnits × priceCents × 2 > mid × 100` (한 번의 발행 규모가 중간 평가값의 50%를 넘음).

거절되지 않으면 `status` = `issued`이고 §3으로 간다.

## 3. 배정

- 청약 합계 T = Σ `units`. `subscriptions`가 비어 있으면 T = 0이다.
- **1단계(안분)**: T ≤ `requestUnits`이면 각 청약자의 배정 후보는 청약 수량 그대로다. T > `requestUnits`이면 초과 청약이므로 배정 후보 = floor(`units` × `requestUnits` ÷ T)이다.
- **2단계(내부자 상한)**: `id`가 `issuerId`와 같은 청약자의 배정은 `min(후보, floor(requestUnits × 20 ÷ 100))`이다 (내부자는 이번 발행의 20%를 넘게 배정받을 수 없다, GDC 설계값). 다른 청약자는 후보가 배정이다. 상한으로 잘린 수량은 다른 청약자에게 다시 배정하지 않고 미배정이 된다. 배정이 0인 청약자도 `allocations`에 `units: 0`으로 남는다.
- 배정 합계 A = Σ 배정. 미배정 수량 `unallocatedUnits` = `requestUnits` − A (청약이 모자라거나 버림·상한으로 남은 수량. 발행되지 않는다).

**결과 값**:
- `raisedCents` = A × `priceCents`
- `newIssuedUnits` = `issuedUnits` + A
- 발행 후 가치(센트) = `mid` × 100 + `raisedCents` (조달한 현금이 기업가치에 더해진다고 본다)
- `postPriceCents` = floor(발행 후 가치 ÷ `newIssuedUnits`)
- **가격 띠**: `bandLowCents` = floor((`low` × 100 + `raisedCents`) ÷ `newIssuedUnits`), `bandHighCents` = ceil((`high` × 100 + `raisedCents`) ÷ `newIssuedUnits`). 이후 시뮬레이션 매매의 가격은 이 띠 안이어야 한다(매매 규칙은 이 버전에 없다).
- `newIssuedUnits`가 0이면(처음 발행인데 배정이 0) `postPriceCents`, `bandLowCents`, `bandHighCents`는 `null`이다.

## 4. 출력

| 필드 | 설명 |
|------|------|
| `status` | `issued` / `rejected` |
| `reason` | 거절 코드, 발행이면 `null` |
| `priceCents` | 발행가(센트). `GRADE_C`·`VALUATION_ZERO` 거절이면 `null`, 그 밖에는 §2-3의 값(`PRICE_ZERO` 거절이면 0) |
| `allocations` | 청약자별 `{ id, units }` (배정 수량), `subscriptions` 입력 순서. 거절이면 빈 배열 |
| `unallocatedUnits` | 미배정 수량. 거절이면 `requestUnits` |
| `raisedCents` | 조달액(센트). 거절이면 0 |
| `newIssuedUnits` | 발행 후 총 단위 수. 거절이면 `issuedUnits` |
| `postPriceCents` `bandLowCents` `bandHighCents` | §3. 거절이면 `null` |

오류이면 `error`만 돌려준다.

## 5. 알려진 한계

1. 값(최초 발행가 ₮1, 한 번의 발행 한도 중간값의 50%, 내부자 20%, 발행 최대 100,000단위)은 모두 GDC 설계값이며 근거 자료가 없다.
2. 평가값(`valuation`)은 입력이다. 가상 기업이 재무제표를 부풀려 높은 가격을 받는 시도는 이 규칙이 막지 못한다(결정 3의 한계와 같다). 필드테스터의 공격 시나리오 대상이다.
3. 발행 후 가치를 `mid + 조달액`으로 보는 것은 단순 가정이다. 하한이 0인 경우가 많아(기업가치 v0.1 §7) 가격 띠의 하한이 조달액만으로 정해질 수 있다.
4. 발행가는 발행 전 평가값 ÷ 기존 단위 수다. 발행 규모가 커도 가격이 희석되지 않는 구조다(조달액을 가치에 더하므로 `postPriceCents` ≈ `priceCents`, 버림 오차만 있다).
5. 청약금의 실제 이체·반환, 매매, 배당, 평가 갱신은 정의하지 않았다. 서버 스키마가 없다.
6. 내부자 판정은 `id`가 `issuerId`와 같은 경우뿐이다(특수관계자·계열사는 알 수 없다).
7. 검증 이력: 라운드 8(`rounds/r08`), 독립 검수 `rounds/r08-check`, 재검토 `rounds/r08-final` — 같은 제작사의 다른 모델이 한 검수이며 제3자 검증은 아니다.
