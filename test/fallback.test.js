import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  sessionCoverage, rankSessionsForCut, rankExercisesForCut, composeSession, buildFallbackLevels,
} from "../src/fallback.js";

/* Fixtures locales, indépendantes du registre : sessionCoverage() ne lit que
   `entry.muscles` (via contribution(), assertions.js), rankExercisesForCut()
   que `entry.type`/`entry.cout_systemique`. Pas besoin de générer un vrai
   programme pour tester la règle elle-même. */
const entry = (id, type, cout, muscles) => ({ id, type, cout_systemique: cout, muscles });
const row = (slotId, e, sets) => ({ slotId, vid: e.id, sets, entry: e });
const session = (id, name, day, rows) => ({ id, name, day, rows, sets: rows.reduce((a, r) => a + r.sets, 0) });

const pec = entry("pec", "compose", 2, { pectoraux: 1 });
const tri = entry("tri", "isolation", 1, { triceps: 1 });
const quad = entry("quad", "compose", 3, { quadriceps: 1 });
const isch = entry("isch", "compose", 3, { ischios_fessiers: 1 });
const mollets = entry("mollets", "isolation", 1, { mollets: 1 });

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

describe("rankExercisesForCut : isolation avant composé (#120 spec)", () => {
  test("le triceps (isolation) sort avant les pectoraux (composé)", () => {
    const ranked = rankExercisesForCut(hautA.rows);
    assert.equal(ranked[0].entry.type, "isolation");
    assert.equal(ranked[ranked.length - 1].entry.type, "compose");
  });
});

describe("composeSession : recomposition bornée (#120 decisions Q4)", () => {
  test("garde les composés d'abord, dans la limite du plafond de séries", () => {
    const merged = [...hautA.rows, ...jambes.rows]; // 3+2 + 3+2+2 = 12 séries au total
    const composite = composeSession("anchor", "Jambes +", merged, 8);
    const kept = new Set(composite.ex.map(([slotId]) => slotId));
    assert.ok(kept.has("s_quad") && kept.has("s_isch") && kept.has("s_pec"), "les composés survivent");
    const total = composite.ex.reduce((a, [, sets]) => a + sets, 0);
    assert.ok(total <= 8, `${total} séries, plafond 8`);
  });
});

describe("buildFallbackLevels : N-1 niveaux, jusqu'à 1 séance (#120 decisions Q3)", () => {
  const { levels } = buildFallbackLevels(WEEK, 10);

  test("un niveau de moins que de séances", () => {
    assert.equal(levels.length, WEEK.sessions.length - 1);
  });

  test("Jambes n'est jamais dans les séances coupées au premier niveau", () => {
    assert.ok(!levels[0].merge.from.includes("jambes") || levels[0].merge.from[0] === "jambes");
    // "jambes" est l'ancre (merge.from[0]) mais n'est jamais parmi les *coupées* :
    assert.equal(levels[0].merge.from[0], "jambes");
  });

  test("le dernier niveau ne garde qu'une seule entité (l'ancre composite), pas de plancher", () => {
    const last = levels[levels.length - 1];
    assert.equal(last.keep.length, 0);
  });

  test("aucun niveau avec moins de 2 séances au programme ne plante", () => {
    const one = buildFallbackLevels({ sessions: [hautA] }, 10);
    assert.deepEqual(one.levels, []);
  });
});
