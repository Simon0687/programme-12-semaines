/* =========================================================
   Brouillon de programme — le modèle que l'éditeur manipule (#36)

   Le brouillon *est* un `program`. Pas un modèle parallèle converti aux
   extrémités : les mêmes SLOTS/SESSIONS/CORE/WARM que porte un fichier
   chargé, édités sur place. C'est ce qui rend l'aller-retour gratuit —
   ouvrir un programme et l'enregistrer sans rien toucher rend le même
   objet, octet pour octet — et c'est aussi ce qui permettra à la
   proposition d'un futur moteur d'atterrir ici sans adaptateur (#36
   spec.md, « l'entrée de l'éditeur est un objet program »).

   Le fait sur lequel tout repose : **le journal ne nomme jamais un id de
   slot**. Une ligne de log est { date, slot, ex } où `slot` est l'id de
   *séance* (writeLog, src/schema.js:92) et `ex` est indexé par id
   d'*exercice* (history, src/progression.js:153). Les ids de slots ne
   sont lus que par le programme lui-même, donc les créer, les dupliquer
   ou les supprimer ne peut rien réécrire de ce qui est stocké. Deux
   libertés en découlent, toutes deux utilisées plus bas : dupliquer un
   slot partagé avant de l'éditer (forkIfShared) et supprimer ceux que
   plus personne ne référence (prune).

   Ce module ne valide pas : le jugement de forme appartient à
   src/journal-shape.js, seul et même appelé par les deux portes d'import
   (ARCHITECTURE §2.9). Ce qu'il fait, c'est ne pas *pouvoir* produire les
   formes que le validateur refuse — ids de séance uniques, aucune
   référence pendante, aucun slot orphelin, aucun exercice hors du
   registre fermé (§2.5). Deux états transitoires lui échappent, et c'est
   voulu : la fourchette de reps en cours de frappe — deux champs libres —
   et la séance encore vide, qu'il faut bien pouvoir traverser pour la
   remplir. Ni l'une ni l'autre ne s'enregistre : c'est le validateur qui
   tranche au bouton, avec sa phrase à lui.

   Aucun import React, aucun accès au stockage : chargeable par
   `node --test` (§2.6), qui est là où se joue la totalité de la logique
   de l'éditeur — src/ProgramEditor.jsx n'émet que du balisage.

   Ce que ce module ne porte pas encore : la règle d'édition d'un cycle
   déjà commencé (spec.md Q2, option B). Ce lot enregistre toujours un
   nouveau cycle, donc la branche « écraser une définition existante » de
   loadProgram() n'est jamais atteinte et il n'y a rien à verrouiller.
   startedSessionIds/lockedEdits rejoindront ce fichier avec l'issue
   suivante (design.md, étape 8).
   ========================================================= */

import { EXERCISE_IDS } from "./registry.js";
import { DEFINITION_FORMAT_VERSION } from "./definition.js";
import { LEGACY_DEFINITION } from "./legacy-program.js";

/* Valeurs de départ d'une ligne neuve. La fourchette la plus fréquente du
   programme bundlé et un repos moyen : un point de départ à corriger en
   deux gestes, pas une recommandation. */
const NEW_ROW = { reps: [8, 12], rest: 90 };
const NEW_SETS = 3;

/* Les drapeaux ne sont écrits que lorsqu'ils sont vrais — c'est la forme
   qu'ont les programmes livrés (public/programs/*.json), et la garder
   évite qu'un aller-retour par l'éditeur transforme `{}` en
   `{ key: false, fail: false }` dans chaque slot d'un fichier exporté. */
const FLAGS = ["key", "fail"];

/* ---------- Identifiants ----------
   Ils sont engendrés, jamais saisis. C'est ce qui ferme d'un coup les
   deux pièges que le validateur passe son temps à rattraper : deux
   séances partageant un id (journal-shape.js:168 — findLog rend la
   première, la seconde devient inatteignable) et l'id de séance modifié
   après coup, qui rendrait les lignes déjà stockées introuvables.
   Renommer une séance ne touche donc pas son id : le nom est une
   étiquette, l'id est une adresse. */
const slug = (s) =>
  String(s ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function uniqueId(base, taken) {
  const set = taken instanceof Set ? taken : new Set(taken);
  if (!set.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!set.has(candidate)) return candidate;
  }
}

const sessionIds = (program) => program.SESSIONS.map((s) => s.id);
const firstKey = (obj) => Object.keys(obj)[0];

