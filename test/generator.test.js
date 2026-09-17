import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  FREQUENCIES, DURATIONS, PRESETS, OBJECTIVES,
  DEFAULT_LEVEL, DEFAULT_OBJECTIVE,
  generate, poolFor, intentSummary,
} from "../src/generator.js";
import { VOLUME, assess, targetsFor, resolveWeek, weeklyVolume } from "../src/assertions.js";
import { validateDefinition } from "../src/journal-shape.js";
import { buildProgram } from "../src/program.js";
import { EXERCISES, UNSELECTABLE_IDS } from "../src/registry.js";
import { draftFrom, toDefinition, withNewId } from "../src/program-editor.js";
import { buildPlan } from "../src/plan.js";

/* Une date fixe : `startDate` est le lundi qui vient, et un test qui lit
   l'horloge change de résultat le lundi. */
const TODAY = new Date(2026, 8, 17);
const gen = (c) => generate(c, TODAY);

/* Les libellés du rapport, tels que le module les écrit. Un signalement porte
   une clé de muscle, le rapport un libellé : la table de correspondance est
   ici plutôt qu'exportée, pour que le test échoue si l'un des deux change
   sans l'autre. */
const LABELS = {
  dos: "Dos", pectoraux: "Pectoraux", quadriceps: "Quadriceps",
  ischios_fessiers: "Ischios et fessiers", deltoide_ant: "Delt antérieurs",
  deltoide_lat: "Delt latéraux", deltoide_post: "Delt postérieurs",
  biceps: "Biceps", triceps: "Triceps", mollets: "Mollets", abdominaux: "Abdos",
};

/* Les 40 combinaisons de la collecte : 5 fréquences x 4 durées x 2 presets. */
const COMBINATIONS = [];
for (const equipment of Object.keys(PRESETS)) {
  for (const frequency of FREQUENCIES) {
    for (const duration of DURATIONS) COMBINATIONS.push({ frequency, duration, equipment });
  }
}

describe("les vocabulaires de la collecte (#58)", () => {
  test("cinq fréquences, quatre durées, deux presets", () => {
    assert.deepEqual(FREQUENCIES, [2, 3, 4, 5, 6]);
    assert.deepEqual(DURATIONS, [45, 60, 75, 90]);
    assert.deepEqual(Object.keys(PRESETS), ["salle-complete", "home-gym"]);
  });

  /* decisions-spec.md Q1 : le troisième preset n'existe pas tant que le
     registre ne peut pas le nourrir. Le test dit pourquoi, pas seulement
     quoi — cinq entrées et aucun bas du corps. */
  test("pas de preset poids du corps : le registre n'a pas de quoi", () => {
    const pool = poolFor(["poids_du_corps", "barre_traction", "barres_paralleles"], "avance");
    assert.ok(pool.length < 6, `${pool.length} entrées sélectionnables`);
    for (const m of ["quadriceps", "ischios_fessiers"]) {
      assert.ok(!pool.some((e) => (e.muscles[m] ?? 0) >= 0.5), `aucun exercice primaire pour ${m}`);
    }
  });

  test("les trois objectifs ont une ligne de prescription, la v1 en utilise une", () => {
    assert.deepEqual(OBJECTIVES, ["force", "hypertrophie", "endurance"]);
    assert.ok(OBJECTIVES.includes(DEFAULT_OBJECTIVE));
  });
});

describe("poolFor : le filtre du catalogue (#58)", () => {
  test("l'équipement est une inclusion, pas une facette", () => {
    const { gear } = PRESETS["home-gym"];
    for (const e of poolFor(gear, DEFAULT_LEVEL)) {
      for (const q of e.equipement) assert.ok(gear.includes(q), `${e.id} demande ${q}`);
    }
  });

  test("les quatre entrées sans champs de sélection n'y sont jamais", () => {
    const ids = poolFor(PRESETS["salle-complete"].gear, "avance").map((e) => e.id);
    for (const id of UNSELECTABLE_IDS) assert.ok(!ids.includes(id), id);
  });

  test("le niveau filtre par niveau_min", () => {
    const ids = (level) => poolFor(PRESETS["salle-complete"].gear, level).map((e) => e.id);
    assert.ok(!ids("debutant").includes("squat"), "squat est niveau_min 2");
    assert.ok(ids("intermediaire").includes("squat"));
    assert.ok(!ids("intermediaire").includes("dl_conv"), "le soulevé de terre est niveau_min 3");
    assert.ok(ids("avance").includes("dl_conv"));
  });

  test("l'ordre est celui des ids : deux appels rendent la même liste", () => {
    const a = poolFor(PRESETS["salle-complete"].gear, DEFAULT_LEVEL).map((e) => e.id);
    const b = poolFor(PRESETS["salle-complete"].gear, DEFAULT_LEVEL).map((e) => e.id);
    assert.deepEqual(a, b);
    assert.deepEqual(a, [...a].sort());
  });
});

