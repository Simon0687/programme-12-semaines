/* =========================================================
   Contenu de l'onglet Plan (#4, #6, #26)

   Texte éditorial du programme : aucune logique React. Consommé par
   <PlanContent> / <Block> dans App.jsx, qui mappe le résultat de
   buildPlan() à travers le composant Section. « < » et « > » sont des
   caractères littéraux (React les échappe au rendu).

   ---------------------------------------------------------
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
       repos        toujours (méthode) — sorti de progression en #114 pour
                    porter sa propre ancre dans le manuel de Référence.
       cardio       omise quand program.cardio vaut null (#25/#13).
       nutrition    omise quand la définition n'a pas de profil (#27).
       startloads   omise quand startingLoads est vide ; le texte est
                    dérivé des entrées et des noms du registre, il ne cite
                    plus d'exercices en dur.

     Structure d'une section :
       id           clé stable (key React, ancrage éventuel — les quatre
                    sections « methode » sont aussi les ancres du manuel de
                    Référence, #114).
       title        titre de la Section.
       open         true => Section dépliée au montage (défaut : repliée).
       blocks[]     contenu, un objet par bloc :
         { t: "p", text }                    paragraphe.
         { t: "h", text }                    intertitre dans la page (#104).
         { t: "ul", items: [texte, …] }      liste à puces (#104).
         { t: "chips", items: [texte, …] }   liste courte, en jetons (#114 —
                                             ancres du cycle, structure).
         { t: "callout", text }              encadré, hors du flux de lecture
                                             ordinaire — un repère ou une
                                             consigne de sécurité (#114).
         { t: "iconlist", items: [{ icon, text }, …] }
                                             liste à puces avec un pictogramme
                                             par entrée (#114 — déclencheurs de
                                             décharge). `icon` est un nom
                                             abstrait ; PlanViews.jsx choisit
                                             le tracé, ce fichier n'importe
                                             jamais lucide-react (§2.6).
         { t: "phaseline", steps: [{ phase, label, text }, …] }
                                             frise verticale, une étape par
                                             phase (#114). `phase` est un id de
                                             phaseOf() (progression.js) — la
                                             couleur vient de phase-colors.js,
                                             partagée avec la timeline de
                                             l'index Programme (#107).
         { t: "bars", rows: [{ label, value, display, sessions }, …] }
                                             barres horizontales triées par
                                             valeur décroissante (#108 — volume
                                             par groupe). `value` est le nombre
                                             (parsé, pour trier et mettre à
                                             l'échelle), `display` la chaîne
                                             d'origine (peut porter une
                                             virgule) ; `sessions` la
                                             ventilation "où ça se fait",
                                             dérivée de la troisième colonne
                                             de program.volume — jamais une
                                             réinterprétation stockée, un
                                             segment qui ne suit pas le motif
                                             attendu redevient une ligne
                                             unique.
         { t: "table", variant: "compare", head: [libelléA, libelléB],
           rows: [[libellé, valeurA, valeurB], …] }
                                             comparaison à deux colonnes (#114
                                             — les deux recettes de décharge).
         { t: "table", variant: "ifthen", rows: [[si, alors], …] }
                                             table à deux colonnes, un en-tête
                                             fixe "Si"/"Alors" (#109 —
                                             ajustements nutrition).
         { t: "headline", text }             le chiffre qui compte, en tête de
                                             section (#109 — kcal/jour).
         { t: "tiles", items: [{ label, value }, …] }
                                             valeurs côte à côte, en tuiles
                                             (#109 — les trois macros).
         { t: "fold", title, count, blocks: [bloc, …] }
                                             sous-section repliée, comptée dans
                                             son propre intertitre (#109) —
                                             `count` est dérivé du contenu
                                             (jamais recopié à la main), et le
                                             rendu de `blocks` récursif : les
                                             mêmes formes que ci-dessus.

   PHASE_NOTES[id]  note éditoriale par phase, sortie de phaseOf()
                    (progression.js). Clés = les id renvoyés par phaseOf() :
                    calib | b1 | deload | b2 | bilan. Lu par App.jsx
                    (sous-titre Séance, entête Semaine).
   ========================================================= */

import { EXERCISES } from "./registry.js";
import { normalizeCardio, cardioTargets, MODALITIES } from "./cardio.js";
import { dayName } from "./display.js";
import { num } from "./progression.js";
import { adjustmentTable, firstWeeksNote, aiBrief } from "./nutrition.js";

const kg = (n) => String(n).replace(".", ",");                       // 72.5 -> "72,5"
const sp = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");   // 3150 -> "3 150"

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

