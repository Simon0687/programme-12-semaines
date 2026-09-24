/* =========================================================
   Les cycles enregistrés, tels qu'un écran les liste (#68)

   `journal.programs` est un objet indexé par id : trois cycles s'y écrivent
   dans l'ordre où ils sont arrivés, et l'écran les affichait dans cet ordre-là,
   sous la même pastille, sans rien dire de ce qu'ils portent. Ce module répond
   à la seule question qu'on se pose devant cette liste — **lequel est lequel,
   et qu'est-ce que j'y perdrais** — et la rend testable.

   Il ne lit pas le programme (`buildProgram`), seulement le journal : le
   caractère exécutable d'un cycle est le verdict de `unusableProgramIds`
   (journal-shape.js), qui arrive ici en paramètre plutôt que d'être recalculé.
   Un seul module décide qu'une définition est refusée (ARCHITECTURE §2.9).

   Non-objectif : aucune mise en forme. Les dates sortent en ISO et les
   comptes en nombres ; c'est l'écran qui écrit « dernière séance le 12 sept. ».
   ========================================================= */

/* Les tombstones (#16) ne comptent pour rien : une séance supprimée n'a pas
   eu lieu, et un cycle qui n'en porte plus que des supprimées est vide. */
const liveLogs = (logs) => Object.values(logs || {}).filter((l) => l && typeof l === "object" && !l.deletedAt);

const hasEntries = (p) =>
  liveLogs(p && p.logs).length > 0 ||
  Object.keys((p && p.cardio) || {}).length > 0 ||
  Object.keys((p && p.checkin) || {}).length > 0;

/* Une ligne par cycle enregistré.

   `sessions` compte les séances **validées** : c'est ce qu'on a fait. `entries`
   compte tout ce qui est écrit, séries saisies sans validation comprises — et
   c'est lui qui décide si un cycle est supprimable, parce qu'une saisie en
   cours est de la donnée que personne n'a le droit de jeter à sa place.

   L'actif d'abord, puis du plus récemment utilisé au plus ancien, puis par nom.
   Un cycle sans aucune séance n'a pas de date : il passe après ceux qui en ont
   une, jamais entre deux. */
export function programSummaries(journal, unusableIds = []) {
  const programs = (journal && journal.programs) || {};
  const unusable = unusableIds instanceof Set ? unusableIds : new Set(unusableIds || []);
  const rows = Object.entries(programs).map(([id, p]) => {
    const def = (p && p.definition) || null;
    const live = liveLogs(p && p.logs);
    const done = live.filter((l) => l.done === true);
    const dates = done.map((l) => l.date).filter(Boolean).sort();
    const active = id === (journal && journal.activeProgramId);
    return {
      id,
      name: (def && def.name) || id,
      active,
      usable: !unusable.has(id),
      startDate: (def && def.startDate) || null,
      weeks: (def && def.weeks) || null,
      sessions: done.length,
      entries: live.length,
      lastDate: dates.length ? dates[dates.length - 1] : null,
      /* Deux refus, et ils ne disent pas la même chose. L'actif se protège
         d'un geste qui laisserait l'appli sans programme : il suffit d'en
         activer un autre. Un cycle qui porte des séances, lui, est de
         l'histoire — la fiche exercice (#17) la lit à travers tous les cycles,
         et rien dans l'appli ne la reconstruirait. Il n'est pas supprimable,
         quoi qu'on fasse, et l'export reste la sortie. */
      removable: !active && !hasEntries(p),
    };
  });
  return rows.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    if (a.lastDate !== b.lastDate) {
      if (!a.lastDate) return 1;
      if (!b.lastDate) return -1;
      return a.lastDate < b.lastDate ? 1 : -1;
    }
    return a.name.localeCompare(b.name, "fr");
  });
}

/* Supprime un cycle, ou refuse.

   La règle est vérifiée ici et pas seulement à l'écran : un bouton caché est
   une politesse, un garde-fou est ce qui fait qu'une destruction n'arrive pas
   par un chemin qu'on n'avait pas prévu. Rend `null` quand elle refuse — au
   sens propre « rien n'a été fait » — et un journal neuf sinon, l'original
   n'étant jamais modifié. */
export function removeProgram(journal, id) {
  const rows = programSummaries(journal);
  const row = rows.find((r) => r.id === id);
  if (!row || !row.removable) return null;
  /* Le dernier cycle ne part jamais, même vide et même non actif : un journal
     sans programme est un état que rien dans l'appli ne sait rendre, et
     `activeProgramId` qui désigne un cycle absent est déjà une anomalie — on
     ne la transforme pas en écran blanc. */
  if (Object.keys(journal.programs || {}).length <= 1) return null;
  const programs = { ...journal.programs };
  delete programs[id];
  return { ...journal, programs };
}
