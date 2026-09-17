/* =========================================================
   Traits des unités — ce que « kg », « bw », « carry », « time » et
   « reps » veulent dire (#23)

   Le registre déclare une unité par exercice (`V[vid].unit`, src/registry.js
   §V). Ce que cette unité *implique* était réparti en huit ternaires
   indépendants — dans `progression.js`, `display.js`, `exercise-history.js`,
   `load-picker.js` et `App.jsx` — dont deux branches identiques écrites deux
   fois. Ajouter une unité, ou changer ce que « carry » veut dire, demandait
   de toutes les retrouver. Elles lisent maintenant cette table.

   ---------------------------------------------------------
   hasLoad     l'unité porte-t-elle une charge ? `time` et `reps` sont les
               deux qui n'en portent pas — ni colonne de saisie, ni charge
               prévue, ni borne dans le résumé de séries.
   bodyweight  la charge saisie s'**ajoute au corps** au lieu d'être le
               total soulevé. C'est ce qui fait « PDC + 10 kg » et « PDC »
               plutôt que « 10 kg » et « 0 kg ».
   repUnit     l'unité de la colonne du milieu : des répétitions, ou des
               secondes de tenue. C'est le seul endroit où `carry` compte
               avec `time` et non avec `kg`.
   chart       la stratégie de la courbe de la fiche exercice (#17) :
               `estimate` extrapole un 10RM, `raw` trace la mesure telle
               quelle, `dual` superpose deux grandeurs qui progressent
               ensemble. Le pourquoi de chaque cas est dans
               `chartMode()` (exercise-history.js), qui reste la porte.
   ---------------------------------------------------------

   **Ce que cette table ne porte pas : les libellés d'interface.** Les
   en-têtes de colonnes (« s / côté », « lest kg ») vivent dans
   `display.js`, avec MUSCLE_LABELS et DAY_NAMES, pour la raison qui les y a
   mis : un module que `progression.js` importe ne peut pas porter de texte
   d'écran sans faire du moteur un module de vue.

   C'est d'ailleurs pourquoi cette table n'est pas dans `program.js` comme
   #23 le proposait. `progression.js` en a besoin et n'importe rien
   (ARCHITECTURE §1) ; `program.js` importe `registry`, `cardio` et
   `legacy-program`. La table devait donc descendre sous le moteur, pas se
   poser à côté de lui — d'où cette feuille, qui n'importe rien non plus.
   ========================================================= */

export const UNITS = {
  kg: { hasLoad: true, bodyweight: false, repUnit: "reps", chart: { kind: "estimate", line: "kg" } },
  bw: { hasLoad: true, bodyweight: true, repUnit: "reps", chart: { kind: "dual", line: "reps", bar: "kg" } },
  carry: { hasLoad: true, bodyweight: false, repUnit: "s", chart: { kind: "dual", line: "time", bar: "kg" } },
  time: { hasLoad: false, bodyweight: false, repUnit: "s", chart: { kind: "raw", line: "time" } },
  reps: { hasLoad: false, bodyweight: false, repUnit: "reps", chart: { kind: "raw", line: "reps" } },
};

/* Le repli sur `kg` est celui que faisaient déjà les huit ternaires, chacun
   par sa branche `else` : une unité absente est du kilo. Il est ici pour
   qu'aucun appelant n'ait à écrire `v.unit || "kg"` avant de demander —
   c'était la répétition suivante. */
export const traitsOf = (unit) => UNITS[unit] || UNITS.kg;
