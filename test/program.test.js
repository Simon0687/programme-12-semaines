import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildProgram, getKeySlots, getCardioDayNotes, hasCardioItems, hasMobilityDays, hasCardioContent } from "../src/program.js";
import { LEGACY_DEFINITION } from "../src/legacy-program.js";

/* #26 : les attentes ci-dessous (slots clés, jours à note cardio, présence du
   cardio) décrivent le programme hérité. Elles le nomment, au lieu de lire le
   bundle courant qui va cesser d'être ce programme. */
const prog = buildProgram(LEGACY_DEFINITION);

describe("buildProgram : résolution de program.cardio", () => {
  const withCardio = (cardio) => ({ program: { ...LEGACY_DEFINITION.program, cardio } });

  test("absent : bundle cardio par défaut (comme aujourd'hui)", () => {
    const { cardio, ...p } = LEGACY_DEFINITION.program;
    assert.equal(hasCardioContent(buildProgram({ program: p })), true);
  });

  test('"default" : bundle cardio par défaut', () => {
    assert.equal(hasCardioContent(buildProgram(withCardio("default"))), true);
  });

  test("null : aucune donnée cardio dans le bundle (régression du bug #25 où null était traité comme absent via ??)", () => {
    const built = buildProgram(withCardio(null));
    assert.equal(hasCardioContent(built), false);
    assert.equal(built.cardioPlan, undefined);
    assert.equal(built.CARDIO_DAY_NOTES, undefined);
  });
});

describe("getKeySlots", () => {
  test("programme hérité : les six slots key: true, dans l'ordre de déclaration de SLOTS (#22)", () => {
    assert.deepEqual(getKeySlots(prog), ["dc", "latraise", "squat", "pull", "ohp", "hipthrust"]);
  });

  test("aucun slot key: true : tableau vide, ne lève pas", () => {
    const noKeys = { SLOTS: { a: { reps: [4, 8] }, b: { reps: [8, 12] } } };
    assert.deepEqual(getKeySlots(noKeys), []);
  });
});

describe("getCardioDayNotes", () => {
  test("programme hérité : exactement les jours 0 et 4 (note cardio sans séance)", () => {
    assert.deepEqual(getCardioDayNotes(prog), [0, 4]);
  });

  test("un jour avec séance ET note cardio n'est pas compté (mercredi : Haut B + rameur)", () => {
    // day 3 (mercredi) porte une séance (hautB) et une note dans CARDIO_DAY_NOTES ;
    // il ne doit pas apparaître, seuls les jours sans aucune séance comptent.
    assert.ok(!getCardioDayNotes(prog).includes(3));
    assert.ok(Object.keys(prog.CARDIO_DAY_NOTES).map(Number).includes(3));
  });

  test("aucune note cardio : tableau vide, ne lève pas", () => {
    const noNotes = { SESSIONS: prog.SESSIONS, CARDIO_DAY_NOTES: {} };
    assert.deepEqual(getCardioDayNotes(noNotes), []);
  });

  test("bundle sans donnée cardio du tout (cardio: null, #25) : CARDIO_DAY_NOTES absent, tableau vide, ne lève pas (#13)", () => {
    const noCardio = { SESSIONS: prog.SESSIONS };
    assert.deepEqual(getCardioDayNotes(noCardio), []);
  });
});

describe("hasCardioItems / hasMobilityDays / hasCardioContent (#13)", () => {
  test("programme hérité : cardio et mobilité tous les deux présents", () => {
    assert.equal(hasCardioItems(prog), true);
    assert.equal(hasMobilityDays(prog), true);
    assert.equal(hasCardioContent(prog), true);
  });

  test("bundle sans donnée cardio du tout (cardio: null) : les trois sont faux", () => {
    const noCardio = {};
    assert.equal(hasCardioItems(noCardio), false);
    assert.equal(hasMobilityDays(noCardio), false);
    assert.equal(hasCardioContent(noCardio), false);
  });

  test("tableau présent mais vide : traité comme absent", () => {
    assert.equal(hasCardioItems({ CARDIO_ITEMS: [] }), false);
    assert.equal(hasMobilityDays({ MOB_DAYS: [] }), false);
  });

  test("cardio sans mobilité, ou l'inverse : indépendants l'un de l'autre", () => {
    assert.equal(hasCardioContent({ CARDIO_ITEMS: prog.CARDIO_ITEMS }), true);
    assert.equal(hasMobilityDays({ CARDIO_ITEMS: prog.CARDIO_ITEMS }), false);
    assert.equal(hasCardioContent({ MOB_DAYS: prog.MOB_DAYS }), true);
    assert.equal(hasCardioItems({ MOB_DAYS: prog.MOB_DAYS }), false);
  });
});
