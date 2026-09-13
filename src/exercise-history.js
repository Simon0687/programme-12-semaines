/* =========================================================
   Historique d'un exercice, tous cycles confondus (#17)

   L'unique traversée du journal indexée par exercice. Le journal range les
   séries par `(programme, date, créneau)` et jamais par exercice, si bien
   que toute lecture longue est un parcours complet. À l'échelle réelle —
   environ 260 séances par an sur un appareil — ce parcours ne coûte rien ;
   ce qu'il fallait éviter, c'est de l'écrire trois fois. #14 et #35
   appelleront ce module au lieu de reparcourir le journal eux-mêmes.

   Ce n'est pas un doublon de `history()` (progression.js), et les fusionner
   serait une erreur : la lecture du moteur est volontairement plus étroite.
   `planned()` ne regarde que le programme actif parce qu'il ne doit jamais
   comparer des prescriptions de fourchettes différentes — une série de 8
   dans du 4–8 ne vaut pas une série de 8 dans du 8–12. Ici la question est
   « qu'est-ce que je soulevais il y a un an », donc on lit tout.

   Fermé par défaut sur le contenu de `ex` (ARCHITECTURE §2.4).
   `isLogRow()` (journal-shape.js) vérifie `date`, `slot`, et que `ex` soit
   un objet — il ne regarde jamais *dedans*. Une ligne où `ex.dc` vaut la
   chaîne "87,5" passe le filtre et fait lever `history()`
   (`TypeError: … .map is not a function`, vérifié le 2026-09-14). Le défaut
   existe déjà sur le programme actif ; lire tous les cycles en élargit la
   surface, justement aux entrées dont la définition a échoué à la
   validation. Durcir `isLogRow` changerait le verdict d'une frontière et
   ferait tomber des lignes au chargement : c'est #38, pas ici.

   `done` est le seul filtre d'inclusion, et il suffit à exclure la séance en
   cours : un record annoncé en série 1 qu'une série 3 démentirait ne serait
   pas un record, et les séries en cours sont visibles sur l'écran d'où l'on
   vient (#17 spec, Edge cases).

   Non-objectifs : ce module ne met rien en forme (c'est display.js) et
   n'importe pas React (§2.6).
   ========================================================= */

import { num } from "./progression.js";

const isObj = (x) => typeof x === "object" && x !== null && !Array.isArray(x);

const hasLoad = (unit) => unit !== "time" && unit !== "reps";

function readSets(rec, exerciseId) {
  const raw = isObj(rec.ex) && Array.isArray(rec.ex[exerciseId]) ? rec.ex[exerciseId] : [];
  return raw
    .filter(isObj)
    .map((x) => ({ w: num(x.w), r: num(x.r), rir: num(x.rir) }))
    .filter((x) => x.r != null);
}

/* Une définition invalide est exactement le cas où SESSIONS peut manquer :
   on rend `null` plutôt que de lever, et la vue affiche la date seule — qui
   est de toute façon l'identité du log (ARCHITECTURE §2.3). */
function sessionsOf(definition) {
  if (!isObj(definition) || !isObj(definition.program)) return [];
  return Array.isArray(definition.program.SESSIONS) ? definition.program.SESSIONS : [];
}

export function exerciseHistory(journal, exerciseId) {
  const out = [];
  if (!isObj(journal) || !isObj(journal.programs) || typeof exerciseId !== "string") return out;

  for (const [programId, entry] of Object.entries(journal.programs)) {
    if (!isObj(entry) || !isObj(entry.logs)) continue;
    const definition = isObj(entry.definition) ? entry.definition : null;
    const programName = definition && typeof definition.name === "string" ? definition.name : null;
    const sessions = sessionsOf(definition);

    for (const rec of Object.values(entry.logs)) {
      if (!isObj(rec) || !rec.done) continue;
      if (typeof rec.date !== "string" || typeof rec.slot !== "string") continue;
      const sets = readSets(rec, exerciseId);
      if (!sets.length) continue;
      const si = sessions.findIndex((s) => isObj(s) && s.id === rec.slot);
      const session = si >= 0 ? sessions[si] : null;
      out.push({
        date: rec.date,
        slot: rec.slot,
        programId,
        programName,
        sessionName: session && typeof session.name === "string" ? session.name : null,
        kind: typeof rec.kind === "string" ? rec.kind : "normal",
        order: si >= 0 ? si : 0,
        sets,
      });
    }
  }

  /* Le rang de la séance sert à départager deux séances d'un même jour, et il
     est lu dans les SESSIONS *de ce cycle-là* : c'est la seule valeur qui ait
     un sens pour une entrée d'un programme qu'on ne parcourt plus. */
  out.sort((a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1));
  return out;
}

/* Valeur qui progresse, selon l'unité : la charge quand il y en a une, la
   tenue ou le nombre de reps sinon. C'est ce que la courbe trace. */
export function bestValue(entry, unit) {
  if (!entry || !entry.sets.length) return null;
  const vals = hasLoad(unit)
    ? entry.sets.map((s) => (s.w == null ? 0 : s.w))
    : entry.sets.map((s) => s.r);
  return Math.max(...vals);
}

/* Un segment par cycle, jamais un trait unique : relier deux cycles par-dessus
   la coupure inventerait une continuité qui n'a pas eu lieu. Le découpage suit
   les changements *consécutifs* de programId — deux cycles ne se chevauchent
   pas dans le temps, et s'ils le faisaient on voudrait deux segments malgré
   tout. */
export function seriesByCycle(entries, unit) {
  const out = [];
  for (const e of entries || []) {
    const value = bestValue(e, unit);
    if (value == null) continue;
    let cur = out[out.length - 1];
    if (!cur || cur.programId !== e.programId) {
      cur = { programId: e.programId, programName: e.programName, points: [] };
      out.push(cur);
    }
    cur.points.push({ date: e.date, value, kind: e.kind });
  }
  return out;
}

/* Records : de la donnée observée, aucun modèle.

   Pour N reps, la charge la plus lourde jamais portée sur N reps **ou plus** —
   si 85 kg ont été tenus sur 8 reps, ils l'ont bien été sur 5. La table est
   donc décroissante par construction et ne peut pas s'auto-contredire, ce
   qu'un record strict par nombre exact de reps ferait dès le premier trou dans
   les données.

   `entries` arrive trié du plus ancien au plus récent et la comparaison est
   stricte : la date retenue est donc la *première* fois que la charge a été
   atteinte, pas la dernière.

   Sans charge (time, reps), la table dégénère en une ligne — même écran, même
   code (#17, critère d'acceptation). */
export function recordsFor(entries, unit) {
  const list = entries || [];

  if (!hasLoad(unit)) {
    let best = null, date = null;
    for (const e of list) {
      for (const s of e.sets) {
        if (s.r != null && (best == null || s.r > best)) { best = s.r; date = e.date; }
      }
    }
    return { mode: "best", best, date };
  }

  const repCounts = new Set();
  for (const e of list) for (const s of e.sets) if (s.r != null) repCounts.add(s.r);

  const rows = [];
  for (const reps of [...repCounts].sort((a, b) => a - b)) {
    let load = null, date = null;
    for (const e of list) {
      for (const s of e.sets) {
        if (s.r == null || s.r < reps) continue;
        const w = s.w == null ? 0 : s.w;
        if (load == null || w > load) { load = w; date = e.date; }
      }
    }
    if (load != null) rows.push({ reps, load, date });
  }
  return { mode: "byReps", rows };
}
