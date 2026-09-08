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
import { parseLocalDate } from "./definition.js";

export const IMPORT_MESSAGES = {
  "invalid-json": "Le texte collé n'est pas du JSON valide.",
  "not-a-journal": "Ce JSON ne contient pas de journal (clé « logs » ou « programs » absente).",
  "too-new": "Ce fichier a été créé par une version plus récente de l'appli. Mets l'appli à jour, puis réimporte.",
  "migration-failed": "Ce journal n'a pas pu être mis à jour vers le format actuel.",
  "not-a-program": "Ce fichier ne décrit pas un programme.",
  "missing-field": "Champ manquant dans le programme.",
  "unsupported-weeks": "Ce programme ne compte pas 12 semaines.",
};

const reject = (reason, message) => ({ ok: false, reason, message: message || IMPORT_MESSAGES[reason] });

export function parseJournalImport(text) {
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
    res = migrate(parsed);
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

/* Analyse d'un fichier de programme chargé (#6). Même forme de verdict que
   parseJournalImport : { ok: true, definition } | { ok: false, reason, message }.
   weeks !== 12 est rejeté ici (spec #6 Q2) plutôt que laissé planter plus
   loin dans le moteur, qui code en dur 12 semaines. */
export function parseProgramImport(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return reject("invalid-json");
  }

  if (!parsed || typeof parsed !== "object") return reject("not-a-program");
  if (parsed.id == null && parsed.startDate == null && parsed.profile == null && parsed.startingLoads == null) {
    return reject("not-a-program");
  }

  for (const field of ["id", "startDate", "profile"]) {
    if (parsed[field] == null) return reject("missing-field", `Champ manquant : ${field}`);
  }
  if (!parsed.profile.macros || !Array.isArray(parsed.profile.targetWeightKg)) {
    return reject("missing-field", "Champ manquant : profile.macros ou profile.targetWeightKg");
  }

  if (parsed.weeks !== 12) {
    return reject("unsupported-weeks", `Ce programme compte ${parsed.weeks} semaines, 12 attendues.`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.startDate) || Number.isNaN(parseLocalDate(parsed.startDate).getTime())) {
    return reject("missing-field", "Champ invalide : startDate (attendu AAAA-MM-JJ)");
  }

  if (parsed.startingLoads) {
    for (const [vid, load] of Object.entries(parsed.startingLoads)) {
      if (typeof load !== "number") return reject("missing-field", `Charge de départ invalide pour ${vid} (attendu un nombre)`);
    }
  }

  return { ok: true, definition: parsed };
}
