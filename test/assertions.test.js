import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  VOLUME, PRIMARY, LARGE_GROUPS,
  contribution, resolveWeek, weeklyVolume, stimulationFrequency, hasUnmodelledRows,
} from "../src/assertions.js";
import { EXERCISES, MUSCLE_GROUPS, UNSELECTABLE_IDS } from "../src/registry.js";
import { DEFAULT_DEFINITION } from "../src/default-program.js";
import { LEGACY_DEFINITION } from "../src/legacy-program.js";

/* Les deux programmes livrés, pas une copie écrite à la main : ce sont ceux
   que l'application charge, donc les seuls dont l'avis ait un sens. */
const BUNDLED = DEFAULT_DEFINITION.program;
const LEGACY = LEGACY_DEFINITION.program;

const weekOf = (program, block = "b1") => resolveWeek(program, block);

describe("la table de volume couvre le vocabulaire du registre (#37)", () => {
  test("les onze groupes de MUSCLE_GROUPS, ni plus ni moins", () => {
    assert.deepEqual(Object.keys(VOLUME).sort(), [...MUSCLE_GROUPS].sort());
  });

  test("chaque fourchette est un intervalle croissant", () => {
    for (const [m, t] of Object.entries(VOLUME)) {
      assert.ok(t.min > 0 && t.min <= t.max, m);
    }
  });

  test("les gros groupes de l'espacement 48 h sont des clés de la table", () => {
    for (const m of LARGE_GROUPS) assert.ok(VOLUME[m], m);
  });
});

describe("contribution : la règle de comptage indirect (§3 étape 2)", () => {
  test("part >= 0,5 vaut une série pleine", () => {
    assert.equal(contribution(EXERCISES.dc, "pectoraux"), 1); // 0.6
    assert.equal(contribution(EXERCISES.lc_lying, "ischios_fessiers"), 1); // 1.0
  });

  test("entre 0,2 et 0,5, un gros groupe compte pour moitié", () => {
    assert.equal(contribution(EXERCISES.hack, "ischios_fessiers"), 0.5); // 0.35
    assert.equal(contribution(EXERCISES.legpress, "ischios_fessiers"), 0.5); // 0.35
  });

  test("le deltoïde antérieur compte l'indirect : c'est ce qui le couvre", () => {
    assert.equal(contribution(EXERCISES.dc, "deltoide_ant"), 0.5); // 0.2
  });

  test("sur un groupe direct, l'indirect ne compte pas — le piège des bras", () => {
    assert.equal(EXERCISES.dc.muscles.triceps, 0.2);
    assert.equal(contribution(EXERCISES.dc, "triceps"), 0, "un développé couché n'est pas du triceps");
    assert.equal(EXERCISES.pd_wide.muscles.biceps, 0.2);
    assert.equal(contribution(EXERCISES.pd_wide, "biceps"), 0);
  });

  test("mais un isolé direct compte plein : l'ordre des deux tests", () => {
    assert.equal(contribution(EXERCISES.pushdown, "triceps"), 1); // 1.0, direct
    assert.equal(contribution(EXERCISES.curl_db, "biceps"), 1);
  });

  test("sous 0,2, rien", () => {
    assert.equal(EXERCISES.rpd.muscles.dos, 0.15);
    assert.equal(contribution(EXERCISES.rpd, "dos"), 0);
  });

  test("les quatre entrées sans champs de sélection ne contribuent nulle part", () => {
    for (const id of UNSELECTABLE_IDS) {
      for (const m of MUSCLE_GROUPS) assert.equal(contribution(EXERCISES[id], m), 0, `${id}/${m}`);
    }
  });

  test("PRIMARY est le seuil du palier plein, pas une deuxième constante", () => {
    const justUnder = { muscles: { dos: PRIMARY - 0.01 } };
    const justOn = { muscles: { dos: PRIMARY } };
    assert.equal(contribution(justOn, "dos"), 1);
    assert.equal(contribution(justUnder, "dos"), 0.5);
  });
});

describe("resolveWeek : une seule forme, lue par les six assertions", () => {
  test("le bundle rend ses quatre séances, dans l'ordre", () => {
    const week = weekOf(BUNDLED);
    assert.deepEqual(week.sessions.map((s) => s.id), ["upperA", "lowerA", "upperB", "lowerB"]);
    assert.equal(week.block, "b1");
  });

  test("les lignes de gainage sont fusionnées comme sur l'écran Séance", () => {
    const upperA = weekOf(BUNDLED).sessions[0];
    assert.equal(upperA.rows.length, BUNDLED.SESSIONS[0].ex.length + BUNDLED.CORE.coreB.ex.length);
    assert.equal(upperA.rows.at(-1).vid, "pallof", "la dernière ligne vient de CORE");
  });

  test("le bloc choisit la variante : latraise passe de la poulie aux haltères", () => {
    const pick = (block) => weekOf(BUNDLED, block).sessions[0].rows.find((r) => r.slotId === "latraise").vid;
    assert.equal(pick("b1"), "lat_cable");
    assert.equal(pick("b2"), "lat_db");
  });

  test("chaque ligne porte l'entrée du registre, pas seulement son id", () => {
    for (const row of weekOf(BUNDLED).sessions[0].rows) {
      assert.equal(row.entry, EXERCISES[row.vid]);
    }
  });

  test("les séries d'une séance somment CORE compris", () => {
    const upperA = weekOf(BUNDLED).sessions[0];
    assert.equal(upperA.sets, 4 + 4 + 3 + 3 + 1); // press, pulldown, latraise, triceps, pallof
  });

  test("le jour et le thème annoncé sont repris tels quels", () => {
    const lowerA = weekOf(BUNDLED).sessions[1];
    assert.equal(lowerA.day, 2);
    assert.equal(lowerA.sub, "Quadriceps, chaîne postérieure, mollets");
  });
});

