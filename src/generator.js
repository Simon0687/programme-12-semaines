/* =========================================================
   Moteur de génération — des contraintes déclarées à une définition (#58)

   Trois réponses en entrée — nombre de séances, durée maximale, matériel —
   et une `definition` en sortie, dans la forme exacte qu'un fichier chargé
   produirait. Q1 = B de decisions-moteur.md (2026-09-15) : l'application
   calcule elle-même, sans appel réseau et sans LLM.

   Ce module **n'écrit pas les sept étapes** du §3 de
   docs/generation/moteur-generation-programme.md. Les étapes 2 et 3 — la
   table de cibles et le plafond temporel — sont `targetsFor()` de #37,
   appelée telle quelle ; l'étape 7 est `progression.js`, qui tourne déjà sur
   n'importe quel programme. Ce qui est écrit ici : le tableau des splits
   (étape 1), la sélection gloutonne (étape 4), le placement (étape 5) et une
   ligne de prescription (étape 6).

   **La pièce que le §3 n'a pas.** Sa boucle raisonne en séries, et son test
   de faisabilité compare des séries à un plafond de séries. Mais une séance
   porte au plus six exercices (cap dur, §3 étape 3), et un petit groupe ne
   se stimule que par un exercice à lui : les presses ne comptent pas pour le
   triceps (règle de comptage indirect, étape 2). À 2 séances, cela fait
   douze créneaux pour onze muscles dont chacun en voudrait deux — le budget
   en séries tient, celui en créneaux non. D'où une **répartition des
   créneaux** avant toute sélection : chaque muscle reçoit le nombre de
   séances qu'il lui faut, par ordre de priorité, jusqu'à épuisement. Ce qui
   n'a pas eu de créneau est **déclaré**, pas oublié — c'est le `report`, et
   c'est ce que l'écran dit avant de passer la main à l'éditeur.

   L'idée qui rend le résultat honnête : **le thème annoncé d'une séance
   (`sub`) s'écrit à partir des muscles qui lui ont reçu un créneau, jamais à
   partir des exercices que la boucle a retenus.** L'assertion 6 lit ce champ
   et lui seul ; écrite dans l'autre sens, elle comparerait un nombre à
   lui-même (le piège que #37 a noté dans son propre decisions-spec.md Q5).
   Une séance qui annonce un muscle que la sélection ne sert finalement pas —
   plus de schéma moteur disponible, plafond atteint — se fait donc signaler.

   Un garde-fou que l'exemple exécuté du §5 n'a pas, et qui lui vaut
   aujourd'hui un signalement quand on lui donne des cibles : **le plafond par
   muscle**. Aucune série n'est posée si elle fait passer le volume pondéré
   au-dessus de `VOLUME[m].max` — c'est ce qui manque à l'exemple, dont les
   ischios montent à 10,5 pour une fourchette à 10, par accumulation
   d'indirect.

   Aucun import React, aucun accès au stockage : chargeable par `node --test`
   (ARCHITECTURE §2.6), et feuille comme `assertions.js` (§2).

   Non-objectifs : ce module n'écrit rien, ne valide rien — `validateDefinition()`
   garde seule le droit de refuser — et ne juge pas sa propre sortie : c'est
   `assess()` qui le fait, en conseillant, une fois le programme installé.
   ========================================================= */

import { EXERCISES, EQUIPMENT } from "./registry.js";
import { VOLUME, PRIMARY, LEVELS, contribution, targetsFor, resolveWeek } from "./assertions.js";
import { DEFINITION_FORMAT_VERSION } from "./definition.js";
import { buildFallbackLevels } from "./fallback.js";
/* Le lundi qui vient : la règle appartient à l'éditeur, qui possède la date
   de départ d'un brouillon, et le moteur produit un brouillon. Une copie
   locale de ce calcul serait une deuxième vérité sur la même question. */
import { nextMonday } from "./program-editor.js";

/* ---------- Les vocabulaires de la collecte ----------

   `LEVELS` vit dans assertions.js, parce que c'est `targetsFor()` qui le lit.
   Il est réexporté ici pour que l'écran de collecte n'ait qu'une porte à
   pousser : les cinq vocabulaires qu'il affiche sortent du même module, et
   aucun n'est réécrit dans du JSX. Les trois autres n'ont pas d'autre lecteur
   que ce module et l'écran qui l'alimente. */

export { LEVELS };
export const FREQUENCIES = [2, 3, 4, 5, 6];
export const DURATIONS = [45, 60, 75, 90];
export const OBJECTIVES = ["force", "hypertrophie", "endurance"];

/* Deux presets, pas trois (decisions-spec.md Q1). Le poids du corps seul
   rendrait cinq exercices sélectionnables et aucun bas du corps : c'est un
   trou de catalogue, pas un réglage, et il revient quand le registre le
   comble. `gear` est un sous-ensemble de EQUIPMENT ; un exercice est
   disponible quand *tout* son `equipement` y figure. */
