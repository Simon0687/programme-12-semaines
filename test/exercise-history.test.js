import test from "node:test";
import assert from "node:assert/strict";
import { exerciseHistory, recordsFor, seriesByCycle, bestValue } from "../src/exercise-history.js";

/* Deux cycles, comme un journal réel après un an : l'ancien porte ses propres
   noms de séance (« Pousser »), le nouveau les siens (« Haut A »). C'est la
   définition épinglée de chaque cycle qui les fournit (#26), pas le programme
   actif — sans quoi l'historique de mars se lirait avec le vocabulaire
   d'aujourd'hui. */
function journal() {
  return {
    activeProgramId: "cur",
    programs: {
      old: {
        definition: { name: "Haut/Bas 4 jours", program: { SESSIONS: [{ id: "push", name: "Pousser" }] } },
        logs: {
          a: { date: "2026-06-01", slot: "push", done: true, kind: "normal", ex: { dc: [{ w: "77,5", r: "7", rir: "1" }, { w: "77,5", r: "6", rir: "1" }] } },
          b: { date: "2026-05-25", slot: "push", done: true, kind: "normal", ex: { dc: [{ w: "75", r: "8", rir: "1" }] } },
        },
        cardio: {}, checkin: {},
      },
      cur: {
        definition: { name: "Haut/Bas 5 jours", program: { SESSIONS: [{ id: "hautA", name: "Haut A" }, { id: "hautB", name: "Haut B" }] } },
        logs: {
          c: { date: "2026-08-31", slot: "hautA", done: true, kind: "normal", ex: { dc: [{ w: "87,5", r: "5", rir: "1" }, { w: "87,5", r: "4", rir: "1" }] } },
          d: { date: "2026-08-24", slot: "hautA", done: true, kind: "normal", ex: { dc: [{ w: "85", r: "8", rir: "1" }, { w: "85", r: "6", rir: "1" }] } },
          e: { date: "2026-06-22", slot: "hautA", done: true, kind: "calibration", ex: { dc: [{ w: "75", r: "8", rir: "3" }] } },
          f: { date: "2026-09-07", slot: "hautA", done: false, kind: "normal", ex: { dc: [{ w: "90", r: "6", rir: "1" }] } },
        },
        cardio: {}, checkin: {},
      },
    },
  };
}

test("exerciseHistory : les deux cycles répondent, du plus ancien au plus récent", () => {
  const h = exerciseHistory(journal(), "dc");
  assert.deepEqual(h.map((e) => e.date), ["2026-05-25", "2026-06-01", "2026-06-22", "2026-08-24", "2026-08-31"]);
  assert.deepEqual(h.map((e) => e.programId), ["old", "old", "cur", "cur", "cur"]);
});

test("exerciseHistory : chaque ligne porte le nom de séance de SON cycle", () => {
  const h = exerciseHistory(journal(), "dc");
  assert.equal(h[0].sessionName, "Pousser");
  assert.equal(h[0].programName, "Haut/Bas 4 jours");
  assert.equal(h[4].sessionName, "Haut A");
  assert.equal(h[4].programName, "Haut/Bas 5 jours");
});

test("exerciseHistory : une séance en cours n'apparaît nulle part", () => {
  /* La ligne du 7 sept. porte 90 kg et done: false. Elle ne doit ni figurer
     dans l'historique, ni pouvoir devenir un record : une série 3 peut encore
     démentir ce qu'annonçait la série 1. */
  const h = exerciseHistory(journal(), "dc");
  assert.equal(h.some((e) => e.date === "2026-09-07"), false);
  const { rows } = recordsFor(h, "kg");
  assert.equal(rows.some((r) => r.load === 90), false);
});

test("exerciseHistory : les chaînes du journal sont converties en nombres", () => {
  const h = exerciseHistory(journal(), "dc");
  assert.deepEqual(h[4].sets, [{ w: 87.5, r: 5, rir: 1 }, { w: 87.5, r: 4, rir: 1 }]);
});

test("exerciseHistory : un exercice jamais fait rend une liste vide", () => {
  assert.deepEqual(exerciseHistory(journal(), "incl_mach"), []);
});

/* ---------- Fermé par défaut (ARCHITECTURE §2.4) ---------- */

test("exerciseHistory : une charge utile ex mal formée ne fait jamais lever", () => {
  /* isLogRow (journal-shape.js) accepte ces lignes : il vérifie que `ex` est un
     objet, jamais ce qu'il y a dedans. history() lève dessus
     (TypeError: … .map is not a function). Ce module, non. */
  for (const bad of ["87,5", 42, null, { 0: { w: 80, r: 8 } }, [1, 2, 3], [null, "x"]]) {
    const j = journal();
    j.programs.cur.logs.z = { date: "2026-09-01", slot: "hautA", done: true, kind: "normal", ex: { dc: bad } };
    let h;
    assert.doesNotThrow(() => { h = exerciseHistory(j, "dc"); }, `ex.dc = ${JSON.stringify(bad)}`);
    assert.equal(h.some((e) => e.date === "2026-09-01"), false, "et n'apporte aucune série");
  }
});

