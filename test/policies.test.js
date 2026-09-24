import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_POLICIES, resolvePolicies, isDeloadWeek, blockIndex, variantOf,
  setsForWeek, kindForWeek, phaseFor, evaluateDeload, HYSTERESIS_DAYS,
} from "../src/policies.js";
import { phaseOf, blockOf, setsFor, computeKind } from "../src/progression.js";

/* ---------- La forme livrée, écrite comme une donnée ----------

   Le premier critère de l'issue : « la forme d'aujourd'hui est exprimable en
   politiques et produit des charges et des libellés identiques ».
   test/progression.test.js n'a pas été touché et reste vert, ce qui le dit
   pour le moteur ; ces tests-ci le disent pour les quatre fonctions de forme,
   semaine par semaine. */

describe("DEFAULT_POLICIES reproduit le cycle livré (#14)", () => {
  test("la décharge tombe en semaine 7, et nulle part ailleurs sur douze", () => {
    const weeks = [];
    for (let w = 1; w <= 12; w++) if (isDeloadWeek(w, DEFAULT_POLICIES.deload)) weeks.push(w);
    assert.deepEqual(weeks, [7]);
  });

  test("les variantes tournent en semaine 7 : b1 de 1 à 6, b2 de 7 à 12", () => {
    for (let w = 1; w <= 6; w++) assert.equal(variantOf(w, DEFAULT_POLICIES.rotation), "b1", `S${w}`);
    for (let w = 7; w <= 12; w++) assert.equal(variantOf(w, DEFAULT_POLICIES.rotation), "b2", `S${w}`);
  });

  test("les cinq phases, dans l'ordre et avec leurs libellés d'origine", () => {
    const p = (w) => phaseOf(w, DEFAULT_POLICIES, 12);
    assert.deepEqual(p(1), { id: "calib", label: "Calibration", rir: "2–3" });
    assert.deepEqual(p(6), { id: "b1", label: "Bloc 1", rir: "1" });
    assert.deepEqual(p(7), { id: "deload", label: "Décharge et calibration du bloc 2", rir: "3–4" });
    assert.deepEqual(p(11), { id: "b2", label: "Bloc 2", rir: "1" });
    assert.deepEqual(p(12), { id: "bilan", label: "Bloc 2, semaine bilan", rir: "1" });
  });

  test("le volume n'est coupé qu'en décharge, et de moitié", () => {
    for (let w = 1; w <= 12; w++) {
      const attendu = w === 7 ? 2 : 3;
      assert.equal(setsFor(3, w), attendu, `S${w}`);
    }
    assert.equal(setsFor(5, 7), 3); // Math.ceil : une décharge allège, elle ne supprime pas
  });

  test("le genre stocké : calibration en S1, deload en S7, normal ailleurs", () => {
    assert.equal(computeKind(1), "calibration");
    assert.equal(computeKind(7), "deload");
    for (const w of [2, 6, 8, 12]) assert.equal(computeKind(w), "normal", `S${w}`);
  });

  test("les appels sans politique valent les appels avec DEFAULT_POLICIES", () => {
    /* La garantie de non-régression, énoncée comme une propriété plutôt que
       laissée à la relecture : c'est elle qui permet aux 73 tests de
       progression de ne pas bouger. */
    for (let w = 1; w <= 14; w++) {
      assert.deepEqual(phaseOf(w), phaseOf(w, DEFAULT_POLICIES, 12), `phaseOf S${w}`);
      assert.equal(blockOf(w), variantOf(w, DEFAULT_POLICIES.rotation), `blockOf S${w}`);
      assert.equal(setsFor(4, w), setsForWeek(4, w, DEFAULT_POLICIES.deload), `setsFor S${w}`);
      assert.equal(computeKind(w), kindForWeek(w, DEFAULT_POLICIES), `computeKind S${w}`);
    }
  });
});

/* ---------- Les politiques que le cycle livré ne savait pas exprimer ---------- */

