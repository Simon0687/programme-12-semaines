import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildProgram, getKeySlots, getCardioDayNotes } from "../src/program.js";

const prog = buildProgram({});

describe("getKeySlots", () => {
  test("bundle par défaut : les six slots key: true, dans l'ordre de déclaration de SLOTS (#22)", () => {
    assert.deepEqual(getKeySlots(prog), ["dc", "latraise", "squat", "pull", "ohp", "hipthrust"]);
  });

  test("aucun slot key: true : tableau vide, ne lève pas", () => {
    const noKeys = { SLOTS: { a: { reps: [4, 8] }, b: { reps: [8, 12] } } };
    assert.deepEqual(getKeySlots(noKeys), []);
  });
});

describe("getCardioDayNotes", () => {
  test("bundle par défaut : exactement les jours 0 et 4 (note cardio sans séance)", () => {
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
});
