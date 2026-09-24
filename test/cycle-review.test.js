import test from "node:test";
import assert from "node:assert/strict";
import { cycleReview } from "../src/cycle-review.js";
import { buildProgram } from "../src/program.js";
import { DEFAULT_DEFINITION } from "../src/default-program.js";

/* Le programme livré : quatre séances, créneaux clés `press` (dc_db) et
   `quad1` (hack), entre autres. On n'écrit que des journaux à la main — le
   bilan ne fait que lire. */
const prog = buildProgram(DEFAULT_DEFINITION);
const set = (w, r) => ({ w, r, rir: "1" });
const log = (date, slot, ex, more = {}) => ({ date, slot, done: true, kind: "normal", ex, ...more });
const state = (...logs) => ({ logs: Object.fromEntries(logs.map((l, i) => [String(i), l])) });

test("séances faites sur prévues : semaines × séances du programme", () => {
  const r = cycleReview(prog, state(
    log("2026-08-03", "upperA", {}),
    log("2026-08-04", "lowerA", {}),
    log("2026-08-06", "upperB", {}, { done: false }),
    log("2026-08-06", "autreProgramme", {}),
  ), 12);
  assert.equal(r.done, 2);
  assert.equal(r.planned, 12 * prog.SESSIONS.length);
});

test("un exercice clé : charge de travail du début -> de la fin, dans son unité", () => {
  const r = cycleReview(prog, state(
    log("2026-08-03", "upperA", { dc_db: [set("22", "10"), set("22", "9")] }),
    log("2026-09-14", "upperA", { dc_db: [set("30", "8"), set("30", "8")] }),
    log("2026-08-24", "upperA", { dc_db: [set("26", "8")] }),
  ), 12);
  const line = r.lines.find((l) => l.vid === "dc_db");
  assert.deepEqual([line.first, line.last], [22, 30]);
  assert.equal(line.text, "22 → 30 kg / main");
  assert.equal(line.name, prog.V.dc_db.name);
});

test("décharge, séance allégée et test ne bornent pas la progression", () => {
  const r = cycleReview(prog, state(
    log("2026-08-03", "upperA", { dc_db: [set("22", "10")] }),
    log("2026-09-14", "upperA", { dc_db: [set("26", "10")] }),
    log("2026-09-21", "upperA", { dc_db: [set("20", "10")] }, { kind: "deload" }),
    log("2026-09-22", "upperA", { dc_db: [set("34", "3")] }, { kind: "test" }),
  ), 12);
  assert.equal(r.lines.find((l) => l.vid === "dc_db").text, "22 → 26 kg / main");
});

test("un exercice clé jamais fait n'a pas de ligne ; un cycle vide n'en a aucune", () => {
  const r = cycleReview(prog, state(log("2026-08-03", "upperA", { dc_db: [set("22", "10")] })), 12);
  assert.equal(r.lines.some((l) => l.vid === "hack"), false);
  assert.deepEqual(cycleReview(prog, { logs: {} }, 12), { done: 0, planned: 12 * prog.SESSIONS.length, lines: [] });
});

test("un exercice substitué sur un créneau clé a sa propre ligne", () => {
  const r = cycleReview(prog, state(
    log("2026-08-03", "upperA", { dc: [set("80", "8")] }, { sub: { press: "dc" } }),
    log("2026-08-10", "upperA", { dc: [set("85", "8")] }, { sub: { press: "dc" } }),
  ), 12);
  assert.equal(r.lines.find((l) => l.vid === "dc").text, "80 → 85 kg");
});

test("entrées absentes ou mal formées : un bilan vide, jamais une exception", () => {
  assert.deepEqual(cycleReview(null, null, 12), { done: 0, planned: 0, lines: [] });
  assert.deepEqual(cycleReview(prog, { logs: {} }, undefined).planned, 0);
});
