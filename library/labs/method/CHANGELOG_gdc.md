# GDC 방법론 — 갱신 기록 (CHANGELOG)

`gdc_credit_v*.md` (신용평가), `gdc_valuation_v*.md` (기업가치 평가), `gdc_check_v*.md` (독립 검수)
의 버전별 변경 내용을 최신순으로 기록한다. klaw의 `CHANGELOG_klaw.md` 와 같은 형식이다.
버전 표기는 `major.minor[.patch]` 이며, 각 버전의 원문 전체는 저장소 루트의 해당 파일에 둔다.

---

## (아직 방법론 본체 없음)

**날짜**: 2026-10-03 (P0)
**상태**: 방법론 본체 `gdc_credit_v1_0.md`, `gdc_valuation_v1_0.md`, `gdc_check_v1_0.md` 는 P2에서 작성한다.
**현재 신용평가 로직**: `js/gdc-credit.js` 의 4대 지표·등급표(`GRADE_RATES`)가 유일한 구현이며,
별도 방법론 문서로 고정되어 있지 않다. P2의 첫 작업은 이 구현을 문서로 옮겨 v1.0 으로 고정하는 것이다.