/* ---------- Dates ----------
   Le lundi qui vient, aujourd'hui compris s'il est lundi : un programme
   se commence en début de semaine, et `day` est un décalage depuis
   startDate (dateForSlot, src/schema.js:76), si bien qu'un départ un
   lundi est le seul cas où « jour 1 » veut dire lundi. La date du jour
   est un paramètre, jamais lue ici : c'est ce qui rend la fonction
   testable sans horloge. */
export function nextMonday(today) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  d.setDate(d.getDate() + ((8 - (d.getDay() || 7)) % 7));
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ---------- Création et ouverture ---------- */

/* Le squelette d'un écran neuf : une séance, un échauffement, un bloc de
   gainage, aucun exercice. Il n'est pas enregistrable en l'état et ne
   cherche pas à l'être — le validateur exige au moins un exercice par
   séance, sans quoi le cycle écrit n'aurait rien à exécuter et l'écran
   Semaine rien à résumer. Le bouton refuse donc tant que l'écran est
   vide, mais il dit pourquoi, avec la phrase que recevrait un fichier
   importé au même trou (journal-shape.js, SESSIONS[].ex). */
export function emptyProgram() {
  return {
    SLOTS: {},
    SESSIONS: [{ id: "seance", name: "Séance 1", sub: "", day: 1, warm: "echauffement", ex: [], core: "gainage" }],
    CORE: { gainage: { label: "Gainage", ex: [] } },
    WARM: { echauffement: "" },
    cardio: null, // #36 Q3 : un programme composé ne porte pas de cardio
  };
}

const sealed = (draft) => ({ ...draft, seed: snapshot(draft) });
const snapshot = (d) => JSON.stringify({ name: d.name, startDate: d.startDate, program: d.program, startingLoads: d.startingLoads });

/* « Ce brouillon a-t-il changé depuis qu'on l'a ouvert ? » — la question
   que pose le garde-fou de sortie, puisque rien n'est stocké tant qu'on
   n'a pas enregistré (#36 Q4). Comparaison sur la forme sérialisée : une
   mutation qui repose la même valeur laisse la même chaîne (les spreads
   conservent l'ordre des clés existantes), et dans le pire des cas un
   faux positif coûte une confirmation de trop — jamais une perte. */
export const isDirty = (draft) => snapshot(draft) !== draft.seed;

export function emptyDraft(today) {
  return sealed({ id: null, name: "Nouveau programme", startDate: nextMonday(today), program: emptyProgram(), startingLoads: {}, profile: undefined });
}

/* Ouvrir une définition existante. Le repli sur LEGACY_DEFINITION est
   celui de buildProgram() (src/program.js:49) et pour la même raison :
   une définition d'avant #25 n'a pas de `program`, et ce qu'elle voulait
   dire est « la structure héritée », pas « ce que l'appli embarque
   aujourd'hui » (#32). Composer à partir d'un tel cycle doit montrer le
   programme réellement suivi, pas un écran vide. */
export function draftFrom(definition) {
  return sealed({
    id: typeof definition.id === "string" ? definition.id : null,
    name: definition.name ?? definition.id ?? "",
    startDate: definition.startDate,
    program: structuredClone(definition.program ?? LEGACY_DEFINITION.program),
    startingLoads: structuredClone(definition.startingLoads ?? {}),
    profile: definition.profile,
  });
}

/* L'id du cycle à écrire. Rendu explicite plutôt que calculé dans
   toDefinition() : c'est la décision « nouveau cycle ou cycle repris »,
   la seule qui touche à ce qui est déjà stocké, et elle mérite un appel
   qu'on voit dans App.jsx. Ce lot l'appelle toujours. */
export function withNewId(draft, takenIds) {
  return { ...draft, id: uniqueId(slug(draft.name) || "programme", takenIds) };
}

/* La définition, telle qu'elle partira dans validateDefinition() puis
   dans loadProgram() — même objet qu'un fichier chargé produirait.
   `profile`, `startingLoads` et les champs de `program` que l'éditeur ne
   touche pas (volume, fallback, cardio) traversent tels quels : les
   éditer est hors périmètre, les perdre ne l'est pas. */
export function toDefinition(draft) {
  return {
    formatVersion: DEFINITION_FORMAT_VERSION,
    id: draft.id,
    name: draft.name,
    /* 12 en dur, comme le validateur qui le refuse autrement
       (journal-shape.js:316). La constante n'existe nulle part : la
       relâcher est #14, et ce sera là qu'elle naîtra. */
    weeks: 12,
    startDate: draft.startDate,
    startingLoads: draft.startingLoads,
    ...(draft.profile !== undefined && { profile: draft.profile }),
    program: draft.program,
  };
}

