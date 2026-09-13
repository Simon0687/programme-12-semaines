import { test } from "node:test";
import assert from "node:assert/strict";

import { backupDroppedOnce, backupKey, backupOnce, backupPreImportOnce, droppedBackupKey, listBackups, preImportBackupKey, readDroppedBackup, readPreImportBackup } from "../src/backup.js";
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

test("droppedBackupKey : une clé sans version, la perte n'étant pas un changement de format", () => {
  assert.equal(droppedBackupKey("prog12_simon_v1"), "prog12_simon_v1_backup_dropped");
});

test("backupDroppedOnce : écrit la copie verbatim, puis ne l'écrase plus", async () => {
  const store = fakeStore();
  assert.equal(await backupDroppedOnce(store, "K", '{"origine":1}'), true);
  assert.equal(await backupDroppedOnce(store, "K", '{"plus tard":2}'), true);
  assert.equal(store.data.get("K_backup_dropped"), '{"origine":1}');
});

test("readDroppedBackup : rend la copie, ou null quand il n'y en a pas", async () => {
  const store = fakeStore();
  assert.equal(await readDroppedBackup(store, "K"), null);
  await backupDroppedOnce(store, "K", '{"origine":1}');
  assert.equal(await readDroppedBackup(store, "K"), '{"origine":1}');
  assert.equal(await readDroppedBackup(null, "K"), null);
});

/* ---------- copie d'avant import (#11, écrite dans #15) ---------- */

test("preImportBackupKey : une clé sans version, l'import n'étant pas un changement de format", () => {
  assert.equal(preImportBackupKey("prog12_simon_v1"), "prog12_simon_v1_backup_preimport");
});

test("backupPreImportOnce : un second import n'écrase pas l'état d'avant le premier", async () => {
  const store = fakeStore();
  assert.equal(await backupPreImportOnce(store, "K", '{"avant tout":1}'), true);
  /* Le deuxième appel rend true — l'original est protégé, ce qui est la
     question posée — mais n'écrit rien : sans ça, importer deux mauvais
     fichiers de suite effacerait le seul état qu'on voulait retrouver. */
  assert.equal(await backupPreImportOnce(store, "K", '{"deja importe":2}'), true);
  assert.equal(store.data.get("K_backup_preimport"), '{"avant tout":1}');
});

test("backupPreImportOnce : écriture impossible => false, rien n'est perdu en silence", async () => {
  assert.equal(await backupPreImportOnce(fakeStore({ failSet: true }), "K", "x"), false);
});

test("readPreImportBackup : rend la copie, ou null quand il n'y en a pas", async () => {
  const store = fakeStore();
  assert.equal(await readPreImportBackup(store, "K"), null);
  await backupPreImportOnce(store, "K", '{"avant tout":1}');
  assert.equal(await readPreImportBackup(store, "K"), '{"avant tout":1}');
  assert.equal(await readPreImportBackup(null, "K"), null);
});

test("les trois copies vivent sous des clés distinctes", () => {
  const k = "prog12_simon_v1";
  const keys = new Set([backupKey(k, 1), droppedBackupKey(k), preImportBackupKey(k)]);
  assert.equal(keys.size, 3);
});
