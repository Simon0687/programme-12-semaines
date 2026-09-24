import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  REJECTIONS, isLogRow, sanitizeJournal, unusableProgramIds,
  validateDefinition, validateEnvelope, validatePreMigration, validateProgram, validateProgramEntry,
} from "../src/journal-shape.js";
import { readFileSync } from "node:fs";
import { LEGACY_DEFINITION, LEGACY_DEFINITION as BASE } from "../src/legacy-program.js";
import { DEFAULT_DEFINITION as NEUTRAL } from "../src/default-program.js";
import { dateForSlot } from "../src/schema.js";
import { AFTER_KINDS } from "../src/cardio.js";

const entry = (over = {}) => ({ definition: LEGACY_DEFINITION, logs: {}, cardio: {}, checkin: {}, ...over });
const row = (over = {}) => ({ id: "r", date: "2026-09-07", slot: "hautA", ex: {}, done: true, ...over });

/* Programmes dérivés du programme hérité, pour les contrôles par champ (#33).
   Déclarés ici plutôt qu'à leur section : la liste absurd du dernier describe
   les utilise, et ne pas dépendre de l'ordre d'exécution des suites tient mieux. */
const prog = (mut) => { const d = JSON.parse(JSON.stringify(BASE)); mut(d.program); return d.program; };
const firstSlot = () => Object.keys(BASE.program.SLOTS)[0];
const firstCore = () => Object.keys(BASE.program.CORE)[0];

describe("validateEnvelope", () => {
  test("accepte une enveloppe complète", () => {
    assert.equal(validateEnvelope({ activeProgramId: "p1", programs: { p1: entry() } }), null);
  });

  for (const [label, journal] of [
    ["null", null],
    ["tableau", []],
    ["chaîne", "journal"],
    ["sans activeProgramId", { programs: {} }],
    ["activeProgramId vide", { activeProgramId: "", programs: {} }],
    ["programs absent", { activeProgramId: "p1" }],
    ["programs null", { activeProgramId: "p1", programs: null }],
    ["programs tableau", { activeProgramId: "p1", programs: [] }],
    ["entrée non-objet", { activeProgramId: "p1", programs: { p1: 42 } }],
    ["actif introuvable", { activeProgramId: "absent", programs: { p1: entry() } }],
    ["actif sans définition", { activeProgramId: "p1", programs: { p1: { logs: {}, cardio: {}, checkin: {} } } }],
    ["actif avec logs null", { activeProgramId: "p1", programs: { p1: entry({ logs: null }) } }],
    ["actif avec cardio nombre", { activeProgramId: "p1", programs: { p1: entry({ cardio: 42 }) } }],
  ]) {
    test(`rejette : ${label}`, () => {
      const bad = validateEnvelope(journal);
      assert.ok(bad, `accepté à tort : ${label}`);
      assert.ok(bad.message, "un rejet doit porter un message affichable");
    });
  }

  test("ne juge pas un cycle inactif mal formé", () => {
    assert.equal(validateEnvelope({ activeProgramId: "p1", programs: { p1: entry(), p2: { definition: { id: "p2" } } } }), null);
  });
});

describe("validatePreMigration", () => {
  test("accepte un journal v1 plat (logs seuls, sans version)", () => {
    assert.equal(validatePreMigration({ logs: {}, cardio: {}, checkin: {} }), null);
  });

  test("accepte une enveloppe versionnée", () => {
    assert.equal(validatePreMigration({ schemaVersion: 4, programs: {} }), null);
  });

  test("refuse des programmes sans numéro de version, au lieu de les aplatir", () => {
    /* versionOf() lirait « v1 », MIGRATIONS[1] reconstruirait le journal
       depuis .logs seul et les cycles disparaîtraient sans un mot. */
    assert.ok(validatePreMigration({ programs: { p1: entry() }, logs: {} }));
    assert.ok(validatePreMigration({ programs: { p1: entry() }, schemaVersion: "4" }));
  });
});