describe("une autre forme de cycle (#14)", () => {
  test("décharger toutes les 4 semaines coupe en S5, S10, S15…", () => {
    const deload = { ...DEFAULT_POLICIES.deload, everyNWeeks: 4 };
    const weeks = [];
    for (let w = 1; w <= 16; w++) if (isDeloadWeek(w, deload)) weeks.push(w);
    assert.deepEqual(weeks, [5, 10, 15]);
  });

  test("…sans faire tourner les exercices en même temps", () => {
    /* Le cœur de l'issue : « décharge » et « rotation » répondent à deux
       questions sans rapport — la fatigue et le plateau — et les laisser
       fusionnées ferait changer d'exercices toutes les quatre semaines à
       quelqu'un qui voulait seulement lever le pied. */
    const policies = {
      deload: { ...DEFAULT_POLICIES.deload, everyNWeeks: 4 },
      rotation: { mode: "everyNWeeks", n: 6 },
    };
    assert.equal(isDeloadWeek(5, policies.deload), true);
    assert.equal(variantOf(5, policies.rotation), "b1"); // la rotation, elle, n'a pas bougé
    assert.equal(variantOf(7, policies.rotation), "b2");
  });

  test("deload: null ne coupe jamais, jamais", () => {
    for (let w = 1; w <= 30; w++) {
      assert.equal(isDeloadWeek(w, null), false, `S${w}`);
      assert.equal(setsForWeek(3, w, null), 3, `S${w}`);
      assert.equal(kindForWeek(w, { deload: null }), w === 1 ? "calibration" : "normal", `S${w}`);
      assert.notEqual(phaseFor(w, { deload: null, rotation: DEFAULT_POLICIES.rotation }, 12).id, "deload", `S${w}`);
    }
  });

  test("rotation « none » garde la première variante pour toujours", () => {
    for (let w = 1; w <= 20; w++) assert.equal(variantOf(w, { mode: "none" }), "b1", `S${w}`);
  });

  test("un troisième bloc revient sur b1, il ne lit pas une clé absente", () => {
    /* Le format ne porte que deux variantes par créneau. Un cycle assez long
       pour atteindre un troisième bloc doit exécuter quelque chose, pas rendre
       `undefined` au milieu d'une séance. */
    assert.equal(blockIndex(13, DEFAULT_POLICIES.rotation), 3);
    assert.equal(variantOf(13, DEFAULT_POLICIES.rotation), "b1");
  });

  test("un facteur de volume autre que la moitié", () => {
    assert.equal(setsForWeek(4, 7, { everyNWeeks: 6, volumeFactor: 0.75 }), 3);
  });
});

/* ---------- resolvePolicies ---------- */

describe("resolvePolicies (#14)", () => {
  test("un programme sans politiques obtient la forme livrée", () => {
    /* Le point qui protège tous les journaux déjà tenus : l'absence du champ
       se lit « comme avant », jamais « aucune politique ». Un programme
       d'avant #14 continue donc de décharger en semaine 7. */
    assert.deepEqual(resolvePolicies({}), DEFAULT_POLICIES);
    assert.deepEqual(resolvePolicies(undefined), DEFAULT_POLICIES);
    assert.deepEqual(resolvePolicies({ policies: "n'importe quoi" }), DEFAULT_POLICIES);
  });

  test("une politique partielle complète les champs absents", () => {
    const r = resolvePolicies({ policies: { deload: { everyNWeeks: 4 } } });
    assert.equal(r.deload.everyNWeeks, 4);
    assert.equal(r.deload.loadFactor, DEFAULT_POLICIES.deload.loadFactor);
  });

  test("deload: null est une valeur, pas une absence", () => {
    /* La distinction qui rend « ne décharge jamais » exprimable. Un repli qui
       rattraperait `null` rendrait le cas impossible à écrire. */
    assert.equal(resolvePolicies({ policies: { deload: null } }).deload, null);
    assert.deepEqual(resolvePolicies({ policies: {} }).deload, DEFAULT_POLICIES.deload);
  });
});

/* ---------- evaluateDeload ---------- */

const lift = (name, ...loads) => ({
  name,
  history: loads.map((l, i) => ({
    date: `2026-03-${String(i + 1).padStart(2, "0")}`,
    kind: "normal",
    load: l.load ?? l,
    sets: l.sets ?? [{ w: l.load ?? l, r: 6, rir: 1 }],
  })),
});