/* ---------- Plomberie interne ----------
   Une « adresse de lignes » vaut { session: id } ou { core: clé } : les
   deux listes ont la même forme ([slotId, séries]) et le même validateur,
   donc un seul jeu de fonctions les édite. */

const withProgram = (draft, program) => ({ ...draft, program });

const rowsOf = (program, owner) =>
  owner.core
    ? program.CORE[owner.core]?.ex ?? null
    : program.SESSIONS.find((s) => s.id === owner.session)?.ex ?? null;

const withRows = (program, owner, rows) =>
  owner.core
    ? { ...program, CORE: { ...program.CORE, [owner.core]: { ...program.CORE[owner.core], ex: rows } } }
    : { ...program, SESSIONS: program.SESSIONS.map((s) => (s.id === owner.session ? { ...s, ex: rows } : s)) };

const allRows = (program) => [
  ...program.SESSIONS.flatMap((s) => s.ex),
  ...Object.values(program.CORE).flatMap((c) => c.ex),
];

const refCount = (program, slotId) => allRows(program).filter(([id]) => id === slotId).length;

/* Un slot que plus aucune ligne ne nomme n'a aucun moyen d'être affiché
   ni corrigé : il ne resterait visible que dans le fichier exporté. On le
   retire donc à chaque mutation qui défait une référence. */
const prune = (program) => {
  const used = new Set(allRows(program).map(([id]) => id));
  const SLOTS = Object.fromEntries(Object.entries(program.SLOTS).filter(([id]) => used.has(id)));
  return Object.keys(SLOTS).length === Object.keys(program.SLOTS).length ? program : { ...program, SLOTS };
};

const normalizeSlot = (slot) => {
  const out = { ...slot };
  for (const f of FLAGS) if (!out[f]) delete out[f];
  return out;
};

/* Éditer une ligne d'Upper A ne doit pas changer celle d'Upper B. Rien
   n'interdit à deux séances de partager un slot — le format le permet et
   un fichier écrit à la main peut en arriver là — mais l'écran présente
   une ligne comme appartenant à sa séance, et c'est cette promesse-là
   qu'on tient. Dupliquer est sans conséquence sur le stockage : aucun id
   de slot n'y figure (cf. en-tête). */
const forkIfShared = (program, owner, i) => {
  const rows = rowsOf(program, owner);
  const [slotId, sets] = rows[i];
  if (refCount(program, slotId) < 2) return { program, slotId };
  const forked = uniqueId(slotId, Object.keys(program.SLOTS));
  const withSlot = { ...program, SLOTS: { ...program.SLOTS, [forked]: { ...program.SLOTS[slotId] } } };
  return { program: withRows(withSlot, owner, rows.map((r, j) => (j === i ? [forked, sets] : r))), slotId: forked };
};

const moved = (list, i, delta) => {
  const j = i + delta;
  if (i < 0 || i >= list.length || j < 0 || j >= list.length) return null;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
};

/* ---------- Séances ---------- */

export function addSession(draft) {
  const { program } = draft;
  let next = program;
  /* Une séance doit nommer un échauffement et un bloc de gainage qui
     existent (journal-shape.js) ; un programme importé peut n'en avoir
     aucun, auquel cas on en crée avant, plutôt que d'écrire une
     référence pendante. */
  if (!firstKey(next.WARM)) next = { ...next, WARM: { ...next.WARM, echauffement: "" } };
  if (!firstKey(next.CORE)) next = { ...next, CORE: { ...next.CORE, gainage: { label: "Gainage", ex: [] } } };
  const name = `Séance ${next.SESSIONS.length + 1}`;
  const last = next.SESSIONS[next.SESSIONS.length - 1];
  const session = {
    id: uniqueId(slug(name) || "seance", sessionIds(next)),
    name,
    sub: "",
    day: Math.min(7, (last ? last.day : 0) + 1),
    warm: firstKey(next.WARM),
    ex: [],
    core: firstKey(next.CORE),
  };
  return withProgram(draft, { ...next, SESSIONS: [...next.SESSIONS, session] });
}

/* La dernière séance ne se supprime pas : SESSIONS vide est refusé par le
   validateur, et un écran qu'on ne peut plus enregistrer est pire qu'un
   bouton grisé. */