describe("isLogRow", () => {
  test("accepte une ligne datée, même sans les champs de synchronisation", () => {
    assert.equal(isLogRow({ date: "2026-09-07", slot: "hautA" }), true);
    assert.equal(isLogRow(row()), true);
  });

  test("#55 : sub absent, vide ou peuplé — les trois passent", () => {
    /* Un journal d'avant #55 ne porte pas le champ, et "absent" s'y lit
       "aucune substitution" : c'est exactement ce qui s'est passé. */
    assert.equal(isLogRow({ date: "2026-09-07", slot: "hautA" }), true);
    assert.equal(isLogRow({ date: "2026-09-07", slot: "hautA", sub: {} }), true);
    assert.equal(isLogRow({ date: "2026-09-07", slot: "hautA", sub: { dc: "dc_db" } }), true);
    /* Les valeurs ne sont pas vérifiées contre le registre : vidFor() retombe
       sur le prescrit, et une ligne n'a pas à perdre ses séries pour ça. */
    assert.equal(isLogRow({ date: "2026-09-07", slot: "hautA", sub: { dc: "nexiste-pas" } }), true);
  });

  for (const [label, value] of [
    ["null", null],
    ["nombre", 42],
    ["tableau", []],
    ["sans date", { slot: "hautA" }],
    ["date non ISO", { date: "07/09/2026", slot: "hautA" }],
    ["date vide", { date: "", slot: "hautA" }],
    ["sans slot", { date: "2026-09-07" }],
    ["slot vide", { date: "2026-09-07", slot: "" }],
    ["ex non-objet", { date: "2026-09-07", slot: "hautA", ex: 3 }],
    /* #55 : `sub` est jugé sur sa forme, et sur rien d'autre — voir
       l'en-tête d'isLogRow. */
    ["sub chaîne", { date: "2026-09-07", slot: "hautA", sub: "dc_db" }],
    ["sub tableau", { date: "2026-09-07", slot: "hautA", sub: ["dc_db"] }],
  ]) {
    test(`rejette : ${label}`, () => assert.equal(isLogRow(value), false));
  }
});

describe("sanitizeJournal", () => {
  test("garde les lignes lisibles, compte les autres", () => {
    const good = row();
    const { journal, dropped } = sanitizeJournal({
      activeProgramId: "p1",
      programs: { p1: entry({ logs: { r: good, x: 42, y: { slot: "hautA" } } }) },
    });
    assert.equal(dropped, 2);
    assert.deepEqual(journal.programs.p1.logs, { r: good });
  });

  test("un journal sain traverse sans rien perdre, et sans recopier l'entrée", () => {
    const source = { activeProgramId: "p1", programs: { p1: entry({ logs: { r: row() } }) } };
    const { journal, dropped } = sanitizeJournal(source);
    assert.equal(dropped, 0);
    assert.equal(journal.programs.p1, source.programs.p1, "aucune copie inutile quand rien n'est écarté");
  });

  test("ne touche pas à cardio ni à checkin", () => {
    const cardio = { w1: { z2: { done: true } } };
    const { journal } = sanitizeJournal({ activeProgramId: "p1", programs: { p1: entry({ cardio, logs: { x: null } }) } });
    assert.deepEqual(journal.programs.p1.cardio, cardio);
  });
});

describe("unusableProgramIds", () => {
  test("nomme les cycles mal formés et ceux dont la définition est refusée", () => {
    const programs = {
      bon: entry(),
      pasUnObjet: null,
      sansLogs: { definition: LEGACY_DEFINITION, cardio: {}, checkin: {} },
      definitionRefusee: entry({ definition: { id: "x" } }),
    };
    assert.deepEqual(unusableProgramIds(programs).sort(), ["definitionRefusee", "pasUnObjet", "sansLogs"]);
  });

  test("rend [] plutôt que de lever sur une entrée absurde", () => {
    assert.deepEqual(unusableProgramIds(null), []);
    assert.deepEqual(unusableProgramIds("texte"), []);
  });
});

/* L'invariant du module : aucune entrée, si absurde soit-elle, ne doit
   produire une exception. C'est ce qui permet à loadJournal() de rendre un
   verdict sans try/catch, donc à l'appli de ne jamais rester bloquée sur son
   spinner. */
