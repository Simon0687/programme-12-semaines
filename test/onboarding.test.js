import test from "node:test";
import assert from "node:assert/strict";
import { isFirstLaunch, startingNow } from "../src/onboarding.js";
import { DEFAULT_DEFINITION } from "../src/default-program.js";
import { slotForDate } from "../src/schema.js";

/* ---------- isFirstLaunch ---------- */

test("« absent » est le seul verdict qui signifie premier lancement", () => {
  assert.equal(isFirstLaunch({ ok: false, reason: "absent" }), true);
});

test("les trois autres échecs de chargement n'en sont pas", () => {
  /* Les confondre serait un bug chacun, et pas le même : no-store ferait
     revenir l'accueil à chaque ouverture, les deux autres proposeraient de
     générer par-dessus un journal que l'appli refuse justement d'écraser. */
  for (const reason of ["no-store", "too-new", "corrupt", "invalid"]) {
    assert.equal(isFirstLaunch({ ok: false, reason }), false, reason);
  }
});

test("un chargement réussi n'en est pas un, même sans une seule séance", () => {
  /* Un journal existe : quelqu'un l'a voulu. « Vide » et « absent » ne sont
     pas la même chose, et c'est la distinction qui évite de reproposer
     l'accueil à quelqu'un qui a déjà choisi. */
  assert.equal(isFirstLaunch({ ok: true, journal: { activeProgramId: "p", programs: {} } }), false);
});

test("un verdict absent ou mal formé ne lève pas", () => {
  for (const res of [null, undefined, {}, "absent", 0]) {
    assert.equal(isFirstLaunch(res), false, String(res));
  }
});

/* ---------- startingNow ---------- */

test("le cycle fourni démarre au prochain lundi, pas à la date du fichier", () => {
  const def = startingNow(DEFAULT_DEFINITION, new Date(2026, 11, 2)); // mercredi 2 décembre
  assert.equal(def.startDate, "2026-12-07"); // lundi suivant
  assert.notEqual(def.startDate, DEFAULT_DEFINITION.startDate);
});

test("un lundi rend le jour même — même départ qu'un programme composé", () => {
  assert.equal(startingNow(DEFAULT_DEFINITION, new Date(2026, 11, 7)).startDate, "2026-12-07");
});

test("le reste de la définition est intact, et l'originale n'est pas touchée", () => {
  const before = JSON.stringify(DEFAULT_DEFINITION);
  const def = startingNow(DEFAULT_DEFINITION, new Date(2026, 11, 2));
  assert.equal(JSON.stringify(DEFAULT_DEFINITION), before);
  assert.deepEqual({ ...def, startDate: DEFAULT_DEFINITION.startDate }, DEFAULT_DEFINITION);
});

test("le bug que ça corrige : « les 12 semaines sont terminées » avant d'avoir commencé", () => {
  /* Le fichier livré porte une date de septembre 2026. Ouvert quatre mois plus
     tard, il place aujourd'hui bien au-delà de la douzième semaine. */
  const enJanvier = "2027-01-20";
  const fige = slotForDate(DEFAULT_DEFINITION.startDate, enJanvier);
  assert.ok(fige.week > DEFAULT_DEFINITION.weeks, `semaine ${fige.week} sur ${DEFAULT_DEFINITION.weeks}`);

  /* Recalculée, la date de départ est postérieure à aujourd'hui : le cycle
     n'a pas commencé, donc slotForDate rend null et l'appli retombe sur la
     semaine 1 — ce qu'on veut lire en ouvrant une appli neuve. */
  const def = startingNow(DEFAULT_DEFINITION, new Date(2027, 0, 20));
  assert.equal(slotForDate(def.startDate, enJanvier), null);
});
