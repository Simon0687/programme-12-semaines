import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  sessionCoverage, rankSessionsForCut, buildFallbackLevels, recommendRemaining, lastSkipped,
} from "../src/fallback.js";

/* Fixtures locales, indépendantes du registre : sessionCoverage() ne lit que
   `entry.muscles` (via contribution(), assertions.js). Pas besoin de générer
   un vrai programme pour tester la règle elle-même. */
const entry = (id, muscles) => ({ id, muscles });
const row = (slotId, e, sets) => ({ slotId, vid: e.id, sets, entry: e });
const session = (id, name, day, rows) => ({ id, name, day, rows, sets: rows.reduce((a, r) => a + r.sets, 0) });

const pec = entry("pec", { pectoraux: 1 });
const tri = entry("tri", { triceps: 1 });
const quad = entry("quad", { quadriceps: 1 });
const isch = entry("isch", { ischios_fessiers: 1 });
const mollets = entry("mollets", { mollets: 1 });

/* Le cas qui a lancé #120 : trois séances "Haut" qui se recouvrent
   entièrement (pectoraux + triceps chacune), une séance "Jambes" seule sur
   ses trois groupes. */
const hautA = session("hautA", "Haut A", 1, [row("s_pec", pec, 3), row("s_tri", tri, 2)]);
const hautB = session("hautB", "Haut B", 2, [row("s_pec", pec, 3), row("s_tri", tri, 2)]);
const hautC = session("hautC", "Haut C", 4, [row("s_pec", pec, 3), row("s_tri", tri, 2)]);
const jambes = session("jambes", "Jambes", 5, [row("s_quad", quad, 3), row("s_isch", isch, 2), row("s_mol", mollets, 2)]);
const WEEK = { sessions: [hautA, hautB, hautC, jambes] };

describe("sessionCoverage : les groupes musculaires que couvre une séance", () => {
  test("dérivé des exercices, pas du nom de la séance", () => {
    assert.deepEqual([...sessionCoverage(hautA)].sort(), ["pectoraux", "triceps"]);
    assert.deepEqual([...sessionCoverage(jambes)].sort(), ["ischios_fessiers", "mollets", "quadriceps"]);
  });
});

describe("rankSessionsForCut : la moins unique d'abord (#120 decisions Q2)", () => {
  test("Jambes, seule sur ses groupes, ne sort jamais en tête", () => {
    const order = rankSessionsForCut(WEEK.sessions);
    assert.notEqual(order[0].id, "jambes");
    assert.equal(order[order.length - 1].id, "jambes");
  });

  test("à couverture strictement égale, l'ordre de déclaration tranche", () => {
    const order = rankSessionsForCut(WEEK.sessions);
    assert.deepEqual(order.map((s) => s.id), ["hautA", "hautB", "hautC", "jambes"]);
  });

  test("protectId (non-répétition) empêche la même séance de ressortir en tête", () => {
    const order = rankSessionsForCut(WEEK.sessions, "hautA");
    assert.notEqual(order[0].id, "hautA");
  });
});

describe("buildFallbackLevels : N-1 niveaux, séances existantes intactes (#120, retour de test)", () => {
  const { levels } = buildFallbackLevels(WEEK);

  test("un niveau de moins que de séances", () => {
    assert.equal(levels.length, WEEK.sessions.length - 1);
  });

  test("Jambes reste dans toutes les séances gardées, jamais coupée", () => {
    for (const level of levels) assert.ok(level.keep.includes("jambes"));
  });

  test("chaque niveau ne garde que des séances existantes, jamais de séance composite", () => {
    for (const level of levels) {
      for (const id of level.keep) assert.ok(WEEK.sessions.some((s) => s.id === id));
    }
  });

  test("le premier niveau coupe une seule séance parmi les trois Haut redondantes", () => {
    assert.equal(levels[0].keep.length, 3);
    assert.deepEqual(levels[0].keep.sort(), ["hautB", "hautC", "jambes"]);
  });

  test("le dernier niveau ne garde qu'une seule séance, pas de plancher (Q3)", () => {
    assert.deepEqual(levels[levels.length - 1].keep, ["jambes"]);
  });

  test("aucun niveau avec moins de 2 séances au programme ne plante", () => {
    const one = buildFallbackLevels({ sessions: [hautA] });
    assert.deepEqual(one.levels, []);
  });
});

describe("recommendRemaining : le conseil vivant (#120, retour de test)", () => {
  test("assez de jours pour tout finir -> garde tout ce qui reste, rien à couper", () => {
    const r = recommendRemaining(WEEK.sessions, ["hautA"], 3);
    assert.deepEqual(r.keep.sort(), ["hautB", "hautC", "jambes"]);
    assert.deepEqual(r.cut, []);
  });

  test("pas assez de jours -> coupe une Haut redondante avant Jambes", () => {
    // hautA déjà faite ; il reste hautB, hautC, jambes pour 2 jours.
    const r = recommendRemaining(WEEK.sessions, ["hautA"], 2);
    assert.equal(r.keep.length, 2);
    assert.ok(r.keep.includes("jambes"));
    assert.equal(r.cut.length, 1);
    assert.ok(!r.cut.includes("jambes"));
  });

  test("protectId protège la séance ratée la semaine passée, même sous contrainte", () => {
    // hautB a été coupée la semaine dernière : elle ne doit pas l'être encore.
    const r = recommendRemaining(WEEK.sessions, [], 1, "hautB");
    assert.ok(!r.cut.includes("hautB") || r.keep.includes("hautB"));
  });

  test("0 jour restant -> tout ce qui n'est pas fait est coupé, sans planter", () => {
    const r = recommendRemaining(WEEK.sessions, ["hautA"], 0);
    assert.deepEqual(r.keep, []);
    assert.equal(r.cut.length, 3);
  });
});

describe("lastSkipped : la séance à protéger cette semaine (#120)", () => {
  test("une seule séance ratée la semaine passée -> elle est identifiée", () => {
    const doneLastWeek = WEEK.sessions.filter((s) => s.id !== "hautB").map((s) => s.id);
    assert.equal(lastSkipped(WEEK.sessions, doneLastWeek), "hautB");
  });

  test("tout validé la semaine passée -> rien à protéger", () => {
    assert.equal(lastSkipped(WEEK.sessions, WEEK.sessions.map((s) => s.id)), null);
  });

  test("plusieurs séances ratées -> ambigu, rien à protéger en particulier", () => {
    const doneLastWeek = ["jambes"];
    assert.equal(lastSkipped(WEEK.sessions, doneLastWeek), null);
  });
});
