/* =========================================================
   Profil et Nutrition — du biométrique au calcul (#121)

   Méthode pure, comme cardio.js : aucun import d'écran, aucune donnée de
   programme particulier. `plan.js` consomme ces fonctions pour construire
   les blocs de la section Nutrition ; `App.jsx` les appelle pour calculer
   les champs dérivés avant d'écrire le profil (le recalcul est le seul
   chemin d'écriture des 4 champs dérivés — decisions-spec.md #121 Q1).

   `bodyweightKg`, `heightCm` reprennent les noms déjà posés sur le profil
   de Simon (public/programs/haut-bas-5j.json, depuis #5) plutôt que d'en
   inventer d'autres — jusqu'ici présents mais jamais lus par aucun calcul.
   `birthdate` (déjà présent aussi) donne l'âge, dérivé plutôt que stocké à
   part : un champ "âge" faudrait le corriger à la main chaque année,
   `birthdate` ne change jamais.
   ========================================================= */

import { parseLocalDate } from "./definition.js";

/* Trois paliers (decisions-spec.md #121 Q3) : la table Si/Alors corrige déjà
   l'estimation initiale sur la base de mesures réelles, la précision du
   palier de départ compte donc moins que la simplicité du formulaire. */
export const ACTIVITY_FACTORS = { sedentaire: 1.2, modere: 1.4, actif: 1.6 };
export const ACTIVITY_LABELS = { sedentaire: "Sédentaire", modere: "Modéré", actif: "Actif" };

export const OBJECTIVES = ["masse", "seche", "maintien"];
export const OBJECTIVE_LABELS = { masse: "Prise de masse", seche: "Sèche", maintien: "Maintien" };

export function ageFrom(birthdate, today) {
  const b = parseLocalDate(birthdate);
  let age = today.getFullYear() - b.getFullYear();
  const beforeBirthdayThisYear = today.getMonth() < b.getMonth()
    || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate());
  if (beforeBirthdayThisYear) age -= 1;
  return age;
}

/* Mifflin-St Jeor : la formule la plus citée aujourd'hui. A besoin du sexe
   biologique en plus de taille/poids/âge — les deux seules variantes
   qu'elle porte (décision de Simon, 2026-09-26). */
function bmr({ heightCm, bodyweightKg, age, sexe }) {
  const base = 10 * bodyweightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sexe === "f" ? base - 161 : base + 5);
}

/* Rythme visé par semaine, en kg — modéré dans les deux sens : la sèche va
   un peu plus vite que la masse ne monte, pour ne pas s'éterniser, sans
   sacrifier le muscle (protéines hautes dans computeNutritionProfile). */
const WEEKLY_RATE = {
  masse: [0.2, 0.3],
  seche: [-0.5, -0.35],
  maintien: [0, 0],
};

/* Part de surplus/déficit sur la maintenance — cohérent avec le rythme visé
   sans dépendre d'une formule Harris-Benedict séparée : une chaîne, pas deux. */
const KCAL_DELTA_FRACTION = { masse: 0.10, seche: -0.18, maintien: 0 };

/* g de protéines par kg de poids de corps : haut dans les deux cas pour
   protéger le muscle, plus haut encore en sèche (déficit). */
const PROTEIN_PER_KG = { masse: 2.0, seche: 2.2, maintien: 1.8 };
const FAT_PER_KG = 0.8;

export function computeNutritionProfile(raw, today) {
  const age = ageFrom(raw.birthdate, today);
  const { bodyweightKg, objectif } = raw;
  const maintenanceKcal = Math.round(bmr({ ...raw, age }) * (ACTIVITY_FACTORS[raw.activite] ?? ACTIVITY_FACTORS.modere));
  const fraction = KCAL_DELTA_FRACTION[objectif] ?? 0;
  const startKcal = Math.round(maintenanceKcal * (1 + fraction));

  const p = Math.round(bodyweightKg * (PROTEIN_PER_KG[objectif] ?? PROTEIN_PER_KG.maintien));
  const f = Math.round(bodyweightKg * FAT_PER_KG);
  const c = Math.max(0, Math.round((startKcal - p * 4 - f * 9) / 4));

  const [lo, hi] = WEEKLY_RATE[objectif] ?? WEEKLY_RATE.maintien;
  const targetWeightKg = [
    Math.round((bodyweightKg + 12 * Math.min(lo, hi)) * 10) / 10,
    Math.round((bodyweightKg + 12 * Math.max(lo, hi)) * 10) / 10,
  ];

  return { ...raw, maintenanceKcal, startKcal, macros: { p, f, c }, targetWeightKg };
}

