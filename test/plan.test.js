import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildPlan, PLAN_INTRO, PHASE_NOTES } from "../src/plan.js";
import { phaseOf } from "../src/progression.js";
import { PROFILE, STARTING_LOADS } from "../src/profile.js";

/* Garde-fous de forme pour les données de l'onglet Plan (#4, #6). Ne
   teste pas le texte (c'est de l'éditorial, il change), seulement que la
   structure que <PlanContent> / <Block> attend est respectée et que
   PHASE_NOTES reste aligné sur les phases que phaseOf() peut renvoyer. */

const PLAN = buildPlan(PROFILE, STARTING_LOADS);

describe("PHASE_NOTES", () => {
  test("couvre exactement les id de phase renvoyés par phaseOf()", () => {
    const ids = new Set();
    for (let w = 1; w <= 12; w++) ids.add(phaseOf(w).id);
    assert.deepEqual([...ids].sort(), Object.keys(PHASE_NOTES).sort());
  });

  test("chaque note est une chaîne non vide", () => {
    for (const [id, note] of Object.entries(PHASE_NOTES)) {
      assert.equal(typeof note, "string", id);
      assert.ok(note.trim().length > 0, id);
    }
  });
});

describe("PLAN", () => {
  test("PLAN_INTRO est une chaîne non vide", () => {
    assert.equal(typeof PLAN_INTRO, "string");
    assert.ok(PLAN_INTRO.trim().length > 0);
  });

  test("chaque section a un id, un titre et au moins un bloc", () => {
    const seen = new Set();
    for (const s of PLAN) {
      assert.ok(s.id && !seen.has(s.id), `id unique: ${s.id}`);
      seen.add(s.id);
      assert.ok(s.title && s.title.trim().length > 0, s.id);
      assert.ok(Array.isArray(s.blocks) && s.blocks.length > 0, s.id);
    }
  });

  test("chaque bloc est un type connu et bien formé", () => {
    for (const s of PLAN) {
      for (const b of s.blocks) {
        if (b.t === "p") {
          assert.equal(typeof b.text, "string", s.id);
          assert.ok(b.text.trim().length > 0, s.id);
        } else if (b.t === "table") {
          assert.ok(["weeks", "volume"].includes(b.variant), `${s.id}: variant`);
          assert.ok(Array.isArray(b.rows) && b.rows.length > 0, `${s.id}: rows`);
          const width = b.variant === "volume" ? 3 : 2;
          for (const row of b.rows) {
            assert.ok(Array.isArray(row) && row.length === width, `${s.id}: largeur de ligne`);
          }
        } else {
          assert.fail(`${s.id}: type de bloc inconnu ${JSON.stringify(b.t)}`);
        }
      }
    }
  });

  test("exactement une section est dépliée au montage", () => {
    assert.equal(PLAN.filter((s) => s.open).length, 1);
  });
});

describe("buildPlan : reflète le profil reçu (#6)", () => {
  test("un profil différent change le texte nutrition et charges de départ", () => {
    const otherProfile = { ...PROFILE, maintenanceKcal: 2000, startKcal: 2200, macros: { p: 150, f: 60, c: 300 }, targetWeightKg: [70, 71] };
    const otherLoads = { ...STARTING_LOADS, dc: 40, legpress: 60 };
    const other = buildPlan(otherProfile, otherLoads);

    const nutritionText = other.find((s) => s.id === "nutrition").blocks[0].text;
    assert.match(nutritionText, /2 200 kcal/);
    assert.doesNotMatch(nutritionText, new RegExp(String(PROFILE.startKcal)));

    const loadsText = other.find((s) => s.id === "startloads").blocks[0].text;
    assert.match(loadsText, /40 kg/);
    assert.match(loadsText, /60 kg/);
  });

  test("le reste du contenu ne dépend pas du profil : deux profils, même structure", () => {
    const a = buildPlan(PROFILE, STARTING_LOADS);
    const b = buildPlan({ ...PROFILE, maintenanceKcal: 1 }, { ...STARTING_LOADS, dc: 1 });
    const invariant = (p) => p.filter((s) => s.id !== "nutrition" && s.id !== "startloads");
    assert.deepEqual(invariant(a), invariant(b));
  });
});
