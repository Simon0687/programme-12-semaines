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

/* ---------- Les six assertions (§7) ----------

   Libellés lisibles pour les messages. Un signalement doit pouvoir être
   collé à une IA sans retouche (#19) : il nomme donc le muscle et le schéma
   en toutes lettres, jamais leur clé de registre, et ne renvoie à aucun
   fichier ni à aucune fonction. */
const MUSCLE_LABELS = {
  dos: "Dos",
  pectoraux: "Pectoraux",
  quadriceps: "Quadriceps",
  ischios_fessiers: "Ischios/fessiers",
  deltoide_ant: "Deltoïde antérieur",
  deltoide_lat: "Deltoïde latéral",
  deltoide_post: "Deltoïde postérieur",
  biceps: "Biceps",
  triceps: "Triceps",
  mollets: "Mollets",
  abdominaux: "Abdominaux",
};

const PATTERN_LABELS = {
  poussee_horizontale: "poussée horizontale",
  poussee_verticale: "poussée verticale",
  tirage_vertical: "tirage vertical",
  tirage_horizontal: "tirage horizontal",
  dominante_genou: "dominante genou",
  charniere_hanche: "charnière de hanche",
  extension_hanche: "extension de hanche",
  mollets: "mollets",
  abdominaux: "abdominaux",
  iso_pectoraux: "isolation pectoraux",
  iso_deltoide_lateral: "isolation deltoïde latéral",
  iso_deltoide_posterieur: "isolation deltoïde postérieur",
  iso_biceps: "isolation biceps",
  iso_triceps: "isolation triceps",
  iso_quadriceps: "isolation quadriceps",
  iso_ischios: "isolation ischios",
};

/* Reprise de src/display.js, qui est un module de vue : l'importer ferait
   dépendre une feuille de l'affichage (§2 de docs/ARCHITECTURE.md). Sept
   mots recopiés valent mieux qu'une dépendance à l'envers. */
const DAY_NAMES = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

const sessionLabel = (session) => session.name || session.id || "une séance sans nom";

/* La semaine est circulaire : entre le samedi et le lundi suivant il y a
   48 h, pas 120. Sans ça, l'assertion 4 laisserait passer exactement les
   programmes de fin de semaine qu'elle est censée attraper. */
const hoursBetween = (a, b) => {
  const d = Math.abs(a - b);
  return Math.min(d, 7 - d) * 24;
};

/* Assertion 3 — aucun pattern dupliqué dans une même séance (règle B.2).
   Les lignes sans `pattern` sont ignorées : les quatre entrées hors
   taxonomie n'ont rien à dupliquer. */
function assertPatterns(week) {
  const findings = [];
  for (const session of week.sessions) {
    const byPattern = new Map();
    for (const row of session.rows) {
      if (!row.entry.pattern) continue;
      if (!byPattern.has(row.entry.pattern)) byPattern.set(row.entry.pattern, []);
      byPattern.get(row.entry.pattern).push(row);
    }
    for (const [pattern, rows] of byPattern) {
      if (rows.length < 2) continue;
      const names = rows.map((r) => r.entry.name).join(", ");
      findings.push({
        code: "duplicate-pattern",
        sessionId: session.id,
        pattern,
        message: `« ${sessionLabel(session)} » enchaîne ${rows.length} exercices du même schéma moteur `
          + `(${PATTERN_LABELS[pattern] || pattern}) : ${names}. `
          + `La règle veut un seul exercice par schéma et par séance.`,
      });
    }
  }
  return findings;
}

/* Assertion 4 — au moins 48 h entre deux sollicitations primaires d'un gros
   groupe. « Primaire » vaut PRIMARY, le seuil du palier plein
   (decisions-spec.md Q3). Les séances sans `day` lisible sont sautées :
   elles n'ont pas de place dans la semaine, donc pas d'écart à mesurer. */
function assertRecovery(week) {
  const findings = [];
  for (const m of LARGE_GROUPS) {
    const placed = week.sessions.filter(
      (s) => s.day != null && s.rows.some((row) => (row.entry.muscles ? row.entry.muscles[m] ?? 0 : 0) >= PRIMARY),
    );
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const gap = hoursBetween(placed[i].day, placed[j].day);
        if (gap >= 48) continue;
        findings.push({
          code: "insufficient-recovery",
          muscle: m,
          sessionId: placed[i].id,
          partnerId: placed[j].id,
          message: `${MUSCLE_LABELS[m]} : « ${sessionLabel(placed[i])} » (${DAY_NAMES[placed[i].day - 1]}) et `
            + `« ${sessionLabel(placed[j])} » (${DAY_NAMES[placed[j].day - 1]}) sollicitent ce groupe à titre `
            + `principal à ${gap} h d'intervalle ; un gros groupe demande au moins 48 h.`,
        });
      }
    }
  }
  return findings;
}