describe("aucune fonction ne lève, pour aucune entrée", () => {
  const absurd = [
    undefined, null, 0, -1, NaN, "", "texte", true, false, [], [[]], {},
    { programs: 1 }, { programs: { p: [] } }, { activeProgramId: {}, programs: {} },
    { definition: [] }, { logs: [] }, { SLOTS: [] },
    new Date(),
  ];

  for (const fn of [validateEnvelope, validatePreMigration, validateProgramEntry, validateDefinition, validateProgram, isLogRow, unusableProgramIds]) {
    test(`${fn.name} : rend un verdict sur n'importe quoi`, () => {
      for (const value of absurd) {
        assert.doesNotThrow(() => fn(value), `${fn.name} a levé sur ${String(value)}`);
      }
    });
  }

  test("sanitizeJournal : rend un journal et un compte sur une enveloppe déjà validée", () => {
    for (const programs of [{}, { p: entry() }, { p: entry({ logs: { x: null } }) }]) {
      assert.doesNotThrow(() => sanitizeJournal({ activeProgramId: "p", programs }));
    }
  });
});

/* --------------------------------------------------------------
   #33 : contrôles par champ du program.
   -------------------------------------------------------------- */



describe("validateProgram : paires [slot, séries] (#33)", () => {
  for (const [label, mut] of [
    ["session.ex = [42]", (p) => { p.SESSIONS[0].ex = [42]; }],
    ["session.ex = [null]", (p) => { p.SESSIONS[0].ex = [null]; }],
    ['session.ex = ["dc"] (un seul élément)', (p) => { p.SESSIONS[0].ex = [["dc"]]; }],
    ["core.ex = [42]", (p) => { p.CORE[firstCore()].ex = [42]; }],
    ["séries = -3", (p) => { p.SESSIONS[0].ex[0] = [p.SESSIONS[0].ex[0][0], -3]; }],
    ['séries = "trois"', (p) => { p.SESSIONS[0].ex[0] = [p.SESSIONS[0].ex[0][0], "trois"]; }],
    ["séries = 0", (p) => { p.SESSIONS[0].ex[0] = [p.SESSIONS[0].ex[0][0], 0]; }],
    ["séries = 2.5", (p) => { p.SESSIONS[0].ex[0] = [p.SESSIONS[0].ex[0][0], 2.5]; }],
  ]) {
    test(`rejette sans lever : ${label}`, () => {
      let bad;
      assert.doesNotThrow(() => { bad = validateProgram(prog(mut)); }, `${label} a levé`);
      assert.ok(bad, `${label} accepté à tort`);
      assert.ok(bad.message);
    });
  }

  test("un slot inconnu garde son message d'origine (#25)", () => {
    const bad = validateProgram(prog((p) => { p.SESSIONS[0].ex[0] = ["inconnu", 3]; }));
    assert.equal(bad.reason, "invalid-program");
    assert.match(bad.message, /n'est pas un slot de program\.SLOTS/);
  });

  test("les deux programmes livrés passent", () => {
    assert.equal(validateProgram(BASE.program), null);
  });
});

/* Une séance sans exercice (#36). Le trou vient de l'éditeur — un écran
   neuf enregistré tout de suite — mais un fichier importé peut le porter
   aussi, et c'est le même refus : l'appli n'a rien à exécuter, et l'écran
   Semaine résume chaque séance par son premier exercice. */
describe("validateProgram : une séance porte au moins un exercice (#36)", () => {
  test("refuse une séance vide, en la nommant", () => {
    const bad = validateProgram(prog((p) => { p.SESSIONS[0].ex = []; }));
    assert.equal(bad.reason, "invalid-program");
    assert.match(bad.message, /aucun exercice/);
    assert.match(bad.message, new RegExp(BASE.program.SESSIONS[0].name));
  });

  test("sans nom exploitable, le refus donne l'adresse de la séance", () => {
    const bad = validateProgram(prog((p) => { p.SESSIONS[1].ex = []; delete p.SESSIONS[1].name; }));
    assert.ok(bad.message.startsWith("program.SESSIONS[1] ne porte aucun exercice"), bad.message);
  });

  test("un bloc de gainage vide reste accepté : c'est « pas de gainage », pas un trou", () => {
    assert.equal(validateProgram(prog((p) => { p.CORE[firstCore()].ex = []; })), null);
  });
});

describe("validateProgram : jour de séance (#33)", () => {
  for (const [label, value] of [
    ["absent", undefined],
    ['"lundi"', "lundi"],
    ["99", 99],
    ["0", 0],
    ["-1", -1],
    ["2.5", 2.5],
    ["null", null],
  ]) {
    test(`rejette day ${label}`, () => {
      const p = prog((x) => { if (value === undefined) delete x.SESSIONS[0].day; else x.SESSIONS[0].day = value; });
      const bad = validateProgram(p);
      assert.ok(bad, `day ${label} accepté à tort`);
      assert.match(bad.message, /day/);
    });
  }

  test("accepte day 7 : la date produite est juste, seul l affichage du jour ne suit pas", () => {
    assert.equal(validateProgram(prog((x) => { x.SESSIONS[0].day = 7; })), null);
  });

  /* La propriété qui compte, et qui ne se périme pas quand un champ
     s'ajoute : aucun programme accepté ne peut produire une date NaN. */
  test("aucun programme accepté ne peut dater une séance en NaN", () => {
    for (const definition of [BASE, NEUTRAL]) {
      assert.equal(validateProgram(definition.program), null);
      for (let week = 1; week <= definition.weeks; week++) {
        for (const session of definition.program.SESSIONS) {
          const iso = dateForSlot(definition.startDate, week, session.day);
          assert.ok(!iso.includes("NaN"), `${definition.id} S${week} ${session.id} -> ${iso}`);
        }
      }
    }
  });
});

describe("validateProgram : fourchettes et unicité (#33)", () => {
  for (const [label, reps] of [
    ["inversée [8, 5]", [8, 5]],
    ["négative [-5, -1]", [-5, -1]],
    ["min nul [0, 5]", [0, 5]],
  ]) {
    test(`rejette une fourchette ${label}`, () => {
      const bad = validateProgram(prog((p) => { p.SLOTS[firstSlot()].reps = reps; }));
      assert.ok(bad, `${label} accepté à tort`);
      assert.match(bad.message, /reps/);
    });
  }

  test("accepte une fourchette d'une seule valeur [5, 5]", () => {
    assert.equal(validateProgram(prog((p) => { p.SLOTS[firstSlot()].reps = [5, 5]; })), null);
  });

  test("rejette deux séances qui partagent un id", () => {
    const bad = validateProgram(prog((p) => { p.SESSIONS[1].id = p.SESSIONS[0].id; }));
    assert.ok(bad);
    assert.match(bad.message, /id/);
  });
});

describe("validateDefinition : startingLoads (#33)", () => {
  test("rejette un startingLoads qui n'est pas un objet", () => {
    for (const value of [5, "beaucoup", true]) {
      const bad = validateDefinition({ ...BASE, startingLoads: value });
      assert.ok(bad, `startingLoads ${JSON.stringify(value)} accepté à tort`);
    }
  });

  test("accepte un startingLoads vide", () => {
    assert.equal(validateDefinition({ ...BASE, startingLoads: {} }), null);
  });
});

describe("validateProgram : indice post-séance (#33)", () => {
  test("rejette un after que l'appli ne sait pas rendre", () => {
    const bad = validateProgram(prog((p) => { p.SESSIONS[0].after = "n_importe_quoi"; }));
    assert.ok(bad, "after inconnu accepté à tort");
    assert.match(bad.message, /after/);
  });

  test("accepte un after absent, et chacun des indices connus", () => {
    assert.equal(validateProgram(prog((p) => { delete p.SESSIONS[0].after; })), null);
    for (const kind of AFTER_KINDS) {
      assert.equal(validateProgram(prog((p) => { p.SESSIONS[0].after = kind; })), null, kind);
    }
  });
});

/* ---------- La structure de conditionnement (#34) ----------

   Le champ acceptait deux valeurs et rien d'autre ; il accepte désormais une
   structure, et ce qui la rend sûre est la fermeture que #25 a posée sur les
   exercices. Ces cas tiennent les deux bouts : ce qui doit continuer de
   passer, et ce qui doit être refusé **à l'import** plutôt que rendu. */
describe("validateProgram : cardio (#34)", () => {
  const withCardio = (cardio) => prog((p) => { p.cardio = cardio; });
  const ok = { sessions: [{ id: "z2", modality: "rameur", kind: "z2", day: 3 }] };

  test("les deux anciennes valeurs restent valides", () => {
    assert.equal(validateProgram(withCardio("default")), null);
    assert.equal(validateProgram(withCardio(null)), null);
    assert.equal(validateProgram(prog((p) => { delete p.cardio; })), null, "un fichier d'avant #34 n'a pas le champ");
  });

  test("une structure complète passe, mobilité comprise", () => {
    assert.equal(validateProgram(withCardio({ ...ok, mobility: { days: [2, 4, 7] } })), null);
  });

  test("une modalité inventée est refusée, et la liste des modalités est dite", () => {
    const bad = validateProgram(withCardio({ sessions: [{ id: "z2", modality: "trottinette", kind: "z2", day: 3 }] }));
    assert.equal(bad.reason, "unknown-cardio-rule");
    assert.match(bad.message, /trottinette/);
    assert.match(bad.message, /rameur/, "le message nomme ce qui est attendu, sans renvoyer au code");
  });

  test("un genre inventé est refusé", () => {
    const bad = validateProgram(withCardio({ sessions: [{ id: "x", modality: "rameur", kind: "fartlek", day: 3 }] }));
    assert.equal(bad.reason, "unknown-cardio-rule");
    assert.match(bad.message, /fartlek/);
  });

  test("une ancre pendante est refusée à l'import, pas rendue telle quelle", () => {
    /* « après Haut B » sous un programme qui n'a pas de Haut B : c'est le cas
       que la spec demandait de refuser, et c'est pour ça que l'ancre est un
       identifiant de séance et non du texte libre. */
    const bad = validateProgram(withCardio({ sessions: [{ id: "z2", modality: "rameur", kind: "z2", day: 3, anchor: "seanceQuiNexistePas" }] }));
    assert.equal(bad.reason, "invalid-program");
    assert.match(bad.message, /anchor/);
  });

  test("une ancre qui désigne une vraie séance passe", () => {
    const p = prog((x) => { x.cardio = { sessions: [{ id: "z2", modality: "rameur", kind: "z2", day: 3, anchor: x.SESSIONS[0].id }] }; });
    assert.equal(validateProgram(p), null);
  });

  test("un jour hors de 1-7 est refusé, sous les deux bouts de la plage", () => {
    /* La même plage que `SESSIONS[].day` : depuis #39 il n'y a plus qu'une
       convention, un décalage depuis startDate, et 0 n'en fait pas partie. */
    for (const day of [0, 8, 3.5, "mercredi", undefined]) {
      const bad = validateProgram(withCardio({ sessions: [{ id: "z2", modality: "rameur", kind: "z2", day }] }));
      assert.ok(bad, `day ${JSON.stringify(day)} accepté à tort`);
    }
    for (const d of [0, 8]) {
      assert.ok(validateProgram(withCardio({ ...ok, mobility: { days: [d] } })), `mobility.days ${d} accepté à tort`);
    }
  });

  test("deux séances du même genre ne peuvent pas être sur deux appareils", () => {
    /* `cardioPlan(w).z2` est une phrase unique : deux modalités en Z2
       n'auraient pas de prescription à partager. Dit ici plutôt que deviné à
       la résolution. */
    const bad = validateProgram(withCardio({
      sessions: [
        { id: "a", modality: "rameur", kind: "z2", day: 3 },
        { id: "b", modality: "course", kind: "z2", day: 7 },
      ],
    }));
    assert.equal(bad.reason, "invalid-program");
    assert.match(bad.message, /modalité/);
  });

  test("deux genres différents peuvent l'être", () => {
    assert.equal(validateProgram(withCardio({
      sessions: [
        { id: "a", modality: "rameur", kind: "z2", day: 3 },
        { id: "b", modality: "course", kind: "intervals", day: 5 },
      ],
    })), null);
  });

  test("un identifiant en double est refusé", () => {
    const bad = validateProgram(withCardio({
      sessions: [
        { id: "z2", modality: "rameur", kind: "z2", day: 3 },
        { id: "z2", modality: "rameur", kind: "z2", day: 7 },
      ],
    }));
    assert.ok(bad);
    assert.match(bad.message, /unique/);
  });

  test("une forme qui n'est ni objet ni valeur connue ne lève pas, elle rend un verdict", () => {
    for (const value of [42, true, [], "maison", { sessions: "trois" }]) {
      const bad = validateProgram(withCardio(value));
      assert.ok(bad, `cardio ${JSON.stringify(value)} accepté à tort`);
      assert.equal(typeof bad.message, "string");
    }
  });
});

describe("validateDefinition : cardioBaseline (#34)", () => {
  test("absent, vide, ou partiel : tous valides", () => {
    assert.equal(validateDefinition({ ...BASE, cardioBaseline: undefined }), null);
    assert.equal(validateDefinition({ ...BASE, cardioBaseline: {} }), null);
    assert.equal(validateDefinition({ ...BASE, cardioBaseline: { hr: [130, 140] } }), null);
  });

  test("une cible inconnue est refusée, et la liste est dite", () => {
    const bad = validateDefinition({ ...BASE, cardioBaseline: { vo2max: [50, 55] } });
    assert.equal(bad.reason, "invalid-field");
    assert.match(bad.message, /vo2max/);
    assert.match(bad.message, /power/);
  });

  test("une cible doit porter deux nombres, borne basse puis haute", () => {
    for (const v of [110, "105-115", [105], ["a", "b"], null]) {
      const bad = validateDefinition({ ...BASE, cardioBaseline: { power: v } });
      assert.ok(bad, `power ${JSON.stringify(v)} accepté à tort`);
    }
  });

  test("le fichier de Simon, qui en porte un, passe le validateur", () => {
    assert.equal(validateDefinition(BASE), null);
    assert.ok(BASE.cardioBaseline, "haut-bas-5j.json porte ses cibles depuis #34");
  });
});

/* ---------- #38 : un vocabulaire, un endroit, et il le reste ----------

   Le test qui donne sa valeur à la passe. `unsupported-field` a survécu à #25
   parce que la liste qui *déclare* les raisons et le code qui les *émet*
   vivaient dans deux fichiers sans lien : la raison avait cessé d'être
   produite, sa ligne est restée, et rien ne pouvait le signaler.

   La bijection se vérifie donc dans les deux sens, sur le source lui-même.
   Lire le fichier plutôt que d'exercer 73 chemins de rejet est un choix
   assumé : ce qu'on veut interdire est qu'une ligne existe sans emploi, et
   c'est une propriété du texte, pas du comportement. Les 73 comportements
   sont couverts ailleurs, par les tests qui les provoquent. */
describe("le vocabulaire des refus (#38)", () => {
  const sources = ["../src/journal-shape.js", "../src/import.js", "../src/storage.js"]
    .map((rel) => readFileSync(new URL(rel, import.meta.url), "utf8"));
  /* La déclaration elle-même est retirée de journal-shape avant la recherche :
     sinon chaque raison se trouverait elle-même et le test ne dirait rien. */
  const body = [
    sources[0].slice(sources[0].indexOf("const isSlotRef")),
    ...sources.slice(1),
  ].join("\n");

  const emitted = new Set(
    [...body.matchAll(/reason: "([a-z-]+)"/g)].map((m) => m[1])
      .concat([...body.matchAll(/reject\("([a-z-]+)"/g)].map((m) => m[1])),
  );

  test("aucune raison déclarée n'est inémettable", () => {
    /* Le sens qui aurait attrapé `unsupported-field` le jour où #25 a cessé
       de l'émettre, au lieu de deux issues plus tard. */
    const mortes = Object.keys(REJECTIONS).filter((r) => !emitted.has(r));
    assert.deepEqual(mortes, [], `raisons déclarées que rien n'émet : ${mortes.join(", ")}`);
  });

  test("aucune raison émise n'est indéclarée", () => {
    /* L'autre sens : une raison produite sans phrase de repli s'afficherait
       comme `undefined` dans le panneau, ou ferait tomber l'appelant sur son
       message générique sans qu'on sache pourquoi. */
    const verdictsDeStorage = new Set(["absent", "no-store", "corrupt", "unreadable", "cancelled"]);
    const orphelines = [...emitted].filter((r) => !(r in REJECTIONS) && !verdictsDeStorage.has(r));
    assert.deepEqual(orphelines, [], `raisons émises que rien ne déclare : ${orphelines.join(", ")}`);
  });

  test("chaque phrase est une phrase, pas un identifiant", () => {
    for (const [reason, phrase] of Object.entries(REJECTIONS)) {
      assert.equal(typeof phrase, "string", reason);
      assert.ok(phrase.length > 20, `${reason} : « ${phrase} » est trop court pour dire quoi faire`);
      assert.ok(/[.!]$/.test(phrase), `${reason} : une phrase se termine`);
    }
  });
});