describe("resolveWeek : une structure illisible rend null, jamais un jeté", () => {
  const broken = {
    "pas un objet": 42,
    null: null,
    tableau: [],
    "SLOTS absent": { SESSIONS: [], CORE: {} },
    "SESSIONS vide": { SLOTS: {}, SESSIONS: [], CORE: {} },
    "SESSIONS non tableau": { SLOTS: {}, SESSIONS: {}, CORE: {} },
    "CORE absent": { SLOTS: {}, SESSIONS: [{ id: "a", ex: [] }] },
  };

  for (const [label, program] of Object.entries(broken)) {
    test(`${label} -> null`, () => {
      assert.equal(resolveWeek(program, "b1"), null);
    });
  }

  test("une ligne qui n'est pas une paire rend null au lieu de déstructurer", () => {
    const program = structuredClone(BUNDLED);
    program.SESSIONS[0].ex = ["press"];
    assert.equal(resolveWeek(program, "b1"), null);
  });

  test("un slot inconnu rend null", () => {
    const program = structuredClone(BUNDLED);
    program.SESSIONS[0].ex = [["fantome", 3]];
    assert.equal(resolveWeek(program, "b1"), null);
  });

  test("un exercice hors du registre rend null (§2.5)", () => {
    const program = structuredClone(BUNDLED);
    program.SLOTS.press.b1 = "developpe-lunaire";
    assert.equal(resolveWeek(program, "b1"), null);
  });

  test("un nombre de séries absurde rend null", () => {
    const program = structuredClone(BUNDLED);
    program.SESSIONS[0].ex[0] = ["press", "quatre"];
    assert.equal(resolveWeek(program, "b1"), null);
  });

  test("une valeur aberrante se dégrade au lieu de tout perdre : day non entier", () => {
    const program = structuredClone(BUNDLED);
    program.SESSIONS[0].day = "lundi";
    const week = resolveWeek(program, "b1");
    assert.notEqual(week, null, "la structure se parcourt toujours");
    assert.equal(week.sessions[0].day, null);
    assert.equal(week.sessions[1].day, 2, "les autres séances gardent le leur");
  });
});

describe("weeklyVolume : les chiffres des deux programmes livrés", () => {
  /* Mesuré le 2026-09-17. Ces valeurs sont la clôture de l'assertion 1 :
     si elles bougent sans qu'un programme livré change, le comptage a
     changé de sens. */
  test("le bundle Upper/Lower, bloc 1", () => {
    assert.deepEqual(weeklyVolume(weekOf(BUNDLED)), {
      dos: 7, pectoraux: 7, quadriceps: 7, ischios_fessiers: 10.5,
      deltoide_ant: 5.5, deltoide_lat: 3, deltoide_post: 3,
      biceps: 3, triceps: 3, mollets: 6, abdominaux: 4,
    });
  });

  test("les deux blocs du bundle donnent le même profil musculaire", () => {
    assert.deepEqual(weeklyVolume(weekOf(BUNDLED, "b1")), weeklyVolume(weekOf(BUNDLED, "b2")));
  });

  test("le programme hérité Haut/Bas, bloc 1", () => {
    assert.deepEqual(weeklyVolume(weekOf(LEGACY)), {
      dos: 7, pectoraux: 8, quadriceps: 5, ischios_fessiers: 8.5,
      deltoide_ant: 6, deltoide_lat: 5, deltoide_post: 4,
      biceps: 5, triceps: 5, mollets: 6, abdominaux: 8,
    });
  });

  test("les onze clés sont toujours là, même à zéro", () => {
    const week = weekOf({ ...BUNDLED, SESSIONS: [BUNDLED.SESSIONS[1]] }); // Lower A seule
    assert.deepEqual(Object.keys(weeklyVolume(week)).sort(), [...MUSCLE_GROUPS].sort());
    assert.equal(weeklyVolume(week).biceps, 0);
  });
});

describe("stimulationFrequency : le dénominateur de l'assertion 2", () => {
  test("le bundle stimule les bras une fois par semaine, les gros groupes deux", () => {
    const freq = stimulationFrequency(weekOf(BUNDLED));
    assert.equal(freq.dos, 2);
    assert.equal(freq.pectoraux, 2);
    assert.equal(freq.quadriceps, 2);
    assert.equal(freq.ischios_fessiers, 2);
    assert.equal(freq.biceps, 1);
    assert.equal(freq.triceps, 1);
    assert.equal(freq.deltoide_lat, 1);
    assert.equal(freq.deltoide_post, 1);
  });

  test("le programme hérité tient 2 partout", () => {
    for (const [m, n] of Object.entries(stimulationFrequency(weekOf(LEGACY)))) {
      assert.ok(n >= 2, `${m} = ${n}`);
    }
  });
});

describe("hasUnmodelledRows : le trou du registre, pas celui du programme", () => {
  test("le bundle en porte une — le Pallof de coreB", () => {
    assert.equal(hasUnmodelledRows(weekOf(BUNDLED)), true);
  });

  test("une semaine sans gainage anti-mouvement n'en porte pas", () => {
    const program = structuredClone(BUNDLED);
    for (const session of program.SESSIONS) session.core = "coreA"; // crunch, modélisé
    assert.equal(hasUnmodelledRows(weekOf(program)), false);
  });
});