/* Une intention déclarée est utilisable si elle porte une table de volume et
   une durée de séance. Trois assertions en dépendent ; les trois autres
   lisent le programme seul. Rien n'est jamais inféré du programme lui-même :
   déduire la durée demandée de la durée constatée rendrait l'assertion 5
   incapable d'échouer, et une assertion qui ne peut pas échouer rassure au
   lieu de vérifier (decisions-spec.md Q2). */
const hasTargets = (targets) =>
  isObj(targets) && isObj(targets.volume) && Number.isFinite(targets.duration);

/* Tout le travail anti-mouvement et les portés est modélisé par le catalogue
   de génération comme le seul pattern « abdominaux », et les quatre entrées
   qui en relèvent n'ont pas encore de `muscles` (#25, amendement du
   2026-09-10). Une semaine dont le gainage n'est que du Pallof affiche donc
   0 série et 0 séance d'abdominaux — un manque qui appartient au registre,
   pas au programme.

   Vaut pour les deux formes de manque, volume et fréquence : c'est le même
   angle mort vu sous deux angles. L'excès, lui, reste signalé — il ne peut
   pas venir de séries qu'on n'a pas comptées. */
const shortfallHidden = (week, m) => m === "abdominaux" && hasUnmodelledRows(week);

/* Assertion 1 — volume par muscle dans les fourchettes, ou justifié par la
   cascade de réduction.

   Le plancher est le plus bas des deux : la fourchette, ou la cible que la
   cascade a produite — c'est exactement ce que veut dire « justifié par la
   cascade ». La tolérance de ±1 est celle du §3 étape 4 (« condition
   d'arrêt : tous les déficits <= 1 ») et celle que le contrôle du §5
   applique en toutes lettres (« biceps 3 (−1, toléré) »).

   Deux exceptions, chacune pour ne pas reprocher au programme d'avoir
   appliqué la méthode : le deltoïde antérieur ne se signale jamais en excès
   (voir VOLUME), et les abdominaux pas en manque quand la semaine porte du
   gainage que le registre ne sait pas compter (voir shortfallHidden). */
function assertVolume(week, targets) {
  if (!hasTargets(targets)) return [];
  const volume = weeklyVolume(week);
  const findings = [];

  for (const [m, range] of Object.entries(VOLUME)) {
    const weekly = volume[m];
    const target = Number.isFinite(targets.volume[m]) ? targets.volume[m] : range.min;
    const floor = Math.min(range.min, target);

    if (weekly > range.max && !range.coveredIndirectly) {
      findings.push({
        code: "volume-out-of-range",
        muscle: m,
        message: `${MUSCLE_LABELS[m]} : ${fr(weekly)} séries de travail par semaine, pour une fourchette de `
          + `${range.min} à ${range.max}. `
          /* La phrase d'explication suit la règle de comptage du groupe :
             la promettre sur un groupe direct décrirait un calcul que le
             module ne fait pas. */
          + (range.direct
            ? "Sur ce groupe, seules les séries directes comptent."
            : "Les séries indirectes comptent pour moitié dans ce total."),
      });
      continue;
    }

    if (weekly < floor - 1 && !shortfallHidden(week, m)) {
      findings.push({
        code: "volume-out-of-range",
        muscle: m,
        message: `${MUSCLE_LABELS[m]} : ${fr(weekly)} séries de travail par semaine, pour une cible de `
          + `${fr(target)}. En dessous de ${fr(floor - 1)}, le groupe est sous-entraîné.`,
      });
    }
  }
  return findings;
}

/* Assertion 2 — fréquence de stimulation >= 1,5 par muscle non exclu. Un
   muscle dont la cible est à zéro a été écarté volontairement (maintien,
   ou cascade) : lui reprocher de n'être pas stimulé serait signaler la
   décision qu'on vient de prendre. */
