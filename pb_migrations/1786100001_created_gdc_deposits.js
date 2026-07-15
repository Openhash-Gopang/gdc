/// <reference path="../pb_data/types.d.ts" />
// ── 2026-07-15 신설: GDC 예금 메타데이터. Supabase gdc_deposits → L1 이관.
// 실제 자금 이체는 이미 L1 /biz/order(blocks 원장)로 처리되고 있고,
// 이 컬렉션은 그 이체에 딸린 상품정보(product_type/interest_rate)만
// 보조로 기록한다 — vault_tx_hash로 실제 blocks 레코드와 연결된다.
migrate((db) => {
  const collection = new Collection({
    "id": "tv4axq0f580cv3j",
    "created": "2026-07-15 00:00:00.000Z",
    "updated": "2026-07-15 00:00:00.000Z",
    "name": "gdc_deposits",
    "type": "base",
    "system": false,
    "schema": [
        { "system": false, "id": "atm7tcmq5qbbot1", "name": "user_guid",     "type": "text",   "required": true,  "presentable": true,  "unique": false, "options": { "min": null, "max": null, "pattern": "" } },
        { "system": false, "id": "zquzug52ptj8qrb", "name": "product_type", "type": "text",   "required": true,  "presentable": true,  "unique": false, "options": { "min": null, "max": null, "pattern": "" } },
        { "system": false, "id": "naii0fkvggoytuy", "name": "principal",    "type": "number", "required": true,  "presentable": true,  "unique": false, "options": { "min": 0, "max": null } },
        { "system": false, "id": "d8xw08y8sweddti", "name": "interest_rate","type": "number", "required": false, "presentable": true,  "unique": false, "options": { "min": null, "max": null } },
        { "system": false, "id": "aphhy0jptw8ee54", "name": "vault_tx_hash","type": "text",   "required": true,  "presentable": true,  "unique": false, "options": { "min": null, "max": null, "pattern": "" } },
        { "system": false, "id": "saygyqubs8ptbp9", "name": "status",       "type": "text",   "required": true,  "presentable": true,  "unique": false, "options": { "min": null, "max": null, "pattern": "" } }
    ],
    "indexes": [ "CREATE INDEX idx_gdc_deposits_user_guid ON gdc_deposits (user_guid)" ],
    "listRule": null, "viewRule": null, "createRule": null, "updateRule": null, "deleteRule": null,
    "options": {}
});
  return Dao(db).saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("tv4axq0f580cv3j");
  return dao.deleteCollection(collection);
})
