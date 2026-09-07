/// <reference path="../pb_data/types.d.ts" />
// 2026-09-07 신설 — gdc_test_loans.credit_snapshot(json)에 options.maxSize가
// 누락돼 실서버(l1-hanlim)에서 저장 시 validation_json_size_limit(허용
// 최대 0바이트)으로 거부되던 문제 수정. 정확히 account_risk_score.score_basis
// 때와 같은 PocketBase 0.22.x 숨은 필수값 문제 — 원래 마이그레이션
// (1793800002)에서 또 놓쳤다. 관례대로 2000000(2MB)로 설정.
//
// 이력 동기화 안내: 실제 수정은 hondi 저장소에서 먼저 적용·배포됐다
// (pb_migrations/1793900001_fixed_gdc_test_loans_credit_snapshot_maxsize.js,
// docs/POCKETBASE-STRUCTURE-GUIDE_v1_1_addendum_2026-07-19.md §5 참고 —
// 해당 문서는 hondi 저장소에만 있음). gdc 저장소에는 자동배포 파이프라인이
// 없어 이 파일이 실행되어도 실서버에 영향을 주지 않는다 — 두 저장소의
// 스키마 이력을 일치시키기 위한 기록용 사본이다.
migrate((db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("gdctln00000001");
  const field = collection.schema.getFieldById("gdctln0000f008");
  field.options.maxSize = 2000000;
  return dao.saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("gdctln00000001");
  const field = collection.schema.getFieldById("gdctln0000f008");
  field.options.maxSize = 0;
  return dao.saveCollection(collection);
});
