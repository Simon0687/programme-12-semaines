import test from "node:test";
import assert from "node:assert/strict";
import { buildBilan } from "../src/bilan.js";

/* Ces tests verrouillent le texte tel qu'App.jsx le produisait avant
   l'extraction. Ils existent pour que le changement de contenu qui suit
   (#41 : les notes de séance entrent, « Douleurs » sort) se lise dans un
   diff de test plutôt que de se discuter. */

const full = {
  week: 3,
  range: "28 sept. – 4 oct.",
  phaseLabel: "Bloc 1",
  checkin: { poids: "78,5", taille: "84", sommeil: "6,5", energie: "3", rir: "dérive vers 2", douleurs: "épaule 2/10", nutrition: "deux restaurants", remarques: "RAS" },
  doneCount: 4,
  sessionCount: 4,
  missing: [],
  cardioLine: "Cardio : Z2 45 min — mobilité 2/3",
  keyLines: ["Développé couché haltères : 32 kg 10/10/9/9 @ 1 RIR", "Hack squat : 90 kg 9/9/8/8 @ 1 RIR"],
};

test("buildBilan : un bilan complet, ligne à ligne", () => {
  assert.equal(buildBilan(full), [
    "Bilan S3 (28 sept. – 4 oct.) — Bloc 1",
    "1. Poids moyen : 78,5 kg — tour de taille : 84 cm",
    "2. Sommeil moyen : 6,5 h",
    "3. Séances : 4/4",
    "4. Cardio : Z2 45 min — mobilité 2/3",
    "5. Exos clés : Développé couché haltères : 32 kg 10/10/9/9 @ 1 RIR ; Hack squat : 90 kg 9/9/8/8 @ 1 RIR",
    "6. Douleurs : épaule 2/10 / RIR ressenti global : dérive vers 2 / énergie : 3/5",
    "7. Nutrition : deux restaurants",
    "8. Remarques : RAS",
  ].join("\n"));
});

test("buildBilan : rien de rempli => des ? et des repli, jamais de trou", () => {
  const out = buildBilan({ week: 1, range: "14 – 20 sept.", phaseLabel: "Calibration", sessionCount: 4 });
  assert.equal(out, [
    "Bilan S1 (14 – 20 sept.) — Calibration",
    "1. Poids moyen : ? kg — tour de taille : ? cm",
    "2. Sommeil moyen : ? h",
    "3. Séances : 0/4",
    "4. Exos clés : aucune séance validée",
    "5. Douleurs : aucune / RIR ressenti global : ? / énergie : ?/5",
    "6. Nutrition : RAS",
    "7. Remarques : —",
  ].join("\n"));
});

test("buildBilan : une ligne absente disparaît de la numérotation (#13)", () => {
  /* Un programme sans cardio ne doit pas annoncer « Cardio : aucun » : la
     ligne n'existe pas, et les suivantes se renumérotent. */
  const withCardio = buildBilan({ ...full, cardioLine: "Cardio : aucun" });
  const without = buildBilan({ ...full, cardioLine: null });
  assert.ok(withCardio.includes("4. Cardio : aucun"));
  assert.ok(!without.includes("Cardio"));
  assert.ok(without.includes("4. Exos clés :"));
  assert.equal(without.split("\n").length, withCardio.split("\n").length - 1);
});

test("buildBilan : les séances manquées sont nommées", () => {
  const out = buildBilan({ ...full, doneCount: 2, missing: ["Upper B", "Lower B"] });
  assert.ok(out.includes("3. Séances : 2/4 — manquées : Upper B, Lower B"));
});

test("buildBilan : checkin absent ou null ne fait pas lever", () => {
  assert.ok(buildBilan({ week: 1, range: "x", phaseLabel: "y", checkin: null }).includes("Poids moyen : ? kg"));
  assert.ok(buildBilan({ week: 1, range: "x", phaseLabel: "y" }).includes("Poids moyen : ? kg"));
});
