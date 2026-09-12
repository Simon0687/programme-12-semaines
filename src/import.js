/* =========================================================
   Analyse des imports collé et fichier (#7, #6)

   Le panneau « Données » de l'onglet Plan accepte un journal collé dans
   une zone de texte (parseJournalImport) et, depuis #6, un fichier de
   programme (parseProgramImport). Chacun rend un verdict typé au lieu de
   lever :
     { ok: true,  data | definition, migrated? }
     { ok: false, reason, message }

   La raison et la phrase sont deux valeurs séparées : l'appelant
   n'inspecte jamais le texte, et les tests portent sur reason — une
   reformulation ne casse donc pas la suite.
   ========================================================= */

import { migrate } from "./schema.js";
import { DEFAULT_DEFINITION, DEFINITION_FORMAT_VERSION, parseLocalDate } from "./definition.js";
import { EXERCISE_IDS } from "./registry.js";

export const IMPORT_MESSAGES = {
  "invalid-json": "Le texte collé n'est pas du JSON valide.",
  "not-a-journal": "Ce JSON ne contient pas de journal (clé « logs » ou « programs » absente).",
  "too-new": "Ce fichier a été créé par une version plus récente de l'appli. Mets l'appli à jour, puis réimporte.",
  "migration-failed": "Ce journal n'a pas pu être mis à jour vers le format actuel.",
  "not-a-program": "Ce fichier ne décrit pas un programme.",
  "missing-field": "Champ manquant dans le programme.",
  "invalid-field": "Champ présent mais invalide dans le programme.",
  "unsupported-field": "Ce programme utilise une possibilité que l'appli ne sait pas encore exécuter.",
  "unsupported-weeks": "Ce programme ne compte pas 12 semaines.",
  "invalid-program": "Le catalogue d'exercices custom (program) est mal formé.",
  "unknown-exercise": "Le programme référence un exercice absent du registre.",
  "unknown-cardio-rule": "Le programme référence une règle cardio inconnue.",
};

const reject = (reason, message) => ({ ok: false, reason, message: message || IMPORT_MESSAGES[reason] });

export function parseJournalImport(text, ctx) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return reject("invalid-json");
  }

  /* Ce garde-fou précède la lecture de .logs : JSON.parse("null") rend null,
     dont l'accès lèverait un TypeError que le catch ci-dessus aurait annoncé
     « JSON invalide » sur un document valide. .logs (v1) ou .programs (v2,
     #6) : un journal exporté après #6 n'a plus de .logs à la racine. */
  if (!parsed || typeof parsed !== "object") return reject("not-a-journal");
  if (!parsed.logs && !parsed.programs) return reject("not-a-journal");

  let res;
  try {
    res = migrate(parsed, ctx);
  } catch (e) {
    /* Défensif : migrate() ne lève plus pour un schemaVersion hors bornes
       (#10 en a fait un verdict, cf. res.invalid ci-dessous) ; ce catch ne
       couvre plus qu'un vrai trou dans la chaîne MIGRATIONS. */
    return reject("migration-failed");
  }

  if (res.invalid) return reject("migration-failed");
  if (!res.ok) return reject("too-new");
  return { ok: true, data: res.data, migrated: res.migrated };
}

const isNum = (x) => typeof x === "number" && Number.isFinite(x);

/* startDate doit faire l'aller-retour : parseLocalDate puis reformatage
   redonnent la même chaîne. Attrape "2027-02-30" que le seul regex laisse
   passer (JS bascule au 2 mars). */
function roundTripsAsDate(iso) {
  const d = parseLocalDate(iso);
  if (Number.isNaN(d.getTime())) return false;
  const back = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return back === iso;
}

/* Contrôle de forme d'un program data-only (#25) — SLOTS/SESSIONS/CORE/
   WARM référençant uniquement des ids du registre fermé (EXERCISE_IDS).
   Renvoie null si valide, sinon { reason, message } — message pensé pour
   être recollé à une IA (#19) : chemin JSON + règle violée, jamais un
   jugement sur le contenu. */
