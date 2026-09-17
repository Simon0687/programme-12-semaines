import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  VOLUME, PRIMARY, LARGE_GROUPS, LEVELS,
  contribution, resolveWeek, weeklyVolume, stimulationFrequency, hasUnmodelledRows,
  targetsFor, assess,
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

describe("targetsFor : la cible de volume et le plafond temporel (§3 étapes 2-3)", () => {
  test("le plafond est celui de la table du §3 : 45/60/75/90 -> 11/16/21/26", () => {
    for (const [duration, cap] of [[45, 11], [60, 16], [75, 21], [90, 26]]) {
      assert.equal(targetsFor({ frequency: 4, duration }).capPerSession, cap, `${duration} min`);
    }
  });

  test("les cibles d'un intermédiaire sans priorité : min + 1, borné au max", () => {
    const t = targetsFor({ frequency: 4, duration: 60 });
    assert.deepEqual(t.volume, {
      dos: 7, pectoraux: 7, quadriceps: 7, ischios_fessiers: 7,
      deltoide_ant: 3, deltoide_lat: 3, deltoide_post: 3,
      biceps: 4, triceps: 4, mollets: 5, abdominaux: 4,
    });
  });

  test("un débutant reste au plancher, un avancé monte de 2 sans dépasser le max", () => {
    assert.equal(targetsFor({ frequency: 4, duration: 60, level: "debutant" }).volume.dos, 6);
    assert.equal(targetsFor({ frequency: 4, duration: 90, level: "avance" }).volume.dos, 8);
    assert.equal(targetsFor({ frequency: 4, duration: 90, level: "avance" }).volume.deltoide_post, 3, "borné au max");
  });

  test("une priorité pousse le groupe en haut de fourchette", () => {
    const t = targetsFor({ frequency: 5, duration: 75, priorities: ["dos"] });
    assert.equal(t.volume.dos, VOLUME.dos.max);
    assert.equal(t.volume.pectoraux, 7, "les autres ne bougent pas");
  });

  test("LEVELS est le vocabulaire fermé des niveaux, et chacun a un bonus", () => {
    for (const level of LEVELS) {
      assert.notEqual(targetsFor({ frequency: 4, duration: 60, level }), null);
    }
  });

  /* Les trois points de contrôle du §5 et du §6 du questionnaire — les seuls
     nombres du dépôt calculés indépendamment de ce code. */
  test("§5 : 4 x 60 min tient dans le plafond, sans aucune réduction", () => {
    const t = targetsFor({ frequency: 4, duration: 60 });
    assert.equal(t.capPerWeek, 64);
    assert.equal(t.needed, 54);
    assert.equal(t.feasible, true);
    assert.deepEqual(t.cascade, []);
    /* Le §5 annonce « 51 séries réelles » : c'est 54 moins les 3 séries de
       deltoïde antérieur que la couverture indirecte rend inutiles à la
       sélection (étape 4). Une cible et une prescription, pas le même
       nombre — ce module ne sélectionne pas. */
    assert.equal(t.needed - t.volume.deltoide_ant, 51);
  });

  test("§5 : 3 x 45 min passe au ras, par la cascade complète", () => {
    const t = targetsFor({ frequency: 3, duration: 45 });
    assert.equal(t.capPerWeek, 33);
    assert.equal(t.feasible, true);
    assert.deepEqual(t.cascade, ["periphery", "isolation-floor", "delt-ant", "large-floor", "frequency-1.5"]);
    assert.equal(t.volume.mollets, 0, "les mollets sautent");
    assert.equal(t.volume.abdominaux, 0, "les abdos sautent");
    assert.equal(t.volume.deltoide_ant, 0, "couvert par les presses");
    assert.ok(t.needed <= 33);
  });

  test("§6 : 2 x 45 min est refusé, 2 x 75 min tient — les deux chiffres du script", () => {
    const refused = targetsFor({ frequency: 2, duration: 45 });
    assert.equal(refused.capPerWeek, 22);
    assert.equal(refused.feasible, false);
    assert.match(refused.message, /22 séries/);
    assert.match(refused.message, /demande \d+/);

    const holds = targetsFor({ frequency: 2, duration: 75 });
    assert.equal(holds.capPerWeek, 42);
    assert.equal(holds.feasible, true);
  });

  test("une étape qui ne coupe rien n'est pas enregistrée", () => {
    const t = targetsFor({ frequency: 3, duration: 45, maintenance: [] });
    assert.ok(!t.cascade.includes("maintenance"), "rien à mettre en maintien");
  });

  test("un groupe en maintien tombe à zéro et l'étape est enregistrée", () => {
    const t = targetsFor({ frequency: 3, duration: 45, maintenance: ["mollets"] });
    assert.equal(t.cascade[0], "maintenance");
    assert.equal(t.volume.mollets, 0);
  });

  test("une priorité traverse la cascade intacte, y compris l'étape 1,5x", () => {
    const t = targetsFor({ frequency: 3, duration: 45, priorities: ["dos"] });
    assert.equal(t.volume.dos, VOLUME.dos.max, "le groupe prioritaire garde sa cible");
    /* Les autres ne s'arrêtent pas au plancher : la dernière étape descend
       sous le minimum, c'est ce que veut dire « une séance sur deux ». */
    assert.ok(t.volume.pectoraux < VOLUME.pectoraux.min, `pectoraux = ${t.volume.pectoraux}`);
    assert.ok(t.cascade.includes("frequency-1.5"));
  });

  test("entrée absurde -> null, comme resolveWeek", () => {
    assert.equal(targetsFor(), null);
    assert.equal(targetsFor({ frequency: 4 }), null);
    assert.equal(targetsFor({ frequency: "quatre", duration: 60 }), null);
    assert.equal(targetsFor({ frequency: 4, duration: 10 }), null, "10 min, c'est l'échauffement seul");
  });
});