export function removeSession(draft, sessionId) {
  const { program } = draft;
  if (program.SESSIONS.length <= 1) return draft;
  const SESSIONS = program.SESSIONS.filter((s) => s.id !== sessionId);
  if (SESSIONS.length === program.SESSIONS.length) return draft;
  return withProgram(draft, prune({ ...program, SESSIONS }));
}

/* L'ordre des séances est libre et ne se déduit pas de `day` (#36,
   décision du 2026-09-16) : c'est celui que rend la liste Semaine, et
   celui qui départage deux séances du même jour dans history(). */
export function moveSession(draft, sessionId, delta) {
  const i = draft.program.SESSIONS.findIndex((s) => s.id === sessionId);
  const SESSIONS = i < 0 ? null : moved(draft.program.SESSIONS, i, delta);
  return SESSIONS ? withProgram(draft, { ...draft.program, SESSIONS }) : draft;
}

/* name | sub | day | warm | core. Pas `id` ni `ex` : le premier est une
   adresse, les secondes ont leurs propres fonctions. */
export function patchSession(draft, sessionId, patch) {
  const clean = { ...patch };
  delete clean.id;
  delete clean.ex;
  if ("day" in clean) clean.day = Math.min(7, Math.max(1, Math.round(Number(clean.day) || 1)));
  if ("warm" in clean && !(clean.warm in draft.program.WARM)) delete clean.warm;
  if ("core" in clean && !(clean.core in draft.program.CORE)) delete clean.core;
  return withProgram(draft, {
    ...draft.program,
    SESSIONS: draft.program.SESSIONS.map((s) => (s.id === sessionId ? { ...s, ...clean } : s)),
  });
}

/* ---------- Lignes d'exercice ---------- */

export function addRow(draft, owner, exerciseId) {
  /* Le registre est fermé (§2.5) et c'est ici qu'on le fait respecter, à
     la source : aucun chemin de l'éditeur ne peut inventer un id. */
  if (!EXERCISE_IDS.has(exerciseId)) return draft;
  const rows = rowsOf(draft.program, owner);
  if (!rows) return draft;
  const slotId = uniqueId(slug(exerciseId) || "slot", Object.keys(draft.program.SLOTS));
  const program = { ...draft.program, SLOTS: { ...draft.program.SLOTS, [slotId]: { ...NEW_ROW, reps: [...NEW_ROW.reps], b1: exerciseId, b2: exerciseId } } };
  return withProgram(draft, withRows(program, owner, [...rows, [slotId, NEW_SETS]]));
}

export function removeRow(draft, owner, i) {
  const rows = rowsOf(draft.program, owner);
  if (!rows || i < 0 || i >= rows.length) return draft;
  return withProgram(draft, prune(withRows(draft.program, owner, rows.filter((_, j) => j !== i))));
}

export function moveRow(draft, owner, i, delta) {
  const rows = rowsOf(draft.program, owner);
  const next = rows ? moved(rows, i, delta) : null;
  return next ? withProgram(draft, withRows(draft.program, owner, next)) : draft;
}

/* sets vit sur la référence ([slotId, séries]), tout le reste sur le slot
   — d'où le tri en entrée. `sets` est borné parce qu'il se règle au
   pas-à-pas et qu'un zéro n'a pas de sens ; `reps` ne l'est pas, parce
   que c'est deux champs libres et qu'une fourchette à moitié tapée est un
   état normal de la frappe. Le validateur tranche à l'enregistrement,
   avec sa phrase à lui (« fourchette [min, max] attendue »). */
export function patchRow(draft, owner, i, patch) {
  const rows = rowsOf(draft.program, owner);
  if (!rows || i < 0 || i >= rows.length) return draft;
  const { sets, ...slotPatch } = patch;
  if ("b1" in slotPatch && !EXERCISE_IDS.has(slotPatch.b1)) delete slotPatch.b1;
  if ("b2" in slotPatch && !EXERCISE_IDS.has(slotPatch.b2)) delete slotPatch.b2;

  let program = draft.program;
  let slotId = rows[i][0];
  if (Object.keys(slotPatch).length) {
    ({ program, slotId } = forkIfShared(program, owner, i));
    program = { ...program, SLOTS: { ...program.SLOTS, [slotId]: normalizeSlot({ ...program.SLOTS[slotId], ...slotPatch }) } };
  }
  if (sets !== undefined) {
    const n = Math.max(1, Math.round(Number(sets) || 1));
    program = withRows(program, owner, rowsOf(program, owner).map((r, j) => (j === i ? [slotId, n] : r)));
  }
  return withProgram(draft, program);
}

