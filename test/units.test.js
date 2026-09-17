import test from "node:test";
import assert from "node:assert/strict";
import { UNITS, traitsOf } from "../src/units.js";
import { EXERCISES } from "../src/registry.js";
import { chartMode } from "../src/exercise-history.js";
import { unitColumns } from "../src/display.js";

/* ---------- La table des traits d'unité (#23) ----------

   Huit ternaires indépendants décidaient de ce qu'une unité implique, dans
   cinq modules, dont deux branches identiques écrites deux fois. Ce fichier
   tient les deux propriétés qui empêchent la dispersion de revenir : la table
   couvre exactement les unités qui existent, et chaque entrée est complète. */

test("UNITS couvre toutes les unités que le registre déclare", () => {
  /* Le registre n'écrit pas `unit: "kg"` — c'est le défaut, et c'est
     précisément ce repli qui poussait chaque appelant à écrire `v.unit || "kg"`
     avant de décider. */
  const declared = new Set(Object.values(EXERCISES).map((e) => e.unit || "kg"));
  for (const u of declared) assert.ok(UNITS[u], `unité « ${u} » déclarée par le registre, absente de UNITS`);
});

test("chaque entrée porte les quatre traits, aucune n'en oublie", () => {
  /* Une entrée incomplète ne lève pas : elle rend `undefined`, que
     `!u.hasLoad` lit comme « pas de charge ». C'est le mode de panne d'une
     table, et il est silencieux. */
  for (const [unit, t] of Object.entries(UNITS)) {
    assert.equal(typeof t.hasLoad, "boolean", `${unit}.hasLoad`);
    assert.equal(typeof t.bodyweight, "boolean", `${unit}.bodyweight`);
    assert.ok(t.repUnit === "reps" || t.repUnit === "s", `${unit}.repUnit`);
    assert.ok(t.chart && typeof t.chart.kind === "string", `${unit}.chart`);
  }
});

test("une unité inconnue ou absente retombe sur le kilo", () => {
  assert.equal(traitsOf(undefined), UNITS.kg);
  assert.equal(traitsOf("boulons"), UNITS.kg);
  assert.equal(traitsOf("bw"), UNITS.bw);
});

test("bodyweight n'est vrai que là où la charge s'ajoute au corps", () => {
  /* `carry` porte une charge et ne l'ajoute pas au corps : c'est la paire que
     les ternaires confondaient le plus volontiers, `unit !== "kg"` valant pour
     les deux. */
  assert.equal(UNITS.bw.bodyweight, true);
  assert.equal(UNITS.carry.bodyweight, false);
  assert.equal(UNITS.carry.hasLoad, true);
});

test("repUnit est le seul endroit où carry compte avec time", () => {
  assert.equal(UNITS.carry.repUnit, "s");
  assert.equal(UNITS.time.repUnit, "s");
  assert.equal(UNITS.bw.repUnit, "reps");
  /* Et l'autre découpage, celui de la charge, les sépare. */
  assert.equal(UNITS.time.hasLoad, false);
  assert.equal(UNITS.carry.hasLoad, true);
});

test("chartMode rend exactement ce qu'il rendait avant de lire la table (#17)", () => {
  /* Épinglé au caractère : la table a remplacé cinq `if`, elle ne doit pas
     avoir remplacé leur contenu. */
  assert.deepEqual(chartMode("bw"), { kind: "dual", line: "reps", bar: "kg" });
  assert.deepEqual(chartMode("carry"), { kind: "dual", line: "time", bar: "kg" });
  assert.deepEqual(chartMode("time"), { kind: "raw", line: "time" });
  assert.deepEqual(chartMode("reps"), { kind: "raw", line: "reps" });
  assert.deepEqual(chartMode("kg"), { kind: "estimate", line: "kg" });
  assert.deepEqual(chartMode(undefined), { kind: "estimate", line: "kg" });
});

test("les colonnes affichées et les champs saisis sont en nombre égal", () => {
  /* Les deux vivent dans deux modules — les mots dans display.js, le sens dans
     units.js — et rien dans le typage ne les relie. Une colonne sans champ
     décale toute la grille de saisie de la carte exercice. */
  for (const unit of Object.keys(UNITS)) {
    const fields = traitsOf(unit).hasLoad ? 3 : 2;
    assert.equal(unitColumns(unit).length, fields, `${unit} : ${unitColumns(unit).length} colonnes pour ${fields} champs`);
  }
});
