# 라운드 디렉터리 규약

라운드마다 `rounds/<R>/` (실행), `rounds/<R>-check/` (독립 검수), `rounds/<R>-final/` (재검토)
디렉터리를 둔다. 라운드 목록은 `../rounds-manifest.json` 에 기록한다.
`pipeline.md` §3 참조. 실행된 라운드: [r01](r01/results.md) (기준선, 1단계만), [r02](r02/results.md) (신용평가 v1.0, 3단계 완료), [r03](r03/results.md) (적금 v0.1, 3단계 완료), [r04](r04/results.md) (기업가치 v0.1, 3단계 완료). 모두 시뮬레이션이다.
라운드 하나를 실행하려면 `node library/labs/scripts/run_round.mjs <R>` (`<R>/scenarios.json` 필요).
