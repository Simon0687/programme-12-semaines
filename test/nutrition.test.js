import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  ACTIVITY_FACTORS, OBJECTIVES, ageFrom, computeNutritionProfile, adjustmentTable, firstWeeksNote, aiBrief,
} from "../src/nutrition.js";

const TODAY = new Date(2026, 8, 26);
const base = { heightCm: 178, bodyweightKg: 82, birthdate: "1992-03-10", sexe: "h", activite: "modere" };
const compute = (raw) => computeNutritionProfile(raw, TODAY);

describe("ageFrom : dérivé de birthdate, jamais stocké à part (#121)", () => {
  test("anniversaire déjà passé cette année", () => {
    assert.equal(ageFrom("1992-03-10", TODAY), 34);
  });

  test("anniversaire pas encore passé cette année", () => {
    assert.equal(ageFrom("1992-12-25", TODAY), 33);
  });
});

describe("computeNutritionProfile : le signe suit l'objectif (#121)", () => {
  test("prise de masse : startKcal > maintenanceKcal, cible > poids", () => {
    const p = compute({ ...base, objectif: "masse" });
    assert.ok(p.startKcal > p.maintenanceKcal, `${p.startKcal} > ${p.maintenanceKcal}`);
    assert.ok(p.targetWeightKg[0] > base.bodyweightKg && p.targetWeightKg[1] > base.bodyweightKg);
  });

  test("sèche : startKcal < maintenanceKcal, cible < poids", () => {
    const p = compute({ ...base, objectif: "seche" });
    assert.ok(p.startKcal < p.maintenanceKcal, `${p.startKcal} < ${p.maintenanceKcal}`);
    assert.ok(p.targetWeightKg[0] < base.bodyweightKg && p.targetWeightKg[1] < base.bodyweightKg);
  });

  test("maintien : startKcal égale maintenanceKcal, cible égale le poids", () => {
    const p = compute({ ...base, objectif: "maintien" });
    assert.equal(p.startKcal, p.maintenanceKcal);
    assert.deepEqual(p.targetWeightKg, [base.bodyweightKg, base.bodyweightKg]);
  });

  test("les trois macros sont des nombres positifs, cohérents avec startKcal", () => {
    for (const objectif of OBJECTIVES) {
      const p = compute({ ...base, objectif });
      assert.ok(p.macros.p > 0 && p.macros.f > 0 && p.macros.c > 0, objectif);
      const kcalFromMacros = p.macros.p * 4 + p.macros.f * 9 + p.macros.c * 4;
      assert.ok(Math.abs(kcalFromMacros - p.startKcal) < 20, `${objectif} : ${kcalFromMacros} vs ${p.startKcal}`);
    }
  });

  test("le sexe change le calcul (Mifflin-St Jeor)", () => {
    const h = compute({ ...base, sexe: "h", objectif: "maintien" });
    const f = compute({ ...base, sexe: "f", objectif: "maintien" });
    assert.notEqual(h.maintenanceKcal, f.maintenanceKcal);
  });

  test("le niveau d'activité change la maintenance dans le sens attendu", () => {
    const sed = compute({ ...base, activite: "sedentaire", objectif: "maintien" });
    const actif = compute({ ...base, activite: "actif", objectif: "maintien" });
    assert.ok(actif.maintenanceKcal > sed.maintenanceKcal);
    assert.equal(ACTIVITY_FACTORS.actif > ACTIVITY_FACTORS.sedentaire, true);
  });

  test("le profil réel de Simon (public/programs/haut-bas-5j.json) calcule sans erreur", async () => {
    const { default: real } = await import("../public/programs/haut-bas-5j.json", { with: { type: "json" } });
    const p = compute({ ...real.profile, sexe: "h", activite: "modere", objectif: "masse" });
    assert.ok(Number.isFinite(p.maintenanceKcal) && p.maintenanceKcal > 0);
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
  test("rend un tableau de phrases courtes (300 caractères max par bloc)", () => {
    const p = compute({ ...base, objectif: "masse" });
    const lines = aiBrief(p, 4);
    assert.ok(Array.isArray(lines));
    for (const line of lines) assert.ok(line.length <= 300, line);
  });

  test("contient les chiffres calculés et le nombre de séances", () => {
    const p = compute({ ...base, objectif: "masse" });
    const brief = aiBrief(p, 4).join(" ");
    assert.ok(brief.includes(String(p.startKcal)));
    assert.ok(brief.includes(String(p.macros.p)));
    assert.ok(brief.includes("4"));
    assert.ok(/masse/i.test(brief));
  });

  test("ne prescrit aucun repas précis (laissé à l'IA externe)", () => {
    const p = compute({ ...base, objectif: "seche" });
    const brief = aiBrief(p, 3).join(" ");
    assert.ok(!/riz|poulet|avoine/i.test(brief));
  });

  test("omet la ligne « Objectif » quand le profil n'en porte pas (profil d'avant #121)", () => {
    const p = compute({ ...base, objectif: "masse" });
    delete p.objectif;
    const brief = aiBrief(p, 4).join(" ");
    assert.ok(!/objectif/i.test(brief));
  });
});
