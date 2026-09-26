/* =========================================================
   Plan de repli — priorité de séance (#120)

   Méthode pure, comme cardio.js et progression.js : aucun import d'écran,
   aucune lecture du journal. Consomme `resolveWeek(program, "b1")`
   (assertions.js), déjà utilisé pour la table de volume — même donnée, pas
   un second parseur de SLOTS/SESSIONS.

   Une seule règle (decisions-spec.md #120, révisée le 2026-09-26 après
   retour de test) : une séance dont les groupes musculaires sont déjà
   couverts ailleurs dans la semaine saute en premier ; une séance seule
   sur un groupe (ex. jambes) ne saute jamais — Q2 : égalité tranchée par
   l'ordre de déclaration, jamais par hasard.

   Retour de test sur la première version (recomposition d'une séance
   composite, Q4 d'origine) : l'exemple réel produisait une séance à 21
   séries, infaisable en pratique. Chaque niveau garde maintenant des
   séances **existantes, intactes** — jamais fusionnées — ce qui reste
   toujours réalisable puisque ce sont des séances que le programme sait
   déjà exécuter telles quelles.

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

/* Un niveau par séance qu'on peut se permettre de perdre — de N-1 séances
   jusqu'à 1, sans plancher (Q3 : aucun exemple de Simon n'en demande un).
   Chaque niveau ne garde que des séances existantes, intactes : aucune
   fusion, aucun exercice recomposé — toujours faisable, puisque ce sont
   des séances que le programme sait déjà exécuter. */
export function buildFallbackLevels(week, protectId = null) {
  const sessions = week.sessions;
  if (sessions.length < 2) return { levels: [] };

  const order = rankSessionsForCut(sessions, protectId);
  const levels = [];

  for (let cutCount = 1; cutCount < order.length; cutCount++) {
    const cutIds = new Set(order.slice(0, cutCount).map((s) => s.id));
    const keep = sessions.filter((s) => !cutIds.has(s.id)).map((s) => s.id);
    levels.push({ keep });
  }

  return { levels };
}

/* ---------- Le conseil vivant (#120, retour de test du 2026-09-26) ----------

   Retour de test : le texte statique ci-dessus ("voici tes options") ne
   dit rien de la semaine réelle — Simon l'a jugé peu utile sans
   reconnexion à l'état réel. Ces deux fonctions lisent ce que le journal
   sait déjà (quelles séances sont validées) plutôt que d'inventer un
   nouveau champ stocké ; l'écran (App.jsx) les appelle avec l'état de la
   semaine en cours.
   ========================================================= */

/* Parmi les séances pas encore faites, lesquelles garder si le nombre de
   jours qu'il reste dans la semaine (`remainingSlots`) ne suffit pas à
   toutes les faire. Sous ce plancher, tout reste faisable tel quel — la
   fonction ne dit rien, `keep` est juste "tout ce qui n'est pas fait". */
export function recommendRemaining(sessions, doneIds, remainingSlots, protectId = null) {
  const done = new Set(doneIds);
  const remaining = sessions.filter((s) => !done.has(s.id));
  if (remaining.length <= Math.max(0, remainingSlots)) {
    return { keep: remaining.map((s) => s.id), cut: [] };
  }
  const order = rankSessionsForCut(remaining, protectId);
  const cutCount = remaining.length - Math.max(0, remainingSlots);
  const cut = order.slice(0, cutCount).map((s) => s.id);
  const cutSet = new Set(cut);
  return { keep: remaining.filter((s) => !cutSet.has(s.id)).map((s) => s.id), cut };
}

/* La séance à protéger cette semaine : celle, et une seule, qui n'a pas été
   validée la semaine passée. Ambigu (aucune séance ratée, ou plusieurs) =>
   rien à protéger en particulier, la règle de couverture suffit seule. */
export function lastSkipped(sessions, doneIdsLastWeek) {
  const done = new Set(doneIdsLastWeek);
  const skipped = sessions.filter((s) => !done.has(s.id));
  return skipped.length === 1 ? skipped[0].id : null;
}
