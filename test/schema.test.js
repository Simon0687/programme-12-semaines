import { test } from "node:test";
import assert from "node:assert/strict";

import { SCHEMA_VERSION, applyChain, migrate, versionOf } from "../src/schema.js";

test("versionOf : schemaVersion absent ou invalide => v1", () => {
  assert.equal(versionOf({ logs: {} }), 1);
  assert.equal(versionOf({ schemaVersion: undefined }), 1);
  assert.equal(versionOf({ schemaVersion: "2" }), 1);
  assert.equal(versionOf({ schemaVersion: 1.5 }), 1);
  assert.equal(versionOf({ schemaVersion: 3 }), 3);
  assert.equal(versionOf(null), 1);
});

test("migrate : no-op à la version courante, résultat équivalent à l'entrée", () => {
  const input = { schemaVersion: SCHEMA_VERSION, logs: { w1_hautA: { done: true } }, cardio: {}, checkin: {} };
  const res = migrate(input);
  assert.equal(res.ok, true);
  assert.equal(res.migrated, false);
  assert.deepEqual(res.data, input);
});

test("migrate : journal non versionné lu comme v1, sans migration", () => {
  const res = migrate({ logs: {}, cardio: {}, checkin: {} });
  assert.equal(res.ok, true);
  assert.equal(res.from, 1);
  assert.equal(res.migrated, false);
  assert.equal(res.data.schemaVersion, 1);
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

test("migrate : n'altère pas son argument", () => {
  const input = Object.freeze({ schemaVersion: SCHEMA_VERSION, logs: {}, cardio: {}, checkin: {} });
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