describe("generate : le split (§3 étape 1)", () => {
  const namesFor = (frequency) => gen({ frequency, duration: 90, equipment: "salle-complete" })
    .definition.program.SESSIONS.map((s) => s.name);

  test("2 et 3 séances forcent le full body", () => {
    assert.deepEqual(namesFor(2), ["Full body A", "Full body B"]);
    assert.deepEqual(namesFor(3), ["Full body A", "Full body B", "Full body C"]);
  });

  test("4 séances donnent un haut/bas, 6 un push/pull/legs", () => {
    assert.deepEqual(namesFor(4), ["Upper A", "Lower A", "Upper B", "Lower B"]);
    assert.deepEqual(namesFor(6), ["Push A", "Pull A", "Legs A", "Push B", "Pull B", "Legs B"]);
  });

  test("les jours sont ceux de l'étape 5", () => {
    const days = (frequency) => gen({ frequency, duration: 60, equipment: "salle-complete" })
      .definition.program.SESSIONS.map((s) => s.day);
    assert.deepEqual(days(2), [1, 4]);
    assert.deepEqual(days(3), [1, 3, 5]);
    assert.deepEqual(days(4), [1, 2, 4, 5]);
    assert.deepEqual(days(5), [1, 2, 3, 5, 6]);
    assert.deepEqual(days(6), [1, 2, 3, 5, 6, 7]);
  });
});

describe("generate : la sortie est une définition comme une autre (#58)", () => {
  const { definition } = gen({ frequency: 4, duration: 60, equipment: "salle-complete" });

  /* Le point qui compte : la même porte qu'un fichier chargé. Si le moteur
     produisait une forme que `parseProgramImport()` refuse, l'éditeur ne
     pourrait pas l'enregistrer. */
  test("elle passe le validateur de forme", () => {
    assert.equal(validateDefinition(definition), null);
  });

  test("elle porte les six champs de l'intention déclarée", () => {
    assert.deepEqual(definition.intent, {
      frequency: 4, duration: 60, level: DEFAULT_LEVEL,
      objective: DEFAULT_OBJECTIVE, priorities: [], equipment: "salle-complete",
    });
  });

  test("elle est nommée d'après le split et les deux nombres", () => {
    assert.equal(definition.name, "Upper/Lower 4 jours, 60 min");
    assert.equal(definition.id, "upper-lower-4-jours-60-min");
  });

  test("12 semaines, aucune charge de départ, le lundi qui vient", () => {
    assert.equal(definition.weeks, 12);
    assert.deepEqual(definition.startingLoads, {});
    assert.equal(definition.startDate, "2026-09-21");
  });

  test("les créneaux portent reps, repos et les deux blocs", () => {
    for (const [id, slot] of Object.entries(definition.program.SLOTS)) {
      assert.ok(Array.isArray(slot.reps) && slot.reps.length === 2, id);
      assert.ok(Number.isFinite(slot.rest), id);
      assert.ok(EXERCISES[slot.b1] && EXERCISES[slot.b2], id);
    }
  });

  test("chaque séance a une ancre composée, marquée key", () => {
    for (const s of definition.program.SESSIONS) {
      const keys = s.ex.filter(([id]) => definition.program.SLOTS[id].key);
      assert.equal(keys.length, 1, `${s.id} : une ancre et une seule`);
    }
  });

  /* L'intention traverse l'éditeur : sans ça, « Partir du programme actif »
     sur un programme généré lui retirerait ses cibles en silence. */
  test("l'intention survit à l'aller-retour par l'éditeur", () => {
    assert.deepEqual(toDefinition(draftFrom(definition)).intent, definition.intent);
  });
});

describe("intentSummary : la ligne en lecture seule de l'éditeur (#58)", () => {
  test("elle nomme les quatre valeurs de l'intention", () => {
    const { definition } = gen({ frequency: 4, duration: 60, equipment: "home-gym" });
    assert.equal(
      intentSummary(definition.intent),
      "Généré pour 4 séances de 60 min, hypertrophie, niveau intermédiaire, home gym.",
    );
  });

  test("un programme composé à la main n'a rien à montrer", () => {
    assert.equal(intentSummary(undefined), null);
    assert.equal(intentSummary({}), null);
    assert.equal(intentSummary({ frequency: 4 }), null);
  });

  test("une intention partielle reste descriptible plutôt que muette", () => {
    assert.equal(intentSummary({ frequency: 3, duration: 45 }), "Généré pour 3 séances de 45 min.");
  });
});