describe("targetsFor : les 20 combinaisons fréquence x durée (§7)", () => {
  const FREQUENCIES = [2, 3, 4, 5, 6];
  const DURATIONS = [45, 60, 75, 90];

  test("les 20 rendent une table complète et un verdict de faisabilité", () => {
    for (const frequency of FREQUENCIES) {
      for (const duration of DURATIONS) {
        const t = targetsFor({ frequency, duration });
        const label = `${frequency} x ${duration} min`;
        assert.notEqual(t, null, label);
        assert.deepEqual(Object.keys(t.volume).sort(), [...MUSCLE_GROUPS].sort(), label);
        assert.equal(typeof t.feasible, "boolean", label);
        if (t.feasible) assert.ok(t.needed <= t.capPerWeek, `${label} : ${t.needed} > ${t.capPerWeek}`);
        else assert.ok(t.message.length > 0, label);
      }
    }
  });

  test("une seule combinaison est infaisable : 2 séances de 45 min", () => {
    const infeasible = [];
    for (const frequency of FREQUENCIES) {
      for (const duration of DURATIONS) {
        if (!targetsFor({ frequency, duration }).feasible) infeasible.push(`${frequency}x${duration}`);
      }
    }
    assert.deepEqual(infeasible, ["2x45"]);
  });

  test("plus de budget ne demande jamais plus de réductions", () => {
    for (const frequency of FREQUENCIES) {
      const lengths = DURATIONS.map((duration) => targetsFor({ frequency, duration }).cascade.length);
      assert.deepEqual(lengths, [...lengths].sort((a, b) => b - a), `fréquence ${frequency} : ${lengths}`);
    }
  });
});

describe("assess : la forme du verdict", () => {
  const codes = (verdict) => verdict.findings.map((f) => f.code);

  test("un programme illisible rend un verdict, jamais un jeté", () => {
    for (const bad of [null, 42, "programme", [], {}, { SLOTS: {} }]) {
      const verdict = assess(bad);
      assert.equal(verdict.ok, false);
      assert.deepEqual(codes(verdict), ["unreadable-program"]);
    }
  });

  test("aucun message ne renvoie au code source", () => {
    for (const program of [BUNDLED, LEGACY]) {
      for (const f of assess(program).findings) {
        assert.doesNotMatch(f.message, /\.js|src\/|function|undefined|null/, f.message);
      }
    }
  });

  test("chaque finding porte un code et le bloc où il a été vu", () => {
    for (const f of assess(LEGACY).findings) {
      assert.equal(typeof f.code, "string");
      assert.ok(["b1", "b2", "both"].includes(f.block), f.block);
    }
  });

  test("un avis vrai des deux blocs n'est donné qu'une fois", () => {
    const verdict = assess(LEGACY);
    const dup = verdict.findings.filter((f) => f.code === "duplicate-pattern");
    assert.equal(dup.length, 1, "un seul, pas un par bloc");
    assert.equal(dup[0].block, "both");
  });

  test("un avis propre à un bloc garde son bloc", () => {
    const program = structuredClone(BUNDLED);
    program.SLOTS.pulldown.b2 = "dc"; // b2 seul : deux poussées horizontales en Upper A
    const verdict = assess(program);
    const dup = verdict.findings.filter((f) => f.code === "duplicate-pattern");
    assert.equal(dup.length, 1);
    assert.equal(dup[0].block, "b2");
  });
});

