/* =========================================================
   Règle cardio et mobilité — #25

   Extrait de src/program.js sans changement de forme ni de contenu (#3
   pour l'origine de ces données). C'est la règle bundlée "default" —
   periodisation cardio, comme progression.js pour les charges : de la
   méthode, pas de la donnée par programme (#25 decisions.md). Un
   `program` la référence par son nom (`cardio: "default" | null`),
   jamais en la réécrivant en JSON.

   ---------------------------------------------------------
   cardioPlan(w) -> { z2, intervals | null, mob } : chaînes affichées.
                    intervals est null en S1, S7 et S12.
   CARDIO_ITEMS[] — lignes de la check-list cardio : { id, label, when }.
                    id "int" = intervalles, masquée quand
                    cardioPlan(w).intervals est null.
   MOB_DAYS[] — libellés des 3 jours de mobilité (cases à cocher).
   CARDIO_DAY_NOTES[jour] — fragment cardio ajouté à la ligne « Aujourd'hui »
                    de la Séance (jour : 0 = dimanche … 6 = samedi ;
                    jours sans cardio absents).
   ========================================================= */

export const cardioPlan = (w) => {
  const z2 = w === 7 ? 30 : Math.min(60, 35 + 5 * Math.floor((w - 1) / 2));
  const intervals = w >= 2 && w <= 6 ? "4 × 4 min en Z4 (~150–165 bpm), 3 min récup entre, 5 min échauffement et retour au calme. Cadence 24–28, drag factor modéré."
    : w >= 8 && w <= 11 ? "5 × 4 min en Z4 (~150–165 bpm), 3 min récup, cadence 24–28." : null;
  return {
    z2: `${z2} min Z2 : ~105–115 W, 130–138 bpm, cadence 18–20, drag factor 110–120.${w === 1 ? " Recalibrer : allure où tu peux parler, dérive de FC < 5 % sur 30 min à puissance fixe, sinon −5 W." : ""}`,
    intervals,
    mob: "10–15 min : McGill Big 3 en pyramide descendante (curl-up modifié, planche latérale, bird dog ; 6-4-2 tenues de 8–10 s), 90/90 + couch stretch, extension et rotation thoracique, CARs d'épaule + rotation externe.",
  };
};

export const CARDIO_ITEMS = [
  { id: "z2a", label: "Rameur Z2", when: "mercredi, après Haut B (ou le soir)" },
  { id: "int", label: "Rameur intervalles", when: "jeudi" },
  { id: "z2b", label: "Rameur Z2", when: "dimanche" },
];
export const MOB_DAYS = ["mardi", "jeudi", "dimanche"];

export const CARDIO_DAY_NOTES = {
  0: "rameur Z2 + mobilité",
  2: " puis mobilité",
  3: " puis rameur Z2",
  4: "rameur intervalles + mobilité",
};