/* ---------- Échauffements et gainage ----------
   Le format est asymétrique et l'éditeur le montre tel quel : WARM[clé]
   est un texte, donc la clé *est* le titre affiché et le renommer touche
   les séances qui la nomment ; CORE[clé] porte un `label`, donc la clé
   reste technique et le titre est un champ. Inventer une symétrie
   coûterait une migration du format pour un gain d'écran. */

export function addWarm(draft, label) {
  const key = uniqueId(slug(label) || "echauffement", Object.keys(draft.program.WARM));
  return withProgram(draft, { ...draft.program, WARM: { ...draft.program.WARM, [key]: "" } });
}

export function setWarmText(draft, key, text) {
  if (!(key in draft.program.WARM)) return draft;
  return withProgram(draft, { ...draft.program, WARM: { ...draft.program.WARM, [key]: String(text) } });
}

export function renameWarm(draft, key, label) {
  const { program } = draft;
  if (!(key in program.WARM)) return draft;
  const next = uniqueId(slug(label) || "echauffement", Object.keys(program.WARM).filter((k) => k !== key));
  if (next === key) return draft;
  /* Réécrit en conservant l'ordre : un objet reconstruit clé par clé
     garde l'ordre d'insertion, et cet ordre est celui de la liste
     affichée. */
  const WARM = Object.fromEntries(Object.entries(program.WARM).map(([k, v]) => (k === key ? [next, v] : [k, v])));
  const SESSIONS = program.SESSIONS.map((s) => (s.warm === key ? { ...s, warm: next } : s));
  return withProgram(draft, { ...program, WARM, SESSIONS });
}

/* Un bloc encore nommé par une séance ne se supprime pas : ce serait la
   référence pendante que le validateur refuse. Même règle pour le
   dernier bloc, qu'une séance nomme forcément. */
export function removeWarm(draft, key) {
  const { program } = draft;
  if (!(key in program.WARM) || program.SESSIONS.some((s) => s.warm === key)) return draft;
  const { [key]: _, ...WARM } = program.WARM;
  return withProgram(draft, { ...program, WARM });
}

export function addCore(draft, label) {
  const key = uniqueId(slug(label) || "gainage", Object.keys(draft.program.CORE));
  return withProgram(draft, { ...draft.program, CORE: { ...draft.program.CORE, [key]: { label: String(label ?? ""), ex: [] } } });
}

export function setCoreLabel(draft, key, label) {
  if (!(key in draft.program.CORE)) return draft;
  return withProgram(draft, { ...draft.program, CORE: { ...draft.program.CORE, [key]: { ...draft.program.CORE[key], label: String(label) } } });
}

export function removeCore(draft, key) {
  const { program } = draft;
  if (!(key in program.CORE) || program.SESSIONS.some((s) => s.core === key)) return draft;
  const { [key]: _, ...CORE } = program.CORE;
  return withProgram(draft, prune({ ...program, CORE }));
}

/* ---------- Charges de départ ----------
   startingLoads est indexé par id d'*exercice*, pas par slot : un même
   exercice tenu par deux lignes n'a qu'une charge de départ. D'où une
   section à part dans l'écran plutôt qu'un champ par ligne, et cette
   liste-ci, dans l'ordre où les séances les introduisent. */
export function referencedExercises(program) {
  const out = [];
  for (const [slotId] of allRows(program)) {
    const slot = program.SLOTS[slotId];
    if (!slot) continue;
    for (const b of ["b1", "b2"]) if (slot[b] && !out.includes(slot[b])) out.push(slot[b]);
  }
  return out;
}

/* Vide (ou illisible) veut dire « pas de charge de départ » — la semaine 1
   de calibration s'en charge, comme pour le programme livré depuis #26.
   Zéro, lui, est une valeur : c'est le poids du corps aux tractions, et
   buildProgram() l'affecte sans condition (src/program.js:49). */
export function setStartingLoad(draft, exerciseId, value) {
  if (!EXERCISE_IDS.has(exerciseId)) return draft;
  if (!Number.isFinite(value)) {
    if (!(exerciseId in draft.startingLoads)) return draft;
    const { [exerciseId]: _, ...startingLoads } = draft.startingLoads;
    return { ...draft, startingLoads };
  }
  return { ...draft, startingLoads: { ...draft.startingLoads, [exerciseId]: value } };
}