describe("assertion 3 — aucun schéma moteur dupliqué dans une séance", () => {
  test("le bundle n'en duplique aucun", () => {
    assert.deepEqual(assess(BUNDLED).findings.filter((f) => f.code === "duplicate-pattern"), []);
  });

  /* Le vrai signalement du dépôt, et le meilleur argument pour « il
     conseille, il ne bloque jamais » : couché + incliné dans la même
     séance est un choix standard et assumé. Si ce test devient vert sans
     que le programme change, l'assertion a cessé de fonctionner. */
  test("le programme hérité en duplique un : Haut A enchaîne deux poussées horizontales", () => {
    const dup = assess(LEGACY).findings.filter((f) => f.code === "duplicate-pattern");
    assert.equal(dup.length, 1);
    assert.equal(dup[0].sessionId, "hautA");
    assert.equal(dup[0].pattern, "poussee_horizontale");
    assert.match(dup[0].message, /Haut A/);
    assert.match(dup[0].message, /poussée horizontale/);
    assert.match(dup[0].message, /Développé couché barre/);
  });

  test("les lignes hors taxonomie ne se dupliquent pas entre elles", () => {
    const program = structuredClone(BUNDLED);
    program.CORE.coreB.ex = [["pallof", 1], ["pallof", 1]];
    const dup = assess(program).findings.filter((f) => f.code === "duplicate-pattern");
    assert.deepEqual(dup, [], "pallof n'a pas de pattern : rien à dupliquer");
  });
});

