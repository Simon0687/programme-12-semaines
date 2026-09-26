import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { filterExercises, FACET_VALUES, facetValues, applyFacet, facetsOf, FACET_KEYS, MUSCLE_GROUPS, PATTERNS, EQUIPMENT } from "../src/exercise-filter.js";
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
    assert.deepEqual(ids("", { pattern: "mollets" }).sort(), ["calf_press", "calf_seat", "calf_stand", "calf_step"]);
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

  test("FACET_VALUES est exactement ce que facetValues rend", () => {
    assert.deepEqual(FACET_VALUES, facetValues());
  });
});

/* ---------- les facettes ne dépendent plus les unes des autres ----------

   #64 avait fait dépendre chaque liste de ce qui était déjà coché sur les
   autres. Reverti : ça bloquait un changement de facette dès que la nouvelle
   valeur était incompatible avec l'ancienne, puisque cette valeur n'était
   alors même plus proposée. `applyFacet` absorbe seul ce conflit après le
   clic — les listes n'ont plus besoin de l'anticiper. */

describe("facetValues : les listes sont fixes, quelle que soit la facette déjà cochée", () => {
  test("« Dominante genou » reste proposé même une fois « Pectoraux » coché", () => {
    const values = facetValues();
    assert.ok(values.pattern.includes("dominante_genou"));
    assert.ok(values.pattern.includes("poussee_horizontale"));
  });

  test("aucun argument n'est pris en compte : facetValues() ne varie pas", () => {
    assert.deepEqual(facetValues(), FACET_VALUES);
  });
});

describe("applyFacet : la facette qu'on vient de toucher gagne", () => {
  test("cocher un muscle incompatible lâche le mouvement, pas l'inverse", () => {
    const next = applyFacet({ muscle: "", pattern: "dominante_genou", equipment: "" }, "muscle", "pectoraux");
    assert.deepEqual(next, { muscle: "pectoraux", pattern: "", equipment: "" });
  });

  test("cocher un mouvement incompatible lâche le muscle", () => {
    const next = applyFacet({ muscle: "pectoraux", pattern: "", equipment: "" }, "pattern", "dominante_genou");
    assert.deepEqual(next, { muscle: "", pattern: "dominante_genou", equipment: "" });
  });

  test("une combinaison qui tient n'est pas touchée", () => {
    const facets = { muscle: "pectoraux", pattern: "", equipment: "" };
    assert.deepEqual(applyFacet(facets, "pattern", "poussee_horizontale"), { muscle: "pectoraux", pattern: "poussee_horizontale", equipment: "" });
  });

  test("décocher ne peut rien vider : les autres facettes restent", () => {
    const facets = { muscle: "pectoraux", pattern: "poussee_horizontale", equipment: "halteres" };
    assert.deepEqual(applyFacet(facets, "muscle", ""), { muscle: "", pattern: "poussee_horizontale", equipment: "halteres" });
  });

  test("quoi qu'on coche, la liste n'est jamais vide après coup", () => {
    for (const key of FACET_KEYS) {
      for (const v of FACET_VALUES[key]) {
        const start = { muscle: "quadriceps", pattern: "dominante_genou", equipment: "barre" };
        assert.ok(filterExercises("", applyFacet(start, key, v)).length > 0, `${key} = ${v}`);
      }
    }
  });
});

describe("facetsOf : les facettes qui décrivent un exercice", () => {
  test("le muscle dominant et le mouvement, pas le matériel", () => {
    assert.deepEqual(facetsOf(EXERCISES.dc), { muscle: "pectoraux", pattern: "poussee_horizontale" });
    assert.deepEqual(facetsOf(EXERCISES.squat), { muscle: "quadriceps", pattern: "dominante_genou" });
  });

  test("ce qu'elles cochent rend toujours l'exercice d'origine", () => {
    for (const [id, entry] of Object.entries(EXERCISES)) {
      if (UNSELECTABLE_IDS.has(id)) continue;
      assert.ok(filterExercises("", facetsOf(entry)).some((e) => e.id === id), id);
    }
  });

  test("une entrée sans champs de sélection ne coche rien", () => {
    assert.deepEqual(facetsOf(EXERCISES.pallof), { muscle: "", pattern: "" });
    assert.deepEqual(facetsOf(null), { muscle: "", pattern: "" });
    assert.deepEqual(facetsOf(undefined), { muscle: "", pattern: "" });
  });
});
