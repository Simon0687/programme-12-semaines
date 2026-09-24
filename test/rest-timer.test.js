import test from "node:test";
import assert from "node:assert/strict";
import { REST_KEY, REST_STALE_MS, readRest, writeRest, acquireWakeLock, releaseWakeLock, makeChime } from "../src/rest-timer.js";

/* Aucun objet navigateur n'existe sous node --test, et aucun n'a besoin
   d'exister : chaque pièce reçoit le sien (ARCHITECTURE §2.7). */
function fakeStorage({ failGet = false, failSet = false } = {}) {
  const data = new Map();
  return {
    data,
    getItem(k) { if (failGet) throw new Error("SecurityError"); return data.has(k) ? data.get(k) : null; },
    setItem(k, v) { if (failSet) throw new Error("QuotaExceededError"); data.set(k, v); },
    removeItem(k) { data.delete(k); },
  };
}

const NOW = 1_800_000_000_000;

/* ---------- 1. Persistance ---------- */

test("un repos écrit se relit tel quel : l'heure de fin, pas le temps restant", () => {
  const s = fakeStorage();
  assert.equal(writeRest(s, { end: NOW + 90_000, label: "Développé couché" }), true);
  assert.deepEqual(readRest(s, NOW), { end: NOW + 90_000, label: "Développé couché" });
  /* Relu 30 s plus tard, c'est la même fin : l'écran en déduit 60 s. */
  assert.deepEqual(readRest(s, NOW + 30_000), { end: NOW + 90_000, label: "Développé couché" });
});

test("un repos expiré depuis peu se relit, l'écran dira « Repos terminé »", () => {
  const s = fakeStorage();
  writeRest(s, { end: NOW - 10_000, label: "Rowing" });
  assert.deepEqual(readRest(s, NOW), { end: NOW - 10_000, label: "Rowing" });
});

test("un repos expiré depuis longtemps n'est plus une information", () => {
  const s = fakeStorage();
  writeRest(s, { end: NOW - REST_STALE_MS - 1, label: "Rowing" });
  assert.equal(readRest(s, NOW), null);
});

test("écrire null efface le repos mémorisé", () => {
  const s = fakeStorage();
  writeRest(s, { end: NOW + 1000, label: "x" });
  assert.equal(writeRest(s, null), true);
  assert.equal(s.data.has(REST_KEY), false);
  assert.equal(readRest(s, NOW), null);
});

test("valeur illisible ou mal formée : pas de repos, jamais une exception", () => {
  const s = fakeStorage();
  for (const raw of ["{pas du json", "null", "42", '{"end":"demain","label":"x"}', '{"end":1}', '{"label":"x"}']) {
    s.setItem(REST_KEY, raw);
    assert.equal(readRest(s, NOW), null, raw);
  }
});

test("stockage absent ou qui lève (navigation privée) : ni valeur ni exception", () => {
  assert.equal(readRest(null, NOW), null);
  assert.equal(writeRest(null, { end: NOW, label: "x" }), false);
  assert.equal(readRest(fakeStorage({ failGet: true }), NOW), null);
  assert.equal(writeRest(fakeStorage({ failSet: true }), { end: NOW, label: "x" }), false);
});

/* ---------- 2. Wake Lock ---------- */

test("wake lock : demandé sur l'écran, rendu tel que le navigateur le donne", async () => {
  const sentinel = { released: false, release() { this.released = true; return Promise.resolve(); } };
  const asked = [];
  const nav = { wakeLock: { request: async (type) => { asked.push(type); return sentinel; } } };
  const lock = await acquireWakeLock(nav);
  assert.equal(lock, sentinel);
  assert.deepEqual(asked, ["screen"]);
  releaseWakeLock(lock);
  assert.equal(sentinel.released, true);
});

test("wake lock absent ou refusé : null, jamais une exception", async () => {
  assert.equal(await acquireWakeLock(null), null);
  assert.equal(await acquireWakeLock({}), null);
  assert.equal(await acquireWakeLock({ wakeLock: {} }), null);
  assert.equal(await acquireWakeLock({ wakeLock: { request: async () => { throw new Error("NotAllowedError"); } } }), null);
});

test("relâcher un verrou absent, déjà relâché ou dont release rejette ne lève pas", () => {
  releaseWakeLock(null);
  releaseWakeLock({});
  releaseWakeLock({ release() { throw new Error("InvalidStateError"); } });
  releaseWakeLock({ release: () => Promise.reject(new Error("déjà relâché")) });
});

/* ---------- 3. Signal audible ---------- */

function fakeAudio() {
  const log = { created: 0, resumed: 0, started: [] };
  class Ctx {
    constructor() { log.created += 1; this.state = "suspended"; this.currentTime = 5; this.destination = {}; }
    resume() { log.resumed += 1; this.state = "running"; return Promise.resolve(); }
    createOscillator() {
      return { type: "", frequency: { value: 0 }, connect() {}, start(t) { log.started.push({ t, f: this.frequency.value }); }, stop() {} };
    }
    createGain() {
      return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
    }
  }
  return { Ctx, log };
}

test("le son ne joue qu'après unlock : c'est le tap qui autorise le contexte", () => {
  const { Ctx, log } = fakeAudio();
  const chime = makeChime(Ctx);
  assert.equal(chime.play(), false);
  assert.equal(log.created, 0);
  assert.equal(chime.unlock(), true);
  assert.equal(log.created, 1);
  assert.equal(log.resumed, 1);
  assert.equal(chime.play(), true);
  assert.deepEqual(log.started.map((s) => s.f), [880, 1175]);
});

test("unlock répété réutilise le contexte, et ne le relance que s'il est suspendu", () => {
  const { Ctx, log } = fakeAudio();
  const chime = makeChime(Ctx);
  chime.unlock();
  chime.unlock();
  assert.equal(log.created, 1);
  assert.equal(log.resumed, 1);
});

test("pas de Web Audio, ou un constructeur qui lève : ni son ni exception", () => {
  const none = makeChime(null);
  assert.equal(none.unlock(), false);
  assert.equal(none.play(), false);
  const broken = makeChime(class { constructor() { throw new Error("NotSupportedError"); } });
  assert.equal(broken.unlock(), false);
  assert.equal(broken.play(), false);
});
