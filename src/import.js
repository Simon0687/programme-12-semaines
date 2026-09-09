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
import { DEFINITION_FORMAT_VERSION, parseLocalDate } from "./definition.js";

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

/* Analyse d'un fichier de programme chargé (#6, durci en #20). Même forme
   de verdict que parseJournalImport :
     { ok: true, definition } | { ok: false, reason, message }
   Trois familles de rejet (décisions #20) :
     missing-field      champ requis absent
     invalid-field      champ présent mais du mauvais type / invalide
     unsupported-field  champ que le format porte mais que le moteur ne
                        sait pas exécuter depuis un fichier (aujourd'hui
                        `program` — réactivé par #13)
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

  /* program : le format le porte, mais buildProgram() attend le catalogue
     livré avec l'appli (cardioPlan y est une fonction, non sérialisable).
     Rejeté tant que #13 n'a pas défini un program 100 % données + son
     contrôle de forme. */
  if (parsed.program != null) {
    return reject("unsupported-field", "Champ non supporté : program (programme d'exercices custom, prévu #13)");
  }

  /* formatVersion : absent ou ≤ courant accepté ; au-delà, même verdict
     qu'un journal trop récent — l'action utilisateur est la même. */
  if (parsed.formatVersion != null) {
    if (!Number.isInteger(parsed.formatVersion)) {
      return reject("invalid-field", "Champ invalide : formatVersion (entier attendu)");
    }
    if (parsed.formatVersion > DEFINITION_FORMAT_VERSION) return reject("too-new");
  }

  for (const field of ["id", "startDate", "profile", "startingLoads"]) {
    if (parsed[field] == null) return reject("missing-field", `Champ manquant : ${field}`);
  }
  if (typeof parsed.id !== "string" || parsed.id === "") {
    return reject("invalid-field", "Champ invalide : id (chaîne non vide attendue)");
  }

  const p = parsed.profile;
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

  if (parsed.weeks !== 12) {
    return reject("unsupported-weeks", `Ce programme compte ${parsed.weeks} semaines, 12 attendues.`);
  }

  if (typeof parsed.startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.startDate) || !roundTripsAsDate(parsed.startDate)) {
    return reject("invalid-field", "Champ invalide : startDate (AAAA-MM-JJ, date réelle attendue)");
  }

  for (const [vid, load] of Object.entries(parsed.startingLoads)) {
    if (!isNum(load)) return reject("invalid-field", `Charge de départ invalide pour ${vid} (nombre attendu)`);
  }

  return { ok: true, definition: { ...parsed, name: parsed.name ?? parsed.id } };
}