/* La table Si/Alors existante (plan.js) généralisée aux trois objectifs —
   même structure, seuils et sens inversés en sèche (decisions-spec.md
   #121 Q2 : le poids hebdo alimente cette table, jamais le calcul du
   métabolisme lui-même). */
export function adjustmentTable(objectif) {
  if (objectif === "seche") {
    return [
      ["Perte < 0,2 kg/sem sur 2 semaines", "−100 à −150 kcal"],
      ["Perte > 0,7 kg/sem sur 2 semaines, ou fonte de force marquée", "+100 à +150 kcal (déficit trop dur, risque musculaire)"],
      ["Poids stable sur 3 semaines, faim ingérable", "pause en maintenance et réévaluation"],
    ];
  }
  if (objectif === "maintien") {
    return [["Poids qui dérive de plus de 1 kg sur 2 semaines, dans un sens ou l'autre", "±100 kcal pour recentrer"]];
  }
  return [
    ["Gain > 0,4 kg/sem sur 2 semaines, ou taille +1 cm sur 2 semaines", "−150 à −200 kcal"],
    ["Gain < 0,1 kg/sem sur 2 semaines", "+100 à +150 kcal"],
    ["Taille +3 cm cumulés, ou masse grasse estimée ≥ 15–16 %", "retour à maintenance et réévaluation"],
  ];
}

/* Lecture des deux premières semaines : le biais initial va dans le sens
   opposé au vrai signal (eau/glycogène qui monte en masse, qui descend en
   sèche), dans les deux cas un bruit qui se dissipe en deux semaines. */
export function firstWeeksNote(objectif) {
  if (objectif === "seche") {
    return "−1 à 2 kg d'eau et de glycogène en S1 (souvent plus vite que la vraie perte de gras), on juge la pente entre la moyenne de S2 et celle de S4.";
  }
  if (objectif === "maintien") {
    return "Le poids peut osciller de quelques centaines de grammes d'une semaine à l'autre sans rien vouloir dire ; on juge la moyenne, pas un jour.";
  }
  return "+0,5 à 1 kg d'eau et de glycogène en S1, on juge la pente entre la moyenne de S2 et celle de S4. Pente +0,2–0,3 kg/sem → maintenance confirmée.";
}

/* Le brief copiable : kcal/macros/objectif, et le rythme d'entraînement
   (decisions-spec.md #121 Q4) — déjà connu de l'app, ne coûte rien de plus
   et évite de perdre l'information que le texte hardcodé donnait (jour
   d'entraînement vs repos). Pas de génération de repas : c'est le rôle
   d'une IA externe, l'app ne porte pas de base d'aliments. */
export function aiBrief(profile, sessionsPerWeek) {
  const { startKcal, macros, objectif } = profile;
  const objectifTxt = OBJECTIVE_LABELS[objectif] ?? objectif;
  return [
    `Objectif : ${objectifTxt}.`,
    `Cible : ${startKcal} kcal/jour, ${macros.p} g de protéines, ${macros.f} g de lipides, ${macros.c} g de glucides.`,
    `Rythme d'entraînement : ${sessionsPerWeek} séance${sessionsPerWeek > 1 ? "s" : ""} par semaine.`,
    "Propose-moi un exemple de journée alimentaire (jour d'entraînement et jour de repos) qui atteint ces chiffres, sans base d'aliments imposée — à toi de choisir des repas réalistes.",
  ].join("\n");
}
