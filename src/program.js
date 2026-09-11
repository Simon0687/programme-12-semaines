/* =========================================================
   Construction du bundle de programme actif — Simon

   Ne porte plus de donnée depuis #25 : buildProgram() assemble le bundle
   qu'App.jsx consomme (`prog`) à partir de trois sources qui, elles,
   portent la donnée —
     src/registry.js         le registre d'exercices fermé (V)
     src/cardio.js           la règle cardio/mobilité bundlée "default"
     src/default-program.js  SLOTS/SESSIONS/CORE/WARM par défaut, et le
                              profil (repris par src/definition.js et
                              src/profile.js)
   — ou de definition.program quand un fichier chargé en fournit un
   (#6, #25). Aucun import React : chargeable par `node --test` (via
   progression.js) comme par App.jsx.

   getKeySlots(prog) / getCardioDayNotes(prog) — dérivations pures depuis
                    un bundle construit (#22), voir leur définition
                    ci-dessous, juste après buildProgram().
   ========================================================= */

import { EXERCISES } from "./registry.js";
import { cardioPlan, CARDIO_ITEMS, MOB_DAYS, CARDIO_DAY_NOTES } from "./cardio.js";
import { DEFAULT_DEFINITION } from "./default-program.js";

/* ---------- Variantes, structure et cardio du programme par défaut ----------
   Extraits dans src/registry.js, src/cardio.js et src/default-program.js
   (#25). Re-exportés ici sous les anciens noms pour une version, le temps
   qu'aucun import ne cible plus program.js pour ces données — suppression
   en follow-up. */
export { EXERCISES as BASE_V } from "./registry.js";
export { SLOTS, SESSIONS, CORE, WARM } from "./default-program.js";
export { cardioPlan, CARDIO_ITEMS, MOB_DAYS, CARDIO_DAY_NOTES } from "./cardio.js";

/* ---------- Construction du bundle actif (#6, #25) ----------
   Un cycle fige un catalogue — celui de definition.program, ou par défaut
   celui de DEFAULT_DEFINITION.program (src/default-program.js) — et y
   injecte ses charges de départ. `??` couvre aussi une définition stockée
   avant #25, quand `program` était rejeté à l'import et qu'un tel fichier
   voulait dire "la structure bundlée, mon profil" : ce comportement ne
   change pas. Le clone est la ligne qui compte : V[vid].start = load
   muterait sinon le registre partagé, et un deuxième cycle en mémoire
   écraserait les charges du premier. Affectation sans condition — pullup
   vaut 0 (poids du corps), un `if (load)` le perdrait.
   cardio résout la règle nommée : "default" (ou absent) -> la règle
   bundlée cardioPlan/CARDIO_ITEMS/MOB_DAYS/CARDIO_DAY_NOTES ; null ->
   aucune donnée cardio (rendu conditionnel laissé à #13). */
export function buildProgram(definition) {
  const p = (definition && definition.program) || DEFAULT_DEFINITION.program;
  const V = structuredClone(EXERCISES);
  const startingLoads = (definition && definition.startingLoads) || {};
  for (const [vid, load] of Object.entries(startingLoads)) {
    if (V[vid]) V[vid].start = load;
  }
  const cardio = p.cardio === null
    ? {}
    : { cardioPlan, CARDIO_ITEMS, MOB_DAYS, CARDIO_DAY_NOTES };
  return { V, SLOTS: p.SLOTS, SESSIONS: p.SESSIONS, CORE: p.CORE, WARM: p.WARM, ...cardio };
}

/* ---------- Dérivations pures depuis un bundle (#22, #13) ----------
   App.jsx les lisait en dur avant #22. Depuis #13, un bundle peut aussi
   n'avoir aucune donnée cardio (`cardio: null` en #25) : getCardioDayNotes
   tolère l'absence de CARDIO_DAY_NOTES, et les trois has*() ci-dessous
   disent à App.jsx si l'affordance "Cardio et mobilité" a quoi que ce soit
   à montrer. */

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
  return Object.keys(prog.CARDIO_DAY_NOTES || {})
    .map(Number)
    .filter((day) => !sessionDays.has(day));
}

/* #13 : cardio et mobilité sont deux affordances indépendantes — un bundle
   peut n'avoir ni l'une ni l'autre (cardio: null), et rien n'empêche à
   l'avenir l'une sans l'autre. hasCardioContent couvre les points d'App.jsx
   qui n'ont besoin que de savoir s'il y a quoi que ce soit à montrer. */
export function hasCardioItems(prog) {
  return !!(prog.CARDIO_ITEMS && prog.CARDIO_ITEMS.length);
}
export function hasMobilityDays(prog) {
  return !!(prog.MOB_DAYS && prog.MOB_DAYS.length);
}
export function hasCardioContent(prog) {
  return hasCardioItems(prog) || hasMobilityDays(prog);
}
