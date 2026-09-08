import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { START_DATE, startDate, STARTING_LOADS, PROFILE } from "../src/profile.js";
import { buildProgram } from "../src/program.js";

/* Garde-fous pour l'extraction du profil (#5) : le refold des charges
   sur V, la date locale, et la forme de PROFILE. Ne fige pas les
   valeurs éditables (charges, cibles), seulement les invariants. */

describe("STARTING_LOADS refold sur V (buildProgram, #6)", () => {
  const { V } = buildProgram({ startingLoads: STARTING_LOADS });

  test("chaque id de STARTING_LOADS existe dans V", () => {
    for (const vid of Object.keys(STARTING_LOADS)) {
      assert.ok(V[vid], `V.${vid} absent`);
    }
  });

  test("V.<id>.start reflète STARTING_LOADS après buildProgram()", () => {
    for (const [vid, load] of Object.entries(STARTING_LOADS)) {
      assert.equal(V[vid].start, load, vid);
    }
  });

  test("pullup garde start: 0 (poids du corps), pas absent", () => {
    assert.equal(V.pullup.start, 0);
    assert.equal("start" in V.pullup, true);
  });

  test("une variante sans charge de départ n'a pas de start", () => {
    assert.equal(V.rpd.start, undefined); // reardelt b1, rampe « Paliers »
  });
});

describe("startDate()", () => {
  test("renvoie une Date locale à minuit, au 7 septembre 2026", () => {
    const d = startDate();
    assert.ok(d instanceof Date);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 8); // septembre (0-indexé)
    assert.equal(d.getDate(), 7);
    assert.equal(d.getHours(), 0);
    assert.equal(d.getMinutes(), 0);
  });

  test("START_DATE est une chaîne ISO AAAA-MM-JJ", () => {
    assert.match(START_DATE, /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("PROFILE", () => {
  test("cibles nutrition présentes et numériques", () => {
    for (const k of ["bodyweightKg", "heightCm", "maintenanceKcal", "startKcal"]) {
      assert.equal(typeof PROFILE[k], "number", k);
    }
    for (const k of ["p", "f", "c"]) {
      assert.equal(typeof PROFILE.macros[k], "number", `macros.${k}`);
    }
    assert.ok(Array.isArray(PROFILE.targetWeightKg) && PROFILE.targetWeightKg.length === 2);
    assert.ok(PROFILE.targetWeightKg[0] <= PROFILE.targetWeightKg[1]);
  });

  test("birthdate est une chaîne ISO AAAA-MM-JJ", () => {
    assert.match(PROFILE.birthdate, /^\d{4}-\d{2}-\d{2}$/);
  });
});
