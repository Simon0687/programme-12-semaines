import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { EXERCISES, EXERCISE_IDS, UNSELECTABLE_IDS, REGISTRY_VERSION, MUSCLE_GROUPS, PATTERNS, EQUIPMENT } from "../src/registry.js";
import { DEFAULT_DEFINITION } from "../src/default-program.js";
import { LEGACY_DEFINITION } from "../src/legacy-program.js";

/* #26 : le registre doit couvrir *tous* les programmes livrés, pas seulement
   celui qui se trouve être le bundle du moment. Un id manquant ne casse rien
   à la construction — il produit un exercice `undefined` au rendu. */
const SHIPPED = [
  ["programme hérité", LEGACY_DEFINITION],
  ["bundle par défaut", DEFAULT_DEFINITION],
];

describe("registry shape", () => {
  test("REGISTRY_VERSION est un entier", () => {
    assert.equal(Number.isInteger(REGISTRY_VERSION), true);
  });

  test("chaque entrée porte au moins un name", () => {
    for (const [id, v] of Object.entries(EXERCISES)) assert.equal(typeof v.name, "string", id);
  });

  test("EXERCISE_IDS contient exactement les clés de EXERCISES", () => {
    assert.deepEqual([...EXERCISE_IDS].sort(), Object.keys(EXERCISES).sort());
  });
});

describe("champs de sélection (#25 Q8)", () => {
  const selectable = Object.entries(EXERCISES).filter(([id]) => !UNSELECTABLE_IDS.has(id));

  test("UNSELECTABLE_IDS recense exactement les 4 exceptions documentées (travail anti-mouvement, pattern absent du catalogue)", () => {
    assert.deepEqual([...UNSELECTABLE_IDS].sort(), ["abwheel", "carry", "pallof", "sideplank"]);
  });

  test("chaque entrée sélectionnable porte les 11 clés muscles et somme à 1.0", () => {
    for (const [id, v] of selectable) {
      assert.ok(v.muscles, `${id} : muscles manquant`);
      for (const k of Object.keys(v.muscles)) assert.ok(MUSCLE_GROUPS.includes(k), `${id} : clé muscle inconnue « ${k} »`);
      const sum = Object.values(v.muscles).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1) < 1e-9, `${id} : muscles somme à ${sum}, attendu 1.0`);
    }
  });

  test("chaque entrée sélectionnable a un pattern dans la taxonomie fermée", () => {
    for (const [id, v] of selectable) assert.ok(PATTERNS.includes(v.pattern), `${id} : pattern inconnu « ${v.pattern} »`);
  });

  test("chaque entrée sélectionnable a un type compose ou isolation", () => {
    for (const [id, v] of selectable) assert.ok(["compose", "isolation"].includes(v.type), id);
  });

  test("chaque valeur equipement est dans le vocabulaire fermé", () => {
    for (const [id, v] of selectable) {
      assert.ok(Array.isArray(v.equipement), id);
      for (const e of v.equipement) assert.ok(EQUIPMENT.includes(e), `${id} : équipement inconnu « ${e} »`);
    }
  });

  test("stabilite / niveau_min / cout_systemique sont dans [1, 3]", () => {
    for (const [id, v] of selectable) {
      for (const field of ["stabilite", "niveau_min", "cout_systemique"]) {
        assert.ok([1, 2, 3].includes(v[field]), `${id}.${field} = ${v[field]}`);
      }
    }
  });

  test("alias, quand présent, est unique dans le registre", () => {
    const aliases = Object.values(EXERCISES).map((v) => v.alias).filter(Boolean);
    assert.deepEqual(aliases.length, new Set(aliases).size);
  });

  test("les 4 exceptions n'ont aucun champ de sélection (pas d'oubli silencieux)", () => {
    for (const id of UNSELECTABLE_IDS) {
      const v = EXERCISES[id];
      for (const field of ["muscles", "pattern", "type", "equipement", "stabilite", "niveau_min", "cout_systemique"]) {
        assert.equal(v[field], undefined, `${id}.${field} devrait être absent`);
      }
    }
  });
});

describe("cohérence avec les programmes livrés", () => {
  for (const [label, def] of SHIPPED) {
    test(`${label} : tout b1/b2 référencé par SLOTS existe dans le registre`, () => {
      for (const [id, slot] of Object.entries(def.program.SLOTS)) {
        assert.ok(EXERCISE_IDS.has(slot.b1), `${id}.b1 = ${slot.b1}`);
        assert.ok(EXERCISE_IDS.has(slot.b2), `${id}.b2 = ${slot.b2}`);
      }
    });

    test(`${label} : toute clé de startingLoads existe dans le registre`, () => {
      for (const vid of Object.keys(def.startingLoads || {})) assert.ok(EXERCISE_IDS.has(vid), vid);
    });
  }
});
