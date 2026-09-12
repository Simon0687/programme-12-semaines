/* =========================================================
   Programme hérité — le cycle fourni avec l'appli avant #26

   Jusqu'à #26, ce programme *était* le bundle par défaut, et un journal
   stocké s'y rattachait sans le dire : `definition: null` voulait dire
   « le programme fourni avec l'appli », résolu à la lecture contre
   DEFAULT_DEFINITION. Changer le bundle réinterprétait donc tout
   l'historique — voir docs/features/26-neutral-default-program/spec.md.

   Ce module existe pour que la migration puisse nommer ce programme
   explicitement au lieu de le désigner par « le défaut courant » :
   MIGRATIONS[1] l'écrit dans le journal, MIGRATIONS[3] épingle les
   journaux qui portent encore `definition: null`. Après cette migration,
   plus aucune donnée stockée ne dépend du bundle.

   La donnée vit en JSON et pas ici : le fichier servi sous
   public/programs/ est celui qu'importe l'application et celui qu'un
   utilisateur peut charger, au même octet près — c'est ce qui fait que
   le chemin d'import réel est exercé à chaque build.

   schema.js n'importe pas ce module : il reste une feuille (voir sa note
   d'en-tête), et reçoit la définition par ctx.legacyDefinition.
   ========================================================= */

import definition from "../public/programs/haut-bas-5j.json" with { type: "json" };

export const LEGACY_DEFINITION = definition;
