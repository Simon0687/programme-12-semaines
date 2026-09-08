import { test } from "node:test";
import assert from "node:assert/strict";

import { SCHEMA_VERSION, DEFAULT_PROGRAM_ID, applyChain, migrate, versionOf } from "../src/schema.js";

test("versionOf : schemaVersion absent ou invalide => v1", () => {
  assert.equal(versionOf({ logs: {} }), 1);
  assert.equal(versionOf({ schemaVersion: undefined }), 1);
  assert.equal(versionOf({ schemaVersion: "2" }), 1);
  assert.equal(versionOf({ schemaVersion: 1.5 }), 1);
  assert.equal(versionOf({ schemaVersion: 3 }), 3);
  assert.equal(versionOf(null), 1);
});

test("migrate : no-op à la version courante (v2), résultat équivalent à l'entrée", () => {
  const input = {
    schemaVersion: SCHEMA_VERSION,
    activeProgramId: "x",
    programs: { x: { definition: null, logs: { w1_hautA: { done: true } }, cardio: {}, checkin: {} } },
  };
  const res = migrate(input);
  assert.equal(res.ok, true);
  assert.equal(res.migrated, false);
  assert.deepEqual(res.data, input);
});

test("migrate : journal v1 (plat) migré vers v2, entrées préservées sous le programme par défaut (#6)", () => {
  const input = { schemaVersion: 1, logs: { w1_hautA: { done: true } }, cardio: { w1: { z2a: { done: true } } }, checkin: { w1: { poids: "90" } } };
  const res = migrate(input);
  assert.equal(res.ok, true);
  assert.equal(res.from, 1);
  assert.equal(res.migrated, true);
  assert.equal(res.data.schemaVersion, SCHEMA_VERSION);
  assert.equal(res.data.activeProgramId, DEFAULT_PROGRAM_ID);
  const active = res.data.programs[DEFAULT_PROGRAM_ID];
  assert.equal(active.definition, null); // null => programme fourni avec l'appli
  assert.deepEqual(active.logs, input.logs);
  assert.deepEqual(active.cardio, input.cardio);
  assert.deepEqual(active.checkin, input.checkin);
});

test("migrate : journal non versionné (v1 implicite) migré vers v2", () => {
  const res = migrate({ logs: { w1_hautA: { done: true } }, cardio: {}, checkin: {} });
  assert.equal(res.ok, true);
  assert.equal(res.from, 1);
  assert.equal(res.migrated, true);
  assert.equal(res.data.schemaVersion, SCHEMA_VERSION);
  assert.deepEqual(res.data.programs[DEFAULT_PROGRAM_ID].logs, { w1_hautA: { done: true } });
});

test("migrate : v1 avec logs/cardio/checkin absents => programme par défaut avec des objets vides", () => {
  const res = migrate({ schemaVersion: 1 });
  assert.equal(res.ok, true);
  const active = res.data.programs[DEFAULT_PROGRAM_ID];
  assert.deepEqual(active.logs, {});
  assert.deepEqual(active.cardio, {});
  assert.deepEqual(active.checkin, {});
});

test("migrate : idempotent sur un objet déjà en v2", () => {
  const v2 = migrate({ schemaVersion: 1, logs: { w1_hautA: { done: true } } }).data;
  const again = migrate(v2);
  assert.equal(again.migrated, false);
  assert.deepEqual(again.data, v2);
});

test("migrate : version trop récente => flag de rejet, rien n'est détruit", () => {
  const input = { schemaVersion: 99, logs: { w1_hautA: { done: true } } };
  const res = migrate(input);
  assert.equal(res.ok, false);
  assert.equal(res.tooNew, true);
  assert.equal(res.from, 99);
  assert.deepEqual(res.data, { schemaVersion: 99, logs: { w1_hautA: { done: true } } });
});

test("migrate : schemaVersion non positif => flag invalid, ne lève pas, rien n'est détruit", () => {
  for (const v of [0, -3]) {
    const input = { schemaVersion: v, logs: { w1_hautA: { done: true } } };
    const res = migrate(input);
    assert.equal(res.ok, false);
    assert.equal(res.invalid, true);
    assert.equal(res.from, v);
    assert.deepEqual(res.data, input);
  }
});

test("migrate : n'altère pas son argument (v1 -> v2)", () => {
  const input = Object.freeze({ schemaVersion: 1, logs: Object.freeze({}), cardio: Object.freeze({}), checkin: Object.freeze({}) });
  assert.doesNotThrow(() => migrate(input));
});

test("applyChain : enchaîne les étapes 1 -> 2 -> 3 dans l'ordre", () => {
  const fake = {
    1: (d) => ({ ...d, schemaVersion: 2, steps: [...d.steps, 1] }),
    2: (d) => ({ ...d, schemaVersion: 3, steps: [...d.steps, 2] }),
  };
  const out = applyChain({ schemaVersion: 1, steps: [] }, 3, fake);
  assert.equal(out.schemaVersion, 3);
  assert.deepEqual(out.steps, [1, 2]);
});

test("applyChain : une étape manquante lève", () => {
  assert.throws(() => applyChain({ schemaVersion: 1 }, 2, {}), /Migration manquante depuis la v1/);
});
