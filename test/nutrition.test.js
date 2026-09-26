import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  ACTIVITY_FACTORS, OBJECTIVES, computeNutritionProfile, adjustmentTable, firstWeeksNote, aiBrief,
} from "../src/nutrition.js";

const base = { tailleCm: 178, poidsKg: 82, age: 34, sexe: "h", activite: "modere" };

describe("computeNutritionProfile : le signe suit l'objectif (#121)", () => {
  test("prise de masse : startKcal > maintenanceKcal, cible > poids", () => {
    const p = computeNutritionProfile({ ...base, objectif: "masse" });
    assert.ok(p.startKcal > p.maintenanceKcal, `${p.startKcal} > ${p.maintenanceKcal}`);
    assert.ok(p.targetWeightKg[0] > base.poidsKg && p.targetWeightKg[1] > base.poidsKg);
  });

  test("sèche : startKcal < maintenanceKcal, cible < poids", () => {
    const p = computeNutritionProfile({ ...base, objectif: "seche" });
    assert.ok(p.startKcal < p.maintenanceKcal, `${p.startKcal} < ${p.maintenanceKcal}`);
    assert.ok(p.targetWeightKg[0] < base.poidsKg && p.targetWeightKg[1] < base.poidsKg);
  });

  test("maintien : startKcal égale maintenanceKcal, cible égale le poids", () => {
    const p = computeNutritionProfile({ ...base, objectif: "maintien" });
    assert.equal(p.startKcal, p.maintenanceKcal);
    assert.deepEqual(p.targetWeightKg, [base.poidsKg, base.poidsKg]);
  });

  test("les trois macros sont des nombres positifs, cohérents avec startKcal", () => {
    for (const objectif of OBJECTIVES) {
      const p = computeNutritionProfile({ ...base, objectif });
      assert.ok(p.macros.p > 0 && p.macros.f > 0 && p.macros.c > 0, objectif);
      const kcalFromMacros = p.macros.p * 4 + p.macros.f * 9 + p.macros.c * 4;
      assert.ok(Math.abs(kcalFromMacros - p.startKcal) < 20, `${objectif} : ${kcalFromMacros} vs ${p.startKcal}`);
    }
  });

  test("le sexe change le calcul (Mifflin-St Jeor)", () => {
    const h = computeNutritionProfile({ ...base, sexe: "h", objectif: "maintien" });
    const f = computeNutritionProfile({ ...base, sexe: "f", objectif: "maintien" });
    assert.notEqual(h.maintenanceKcal, f.maintenanceKcal);
  });

  test("le niveau d'activité change la maintenance dans le sens attendu", () => {
    const sed = computeNutritionProfile({ ...base, activite: "sedentaire", objectif: "maintien" });
    const actif = computeNutritionProfile({ ...base, activite: "actif", objectif: "maintien" });
    assert.ok(actif.maintenanceKcal > sed.maintenanceKcal);
    assert.equal(ACTIVITY_FACTORS.actif > ACTIVITY_FACTORS.sedentaire, true);
  });
});

describe("adjustmentTable / firstWeeksNote : variante miroir en sèche (#121)", () => {
  test("la table masse et la table sèche ne sont pas la même", () => {
    assert.notDeepEqual(adjustmentTable("masse"), adjustmentTable("seche"));
  });

  test("chaque table a au moins une ligne [condition, action]", () => {
    for (const objectif of OBJECTIVES) {
      const rows = adjustmentTable(objectif);
      assert.ok(rows.length > 0, objectif);
      for (const row of rows) assert.equal(row.length, 2);
    }
  });

  test("le texte des deux premières semaines diffère entre masse et sèche", () => {
    assert.notEqual(firstWeeksNote("masse"), firstWeeksNote("seche"));
  });
});

describe("aiBrief : kcal/macros/objectif + rythme d'entraînement (#121 Q4)", () => {
  test("contient les chiffres calculés et le nombre de séances", () => {
    const p = computeNutritionProfile({ ...base, objectif: "masse" });
    const brief = aiBrief(p, 4);
    assert.ok(brief.includes(String(p.startKcal)));
    assert.ok(brief.includes(String(p.macros.p)));
    assert.ok(brief.includes("4"));
    assert.ok(/masse/i.test(brief));
  });

  test("ne prescrit aucun repas précis (laissé à l'IA externe)", () => {
    const p = computeNutritionProfile({ ...base, objectif: "seche" });
    const brief = aiBrief(p, 3);
    assert.ok(!/riz|poulet|avoine/i.test(brief));
  });
});
