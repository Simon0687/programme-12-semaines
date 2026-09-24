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

import { normalizeSets } from "./progression.js";
import { traitsOf } from "./units.js";

const isObj = (x) => typeof x === "object" && x !== null && !Array.isArray(x);

const hasLoad = (unit) => traitsOf(unit).hasLoad;

/* Les deux gardes de ce lecteur — l'objet, le tableau — sont parties dans
   normalizeSets (#23) : ce module lit des journaux que personne n'a validés
   (#32), et il valait mieux que la fonction partagée les porte pour tout le
   monde que de garder ici une copie qui en savait plus que les autres. */
function readSets(rec, exerciseId) {
  return normalizeSets(isObj(rec.ex) ? rec.ex[exerciseId] : null);
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

/* ---------- Ce que la courbe trace, selon l'unité ----------

   La première version traçait la charge brute de la meilleure série et ne
   regardait pas les reps : 8 reps à 90 kg et 2 reps à 90 kg donnaient le même
   point. La courbe annonçait donc une progression là où il y avait un
   effondrement — constaté à l'usage le 2026-09-14, et c'est ce qui a renversé
   la décision « ni 1RM estimé ni tonnage » de la spec (#17, Décision 4).

   Trois régimes, parce que les cinq unités ne progressent pas de la même
   façon :

   - `estimate` (kg) — un **10RM estimé**. Pas un 1RM : savoir ce qu'on lèverait
     une fois n'informe pas un programme où l'on ne fait jamais de single,
     alors qu'un dix reps est l'ordre de grandeur réellement travaillé.
   - `raw` (time, reps) — rien à estimer : sans charge, la meilleure série *est*
     la mesure.
   - `dual` (bw, carry) — deux grandeurs qui progressent ensemble (reps et lest,
     tenue et charge). Aucune extrapolation possible : un 10RM calculé sur des
     tractions à 6 reps donnerait un lest **négatif**, qui ne veut rien dire.
     D'où deux tracés sur une même abscisse — courbe pour les reps ou la tenue,
     barres pour la charge. */

/* Les cinq cas sont dans UNITS (units.js, #23) ; ce qui reste ici est la
   porte, et le pourquoi ci-dessus — vers lequel la table renvoie. */
export function chartMode(unit) {
  return traitsOf(unit).chart;
}

/* Epley (1RM = w × (1 + r/30)) ramené à dix répétitions, ce qui se simplifie
   en w × (30 + r) / 40. La formule vaut l'identité à r = 10 — dix reps à 80 kg
   donnent un 10RM de 80 kg, sans arrondi ni dérive — et c'est ce qui la rend
   préférable ici à Brzycki, qui s'effondre au-delà de 10 reps.

   Arrondi au dixième : c'est une estimation, pas une mesure, et trois
   décimales sur un axe lui donneraient une précision qu'elle n'a pas. */
export function estimate10RM(w, r) {
  if (r == null) return null;
  return Math.round(((w == null ? 0 : w) * (30 + r)) / 4) / 10;
}

/* Hors de cette fenêtre, l'estimation cesse d'être crédible : trop bas elle
   mesure surtout le système nerveux, trop haut l'endurance locale. Les points
   concernés sont tracés, jamais écartés — ils sont grisés, et la légende dit
   pourquoi (#17, Décision 4). */
export const ESTIMATE_REPS = { min: 3, max: 12 };

/* La série du jour que la courbe retient, et ce qu'elle en tire. Rend `null`
   quand aucune série n'est exploitable — la vue saute le point plutôt que de
   tracer un zéro qui n'a pas eu lieu. */
export function chartPoint(entry, unit) {
  const sets = (entry && entry.sets ? entry.sets : []).filter((s) => s.r != null);
  if (!sets.length) return null;
  const mode = chartMode(unit);

  if (mode.kind === "estimate") {
    /* La meilleure série est celle dont l'estimation est la plus haute, pas la
       plus lourde : c'est exactement le changement. Une série hors fenêtre qui
       gagne reste celle qu'on affiche — la griser dit la réserve, la masquer
       mentirait dans l'autre sens. */
    let best = null;
    for (const s of sets) {
      const value = estimate10RM(s.w, s.r);
      if (best == null || value > best.value) best = { value, reps: s.r, load: s.w == null ? 0 : s.w };
    }
    return { ...best, dim: best.reps < ESTIMATE_REPS.min || best.reps > ESTIMATE_REPS.max };
  }

  if (mode.kind === "dual") {
    /* La plus lourde, départagée par les reps. Retenir la plus longue série
       ferait remonter la courbe chaque fois qu'on allège, ce qui est
       précisément la lecture que la double progression doit empêcher. */
    let best = sets[0];
    for (const s of sets) {
      const w = s.w == null ? 0 : s.w, bw = best.w == null ? 0 : best.w;
      if (w > bw || (w === bw && s.r > best.r)) best = s;
    }
    return { value: best.r, bar: best.w == null ? 0 : best.w };
  }

  return { value: Math.max(...sets.map((s) => s.r)) };
}

/* Un segment par cycle, jamais un trait unique : relier deux cycles par-dessus
   la coupure inventerait une continuité qui n'a pas eu lieu. Le découpage suit
   les changements *consécutifs* de programId — deux cycles ne se chevauchent
   pas dans le temps, et s'ils le faisaient on voudrait deux segments malgré
   tout. */
export function seriesByCycle(entries, unit) {
  const out = [];
  for (const e of entries || []) {
    const p = chartPoint(e, unit);
    if (!p || p.value == null) continue;
    let cur = out[out.length - 1];
    if (!cur || cur.programId !== e.programId) {
      cur = { programId: e.programId, programName: e.programName, points: [] };
      out.push(cur);
    }
    cur.points.push({ date: e.date, kind: e.kind, ...p });
  }
  return out;
}

/* ---------- Le chiffre en tête de fiche (#49) ----------

   La valeur du jour et sa variation depuis le début. Elle sort de `chartPoint`,
   la même fonction que la courbe : deux calculs séparés finiraient par se
   contredire à l'écran, et c'est précisément l'écran où le chiffre doit être
   plus fiable que le tracé.

   La base est la **première séance jamais faite**, tous cycles confondus, et
   non le début du cycle courant : une frontière de cycle remettrait à zéro tous
   les trois mois la seule question que cette fiche existe pour répondre (#49,
   decisions-spec.md Q1). Que cette première séance soit presque toujours une
   calibration est le coût assumé — le moteur corrige la prescription suivante,
   jamais la base.

   `delta` vaut `null`, jamais `0`, quand une seule séance est exploitable :
   elle *est* la base, et « +0 » annoncerait un plateau au lieu d'une absence de
   recul. */
export function headline(entries, unit) {
  const pts = [];
  for (const e of entries || []) {
    const p = chartPoint(e, unit);
    if (p && p.value != null) pts.push(p);
  }
  if (!pts.length) return null;
  const last = pts[pts.length - 1];
  return {
    value: last.value,
    bar: typeof last.bar === "number" ? last.bar : null,
    dim: last.dim === true,
    /* Arrondi au dixième comme l'estimation elle-même : une soustraction de deux
       valeurs déjà arrondies sort sinon des 7,499999999999999. */
    delta: pts.length > 1 ? Math.round((last.value - pts[0].value) * 10) / 10 : null,
  };
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

   #63 : une charge n'occupe qu'une ligne, au meilleur nombre de reps atteint
   sur elle. 105 kg sur 7 reps puis sur 8 produisaient deux lignes, et la
   première n'énonçait rien que la seconde ne dise déjà — 8 reps à 105 *est*
   7 reps à 105. C'est la même règle du « ou plus », menée jusqu'à sa
   conséquence : une ligne dont la voisine du dessous porte la même charge ne
   porte aucun fait à elle. La table devient strictement décroissante, ce que
   la phrase sous la table promettait déjà.

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
  /* Les reps montent, la charge ne peut que descendre : une ligne est
     redondante exactement quand la suivante porte la même charge. Filtrer
     après coup plutôt que dans la boucle garde la règle du « ou plus » — la
     seule qui produise la date — intacte et lisible d'un bloc. */
  return { mode: "byReps", rows: rows.filter((r, i) => i === rows.length - 1 || rows[i + 1].load < r.load) };
}
