/* =========================================================
   Contenu de l'onglet Plan (#4, #6, #26)

   Texte éditorial du programme : aucune logique React. Consommé par
   <PlanContent> / <Block> dans App.jsx, qui mappe le résultat de
   buildPlan() à travers le composant Section. « < » et « > » sont des
   caractères littéraux (React les échappe au rendu).

   ---------------------------------------------------------
   PLAN_INTRO       ligne d'introduction, hors Section.
   buildPlan(definition)   sections de l'onglet, dans l'ordre d'affichage.

     Avant #26 la fonction recevait (profile, startingLoads) et le reste du
     texte était écrit en dur autour du programme de Simon — squat, hip
     thrust, rameur, cinq séances nommées. Un programme chargé s'affichait
     donc correctement dans l'onglet Séance pendant que le Plan décrivait
     un autre programme. Elle reçoit maintenant la définition entière et
     chaque section qui parle d'un programme précis tire son contenu de la
     donnée, ou disparaît quand cette donnée est absente :

       structure    toujours — la périodisation est de la méthode, pas du
                    programme. La phrase sur les ancres est dérivée des
                    slots `key` dont b1 et b2 nomment la même variante.
       volume       program.volume (lignes [groupe, nb, où]) — absent =>
                    section omise.
       progression  toujours (méthode, cf. progression.js).
       deload       toujours (méthode).
       fallback     program.fallback (tableau de paragraphes) — absent =>
                    section omise.
       cardio       omise quand program.cardio vaut null (#25/#13).
       nutrition    omise quand la définition n'a pas de profil (#27).
       startloads   omise quand startingLoads est vide ; le texte est
                    dérivé des entrées et des noms du registre, il ne cite
                    plus d'exercices en dur.

     Structure d'une section :
       id           clé stable (key React, ancrage éventuel).
       title        titre de la Section.
       open         true => Section dépliée au montage (défaut : repliée).
       blocks[]     contenu, un objet par bloc :
         { t: "p", text }                    paragraphe.
         { t: "table", variant: "weeks",  rows: [[libellé, description], …] }
         { t: "table", variant: "volume", rows: [[groupe, nb, où], …] }
                                             (nb : cellule ambre, alignée à droite)

   PHASE_NOTES[id]  note éditoriale par phase, sortie de phaseOf()
                    (progression.js). Clés = les id renvoyés par phaseOf() :
                    calib | b1 | deload | b2 | bilan. Lu par App.jsx
                    (sous-titre Séance, entête Semaine).
   ========================================================= */

import { EXERCISES } from "./registry.js";

const kg = (n) => String(n).replace(".", ",");                       // 72.5 -> "72,5"
const sp = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");   // 3150 -> "3 150"

export const PLAN_INTRO = "Référence du programme. Les modifications se font dans le chat, le fichier est régénéré.";

/* Ancres du cycle : les exercices clés que le bloc 2 ne fait pas tourner
   (b1 === b2). Dérivé plutôt qu'écrit en dur — c'est une propriété du
   programme chargé, pas du programme de l'auteur. */
function anchorNames(SLOTS) {
  return Object.values(SLOTS)
    .filter((s) => s.key && s.b1 === s.b2)
    .map((s) => (EXERCISES[s.b1] ? EXERCISES[s.b1].name : s.b1))
    .map((n) => n.toLowerCase());
}

function startLoadsText(startingLoads) {
  const parts = Object.entries(startingLoads).map(([vid, load]) => {
    const v = EXERCISES[vid];
    const name = v ? v.name : vid;
    if (v && (v.unit || "kg") === "bw") return load > 0 ? `${name} lesté de ${kg(load)} kg` : `${name} au poids du corps`;
    return `${name} ${kg(load)} kg${v && v.perHand ? " par main" : ""}`;
  });
  return `${parts.join(" ; ")}. Tout le reste en paliers : 50 → 75 → 100 % de la charge devinée, la première série dans la fourchette à 2–3 RIR devient la charge de travail.`;
}