describe("generate : le refus chiffré (§3 étape 3)", () => {
  test("2 séances de 45 min est la seule combinaison refusée", () => {
    const refused = COMBINATIONS.filter((c) => !gen(c).ok);
    assert.deepEqual(
      refused.map((c) => `${c.frequency}x${c.duration}`),
      ["2x45", "2x45"],
      "une par preset, et aucune autre",
    );
  });

  test("le refus nomme les deux nombres et ne rend aucun programme", () => {
    const r = gen({ frequency: 2, duration: 45, equipment: "salle-complete" });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "budget");
    assert.match(r.message, /22 séries/);
    assert.match(r.message, /demande 26/);
    assert.equal(r.definition, undefined);
  });

  test("des contraintes hors vocabulaire ne rendent pas un programme au hasard", () => {
    for (const c of [
      { frequency: 7, duration: 60, equipment: "salle-complete" },
      { frequency: 4, duration: 50, equipment: "salle-complete" },
      { frequency: 4, duration: 60, equipment: "garage" },
      { frequency: 4, duration: 60, equipment: "salle-complete", level: "zzz" },
    ]) {
      assert.equal(gen(c).ok, false, JSON.stringify(c));
    }
  });
});

describe("generate : ce que le moteur dit avoir coupé (#58)", () => {
  test("3 séances de 60 min : la cascade coupe mollets et abdos", () => {
    const r = gen({ frequency: 3, duration: 60, equipment: "salle-complete" });
    assert.deepEqual(r.report.cut, ["Mollets", "Abdos"]);
    assert.ok(r.report.cascade.includes("periphery"));
    const volume = weeklyVolume(resolveWeek(buildProgram(r.definition), "b1"));
    assert.equal(volume.mollets, 0);
    assert.equal(volume.abdominaux, 0);
  });

  test("le home gym n'a pas de mollets, et le dit", () => {
    const r = gen({ frequency: 4, duration: 60, equipment: "home-gym" });
    assert.deepEqual(r.report.uncovered, ["Mollets"]);
    assert.deepEqual(r.report.cut, []);
  });

  /* Le deltoïde antérieur n'est jamais « non couvert » : ne pas lui donner de
     créneau, c'est appliquer la règle de comptage indirect. */
  test("le deltoïde antérieur n'entre jamais dans le rapport", () => {
    for (const c of COMBINATIONS) {
      const r = gen(c);
      if (!r.ok) continue;
      assert.ok(!r.report.uncovered.includes("Delt antérieurs"), JSON.stringify(c));
    }
  });

  test("aucun exercice hors du matériel déclaré", () => {
    for (const c of COMBINATIONS) {
      const r = gen(c);
      if (!r.ok) continue;
      const { gear } = PRESETS[c.equipment];
      for (const slot of Object.values(r.definition.program.SLOTS)) {
        for (const vid of [slot.b1, slot.b2]) {
          for (const q of EXERCISES[vid].equipement) {
            assert.ok(gear.includes(q), `${JSON.stringify(c)} : ${vid} demande ${q}`);
          }
        }
      }
    }
  });
});

/* Le test qui mesure le moteur : les six assertions de #37, sur chacune des
   38 combinaisons générées, avec les cibles que l'intention déclare.

   Le contrat n'est pas « aucun signalement » — ce serait demander au moteur
   de fabriquer du volume qu'un format de 2 séances ne peut pas porter. Il
   est plus strict sur ce qui compte : **aucun signalement que le moteur
   n'ait annoncé lui-même**. Un manque connu est dans le rapport, et un
   excès, un schéma dupliqué ou un dépassement de durée n'ont aucune excuse. */
