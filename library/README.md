# GDC Library — 문서 허브

> klaw.hondi.net의 `library/` 와 같은 형식으로 GDC 문서를 한곳에 모은 허브다 (2026-10-03, P0).
> 필드테스트 단계 — 금융기관 종사자 필드테스터 한정이며 상용 금융 서비스가 아니다.

| 폴더 | 내용 | 상태 |
|------|------|------|
| `business/` | GDC 백서 v1.0 / v1.1 / v1.5 (`docs/`에서 이전) | 이전 완료 |
| `dev/` | 인수인계 문서, L1 이전 세션 요약 (`docs/`에서 이전) | 이전 완료 |
| `labs/` | 상품별 테스트 방법론·시나리오·라운드 (klaw의 `benchmark/` 대응) | 한도 명세 v0.1, 라운드 1 (P1) |
| `methodology/` | 신용평가·기업가치 평가 방법론 문서 | 비어 있음 (P2에서 작성) |
| `papers/` | 논문·특허 기술 설명 | 비어 있음 |
| `reports/` | 라운드별 실증 보고서 | 비어 있음 (P1 이후) |

## 문서 목록

- 백서: [v1.5](business/GDC_Whitepaper_v1.5.md) · [v1.1](business/GDC_WHITEPAPER_v1_1.md) · [v1.0](business/GDC_WHITEPAPER_v1_0.md)
- 개발: [GOPANG_HANDOVER](dev/GOPANG_HANDOVER.md) · [L1 이전 세션 요약 (2026-07-07)](dev/session-summary-2026-07-07-gdc-l1-migration.md)
- 테스트: [labs/README.md](labs/README.md) · [한도 명세 v0.1](labs/method/limits_v0_1.md) · [라운드 1 결과](labs/rounds/r01/results.md)
- 로드맵: [../GDC_ROADMAP.md](../GDC_ROADMAP.md)

## 사이트맵 (목표 — P1~P4에서 단계적으로 구현)

```
gdc.hondi.net
  index        기기 라우터 + 랜딩                         (기존)
  desktop      PC 시뮬레이터 (예금·적금·대출·보험·증권·화폐)  (기존 확장)
  webapp       모바일 지갑                                (기존 확장)
  credit       개인 신용평가                              (신설, P2)
  valuation    기업가치 평가                              (신설, P2)
  labs         상품별 테스트 라운드 결과                    (신설, P1)
  dashboard / user-dashboard / pool-dashboard / nation-dashboard   (기존)
  report / whitepaper / business                           (신설, P4)
  library      문서 허브 (이 폴더의 웹 버전)                (신설, P4)
  user-manual / dev-docs / board / participation           (신설, P4)
```

아직 만들지 않은 페이지는 사이트 내비게이션에 넣지 않는다 (죽은 링크 방지).
