/* =========================================================
   Schéma du journal — versionnement et migrations (#1)

   Le journal stocké dans localStorage (clé prog12_simon_v1) porte
   un entier schemaVersion, frère de activeProgramId / programs.
   migrate() amène un objet d'une version ancienne à la version courante
   en enchaînant des étapes indexées par version source. Depuis #6,
   MIGRATIONS[1] porte la première vraie étape (v1 journal plat -> v2
   enveloppe multi-programme) ; MIGRATIONS[2] (#16) porte la deuxième
   (semaine de cycle -> date réelle). Ce module reste le seul à connaître la
   forme du journal (emptyJournal, withVersion, #21).
   ========================================================= */

/* Version courante du schéma. Déclarée ici et nulle part ailleurs :
   save et export la lisent depuis ce module. */
export const SCHEMA_VERSION = 3;

/* Identité du cycle par défaut : celui qui existait avant #6, sans fichier
   chargé. Sert de clé dans `programs` pour le journal migré depuis la v1. */
export const DEFAULT_PROGRAM_ID = "simon-12s-2026-09";

/* Objet à écrire dans le stockage / l'export : l'enveloppe multi-programme
   au complet, schemaVersion frère d'activeProgramId/programs (#6). */
export const withVersion = (journal) => ({ schemaVersion: SCHEMA_VERSION, activeProgramId: journal.activeProgramId, programs: journal.programs });

/* Première utilisation : aucune clé en stockage. Un seul cycle, celui fourni
   avec l'appli (definition: null), sous la même identité qu'un journal v1
   migré (#6) — pas de distinction visible entre "toujours été v2" et
   "migré depuis v1". */
export const emptyJournal = () => ({
  activeProgramId: DEFAULT_PROGRAM_ID,
  programs: { [DEFAULT_PROGRAM_ID]: { definition: null, logs: {}, cardio: {}, checkin: {} } },
});

/* logKey encore utilisé par progression.js/App.jsx jusqu'à ce que #16 les
   bascule sur date+slot (étapes suivantes de cette même issue) ; retiré une
   fois qu'aucun appelant ne le référence plus (voir la fin de la séquence
   #16). Cardio et check-in, eux, restent indexés par semaine de cycle
   (#16 decisions-spec Q2 : hors périmètre, suivi par #29). */
export const logKey = (week, sessionId) => `w${week}_${sessionId}`;
export const weekKey = (week) => `w${week}`;

/* Identité et horodatage d'un enregistrement de séance (#16). genId() n'a pas
   besoin d'être cryptographique : juste unique côté client pour que deux
   appareils sans backend ne collisionnent jamais (fallback si crypto.randomUUID
   est absent d'un vieux navigateur). */
export const genId = () =>
  (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
export const nowIso = () => new Date().toISOString();

/* date d'un créneau : pas "quand on a cliqué Valider", mais la date réelle du
   calendrier que ce créneau (semaine, jour de la séance) désigne dans le
   cycle en cours — startDate + 7×(semaine-1) + (jour-1). Pure fonction de
   (startDate, week, day) : calculable avant même la validation (une séance en
   cours d'édition doit pouvoir être retrouvée), et deux passages du même
   programme (deux startDate différents) ne produisent jamais la même date
   pour "semaine 1" — c'est ce qui évite l'écrasement (#16). Recalcule
   elle-même le parsing de date locale plutôt que d'importer parseLocalDate
   de definition.js, pour ne pas créer de cycle d'import (schema.js reste une
   feuille : definition.js -> default-program.js -> schema.js). */
export const dateForSlot = (startDateIso, week, day) => {
  const [y, m, d] = startDateIso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + 7 * (week - 1) + (day - 1));
  const p = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
};

/* Recherche/écriture d'un log de séance par (date, slot) au lieu d'une clé
   w{week}_{id} (#16). writeLog crée un id au premier écrit pour un
   (date, slot) donné, puis réutilise ce même id pour les écritures
   suivantes (onSet répétés avant validation, reopen, etc.) — comportement
   équivalent à l'ancienne clé stable w{week}_{sessionId} pour la même
   session tant que la semaine parcourue ne change pas. */
export const findLog = (logs, date, slot) =>
  Object.values(logs).find((r) => r.date === date && r.slot === slot) || null;