describe("generate : les six assertions sur les 38 combinaisons (§7)", () => {
  const findingsFor = (c) => {
    const r = gen(c);
    if (!r.ok) return null;
    const advice = assess(buildProgram(r.definition), targetsFor(r.definition.intent));
    return { r, findings: advice.findings };
  };

  test("aucun signalement que le rapport n'explique", () => {
    for (const c of COMBINATIONS) {
      const out = findingsFor(c);
      if (!out) continue;
      const known = new Set([...out.r.report.cut, ...out.r.report.uncovered]);
      const surprises = out.findings.filter((f) => !(f.muscle && known.has(LABELS[f.muscle])));
      assert.deepEqual(
        surprises.map((f) => `${f.code}:${f.muscle || f.sessionId}`), [],
        `${c.equipment} ${c.frequency}x${c.duration}`,
      );
    }
  });

  test("jamais de volume au-dessus de la fourchette, jamais de schéma dupliqué", () => {
    for (const c of COMBINATIONS) {
      const out = findingsFor(c);
      if (!out) continue;
      const label = `${c.equipment} ${c.frequency}x${c.duration}`;
      assert.ok(!out.findings.some((f) => f.code === "duplicate-pattern"), label);
      assert.ok(!out.findings.some((f) => f.code === "recovery-too-close"), label);
      assert.ok(!out.findings.some((f) => f.code === "duration-over-budget"), label);
      assert.ok(!out.findings.some((f) => f.code === "theme-mismatch"), label);

      const volume = weeklyVolume(resolveWeek(buildProgram(out.r.definition), "b1"));
      for (const [m, range] of Object.entries(VOLUME)) {
        if (range.coveredIndirectly) continue;
        assert.ok(volume[m] <= range.max, `${label} : ${m} à ${volume[m]} pour un max de ${range.max}`);
      }
    }
  });

  test("les deux blocs tiennent, pas seulement le premier", () => {
    for (const c of COMBINATIONS) {
      const r = gen(c);
      if (!r.ok) continue;
      const prog = buildProgram(r.definition);
      const b2 = resolveWeek(prog, "b2");
      assert.ok(b2, `${c.equipment} ${c.frequency}x${c.duration} : bloc 2 illisible`);
      const volume = weeklyVolume(b2);
      for (const [m, range] of Object.entries(VOLUME)) {
        if (range.coveredIndirectly) continue;
        assert.ok(volume[m] <= range.max, `bloc 2, ${m} à ${volume[m]}`);
      }
    }
  });

  test("toutes les définitions générées passent le validateur de forme", () => {
    for (const c of COMBINATIONS) {
      const r = gen(c);
      if (!r.ok) continue;
      assert.equal(validateDefinition(r.definition), null, `${c.equipment} ${c.frequency}x${c.duration}`);
    }
  });
});

/* Le parcours complet, sans écran : générer, ouvrir dans l'éditeur,
   enregistrer, puis lire l'avis que Plan affichera. C'est le seul test qui
   dise que la dette de #57 est réellement soldée — « ce programme ne déclare
   ni cible de volume ni durée de séance » disparaît parce qu'on y a répondu,
   et reste là pour un programme composé à la main. */
describe("de la collecte à l'avis de Plan (#58)", () => {
  const saved = toDefinition(withNewId(draftFrom(
    gen({ frequency: 4, duration: 60, equipment: "salle-complete" }).definition,
  ), ["upper-lower-4j"]));

  test("le cycle enregistré passe le validateur et porte un id lisible", () => {
    assert.equal(validateDefinition(saved), null);
    assert.equal(saved.id, "upper-lower-4-jours-60-min");
  });

  test("l'onglet Plan sait le décrire, table de volume comprise", () => {
    assert.deepEqual(buildPlan(saved).map((s) => s.id), ["structure", "volume", "progression", "deload"]);
  });

  test("avec son intention, l'avis n'a plus rien à dire", () => {
    const advice = assess(buildProgram(saved), targetsFor(saved.intent ?? {}));
    assert.deepEqual(advice.findings, []);
    assert.equal(advice.ok, true);
  });

  test("sans intention déclarée, la ligne de #57 est toujours là", () => {
    const { intent, ...handwritten } = saved;
    const advice = assess(buildProgram(handwritten), targetsFor(handwritten.intent ?? {}));
    assert.deepEqual(advice.findings.map((f) => f.code), ["no-declared-intent"]);
  });
});

describe("generate : reproductible (#58)", () => {
  test("deux appels identiques rendent le même programme", () => {
    for (const c of [
      { frequency: 4, duration: 60, equipment: "salle-complete" },
      { frequency: 6, duration: 90, equipment: "home-gym" },
      { frequency: 2, duration: 75, equipment: "salle-complete" },
    ]) {
      assert.deepEqual(gen(c).definition, gen(c).definition, JSON.stringify(c));
    }
  });

  test("le niveau change la sortie, et pas seulement les cibles", () => {
    const c = { frequency: 4, duration: 90, equipment: "salle-complete" };
    const debutant = generate({ ...c, level: "debutant" }, TODAY).definition;
    const avance = generate({ ...c, level: "avance" }, TODAY).definition;
    assert.notDeepEqual(debutant.program, avance.program);
    assert.equal(debutant.intent.level, "debutant");
  });
});
