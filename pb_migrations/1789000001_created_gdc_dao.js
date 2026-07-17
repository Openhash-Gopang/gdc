/// <reference path="../pb_data/types.d.ts" />
// ── 2026-07-18 신설: GDC DAO 거버넌스 영속화(gdc_deposits와 동일 패턴).
// 이전에는 src/gdc/dao.js가 메모리(Map)에만 저장해 새로고침·다른
// 기기 접속 시 전부 사라졌고, 투표 시 stakeGDC를 호출자가 자기신고하는
// 값을 그대로 신뢰하는 버그가 있었다(2026-07-18 이전 세션 리포트 참고).
// 이번 이관으로 (1) L1에 영속 저장 (2) 투표 시 서버가 GET /biz/balance로
// 실제 잔액을 재검증해서 stake_gdc를 서버가 직접 채워넣는다 — 클라이언트가
// 보낸 값은 신뢰하지 않는다.
migrate((db) => {
  const proposals = new Collection({
    "id": "v46ioi1sprhxt35",
    "created": "2026-07-18 00:00:00.000Z",
    "updated": "2026-07-18 00:00:00.000Z",
    "name": "gdc_dao_proposals",
    "type": "base",
    "system": false,
    "schema": [
        { "system": false, "id": "p1a0aaaaaaaaaaa", "name": "proposal_id",  "type": "text",   "required": true,  "presentable": true,  "unique": true,  "options": { "min": null, "max": null, "pattern": "" } },
        { "system": false, "id": "p1a0aaaaaaaaaab", "name": "title",        "type": "text",   "required": true,  "presentable": true,  "unique": false, "options": { "min": null, "max": null, "pattern": "" } },
        { "system": false, "id": "p1a0aaaaaaaaaac", "name": "proposer_guid","type": "text",   "required": true,  "presentable": true,  "unique": false, "options": { "min": null, "max": null, "pattern": "" } },
        { "system": false, "id": "p1a0aaaaaaaaaad", "name": "params_json",  "type": "text",   "required": false, "presentable": false, "unique": false, "options": { "min": null, "max": null, "pattern": "" } },
        { "system": false, "id": "p1a0aaaaaaaaaae", "name": "expires_at",   "type": "date",   "required": true,  "presentable": true,  "unique": false, "options": {} }
    ],
    "indexes": [ "CREATE UNIQUE INDEX idx_gdc_dao_proposals_id ON gdc_dao_proposals (proposal_id)" ],
    "listRule": null, "viewRule": null, "createRule": null, "updateRule": null, "deleteRule": null,
    "options": {}
  });
  Dao(db).saveCollection(proposals);

  const votes = new Collection({
    "id": "kj03694hnqwk8rd",
    "created": "2026-07-18 00:00:00.000Z",
    "updated": "2026-07-18 00:00:00.000Z",
    "name": "gdc_dao_votes",
    "type": "base",
    "system": false,
    "schema": [
        { "system": false, "id": "v1a0aaaaaaaaaaa", "name": "proposal_id", "type": "text",   "required": true,  "presentable": true,  "unique": false, "options": { "min": null, "max": null, "pattern": "" } },
        { "system": false, "id": "v1a0aaaaaaaaaab", "name": "user_guid",   "type": "text",   "required": true,  "presentable": true,  "unique": false, "options": { "min": null, "max": null, "pattern": "" } },
        { "system": false, "id": "v1a0aaaaaaaaaac", "name": "choice",      "type": "select",  "required": true, "presentable": true,  "unique": false, "options": { "maxSelect": 1, "values": ["yes", "no", "abstain"] } },
        { "system": false, "id": "v1a0aaaaaaaaaad", "name": "stake_gdc",   "type": "number", "required": true,  "presentable": true,  "unique": false, "options": { "min": 0, "max": null } }
    ],
    "indexes": [ "CREATE UNIQUE INDEX idx_gdc_dao_votes_unique ON gdc_dao_votes (proposal_id, user_guid)" ],
    "listRule": null, "viewRule": null, "createRule": null, "updateRule": null, "deleteRule": null,
    "options": {}
  });
  return Dao(db).saveCollection(votes);
}, (db) => {
  const dao = new Dao(db);
  dao.deleteCollection(dao.findCollectionByNameOrId("kj03694hnqwk8rd"));
  return dao.deleteCollection(dao.findCollectionByNameOrId("v46ioi1sprhxt35"));
})
