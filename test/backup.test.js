import { test } from "node:test";
import assert from "node:assert/strict";

import { backupKey, backupOnce, listBackups } from "../src/backup.js";
import { fakeStore } from "./helpers/fake-store.js";

test("backupKey : formate la clé avec la version d'origine", () => {
  assert.equal(backupKey("prog12_simon_v1", 1), "prog12_simon_v1_backup_pre1");
});

test("backupOnce : écrit la copie verbatim sous <key>_backup_pre<from>", async () => {
  const store = fakeStore();
  const ok = await backupOnce(store, "prog12_simon_v1", 1, '{"schemaVersion":1,"logs":{}}');
  assert.equal(ok, true);
  assert.equal(store.data.get("prog12_simon_v1_backup_pre1"), '{"schemaVersion":1,"logs":{}}');
});

test("backupOnce : n'écrase jamais une copie déjà présente", async () => {
  const store = fakeStore();
  await backupOnce(store, "prog12_simon_v1", 1, "original");
  const ok = await backupOnce(store, "prog12_simon_v1", 1, "autre valeur");
  assert.equal(ok, true);
  assert.equal(store.data.get("prog12_simon_v1_backup_pre1"), "original");
});

test("backupOnce : renvoie false si l'écriture échoue, sans laisser de trace", async () => {
  const store = fakeStore({ failSet: true });
  const ok = await backupOnce(store, "prog12_simon_v1", 1, "original");
  assert.equal(ok, false);
  assert.equal(store.data.has("prog12_simon_v1_backup_pre1"), false);
});

test("backupOnce : renvoie false si le store est indisponible", async () => {
  assert.equal(await backupOnce(null, "prog12_simon_v1", 1, "x"), false);
});

test("listBackups : ne trouve rien sur un store vide", async () => {
  const store = fakeStore();
  assert.deepEqual(await listBackups(store, "prog12_simon_v1", 3), []);
});

test("listBackups : trouve les copies existantes, bornées à currentVersion - 1", async () => {
  const store = fakeStore();
  await backupOnce(store, "prog12_simon_v1", 1, "v1 original");
  const found = await listBackups(store, "prog12_simon_v1", 3);
  assert.deepEqual(found, [{ from: 1, value: "v1 original" }]);
});

test("listBackups : renvoie [] si le store est indisponible", async () => {
  assert.deepEqual(await listBackups(null, "prog12_simon_v1", 3), []);
});