export const PRESETS = {
  "salle-complete": { label: "Salle complète", gear: [...EQUIPMENT] },
  "home-gym": {
    label: "Home gym",
    gear: ["halteres", "barre_ez", "banc", "banc_incline", "barre_traction", "poids_du_corps"],
  },
  /* Le troisième preset a manqué le lot 1 de #58, non par choix mais par
     mesure : le registre n'avait alors que cinq entrées sans matériel, et huit
     muscles sur onze sans exercice primaire. #59 a rempli le catalogue, et
     c'est ce qui le fait revenir. Il porte la barre de traction et les barres
     parallèles : sans elles, le dos et les triceps sont hors de portée, et un
     preset qui ne sait pas entraîner le dos ne mérite pas son écran. */
  "poids-du-corps": {
    label: "Poids du corps",
    gear: ["poids_du_corps", "barre_traction", "barres_paralleles"],
  },
};

/* Ce que `generate()` suppose quand l'appelant se tait. Le niveau et
   l'objectif sont collectés depuis le lot 2 : ces deux-là ne servent plus
   qu'aux appels qui ne déclarent rien, et l'intention écrite dans la
   définition dit alors ce qui a été supposé au lieu de le taire.
   `DEFAULT_PRIORITIES` reste, elle, la constante de la v1 — le lot 3 lui
   donnera son écran. */
export const DEFAULT_LEVEL = "intermediaire";
export const DEFAULT_OBJECTIVE = "hypertrophie";
export const DEFAULT_PRIORITIES = [];

const LEVEL_RANK = { debutant: 1, intermediaire: 2, avance: 3 };

/* Cap dur du §3 étape 3. Le plafond de séries, lui, vient de `targetsFor()`. */
const MAX_EXERCISES = 6;
const MAX_SETS = 4;

/* ---------- Étape 1 — le split ----------

   Conséquence d'une contrainte, pas une table arbitraire : chaque muscle doit
   être stimulé deux fois par semaine (§3 étape 1). D'où le full body forcé à
   2-3 séances et le PPL forcé à 6. Les jours sont ceux de l'étape 5, résolus
   une fois pour toutes ; ils tiennent les 48 h entre deux sollicitations
   primaires d'un gros groupe, y compris en repassant par le lundi. */

const UPPER = ["dos", "pectoraux", "deltoide_ant", "deltoide_lat", "deltoide_post", "biceps", "triceps"];
const LOWER = ["quadriceps", "ischios_fessiers", "mollets", "abdominaux"];
const PUSH = ["pectoraux", "deltoide_ant", "deltoide_lat", "triceps"];
const PULL = ["dos", "deltoide_post", "biceps"];
const ALL = [...UPPER, ...LOWER];

const SPLITS = {
  2: {
    label: "Full body 2 jours",
    sessions: [
      { id: "fbA", name: "Full body A", day: 1, warm: "complet", focus: ALL },
      { id: "fbB", name: "Full body B", day: 4, warm: "complet", focus: ALL },
    ],
  },
  3: {
    label: "Full body 3 jours",
    sessions: [
      { id: "fbA", name: "Full body A", day: 1, warm: "complet", focus: ALL },
      { id: "fbB", name: "Full body B", day: 3, warm: "complet", focus: ALL },
      { id: "fbC", name: "Full body C", day: 5, warm: "complet", focus: ALL },
    ],
  },
  4: {
    label: "Upper/Lower 4 jours",
    sessions: [
      { id: "upA", name: "Upper A", day: 1, warm: "haut", focus: UPPER },
      { id: "lowA", name: "Lower A", day: 2, warm: "bas", focus: LOWER },
      { id: "upB", name: "Upper B", day: 4, warm: "haut", focus: UPPER },
      { id: "lowB", name: "Lower B", day: 5, warm: "bas", focus: LOWER },
    ],
  },
  5: {
    label: "Upper/Lower + Push/Pull 5 jours",
    sessions: [
      { id: "upA", name: "Upper A", day: 1, warm: "haut", focus: UPPER },
      { id: "lowA", name: "Lower A", day: 2, warm: "bas", focus: LOWER },
      { id: "push", name: "Push", day: 3, warm: "haut", focus: PUSH },
      { id: "pull", name: "Pull", day: 5, warm: "haut", focus: PULL },
      { id: "lowB", name: "Lower B", day: 6, warm: "bas", focus: LOWER },
    ],
  },
  6: {
    label: "Push/Pull/Legs 6 jours",
    sessions: [
      { id: "pushA", name: "Push A", day: 1, warm: "haut", focus: PUSH },
      { id: "pullA", name: "Pull A", day: 2, warm: "haut", focus: PULL },
      { id: "legsA", name: "Legs A", day: 3, warm: "bas", focus: LOWER },
      { id: "pushB", name: "Push B", day: 5, warm: "haut", focus: PUSH },
      { id: "pullB", name: "Pull B", day: 6, warm: "haut", focus: PULL },
      { id: "legsB", name: "Legs B", day: 7, warm: "bas", focus: LOWER },
    ],
  },
};

