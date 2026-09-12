/* =========================================================
   Programme par défaut — Simon (#25)

   Le cycle fourni avec l'appli, ré-exprimé en fichier `program` data-only
   (#25 decisions.md, décision 1) : SLOTS/SESSIONS/CORE/WARM (extraits de
   src/program.js sans changement de forme, #2/#3) et le profil
   (extrait de src/profile.js, #5) vivent tous ici. `buildProgram()`
   (src/program.js) résout `definition.program ?? DEFAULT_DEFINITION.program` —
   un seul chemin de code pour le catalogue de programme, Simon n'est
   plus un cas spécial. `src/definition.js` et `src/profile.js`
   ré-exportent depuis ce module pour une version (suppression en
   follow-up).

   `formatVersion` est codé en dur à 2 ici plutôt qu'importé de
   DEFINITION_FORMAT_VERSION (src/definition.js) pour éviter un cycle
   d'import definition.js <-> default-program.js (#25 design.md OQ2) —
   les deux doivent rester synchronisés à la main.

   ---------------------------------------------------------
   SLOTS[id] — créneau d'une séance ; une variante s'y rattache par bloc
     reps     [min, max] : répétitions, ou secondes si la variante
              rattachée est "time" / "carry".
     rest     repos en secondes.
     key      exercice clé : dernière série AMRAP en S12, repris au Bilan.
     fail     dernière série à l'échec autorisée dès S3 (jamais en S7).
     b1       id de variante pour les semaines 1–6.
     b2       id de variante pour les semaines 7–12.
              (le choix b1/b2 se fait dans blockOf() — progression.js)

   SESSIONS[] — séances, dans l'ordre d'affichage
     id / name / sub   identifiant, titre, groupes musculaires
     day               jour conseillé (1 = lundi … 6 = samedi)
     warm              clé WARM ("upper" | "lower")
     ex                [[slotId, nombre de séries dures], …]
     core              clé CORE
     after             optionnel : "z2" | "mob" — indice affiché sur la
                        Séance ("Après la séance : …", #22). Absent =>
                        aucun indice.

   CORE[id]  — bloc d'abdos : { label, ex: [[slotId, nSéries], …] }
   WARM[k]   — protocole d'échauffement ("upper" | "lower") -> texte

   START_DATE      lundi de la S1, chaîne ISO "AAAA-MM-JJ".
   STARTING_LOADS  charge de travail en S1, en kg, par id de variante.
                   pullup: 0 = poids du corps (valeur réelle, pas
                   « absent » : à distinguer d'une variante sans entrée,
                   qui part en « Paliers »).
   PROFILE         valeurs personnelles citées dans l'onglet Plan.
   ========================================================= */

import { LEGACY_PROGRAM_ID } from "./schema.js";

/* ---------- Créneaux : variante bloc 1 / bloc 2 ---------- */
export const SLOTS = {
  dc: { reps: [4, 8], rest: 150, key: true, b1: "dc", b2: "dc" },
  incline: { reps: [6, 10], rest: 120, b1: "incl_db", b2: "incl_mach" },
  latraise: { reps: [8, 12], rest: 90, fail: true, key: true, b1: "lat_db", b2: "lat_cable" },
  reardelt: { reps: [10, 12], rest: 90, fail: true, b1: "rpd", b2: "rev_cable" },
  tristretch: { reps: [8, 12], rest: 90, b1: "tri_oh", b2: "skull" },
  squat: { reps: [4, 8], rest: 180, key: true, b1: "squat", b2: "squat" },
  legcurl: { reps: [8, 12], rest: 90, fail: true, b1: "lc_seat", b2: "lc_lying" },
  calfstand: { reps: [8, 12], rest: 90, fail: true, b1: "calf_stand", b2: "calf_press" },
  pull: { reps: [4, 8], rest: 150, key: true, b1: "pullup", b2: "pd_wide" },
  row: { reps: [6, 10], rest: 120, b1: "row_supp", b2: "row_cable" },
  curl2: { reps: [6, 10], rest: 90, b1: "curl_cable", b2: "curl_db" },
  ohp: { reps: [6, 10], rest: 150, key: true, b1: "ohp_db", b2: "ohp_mach" },
  curl1: { reps: [6, 10], rest: 90, fail: true, b1: "curl_preacher", b2: "curl_cable_seat" },
  pushdown: { reps: [8, 12], rest: 90, fail: true, b1: "pushdown", b2: "pushdown_uni" },
  fly: { reps: [8, 12], rest: 90, fail: true, b1: "pecdeck", b2: "fly_cable" },
  hipthrust: { reps: [6, 10], rest: 150, key: true, b1: "hipthrust", b2: "hipthrust" },
  quad2: { reps: [8, 12], rest: 120, fail: true, b1: "legpress", b2: "hack" },
  pullsag: { reps: [6, 10], rest: 120, b1: "pd_close", b2: "row_uni" },
  calfseat: { reps: [10, 12], rest: 90, fail: true, b1: "calf_seat", b2: "calf_seat" },
  crunch: { reps: [8, 12], rest: 60, fail: true, b1: "crunch", b2: "crunch" },
  pallof: { reps: [8, 12], rest: 60, b1: "pallof", b2: "pallof" },
  hlr: { reps: [8, 12], rest: 60, b1: "hlr", b2: "hlr" },
  sideplank: { reps: [20, 40], rest: 60, b1: "sideplank", b2: "sideplank" },
  abwheel: { reps: [6, 10], rest: 60, b1: "abwheel", b2: "abwheel" },
  carry: { reps: [30, 45], rest: 60, b1: "carry", b2: "carry" },
};

