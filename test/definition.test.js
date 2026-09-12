import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_DEFINITION, parseLocalDate } from "../src/definition.js";
import { LEGACY_DEFINITION } from "../src/legacy-program.js";
import { buildProgram } from "../src/program.js";
import { LEGACY_PROGRAM_ID } from "../src/schema.js";

describe("parseLocalDate", () => {
  test("renvoie une Date locale à minuit, au 7 septembre 2026", () => {
    const d = parseLocalDate("2026-09-07");
    assert.ok(d instanceof Date);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 8); // septembre (0-indexé)
    assert.equal(d.getDate(), 7);
    assert.equal(d.getHours(), 0);
    assert.equal(d.getMinutes(), 0);
  });
});

describe("définitions livrées", () => {
  /* #26 : c'est le programme *hérité* qui doit porter cet id — c'est la clé
     sous laquelle les journaux migrés depuis la v1 sont déjà enregistrés. Le
     bundle par défaut, lui, est libre d'avoir le sien. */
  test("le programme hérité porte l'id de la migration v1 -> v2", () => {
    assert.equal(LEGACY_DEFINITION.id, LEGACY_PROGRAM_ID);
  });

  test("weeks vaut 12 pour les deux programmes livrés", () => {
    assert.equal(LEGACY_DEFINITION.weeks, 12);
    assert.equal(DEFAULT_DEFINITION.weeks, 12);
  });
});

/* Le test le plus important de #6 : deux cycles en mémoire ne doivent
   jamais partager leurs charges de départ. V[vid].start = load mute un
   objet ; sans structuredClone dans buildProgram(), le second cycle
   écraserait silencieusement les charges du premier (src/program.js). */
describe("buildProgram : isolation entre deux définitions", () => {
  test("deux bundles construits avec des charges différentes ne se contaminent pas", () => {
    const a = buildProgram({ startingLoads: { dc: 50, squat: 80 } });
    const b = buildProgram({ startingLoads: { dc: 100, squat: 150 } });
    assert.equal(a.V.dc.start, 50);
    assert.equal(a.V.squat.start, 80);
    assert.equal(b.V.dc.start, 100);
    assert.equal(b.V.squat.start, 150);
    // Construire b ne doit pas avoir rétroactivement changé a.
    assert.equal(a.V.dc.start, 50);
  });

  test("le catalogue de base (BASE_V) n'est jamais muté par un buildProgram", () => {
    const before = buildProgram({ startingLoads: {} }).V.dc.start;
    buildProgram({ startingLoads: { dc: 999 } });
    const after = buildProgram({ startingLoads: {} }).V.dc.start;
    assert.equal(before, after); // un bundle "sans charges" reste identique à lui-même
    assert.notEqual(after, 999);
  });
});
