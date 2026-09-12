/* =========================================================
   Contenu de l'onglet Plan — Simon (#4, #6)

   Texte éditorial du programme : aucune logique React. Consommé par
   <PlanContent> / <Block> dans App.jsx, qui mappe le résultat de
   buildPlan() à travers le composant Section. Extrait de App.jsx sans
   changement de forme ; « < » et « > » sont des caractères littéraux
   (React les échappe au rendu, comme les entités &lt; / &gt; d'avant).

   ---------------------------------------------------------
   PLAN_INTRO       ligne d'introduction, hors Section.
   buildPlan(profile, startingLoads)   sections de l'onglet, dans l'ordre
     d'affichage — seules « Nutrition » et « Charges de départ » dépendent
     du profil et des charges reçues ; le reste est invariant (#6 : un
     cycle change le profil, pas la méthode).
     id             clé stable (key React, ancrage éventuel).
     title          titre de la Section.
     open           true => Section dépliée au montage (défaut : repliée).
     blocks[]       contenu, un objet par bloc :
       { t: "p", text }                    paragraphe.
       { t: "table", variant: "weeks",  rows: [[libellé, description], …] }
       { t: "table", variant: "volume", rows: [[groupe, nb, où], …] }
                                           (nb : cellule ambre, alignée à droite)
   PHASE_NOTES[id]  note éditoriale par phase, sortie de phaseOf()
                    (progression.js). Clés = les id renvoyés par
                    phaseOf() : calib | b1 | deload | b2 | bilan.
                    Lu par App.jsx (sous-titre Séance, entête Semaine).
   ========================================================= */

const kg = (n) => String(n).replace(".", ",");                       // 72.5 -> "72,5"
const sp = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");   // 3150 -> "3 150"

export const PLAN_INTRO = "Référence du programme. Les modifications se font dans le chat, le fichier est régénéré.";