export const writeLog = (logs, date, slot, patch) => {
  const existing = findLog(logs, date, slot);
  const id = existing ? existing.id : genId();
  const base = existing || { id, date, slot, kind: null, ex: {}, notes: "", done: false, deletedAt: null };
  return { ...logs, [id]: { ...base, ...patch, id, date, slot, updatedAt: nowIso(), schemaVersion: SCHEMA_VERSION } };
};

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

  /* v2 (logs indexés w{week}_{sessionId}) -> v3 (logs indexés par id, datés,
     #16). ctx = { defaultDefinition, buildProgram }, fourni par l'appelant
     (App.jsx en prod, test/helpers/migration-ctx.js en test) : schema.js ne
     peut pas importer program.js/default-program.js sans créer un cycle,
     donc la forme de SESSIONS (pour retrouver le jour de chaque slot) est
     injectée plutôt qu'importée. Un programme importé (definition non nulle)
     utilise son propre startDate ; definition: null utilise
     ctx.defaultDefinition. Une clé qui ne matche pas w{n}_{slot}, ou un slot
     absent de SESSIONS, fait échouer toute la migration (throw, rattrapé par
     migrate() ci-dessous) plutôt que de deviner une date ou de perdre
     silencieusement une séance. */
  2: (v2, ctx) => ({
    ...v2,
    programs: Object.fromEntries(Object.entries(v2.programs).map(([id, p]) => {
      const definition = p.definition || ctx.defaultDefinition;
      const dayBySlot = Object.fromEntries(ctx.buildProgram(definition).SESSIONS.map((s) => [s.id, s.day]));
      return [id, { ...p, logs: migrateLogsV2ToV3(p.logs, definition.startDate, dayBySlot) }];
    })),
  }),
};

function migrateLogsV2ToV3(logs, startDate, dayBySlot) {
  const out = {};
  for (const [key, entry] of Object.entries(logs || {})) {
    const m = /^w(\d+)_(.+)$/.exec(key);
    const day = m && dayBySlot[m[2]];
    if (!m || day == null) throw new Error(`clé de log non reconnue : ${key}`);
    const week = Number(m[1]);
    const kind = entry.done ? (week === 1 ? "calibration" : week === 7 ? "deload" : "normal") : null;
    const id = genId();
    out[id] = {
      id, date: dateForSlot(startDate, week, day), slot: m[2], kind,
      ex: entry.ex || {}, notes: entry.notes || "", done: !!entry.done,
      updatedAt: nowIso(), deletedAt: null, schemaVersion: SCHEMA_VERSION,
    };
  }
  return out;
}

/* Version d'un objet journal. Absente ou non entière => v1
   (couvre les journaux écrits par la v1.0.0, sans schemaVersion). */
export function versionOf(data) {
  const v = data && data.schemaVersion;
  return Number.isInteger(v) ? v : 1;
}

/* Cœur testable : applique les étapes de la version source jusqu'à
   target, une par une. Pur — aucune I/O, aucun accès au stockage.
   migrations est injectable pour que les tests prouvent l'enchaînement
   sans livrer de vraie étape. ctx est transmis tel quel à chaque étape ;
   les étapes qui n'en ont pas besoin (MIGRATIONS[1]) l'ignorent. */
export function applyChain(data, target, migrations = MIGRATIONS, ctx) {
  let out = data;
  let v = versionOf(data);
  while (v < target) {
    const step = migrations[v];
    if (typeof step !== "function") throw new Error(`Migration manquante depuis la v${v}`);
    out = step(out, ctx);
    v += 1;
  }
  return out;
}

/* Point d'entrée du load et de l'import. Ne lève jamais sur un fichier
   trop récent ou sur un schemaVersion hors bornes (0, négatif) : renvoie
   { ok: false, tooNew: true } ou { ok: false, invalid: true } pour que
   l'appelant refuse proprement sans rien détruire (#10). Depuis #16, une
   étape qui lève sur une donnée qu'elle ne sait pas interpréter (clé de log
   non reconnue, #16 MIGRATIONS[2]) est aussi rattrapée ici et rendue comme
   { ok: false, invalid: true } — aucun appelant n'a besoin de son propre
   try/catch pour rester fermé par défaut.
   Sinon renvoie { ok: true, from, migrated, data }, data portant
   schemaVersion à la version courante. Idempotent : sur un objet déjà à
   jour, data est équivalent à l'entrée.
   ctx = { defaultDefinition, buildProgram }, requis dès qu'une migration
   traverse la v2 (voir MIGRATIONS[2]) ; ignoré sinon. */
export function migrate(data, ctx) {
  const from = versionOf(data);
  if (from > SCHEMA_VERSION) return { ok: false, tooNew: true, from, data };
  if (from < 1) return { ok: false, invalid: true, from, data };
  let upgraded;
  try {
    upgraded = applyChain(data, SCHEMA_VERSION, MIGRATIONS, ctx);
  } catch (e) {
    return { ok: false, invalid: true, from, data };
  }
  return {
    ok: true,
    tooNew: false,
    from,
    migrated: from < SCHEMA_VERSION,
    data: { ...upgraded, schemaVersion: SCHEMA_VERSION },
  };
}