export function buildPlan(definition) {
  const program = definition.program || {};
  const SLOTS = program.SLOTS || {};
  const startingLoads = definition.startingLoads || {};
  const profile = definition.profile;
  const anchors = anchorNames(SLOTS);

  const sections = [
    {
      id: "structure",
      title: `Structure des ${definition.weeks} semaines`,
      open: true,
      blocks: [
        {
          t: "table",
          variant: "weeks",
          rows: [
            ["S1", "Calibration, 2–3 RIR"],
            ["S2–S6", "Bloc 1, 1 RIR, double progression"],
            ["S7", "Décharge (volume −50 %, charges −15 %, 3–4 RIR) et calibration des variantes du bloc 2"],
            ["S8–S11", "Bloc 2, 1 RIR"],
            ["S12", "Bloc 2, dernière série AMRAP sur les exercices clés, mesures, re-baseline"],
          ],
        },
        {
          t: "p",
          text: anchors.length
            ? `Ancres conservées sur les deux blocs : ${anchors.join(", ")}. Les autres créneaux changent de variante en S7 : la charge y repart en paliers, c'est le rôle de la semaine de calibration. Point volume à la fin de S4 : on décide s'il faut ajouter des séries sur les groupes prioritaires dès S5.`
            : "Tous les créneaux changent de variante en S7 : la charge y repart en paliers, c'est le rôle de la semaine de calibration. Point volume à la fin de S4 : on décide s'il faut ajouter des séries sur les groupes prioritaires dès S5.",
        },
      ],
    },

    program.volume && program.volume.length ? {
      id: "volume",
      title: "Volume par semaine, et où il se fait",
      blocks: [
        { t: "table", variant: "volume", rows: program.volume },
        { t: "p", text: "Une « série dure » = une série de travail menée à 1 RIR (ou à l'échec). Les séries d'échauffement ne comptent pas." },
      ],
    } : null,

    {
      id: "progression",
      title: "Règles de progression",
      blocks: [
        { t: "p", text: "Double progression. Quand toutes les séries d'un exercice atteignent le haut de la fourchette, la charge monte à la séance suivante : barre +2,5 kg haut du corps, +5 kg bas du corps ; haltères +2 kg ; machines et poulies +5 kg ou le plus petit incrément disponible. Si 2 séries ou plus tombent sous le bas de la fourchette, on garde la charge ; si ça se répète, −5 %. L'appli calcule la charge prévue à partir de tes séances validées." },
        { t: "p", text: "Calibration (S1 et S7) : toutes les séries au haut de la fourchette → +5 % ; une série sous le bas de la fourchette → −5 %." },
        { t: "p", text: "Sur les isolations, une rep, une demi-rep ou une exécution plus stricte à charge égale comptent comme un progrès. Sur les mouvements au poids du corps, le lest prend le relais dès que le haut de la fourchette est tenu à 1 RIR." },
        { t: "p", text: "Repos : 2–3 min sur les gros mouvements, 1–2 min sur les isolations, 1 min sur les abdos. Descente 2–4 s, montée forte. Concentrique dynamique, pas de ralentissement pour « sentir »." },
      ],
    },

    {
      id: "deload",
      title: "Décharge : déclencheurs et recette",
      blocks: [
        { t: "p", text: "Déclencheurs : baisse de performance sur ≥ 2 exercices clés pendant 2 séances de suite malgré sommeil et alimentation corrects ; douleur articulaire ≥ 3/10 qui persiste plus de 48 h ou augmente ; sommeil < 6 h plusieurs nuits ; FC de repos ou HRV dégradées 3 jours ou plus ; RIR ressenti qui dérive." },
        { t: "p", text: "Décharge complète : mêmes exercices, volume −50 %, charges −10 à −20 %, 3–4 RIR, une semaine. Allègement ciblé (une articulation qui se plaint) : on retire uniquement les exercices qui la sollicitent, on garde le reste, on remplace par une variante indolore. Toute douleur nouvelle = arrêt de l'exercice concerné, avis médical si elle persiste." },
      ],
    },

    program.fallback && program.fallback.length ? {
      id: "fallback",
      title: "Plan de repli (séances manquées)",
      blocks: program.fallback.map((text) => ({ t: "p", text })),
    } : null,

    program.cardio !== null ? {
      id: "cardio",
      title: "Cardio et mobilité",
      blocks: [
        { t: "p", text: "Rameur Z2 deux fois par semaine : 35 min en S1–S2, +5 min toutes les deux semaines jusqu'à 60 min en S12, 30 min faciles en S7. Cibles ~105–115 W, 130–138 bpm, cadence 18–20, drag factor 110–120. La durée progresse d'abord, la puissance ensuite." },
        { t: "p", text: "Intervalles (optionnel, S2–S6 et S8–S11) : 4 × 4 min en Z4 puis 5 × 4 min en bloc 2, 3 min de récupération, cadence 24–28 pour limiter la charge lombaire. Toujours à 48 h d'une séance jambes. C'est la première chose qu'on retire si un déclencheur de décharge s'allume." },
        { t: "p", text: "Mobilité 10–15 min, 3 fois par semaine : McGill Big 3 en pyramide descendante, 90/90 et couch stretch, thoracique, épaules. Échauffement spécifique avant chaque séance (voir la séance)." },
      ],
    } : null,

    profile ? {
      id: "nutrition",
      title: "Nutrition",
      blocks: [
        { t: "p", text: `Maintenance estimée ≈ ${sp(profile.maintenanceKcal)} kcal. Départ : ${sp(profile.startKcal)} kcal par jour, 7 jours sur 7. Protéines ${profile.macros.p} g, lipides ${profile.macros.f} g, glucides ${profile.macros.c} g. Quatre repas à 40–50 g de protéines, glucides concentrés autour des séances.` },
        { t: "p", text: "Lecture des deux premières semaines : +0,5 à 1 kg d'eau et de glycogène en S1, on juge la pente entre la moyenne de S2 et celle de S4. Pente +0,2–0,3 kg/sem → maintenance confirmée." },
        { t: "p", text: `Ajustements (toutes les 2 semaines) : gain > 0,4 kg/sem sur 2 semaines ou taille +1 cm sur 2 semaines → −150 à −200 kcal ; gain < 0,1 kg/sem sur 2 semaines → +100 à +150 kcal ; taille +3 cm cumulés ou masse grasse estimée ≥ 15–16 % → retour à maintenance et réévaluation. Cible : ${kg(profile.targetWeightKg[0])}–${kg(profile.targetWeightKg[1])} kg fin S12.` },
        { t: "p", text: `Journée type, jour d'entraînement (~${sp(profile.startKcal)} kcal) : matin, 100 g de flocons d'avoine, 300 ml de lait, une banane, 30 g de whey, 20 g d'amandes. Midi, 150 g de poulet, 120 g de riz basmati (cru), légumes, une cuillère d'huile d'olive, un yaourt grec. 60–90 min avant la séance, 200 g de fromage blanc, 2 tranches de pain complet et de la confiture. Soir, 150 g de saumon ou de bœuf 5 %, 300 g de pommes de terre, légumes, une cuillère d'huile. Collation, 250 g de fromage blanc, 30 g de miel, 30 g de noix. Jour de repos : mêmes totaux, la collation pré-séance devient un goûter.` },
        { t: "p", text: "Version minimale, les 4 règles qui tiennent quand la semaine part en vrille : quatre repas avec 40 g de protéines ; pesée chaque matin ; mètre ruban et bilan copié-collé le dimanche ; le plancher alimentaire ne dépend pas de la séance, séance ratée = on mange pareil." },
        { t: "p", text: `Optionnel : créatine 3–5 g/j, whey pour atteindre ${profile.macros.p} g, vitamine D 1 000–2 000 UI/j d'octobre à mars, caféine 100–200 mg avant séance.` },
      ],
    } : null,

    Object.keys(startingLoads).length ? {
      id: "startloads",
      title: "Charges de départ (S1)",
      blocks: [{ t: "p", text: startLoadsText(startingLoads) }],
    } : null,
  ];

  return sections.filter(Boolean);
}

export const PHASE_NOTES = {
  calib: "Séries à 2–3 RIR pour valider les charges. Exercices sans référence : paliers (≈ 50 → 75 → 100 % de la charge devinée), la première série dans la fourchette à 2–3 RIR devient la charge de travail.",
  b1: "Toutes les séries à 1 RIR. Dès S3, dernière série à l'échec autorisée sur les exercices stables (marqués ⚡).",
  deload: "Volume −50 %, charges −15 %, 3–4 RIR. Les nouvelles variantes du bloc 2 sont introduites cette semaine à 3–4 RIR : elles arrivent calibrées en S8.",
  b2: "Variantes tournées, ancres conservées. 1 RIR, dernière série à l'échec autorisée sur les ⚡.",
  bilan: "Dernière séance de chaque exercice clé : dernière série en AMRAP à la charge prévue (re-baseline par Epley). Mesures : poids moyen, tour de taille, photos.",
};
