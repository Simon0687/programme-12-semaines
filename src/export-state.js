/* =========================================================
   Date du dernier export, et règle de péremption (#15)

   La date vit dans une clé sœur du journal — prog12_simon_v1_last_export —
   et non dans le journal lui-même. Ce n'est pas un choix de rangement :
   withVersion() (schema.js) ne recopie que { schemaVersion, activeProgramId,
   programs }, donc un champ ajouté à la racine du journal serait jeté par
   saveJournal à la première écriture. L'y mettre demanderait de modifier le
   contrat de compatibilité pour une donnée de confort (decisions-spec.md Q1).

   Même famille que backupKey()/droppedBackupKey() (backup.js), à une
   différence près : cette valeur **s'écrase**. Une sauvegarde est une
   assurance qu'on n'écrase jamais ; une date de dernier export est un
   curseur qui avance. writeOnce() serait donc exactement le mauvais outil.

   store est injecté (ARCHITECTURE §2.7). Le module n'importe rien et reste
   une feuille : comme dateForSlot() dans schema.js, il refait son parsing de
   date plutôt que d'importer parseLocalDate de definition.js, pour ne pas
   créer d'arête dans le graphe de dépendances.

   Non-objectifs : ce module n'écrit pas de fichier (file-io.js) et ne décide
   pas où l'avertissement s'affiche (App.jsx). Il répond à deux questions :
   « quand était le dernier export ? » et « est-ce trop vieux ? ».
   ========================================================= */

export const STALE_AFTER_DAYS = 14;

export const lastExportKey = (key) => `${key}_last_export`;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/* Date locale au format AAAA-MM-JJ, même convention que dateForSlot()
   (schema.js) : jamais toISOString(), qui décale d'un jour le soir. */
export const toIsoDate = (date) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
};

/* Le shim de storage.js lève sur une clé absente : même forme de try/catch
   que readDroppedBackup(). Une valeur illisible est traitée comme absente —
   un curseur corrompu ne doit pas rendre l'avertissement imprévisible, il
   doit le déclencher. */
export async function readLastExport(store, key) {
  if (!store) return null;
  try {
    const r = await store.get(lastExportKey(key), false);
    const v = r && r.value;
    return typeof v === "string" && ISO_DATE.test(v) ? v : null;
  } catch (e) {
    return null;
  }
}

export async function writeLastExport(store, key, isoDate) {
  if (!store || !ISO_DATE.test(String(isoDate))) return false;
  try {
    await store.set(lastExportKey(key), isoDate, false);
    return true;
  } catch (e) {
    return false;
  }
}

/* Différence en jours pleins entre deux dates locales, calculée en UTC pour
   que les passages à l'heure d'été ne fassent pas 23 ou 25 heures. */
export function daysBetween(fromIso, toIso) {
  if (!ISO_DATE.test(String(fromIso)) || !ISO_DATE.test(String(toIso))) return null;
  const utc = (iso) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((utc(toIso) - utc(fromIso)) / 86400000);
}

/* Jamais exporté vaut périmé : c'est le cas où l'avertissement est le plus
   utile, pas celui où il doit se taire. C'est App.jsx qui décide de ne rien
   afficher sur un journal vide, via journalHasContent(). */
export function isExportStale(isoDate, todayIso) {
  const age = daysBetween(isoDate, todayIso);
  if (age == null) return true;
  return age >= STALE_AFTER_DAYS;
}

/* « Y a-t-il quelque chose à perdre ? » Les trois dimensions comptent : une
   semaine où seul le bilan est rempli mérite d'être sauvegardée autant
   qu'une semaine de séances. */
export function journalHasContent(journal) {
  if (!journal || !journal.programs || typeof journal.programs !== "object") return false;
  return Object.values(journal.programs).some((p) => {
    if (!p || typeof p !== "object") return false;
    return ["logs", "cardio", "checkin"].some((f) => p[f] && typeof p[f] === "object" && Object.keys(p[f]).length > 0);
  });
}