describe("assertion 4 — 48 h entre deux sollicitations primaires d'un gros groupe", () => {
  test("les deux programmes livrés espacent correctement", () => {
    for (const program of [BUNDLED, LEGACY]) {
      assert.deepEqual(assess(program).findings.filter((f) => f.code === "insufficient-recovery"), []);
    }
  });

  test("deux séances de dos à un jour d'écart sont signalées", () => {
    const program = structuredClone(BUNDLED);
    program.SESSIONS[2].day = 2; // Upper B passe du jeudi au mardi, au lendemain d'Upper A
    const found = assess(program).findings.filter((f) => f.code === "insufficient-recovery");
    assert.ok(found.some((f) => f.muscle === "dos"), found.map((f) => f.muscle).join(", "));
    assert.match(found[0].message, /24 h d'intervalle/);
    assert.match(found[0].message, /au moins 48 h/);
  });

  test("la semaine est circulaire : dimanche et lundi sont à 24 h", () => {
    const program = structuredClone(BUNDLED);
    program.SESSIONS[2].day = 7; // Upper B le dimanche, Upper A le lundi
    const found = assess(program).findings.filter((f) => f.code === "insufficient-recovery");
    assert.ok(found.some((f) => f.muscle === "pectoraux"));
    assert.match(found.find((f) => f.muscle === "pectoraux").message, /24 h/);
  });

  test("48 h pile ne se signale pas", () => {
    const program = structuredClone(BUNDLED);
    program.SESSIONS[2].day = 3; // Upper A lundi, Upper B mercredi
    assert.deepEqual(assess(program).findings.filter((f) => f.code === "insufficient-recovery"), []);
  });

  test("une contribution sous le seuil primaire ne compte pas comme sollicitation", () => {
    /* Hack squat apporte 0,35 aux ischios : deux jours de suite, ce n'est
       pas deux sollicitations primaires. */
    const program = structuredClone(BUNDLED);
    program.SESSIONS = program.SESSIONS.filter((s) => s.id.startsWith("lower"));
    program.SESSIONS[0].day = 1;
    program.SESSIONS[1].day = 2;
    program.SESSIONS[1].ex = [["quad2", 3]]; // presse seule : 0,35 ischios, 0,65 quadriceps
    const found = assess(program).findings.filter((f) => f.code === "insufficient-recovery");
    assert.ok(found.some((f) => f.muscle === "quadriceps"), "les quadriceps, eux, sont primaires des deux côtés");
    assert.ok(!found.some((f) => f.muscle === "ischios_fessiers"), "pas les ischios");
  });

  test("une séance sans jour lisible est sautée au lieu de tout perdre", () => {
    const program = structuredClone(BUNDLED);
    program.SESSIONS[2].day = null;
    const verdict = assess(program);
    assert.notEqual(verdict.findings[0]?.code, "unreadable-program");
    assert.deepEqual(verdict.findings.filter((f) => f.code === "insufficient-recovery"), []);
  });
});

describe("sans intention déclarée : trois assertions se taisent, et le disent", () => {
  test("le manque d'intention est un finding, pas un silence", () => {
    const verdict = assess(BUNDLED);
    const skip = verdict.findings.filter((f) => f.code === "no-declared-intent");
    assert.equal(skip.length, 1);
    assert.match(skip[0].message, /volume par muscle/);
    assert.match(skip[0].message, /durée/);
  });

  test("aucune assertion à cibles ne tourne sans cibles", () => {
    const codes = assess(BUNDLED).findings.map((f) => f.code);
    for (const code of ["volume-out-of-range", "frequency-below-floor", "duration-over-budget"]) {
      assert.ok(!codes.includes(code), code);
    }
  });

  test("les deux assertions structurelles tournent quand même", () => {
    const codes = assess(LEGACY).findings.map((f) => f.code);
    assert.ok(codes.includes("duplicate-pattern"), "l'assertion 3 ne dépend d'aucune cible");
  });

  test("des cibles incomplètes valent des cibles absentes", () => {
    for (const bad of [{}, { volume: {} }, { duration: 60 }, { volume: null, duration: 60 }]) {
      const codes = assess(BUNDLED, bad).findings.map((f) => f.code);
      assert.ok(codes.includes("no-declared-intent"), JSON.stringify(bad));
    }
  });
});

describe("assertion 1 — volume par muscle dans les fourchettes", () => {
  const targets = targetsFor({ frequency: 4, duration: 60 });

  test("le bundle dépasse sur les ischios, et sur eux seuls", () => {
    const found = assess(BUNDLED, targets).findings.filter((f) => f.code === "volume-out-of-range");
    assert.deepEqual(found.map((f) => f.muscle), ["ischios_fessiers"]);
    assert.match(found[0].message, /10,5 séries/);
    assert.match(found[0].message, /fourchette de 6 à 10/);
  });

  test("le deltoïde antérieur ne se signale jamais en excès : c'est la règle, pas un écart", () => {
    assert.equal(weeklyVolume(weekOf(BUNDLED)).deltoide_ant, 5.5);
    assert.ok(5.5 > VOLUME.deltoide_ant.max, "au-dessus de la fourchette");
    const found = assess(BUNDLED, targets).findings.filter((f) => f.muscle === "deltoide_ant");
    assert.deepEqual(found, []);
  });

  test("le programme hérité dépasse sur les abdos et le deltoïde postérieur", () => {
    const found = assess(LEGACY, targetsFor({ frequency: 5, duration: 60 }))
      .findings.filter((f) => f.code === "volume-out-of-range");
    assert.deepEqual(found.map((f) => f.muscle).sort(), ["abdominaux", "deltoide_post"]);
  });

  test("le message explique le comptage du groupe, pas celui d'un autre", () => {
    const found = assess(LEGACY, targetsFor({ frequency: 5, duration: 60 }))
      .findings.filter((f) => f.code === "volume-out-of-range");
    const abs = found.find((f) => f.muscle === "abdominaux");
    assert.match(abs.message, /seules les séries directes/, "abdominaux est un groupe direct");
    assert.doesNotMatch(abs.message, /indirectes comptent pour moitié/);
  });

  test("un manque est signalé sous la cible, tolérance d'une série", () => {
    const program = structuredClone(BUNDLED);
    program.SESSIONS[0].ex = program.SESSIONS[0].ex.filter(([slot]) => slot !== "pulldown");
    program.SESSIONS[2].ex = program.SESSIONS[2].ex.filter(([slot]) => slot !== "row");
    const found = assess(program, targets).findings.filter((f) => f.code === "volume-out-of-range");
    assert.ok(found.some((f) => f.muscle === "dos"), found.map((f) => f.muscle).join(", "));
    assert.match(found.find((f) => f.muscle === "dos").message, /sous-entraîné/);
  });

  test("la cascade abaisse le plancher : un volume réduit reste justifié", () => {
    /* 3 x 45 min : la cascade met mollets et abdos à zéro. Un programme qui
       n'en fait pas ne doit rien se voir reprocher. */
    const reduced = targetsFor({ frequency: 3, duration: 45 });
    assert.equal(reduced.volume.mollets, 0);
    const program = structuredClone(BUNDLED);
    for (const s of program.SESSIONS) s.ex = s.ex.filter(([slot]) => !slot.startsWith("calf"));
    const found = assess(program, reduced).findings.filter((f) => f.muscle === "mollets");
    assert.deepEqual(found, []);
  });

  test("les abdos ne se signalent pas en manque quand le gainage échappe au registre", () => {
    const program = structuredClone(BUNDLED);
    for (const s of program.SESSIONS) s.core = "coreB"; // pallof partout : abdos comptés à 0
    assert.equal(weeklyVolume(weekOf(program)).abdominaux, 0);
    const found = assess(program, targets).findings.filter((f) => f.muscle === "abdominaux");
    assert.deepEqual(found, [], "le trou est celui du registre, pas celui du programme");
  });

  test("mais un excès d'abdos reste signalé, gainage ou pas", () => {
    const program = structuredClone(BUNDLED);
    program.CORE.coreA.ex = [["crunch", 8]];
    const found = assess(program, targets).findings.filter((f) => f.muscle === "abdominaux");
    assert.equal(found.length, 1);
  });
});

describe("assertion 2 — fréquence de stimulation >= 1,5", () => {
  test("le bundle touche quatre groupes une seule fois par semaine", () => {
    const found = assess(BUNDLED, targetsFor({ frequency: 4, duration: 60 }))
      .findings.filter((f) => f.code === "frequency-below-floor");
    assert.deepEqual(found.map((f) => f.muscle).sort(), ["biceps", "deltoide_lat", "deltoide_post", "triceps"]);
  });

  test("le programme hérité tient partout", () => {
    const found = assess(LEGACY, targetsFor({ frequency: 5, duration: 60 }))
      .findings.filter((f) => f.code === "frequency-below-floor");
    assert.deepEqual(found, []);
  });

  test("un muscle écarté par la cascade n'a pas de fréquence à tenir", () => {
    const reduced = targetsFor({ frequency: 3, duration: 45 });
    assert.equal(reduced.volume.mollets, 0);
    const program = structuredClone(BUNDLED);
    for (const s of program.SESSIONS) s.ex = s.ex.filter(([slot]) => !slot.startsWith("calf"));
    const found = assess(program, reduced).findings.filter((f) => f.muscle === "mollets");
    assert.deepEqual(found, []);
  });
});

describe("assertion 5 — durée estimée <= durée demandée", () => {
  test("les quatre séances du bundle tiennent dans 60 min", () => {
    const found = assess(BUNDLED, targetsFor({ frequency: 4, duration: 60 }))
      .findings.filter((f) => f.code === "duration-over-budget");
    assert.deepEqual(found, []);
  });

  test("Haut C dépasse 60 min : 18 séries, soit 64 min", () => {
    const found = assess(LEGACY, targetsFor({ frequency: 5, duration: 60 }))
      .findings.filter((f) => f.code === "duration-over-budget");
    assert.equal(found.length, 1);
    assert.equal(found[0].sessionId, "hautC");
    assert.match(found[0].message, /64 min/);
    assert.match(found[0].message, /demandée à 60 min/);
  });

  test("le modèle est celui du plafond, à l'envers : 10 min + 3 min par série", () => {
    const t = targetsFor({ frequency: 4, duration: 60 });
    /* Une séance au plafond pile ne dépasse pas ; une série de plus, si. */
    const program = structuredClone(BUNDLED);
    program.CORE.coreA.ex = [];
    program.SESSIONS[0].core = "coreA";
    program.SESSIONS[0].ex = [["press", t.capPerSession]];
    assert.deepEqual(
      assess(program, t).findings.filter((f) => f.sessionId === "upperA" && f.code === "duration-over-budget"),
      [], `${t.capPerSession} séries tiennent dans ${t.duration} min`,
    );
    program.SESSIONS[0].ex = [["press", t.capPerSession + 1]];
    assert.equal(
      assess(program, t).findings.filter((f) => f.sessionId === "upperA" && f.code === "duration-over-budget").length,
      1,
    );
  });

  test("les séries de gainage comptent dans la durée, elles aussi", () => {
    const t = targetsFor({ frequency: 4, duration: 60 });
    const program = structuredClone(BUNDLED);
    program.CORE.coreB.ex = [["pallof", 6]]; // Upper A passe de 15 à 20 séries
    const found = assess(program, t).findings.filter((f) => f.code === "duration-over-budget");
    assert.ok(found.some((f) => f.sessionId === "upperA"));
  });
});
