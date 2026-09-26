/* =========================================================
   Plan de repli — priorité de séance et d'exercice (#120)

   Méthode pure, comme cardio.js et progression.js : aucun import d'écran,
   aucune lecture du journal. Consomme `resolveWeek(program, "b1")`
   (assertions.js), déjà utilisé pour la table de volume — même donnée, pas
   un second parseur de SLOTS/SESSIONS.

   Deux règles indépendantes (decisions-spec.md #120) :

     priorité de séance    une séance dont les groupes musculaires sont déjà
                           couverts ailleurs dans la semaine saute en
                           premier ; une séance seule sur un groupe (ex.
                           jambes) ne saute jamais — Q2 : égalité tranchée
                           par l'ordre de déclaration, jamais par hasard.

     priorité d'exercice   au sein d'une séance composite, les isolations
                           sautent avant les composés (`type`,
                           `cout_systemique`) — Q4 : la séance sacrifiée
                           n'est pas juste supprimée, ses exercices
                           prioritaires rejoignent la séance la plus
                           protégée (celle qui ne saute jamais), à l'image
                           de « tirage + jambes » dans l'exemple de Simon.

   `buildFallbackLevels()` est baké une fois à la génération (Q1, comme
   `volumeTable()`). La non-répétition (`protectId`) est ce qui ne peut pas
   l'être : elle dépend de la semaine passée, lue dans le journal au moment
   de l'affichage — c'est pourquoi elle est un paramètre, jamais une valeur
   figée dans les données stockées.
   ========================================================= */

import { VOLUME, contribution } from "./assertions.js";

const MUSCLE_KEYS = Object.keys(VOLUME);

export function sessionCoverage(session) {
  const muscles = new Set();
  for (const row of session.rows) {
    for (const m of MUSCLE_KEYS) if (contribution(row.entry, m) > 0) muscles.add(m);
  }
  return muscles;
}

/* Priorité de séance : la moins unique d'abord. `protectId`, quand fourni,
   passe toujours en dernier — c'est la séance qu'on ne veut pas sacrifier à
   nouveau cette semaine (#120 spec, critère "pas deux semaines de suite"),
   indépendamment de son score de couverture. */
export function rankSessionsForCut(sessions, protectId = null) {
  const coverage = sessions.map(sessionCoverage);
  const countFor = (m) => coverage.filter((cov) => cov.has(m)).length;
  const uniqueness = (cov) => Math.max(0, ...[...cov].map((m) => 1 / countFor(m)));

  return sessions
    .map((s, i) => ({ s, i, score: uniqueness(coverage[i]) }))
    .sort((a, b) => {
      if (protectId != null && a.s.id === protectId && b.s.id !== protectId) return 1;
      if (protectId != null && b.s.id === protectId && a.s.id !== protectId) return -1;
      return a.score - b.score || a.i - b.i;
    })
    .map((x) => x.s);
}

/* Priorité d'exercice : isolation avant composé, puis cout_systemique
   croissant — celui qu'on coupe en premier arrive en tête du tableau rendu. */
export function rankExercisesForCut(rows) {
  const cost = (r) => (r.entry.type === "isolation" ? 0 : 10) + (r.entry.cout_systemique || 0);
  return [...rows].sort((a, b) => cost(a) - cost(b));
}

/* Recompose une séance depuis les rows de plusieurs séances fusionnées
   (Q4), bornée à `capSets` séries totales — les plus prioritaires à garder
   d'abord (l'inverse de rankExercisesForCut). */
export function composeSession(id, name, rowsFromMerged, capSets) {
  const keepFirst = [...rankExercisesForCut(rowsFromMerged)].reverse();
  const ex = [];
  let total = 0;
  for (const row of keepFirst) {
    if (total >= capSets) break;
    const sets = Math.min(row.sets, capSets - total);
    if (sets <= 0) continue;
    ex.push([row.slotId, sets]);
    total += sets;
  }
  return { id, name, ex };
}

/* Un niveau par séance qu'on peut se permettre de perdre — de N-1 séances
   jusqu'à 1, sans plancher (Q3 : aucun exemple de Simon n'en demande un).
   La séance la plus protégée (dernière de `order`) absorbe, à chaque
   niveau, les exercices prioritaires de toutes les séances déjà coupées —
   c'est elle qui devient la séance composite dans l'exemple de Simon
   ("tirage + jambes"), un anchor stable d'un niveau à l'autre. */
export function buildFallbackLevels(week, capSetsPerSession, protectId = null) {
  const sessions = week.sessions;
  if (sessions.length < 2) return { levels: [] };

  const order = rankSessionsForCut(sessions, protectId);
  const anchor = order[order.length - 1];
  const levels = [];
  let cut = [];

  for (let k = 0; k < order.length - 1; k++) {
    cut = [...cut, order[k]];
    const cutIds = new Set(cut.map((s) => s.id));
    const keep = sessions.filter((s) => s.id !== anchor.id && !cutIds.has(s.id)).map((s) => s.id);
    const mergedRows = [...anchor.rows, ...cut.flatMap((s) => s.rows)];
    const composite = composeSession(`${anchor.id}_fallback${k}`, `${anchor.name} +`, mergedRows, capSetsPerSession);
    levels.push({ keep, merge: { from: [anchor.id, ...cut.map((s) => s.id)], into: composite } });
  }

  return { levels };
}