test("exerciseHistory : entrées et journaux difformes rendent une liste vide", () => {
  for (const bad of [null, undefined, 42, "x", {}, { programs: null }, { programs: { p: 7 } }, { programs: { p: { logs: "x" } } }]) {
    assert.deepEqual(exerciseHistory(bad, "dc"), []);
  }
  assert.deepEqual(exerciseHistory(journal(), null), []);
});

test("exerciseHistory : une définition sans SESSIONS donne un nom nul, pas un jeté", () => {
  /* Le cas exact d'un cycle marqué inutilisable par #32 : ses séries sont
     intactes même quand sa définition ne l'est pas. */
  const j = journal();
  j.programs.old.definition = { name: "Cycle abîmé" };
  const h = exerciseHistory(j, "dc");
  assert.equal(h[0].sessionName, null);
  assert.equal(h[0].programName, "Cycle abîmé");
  assert.equal(h[0].sets.length, 1);

  j.programs.old.definition = null;
  const h2 = exerciseHistory(j, "dc");
  assert.equal(h2[0].programName, null);
  assert.equal(h2[0].sessionName, null);
});

/* ---------- Records ---------- */

test("recordsFor : « N reps ou plus », donc décroissant par construction", () => {
  const { mode, rows } = recordsFor(exerciseHistory(journal(), "dc"), "kg");
  assert.equal(mode, "byReps");
  assert.deepEqual(rows, [
    { reps: 4, load: 87.5, date: "2026-08-31" },
    { reps: 5, load: 87.5, date: "2026-08-31" },
    { reps: 6, load: 85, date: "2026-08-24" },
    { reps: 7, load: 85, date: "2026-08-24" },
    { reps: 8, load: 85, date: "2026-08-24" },
  ]);

  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i].load <= rows[i - 1].load, `${rows[i].reps} reps : ${rows[i].load} > ${rows[i - 1].load}`);
  }
});

test("recordsFor : la date retenue est la première fois, pas la dernière", () => {
  const j = journal();
  j.programs.cur.logs.g = { date: "2026-09-01", slot: "hautA", done: true, kind: "normal", ex: { dc: [{ w: "87,5", r: "5", rir: "1" }] } };
  const { rows } = recordsFor(exerciseHistory(j, "dc"), "kg");
  assert.equal(rows.find((r) => r.reps === 5).date, "2026-08-31");
});

test("recordsFor : sans charge, une seule ligne", () => {
  const entries = [
    { date: "2026-08-01", sets: [{ w: null, r: 40, rir: 2 }, { w: null, r: 35, rir: 2 }] },
    { date: "2026-09-07", sets: [{ w: null, r: 60, rir: 2 }, { w: null, r: 55, rir: 2 }] },
  ];
  assert.deepEqual(recordsFor(entries, "time"), { mode: "best", best: 60, date: "2026-09-07" });
  assert.deepEqual(recordsFor(entries, "reps"), { mode: "best", best: 60, date: "2026-09-07" });
});

test("recordsFor : aucune donnée", () => {
  assert.deepEqual(recordsFor([], "kg"), { mode: "byReps", rows: [] });
  assert.deepEqual(recordsFor([], "time"), { mode: "best", best: null, date: null });
  assert.deepEqual(recordsFor(null, "kg"), { mode: "byReps", rows: [] });
});

test("recordsFor : au poids du corps, le record porte le lest, PDC valant zéro", () => {
  const entries = [
    { date: "2026-07-01", sets: [{ w: null, r: 8, rir: 1 }] },
    { date: "2026-07-29", sets: [{ w: 10, r: 6, rir: 1 }] },
  ];
  const { rows } = recordsFor(entries, "bw");
  assert.deepEqual(rows.find((r) => r.reps === 6), { reps: 6, load: 10, date: "2026-07-29" });
  assert.deepEqual(rows.find((r) => r.reps === 8), { reps: 8, load: 0, date: "2026-07-01" });
});

/* ---------- Courbe ---------- */

test("seriesByCycle : un segment par cycle, dans l'ordre", () => {
  const s = seriesByCycle(exerciseHistory(journal(), "dc"), "kg");
  assert.deepEqual(s.map((x) => x.programId), ["old", "cur"]);
  assert.deepEqual(s[0].points.map((p) => p.value), [75, 77.5]);
  assert.deepEqual(s[1].points.map((p) => p.value), [75, 85, 87.5]);
  assert.equal(s[1].points[0].kind, "calibration");
});

test("seriesByCycle : sans charge, la courbe suit ce qui progresse", () => {
  const entries = [{ programId: "p", programName: "P", date: "2026-09-07", kind: "normal", sets: [{ w: null, r: 60, rir: 2 }, { w: null, r: 55, rir: 2 }] }];
  assert.equal(seriesByCycle(entries, "time")[0].points[0].value, 60);
  assert.equal(bestValue(entries[0], "kg"), 0, "en kg, des séries sans charge valent zéro");
});
