/* =========================================================
   Assertions d'acceptation — le programme jugé comme entraînement (#37)

   `validateProgram()` (src/journal-shape.js) dit si un programme est *bien
   formé*. Ce module dit s'il est *cohérent comme entraînement* : les six
   assertions du §7 de docs/generation/moteur-generation-programme.md
   (volume, fréquence, patterns, récupération, durée, thème annoncé).

   Il **conseille, il ne bloque jamais** (decisions-moteur.md Q3, tranché le
   2026-09-15). Un déséquilibre de volume n'est pas une donnée invalide,
   c'est un avis : un programme qui échoue aux six se charge quand même et
   s'exécute quand même. Seule `parseProgramImport()` garde le droit de
   refuser, et sur la forme. Ce module n'est appelé par aucune des deux
   portes d'import, et ne doit jamais l'être.

   L'idée qui fait tenir le reste : **résoudre le programme en une semaine,
   une fois**. `resolveWeek()` rend une forme unique — les séances, leurs
   lignes CORE fusionnées comme le fait l'écran Séance, chaque slot résolu
   vers l'exercice du bloc — et les six assertions lisent cette forme-là.
   La résolution b1/b2, la fusion CORE et les quatre exercices sans champs
   de sélection sont donc traités à un seul endroit au lieu de six.

   Les quatre entrées sans `muscles` ni `pattern` — pallof, sideplank,
   abwheel, carry (note d'en-tête du registre, amendement #25 du
   2026-09-10) — sont ignorées en testant `entry.muscles`, jamais en
   nommant leurs ids. Le jour où #25 tranche la taxonomie anti-mouvement
   et leur donne un pattern, elles se mettent à compter sans toucher à ce
   fichier.

   Aucun import React, aucun accès au stockage, et rien d'autre que le
   registre en dépendance : chargeable par `node --test` (§2.6), et feuille
   comme lui (§2 de docs/ARCHITECTURE.md).
   ========================================================= */

import { EXERCISES } from "./registry.js";

/* Part musculaire à partir de laquelle un exercice est « primaire » pour un
   muscle. Un seul seuil dans le module, et deux usages : le palier 1,0 du
   comptage ci-dessous, et la sollicitation primaire de l'assertion 4
   (decisions-spec.md Q3). */
export const PRIMARY = 0.5;

/* Part en dessous de laquelle un muscle ne compte plus du tout (§3 étape 2). */
const COUNTED = 0.2;

/* Table des fourchettes de volume hebdomadaire, en séries de travail dures
   (§3 étape 2, reprise du BLOC B.2).

   `direct` : la cible est exprimée en séries **directes** et l'indirect ne
   s'en déduit pas. C'est la règle qui évite de doubler le volume des bras
   sans s'en rendre compte — les presses comptent déjà pour les chefs du
   triceps, et c'est déjà intégré dans le fait que la fourchette soit basse
   (3–6 et pas 10–15). Sans elle, un générateur produit 40 à 50 % de trop
   sur épaules et bras.

   `coveredIndirectly` : le deltoïde antérieur est le seul muscle que la
   méthode *veut* voir monter haut sans le prescrire — « 7 séries de presse
   apportent 3,5 séries de deltoïde antérieur → le déficit tombe à 0 et le
   moteur ne prescrit pas de développé vertical en plus ». Signaler son
   dépassement reviendrait à reprocher au programme d'avoir appliqué la
   règle. Le manque, lui, reste signalé. */
export const VOLUME = {
  dos: { min: 6, max: 10, direct: false },
  pectoraux: { min: 6, max: 10, direct: false },
  quadriceps: { min: 6, max: 10, direct: false },
  ischios_fessiers: { min: 6, max: 10, direct: false },
  deltoide_ant: { min: 2, max: 5, direct: false, coveredIndirectly: true },
  deltoide_lat: { min: 2, max: 5, direct: true },
  deltoide_post: { min: 2, max: 3, direct: true },
  biceps: { min: 3, max: 6, direct: true },
  triceps: { min: 3, max: 6, direct: true },
  mollets: { min: 4, max: 8, direct: true },
  abdominaux: { min: 3, max: 6, direct: true },
};

/* Les groupes auxquels s'applique l'espacement de 48 h (§3 étape 5). Les
   petits groupes tolèrent 24–48 h, ce qui ne se distingue pas d'un jour à
   l'autre : rien à vérifier. */
export const LARGE_GROUPS = ["dos", "pectoraux", "quadriceps", "ischios_fessiers"];

/* Règle de comptage indirect (§3 étape 2) :

     contribution = 1,0  si muscles[m] >= 0,5
                  = 0,5  si 0,2 <= muscles[m] < 0,5   (gros groupes + delt. ant.)
                  = 0    sinon

   L'ordre est le dessin : le test `direct` est **après** le palier 1,0, si
   bien qu'un leg curl (1,0) compte pour les ischios quand un hack squat
   (0,35) n'apporte que 0,5, et qu'un développé couché (0,2) n'apporte rien
   au triceps. Inverser les deux lignes rendrait les isolations invisibles. */
