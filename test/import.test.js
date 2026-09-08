import { test } from "node:test";
import assert from "node:assert/strict";

import { IMPORT_MESSAGES, parseJournalImport } from "../src/import.js";
import { SCHEMA_VERSION } from "../src/schema.js";

/* Les assertions portent sur reason, jamais sur message : la formulation
   est volontairement remise à plus tard (decisions-spec.md, Q2). */

test("parseJournalImport : texte illisible => invalid-json", () => {
  for (const t of ["{", "", "pas du json", "{,}"]) {
    assert.equal(parseJournalImport(t).reason, "invalid-json", t);
  }
});

test("parseJournalImport : JSON valide mais pas un journal => not-a-journal", () => {
  for (const t of ['{"a":1}', "null", "5", "[]", '"texte"']) {
    assert.equal(parseJournalImport(t).reason, "not-a-journal", t);
  }
});

test("parseJournalImport : schemaVersion non positif => migration-failed, pas invalid-json", () => {
  for (const v of [0, -3]) {
    const res = parseJournalImport(JSON.stringify({ schemaVersion: v, logs: {} }));
    assert.equal(res.ok, false);
    assert.equal(res.reason, "migration-failed", `schemaVersion ${v}`);
  }
});

test("parseJournalImport : version trop récente => too-new", () => {
  const res = parseJournalImport(JSON.stringify({ schemaVersion: 99, logs: { w1_hautA: { done: true } } }));
  assert.equal(res.ok, false);
  assert.equal(res.reason, "too-new");
});

test("parseJournalImport : journal valide => ok, contenu préservé", () => {
  const journal = { schemaVersion: SCHEMA_VERSION, logs: { w1_hautA: { done: true } }, cardio: {}, checkin: {} };
  const res = parseJournalImport(JSON.stringify(journal));
  assert.equal(res.ok, true);
  assert.equal(res.migrated, false);
  assert.deepEqual(res.data.logs, { w1_hautA: { done: true } });
});

test("parseJournalImport : journal non versionné => ok, lu comme v1", () => {
  const res = parseJournalImport(JSON.stringify({ logs: {}, cardio: {}, checkin: {} }));
  assert.equal(res.ok, true);
  assert.equal(res.migrated, false);
  assert.equal(res.data.schemaVersion, SCHEMA_VERSION);
});

test("parseJournalImport : un verdict positif ne porte ni reason ni message", () => {
  const res = parseJournalImport(JSON.stringify({ logs: {} }));
  assert.equal(res.ok, true);
  assert.equal(res.reason, undefined);
  assert.equal(res.message, undefined);
});

test("parseJournalImport : le message d'un rejet vient de IMPORT_MESSAGES", () => {
  assert.equal(parseJournalImport("{").message, IMPORT_MESSAGES["invalid-json"]);
});

test("IMPORT_MESSAGES : aucune raison sans phrase", () => {
  for (const [reason, message] of Object.entries(IMPORT_MESSAGES)) {
    assert.equal(typeof message, "string", reason);
    assert.ok(message.length > 0, reason);
  }
});