export function buildPlan(profile, startingLoads) {
  return [
  {
    id: "structure",
    title: "Structure des 12 semaines",
    open: true,
    blocks: [
      {
        t: "table",
        variant: "weeks",
        rows: [
          ["S1", "Calibration, 2–3 RIR"],
          ["S2–S6", "Bloc 1, 1 RIR, double progression"],
          ["S7", "Décharge (volume −50 %, charges −15 %, 3–4 RIR) et calibration du bloc 2"],
          ["S8–S11", "Bloc 2, 1 RIR"],
          ["S12", "Bloc 2, dernière série AMRAP sur les exercices clés, mesures, re-baseline"],
        ],
      },
      { t: "p", text: "Le programme suit un split Upper / Lower 4 jours. L'objectif est de travailler la force et l'hypertrophie sans dépendre d'un seul mouvement technique ou d'un levage trop rigide." },
    ],
  },
  {
    id: "volume",
    title: "Volume par semaine, et où il se fait",
    blocks: [
      {
        t: "table",
        variant: "volume",
        rows: [
          ["Pecs", "6", "Upper A 3 + Upper B 3"],
          ["Épaules", "6", "Upper A 2 + Upper B 4"],
          ["Dos", "6", "Upper B 3 + Upper A 3"],
          ["Triceps", "4", "Upper A 2 + Upper B 2"],
          ["Biceps", "4", "Upper B 2 + Upper A 2"],
          ["Quadriceps", "6", "Lower A 3 + Lower B 3"],
          ["Ischios / fessiers", "4", "Lower A 2 + Lower B 2"],
          ["Mollets", "6", "Lower A 3 + Lower B 3"],
          ["Abdos chargés", "8", "2 séries à chaque séance"],
          ["Gainage anti-mouvement", "8", "2 séries à chaque séance"],
        ],
      },
      { t: "p", text: "Une « série dure » = une série de travail menée à 1 RIR (ou à l'échec). Les séries d'échauffement ne comptent pas. Le volume reste modéré, avec une priorité claire sur la qualité de la charge et la régularité." },
    ],
  },
  {
    id: "progression",
    title: "Règles de progression",
    blocks: [
      { t: "p", text: "Double progression. Quand toutes les séries d'un exercice atteignent le haut de la fourchette, la charge monte à la séance suivante : barre +2,5 kg haut du corps, +5 kg bas du corps ; haltères +2 kg ; machines et poulies +5 kg ou le plus petit incrément disponible. Si 2 séries ou plus tombent sous le bas de la fourchette, on garde la charge ; si ça se répète, −5 %. L'appli calcule la charge prévue à partir de tes séances validées." },
      { t: "p", text: "Calibration (S1 et S7) : toutes les séries au haut de la fourchette → +5 % ; une série sous le bas de la fourchette → −5 %." },
      { t: "p", text: "Sur les isolations, une rep, une demi-rep ou une exécution plus stricte à charge égale comptent comme un progrès. Les mouvements de base restent dominants, puis les accessoires viennent compléter le volume et le travail local." },
      { t: "p", text: "Repos : 2–3 min sur les gros mouvements, 1–2 min sur les isolations, 1 min sur les abdos. Descente 2–4 s, montée forte. Concentrique dynamique, pas de ralentissement pour « sentir »." },
    ],
  },
  {
    id: "deload",
    title: "Décharge : déclencheurs et recette",
    blocks: [
      { t: "p", text: "Déclencheurs : baisse de performance sur ≥ 2 exercices clés pendant 2 séances de suite malgré sommeil et alimentation corrects ; douleur articulaire ≥ 3/10 qui persiste plus de 48 h ou augmente ; sommeil < 6 h plusieurs nuits ; FC de repos ou HRV dégradées 3 jours ou plus ; RIR ressenti qui dérive." },
      { t: "p", text: "Décharge complète : mêmes exercices, volume −50 %, charges −10 à −20 %, 3–4 RIR, cardio Z2 facile, une semaine. Allègement ciblé (une articulation qui se plaint) : on retire uniquement les exercices qui la sollicitent, on garde le reste, on remplace par une variante indolore. Toute douleur nouvelle = arrêt de l'exercice concerné, avis médical si elle persiste." },
    ],
  },
  {
    id: "fallback",
    title: "Plan de repli (séances manquées)",
    blocks: [
      { t: "p", text: "4 séances : Upper A, Upper B, Lower A, Lower B, ou un plan réduit en priorité des mouvements clés." },
      { t: "p", text: "3 séances : Upper A, Upper B, plus une séance jambes fusionnée (pression, curls, mollets, abdos)." },
      { t: "p", text: "2 séances : Upper A, plus un full body (développé couché, row, presse, curls, abdos)." },
      { t: "p", text: "On ne rattrape jamais la semaine suivante, on reprend le plan. Les groupes prioritaires ne sautent pas deux semaines de suite : si une semaine a été réduite, la suivante reprend le cycle normal." },
    ],
  },
  {
    id: "cardio",
    title: "Cardio et mobilité",
    blocks: [
      { t: "p", text: "Rameur Z2 deux fois par semaine : 35 min en S1–S2, +5 min toutes les deux semaines jusqu'à 60 min en S12, 30 min faciles en S7. Cibles ~105–115 W, 130–138 bpm, cadence 18–20, drag factor 110–120. La durée progresse d'abord, la puissance ensuite." },
      { t: "p", text: "Intervalles le jeudi (optionnel, S2–S6 et S8–S11) : 4 × 4 min en Z4 puis 5 × 4 min en bloc 2, 3 min de récupération, cadence 24–28. Toujours à 48 h d'une séance jambes. C'est la première chose qu'on retire si un déclencheur de décharge s'allume." },
      { t: "p", text: "Mobilité 10–15 min, 3 fois par semaine : McGill Big 3, 90/90 et couch stretch, thoracique, épaules. Échauffement spécifique avant chaque séance." },
    ],
  },
  {
    id: "nutrition",
    title: "Nutrition",
    blocks: [
      { t: "p", text: `Maintenance estimée ≈ ${sp(profile.maintenanceKcal)} kcal. Départ : ${sp(profile.startKcal)} kcal par jour, 7 jours sur 7. Protéines ${profile.macros.p} g, lipides ${profile.macros.f} g, glucides ${profile.macros.c} g. Quatre repas à 40–50 g de protéines, glucides concentrés autour des séances.` },
      { t: "p", text: "Lecture des deux premières semaines : +0,5 à 1 kg d'eau et de glycogène en S1, on juge la pente entre la moyenne de S2 et celle de S4. Pente +0,2–0,3 kg/sem → maintenance confirmée. Poids stable → maintenance. Plus de +0,4 kg/sem → réduction calorique légère." },
      { t: "p", text: `Ajustements (toutes les 2 semaines) : gain > 0,4 kg/sem sur 2 semaines → −150 à −200 kcal ; gain < 0,1 kg/sem sur 2 semaines → +100 à +150 kcal ; cible : ${kg(profile.targetWeightKg[0])}–${kg(profile.targetWeightKg[1])} kg fin S12.` },
      { t: "p", text: `Journée type, jour d'entraînement (~${sp(profile.startKcal)} kcal) : matin, flocons d'avoine, lait, fruits, whey. Midi, viande, féculents, légumes. 60–90 min avant la séance, whey + fruit ou fromage blanc + pain. Soir, poisson ou viande, féculents, légumes. Collation, yaourt grec ou fromage blanc.` },
      { t: "p", text: "Version minimale, les 4 règles qui tiennent quand la semaine part en vrille : quatre repas avec 40 g de protéines ; pesée chaque matin ; mètre ruban et bilan copié-collé le dimanche ; le plancher alimentaire ne dépend pas de la séance, séance ratée = on mange pareil." },
      { t: "p", text: `Optionnel : créatine 3–5 g/j, whey pour atteindre ${profile.macros.p} g, vitamine D 1 000–2 000 UI/j d'octobre à mars, caféine 100–200 mg avant séance.` },
    ],
  },
  {
    id: "startloads",
    title: "Charges de départ (S1)",
    blocks: [
      { t: "p", text: `Développé couché ${kg(startingLoads.dc)} kg ; développé incliné ${kg(startingLoads.incl_db)} kg par main ; row ${kg(startingLoads.row_supp)} kg ; développé épaules haltères ${kg(startingLoads.ohp_db)} kg par main ; presse à cuisses ${kg(startingLoads.legpress)} kg ; leg curl ${kg(startingLoads.lc_seat)} kg ; mollets ${kg(startingLoads.calf_stand)} kg. Tout le reste en paliers : 50 → 75 → 100 % de la charge devinée, la première série dans la fourchette à 2–3 RIR devient la charge de travail.` },
    ],
  },
  ];
}

export const PHASE_NOTES = {
  calib: "Séries à 2–3 RIR pour valider les charges. Exercices sans référence : paliers (≈ 50 → 75 → 100 % de la charge devinée), la première série dans la fourchette à 2–3 RIR devient la charge de travail.",
  b1: "Toutes les séries à 1 RIR. Dès S3, dernière série à l'échec autorisée sur les exercices stables (marqués ⚡).",
  deload: "Volume −50 %, charges −15 %, 3–4 RIR, cardio Z2 facile. Les nouvelles variantes du bloc 2 sont introduites cette semaine à 3–4 RIR : elles arrivent calibrées en S8.",
  b2: "Variantes tournées, ancres conservées (couché, squat, hip thrust). 1 RIR, dernière série à l'échec autorisée sur les ⚡.",
  bilan: "Dernière séance de chaque exercice clé : dernière série en AMRAP à la charge prévue (re-baseline par Epley). Mesures : poids moyen, tour de taille, photos.",
};