export function contribution(entry, m) {
  const part = entry && entry.muscles ? entry.muscles[m] : undefined;
  if (!(part >= COUNTED)) return 0;
  if (part >= PRIMARY) return 1;
  return VOLUME[m] && VOLUME[m].direct ? 0 : 0.5;
}

const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

/* Résout un programme en une semaine, pour un bloc donné ("b1" ou "b2").

   Rend `null` — et jamais une exception — dès que la structure ne se
   parcourt pas : ce module tourne sur des programmes que `validateProgram`
   refuserait, puisque les deux portes sont indépendantes. La ligne est
   tracée entre la *structure* et les *valeurs* : une structure illisible
   rend null (on ne peut rien affirmer), une valeur aberrante se dégrade
   (un `day` non entier devient null et l'assertion 4 saute cette séance).
   Inventer une séance vide pour une structure cassée serait pire que de
   renoncer : ça fabriquerait un manque de volume qui n'existe pas.

   Les lignes sont assemblées exactement comme l'écran Séance le fait —
   `[...session.ex, ...CORE[session.core].ex]` — parce que les séries de
   gainage sont des séries : elles portent le volume d'abdominaux et elles
   occupent du temps. */
export function resolveWeek(program, block) {
  if (!isObj(program)) return null;
  const { SLOTS, SESSIONS, CORE } = program;
  if (!isObj(SLOTS) || !Array.isArray(SESSIONS) || SESSIONS.length === 0 || !isObj(CORE)) return null;

  const sessions = [];
  for (const session of SESSIONS) {
    if (!isObj(session) || !Array.isArray(session.ex)) return null;
    const core = CORE[session.core];
    const coreEx = isObj(core) && Array.isArray(core.ex) ? core.ex : [];

    const rows = [];
    let sets = 0;
    for (const row of [...session.ex, ...coreEx]) {
      if (!Array.isArray(row) || row.length < 2) return null;
      const [slotId, n] = row;
      const slot = SLOTS[slotId];
      if (!isObj(slot) || !Number.isFinite(n) || n <= 0) return null;
      const entry = EXERCISES[slot[block]];
      if (!entry) return null;
      rows.push({ slotId, vid: slot[block], sets: n, entry });
      sets += n;
    }

    sessions.push({
      id: typeof session.id === "string" ? session.id : null,
      day: Number.isInteger(session.day) ? session.day : null,
      name: typeof session.name === "string" ? session.name : "",
      sub: typeof session.sub === "string" ? session.sub : "",
      rows,
      sets,
    });
  }

  return { block, sessions };
}

/* Volume hebdomadaire par muscle, en séries de travail pondérées. Les onze
   clés sont toujours présentes, à 0 s'il le faut : un muscle absent et un
   muscle à zéro sont la même information, et une clé manquante obligerait
   chaque appelant à se défendre. */
export function weeklyVolume(week) {
  const out = {};
  for (const m of Object.keys(VOLUME)) out[m] = 0;
  for (const session of week.sessions) {
    for (const row of session.rows) {
      for (const m of Object.keys(VOLUME)) out[m] += row.sets * contribution(row.entry, m);
    }
  }
  return out;
}

/* Nombre de séances qui sollicitent chaque muscle — le dénominateur de
   l'assertion 2. « Sollicité » vaut « compté dans le volume » : un muscle
   qui reçoit 0,5 série d'un composé est stimulé, même sans exercice direct. */
export function stimulationFrequency(week) {
  const out = {};
  for (const m of Object.keys(VOLUME)) out[m] = 0;
  for (const session of week.sessions) {
    for (const m of Object.keys(VOLUME)) {
      if (session.rows.some((row) => contribution(row.entry, m) > 0)) out[m] += 1;
    }
  }
  return out;
}

/* Vrai si la semaine porte au moins une ligne que le catalogue de génération
   ne modélise pas. Sert à l'assertion 1 : tout le travail anti-mouvement et
   les portés y sont modélisés comme le seul pattern « abdominaux », donc une
   semaine dont le gainage n'est que du Pallof afficherait 0 série d'abdos
   pour une fourchette de 3–6 — un signalement dû au trou du registre, pas au
   programme. */
export function hasUnmodelledRows(week) {
  return week.sessions.some((session) => session.rows.some((row) => !row.entry.muscles));
}

/* ---------- Cibles de volume et faisabilité (§3 étapes 2 et 3) ----------

   Les deux vocabulaires ci-dessous décrivent l'*intention* de
   l'utilisateur, pas les exercices : ils restent donc ici et n'entrent pas
   dans src/registry.js, dont les vocabulaires fermés (MUSCLE_GROUPS,
   PATTERNS, EQUIPMENT) ne décrivent que le catalogue. Le jour où les écrans
   de collecte arrivent (decisions-moteur.md Q4), ils auront un module à eux
   et ces constantes déménageront d'un bloc. */
export const LEVELS = ["debutant", "intermediaire", "avance"];

