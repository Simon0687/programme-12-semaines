import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  isLogRow, sanitizeJournal, unusableProgramIds,
  validateDefinition, validateEnvelope, validatePreMigration, validateProgram, validateProgramEntry,
} from "../src/journal-shape.js";
import { LEGACY_DEFINITION, LEGACY_DEFINITION as BASE } from "../src/legacy-program.js";
import { DEFAULT_DEFINITION as NEUTRAL } from "../src/default-program.js";
import { dateForSlot } from "../src/schema.js";

const entry = (over = {}) => ({ definition: LEGACY_DEFINITION, logs: {}, cardio: {}, checkin: {}, ...over });
const row = (over = {}) => ({ id: "r", date: "2026-09-07", slot: "hautA", ex: {}, done: true, ...over });

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


const prog = (mut) => { const d = JSON.parse(JSON.stringify(BASE)); mut(d.program); return d.program; };
const firstSlot = () => Object.keys(BASE.program.SLOTS)[0];
const firstCore = () => Object.keys(BASE.program.CORE)[0];

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
