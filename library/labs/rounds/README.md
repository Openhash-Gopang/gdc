# 라운드 디렉터리 규약

라운드마다 `rounds/<R>/` (실행), `rounds/<R>-check/` (독립 검수), `rounds/<R>-final/` (재검토)
디렉터리를 둔다. 라운드 목록은 `../rounds-manifest.json` 에 기록한다.
`pipeline.md` §3 참조. 실행된 라운드: [r01](r01/results.md) (2026-10-03, 시뮬레이션, 1단계만 완료).
라운드 하나를 실행하려면 `node library/labs/scripts/run_round.mjs <R>` (`<R>/scenarios.json` 필요).