function validateProgram(program) {
  if (typeof program !== "object" || program === null || Array.isArray(program)) {
    return { reason: "invalid-program", message: "Champ invalide : program (objet attendu)" };
  }
  for (const field of ["SLOTS", "SESSIONS", "CORE", "WARM"]) {
    if (program[field] == null) return { reason: "missing-field", message: `Champ manquant : program.${field}` };
  }

  const { SLOTS, SESSIONS, CORE, WARM } = program;

  if (typeof SLOTS !== "object" || Array.isArray(SLOTS)) return { reason: "invalid-program", message: "Champ invalide : program.SLOTS (objet attendu)" };
  for (const [slotId, slot] of Object.entries(SLOTS)) {
    if (typeof slot !== "object" || slot === null) return { reason: "invalid-program", message: `Champ invalide : program.SLOTS.${slotId} (objet attendu)` };
    if (!Array.isArray(slot.reps) || slot.reps.length !== 2 || !slot.reps.every(isNum)) {
      return { reason: "invalid-program", message: `Champ invalide : program.SLOTS.${slotId}.reps (deux nombres attendus)` };
    }
    if (!isNum(slot.rest)) return { reason: "invalid-program", message: `Champ invalide : program.SLOTS.${slotId}.rest (nombre attendu)` };
    for (const b of ["b1", "b2"]) {
      if (typeof slot[b] !== "string") return { reason: "invalid-program", message: `Champ invalide : program.SLOTS.${slotId}.${b} (chaîne attendue)` };
      if (!EXERCISE_IDS.has(slot[b])) return { reason: "unknown-exercise", message: `program.SLOTS.${slotId}.${b} : « ${slot[b]} » n'est pas un exercice du registre.` };
    }
  }

  if (!Array.isArray(SESSIONS) || SESSIONS.length === 0) return { reason: "invalid-program", message: "Champ invalide : program.SESSIONS (tableau non vide attendu)" };
  if (typeof CORE !== "object" || Array.isArray(CORE)) return { reason: "invalid-program", message: "Champ invalide : program.CORE (objet attendu)" };
  if (typeof WARM !== "object" || Array.isArray(WARM)) return { reason: "invalid-program", message: "Champ invalide : program.WARM (objet attendu)" };
  for (const [k, v] of Object.entries(WARM)) {
    if (typeof v !== "string") return { reason: "invalid-program", message: `Champ invalide : program.WARM.${k} (chaîne attendue)` };
  }

  for (const [i, session] of SESSIONS.entries()) {
    if (typeof session !== "object" || session === null) return { reason: "invalid-program", message: `Champ invalide : program.SESSIONS[${i}] (objet attendu)` };
    if (typeof session.id !== "string" || session.id === "") return { reason: "invalid-program", message: `Champ invalide : program.SESSIONS[${i}].id (chaîne non vide attendue)` };
    if (!(session.warm in WARM)) return { reason: "invalid-program", message: `program.SESSIONS[${i}].warm : « ${session.warm} » n'est pas une clé de program.WARM.` };
    if (!(session.core in CORE)) return { reason: "invalid-program", message: `program.SESSIONS[${i}].core : « ${session.core} » n'est pas une clé de program.CORE.` };
    if (!Array.isArray(session.ex)) return { reason: "invalid-program", message: `Champ invalide : program.SESSIONS[${i}].ex (tableau attendu)` };
    for (const [slotId] of session.ex) {
      if (!(slotId in SLOTS)) return { reason: "invalid-program", message: `program.SESSIONS[${i}].ex : « ${slotId} » n'est pas un slot de program.SLOTS.` };
    }
  }

  for (const [coreId, core] of Object.entries(CORE)) {
    if (typeof core.label !== "string") return { reason: "invalid-program", message: `Champ invalide : program.CORE.${coreId}.label (chaîne attendue)` };
    if (!Array.isArray(core.ex)) return { reason: "invalid-program", message: `Champ invalide : program.CORE.${coreId}.ex (tableau attendu)` };
    for (const [slotId] of core.ex) {
      if (!(slotId in SLOTS)) return { reason: "invalid-program", message: `program.CORE.${coreId}.ex : « ${slotId} » n'est pas un slot de program.SLOTS.` };
    }
  }

  if (program.cardio !== undefined && program.cardio !== "default" && program.cardio !== null) {
    return { reason: "unknown-cardio-rule", message: `program.cardio : « ${program.cardio} » n'est pas une règle cardio connue (attendu "default" ou null).` };
  }

  return null;
}