function assertFrequency(week, targets) {
  if (!hasTargets(targets)) return [];
  const frequency = stimulationFrequency(week);
  const findings = [];

  for (const m of Object.keys(VOLUME)) {
    if (!(targets.volume[m] > 0)) continue;
    if (frequency[m] >= 1.5 || shortfallHidden(week, m)) continue;
    findings.push({
      code: "frequency-below-floor",
      muscle: m,
      message: `${MUSCLE_LABELS[m]} : ${frequency[m]} séance par semaine. La fréquence de stimulation `
        + `demandée est d'au moins 1,5 par semaine, soit deux séances sur trois.`,
    });
  }
  return findings;
}

/* Assertion 5 — durée estimée <= durée demandée. Le modèle est celui du §3
   étape 3, forfaitaire : 10 min d'échauffement et 3 min par série de
   travail. C'est l'exact inverse du plafond que calcule targetsFor
   (decisions-spec.md Q4) ; lire le `rest` réel des créneaux donnerait une
   estimation plus courte, et surtout un module en désaccord avec lui-même. */
function assertDuration(week, targets) {
  if (!hasTargets(targets)) return [];
  const findings = [];
  for (const session of week.sessions) {
    const estimated = 10 + 3 * session.sets;
    if (estimated <= targets.duration) continue;
    findings.push({
      code: "duration-over-budget",
      sessionId: session.id,
      message: `« ${sessionLabel(session)} » : ${session.sets} séries de travail, soit environ `
        + `${estimated} min échauffement compris, pour une séance demandée à ${targets.duration} min.`,
    });
  }
  return findings;
}

/* ---------- Assertion 6 — le thème annoncé contre les muscles travaillés ----

   C'est le test que FitAI échoue : une séance intitulée « Épaules et bras »
   qui entraîne les ischios. Il ne peut porter que sur le texte *affiché* —
   `session.sub`, ce que l'en-tête de l'écran Séance imprime — parce que
   c'est le seul énoncé qu'un humain lit et que rien ne vérifie : le
   validateur de forme ne regarde jamais ce champ. Un thème que le
   générateur écrirait lui-même à partir des muscles qu'il vient de choisir
   comparerait un nombre à lui-même (decisions-spec.md Q5).

   Le lexique est fermé et volontairement incomplet. Un mot inconnu est
   ignoré en silence : « Squat », « Hip thrust » et « presse » nomment des
   exercices, pas des muscles, et les inventorier n'apprendrait rien. Un
   muscle travaillé mais non annoncé n'est jamais un signalement non plus —
   « Upper A » n'annonce rien et ne ment donc sur rien. */
const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/* Les groupes qu'un mot recouvre. Un terme parapluie est satisfait dès
   qu'*un* de ses groupes est travaillé : « Épaules » ne demande pas les
   trois faisceaux, des élévations latérales suffisent. */
const THEME_PHRASES = {
  "chaine posterieure": ["ischios_fessiers", "dos"],
  "delt anterieur": ["deltoide_ant"],
  "delt lateral": ["deltoide_lat"],
  "delt posterieur": ["deltoide_post"],
  "deltoide anterieur": ["deltoide_ant"],
  "deltoide lateral": ["deltoide_lat"],
  "deltoide posterieur": ["deltoide_post"],
};

const DELTOIDS = ["deltoide_ant", "deltoide_lat", "deltoide_post"];

const THEME_WORDS = {
  pecs: ["pectoraux"], pectoraux: ["pectoraux"], pectoral: ["pectoraux"], poitrine: ["pectoraux"],
  dos: ["dos"], dorsaux: ["dos"],
  ischios: ["ischios_fessiers"], ischio: ["ischios_fessiers"], fessiers: ["ischios_fessiers"],
  quadriceps: ["quadriceps"], quads: ["quadriceps"], cuisses: ["quadriceps"],
  mollets: ["mollets"],
  biceps: ["biceps"], triceps: ["triceps"], bras: ["biceps", "triceps"],
  abdos: ["abdominaux"], abdominaux: ["abdominaux"], gainage: ["abdominaux"],
  epaules: DELTOIDS, deltoides: DELTOIDS, delts: DELTOIDS,
};

/* Les expressions sont cherchées avant les mots, et retirées du texte au
   passage : sans ça, « delt postérieurs » laisserait « delts » derrière lui
   et annoncerait les trois faisceaux au lieu du seul postérieur. Chaque mot
   de l'expression tolère un pluriel. */
const phrasePattern = (phrase) => new RegExp(`\\b${phrase.split(" ").map((w) => `${w}s?`).join("\\s+")}\\b`, "g");

