import { test } from "node:test";
import assert from "node:assert/strict";

import { createStore, loadJournal, saveJournal } from "../src/storage.js";
import { SCHEMA_VERSION, LEGACY_PROGRAM_ID } from "../src/schema.js";
import { LEGACY_DEFINITION } from "../src/legacy-program.js";
import { fakeStore } from "./helpers/fake-store.js";
import { testCtx } from "./helpers/migration-ctx.js";

test("createStore : sans window ni window.storage, se rabat sur le shim localStorage ou renvoie null", () => {
  // Environnement node --test : pas de window global -> createStore() ne doit pas lever.
  assert.equal(createStore(), null);
});

test("loadJournal : store indisponible -> reason no-store, ne lève pas", async () => {
  assert.deepEqual(await loadJournal(null, "K"), { ok: false, reason: "no-store" });
});

test("loadJournal : clé absente -> reason absent (première utilisation)", async () => {
  const store = fakeStore();
  assert.deepEqual(await loadJournal(store, "K"), { ok: false, reason: "absent" });
});

test("loadJournal : journal v1 (plat) migré vers v3, backup écrit, forme migrée renvoyée", async () => {
  const store = fakeStore();
  const raw = JSON.stringify({ logs: { w1_hautA: { done: true } }, cardio: {}, checkin: {} });
  store.data.set("K", raw);

  const res = await loadJournal(store, "K", testCtx());
  assert.equal(res.ok, true);
  assert.equal(res.migrated, true);
  assert.equal(res.backupOk, true);
  const logs = Object.values(res.journal.programs[res.journal.activeProgramId].logs);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].slot, "hautA");
  assert.equal(store.data.get("K_backup_pre1"), raw); // #8 : copie verbatim avant réécriture
});

test("loadJournal : journal à la version courante chargé inchangé, aucun backup écrit", async () => {
  const store = fakeStore();
  const current = { schemaVersion: SCHEMA_VERSION, activeProgramId: "p1", programs: { p1: { definition: { id: "p1", startDate: "2026-01-05" }, logs: {}, cardio: {}, checkin: {} } } };
  store.data.set("K", JSON.stringify(current));

  const res = await loadJournal(store, "K", testCtx());
  assert.deepEqual(res, { ok: true, journal: { activeProgramId: "p1", programs: current.programs }, migrated: false });
  assert.equal([...store.data.keys()].some((k) => k.includes("backup")), false);
});

test("loadJournal : journal v3 (definition: null) épinglé vers v4, backup pre3 écrit (#26)", async () => {
  const store = fakeStore();
  const v3 = { schemaVersion: 3, activeProgramId: LEGACY_PROGRAM_ID, programs: { [LEGACY_PROGRAM_ID]: { definition: null, logs: {}, cardio: {}, checkin: {} } } };
  const raw = JSON.stringify(v3);
  store.data.set("K", raw);

  const res = await loadJournal(store, "K", testCtx());
  assert.equal(res.ok, true);
  assert.equal(res.migrated, true);
  assert.deepEqual(res.journal.programs[LEGACY_PROGRAM_ID].definition, LEGACY_DEFINITION);
  assert.equal(store.data.get("K_backup_pre3"), raw); // #8 : l'original avant l'épinglage
});

test("loadJournal : entrée active sans définition à la version courante -> reason invalid (#26)", async () => {
  const store = fakeStore();
  const unpinned = { schemaVersion: SCHEMA_VERSION, activeProgramId: "p1", programs: { p1: { definition: null, logs: {}, cardio: {}, checkin: {} } } };
  store.data.set("K", JSON.stringify(unpinned));

  assert.deepEqual(await loadJournal(store, "K", testCtx()), { ok: false, reason: "invalid" });
});

test("loadJournal : schemaVersion trop récent -> reason too-new, store non modifié", async () => {
  const store = fakeStore();
  store.data.set("K", JSON.stringify({ schemaVersion: 99, activeProgramId: "p1", programs: {} }));

  const res = await loadJournal(store, "K", testCtx());
  assert.deepEqual(res, { ok: false, reason: "too-new" });
  assert.equal(store.data.size, 1); // rien d'écrit en plus de la clé d'origine
});

test("loadJournal : JSON corrompu -> reason corrupt", async () => {
  const store = fakeStore();
  store.data.set("K", "{ceci n'est pas du JSON");

  assert.deepEqual(await loadJournal(store, "K", testCtx()), { ok: false, reason: "corrupt" });
});

test("loadJournal : schemaVersion hors bornes (#10) -> reason invalid", async () => {
  const store = fakeStore();
  store.data.set("K", JSON.stringify({ schemaVersion: 0, activeProgramId: "p1", programs: {} }));

  assert.deepEqual(await loadJournal(store, "K", testCtx()), { ok: false, reason: "invalid" });
});

test("loadJournal : activeProgramId sans entrée dans programs -> reason invalid (#21 item 5)", async () => {
  const store = fakeStore();
  const dangling = { schemaVersion: SCHEMA_VERSION, activeProgramId: "ghost", programs: { p1: { definition: null, logs: {}, cardio: {}, checkin: {} } } };
  store.data.set("K", JSON.stringify(dangling));

  assert.deepEqual(await loadJournal(store, "K", testCtx()), { ok: false, reason: "invalid" });
});

test("loadJournal : clé de log non reconnue -> reason invalid, rien n'est réécrit (#16)", async () => {
  const store = fakeStore();
  const raw = JSON.stringify({ logs: { pas_une_cle_valide: { done: true } }, cardio: {}, checkin: {} });
  store.data.set("K", raw);

  assert.deepEqual(await loadJournal(store, "K", testCtx()), { ok: false, reason: "invalid" });
  assert.equal(store.data.get("K"), raw); // rien n'est réécrit sur un échec
});

test("loadJournal : échec de la sauvegarde de sécurité -> backupOk false, journal quand même renvoyé", async () => {
  const store = fakeStore({ failSet: true });
  store.data.set("K", JSON.stringify({ logs: {}, cardio: {}, checkin: {} }));

  const res = await loadJournal(store, "K", testCtx());
  assert.equal(res.ok, true);
  assert.equal(res.migrated, true);
  assert.equal(res.backupOk, false); // l'appelant doit bloquer les sauvegardes de la session
});

test("saveJournal : store indisponible -> échec signalé, pas de levée", async () => {
  assert.deepEqual(await saveJournal(null, "K", { activeProgramId: "p1", programs: {} }), { ok: false, failed: true });
});

test("saveJournal : écrit l'enveloppe versionnée sous la clé", async () => {
  const store = fakeStore();
  const journal = { activeProgramId: "p1", programs: { p1: { definition: null, logs: { x: 1 }, cardio: {}, checkin: {} } } };

  assert.deepEqual(await saveJournal(store, "K", journal), { ok: true });
  assert.deepEqual(JSON.parse(store.data.get("K")), { schemaVersion: SCHEMA_VERSION, ...journal });
});

test("saveJournal : l'écriture lève -> échec signalé (storageOk doit tomber côté appelant)", async () => {
  const store = fakeStore({ failSet: true });
  const journal = { activeProgramId: "p1", programs: {} };

  assert.deepEqual(await saveJournal(store, "K", journal), { ok: false, failed: true });
});