const WARMUPS = {
  complet: "5 min de cardio léger, puis deux séries montantes sur le premier exercice de la séance. Mobilité hanches et épaules.",
  haut: "5 min de cardio léger, puis deux séries montantes sur le premier exercice de poussée. Rotations d'épaules, bandes si besoin.",
  bas: "5 min de cardio léger, puis deux séries montantes sur le premier exercice de jambes. Mobilité hanches et chevilles.",
};

/* L'ordre dans lequel les muscles se disputent les créneaux. Les quatre gros
   groupes d'abord — ce sont eux que la cascade du §3 étape 3 protège le plus
   longtemps —, les bras et les petits deltoïdes ensuite, la périphérie enfin,
   et le deltoïde antérieur en dernier parce que la méthode *veut* qu'il soit
   couvert par les presses plutôt que prescrit (§3 étape 2). C'est le même
   ordre de sacrifice que la cascade, appliqué à une autre ressource. */
const PRIORITY = [
  "dos", "pectoraux", "quadriceps", "ischios_fessiers",
  "biceps", "triceps", "deltoide_lat", "deltoide_post",
  "abdominaux", "mollets", "deltoide_ant",
];

/* Les termes du sous-titre, et les muscles que chacun engage. Ils sont
   choisis dans le lexique fermé que lit `announcedMuscles()` : un terme que
   l'assertion 6 ne reconnaîtrait pas serait une annonce que personne ne
   vérifie. « Épaules » est satisfait dès qu'un faisceau travaille, « Bras »
   dès que l'un des deux le fait — c'est la règle du terme parapluie. */
const SUB_TERMS = [
  { label: "Dos", muscles: ["dos"] },
  { label: "Pectoraux", muscles: ["pectoraux"] },
  { label: "Épaules", muscles: ["deltoide_ant", "deltoide_lat", "deltoide_post"] },
  { label: "Bras", muscles: ["biceps", "triceps"] },
  { label: "Quadriceps", muscles: ["quadriceps"] },
  { label: "Ischios", muscles: ["ischios_fessiers"] },
  { label: "Mollets", muscles: ["mollets"] },
  { label: "Abdos", muscles: ["abdominaux"] },
];

/* ---------- Étape 6 — la prescription ----------

   Trois lignes, et depuis le lot 2 les trois sont atteignables : l'objectif
   est collecté. Il ne change que les répétitions et le repos — ni le split,
   ni la sélection, ni le nombre de séries — donc rien de ce que les six
   assertions mesurent : l'assertion 5 estime la durée à 3 min par série,
   forfaitairement, et ne lit pas le `rest` des créneaux. */
const PRESCRIPTION = {
  force: { compose: [3, 6], isolation: [6, 10], restCompose: 210, restIsolation: 120 },
  hypertrophie: { compose: [5, 10], isolation: [8, 12], restCompose: 150, restIsolation: 90 },
  endurance: { compose: [12, 15], isolation: [12, 20], restCompose: 90, restIsolation: 60 },
};

/* ---------- Outils ----------

   `MUSCLES` fixe un ordre de parcours : deux appels identiques doivent rendre
   le même programme, donc aucun départage ne peut dépendre de l'ordre
   d'énumération d'un objet construit ailleurs. */
const MUSCLES = Object.keys(VOLUME);
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);
const half = (n) => Math.round(n * 2) / 2;

const MUSCLE_LABELS = {
  dos: "Dos", pectoraux: "Pectoraux", quadriceps: "Quadriceps",
  ischios_fessiers: "Ischios et fessiers", deltoide_ant: "Delt antérieurs",
  deltoide_lat: "Delt latéraux", deltoide_post: "Delt postérieurs",
  biceps: "Biceps", triceps: "Triceps", mollets: "Mollets", abdominaux: "Abdos",
};

/* Les libellés affichés : les chips de la collecte et la phrase de l'éditeur
   les lisent tous les deux ici. Capitalisés à la source et minusculés dans la
   phrase, comme `PRESETS[...].label` — un libellé écrit une seconde fois dans
   du JSX finit par diverger, et c'est l'écran qui aurait tort. */
export const LEVEL_LABELS = { debutant: "Débutant", intermediaire: "Intermédiaire", avance: "Avancé" };
export const OBJECTIVE_LABELS = { force: "Force", hypertrophie: "Hypertrophie", endurance: "Endurance de force" };

