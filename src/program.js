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
import { resolveCardio } from "./cardio.js";
import { LEGACY_DEFINITION } from "./legacy-program.js";

export { resolveCardio, MODALITIES, KIND_LABELS } from "./cardio.js";

/* ---------- Construction du bundle actif (#6, #25) ----------
   Un cycle fige un catalogue — celui de definition.program — et y injecte
   ses charges de départ.

   Le repli couvre une définition stockée avant #25, quand `program` était
   rejeté à l'import et qu'un tel fichier voulait dire « la structure
   bundlée, mon profil ». Il résout vers LEGACY_DEFINITION, valeur
   historique figée, et non vers le bundle courant (#32) : depuis #26 le
   programme livré est un Haut/Bas neutre, si bien qu'un repli sur « ce que
   l'appli embarque aujourd'hui » relisait ces journaux contre un programme
   jamais effectué — exactement le piège que #26 a fermé pour
   `definition: null`, resté vivant un cran plus bas. Un défaut résolu à la
   lecture est une promesse que le défaut ne changera jamais
   (docs/ARCHITECTURE.md, invariant 2.1) ; celui-ci ne peut plus changer.

   Le clone est la ligne qui compte : V[vid].start = load
   muterait sinon le registre partagé, et un deuxième cycle en mémoire
   écraserait les charges du premier. Affectation sans condition — pullup
   vaut 0 (poids du corps), un `if (load)` le perdrait.
   cardio, depuis #34 : `null` -> aucune donnée (rendu conditionnel de #13) ;
   un objet -> la structure du programme, jointe aux nombres de la personne
   (`definition.cardioBaseline`) et à la courbe, qui reste de la méthode ;
   `"default"` ou absent -> la structure et les nombres de Simon, figés dans
   cardio.js. Cette dernière branche est un alias hérité et rien d'autre :
   des journaux stockés portent cette chaîne, et ARCHITECTURE 2.1 interdit
   qu'elle se mette à désigner autre chose. `haut-bas-5j.json` ne l'emploie
   plus — il porte sa structure en clair — donc elle n'a plus d'utilisateur
   vivant, seulement des utilisateurs stockés.

   Le repli par omission est conservé pour la même raison, et pour elle
   seule : un fichier d'avant #34 sans champ `cardio` désignait le rameur de
   Simon, et doit continuer de le désigner. Un fichier au format 3 ne peut
   plus omettre le champ — le validateur l'exige (journal-shape.js). */
export function buildProgram(definition) {
  const p = (definition && definition.program) || LEGACY_DEFINITION.program;
  const V = structuredClone(EXERCISES);
  const startingLoads = (definition && definition.startingLoads) || {};
  for (const [vid, load] of Object.entries(startingLoads)) {
    if (V[vid]) V[vid].start = load;
  }
  const cardio = p.cardio === null ? {} : resolveCardio(p.cardio, definition && definition.cardioBaseline);
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

/* Jours qui portent du cardio ou de la mobilité mais aucune séance de force,
   en décalages de 1 à 7 depuis startDate (#39). Un jour qui porte les deux
   (mercredi : Haut B puis rameur) n'en fait pas partie : le cardio y complète
   la séance, il ne la remplace pas.

   **C'était une table, c'est devenu un calcul (#34).** `CARDIO_DAY_NOTES`
   énumérait à la main des jours que la structure porte désormais, et ses clés
   étaient la dernière chose du format indexée par Date#getDay() — le second
   vocabulaire que #39 a supprimé partout ailleurs. Une table qui redit ce que
   la donnée sait déjà est une table qui finira par la contredire.

   #41 : plus aucun appelant dans src/. Son unique consommateur était
   l'effet qui devinait la séance à ouvrir, supprimé depuis qu'on choisit sa
   séance depuis Semaine. Gardée parce que la question — « quels jours sont
   des jours de cardio seul ? » — se reposera au premier écran qui voudra le
   dire, et qu'elle ne coûte plus de donnée à personne. */
export function getCardioDayNotes(prog) {
  const sessionDays = new Set(prog.SESSIONS.map((s) => s.day));
  const days = [
    ...(prog.CARDIO_ITEMS || []).map((it) => it.day),
    ...(prog.MOB_DAYS || []),
  ];
  return [...new Set(days)].filter((d) => d != null && !sessionDays.has(d)).sort((a, b) => a - b);
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
