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
     donc correctement dans l'écran Séance pendant que le Plan décrivait
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
         { t: "h", text }                    intertitre dans la page (#104).
         { t: "ul", items: [texte, …] }      liste à puces (#104).
         { t: "table", variant: "weeks",  rows: [[libellé, description], …] }
         { t: "table", variant: "volume", rows: [[groupe, nb, où], …] }
                                             (nb : cellule ambre, alignée à droite)

   PHASE_NOTES[id]  note éditoriale par phase, sortie de phaseOf()
                    (progression.js). Clés = les id renvoyés par phaseOf() :
                    calib | b1 | deload | b2 | bilan. Lu par App.jsx
                    (sous-titre Séance, entête Semaine).
   ========================================================= */

import { EXERCISES } from "./registry.js";
import { normalizeCardio, cardioTargets, MODALITIES } from "./cardio.js";
import { dayName } from "./display.js";

const kg = (n) => String(n).replace(".", ",");                       // 72.5 -> "72,5"
const sp = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");   // 3150 -> "3 150"

/* La phrase disait « les modifications se font dans le chat, le fichier est
   régénéré » : c'était vrai tant que produire un programme voulait dire le
   faire écrire par un LLM et charger le JSON qu'il rendait. #36 a livré
   l'éditeur et #58 le moteur (decisions-moteur.md Q1 = B, 2026-09-15), et les
   deux boutons sont dans cet onglet, sous la section Programme. Un lecteur
   qui suivait l'ancienne consigne cherchait un chat qui n'existe pas.
   Relevé par la revue Claude Design du 2026-09-17, qui recopiait fidèlement
   la ligne dans sa maquette (docs/reviews/2026-09-17-plan-drill-in-triage.md
   §4). */
export const PLAN_INTRO = "Référence du programme. Pour en changer : compose ou génère un programme depuis la section Programme, ci-dessous.";

/* Ancres du cycle : les exercices clés que le bloc 2 ne fait pas tourner
   (b1 === b2). Dérivé plutôt qu'écrit en dur — c'est une propriété du
   programme chargé, pas du programme de l'auteur. */
function anchorNames(SLOTS) {
  return Object.values(SLOTS)
    .filter((s) => s.key && s.b1 === s.b2)
    .map((s) => (EXERCISES[s.b1] ? EXERCISES[s.b1].name : s.b1))
    .map((n) => n.toLowerCase());
}

/* #104 : une charge par exercice, donc une ligne par exercice. Jointes par
   des points-virgules, neuf entrées faisaient un paragraphe de 402 caractères
   qu'il fallait relire pour retrouver un seul nom — alors que c'est
   exactement la question qu'on vient poser à cette page. La règle des paliers
   reste un paragraphe : elle ne parle d'aucun exercice en particulier. */
function startLoadsBlocks(startingLoads) {
  const items = Object.entries(startingLoads).map(([vid, load]) => {
    const v = EXERCISES[vid];
    const name = v ? v.name : vid;
    if (v && (v.unit || "kg") === "bw") return load > 0 ? `${name} lesté de ${kg(load)} kg` : `${name} au poids du corps`;
    return `${name} ${kg(load)} kg${v && v.perHand ? " par main" : ""}`;
  });
  return [
    { t: "ul", items },
    { t: "p", text: "Tout le reste en paliers : 50 → 75 → 100 % de la charge devinée, la première série dans la fourchette à 2–3 RIR devient la charge de travail." },
  ];
}


/* ---------- La section cardio, dérivée (#34) ----------

   Trois paragraphes écrits en dur décrivaient le rameur de Simon sous
   n'importe quel programme demandant du cardio. Chaque morceau vient
   maintenant d'où il appartient :

     la modalité et le nombre de séances  -> program.cardio.sessions
     les cibles chiffrées                 -> definition.cardioBaseline
     la forme de la montée, les seuils    -> la méthode, ci-dessous

   La courbe reste écrite ici parce qu'elle est la même pour tout le monde :
   35 min qui montent de 5 en 5 toutes les deux semaines, 30 min faciles en
   S7. C'est la description en prose de `cardioCurve()` (cardio.js), et les
   deux bougeront ensemble le jour où #14 remplacera les numéros de semaine.

   Chaque paragraphe disparaît quand sa matière n'existe pas : pas
   d'intervalles déclarés, pas de paragraphe d'intervalles — au lieu d'un
   texte qui prescrit ce que le programme ne contient pas. */
const NUMBER_WORDS = ["zéro", "une", "deux", "trois", "quatre", "cinq", "six", "sept"];
const times = (n) => `${NUMBER_WORDS[n] || n} fois par semaine`;

function cardioSection(spec, baseline) {
  if (spec === null) return null;
  const c = normalizeCardio(spec, baseline);
  if (!c || !c.sessions.length) return null;

  const blocks = [];
  const z2 = c.sessions.filter((s) => s.kind === "z2");
  const iv = c.sessions.filter((s) => s.kind === "intervals");

  if (z2.length) {
    const label = (MODALITIES[c.modalityOf("z2")] || {}).label || c.modalityOf("z2");
    const targets = cardioTargets(c.modalityOf("z2"), c.baseline);
    /* « la puissance ensuite » ne veut rien dire sans puissance prescrite :
       sur une modalité qui n'en porte pas, la phrase s'arrête à la durée. */
    const order = c.baseline && c.baseline.power
      ? " La durée progresse d'abord, la puissance ensuite."
      : " La durée progresse d'abord.";
    blocks.push({
      t: "p",
      text: `${label} Z2 ${times(z2.length)} : 35 min en S1–S2, +5 min toutes les deux semaines jusqu'à 60 min en S12, 30 min faciles en S7.`
        + (targets ? ` Cibles ${targets}.` : "")
        + order,
    });
  }

  if (iv.length) {
    const m = MODALITIES[c.modalityOf("intervals")];
    /* La cadence de rameur est une consigne de rameur : elle limite la charge
       lombaire d'un mouvement que la marche inclinée n'a pas. */
    const cadence = m && m.terms.includes("cadence") ? ", cadence 24–28 pour limiter la charge lombaire" : "";
    blocks.push({
      t: "p",
      text: `Intervalles (optionnel, S2–S6 et S8–S11) : 4 × 4 min en Z4 puis 5 × 4 min en bloc 2, 3 min de récupération${cadence}.`
        + " Toujours à 48 h d'une séance jambes. C'est la première chose qu'on retire si un déclencheur de décharge s'allume.",
    });
  }

  if (c.mobilityDays.length) {
    blocks.push({
      t: "p",
      text: `Mobilité 10–15 min, ${c.mobilityDays.length} fois par semaine : McGill Big 3 en pyramide descendante, 90/90 et couch stretch, thoracique, épaules. Échauffement spécifique avant chaque séance (voir la séance).`,
    });
  }

  if (!blocks.length) return null;
  /* Le compte que 1c demande, et celui qui n'était pas dicible avant #34 :
     sous « default », il aurait compté les séances de Simon sous n'importe
     quel programme. */
  const days = c.sessions.map((s) => s.day).sort((a, b) => a - b);
  const meta = `${c.sessions.length} séance${c.sessions.length > 1 ? "s" : ""} · ${days.map(dayName).join(", ")}`;
  return { id: "cardio", title: "Cardio et mobilité", group: "programme", meta, blocks };
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
      group: "methode",
      meta: "Calibration, bloc 1, décharge, bloc 2, bilan",
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
        /* #104 : les ancres étaient énumérées au milieu d'un paragraphe qui
           disait ensuite deux autres choses. Une liste d'exercices se lit en
           liste — et la phrase sur les autres créneaux redevient lisible une
           fois qu'elle ne traîne plus sept noms derrière elle. */
        ...(anchors.length
          ? [
            { t: "h", text: "Ancres conservées sur les deux blocs" },
            { t: "ul", items: anchors },
            { t: "p", text: "Les autres créneaux changent de variante en S7 : la charge y repart en paliers, c'est le rôle de la semaine de calibration." },
          ]
          : [
            { t: "p", text: "Tous les créneaux changent de variante en S7 : la charge y repart en paliers, c'est le rôle de la semaine de calibration." },
          ]),
        { t: "p", text: "Point volume à la fin de S4 : on décide s'il faut ajouter des séries sur les groupes prioritaires dès S5." },
      ],
    },

    program.volume && program.volume.length ? {
      id: "volume",
      title: "Volume par semaine, et où il se fait",
      group: "programme",
      meta: `${program.volume.length} groupes · ${Math.max(...program.volume.map((r) => Number(r[1]) || 0))} séries max`,
      blocks: [
        { t: "table", variant: "volume", rows: program.volume },
        { t: "p", text: "Une « série dure » = une série de travail menée à 1 RIR (ou à l'échec). Les séries d'échauffement ne comptent pas." },
      ],
    } : null,

    {
      id: "progression",
      title: "Règles de progression",
      group: "methode",
      meta: "Double progression · incréments par exercice",
      blocks: [
        /* #104 : 472 caractères qui disaient trois choses — la règle, les
           incréments, et quoi faire quand ça ne passe pas. Les incréments
           étaient le pire : quatre valeurs par matériel, en points-virgules,
           au milieu d'une phrase. Ce sont les trois blocs ci-dessous, mot
           pour mot. */
        { t: "h", text: "Double progression" },
        { t: "p", text: "Quand toutes les séries faites à ta charge de travail atteignent le haut de la fourchette — 8 reps sur du 4–8 —, la charge monte à la séance suivante." },
        { t: "ul", items: [
          "Barre : +2,5 kg haut du corps, +5 kg bas du corps",
          "Haltères : +2 kg",
          "Machines et poulies : +5 kg, ou le plus petit incrément disponible",
        ] },
        { t: "p", text: "Si 2 séries ou plus tombent sous le bas de la fourchette, on garde la charge ; si ça se répète, −5 %. L'appli calcule la charge prévue à partir de tes séances validées." },
        /* Rien ici sur le choix de la charge de travail quand une séance en
           porte plusieurs, et c'est délibéré (#31). Deux versions y sont passées
           — le seuil de sélection énoncé en toutes lettres, puis un simple
           renvoi vers la ligne « Prévu » — et les deux expliquaient ce qui se
           montre déjà : cette ligne porte « (jugé sur 100 kg) » exactement dans
           ce cas-là, au moment où il se produit, avec le vrai nombre. Le seuil
           vit dans progression.js, écrit à côté de l'autre, pour qui touche au
           moteur. « À ta charge de travail », ci-dessus, se lit en français
           courant et n'a pas besoin d'être défini. */
        /* Dit ce que rien d'autre ne montre : que ce marquage existe, et ce
           qu'il change. La conséquence, pas le concept — pas un mot de
           « décharge » ni de « référence de progression ». La seconde moitié
           existe pour que personne ne cherche un réglage qu'il n'a jamais vu :
           la question ne se pose que quand on descend (#43). */
        { t: "h", text: "Séance allégée" },
        { t: "p", text: "Une séance que tu marques allégée ne change pas tes charges de référence : la suivante repart de là où tu en étais. L'appli te le propose seulement quand tu descends nettement sous ta référence, au moment de valider." },
        { t: "h", text: "Calibration (S1 et S7)" },
        { t: "p", text: "Toutes les séries au haut de la fourchette → +5 % ; une série sous le bas de la fourchette → −5 %." },
        { t: "h", text: "Ce qui compte comme un progrès" },
        { t: "ul", items: [
          "Isolations : une rep, une demi-rep ou une exécution plus stricte à charge égale",
          "Poids du corps : le lest prend le relais dès que le haut de la fourchette est tenu à 1 RIR",
        ] },
        { t: "h", text: "Repos et exécution" },
        { t: "ul", items: [
          "Repos : 2–3 min sur les gros mouvements, 1–2 min sur les isolations, 1 min sur les abdos",
          "Descente 2–4 s, montée forte",
          "Concentrique dynamique, pas de ralentissement pour « sentir »",
        ] },
      ],
    },

    {
      id: "deload",
      title: "Décharge : déclencheurs et recette",
      group: "methode",
      meta: "5 déclencheurs · 2 recettes",
      blocks: [
        /* #104 : les cinq déclencheurs étaient une phrase de 299 caractères à
           points-virgules, et les deux recettes une de 344. Aucun mot n'a été
           retiré — ils sont rangés. Le sous-titre de l'index (« 5 déclencheurs
           · 2 recettes ») promettait déjà cette forme ; la page la tient. */
        { t: "h", text: "Déclencheurs" },
        { t: "ul", items: [
          "Baisse de performance sur ≥ 2 exercices clés, 2 séances de suite, malgré sommeil et alimentation corrects",
          "Douleur articulaire ≥ 3/10 qui persiste plus de 48 h ou augmente",
          "Sommeil < 6 h plusieurs nuits",
          "FC de repos ou HRV dégradées 3 jours ou plus",
          "RIR ressenti qui dérive",
        ] },
        { t: "h", text: "Décharge complète" },
        { t: "p", text: "Mêmes exercices, volume −50 %, charges −10 à −20 %, 3–4 RIR, une semaine." },
        { t: "h", text: "Allègement ciblé" },
        { t: "p", text: "Quand une articulation se plaint : on retire uniquement les exercices qui la sollicitent, on garde le reste, on remplace par une variante indolore." },
        { t: "p", text: "Toute douleur nouvelle = arrêt de l'exercice concerné, avis médical si elle persiste." },
      ],
    },

    program.fallback && program.fallback.length ? {
      id: "fallback",
      title: "Plan de repli (séances manquées)",
      group: "programme",
      meta: `${program.fallback.length} cas de figure`,
      blocks: program.fallback.map((text) => ({ t: "p", text })),
    } : null,

    cardioSection(program.cardio, definition.cardioBaseline),

    profile ? {
      id: "nutrition",
      title: "Nutrition",
      group: "programme",
      meta: `${sp(profile.startKcal)} kcal · ${profile.macros.p}/${profile.macros.f}/${profile.macros.c} g`,
      blocks: [
        /* #104 : la page la plus lourde du Plan — 1 658 caractères, dont une
           journée type de 576 en un seul paragraphe. Elle est faite de cinq
           sujets que rien ne séparait, et de trois énumérations (les repas,
           les ajustements, les quatre règles) qui n'avaient que le
           point-virgule pour respirer. Aucun chiffre n'a bougé. */
        { t: "h", text: "Cibles" },
        { t: "ul", items: [
          `Maintenance estimée ≈ ${sp(profile.maintenanceKcal)} kcal`,
          `Départ : ${sp(profile.startKcal)} kcal par jour, 7 jours sur 7`,
          `Protéines ${profile.macros.p} g, lipides ${profile.macros.f} g, glucides ${profile.macros.c} g`,
          "Quatre repas à 40–50 g de protéines, glucides concentrés autour des séances",
        ] },
        { t: "h", text: "Lecture des deux premières semaines" },
        { t: "p", text: "+0,5 à 1 kg d'eau et de glycogène en S1, on juge la pente entre la moyenne de S2 et celle de S4. Pente +0,2–0,3 kg/sem → maintenance confirmée." },
        { t: "h", text: "Ajustements, toutes les 2 semaines" },
        { t: "ul", items: [
          "Gain > 0,4 kg/sem sur 2 semaines, ou taille +1 cm sur 2 semaines → −150 à −200 kcal",
          "Gain < 0,1 kg/sem sur 2 semaines → +100 à +150 kcal",
          "Taille +3 cm cumulés, ou masse grasse estimée ≥ 15–16 % → retour à maintenance et réévaluation",
        ] },
        { t: "p", text: `Cible : ${kg(profile.targetWeightKg[0])}–${kg(profile.targetWeightKg[1])} kg fin S12.` },
        { t: "h", text: `Journée type, jour d'entraînement (~${sp(profile.startKcal)} kcal)` },
        { t: "ul", items: [
          "Matin : 100 g de flocons d'avoine, 300 ml de lait, une banane, 30 g de whey, 20 g d'amandes",
          "Midi : 150 g de poulet, 120 g de riz basmati (cru), légumes, une cuillère d'huile d'olive, un yaourt grec",
          "60–90 min avant la séance : 200 g de fromage blanc, 2 tranches de pain complet et de la confiture",
          "Soir : 150 g de saumon ou de bœuf 5 %, 300 g de pommes de terre, légumes, une cuillère d'huile",
          "Collation : 250 g de fromage blanc, 30 g de miel, 30 g de noix",
        ] },
        { t: "p", text: "Jour de repos : mêmes totaux, la collation pré-séance devient un goûter." },
        { t: "h", text: "Version minimale" },
        { t: "p", text: "Les 4 règles qui tiennent quand la semaine part en vrille." },
        { t: "ul", items: [
          "Quatre repas avec 40 g de protéines",
          "Pesée chaque matin",
          "Mètre ruban et bilan copié-collé le dimanche",
          "Le plancher alimentaire ne dépend pas de la séance : séance ratée = on mange pareil",
        ] },
        { t: "h", text: "Optionnel" },
        { t: "ul", items: [
          "Créatine 3–5 g/j",
          `Whey pour atteindre ${profile.macros.p} g de protéines`,
          "Vitamine D 1 000–2 000 UI/j d'octobre à mars",
          "Caféine 100–200 mg avant séance",
        ] },
      ],
    } : null,

    Object.keys(startingLoads).length ? {
      id: "startloads",
      title: "Charges de départ (S1)",
      group: "programme",
      meta: `${Object.keys(startingLoads).length} exercices renseignés`,
      blocks: startLoadsBlocks(startingLoads),
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
