/* =========================================================
   Forme du journal et des définitions — l'autorité unique (#32)

   Ce module ne parle que de *forme*. Il ne juge jamais le contenu d'un
   entraînement (une charge absurde, un volume délirant) : il dit si une
   donnée peut être exécutée sans que l'appli plante ou invente.

   Il existe parce que le journal a trois portes d'entrée — un fichier de
   programme, un journal collé, le journal stocké — et qu'avant #32 une
   seule était gardée. Les trois appellent désormais les mêmes fonctions,
   si bien que la barre ne peut plus diverger d'une porte à l'autre : ce
   n'est plus une promesse tenue par la relecture, c'est la structure.

     validateProgram(program)       le catalogue data-only (#25), déplacé
                                    ici depuis import.js sans changement
     validateDefinition(definition) tout ce que parseProgramImport jugeait
                                    en ligne, moins la normalisation

   Chaque fonction rend `null` si la donnée est acceptable, sinon
   { reason, message } — même vocabulaire que src/import.js, et un message
   pensé pour être recollé à une IA (#19) : chemin JSON + règle violée,
   jamais un jugement sur le contenu.

   Ne lève jamais, pour aucune entrée : c'est l'invariant qui permet à
   loadJournal() de rester fermé par défaut sans try/catch (#32).
   ========================================================= */

import { EXERCISE_IDS } from "./registry.js";
import { DEFINITION_FORMAT_VERSION, parseLocalDate } from "./definition.js";

const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const isObj = (x) => typeof x === "object" && x !== null && !Array.isArray(x);

/* Forme d'une entrée de `programs` : un cycle et ses trois registres.
   Séparée de validateEnvelope parce qu'elle sert deux fois et à deux
   sévérités — fatale pour le cycle actif (l'appli ne peut rien rendre
   sans lui), simple cause de non-sélection pour les autres (#32, Q3). */
export function validateProgramEntry(entry) {
  if (!isObj(entry)) return { reason: "invalid", message: "Entrée de programme invalide (objet attendu)" };
  if (!isObj(entry.definition)) return { reason: "invalid", message: "Entrée de programme sans définition" };
  for (const field of ["logs", "cardio", "checkin"]) {
    if (!isObj(entry[field])) return { reason: "invalid", message: `Entrée de programme : ${field} (objet attendu)` };
  }
  return null;
}

/* Enveloppe du journal. Ne juge que ce qui empêche l'appli de rendre quoi
   que ce soit : le reste (un cycle inactif mal formé, une ligne de log
   illisible) se traite sans rejeter tout le journal.

   C'est ici que se ferme le mode d'échec le plus coûteux de #32 : avant,
   la déstructuration de `programs` dans loadJournal levait sur un journal
   tronqué, la promesse du chargement était rejetée, `setLoaded(true)`
   n'arrivait jamais et l'appli restait bloquée sur son spinner — sans
   accès au panneau qui aurait permis de réparer. Un écran blanc se
   recharge ; un spinner définitif, non. */
export function validateEnvelope(journal) {
  if (!isObj(journal)) return { reason: "invalid", message: "Ce JSON n'est pas un journal." };
  const { activeProgramId, programs } = journal;
  if (typeof activeProgramId !== "string" || activeProgramId === "") {
    return { reason: "invalid", message: "Champ invalide : activeProgramId (chaîne non vide attendue)" };
  }
  if (!isObj(programs)) return { reason: "invalid", message: "Champ invalide : programs (objet attendu)" };

  /* Une entrée non-objet (null, un nombre) casse jusqu'au sélecteur de
     cycles, qui lit p.definition pour tous les programmes stockés. */
  for (const [id, entry] of Object.entries(programs)) {
    if (!isObj(entry)) return { reason: "invalid", message: `Champ invalide : programs.${id} (objet attendu)` };
  }

  if (!programs[activeProgramId]) {
    return { reason: "invalid", message: `activeProgramId « ${activeProgramId} » n'a pas d'entrée dans programs.` };
  }
  return validateProgramEntry(programs[activeProgramId]);
}

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
   WARM référençant uniquement des ids du registre fermé (EXERCISE_IDS). */
