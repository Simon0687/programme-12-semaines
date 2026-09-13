import test from "node:test";
import assert from "node:assert/strict";
import { fakeStore } from "./helpers/fake-store.js";
import {
  STALE_AFTER_DAYS,
  lastExportKey,
  toIsoDate,
  readLastExport,
  writeLastExport,
  daysBetween,
  isExportStale,
  journalHasContent,
} from "../src/export-state.js";

const KEY = "prog12_simon_v1";

test("lastExportKey : clé sœur du journal, pas un champ dedans", () => {
  assert.equal(lastExportKey(KEY), "prog12_simon_v1_last_export");
});

test("toIsoDate : composantes locales et zéros de tête, jamais toISOString", () => {
  // 23h45 local doit rester le même jour : toISOString() basculerait au
  // lendemain dès que le fuseau est derrière UTC.
  assert.equal(toIsoDate(new Date(2026, 9, 4, 23, 45)), "2026-10-04");
  assert.equal(toIsoDate(new Date(2026, 0, 5)), "2026-01-05");
});

test("readLastExport : clé absente => null, sans lever (le shim lève)", async () => {
  assert.equal(await readLastExport(fakeStore(), KEY), null);
});

test("readLastExport : pas de store => null", async () => {
  assert.equal(await readLastExport(null, KEY), null);
});

test("writeLastExport puis readLastExport : aller-retour", async () => {
  const store = fakeStore();
  assert.equal(await writeLastExport(store, KEY, "2026-10-04"), true);
  assert.equal(await readLastExport(store, KEY), "2026-10-04");
});

test("writeLastExport : la valeur s'écrase, contrairement à une sauvegarde", async () => {
  const store = fakeStore();
  await writeLastExport(store, KEY, "2026-10-04");
  await writeLastExport(store, KEY, "2026-10-18");
  assert.equal(await readLastExport(store, KEY), "2026-10-18");
});

test("writeLastExport : une date mal formée est refusée, rien n'est écrit", async () => {
  const store = fakeStore();
  assert.equal(await writeLastExport(store, KEY, "hier"), false);
  assert.equal(store.data.has(lastExportKey(KEY)), false);
});

test("writeLastExport : écriture en échec => false, jamais une exception", async () => {
  assert.equal(await writeLastExport(fakeStore({ failSet: true }), KEY, "2026-10-04"), false);
});

test("readLastExport : valeur illisible traitée comme absente", async () => {
  const store = fakeStore();
  await store.set(lastExportKey(KEY), "{}");
  assert.equal(await readLastExport(store, KEY), null);
});

/* ---------- péremption ---------- */

test("daysBetween : compte des jours pleins", () => {
  assert.equal(daysBetween("2026-10-04", "2026-10-18"), 14);
  assert.equal(daysBetween("2026-10-04", "2026-10-04"), 0);
});

test("daysBetween : un passage à l'heure d'été ne décale pas le compte", () => {
  // 25 octobre 2026 : fin de l'heure d'été en Europe, une journée de 25 h.
  assert.equal(daysBetween("2026-10-24", "2026-10-26"), 2);
});

test("daysBetween : entrée mal formée => null", () => {
  assert.equal(daysBetween("hier", "2026-10-04"), null);
  assert.equal(daysBetween(null, "2026-10-04"), null);
});

test("isExportStale : la bascule se fait à STALE_AFTER_DAYS, pas avant", () => {
  assert.equal(STALE_AFTER_DAYS, 14);
  assert.equal(isExportStale("2026-10-04", "2026-10-17"), false); // 13 jours
  assert.equal(isExportStale("2026-10-04", "2026-10-18"), true);  // 14 jours
  assert.equal(isExportStale("2026-10-04", "2026-10-19"), true);  // 15 jours
});

test("isExportStale : jamais exporté => périmé", () => {
  assert.equal(isExportStale(null, "2026-10-18"), true);
});

/* ---------- y a-t-il quelque chose à perdre ? ---------- */

const withProgram = (entry) => ({ activeProgramId: "p1", programs: { p1: entry } });

test("journalHasContent : journal neuf => false", () => {
  assert.equal(journalHasContent(withProgram({ logs: {}, cardio: {}, checkin: {} })), false);
});

test("journalHasContent : une séance suffit", () => {
  assert.equal(journalHasContent(withProgram({ logs: { a: {} }, cardio: {}, checkin: {} })), true);
});

test("journalHasContent : un bilan seul suffit aussi", () => {
  assert.equal(journalHasContent(withProgram({ logs: {}, cardio: {}, checkin: { w1: { poids: "78" } } })), true);
});

test("journalHasContent : du contenu dans un cycle inactif compte", () => {
  const j = { activeProgramId: "p1", programs: { p1: { logs: {} }, p2: { logs: { a: {} } } } };
  assert.equal(journalHasContent(j), true);
});

test("journalHasContent : formes dégénérées => false, jamais une exception", () => {
  assert.equal(journalHasContent(null), false);
  assert.equal(journalHasContent({}), false);
  assert.equal(journalHasContent({ programs: null }), false);
  assert.equal(journalHasContent({ programs: { p1: null } }), false);
});