const LEVEL_BONUS = { debutant: 0, intermediaire: 1, avance: 2 };

const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);
const total = (volume) => Object.values(volume).reduce((a, b) => a + b, 0);
const half = (n) => Math.round(n * 2) / 2;

/* La cascade de réduction du §3 étape 3, dans son ordre — il est
   déterministe et c'est tout l'intérêt : deux appels avec les mêmes
   contraintes rendent la même table.

   L'étape 1 (« groupes en maintien ») n'a aucun champ à lire tant que la
   collecte des contraintes n'existe pas : elle agit sur un `maintenance`
   facultatif et ne fait rien par défaut. Une étape qui ne réduit rien n'est
   pas enregistrée — `cascade` liste ce qui a effectivement coupé, pas ce
   qu'on a essayé. */
const CASCADE = [
  {
    id: "maintenance",
    apply: (v, ctx) => { for (const m of ctx.maintenance) if (v[m] != null) v[m] = 0; },
  },
  {
    id: "periphery",
    apply: (v) => { v.mollets = 0; v.abdominaux = 0; },
  },
  {
    id: "isolation-floor",
    apply: (v, ctx) => {
      for (const [m, t] of Object.entries(VOLUME)) {
        if (t.direct && !ctx.priorities.includes(m)) v[m] = Math.min(v[m], t.min);
      }
    },
  },
  {
    id: "delt-ant",
    apply: (v) => { v.deltoide_ant = 0; },
  },
  {
    id: "large-floor",
    apply: (v, ctx) => {
      for (const m of LARGE_GROUPS) if (!ctx.priorities.includes(m)) v[m] = Math.min(v[m], VOLUME[m].min);
    },
  },
  {
    /* Fréquence 1,5×/sem sur les non-prioritaires : un muscle une séance sur
       deux, donc trois quarts du volume. Appliquée groupe par groupe et non
       d'un bloc — l'exemple du §5 n'en descend qu'un seul (« passage de la
       fréquence des pectoraux à 1,5× ») pour combler un déficit de 1. On
       s'arrête dès que ça tient. */
    id: "frequency-1.5",
    apply: (v, ctx) => {
      for (const m of Object.keys(VOLUME)) {
        if (total(v) <= ctx.capPerWeek) return;
        if (ctx.priorities.includes(m) || v[m] === 0) continue;
        v[m] = half(v[m] * 0.75);
      }
    },
  },
];

/* Cible de volume par muscle et test de faisabilité temporelle.

     cible(m) = min(m) + bonus_niveau + (prioritaire ? max − min − bonus : 0)
     borné à [min(m), max(m)]
     plafond_séries = floor((durée − 10) / 3)      # 10 min d'échauffement

   Rend `null` sur une entrée qui n'a pas de sens — même convention que
   resolveWeek : on ne fabrique pas une cible à partir d'une durée qui n'est
   pas un nombre.

   Attention en relisant l'exemple du §5 : il annonce « 51 séries » là où
   cette fonction rend 54. Les deux sont justes et ne mesurent pas la même
   chose — 51 est le total *après* que la couverture indirecte a ramené le
   deltoïde antérieur à 0 série directe, ce qui est une décision de
   sélection (étape 4), pas une cible. Le module ne sélectionne pas. */
export function targetsFor({ frequency, duration, level = "intermediaire", priorities = [], maintenance = [] } = {}) {
  if (!Number.isFinite(frequency) || frequency <= 0) return null;
  if (!Number.isFinite(duration) || duration <= 10) return null;

  const capPerSession = Math.floor((duration - 10) / 3);
  const capPerWeek = capPerSession * frequency;
  const bonus = LEVEL_BONUS[level] ?? 0;
  const ctx = {
    capPerWeek,
    priorities: Array.isArray(priorities) ? priorities : [],
    maintenance: Array.isArray(maintenance) ? maintenance : [],
  };

  const volume = {};
  for (const [m, t] of Object.entries(VOLUME)) {
    const priority = ctx.priorities.includes(m) ? t.max - t.min - bonus : 0;
    volume[m] = clamp(t.min + bonus + priority, t.min, t.max);
  }

  const cascade = [];
  for (const step of CASCADE) {
    if (total(volume) <= capPerWeek) break;
    const before = total(volume);
    step.apply(volume, ctx);
    if (total(volume) < before) cascade.push(step.id);
  }

  const needed = total(volume);
  const feasible = needed <= capPerWeek;
  return {
    volume, frequency, duration, level,
    priorities: ctx.priorities,
    capPerSession, capPerWeek, needed, feasible, cascade,
    /* Le script de refus complet — le chiffre, ce qui saute, deux
       alternatives chiffrées — appartient au questionnaire (§6). Ici, les
       deux nombres qui le fondent. */
    message: feasible
      ? null
      : `${frequency} séances de ${duration} min offrent ${capPerWeek} séries de travail par semaine ; `
        + `même réduit au minimum méthodologique, ce format en demande ${needed}.`,
  };
}