export const SESSIONS = [
  { id: "hautA", name: "Haut A", sub: "Pecs, épaules, triceps", day: 1, warm: "upper", ex: [["dc", 3], ["incline", 3], ["latraise", 2], ["reardelt", 2], ["tristretch", 2]], core: "coreA" },
  { id: "basA", name: "Bas A", sub: "Squat, ischios, mollets", day: 2, warm: "lower", ex: [["squat", 3], ["legcurl", 3], ["calfstand", 3]], core: "coreB", after: "mob" },
  { id: "hautB", name: "Haut B", sub: "Dos, delt postérieurs, biceps", day: 3, warm: "upper", ex: [["pull", 3], ["row", 2], ["reardelt", 2], ["curl2", 2]], core: "coreC", after: "z2" },
  { id: "hautC", name: "Haut C", sub: "Épaules et bras", day: 5, warm: "upper", ex: [["latraise", 3], ["ohp", 3], ["curl1", 3], ["pushdown", 3], ["fly", 2]], core: "coreA" },
  { id: "basB", name: "Bas B", sub: "Hip thrust, presse, dos sagittal, mollets", day: 6, warm: "lower", ex: [["hipthrust", 3], ["quad2", 2], ["pullsag", 2], ["calfseat", 3]], core: "coreB" },
];
export const CORE = {
  coreA: { label: "Abdos A — flexion chargée + anti-rotation", ex: [["crunch", 2], ["pallof", 2]] },
  coreB: { label: "Abdos B — relevé de jambes + anti-flexion latérale", ex: [["hlr", 2], ["sideplank", 2]] },
  coreC: { label: "Abdos C — anti-extension + portés", ex: [["abwheel", 2], ["carry", 2]] },
};

/* ---------- Échauffement ---------- */
export const WARM = {
  upper: "5–10 min : rotations externes à l'élastique 2 × 15 ; open book ou extension thoracique sur rouleau, 10 par côté ; glissés au mur 10 ; puis montée en charge sur le premier exercice : 50 % × 8, 70 % × 4, 85 % × 2.",
  lower: "5–10 min : cat-camel 10 ; 90/90 hanches 1 min par côté ; dorsiflexion cheville au mur 10 par côté ; pont fessier 15 ; McGill court (curl-up 5, planche latérale 15 s par côté, bird dog 5 par côté) ; montée en charge sur le squat ou le hip thrust : 50 % × 6, 70 % × 4, 85 % × 2.",
};

/* ---------- Profil ---------- */
export const START_DATE = "2026-09-07";

export const STARTING_LOADS = {
  dc: 72.5,
  incl_db: 30,
  squat: 105,
  ohp_db: 26,
  pullup: 0,
  pd_close: 90,
};

export const PROFILE = {
  bodyweightKg: 90,
  heightCm: 193,
  birthdate: "1987-06-18",
  maintenanceKcal: 3150,
  startKcal: 3400,
  macros: { p: 185, f: 85, c: 470 },
  targetWeightKg: [92.5, 93.5],
};

/* ---------- Définition complète ---------- */
export const DEFAULT_DEFINITION = {
  formatVersion: 2, // DEFINITION_FORMAT_VERSION (src/definition.js) — garder synchronisé, voir la note d'en-tête
  id: LEGACY_PROGRAM_ID,
  name: "Simon — 12 semaines",
  weeks: 12,
  startDate: START_DATE,
  profile: PROFILE,
  startingLoads: STARTING_LOADS,
  program: { SLOTS, SESSIONS, CORE, WARM, cardio: "default" },
};
