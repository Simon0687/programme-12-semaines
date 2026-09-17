import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  AFTER_HINTS, AFTER_KINDS, resolveCardio, normalizeCardio, cardioTargets,
  MODALITIES, MODALITY_IDS, CARDIO_KINDS, BASELINE_KEYS, DEFAULT_CARDIO, DEFAULT_BASELINE,
} from "../src/cardio.js";
import { buildProgram } from "../src/program.js";
import { LEGACY_DEFINITION } from "../src/legacy-program.js";
import { cardioWhen, mobilityDayNames } from "../src/display.js";

/* #33 : AFTER_KINDS est la liste que le validateur contrôle, AFTER_HINTS ce
   que l'appli rend. Les dériver l'une de l'autre est ce qui garantit qu'un
   indice ajouté demain est accepté par le format sans qu'on y pense — et
   qu'aucune valeur acceptée ne fasse appeler undefined au rendu. */
test("AFTER_KINDS décrit exactement les indices rendus", () => {
  assert.deepEqual(AFTER_KINDS, Object.keys(AFTER_HINTS));
  assert.ok(AFTER_KINDS.length > 0);
});

test("chaque indice rend une phrase à partir du plan cardio de la semaine", () => {
  const cardio = resolveCardio("default").cardioPlan(3);
  for (const kind of AFTER_KINDS) {
    const text = AFTER_HINTS[kind](cardio);
    assert.equal(typeof text, "string");
    assert.ok(text.length > 0, `${kind} rend une phrase vide`);
  }
});

/* ---------- L'invariant de #34 : « default » ne change pas de sens ----------

   Des journaux stockés portent la chaîne `"default"` dans leur définition, et
   ARCHITECTURE 2.1 interdit qu'elle se mette à désigner autre chose. C'est la
   contrainte que la spec posait avant tout le reste, et ce bloc est ce qui
   l'empêche de se perdre : les chaînes ci-dessous sont celles que l'appli
   affichait avant #34, recopiées, pas recalculées. */
describe("« default » résout exactement ce qu'il résolvait", () => {
  const r = resolveCardio("default");

  test("la prescription Z2 des douze semaines, au caractère", () => {
    const T = "~105–115 W, 130–138 bpm, cadence 18–20, drag factor 110–120";
    const minutes = { 1: 35, 2: 35, 3: 40, 4: 40, 5: 45, 6: 45, 7: 30, 8: 50, 9: 55, 10: 55, 11: 60, 12: 60 };
    for (let w = 1; w <= 12; w++) {
      const expected = `${minutes[w]} min Z2 : ${T}.`
        + (w === 1 ? " Recalibrer : allure où tu peux parler, dérive de FC < 5 % sur 30 min à puissance fixe, sinon −5 W." : "");
      assert.equal(r.cardioPlan(w).z2, expected, `S${w}`);
    }
  });

  test("les intervalles n'existent qu'en bloc, et changent de dose au second", () => {
    for (const w of [1, 7, 12]) assert.equal(r.cardioPlan(w).intervals, null, `S${w}`);
    assert.equal(r.cardioPlan(3).intervals, "4 × 4 min en Z4 (~150–165 bpm), 3 min récup entre, 5 min échauffement et retour au calme. Cadence 24–28, drag factor modéré.");
    assert.equal(r.cardioPlan(9).intervals, "5 × 4 min en Z4 (~150–165 bpm), 3 min récup, cadence 24–28.");
  });

  test("les trois séances, leurs libellés et leur « quand »", () => {
    const S = LEGACY_DEFINITION.program.SESSIONS;
    assert.deepEqual(r.CARDIO_ITEMS.map((it) => [it.label, cardioWhen(it, S)]), [
      ["Rameur Z2", "mercredi, après Haut B (ou le soir)"],
      ["Rameur intervalles", "jeudi"],
      ["Rameur Z2", "dimanche"],
    ]);
  });

  test("les jours de mobilité, dans le même ordre qu'avant", () => {
    /* L'ordre n'est pas cosmétique : `ca.mob` est un tableau indexé par
       **position**, donc une permutation déplacerait les coches déjà
       enregistrées d'un jour à l'autre. */
    assert.deepEqual(mobilityDayNames(r.MOB_DAYS), ["mardi", "jeudi", "dimanche"]);
  });

  test("un champ cardio absent résout comme « default » (fichier d'avant #34)", () => {
    assert.deepEqual(resolveCardio(undefined).CARDIO_ITEMS, r.CARDIO_ITEMS);
    assert.equal(resolveCardio(undefined).cardioPlan(5).z2, r.cardioPlan(5).z2);
  });

  test("et le fichier de Simon, qui porte désormais sa structure en clair, rend la même chose", () => {
    /* C'est le cœur de la migration : `haut-bas-5j.json` n'écrit plus
       « default », il écrit sa structure. Les deux doivent être indiscernables,
       sans quoi un journal migré hier et un journal migré demain décriraient
       deux conditionnements différents. */
    const P = buildProgram(LEGACY_DEFINITION);
    for (let w = 1; w <= 12; w++) assert.deepEqual(P.cardioPlan(w), r.cardioPlan(w), `S${w}`);
    assert.deepEqual(P.CARDIO_ITEMS, r.CARDIO_ITEMS);
    assert.deepEqual(P.MOB_DAYS, r.MOB_DAYS);
  });
});

