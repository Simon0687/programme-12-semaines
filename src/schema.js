/* =========================================================
   Schéma du journal — versionnement et migrations (#1)

   Le journal stocké dans localStorage (clé prog12_simon_v1) porte
   désormais un entier schemaVersion, frère de logs / cardio / checkin.
   migrate() amène un objet d'une version ancienne à la version courante
   en enchaînant des étapes indexées par version source. À la v1 la
   chaîne est vide : migrate() est un no-op jusqu'à la première vraie
   migration (#3).
   ========================================================= */

/* Version courante du schéma. Déclarée ici et nulle part ailleurs :
   save et export la lisent depuis ce module. */
export const SCHEMA_VERSION = 2;

/* Identité du cycle par défaut : celui qui existait avant #6, sans fichier
   chargé. Sert de clé dans `programs` pour le journal migré depuis la v1. */
export const DEFAULT_PROGRAM_ID = "simon-12s-2026-09";

/* MIGRATIONS[n] prend un objet vn et renvoie un objet v(n+1), sans jamais
   fixer schemaVersion lui-même : migrate() s'en charge une seule fois, à
   la fin de la chaîne. Chaque étape est indépendante : en ajouter une ne
   touche pas les autres. */
export const MIGRATIONS = {
  /* v1 (journal plat) -> v2 (enveloppe multi-programme, #6). definition:
     null signifie « le programme fourni avec l'appli » : cette étape ne
     connaît jamais les données du programme, seulement la forme du journal. */
  1: (v1) => ({
    activeProgramId: DEFAULT_PROGRAM_ID,
    programs: {
      [DEFAULT_PROGRAM_ID]: {
        definition: null,
        logs: v1.logs || {},
        cardio: v1.cardio || {},
        checkin: v1.checkin || {},
      },
    },
  }),
};

/* Version d'un objet journal. Absente ou non entière => v1
   (couvre les journaux écrits par la v1.0.0, sans schemaVersion). */
export function versionOf(data) {
  const v = data && data.schemaVersion;
  return Number.isInteger(v) ? v : 1;
}

/* Cœur testable : applique les étapes de la version source jusqu'à
   target, une par une. Pur — aucune I/O, aucun accès au stockage.
   migrations est injectable pour que les tests prouvent l'enchaînement
   sans livrer de vraie étape. */
export function applyChain(data, target, migrations = MIGRATIONS) {
  let out = data;
  let v = versionOf(data);
  while (v < target) {
    const step = migrations[v];
    if (typeof step !== "function") throw new Error(`Migration manquante depuis la v${v}`);
    out = step(out);
    v += 1;
  }
  return out;
}

/* Point d'entrée du load et de l'import. Ne lève jamais sur un fichier
   trop récent ou sur un schemaVersion hors bornes (0, négatif) : renvoie
   { ok: false, tooNew: true } ou { ok: false, invalid: true } pour que
   l'appelant refuse proprement sans rien détruire (#10).
   Sinon renvoie { ok: true, from, migrated, data }, data portant
   schemaVersion à la version courante. Idempotent : sur un objet déjà à
   jour, data est équivalent à l'entrée. */
export function migrate(data) {
  const from = versionOf(data);
  if (from > SCHEMA_VERSION) return { ok: false, tooNew: true, from, data };
  if (from < 1) return { ok: false, invalid: true, from, data };
  const upgraded = applyChain(data, SCHEMA_VERSION);
  return {
    ok: true,
    tooNew: false,
    from,
    migrated: from < SCHEMA_VERSION,
    data: { ...upgraded, schemaVersion: SCHEMA_VERSION },
  };
}