/* ---------- La section nutrition, calculée depuis le profil (#109, #121) ----------

   #104 avait déjà rangé cette page — la plus lourde du Plan, 1 658
   caractères — en intertitres et listes. #109 a mis le chiffre qui compte en
   tête (headline), les trois macros en tuiles, les ajustements en table
   Si/Alors. #121 remplace ce que ces nombres étaient (écrits à la main pour
   le profil de Simon) par un calcul (nutrition.js) qui suit l'objectif
   déclaré — masse, sèche ou maintien changent le signe du calcul et le sens
   de la table Si/Alors, pas seulement ses chiffres. Le repas type disparaît :
   l'app calcule kcal/macros, pas de recettes — un brief copiable (aiBrief)
   les transmet à une IA externe pour ça. */
function nutritionBlocks(profile, sessionsPerWeek) {
  return [
    { t: "headline", text: `${sp(profile.startKcal)} kcal / jour · maintenance ≈ ${sp(profile.maintenanceKcal)}` },
    { t: "tiles", items: [
      { label: "Protéines", value: `${profile.macros.p} g` },
      { label: "Lipides", value: `${profile.macros.f} g` },
      { label: "Glucides", value: `${profile.macros.c} g` },
    ] },
    { t: "ul", items: [
      "7 jours sur 7, week-end compris",
      "Quatre repas à 40–50 g de protéines, glucides concentrés autour des séances",
    ] },
    { t: "h", text: "Lecture des deux premières semaines" },
    { t: "p", text: firstWeeksNote(profile.objectif) },
    { t: "h", text: "Ajuster toutes les 2 semaines" },
    { t: "table", variant: "ifthen", rows: adjustmentTable(profile.objectif) },
    { t: "p", text: `Cible : ${kg(profile.targetWeightKg[0])}–${kg(profile.targetWeightKg[1])} kg fin S12.` },
    { t: "fold", title: "Brief pour ton IA", count: 1, blocks: [
      { t: "p", text: "À copier-coller à l'IA de ton choix pour un exemple de repas — l'app calcule les chiffres, pas les recettes." },
      ...aiBrief(profile, sessionsPerWeek).map((text) => ({ t: "p", text })),
    ] },
  ];
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
        /* #114 : la table à deux colonnes devient une frise verticale, dans
           les couleurs de phase que l'index Programme utilise déjà pour la
           sienne (#107, phase-colors.js) — le même découpage, lu à deux
           endroits, doit se voir de la même couleur aux deux. */
        {
          t: "phaseline",
          steps: [
            { phase: "calib", label: "S1", text: "Calibration, 2–3 RIR" },
            { phase: "b1", label: "S2–S6", text: "Bloc 1, 1 RIR, double progression" },
            { phase: "deload", label: "S7", text: "Décharge (volume −50 %, charges −15 %, 3–4 RIR) et calibration des variantes du bloc 2" },
            { phase: "b2", label: "S8–S11", text: "Bloc 2, 1 RIR" },
            { phase: "bilan", label: "S12", text: "Bloc 2, dernière série AMRAP sur les exercices clés, mesures, re-baseline" },
          ],
        },
        /* #104 : les ancres étaient énumérées au milieu d'un paragraphe qui
           disait ensuite deux autres choses. Une liste d'exercices se lit en
           liste — et la phrase sur les autres créneaux redevient lisible une
           fois qu'elle ne traîne plus sept noms derrière elle. #114 : la
           liste devient des jetons, plus proches d'une énumération de noms
           courts qu'un argumentaire à puces. */
        ...(anchors.length
          ? [
            { t: "h", text: "Ancres conservées sur les deux blocs" },
            { t: "chips", items: anchors },
            { t: "p", text: "Les autres créneaux changent de variante en S7 : la charge y repart en paliers, c'est le rôle de la semaine de calibration." },
          ]
          : [
            { t: "p", text: "Tous les créneaux changent de variante en S7 : la charge y repart en paliers, c'est le rôle de la semaine de calibration." },
          ]),
        { t: "callout", text: "Point volume à la fin de S4 : on décide s'il faut ajouter des séries sur les groupes prioritaires dès S5." },
      ],
    },

    program.volume && program.volume.length ? {
      id: "volume",
      title: "Volume par semaine",
      group: "programme",
      meta: `${program.volume.length} groupes · ${Math.max(...program.volume.map((r) => num(r[1]) ?? 0))} séries max`,
      blocks: [
        /* #108 : triées décroissant, la barre la plus longue étant celle du
           groupe qui en fait le plus — c'est la question que la table posait
           déjà, sans qu'il faille lire les nombres pour y répondre. Un tri
           stable (Array#sort l'est depuis ES2019) : deux groupes à égalité
           gardent l'ordre où program.volume les déclare.

           « Où ça se fait » (le nom des séances derrière chaque groupe) a été
           retiré au retour de test : la ligne de volume et son chiffre
           suffisent, comme le sommaire de la maquette validée. */
        {
          t: "bars",
          rows: [...program.volume]
            .map(([label, n]) => ({ label, value: num(n) ?? 0, display: n }))
            .sort((a, b) => b.value - a.value),
        },
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
           · 2 recettes ») promettait déjà cette forme ; la page la tient.
           #114 : les déclencheurs gagnent un pictogramme chacun, et les deux
           recettes se comparent en table plutôt qu'en deux paragraphes qu'il
           fallait déjà relire côte à côte pour voir ce qui change. */
        { t: "h", text: "Déclencheurs" },
        { t: "iconlist", items: [
          { icon: "decline", text: "Baisse de performance sur ≥ 2 exercices clés, 2 séances de suite, malgré sommeil et alimentation corrects" },
          { icon: "pain", text: "Douleur articulaire ≥ 3/10 qui persiste plus de 48 h ou augmente" },
          { icon: "sleep", text: "Sommeil < 6 h plusieurs nuits" },
          { icon: "vitals", text: "FC de repos ou HRV dégradées 3 jours ou plus" },
          { icon: "rir", text: "RIR ressenti qui dérive" },
        ] },
        { t: "h", text: "Les deux recettes" },
        { t: "table", variant: "compare", head: ["Complète", "Ciblée"], rows: [
          ["Quand", "Suite à un déclencheur ci-dessus, pendant une semaine", "Une articulation qui se plaint"],
          ["Exercices", "Mêmes exercices", "Ceux qui sollicitent l'articulation retirés et remplacés par une variante indolore, le reste gardé"],
          ["Volume", "−50 %", "Inchangé sur le reste"],
          ["Charges", "−10 à −20 %", "Inchangées sur le reste"],
          ["RIR", "3–4", "Inchangé sur le reste"],
        ] },
        { t: "callout", text: "Toute douleur nouvelle = arrêt de l'exercice concerné, avis médical si elle persiste." },
      ],
    },

    /* #114 : sorti de « progression », dont il ne parlait déjà plus vraiment
       — le manuel de Référence lui donne sa propre ancre, entre décharge et
       exercices, là où le sommaire de la maquette approuvée le place. */
    {
      id: "repos",
      title: "Repos et exécution",
      group: "methode",
      meta: "Temps de repos · tempo d'exécution",
      blocks: [
        { t: "ul", items: [
          "Repos : 2–3 min sur les gros mouvements, 1–2 min sur les isolations, 1 min sur les abdos",
          "Descente 2–4 s, montée forte",
          "Concentrique dynamique, pas de ralentissement pour « sentir »",
        ] },
      ],
    },

    /* #120 : retiré du Plan le 2026-09-26, retour de test — un texte
       statique ("voici tes options") ne dit rien de la semaine réelle et
       n'apportait pas assez pour son coût. Remplacé par un conseil vivant
       dans l'onglet Semaine (App.jsx, recommendRemaining()/fallback.js),
       qui lit ce qui est déjà validé cette semaine plutôt que d'énumérer
       des cas hypothétiques. `buildFallbackLevels()` continue de calculer
       program.fallback à la génération (fondation réutilisée par le
       conseil vivant), mais plus aucune section du Plan ne l'affiche tel
       quel — y compris le texte hérité du programme personnel de Simon,
       qui portait la même limite (une liste figée, pas une réaction à la
       semaine en cours). */

    cardioSection(program.cardio, definition.cardioBaseline),

    /* #121 : cette section ne disparaît plus quand `profile` est absent —
       contrairement à Cardio ou au Plan de repli, son absence n'est pas
       « rien à dire » mais « quelque chose à faire ». `blocks` vide est le
       signal que App.jsx lit pour afficher l'appel à l'action à la place. */
    profile ? {
      id: "nutrition",
      title: "Nutrition",
      group: "programme",
      meta: `${sp(profile.startKcal)} kcal · ${profile.macros.p}/${profile.macros.f}/${profile.macros.c} g`,
      blocks: nutritionBlocks(profile, (program.SESSIONS || []).length),
    } : {
      id: "nutrition",
      title: "Nutrition",
      group: "programme",
      meta: "Profil non renseigné",
      blocks: [],
    },

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
