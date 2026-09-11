import { test } from "node:test";
import assert from "node:assert/strict";

import { createStore, loadJournal, saveJournal } from "../src/storage.js";
import { fakeStore } from "./helpers/fake-store.js";

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

test("loadJournal : journal v1 (plat) migré vers v2, backup écrit, forme migrée renvoyée", async () => {
  const store = fakeStore();
  const raw = JSON.stringify({ logs: { a: 1 }, cardio: {}, checkin: {} });
  store.data.set("K", raw);

  const res = await loadJournal(store, "K");
  assert.equal(res.ok, true);
  assert.equal(res.migrated, true);
  assert.equal(res.backupOk, true);
  assert.equal(res.journal.programs[res.journal.activeProgramId].logs.a, 1);
  assert.equal(store.data.get("K_backup_pre1"), raw); // #8 : copie verbatim avant réécriture
});

test("loadJournal : journal v2 (courant) chargé inchangé, aucun backup écrit", async () => {
  const store = fakeStore();
  const v2 = { schemaVersion: 2, activeProgramId: "p1", programs: { p1: { definition: null, logs: {}, cardio: {}, checkin: {} } } };
  store.data.set("K", JSON.stringify(v2));

  const res = await loadJournal(store, "K");
  assert.deepEqual(res, { ok: true, journal: { activeProgramId: "p1", programs: v2.programs }, migrated: false });
  assert.equal([...store.data.keys()].some((k) => k.includes("backup")), false);
});

test("loadJournal : schemaVersion trop récent -> reason too-new, store non modifié", async () => {
  const store = fakeStore();
  store.data.set("K", JSON.stringify({ schemaVersion: 99, activeProgramId: "p1", programs: {} }));

  const res = await loadJournal(store, "K");
  assert.deepEqual(res, { ok: false, reason: "too-new" });
  assert.equal(store.data.size, 1); // rien d'écrit en plus de la clé d'origine
});

test("loadJournal : JSON corrompu -> reason corrupt", async () => {
  const store = fakeStore();
  store.data.set("K", "{ceci n'est pas du JSON");

  assert.deepEqual(await loadJournal(store, "K"), { ok: false, reason: "corrupt" });
});

test("loadJournal : schemaVersion hors bornes (#10) -> reason invalid", async () => {
  const store = fakeStore();
  store.data.set("K", JSON.stringify({ schemaVersion: 0, activeProgramId: "p1", programs: {} }));

  assert.deepEqual(await loadJournal(store, "K"), { ok: false, reason: "invalid" });
});

test("loadJournal : activeProgramId sans entrée dans programs -> reason invalid (#21 item 5)", async () => {
  const store = fakeStore();
  const dangling = { schemaVersion: 2, activeProgramId: "ghost", programs: { p1: { definition: null, logs: {}, cardio: {}, checkin: {} } } };
  store.data.set("K", JSON.stringify(dangling));

  assert.deepEqual(await loadJournal(store, "K"), { ok: false, reason: "invalid" });
});

test("loadJournal : échec de la sauvegarde de sécurité -> backupOk false, journal quand même renvoyé", async () => {
  const store = fakeStore({ failSet: true });
  store.data.set("K", JSON.stringify({ logs: {}, cardio: {}, checkin: {} }));

  const res = await loadJournal(store, "K");
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
  assert.deepEqual(JSON.parse(store.data.get("K")), { schemaVersion: 2, ...journal });
});

test("saveJournal : l'écriture lève -> échec signalé (storageOk doit tomber côté appelant)", async () => {
  const store = fakeStore({ failSet: true });
  const journal = { activeProgramId: "p1", programs: {} };

  assert.deepEqual(await saveJournal(store, "K", journal), { ok: false, failed: true });
});
