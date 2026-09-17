import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { filterExercises, FACET_VALUES, MUSCLE_GROUPS, PATTERNS, EQUIPMENT } from "../src/exercise-filter.js";
import { EXERCISES, UNSELECTABLE_IDS } from "../src/registry.js";

const ids = (...args) => filterExercises(...args).map((e) => e.id);
const ALL = Object.keys(EXERCISES).length;

describe("sans critère : tout le registre, dans l'ordre d'un lecteur", () => {
  test("une requête vide rend les 63 entrées — le sélecteur s'ouvre sur tout", () => {
    assert.equal(filterExercises("").length, ALL);
    assert.equal(filterExercises(null).length, ALL);
    assert.equal(filterExercises(undefined, {}).length, ALL);
  });

  test("chaque entrée porte son id, que l'écran renverra à addRow", () => {
    for (const e of filterExercises("")) assert.equal(EXERCISES[e.id].name, e.name);
  });

  test("tri par nom en français : les accents ne partent pas en fin de liste", () => {
    const names = filterExercises("").map((e) => e.name);
    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, "fr")));
    assert.ok(names.indexOf("Écarté à la poulie") < names.indexOf("Extension lombaire au banc"));
  });

  test("une facette inconnue ne rend rien, plutôt que d'être ignorée en silence", () => {
    assert.deepEqual(ids("", { muscle: "abdos" }), []);
    assert.deepEqual(ids("", { pattern: "pompes" }), []);
    assert.deepEqual(ids("", { equipment: "elastique" }), []);
  });
});

describe("recherche par nom", () => {
  test("« developpe » trouve « Développé couché barre » : accents et casse ignorés", () => {
    assert.ok(ids("developpe").includes("dc"));
    assert.ok(ids("DÉVELOPPÉ").includes("dc"));
  });

  test("les mots sont exigés tous, dans n'importe quel ordre", () => {
    assert.deepEqual(ids("developpe barre"), ["dc", "ohp_bb"]);
    assert.deepEqual(ids("barre developpe"), ["dc", "ohp_bb"]);
  });

  test("un mot absent du nom ne rend rien", () => {
    assert.deepEqual(ids("developpe kettlebell"), []);
  });

  test("les quatre entrées sans champs de sélection restent atteignables par leur nom", () => {
    assert.ok(ids("pallof").includes("pallof"));
    assert.ok(ids("planche laterale").includes("sideplank"));
    assert.ok(ids("ab wheel").includes("abwheel"));
    assert.ok(ids("suitcase").includes("carry"));
  });
});

describe("facettes", () => {
  test("aucune facette, quelle que soit sa valeur, ne rend une entrée sans champs de sélection (#25)", () => {
    const cases = [
      ...MUSCLE_GROUPS.map((muscle) => ({ muscle })),
      ...PATTERNS.map((pattern) => ({ pattern })),
      ...EQUIPMENT.map((equipment) => ({ equipment })),
    ];
    for (const facets of cases) {
      for (const id of ids("", facets)) {
        assert.equal(UNSELECTABLE_IDS.has(id), false, `${JSON.stringify(facets)} rend ${id}`);
      }
    }
  });

  test("le muscle se lit dans la répartition, sans seuil : le développé couché est un exercice de triceps (0.2)", () => {
    const triceps = ids("", { muscle: "triceps" });
    assert.ok(triceps.includes("dc"));
    assert.ok(triceps.includes("pushdown"));
  });

  test("un muscle absent de la répartition n'est pas une part nulle : le leg curl n'est pas un exercice de mollets", () => {
    assert.equal(ids("", { muscle: "mollets" }).includes("lc_seat"), false);
  });

  test("l'équipement lit `equipement` du registre, la facette s'écrit `equipment`", () => {
    const halteres = ids("", { equipment: "halteres" });
    assert.ok(halteres.includes("curl_db"));
    assert.equal(halteres.includes("squat"), false);
  });

  test("le pattern est exact, jamais une famille", () => {
    assert.deepEqual(ids("", { pattern: "mollets" }).sort(), ["calf_press", "calf_seat", "calf_stand"]);
  });

  test("deux facettes se cumulent, et se cumulent avec la recherche", () => {
    const facets = { pattern: "tirage_horizontal", equipment: "poulie" };
    assert.deepEqual(ids("", facets).sort(), ["row_cable", "row_uni"]);
    assert.deepEqual(ids("unilateral", facets), ["row_uni"]);
  });

  test("kettlebell est le seul équipement du vocabulaire que rien ne porte aujourd'hui", () => {
    const vides = EQUIPMENT.filter((equipment) => ids("", { equipment }).length === 0);
    assert.deepEqual(vides, ["kettlebell"]);
    assert.deepEqual(MUSCLE_GROUPS.filter((muscle) => ids("", { muscle }).length === 0), []);
    assert.deepEqual(PATTERNS.filter((pattern) => ids("", { pattern }).length === 0), []);
  });
});

describe("FACET_VALUES : ce que le sélecteur propose", () => {
  test("chaque valeur proposée rend au moins un exercice", () => {
    for (const [key, values] of Object.entries(FACET_VALUES)) {
      for (const v of values) assert.ok(ids("", { [key]: v }).length > 0, `${key} = ${v}`);
    }
  });

  test("kettlebell est dans le vocabulaire, pas dans les facettes proposées", () => {
    assert.ok(EQUIPMENT.includes("kettlebell"));
    assert.equal(FACET_VALUES.equipment.includes("kettlebell"), false);
  });

  test("rien d'autre n'est écarté des vocabulaires", () => {
    assert.deepEqual(FACET_VALUES.muscle, MUSCLE_GROUPS);
    assert.deepEqual(FACET_VALUES.pattern, PATTERNS);
    assert.deepEqual(FACET_VALUES.equipment, EQUIPMENT.filter((e) => e !== "kettlebell"));
  });
});