/* La phrase que l'éditeur affiche sous le nom, en lecture seule
   (decisions-spec.md Q4). Elle vit ici parce que les quatre vocabulaires y
   sont : un libellé de preset écrit deux fois finirait par diverger.

   Rend `null` — et non une phrase vide — pour un programme composé à la
   main : il n'a pas d'intention à montrer, et l'écran n'a alors rien à
   rendre. Les deux nombres suffisent à la reconnaître ; les autres champs
   s'ajoutent s'ils sont lisibles, pour qu'une intention partielle reste
   descriptible plutôt que muette. */
export function intentSummary(intent) {
  if (!intent || !Number.isFinite(intent.frequency) || !Number.isFinite(intent.duration)) return null;
  const parts = [`${intent.frequency} séances de ${intent.duration} min`];
  if (OBJECTIVE_LABELS[intent.objective]) parts.push(OBJECTIVE_LABELS[intent.objective].toLowerCase());
  if (LEVEL_LABELS[intent.level]) parts.push(`niveau ${LEVEL_LABELS[intent.level].toLowerCase()}`);
  if (PRESETS[intent.equipment]) parts.push(PRESETS[intent.equipment].label.toLowerCase());
  return `Généré pour ${parts.join(", ")}.`;
}

/* Le pool : les entrées que le moteur sait poser. Trois filtres, et un
   quatrième par omission — les entrées sans `muscles` (pallof, sideplank,
   abwheel, carry) sortent en testant le champ, jamais en nommant leurs ids,
   exactement comme le font `assertions.js` et `exercise-filter.js`.

   Le prédicat d'équipement est l'inverse de la facette de l'éditeur : celle-ci
   répond « cet exercice utilise une poulie », celui-ci « j'ai tout ce que cet
   exercice demande ». */