export function announcedMuscles(sub) {
  let text = fold(sub);
  const claims = new Map();

  for (const [phrase, groups] of Object.entries(THEME_PHRASES)) {
    if (!phrasePattern(phrase).test(text)) continue;
    claims.set(phrase, { term: phrase, groups });
    text = text.replace(phrasePattern(phrase), " ");
  }
  for (const word of text.split(/[^a-z0-9]+/).filter(Boolean)) {
    const groups = THEME_WORDS[word];
    if (groups && !claims.has(word)) claims.set(word, { term: word, groups });
  }
  return [...claims.values()];
}

function assertTheme(week) {
  const findings = [];
  for (const session of week.sessions) {
    if (!session.sub) continue;

    const worked = new Set();
    for (const row of session.rows) {
      for (const m of Object.keys(VOLUME)) if (contribution(row.entry, m) > 0) worked.add(m);
    }

    for (const { term, groups } of announcedMuscles(session.sub)) {
      if (groups.some((g) => worked.has(g))) continue;
      findings.push({
        code: "theme-mismatch",
        sessionId: session.id,
        term,
        message: `« ${sessionLabel(session)} » annonce « ${term} » dans son sous-titre, mais aucune de ses `
          + `séries ne travaille ${groups.map((g) => MUSCLE_LABELS[g]).join(" ou ")}.`,
      });
    }
  }
  return findings;
}

/* Les demi-séries existent — un composé apporte 0,5 à un gros groupe — et
   « 10.5 séries » se lit mal en français. */
const fr = (n) => String(n).replace(".", ",");

const ASSERTIONS = [assertVolume, assertFrequency, assertPatterns, assertRecovery, assertDuration, assertTheme];

/* Deux findings qui désignent le même problème n'en font qu'un, marqué
   « both ». Sans cette fusion, les deux programmes livrés doublent chacun
   de leurs signalements : leurs variantes b1 et b2 ont le même profil
   musculaire, donc les mêmes avis. Un avis affiché deux fois se lit comme
   deux problèmes.

   La clé porte sur l'*identité* du problème — séance, muscle, schéma — et
   surtout pas sur le message. Le cas qui l'impose est le seul vrai doublon
   du dépôt : « Haut A » enchaîne deux poussées horizontales dans les deux
   blocs, mais la deuxième est un développé incliné haltères en bloc 1 et
   une presse inclinée machine en bloc 2. Deux phrases différentes, un seul
   problème. Le message retenu est celui du premier bloc, avec ses
   variantes à lui : un exemple vaut mieux qu'une énumération. */
function mergeBlocks(perBlock) {
  const seen = new Map();
  for (const { block, findings } of perBlock) {
    for (const finding of findings) {
      const key = [finding.code, finding.sessionId, finding.partnerId, finding.muscle, finding.pattern, finding.term].join("|");
      if (seen.has(key)) seen.get(key).block = "both";
      else seen.set(key, { ...finding, block });
    }
  }
  return [...seen.values()];
}

/* Le verdict. Jamais d'exception, quelle que soit l'entrée — c'est la même
   promesse que les portes d'import (§2.4), tenue de la même façon : par des
   gardes de structure, pas par un try/catch qui rassurerait sans vérifier.

   `ok` dit « aucun avis à donner », pas « programme valide » : un programme
   qui échoue aux six se charge et s'exécute quand même. */
export function assess(program, targets) {
  const perBlock = [];
  for (const block of ["b1", "b2"]) {
    const week = resolveWeek(program, block);
    if (week) perBlock.push({ block, findings: ASSERTIONS.flatMap((fn) => fn(week, targets)) });
  }

  if (perBlock.length === 0) {
    return {
      ok: false,
      findings: [{
        code: "unreadable-program",
        message: "Ce programme n'a pas pu être lu comme une semaine d'entraînement : "
          + "sa structure de séances, de créneaux ou d'exercices est incomplète.",
      }],
    };
  }

  const findings = mergeBlocks(perBlock);

  /* L'absence d'intention déclarée est dite, pas contournée. Trois
     assertions sur six n'ont alors rien vérifié, et le taire laisserait
     croire à un programme approuvé. */
  if (!hasTargets(targets)) {
    findings.push({
      code: "no-declared-intent",
      block: "both",
      message: "Ce programme ne déclare ni cible de volume ni durée de séance : le volume par muscle, "
        + "la fréquence de stimulation et la durée n'ont pas été vérifiés.",
    });
  }

  return { ok: findings.length === 0, findings };
}
