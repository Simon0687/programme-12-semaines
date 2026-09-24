/* =========================================================
   Premier lancement — ce que voit un appareil vierge (#19)

   Un nouvel athlète atterrissait dans la semaine 1 de quelqu'un d'autre,
   sans que rien ne le dise. #26 avait retiré la fuite de données — le
   bundle n'est plus le programme de Simon — mais il restait un programme
   que personne n'avait choisi, sur une date de départ que personne n'avait
   fixée, avec un compteur de semaines qui avançait déjà.

   Ce module ne porte que deux réponses, toutes deux pures, et surtout pas
   l'écran : App.jsx rend, ce module juge.

   **Aucun champ stocké.** Le premier lancement est un verdict de
   chargement, pas un état : `loadJournal()` rend déjà
   `{ ok: false, reason: "absent" }` quand la clé n'existe pas, et son
   en-tête le dit mot pour mot — « pas de clé : première utilisation ».
   Un booléen « onboarded » serait une migration de schéma pour une
   question à laquelle la donnée répond déjà (decisions-spec.md Q2).
   ========================================================= */

import { nextMonday } from "./program-editor.js";

/* Vrai pour le seul verdict qui signifie « il n'y a pas de journal ».

   Les trois autres échecs de chargement n'en sont pas, et les confondre
   serait un bug chacun :

   - `no-store` : rien ne peut être stocké, donc l'accueil reviendrait à
     *chaque* ouverture. L'appli avertit déjà par un autre chemin.
   - `too-new` : un journal existe, écrit par une version plus récente, et
     l'appli refuse déjà de l'écraser. Proposer de générer par-dessus
     serait une invitation à détruire.
   - `corrupt` / `invalid` : idem, le journal est là et illisible. C'est le
     message de récupération qui doit tenir l'écran, pas un accueil.

   Un chargement réussi n'en est évidemment pas un, même sans aucune séance
   enregistrée : un journal existe, quelqu'un l'a voulu. */
export const isFirstLaunch = (res) => !!res && res.ok === false && res.reason === "absent";

/* Le cycle fourni, prêt à être commencé aujourd'hui.

   `public/programs/upper-lower-4j.json` porte une date de départ figée. Sur
   un appareil ouvert trois mois plus tard, `slotForDate()` place aujourd'hui
   au-delà de la douzième semaine et l'écran annonce « Les 12 semaines sont
   terminées » — sur un programme que personne n'a commencé. #39 n'a pas causé
   ça, il l'a rendu visible en rendant la phrase juste.

   La date se calcule donc ici, à l'usage, et le fichier livré n'est pas
   modifié : une date figée dans un fichier livré est *exactement* le défaut,
   la changer ne ferait que déplacer le jour où le bug revient. C'est aussi ce
   qui garde `DEFAULT_DEFINITION` comparable telle quelle dans les quatre
   fichiers de tests qui s'en servent comme donnée de référence.

   `nextMonday()` rend le jour même quand on est lundi — même départ qu'un
   programme composé à la main (`emptyDraft`), et c'est voulu : un cycle
   fourni et un cycle composé n'ont aucune raison de démarrer autrement. */
export const startingNow = (definition, today) => ({ ...definition, startDate: nextMonday(today) });