export function poolFor(gear, level) {
  const rank = LEVEL_RANK[level] ?? 0;
  return Object.entries(EXERCISES)
    .filter(([, e]) => e.muscles && Array.isArray(e.equipement)
      && e.equipement.every((q) => gear.includes(q))
      && (e.niveau_min ?? 1) <= rank)
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

/* Les muscles que ce pool sait servir en direct. Un muscle absent d'ici n'est
   pas une sélection ratée : c'est une limite du matériel, connue avant de
   commencer, et donc annoncée avant de commencer. Le home gym n'a pas de
   mollets, et c'est la seule chose qui manque à ses dix-neuf entrées. */
const servableBy = (pool) => new Set(MUSCLES.filter(
  (m) => pool.some((e) => (e.muscles[m] ?? 0) >= PRIMARY),
));

/* ---------- La répartition des créneaux ----------

   Combien de séances pour chaque muscle, avant de savoir quels exercices y
   iront. Deux forces : la fréquence de stimulation (au moins deux séances
   quand le split en offre deux) et le plafond de quatre séries par exercice,
   qui impose une deuxième séance à un gros groupe. Puis on sert dans l'ordre
   de `PRIORITY` jusqu'à ce que les six créneaux d'une séance soient pris.

   Rend `{ assigned, uncovered }` — la liste des muscles de chaque séance, et
   ceux que le format n'a pas pu loger. */
function planSlots(split, targets, servable) {
  /* #61 : deux stratégies, et **la seconde ne sert que si la première échoue
     à couvrir quelqu'un.**

     « Fréquence d'abord » est l'allocation d'origine : chaque muscle prend
     tous les créneaux qu'il veut avant que le suivant ne soit servi. Elle
     produit les séances les mieux équilibrées tant qu'il y a de la place pour
     tout le monde — mesuré : 126 des 180 combinaisons ne changent pas, et
     forcer « couverture d'abord » partout en dégradait 18, dont plusieurs en
     faisant annoncer des épaules à une séance qui n'en travaillait plus.

     « Couverture d'abord » ne se déclenche donc que quand la première a
     réellement laissé un muscle dehors — c'est exactement la question que
     l'issue pose : « qu'est-ce qui vaut le plus **quand les créneaux
     manquent** ? ». Quand ils ne manquent pas, il n'y a aucun arbitrage à
     rendre, et rendre un arbitrage sans conflit est ce qui cassait le reste.

     Le test est exact, pas approché : on ne compare pas une demande totale à
     une capacité totale (la contrainte est par séance et par `focus`), on
     regarde ce que l'allocation d'origine a vraiment produit. */
  const frequencyFirst = allocate(split, targets, servable, false);
  if (frequencyFirst.uncovered.size === 0) return frequencyFirst;
  const coverageFirst = allocate(split, targets, servable, true);
  /* À couverture égale, on garde l'allocation d'origine : « couverture
     d'abord » n'a alors rien résolu, et elle rebattrait les séances pour
     rien. */
  return coverageFirst.uncovered.size < frequencyFirst.uncovered.size ? coverageFirst : frequencyFirst;
}

function allocate(split, targets, servable, coverageFirst) {
  const assigned = new Map(split.sessions.map((s) => [s.id, []]));
  const uncovered = new Set();
  const rank = new Map(split.sessions.map((s, i) => [s.id, i]));
  const room = (s) => assigned.get(s.id).length < MAX_EXERCISES;
  /* Le deltoïde antérieur n'entre jamais dans le rapport : ne pas lui donner
     de créneau, c'est appliquer la méthode, pas échouer à la servir. Les
     presses le couvrent, et l'assertion 1 ne signale jamais son excès. */
  const missing = (m) => { if (!VOLUME[m].coveredIndirectly) uncovered.add(m); };

  /* `!includes(m)` : un muscle ne prend jamais deux créneaux dans la même
     séance. La contrainte était implicite tant qu'un seul appel servait tout
     un muscle d'un coup ; depuis #61 les créneaux se donnent en deux passes,
     et sans cette clause la seconde repasserait sur les séances de la
     première. */
  const give = (m, want) => {
    const open = split.sessions.filter((s) => s.focus.includes(m) && room(s) && !assigned.get(s.id).includes(m))
      .sort((a, b) => assigned.get(a.id).length - assigned.get(b.id).length || rank.get(a.id) - rank.get(b.id));
    for (const s of open.slice(0, want)) assigned.get(s.id).push(m);
    return Math.min(want, open.length);
  };

  /* Combien de séances ce muscle voudrait, s'il y avait la place. Le plancher
     de l'assertion 2, muscle par muscle : deux séances pour les huit muscles
     que la table donne à 2, une seule pour les trois deltoïdes qu'elle donne à
     1–2 (#60). Davantage si quatre séries par exercice n'y suffisent pas — un
     dos à 7 ne tient pas dans une séance. */
  const sessionsFor = (m) => split.sessions.filter((s) => s.focus.includes(m)).length;
  const want = (m) => Math.min(sessionsFor(m), Math.max(VOLUME[m].freq, Math.ceil(targets.volume[m] / MAX_SETS)));
  /* L'ordre des deux gardes compte et reproduit celui d'avant #61 : un muscle
     dont le volume est nul sort en silence, mais un muscle qu'aucun exercice du
     matériel ne sert entre dans le rapport **même si aucune séance ne le vise**
     — c'est le cas du deltoïde latéral sans matériel, une contrainte physique
     que le rapport doit déclarer. Filtrer sur `sessionsFor` avant `servable`
     l'aurait fait disparaître sans un mot. */
  const wanted = [];
  for (const m of PRIORITY) {
    if (!(targets.volume[m] > 0)) continue;
    if (!servable.has(m)) { missing(m); continue; }
    if (sessionsFor(m) > 0) wanted.push(m);
  }

  /* En pénurie, **une première séance pour tout le monde avant une deuxième
     pour qui que ce soit.**

     À deux séances de 60 min, douze créneaux sont offerts et huit muscles en
     demandent quatorze : servis dans l'ordre de PRIORITY, les six premiers
     prenaient les douze et les deux petits deltoïdes — derniers de la liste —
     n'avaient rien. Mesuré, pas prédit (#60).

     Un muscle sans exercice est un trou dans la semaine ; un muscle servi une
     fois au lieu de deux est une fréquence basse. Les six assertions disent les
     deux, mais la seconde se rattrape la semaine suivante — la première, non.

     Hors pénurie, cette passe n'existe pas : `coverageFirst` est faux et chaque
     muscle est servi d'un coup, exactement comme avant #61. */
  if (coverageFirst) {
    for (const m of wanted) if (!give(m, 1)) missing(m);
    for (const m of wanted) {
      if (uncovered.has(m)) continue;
      const extra = want(m) - 1;
      if (extra > 0) give(m, extra);
    }
  } else {
    for (const m of wanted) if (!give(m, want(m))) missing(m);
    /* Seconde passe de l'allocation d'origine : les créneaux restants vont aux
       muscles écartés, une séance chacun. Mieux vaut un mollet une fois par
       semaine que pas du tout, et cette passe ne prend jamais la place de
       personne. */
    for (const m of PRIORITY) {
      if (!uncovered.has(m) || !servable.has(m)) continue;
      if (give(m, 1)) uncovered.delete(m);
    }
  }

  /* #61 : ce qu'on a servi **moins souvent que voulu**. « Couverture d'abord »
     achète une première séance pour tout le monde en prenant la deuxième de
     quelqu'un : c'est le bon arbitrage, mais c'est un arbitrage, et le moteur
     ne doit pas le taire. Le principe de l'en-tête — « ce qui n'a pas eu de
     créneau est déclaré, pas oublié » — vaut aussi pour ce qui en a eu moins
     qu'il n'en fallait, sans quoi l'avis de Plan signalerait une fréquence
     basse que rien n'expliquerait. */
  const short = new Set(
    [...wanted].filter((m) => !uncovered.has(m)
      && split.sessions.filter((s) => assigned.get(s.id).includes(m)).length < want(m)),
  );

  return { assigned, uncovered, short };
}

/* Score de candidat du §3 étape 4, sans le terme de préférence (aucun pouce
   n'est collecté). Entièrement déterministe : à score égal, l'ordre d'id
   tranche, et le pool est trié. */
const scoreOf = (e, owed) => {
  let cover = 0;
  for (const m of MUSCLES) if (owed[m] > 0) cover += contribution(e, m);
  return 3 * cover
    + 2 * (e.type === "isolation" ? (e.stabilite ?? 1) / 3 : 0)
    + (e.type === "compose" ? 1 : 0)
    - (e.cout_systemique ?? 1) / 3;
};

/* Le plafond par muscle. Le deltoïde antérieur en est exempt : la méthode
   *veut* le voir monter sans le prescrire, et l'assertion 1 ne signale
   jamais son excès (VOLUME[m].coveredIndirectly). */
const fits = (entry, sets, allocated) => MUSCLES.every((m) => {
  const gain = sets * contribution(entry, m);
  return !gain || VOLUME[m].coveredIndirectly || allocated[m] + gain <= VOLUME[m].max;
});

/* Le meilleur candidat pour un muscle, et le nombre de séries qu'il peut
   porter sans faire dépasser la fourchette d'un autre groupe. Rend `null`
   quand aucun candidat ne tient : c'est un manque, pas une erreur. */
function pickExercise(muscle, wanted, ctx, usedPatterns, setsLeft, needsOpener) {
  const { pool, allocated, owed, usedVariants } = ctx;
  const all = pool.filter((e) => (e.muscles[muscle] ?? 0) >= PRIMARY && !usedPatterns.has(e.pattern));

  /* « + 1 composé si la séance a encore un créneau d'ouverture » (§3 étape 4)
     est une règle, pas un poids : tant qu'aucun composé n'est posé, un
     composé l'emporte s'il en existe un. Sans ça, le terme de stabilité fait
     gagner l'isolation dès que le composé a épuisé sa couverture — une séance
     Push bâtie sur des écartés à la poulie, et un deltoïde antérieur qui
     cesse d'être stimulé parce que plus rien ne pousse. */
  const compounds = all.filter((e) => e.type === "compose");
  const cands = needsOpener && compounds.length ? compounds : all;

  /* Une variante déjà posée ailleurs dans la semaine est pénalisée, pas
     reléguée : la rotation entre séances rend le programme plus agréable,
     mais elle ne vaut pas de choisir un exercice qui couvre moins. Un
     écarté à la place d'un développé, c'est un deltoïde antérieur qui cesse
     d'être stimulé — l'assertion 2 le voyait, la rotation dure la causait. */
  const ranked = [...cands].sort((a, b) => {
    const s = (scoreOf(b, owed) - (usedVariants.has(b.id) ? 0.5 : 0))
      - (scoreOf(a, owed) - (usedVariants.has(a.id) ? 0.5 : 0));
    return s || (a.id < b.id ? -1 : 1);
  });

  for (const entry of ranked) {
    let sets = Math.min(wanted, setsLeft);
    while (sets > 0 && !fits(entry, sets, allocated)) sets -= 1;
    if (sets > 0) return { entry, sets };
  }
  return null;
}

/* Une séance : ses muscles sont déjà connus, il reste à leur donner un
   exercice et un nombre de séries. Les gros dûs passent en premier, pour que
   le plafond de séries de la séance leur profite avant les petits. */
function fillSession(session, muscles, ctx) {
  const rows = [];
  const usedPatterns = new Set();
  let setsLeft = ctx.capPerSession;

  const order = [...muscles].sort(
    (a, b) => ctx.owed[b] - ctx.owed[a] || PRIORITY.indexOf(a) - PRIORITY.indexOf(b),
  );

  for (const [i, m] of order.entries()) {
    if (setsLeft <= 0) break;
    /* Le deltoïde antérieur soldé par les presses ne se prescrit pas en
       plus : c'est la règle qui évite les 40 à 50 % de trop sur épaules et
       bras, et il est le seul groupe que la méthode *veuille* voir monter
       sans le prescrire (VOLUME[m].coveredIndirectly).

       Les autres, non : un muscle à qui le plan a donné un créneau le garde
       même si l'indirect a soldé sa dette entre-temps. Sauter le créneau
       reviendrait à annoncer un thème qu'on ne travaille pas — c'était le
       cas du dos en seconde séance haute, réglé par les charnières de
       hanche de la séance basse. */
    if (VOLUME[m].coveredIndirectly && !(ctx.owed[m] > 0)) continue;

    /* Une série réservée à chacun des muscles qui suivent. Sans cette
       réserve, une séance courte dépense tout son plafond sur les deux
       premiers gros groupes et laisse les petits sans rien — ils tombent
       alors sous le plancher de fréquence, pour une raison qui n'a rien à
       voir avec eux. */
    const budget = Math.max(1, setsLeft - (order.length - i - 1));
    const share = ctx.owed[m] / Math.max(1, ctx.sessionsLeft[m]);
    const needsOpener = !rows.some((r) => r.entry.type === "compose");
    const pick = pickExercise(
      m, clamp(Math.round(share), 1, MAX_SETS), ctx, usedPatterns, Math.min(setsLeft, budget), needsOpener,
    );
    if (!pick) { if (!VOLUME[m].coveredIndirectly) ctx.uncovered.add(m); continue; }

    const { entry, sets } = pick;
    rows.push({ entry, sets, muscle: m });
    usedPatterns.add(entry.pattern);
    ctx.usedVariants.add(entry.id);
    setsLeft -= sets;
    for (const mm of MUSCLES) {
      const gain = sets * contribution(entry, mm);
      if (!gain) continue;
      ctx.allocated[mm] += gain;
      ctx.owed[mm] = Math.max(0, half(ctx.owed[mm] - gain));
    }
  }

  for (const m of muscles) if (ctx.sessionsLeft[m] > 0) ctx.sessionsLeft[m] -= 1;

  /* Ordre dans la séance (§3 étape 4) : coût systémique décroissant, composés
     avant isolations. On s'entraîne lourd quand on est frais. */
  return rows.sort((a, b) => (b.entry.cout_systemique ?? 1) - (a.entry.cout_systemique ?? 1)
    || (a.entry.type === b.entry.type ? 0 : a.entry.type === "compose" ? -1 : 1));
}

/* ---------- Sortie ---------- */

const subFor = (session, muscles) => SUB_TERMS
  .filter((t) => t.muscles.some((m) => muscles.includes(m)))
  .map((t) => t.label)
  .join(", ");

/* Le nom du cycle, dérivé du split et des deux nombres (decisions-spec.md
   Q5). C'est lui que `withNewId()` transforme en identifiant stocké au
   moment d'enregistrer, et il reste modifiable dans l'éditeur d'ici là. */
const nameFor = (split, duration) => `${split.label}, ${duration} min`;

const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* La table de volume de l'onglet Plan, écrite depuis ce que la boucle a
   réellement posé — pas depuis les cibles. (`program.fallback`, la donnée
   structurée du plan de repli, est calculée séparément par
   `buildFallbackLevels()` — #120 — à partir des séances réellement posées,
   jamais de la prose écrite par ce module.) */
function volumeTable(plan, allocated) {
  const rows = [];
  for (const m of MUSCLES) {
    if (!(allocated[m] > 0)) continue;
    const where = plan
      .filter((s) => s.rows.some((r) => contribution(r.entry, m) > 0))
      .map((s) => {
        const sets = s.rows.reduce((a, r) => a + (contribution(r.entry, m) > 0 ? r.sets : 0), 0);
        return `${s.session.name} ${sets}`;
      })
      .join(" + ");
    rows.push([MUSCLE_LABELS[m], String(allocated[m]).replace(".", ","), where]);
  }
  return rows;
}

/* La variante du bloc 2. Les composés gardent la leur — `plan.js` les lit
   comme les ancres du cycle, et la semaine 7 n'aurait plus rien à calibrer
   si tout changeait. Les isolations tournent vers la suivante du même
   schéma, par ordre d'id, ce qui rend la rotation reproductible. */
function secondBlock(entry, pool) {
  if (entry.type !== "isolation") return entry.id;
  const family = pool.filter((e) => e.pattern === entry.pattern);
  if (family.length < 2) return entry.id;
  const i = family.findIndex((e) => e.id === entry.id);
  return family[(i + 1) % family.length].id;
}

function toProgram(plan, ctx, objective) {
  const presc = PRESCRIPTION[objective] ?? PRESCRIPTION[DEFAULT_OBJECTIVE];
  const SLOTS = {};
  const SESSIONS = [];
  const WARM = {};

  for (const { session, rows } of plan) {
    WARM[session.warm] = WARMUPS[session.warm];
    const ex = [];
    let anchored = false;

    for (const { entry, sets } of rows) {
      const isol = entry.type === "isolation";
      const slotId = `${session.id}_${entry.pattern}`;
      /* `key` : la première ancre composée de la séance. Plan en fait les
         créneaux conservés d'un bloc à l'autre, App.jsx l'AMRAP de S12.
         `fail` : la stabilité 3 du registre, qui est le plancher de RIR du
         §3 étape 6 exprimé dans le champ que l'éditeur coche déjà. */
      SLOTS[slotId] = {
        reps: isol ? [...presc.isolation] : [...presc.compose],
        rest: isol ? presc.restIsolation : presc.restCompose,
        ...(!isol && !anchored && { key: true }),
        ...(entry.stabilite === 3 && { fail: true }),
        b1: entry.id,
        b2: secondBlock(entry, ctx.pool),
      };
      if (!isol) anchored = true;
      ex.push([slotId, sets]);
    }

    SESSIONS.push({
      id: session.id,
      name: session.name,
      sub: session.sub,
      day: session.day,
      warm: session.warm,
      ex,
      core: "gainage",
    });
  }

  const CORE = { gainage: { label: "Gainage", ex: [] } };

  return {
    SLOTS,
    SESSIONS,
    /* Un bloc de gainage vide, comme celui de l'éditeur : les abdominaux sont
       servis par la sélection comme n'importe quel groupe, et un bloc CORE
       partagé par toutes les séances multiplierait leur volume par le nombre
       de séances. Le bloc reste là parce qu'une séance doit référencer une
       clé de CORE, et parce que c'est là qu'on ajoute son gainage à la main. */
    CORE,
    WARM,
    cardio: null,
    volume: volumeTable(plan, ctx.allocated),
    /* #120 : l'ordre de priorité (quelle séance, quels exercices) est figé
       ici, comme `volume` — decisions-spec.md #120 Q1. `ctx.capPerSession`
       (déjà calculé pour plafonner une séance normale) borne la séance
       composite plutôt qu'un nombre inventé. La non-répétition ne peut pas
       l'être : elle se calcule à l'affichage, depuis le journal. */
    fallback: buildFallbackLevels(resolveWeek({ SLOTS, SESSIONS, CORE }, "b1"), ctx.capPerSession),
  };
}

/* ---------- L'entrée publique ----------

   Rend un verdict, jamais une exception (ARCHITECTURE §2.4) :

     { ok: true,  definition, report: { cut, uncovered, cascade, targets } }
     { ok: false, reason, message }

   `report` est ce que l'écran doit dire **avant** de passer la main à
   l'éditeur : ce que le budget a coupé (`cut`, en muscles et non en étapes de
   cascade) et ce que le format ou le matériel n'a pas couvert (`uncovered`). */
export function generate(constraints, today = new Date()) {
  const {
    frequency, duration, equipment,
    level = DEFAULT_LEVEL,
    objective = DEFAULT_OBJECTIVE,
    priorities = DEFAULT_PRIORITIES,
  } = constraints ?? {};

  /* Vocabulaires fermés : une durée de 50 min n'est pas une demi-réponse à
     laquelle le moteur devrait improviser un plafond, c'est une valeur que la
     collecte ne propose pas. Même règle que partout ailleurs dans le dépôt —
     un vocabulaire fermé refuse, il ne s'adapte pas. */
  const split = FREQUENCIES.includes(frequency) ? SPLITS[frequency] : null;
  const preset = DURATIONS.includes(duration) ? PRESETS[equipment] : null;
  const targets = split && preset && LEVELS.includes(level)
    ? targetsFor({ frequency, duration, level, priorities })
    : null;
  if (!targets) {
    return { ok: false, reason: "invalid-constraints", message: "Ces contraintes ne décrivent pas un programme." };
  }
  if (!targets.feasible) return { ok: false, reason: "budget", message: targets.message };

  const pool = poolFor(preset.gear, level);
  const { assigned, uncovered, short } = planSlots(split, targets, servableBy(pool));

  const ctx = {
    pool,
    owed: { ...targets.volume },
    allocated: Object.fromEntries(MUSCLES.map((m) => [m, 0])),
    capPerSession: targets.capPerSession,
    sessionsLeft: Object.fromEntries(MUSCLES.map(
      (m) => [m, split.sessions.filter((s) => assigned.get(s.id).includes(m)).length],
    )),
    usedVariants: new Set(),
    uncovered,
  };

  const plan = [];
  for (const template of split.sessions) {
    const muscles = assigned.get(template.id);
    const session = { ...template, sub: subFor(template, muscles) };
    plan.push({ session, rows: fillSession(session, muscles, ctx) });
  }

  const name = nameFor(split, duration);
  return {
    ok: true,
    report: {
      cut: MUSCLES.filter((m) => targets.volume[m] === 0).map((m) => MUSCLE_LABELS[m]),
      uncovered: MUSCLES.filter((m) => ctx.uncovered.has(m)).map((m) => MUSCLE_LABELS[m]),
      /* #61 : servi, mais moins souvent que son plancher de fréquence. C'est le
         prix de « couverture d'abord », annoncé ici au lieu d'être découvert
         plus tard dans l'avis de Plan. */
      underFrequency: MUSCLES.filter((m) => short.has(m)).map((m) => MUSCLE_LABELS[m]),
      cascade: targets.cascade,
      targets,
    },
    definition: {
      formatVersion: DEFINITION_FORMAT_VERSION,
      id: slug(name),
      name,
      weeks: 12,
      startDate: nextMonday(today),
      startingLoads: {},
      /* L'intention déclarée : les cinq champs que `targetsFor()` prend, plus
         le matériel, qui est ce qui *explique* le programme quand un groupe
         manque (decisions-spec.md Q6). */
      intent: { frequency, duration, level, objective, priorities: [...priorities], equipment },
      program: toProgram(plan, ctx, objective),
    },
  };
}
