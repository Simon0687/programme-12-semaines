import test from "node:test";
import assert from "node:assert/strict";
import { SCREEN_KEY, readScreen, writeScreen, resolveScreen } from "../src/screen-state.js";

/* sessionStorage n'existe pas sous node --test. Il n'a pas besoin d'exister :
   le module le reçoit en argument, donc un objet de dix lignes suffit
   (ARCHITECTURE §2.7, même raison que test/helpers/fake-store.js). */
function fakeStorage({ failGet = false, failSet = false } = {}) {
  const data = new Map();
  return {
    data,
    getItem(k) { if (failGet) throw new Error("SecurityError"); return data.has(k) ? data.get(k) : null; },
    setItem(k, v) { if (failSet) throw new Error("QuotaExceededError"); data.set(k, v); },
  };
}

const IDS = ["upperA", "lowerA", "upperB", "lowerB"];
const HOME = { screen: "semaine", sessionId: null };

test("readScreen : rien de mémorisé => null", () => {
  assert.equal(readScreen(fakeStorage()), null);
});

test("writeScreen puis readScreen : aller-retour", () => {
  const s = fakeStorage();
  assert.equal(writeScreen(s, { screen: "seance", sessionId: "upperB" }), true);
  assert.deepEqual(readScreen(s), { screen: "seance", sessionId: "upperB" });
});

test("writeScreen : un écran inconnu est refusé, rien n'est écrit", () => {
  const s = fakeStorage();
  assert.equal(writeScreen(s, { screen: "bilan", sessionId: null }), false);
  assert.equal(s.data.has(SCREEN_KEY), false);
});

test("readScreen : valeur illisible => null, jamais une exception", () => {
  const s = fakeStorage();
  s.setItem(SCREEN_KEY, "{pas du json");
  assert.equal(readScreen(s), null);
});

test("readScreen : écran inconnu en stockage => null", () => {
  const s = fakeStorage();
  s.setItem(SCREEN_KEY, JSON.stringify({ screen: "bilan", sessionId: "upperB" }));
  assert.equal(readScreen(s), null);
});

test("navigation privée : un stockage qui lève ne fait pas lever le module", () => {
  // Safari fait lever l'accès lui-même, pas seulement rendre null.
  assert.equal(readScreen(fakeStorage({ failGet: true })), null);
  assert.equal(writeScreen(fakeStorage({ failSet: true }), { screen: "semaine", sessionId: null }), false);
  assert.equal(readScreen(null), null);
  assert.equal(writeScreen(null, { screen: "semaine", sessionId: null }), false);
});

/* ---------- resolveScreen ---------- */

test("resolveScreen : rien de mémorisé => Semaine", () => {
  assert.deepEqual(resolveScreen(null, IDS), HOME);
});

test("resolveScreen : une séance du programme actif est rouverte", () => {
  assert.deepEqual(resolveScreen({ screen: "seance", sessionId: "upperB" }, IDS), { screen: "seance", sessionId: "upperB" });
});

test("resolveScreen : une séance d'un autre cycle retombe sur Semaine", () => {
  /* Changer de programme est un tap dans Plan. Rouvrir Séance sur un id que
     prog.SESSIONS ne connaît pas laisserait `session` undefined, que tout
     l'écran lit sans repli. */
  assert.deepEqual(resolveScreen({ screen: "seance", sessionId: "hautB" }, IDS), HOME);
});

test("resolveScreen : Séance sans identifiant retombe sur Semaine", () => {
  assert.deepEqual(resolveScreen({ screen: "seance", sessionId: null }, IDS), HOME);
});

test("resolveScreen : un écran sans séance ne traîne pas d'identifiant", () => {
  assert.deepEqual(resolveScreen({ screen: "plan", sessionId: "upperB" }, IDS), { screen: "plan", sessionId: null });
});

test("resolveScreen : liste de séances absente ou vide => Semaine", () => {
  assert.deepEqual(resolveScreen({ screen: "seance", sessionId: "upperB" }, []), HOME);
  assert.deepEqual(resolveScreen({ screen: "seance", sessionId: "upperB" }, undefined), HOME);
});