export function validateProgram(program) {
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

/* Jugement complet d'une définition, quelle que soit sa provenance — un
   fichier chargé, un journal collé, ou le journal déjà stocké. C'est le
   corps de parseProgramImport d'avant #32, moins JSON.parse et moins la
   normalisation (`name ?? id`, `profile ?? défaut`), qui restent dans
   import.js : ce module juge, il ne complète pas.

   L'ordre des contrôles est celui d'origine, et il compte : une entrée qui
   viole plusieurs règles doit continuer à rendre la même reason qu'avant
   (les tests de #20 et #25 portent là-dessus).

   weeks !== 12 garde sa raison propre (spec #6 Q2) ; relâcher 12 est
   #9/#14. */
export function validateDefinition(definition) {
  if (typeof definition !== "object" || definition === null || Array.isArray(definition)) {
    return { reason: "not-a-program", message: undefined };
  }

  if (definition.program != null) {
    const bad = validateProgram(definition.program);
    if (bad) return bad;
  }

  /* formatVersion : absent ou ≤ courant accepté ; au-delà, même verdict
     qu'un journal trop récent — l'action utilisateur est la même. */
  if (definition.formatVersion != null) {
    if (!Number.isInteger(definition.formatVersion)) {
      return { reason: "invalid-field", message: "Champ invalide : formatVersion (entier attendu)" };
    }
    if (definition.formatVersion > DEFINITION_FORMAT_VERSION) return { reason: "too-new", message: undefined };
  }

  for (const field of ["id", "startDate", "startingLoads"]) {
    if (definition[field] == null) return { reason: "missing-field", message: `Champ manquant : ${field}` };
  }
  if (typeof definition.id !== "string" || definition.id === "") {
    return { reason: "invalid-field", message: "Champ invalide : id (chaîne non vide attendue)" };
  }

  if (definition.profile != null) {
    const p = definition.profile;
    if (typeof p !== "object" || Array.isArray(p)) return { reason: "invalid-field", message: "Champ invalide : profile (objet attendu)" };
    for (const field of ["maintenanceKcal", "startKcal"]) {
      if (p[field] == null) return { reason: "missing-field", message: `Champ manquant : profile.${field}` };
      if (!isNum(p[field])) return { reason: "invalid-field", message: `Champ invalide : profile.${field} (nombre attendu)` };
    }
    if (p.macros == null) return { reason: "missing-field", message: "Champ manquant : profile.macros" };
    for (const k of ["p", "f", "c"]) {
      if (p.macros[k] == null) return { reason: "missing-field", message: `Champ manquant : profile.macros.${k}` };
      if (!isNum(p.macros[k])) return { reason: "invalid-field", message: `Champ invalide : profile.macros.${k} (nombre attendu)` };
    }
    if (p.targetWeightKg == null) return { reason: "missing-field", message: "Champ manquant : profile.targetWeightKg" };
    if (!Array.isArray(p.targetWeightKg) || p.targetWeightKg.length < 2 || !p.targetWeightKg.slice(0, 2).every(isNum)) {
      return { reason: "invalid-field", message: "Champ invalide : profile.targetWeightKg (deux nombres attendus)" };
    }
  }

  if (definition.weeks !== 12) {
    return { reason: "unsupported-weeks", message: `Ce programme compte ${definition.weeks} semaines, 12 attendues.` };
  }

  if (typeof definition.startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(definition.startDate) || !roundTripsAsDate(definition.startDate)) {
    return { reason: "invalid-field", message: "Champ invalide : startDate (AAAA-MM-JJ, date réelle attendue)" };
  }

  /* startingLoads non-objet (`5`) passe encore : Object.entries(5) vaut []
     et la boucle ne s'exécute pas. C'est une lacune connue, listée dans
     #33 — elle n'est pas comblée ici pour que ce module reste, au
     comportement près, ce que import.js jugeait déjà. */
  for (const [vid, load] of Object.entries(definition.startingLoads)) {
    if (!isNum(load)) return { reason: "invalid-field", message: `Charge de départ invalide pour ${vid} (nombre attendu)` };
    if (!EXERCISE_IDS.has(vid)) return { reason: "unknown-exercise", message: `startingLoads : « ${vid} » n'est pas un exercice du registre.` };
  }

  return null;
}
