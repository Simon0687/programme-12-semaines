/* =========================================================
   Programme par défaut — le cycle fourni avec l'appli (#25, #26)

   Depuis #26 ce module ne porte plus de donnée : le programme vit en JSON
   sous public/programs/, et le fichier importé ici est exactement celui
   qu'un utilisateur peut charger — mêmes octets, donc le vrai chemin
   d'import est exercé à chaque build.

   Ce que le bundle est devenu : un Upper/Lower 4 jours générique, dérivé
   de l'exemple exécuté du §5 de docs/generation/moteur-generation-programme.md
   (4 séances, 60 min, hypertrophie, intermédiaire), avec deux substitutions
   imposées par #26 — pas de squat ni de soulevé de terre : hack squat pour
   la dominante genou, tirage entre les jambes pour la charnière de hanche.

   Il ne porte **ni profil nutritionnel, ni charges de départ** : la semaine 1
   est une semaine de calibration, tout part de la rampe « Paliers »
   (decisions-spec.md, décision 4). Le bundle ne contient donc aucune donnée
   personnelle, et l'onglet Plan omet de lui-même les sections qui en
   dépendraient (src/plan.js).

   Le programme de Simon, lui, n'est plus le défaut : il est devenu une
   définition chargeable comme une autre (src/legacy-program.js), et la
   migration l'écrit dans les journaux qui le suivaient implicitement.
   ========================================================= */

import definition from "../public/programs/upper-lower-4j.json" with { type: "json" };

export const DEFAULT_DEFINITION = definition;