/* Analyse d'un fichier de programme chargé (#6, durci en #20, program
   accepté depuis #25). Même forme de verdict que parseJournalImport :
     { ok: true, definition } | { ok: false, reason, message }
   Familles de rejet (décisions #20, #25) :
     missing-field      champ requis absent
     invalid-field      champ présent mais du mauvais type / invalide
     invalid-program    program présent mais mal formé (forme, pas ids)
     unknown-exercise   program ou startingLoads référence un id hors du
                        registre fermé (src/registry.js)
     unknown-cardio-rule program.cardio n'est ni "default" ni null
   weeks !== 12 garde sa raison propre (spec #6 Q2) ; relâcher 12 est #9/#14.
   Sur succès, `name` absent est complété par `id` (décision #20 Q3) : seul
   endroit où le validateur normalise plutôt que juger. */
export function parseProgramImport(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return reject("invalid-json");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reject("not-a-program");
  if (parsed.id == null && parsed.startDate == null && parsed.profile == null && parsed.startingLoads == null) {
    return reject("not-a-program");
  }

  if (parsed.program != null) {
    const bad = validateProgram(parsed.program);
    if (bad) return reject(bad.reason, bad.message);
  }

  /* formatVersion : absent ou ≤ courant accepté ; au-delà, même verdict
     qu'un journal trop récent — l'action utilisateur est la même. */
  if (parsed.formatVersion != null) {
    if (!Number.isInteger(parsed.formatVersion)) {
      return reject("invalid-field", "Champ invalide : formatVersion (entier attendu)");
    }
    if (parsed.formatVersion > DEFINITION_FORMAT_VERSION) return reject("too-new");
  }

  for (const field of ["id", "startDate", "startingLoads"]) {
    if (parsed[field] == null) return reject("missing-field", `Champ manquant : ${field}`);
  }
  if (typeof parsed.id !== "string" || parsed.id === "") {
    return reject("invalid-field", "Champ invalide : id (chaîne non vide attendue)");
  }

  const p = parsed.profile ?? DEFAULT_DEFINITION.profile;
  if (parsed.profile != null) {
    if (typeof p !== "object" || Array.isArray(p)) return reject("invalid-field", "Champ invalide : profile (objet attendu)");
    for (const field of ["maintenanceKcal", "startKcal"]) {
      if (p[field] == null) return reject("missing-field", `Champ manquant : profile.${field}`);
      if (!isNum(p[field])) return reject("invalid-field", `Champ invalide : profile.${field} (nombre attendu)`);
    }
    if (p.macros == null) return reject("missing-field", "Champ manquant : profile.macros");
    for (const k of ["p", "f", "c"]) {
      if (p.macros[k] == null) return reject("missing-field", `Champ manquant : profile.macros.${k}`);
      if (!isNum(p.macros[k])) return reject("invalid-field", `Champ invalide : profile.macros.${k} (nombre attendu)`);
    }
    if (p.targetWeightKg == null) return reject("missing-field", "Champ manquant : profile.targetWeightKg");
    if (!Array.isArray(p.targetWeightKg) || p.targetWeightKg.length < 2 || !p.targetWeightKg.slice(0, 2).every(isNum)) {
      return reject("invalid-field", "Champ invalide : profile.targetWeightKg (deux nombres attendus)");
    }
  }

  if (parsed.weeks !== 12) {
    return reject("unsupported-weeks", `Ce programme compte ${parsed.weeks} semaines, 12 attendues.`);
  }

  if (typeof parsed.startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.startDate) || !roundTripsAsDate(parsed.startDate)) {
    return reject("invalid-field", "Champ invalide : startDate (AAAA-MM-JJ, date réelle attendue)");
  }

  for (const [vid, load] of Object.entries(parsed.startingLoads)) {
    if (!isNum(load)) return reject("invalid-field", `Charge de départ invalide pour ${vid} (nombre attendu)`);
    if (!EXERCISE_IDS.has(vid)) return reject("unknown-exercise", `startingLoads : « ${vid} » n'est pas un exercice du registre.`);
  }

  return { ok: true, definition: { ...parsed, profile: parsed.profile ?? DEFAULT_DEFINITION.profile, name: parsed.name ?? parsed.id } };
}
