import test from "node:test";
import assert from "node:assert/strict";
import { realisedWeek, realisedRows, hasRealised } from "../src/realised-volume.js";
import { weeklyVolume, contribution, VOLUME } from "../src/assertions.js";
import { EXERCISES } from "../src/registry.js";

/* Des séries écrites comme le journal les écrit : des chaînes, parce que ce
   sont des champs de saisie. */
const set = (w, r) => ({ w, r, rir: "1" });
const log = (more = {}) => ({ date: "2026-08-03", slot: "upperA", done: true, kind: "normal", ex: {}, ...more });
const sets = (rows) => rows.map((r) => ({ vid: r.vid, sets: r.sets }));

test("une séance validée : une ligne par exercice, comptée en séries saisies", () => {
  const w = realisedWeek([log({ ex: { dc_db: [set("22", "10"), set("22", "9")], row_cable: [set("60", "10")] } })]);
  assert.equal(w.sessions.length, 1);
  assert.deepEqual(sets(w.sessions[0].rows).sort((a, b) => a.vid < b.vid ? -1 : 1), [
    { vid: "dc_db", sets: 2 }, { vid: "row_cable", sets: 1 },
  ]);
});

/* Le critère de série est celui de tout l'écran : reps saisies, et charge
   saisie quand l'exercice en porte une. Une ligne à moitié remplie est une
   saisie à finir, pas une série de plus (display.js, rowIsDone). */
test("une ligne sans reps ou sans charge n'est pas une série faite", () => {
  const w = realisedWeek([log({ ex: { dc_db: [set("22", "10"), set("22", ""), set("", "8"), {}] } })]);
  assert.deepEqual(sets(w.sessions[0].rows), [{ vid: "dc_db", sets: 1 }]);
});

test("une séance non validée n'apporte rien, même remplie", () => {
  const w = realisedWeek([log({ done: false, ex: { dc_db: [set("22", "10"), set("22", "10")] } })]);
  assert.deepEqual(w.sessions, []);
  assert.equal(hasRealised(realisedRows([log({ done: false, ex: { dc_db: [set("22", "10")] } })])), false);
});

test("une séance supprimée n'apporte rien non plus", () => {
  const w = realisedWeek([log({ deletedAt: "2026-08-04T10:00:00.000Z", ex: { dc_db: [set("22", "10")] } })]);
  assert.deepEqual(w.sessions, []);
});

/* Le cœur de #73 : les séries sont lues sous l'identifiant qui les porte.
   Un créneau substitué a écrit sous le remplaçant, et c'est le remplaçant
   qui doit compter — sans quoi l'adaptateur compterait un exercice qui n'a
   pas été fait. */
test("un exercice substitué compte pour lui-même, pas pour le prescrit", () => {
  const legpress = EXERCISES.legpress, hack = EXERCISES.hack;
  assert.ok(legpress && hack, "le registre porte les deux exercices du test");
  const w = realisedWeek([log({ slot: "quad1", sub: { quad1: "hack" }, ex: { hack: [set("100", "10"), set("100", "9")] } })]);
  assert.deepEqual(sets(w.sessions[0].rows), [{ vid: "hack", sets: 2 }]);
  const vol = weeklyVolume(w);
  /* Les quadriceps reçoivent ce que le hack squat leur donne, via la règle
     de comptage — pas une valeur recopiée dans ce test. */
  assert.equal(vol.quadriceps, 2 * contribution(hack, "quadriceps"));
});

/* La règle de comptage n'est pas réécrite : c'est `contribution()` qui
   décide, y compris son palier indirect. Verrouillé sur le calcul lui-même
   pour qu'une retouche de la règle fasse bouger les deux côtés ensemble. */
test("la règle de comptage est contribution(), pas une seconde implémentation", () => {
  const ex = { dc_db: [set("22", "10"), set("22", "10"), set("22", "9")] };
  const vol = weeklyVolume(realisedWeek([log({ ex })]));
  for (const m of Object.keys(VOLUME)) {
    assert.equal(vol[m], 3 * contribution(EXERCISES.dc_db, m), `groupe ${m}`);
  }
});

test("deux séances de la semaine s'additionnent", () => {
  const vol = weeklyVolume(realisedWeek([
    log({ slot: "upperA", ex: { dc_db: [set("22", "10"), set("22", "10")] } }),
    log({ slot: "upperB", date: "2026-08-06", ex: { dc_db: [set("24", "8")] } }),
  ]));
  assert.equal(vol.pectoraux, 3 * contribution(EXERCISES.dc_db, "pectoraux"));
});

test("un identifiant inconnu du registre est écarté, jamais compté pour zéro", () => {
  const w = realisedWeek([log({ ex: { exercice_disparu: [set("50", "10")], dc_db: [set("22", "10")] } })]);
  assert.deepEqual(sets(w.sessions[0].rows), [{ vid: "dc_db", sets: 1 }]);
});

test("realisedWeek accepte un tableau, un objet de logs, ou rien", () => {
  const l = log({ ex: { dc_db: [set("22", "10")] } });
  assert.equal(realisedWeek([l]).sessions.length, 1);
  assert.equal(realisedWeek({ abc: l }).sessions.length, 1);
  for (const empty of [null, undefined, [], {}, "nope", 42]) {
    assert.deepEqual(realisedWeek(empty).sessions, [], `vide : ${JSON.stringify(empty)}`);
  }
});

test("un journal malformé ne lève pas", () => {
  assert.doesNotThrow(() => realisedWeek([null, "x", { done: true }, { done: true, ex: "pas un objet" }, { done: true, ex: { dc_db: "pas un tableau" } }]));
  assert.deepEqual(realisedWeek([{ done: true, ex: { dc_db: "pas un tableau" } }]).sessions, []);
});

test("les onze groupes sont toujours rendus, avec leur fourchette", () => {
  const rows = realisedRows([]);
  assert.deepEqual(rows.map((r) => r.muscle), Object.keys(VOLUME));
  assert.ok(rows.every((r) => r.sets === 0));
  assert.ok(rows.every((r) => r.label && r.label !== r.muscle), "chaque groupe porte son libellé");
  const dos = rows.find((r) => r.muscle === "dos");
  assert.equal(dos.min, VOLUME.dos.min);
  assert.equal(dos.max, VOLUME.dos.max);
});

test("une semaine sans séance validée se distingue d'une semaine à zéro série", () => {
  assert.equal(hasRealised(realisedRows([])), false);
  assert.equal(hasRealised(realisedRows([log({ ex: { dc_db: [set("22", "10")] } })])), true);
});