describe("evaluateDeload (#14)", () => {
  const TODAY = "2026-04-01";

  test("rien à signaler : aucun signal, aucune recommandation", () => {
    const r = evaluateDeload({ keyLifts: [lift("Développé", 80, 82.5)] }, DEFAULT_POLICIES.deload, TODAY);
    assert.equal(r.recommended, false);
    assert.equal(r.score, 0);
    assert.deepEqual(r.reasons, []);
  });

  test("régression sur deux exercices clés : 2 points, sous le seuil", () => {
    const signals = { keyLifts: [lift("Développé", 85, 80), lift("Squat", 110, 105)] };
    const r = evaluateDeload(signals, DEFAULT_POLICIES.deload, TODAY);
    assert.equal(r.score, 2);
    assert.equal(r.recommended, false); // seuil 3 : un seul signal ne suffit pas
    assert.match(r.reasons[0], /Développé, Squat/);
  });

  test("un seul exercice en baisse ne compte pas", () => {
    /* « Au moins deux » est la règle : un exercice qui décroche tout seul est
       plus souvent une mauvaise journée qu'une fatigue générale. */
    const r = evaluateDeload({ keyLifts: [lift("Développé", 85, 80), lift("Squat", 105, 110)] }, DEFAULT_POLICIES.deload, TODAY);
    assert.equal(r.score, 0);
  });

  test("sommeil dégradé seul : 1 point", () => {
    const signals = { checkins: [{ date: "2026-03-28", sleep: 2 }, { date: "2026-03-30", sleep: 2 }] };
    const r = evaluateDeload(signals, DEFAULT_POLICIES.deload, TODAY);
    assert.equal(r.score, 1);
    assert.match(r.reasons[0], /Sommeil moyen/);
  });

  test("un check-in vieux de plus de sept jours ne compte pas", () => {
    const signals = { checkins: [{ date: "2026-03-01", sleep: 1 }] };
    assert.equal(evaluateDeload(signals, DEFAULT_POLICIES.deload, TODAY).score, 0);
  });

  test("dérive du RIR à charge égale : 1 point", () => {
    const l = {
      name: "Développé",
      history: [
        { date: "2026-03-20", kind: "normal", load: 80, sets: [{ w: 80, r: 6, rir: 1 }, { w: 80, r: 6, rir: 1 }] },
        { date: "2026-03-27", kind: "normal", load: 80, sets: [{ w: 80, r: 6, rir: 3 }, { w: 80, r: 6, rir: 3 }] },
      ],
    };
    const r = evaluateDeload({ keyLifts: [l] }, DEFAULT_POLICIES.deload, TODAY);
    assert.equal(r.score, 1);
    assert.match(r.reasons[0], /Effort perçu/);
  });

  test("le RIR qui monte parce qu'on a allégé ne dit rien", () => {
    /* « À charge égale » est exigé, et c'est ce qui empêche le signal de se
       déclencher sur une séance volontairement légère. */
    const l = {
      name: "Développé",
      history: [
        { date: "2026-03-20", kind: "normal", load: 90, sets: [{ w: 90, r: 6, rir: 1 }] },
        { date: "2026-03-27", kind: "normal", load: 70, sets: [{ w: 70, r: 6, rir: 4 }] },
      ],
    };
    assert.equal(evaluateDeload({ keyLifts: [l] }, DEFAULT_POLICIES.deload, TODAY).score, 0);
  });

  test("cas combiné : régression + sommeil atteint le seuil", () => {
    const signals = {
      keyLifts: [lift("Développé", 85, 80), lift("Squat", 110, 105)],
      checkins: [{ date: "2026-03-30", sleep: 2 }],
    };
    const r = evaluateDeload(signals, DEFAULT_POLICIES.deload, TODAY);
    assert.equal(r.score, 3);
    assert.equal(r.recommended, true);
    assert.equal(r.reasons.length, 2); // l'avis nomme ce sur quoi il se fonde
  });

  test("hystérésis : rien n'est proposé dans les trois semaines qui suivent une décharge", () => {
    /* Sans elle, l'avis ping-pongue : une décharge améliore les signaux, ils
       se dégradent à nouveau, et la proposition revient avant que la première
       ait produit son effet. */
    const signals = {
      keyLifts: [lift("Développé", 85, 80), lift("Squat", 110, 105)],
      checkins: [{ date: "2026-03-30", sleep: 1 }],
      lastDeload: "2026-03-25",
    };
    const r = evaluateDeload(signals, DEFAULT_POLICIES.deload, TODAY);
    assert.equal(r.recommended, false);
    assert.match(r.reasons[0], /trop tôt/);
  });

  test("passé l'hystérésis, le même état recommande à nouveau", () => {
    const signals = {
      keyLifts: [lift("Développé", 85, 80), lift("Squat", 110, 105)],
      checkins: [{ date: "2026-03-30", sleep: 1 }],
      lastDeload: "2026-02-20", // plus de 21 jours
    };
    assert.ok(HYSTERESIS_DAYS >= 21);
    assert.equal(evaluateDeload(signals, DEFAULT_POLICIES.deload, TODAY).recommended, true);
  });

  test("une décharge, une calibration ou une séance allégée ne sert pas de comparaison", () => {
    /* Même liste que SKIPPED_AS_BASE du moteur micro, et pour la même raison :
       une séance coupée par construction n'est pas une régression. */
    const l = {
      name: "Développé",
      history: [
        { date: "2026-03-20", kind: "normal", load: 85, sets: [{ w: 85, r: 6, rir: 1 }] },
        { date: "2026-03-27", kind: "deload", load: 72.5, sets: [{ w: 72.5, r: 6, rir: 3 }] },
      ],
    };
    assert.equal(evaluateDeload({ keyLifts: [l, l] }, DEFAULT_POLICIES.deload, TODAY).score, 0);
  });

  test("un seuil différent change le verdict, pas le score", () => {
    const signals = { keyLifts: [lift("Développé", 85, 80), lift("Squat", 110, 105)] };
    const strict = evaluateDeload(signals, { ...DEFAULT_POLICIES.deload, signalThreshold: 2 }, TODAY);
    assert.equal(strict.score, 2);
    assert.equal(strict.recommended, true);
  });

  test("des entrées absentes ou mal formées ne lèvent pas", () => {
    for (const s of [undefined, null, {}, { keyLifts: null }, { checkins: [null, {}] }, { keyLifts: [{}] }]) {
      const r = evaluateDeload(s, DEFAULT_POLICIES.deload, TODAY);
      assert.equal(r.recommended, false, JSON.stringify(s));
    }
    assert.equal(evaluateDeload({}, null, TODAY).recommended, false);
  });
});
