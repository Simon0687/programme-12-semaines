/* =========================================================
   Données du programme 12 semaines — Simon

   Source unique de la structure du programme. Aucun import React :
   chargeable par `node --test` (via progression.js) comme par App.jsx.
   Extrait de App.jsx sans changement de forme (#2 : V, SLOTS, SESSIONS,
   CORE ; #3 : WARM, cardioPlan, CARDIO_ITEMS, MOB_DAYS ; #4 :
   CARDIO_DAY_NOTES). La prose de l'onglet Plan et les notes de phaseOf()
   sont sorties dans src/plan.js (#4). Les charges de départ (V.<id>.start)
   sont injectées par buildProgram(definition) (#6) à partir de
   definition.startingLoads — plus jamais lues depuis src/profile.js
   directement une fois le bundle construit.

   ---------------------------------------------------------
   V[id] — catalogue d'exercices actif, résolu par buildProgram() depuis
     le registre fermé (src/registry.js, #25) ou depuis definition.program
     s'il en fournit un. Forme d'une entrée : voir l'en-tête de registry.js.

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
   cardioPlan(w) -> { z2, intervals | null, mob } : chaînes affichées.
                    intervals est null en S1, S7 et S12.
   CARDIO_ITEMS[] — lignes de la check-list cardio : { id, label, when }.
                    id "int" = intervalles, masquée quand
                    cardioPlan(w).intervals est null.
   MOB_DAYS[] — libellés des 3 jours de mobilité (cases à cocher).
   CARDIO_DAY_NOTES[jour] — fragment cardio ajouté à la ligne « Aujourd'hui »
                    de la Séance (jour : 0 = dimanche … 6 = samedi ;
                    jours sans cardio absents).

   getKeySlots(prog) / getCardioDayNotes(prog) — dérivations pures depuis
                    un bundle construit (#22), voir leur définition
                    ci-dessous, juste après buildProgram().
   ========================================================= */

import { EXERCISES } from "./registry.js";
import { cardioPlan, CARDIO_ITEMS, MOB_DAYS, CARDIO_DAY_NOTES } from "./cardio.js";

/* ---------- Variantes (exercices) ----------
   Extraites dans src/registry.js (#25). Re-exporté ici sous l'ancien nom
   pour une version, le temps qu'aucun import ne cible plus BASE_V —
   suppression en follow-up. */
export { EXERCISES as BASE_V } from "./registry.js";

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

/* ---------- Cardio et mobilité ----------
   Extraits dans src/cardio.js (#25) : la règle "default" que program
   référence par son nom (cardio: "default"). Re-exportés ici sous les
   anciens noms pour une version — suppression en follow-up. */
export { cardioPlan, CARDIO_ITEMS, MOB_DAYS, CARDIO_DAY_NOTES } from "./cardio.js";

/* ---------- Construction du bundle actif (#6) ----------
   Un cycle fige un catalogue (celui de l'appli, sauf si definition.program
   en fournit un autre) et y injecte ses charges de départ. Le clone est la
   ligne qui compte : V[vid].start = load muterait sinon le catalogue de
   base partagé, et un deuxième cycle en mémoire écraserait les charges du
   premier. Affectation sans condition — pullup vaut 0 (poids du corps),
   un `if (load)` le perdrait. */
export function buildProgram(definition) {
  const catalogue = (definition && definition.program) || {
    V: EXERCISES, SLOTS, SESSIONS, CORE, WARM, cardioPlan, CARDIO_ITEMS, MOB_DAYS, CARDIO_DAY_NOTES,
  };
  const V = structuredClone(catalogue.V);
  const startingLoads = (definition && definition.startingLoads) || {};
  for (const [vid, load] of Object.entries(startingLoads)) {
    if (V[vid]) V[vid].start = load;
  }
  return { ...catalogue, V };
}

/* ---------- Dérivations pures depuis un bundle (#22) ----------
   Les deux seules valeurs de forme qui ne sont pas une simple lecture de
   propriété ; App.jsx les lisait en dur avant #22. */

/* Slots clés, dans leur ordre de déclaration dans SLOTS — App.jsx les
   utilisait en dur pour la ligne "Exos clés" du Bilan et le drapeau AMRAP
   de S12 (slot.key). */
export function getKeySlots(prog) {
  return Object.entries(prog.SLOTS)
    .filter(([, slot]) => slot.key)
    .map(([id]) => id);
}

/* Jours (0 = dimanche … 6 = samedi) qui ont une note cardio mais aucune
   séance — ceux où l'onglet Séance ouvre directement sur "Cardio et
   mobilité". Un jour avec à la fois une séance et une note cardio (ex.
   mercredi : Haut B + rameur après) n'en fait pas partie : la note s'y
   affiche en complément de la séance, pas à sa place. */
export function getCardioDayNotes(prog) {
  const sessionDays = new Set(prog.SESSIONS.map((s) => s.day));
  return Object.keys(prog.CARDIO_DAY_NOTES)
    .map(Number)
    .filter((day) => !sessionDays.has(day));
}
