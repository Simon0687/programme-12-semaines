import test from "node:test";
import assert from "node:assert/strict";
import { carriedLoad } from "../src/carryover.js";

/* Un cycle minimal : un créneau `press` en séance `hautA`, dont la fourchette
   est celle qu'on passe. Le journal range les séries par séance, jamais par
   exercice : c'est pour ça que la fourchette source se relit dans la
   définition *de ce cycle-là*. */
const program = (reps, extra = {}) => ({
  SLOTS: { press: { reps, b1: "dc", b2: "dc" }, row: { reps: [8, 12], b1: "row_cable", b2: "row_cable" }, ...extra.SLOTS },
  SESSIONS: [{ id: "hautA", name: "Haut A", ex: [["press", 4], ["row", 3]], core: "c1" }],
  CORE: { c1: { ex: [] } },
});
const log = (date, ex, more = {}) => ({ date, slot: "hautA", done: true, kind: "normal", ex, ...more });
const set = (w, r) => ({ w, r, rir: "1" });
const journal = (...cycles) => ({
  activeProgramId: "c0",
  programs: Object.fromEntries(cycles.map((c, i) => [`c${i}`, { definition: { name: `Cycle ${i}`, program: c.program }, logs: c.logs, cardio: {}, checkin: {} }])),
});

test("rien dans le journal : rien à reporter", () => {
  assert.equal(carriedLoad(journal({ program: program([4, 8]), logs: {} }), "dc", [4, 8]), null);
  assert.equal(carriedLoad({}, "dc", [4, 8]), null);
  assert.equal(carriedLoad(null, "dc", [4, 8]), null);
  assert.equal(carriedLoad(journal({ program: program([4, 8]), logs: {} }), "inconnu", [4, 8]), null);
});

test("la dernière charge de travail, telle quelle, avec sa date", () => {
  const j = journal({ program: program([4, 8]), logs: {
    a: log("2026-09-07", { dc: [set("100", "8"), set("100", "7")] }),
    b: log("2026-08-31", { dc: [set("97,5", "8")] }),
  } });
  assert.deepEqual(carriedLoad(j, "dc", [4, 8]), { load: 100, date: "2026-09-07", fromLoad: 100, fromReps: 8, converted: false });
});

test("tous cycles confondus : le plus récent gagne, quel que soit le cycle", () => {
  const j = journal(
    { program: program([4, 8]), logs: { a: log("2026-06-01", { dc: [set("90", "8")] }) } },
    { program: program([6, 10]), logs: { b: log("2026-09-07", { dc: [set("95", "9")] }) } },
  );
  assert.equal(carriedLoad(j, "dc", [6, 10]).load, 95);
});

test("décharge, séance allégée et séance test ne servent pas de référence", () => {
  const j = journal({ program: program([4, 8]), logs: {
    a: log("2026-09-14", { dc: [set("85", "8")] }, { kind: "deload" }),
    b: log("2026-09-10", { dc: [set("80", "8")] }, { kind: "allege" }),
    c: log("2026-09-08", { dc: [set("110", "3")] }, { kind: "test" }),
    d: log("2026-09-07", { dc: [set("100", "8")] }),
  } });
  assert.equal(carriedLoad(j, "dc", [4, 8]).load, 100);
});

test("une séance à plusieurs charges : celle que workingSets retient, pas la plus lourde", () => {
  /* 110 × 3 n'atteint pas la moitié haute de 4–8 ; 100 × 8 si. */
  const j = journal({ program: program([4, 8]), logs: { a: log("2026-09-07", { dc: [set("110", "3"), set("100", "8"), set("100", "7")] }) } });
  assert.equal(carriedLoad(j, "dc", [4, 8]).load, 100);
});

test("vers moins de répétitions (hypertrophie -> force) : repris tel quel, du côté léger", () => {
  const j = journal({ program: program([4, 8]), logs: { a: log("2026-09-07", { dc: [set("100", "8")] }) } });
  assert.deepEqual(carriedLoad(j, "dc", [2, 5]), { load: 100, date: "2026-09-07", fromLoad: 100, fromReps: 8, converted: false });
});

test("vers plus de répétitions (force -> hypertrophie) : converti par le 10RM, au haut de la fourchette", () => {
  /* 115 × 4 -> 10RM 97,75 -> pour 12 reps : 97,75 × 40 / 42 = 93,1 -> 92,5 au cran de 2,5. */
  const j = journal({ program: program([2, 5]), logs: { a: log("2026-09-07", { dc: [set("115", "4"), set("115", "4")] }) } });
  assert.deepEqual(carriedLoad(j, "dc", [8, 12]), { load: 92.5, date: "2026-09-07", fromLoad: 115, fromReps: 4, converted: true });
});

test("la conversion ne dépasse jamais la charge d'origine", () => {
  /* 60 × 15 dans du 12–15, vers du 12–20 : l'estimation pour 20 reps passe
     sous 60 ; mais elle ne doit jamais remonter au-dessus. */
  const j = journal({ program: program([12, 15]), logs: { a: log("2026-09-07", { dc: [set("60", "15")] }) } });
  const c = carriedLoad(j, "dc", [12, 20]);
  assert.ok(c.load <= 60);
  assert.equal(c.fromLoad, 60);
});

test("sans fourchette cible connue : pas de conversion", () => {
  const j = journal({ program: program([2, 5]), logs: { a: log("2026-09-07", { dc: [set("115", "4")] }) } });
  assert.equal(carriedLoad(j, "dc", null).load, 115);
});

test("un exercice substitué se retrouve par log.sub, avec la fourchette de son créneau", () => {
  const j = journal({ program: program([2, 5]), logs: { a: log("2026-09-07", { dc_db: [set("40", "4")] }, { sub: { press: "dc_db" } }) } });
  const c = carriedLoad(j, "dc_db", [8, 12]);
  assert.equal(c.fromLoad, 40);
  assert.equal(c.converted, true); // 2–5 -> 8–12 : la source a bien été lue sur `press`
});

test("cycle sans définition lisible : fourchette source inconnue, charge reprise telle quelle", () => {
  const j = { programs: { x: { definition: null, logs: { a: log("2026-09-07", { dc: [set("115", "4")] }) } } } };
  assert.equal(carriedLoad(j, "dc", [8, 12]).load, 115);
});

test("poids du corps lesté : repris tel quel, jamais converti", () => {
  const p = program([3, 6], { SLOTS: { press: { reps: [3, 6], b1: "pullup", b2: "pullup" } } });
  const j = journal({ program: p, logs: { a: log("2026-09-07", { pullup: [set("20", "5")] }) } });
  const c = carriedLoad(j, "pullup", [8, 12]);
  assert.equal(c.load, 20);
  assert.equal(c.converted, false);
});

test("unité sans charge (secondes) : rien à reporter", () => {
  const p = program([30, 60], { SLOTS: { press: { reps: [30, 60], b1: "sideplank", b2: "sideplank" } } });
  const j = journal({ program: p, logs: { a: log("2026-09-07", { sideplank: [set("", "45")] }) } });
  assert.equal(carriedLoad(j, "sideplank", [30, 60]), null);
});

test("une charge mal formée dans le journal ne lève pas", () => {
  const j = journal({ program: program([4, 8]), logs: {
    a: log("2026-09-14", { dc: "87,5" }),
    b: log("2026-09-07", { dc: [set("100", "8")] }),
  } });
  assert.equal(carriedLoad(j, "dc", [4, 8]).load, 100);
});
