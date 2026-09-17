import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildProgram, getKeySlots, getCardioDayNotes, hasCardioItems, hasMobilityDays, hasCardioContent } from "../src/program.js";
import { LEGACY_DEFINITION } from "../src/legacy-program.js";
import { DEFAULT_DEFINITION } from "../src/default-program.js";

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
  test("programme hérité : exactement les jours 4 et 7 (note cardio sans séance)", () => {
    /* Jeudi et dimanche. Le dimanche était indexé 0 — un Date#getDay() — avant
       que #39 ne ramène CARDIO_DAY_NOTES sur la convention de `session.day`,
       un décalage de 1 à 7 depuis startDate. Les jours nommés ne changent pas,
       leur clé si. */
    assert.deepEqual(getCardioDayNotes(prog), [4, 7]);
  });

  test("aucun jour de cardio hors de la plage 1-7 (#39, #34)", () => {
    /* Le 0 de l'ancienne convention rendait le dimanche indistinguable de « la
       veille du départ », que dateForSlot place hors du cycle. Un jour hors
       plage est le symptôme du retour de la seconde convention — et depuis #34
       les jours viennent de la structure du programme, plus d'une table. */
    for (const d of [...prog.CARDIO_ITEMS.map((it) => it.day), ...prog.MOB_DAYS]) {
      assert.ok(Number.isInteger(d) && d >= 1 && d <= 7, `jour ${d} hors de la plage 1-7`);
    }
  });

  test("un jour avec séance ET cardio n'est pas compté (mercredi : Haut B + rameur)", () => {
    // Le jour 3 porte une séance (hautB) et une séance de rameur ; il ne doit
    // pas apparaître, seuls les jours sans aucune séance de force comptent.
    assert.ok(!getCardioDayNotes(prog).includes(3));
    assert.ok(prog.CARDIO_ITEMS.some((it) => it.day === 3));
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

describe("buildProgram : le repli d'une définition sans program (#32)", () => {
  /* Une définition chargée entre #6 et #25 ne porte pas de champ program :
     parseProgramImport rejetait alors tout fichier qui en déclarait un. Elle
     doit continuer à se lire contre le programme qu'elle désignait à
     l'époque — le programme hérité — et non contre le bundle du jour. */
  const preRegistry = { formatVersion: 1, id: "coach-2026", name: "Programme du coach", weeks: 12, startDate: "2026-03-02", startingLoads: { dc: 60 } };

  test("résout vers le programme hérité, pas vers le bundle courant", () => {
    const built = buildProgram(preRegistry);
    assert.deepEqual(built.SESSIONS.map((s) => s.id), LEGACY_DEFINITION.program.SESSIONS.map((s) => s.id));
  });

  test("ses charges de départ sont quand même injectées", () => {
    assert.equal(buildProgram(preRegistry).V.dc.start, 60);
  });

  test("une définition qui porte un program garde le sien", () => {
    const built = buildProgram(DEFAULT_DEFINITION);
    assert.deepEqual(built.SESSIONS.map((s) => s.id), DEFAULT_DEFINITION.program.SESSIONS.map((s) => s.id));
  });
});