/* ---------- Le troisième terme : les nombres sont ceux d'une personne ---------- */

describe("cardioBaseline : la calibration, pas la méthode", () => {
  const spec = {
    sessions: [{ id: "z2", modality: "velo", kind: "z2", day: 2 }],
    mobility: { days: [5] },
  };

  test("un autre athlète, d'autres cibles, la même courbe", () => {
    const r = resolveCardio(spec, { power: [140, 160], hr: [125, 135], cadence: [80, 90] });
    assert.equal(r.cardioPlan(3).z2, "40 min Z2 : ~140–160 W, 125–135 bpm, cadence 80–90.");
    /* La durée vient de la courbe, qui est de la méthode : elle ne dépend ni de
       la modalité ni de la personne, et c'est exactement pour ça qu'elle reste
       dans cardio.js et pas dans le format (decisions-spec.md Q2). */
    assert.ok(r.cardioPlan(3).z2.startsWith("40 min"));
    assert.ok(r.cardioPlan(7).z2.startsWith("30 min"), "la décharge de S7 vaut pour tout le monde");
  });

  test("sans cibles, la prescription se tait au lieu de rendre un trou", () => {
    const r = resolveCardio(spec, null);
    assert.equal(r.cardioPlan(3).z2, "40 min Z2.");
    /* Et la consigne de recalibrage de S1 s'arrête avant « sinon −5 W », qui ne
       veut rien dire sans puissance prescrite. */
    assert.ok(!r.cardioPlan(1).z2.includes("−5 W"));
    assert.ok(r.cardioPlan(1).z2.includes("dérive de FC"));
  });

  test("une modalité ne montre que les cibles qui ont un sens sur elle", () => {
    /* Un drag factor sur un tapis est du bruit, et une prescription qui en
       affiche apprend à ne plus la lire. */
    const full = { power: [100, 110], hr: [130, 140], cadence: [80, 90], drag: [110, 120] };
    assert.equal(cardioTargets("rameur", full), "~100–110 W, 130–140 bpm, cadence 80–90, drag factor 110–120");
    assert.equal(cardioTargets("velo", full), "~100–110 W, 130–140 bpm, cadence 80–90");
    assert.equal(cardioTargets("marche", full), "130–140 bpm");
    assert.equal(cardioTargets("course", full), "130–140 bpm");
  });

  test("la consigne d'intervalles perd la cadence de rameur sur une autre modalité", () => {
    const r = resolveCardio({ sessions: [{ id: "i", modality: "course", kind: "intervals", day: 4 }] }, null);
    assert.equal(r.cardioPlan(3).intervals, "4 × 4 min en Z4 (~150–165 bpm), 3 min récup entre, 5 min échauffement et retour au calme.");
    assert.equal(r.cardioPlan(9).intervals, "5 × 4 min en Z4 (~150–165 bpm), 3 min récup.");
  });

  test("l'indice post-séance nomme la modalité du programme, plus « rameur » en dur", () => {
    const velo = resolveCardio(spec, null).cardioPlan(3);
    assert.ok(AFTER_HINTS.z2(velo).startsWith("vélo Z2, "));
    const rameur = resolveCardio("default").cardioPlan(3);
    assert.ok(AFTER_HINTS.z2(rameur).startsWith("rameur Z2, "), "le programme de Simon ne bouge pas");
  });
});

/* ---------- Le catalogue est fermé, comme le registre d'exercices (#25) ---------- */

describe("catalogue", () => {
  test("chaque modalité déclare des cibles qui existent, et une queue d'intervalles", () => {
    for (const [id, m] of Object.entries(MODALITIES)) {
      assert.equal(typeof m.label, "string", `${id}.label`);
      assert.ok(m.terms.length > 0, `${id}.terms`);
      for (const t of m.terms) assert.ok(BASELINE_KEYS.includes(t), `${id} : terme inconnu « ${t} »`);
      assert.equal(typeof m.intervalTail.b1, "string", `${id}.intervalTail.b1`);
      assert.equal(typeof m.intervalTail.b2, "string", `${id}.intervalTail.b2`);
    }
  });

  test("MODALITY_IDS et CARDIO_KINDS sont ce que le validateur contrôle", () => {
    assert.deepEqual([...MODALITY_IDS].sort(), Object.keys(MODALITIES).sort());
    assert.deepEqual(CARDIO_KINDS, ["z2", "intervals"]);
  });

  test("la structure de Simon figée est bien décrite par le catalogue", () => {
    for (const s of DEFAULT_CARDIO.sessions) {
      assert.ok(MODALITY_IDS.has(s.modality));
      assert.ok(CARDIO_KINDS.includes(s.kind));
      assert.ok(s.day >= 1 && s.day <= 7);
    }
    for (const k of Object.keys(DEFAULT_BASELINE)) assert.ok(BASELINE_KEYS.includes(k));
  });

  test("normalizeCardio : null quand il n'y a rien, jamais une exception", () => {
    assert.equal(normalizeCardio(null), null);
    assert.equal(normalizeCardio(42), null);
    assert.deepEqual(normalizeCardio({}).sessions, []);
    assert.deepEqual(normalizeCardio({}).mobilityDays, []);
  });
});
