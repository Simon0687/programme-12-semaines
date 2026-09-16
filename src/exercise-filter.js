/* =========================================================
   Filtrage du registre fermé — le sélecteur d'exercices (#36)

   L'éditeur ne laisse pas taper un id : il fait choisir dans les 63
   entrées de EXERCISES (src/registry.js), qui sont exactement celles que
   le moteur sait exécuter (§2.5). Ce module est la moitié calculable de
   ce sélecteur — filtrer et trier —, src/ProgramEditor.jsx n'en affiche
   que le résultat.

   Deux façons de chercher, volontairement distinctes :

   - **Les facettes** (muscle, pattern, équipement) lisent les champs de
     sélection de #25. Les quatre entrées sans champs de sélection —
     pallof, sideplank, abwheel, carry (UNSELECTABLE_IDS, note d'en-tête
     du registre) — n'en ressortent donc jamais. Ce n'est pas une liste
     d'exclusion codée ici : il n'y a rien à quoi comparer, et c'est
     mieux ainsi, car l'amendement du 2026-09-10 dit « pour l'instant ».
     Le jour où #25 tranche la taxonomie anti-mouvement et leur donne un
     pattern, elles réapparaissent dans les facettes sans qu'on touche à
     ce fichier.

   - **La recherche par nom** porte sur les 63, sans exception. C'est ce
     qui garde ces quatre-là atteignables : elles restent référençables
     par un SLOT (champs d'exécution complets), donc l'éditeur doit
     pouvoir les poser dans une séance.

   Aucun seuil sur la part musculaire : `muscles` est une répartition qui
   somme à 1.0, et filtrer sur « triceps » rend le développé couché
   (0.2) autant que le pushdown (1.0). Décider qu'en dessous de 0,3 un
   muscle ne compte pas serait une règle de sélection, et #25 ne l'a pas
   tranchée — le tri par nom, lui, n'invente rien.
   ========================================================= */

import { EXERCISES, MUSCLE_GROUPS, PATTERNS, EQUIPMENT } from "./registry.js";

/* Réexportés pour que l'écran n'ait qu'un import : les vocabulaires
   restent définis par le registre, seul endroit où ils peuvent changer. */
export { MUSCLE_GROUPS, PATTERNS, EQUIPMENT };

/* Accents retirés et minuscules : « developpe » doit trouver
   « Développé », un clavier de téléphone ne met pas les accents. */
const fold = (s) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/* La requête est découpée en mots, tous exigés mais dans n'importe quel
   ordre : « developpe barre » trouve « Développé couché barre », qu'une
   simple sous-chaîne manquerait. */
const words = (query) => fold(query).split(/[^a-z0-9]+/).filter(Boolean);

const matchesQuery = (entry, toks) => {
  const name = fold(entry.name);
  return toks.every((t) => name.includes(t));
};

/* Une facette dont la valeur est absente du vocabulaire ne correspond à
   rien, et rend donc une liste vide : un sélecteur vide se voit, une
   facette silencieusement ignorée ne se voit pas.
   La facette s'appelle `equipment`, le champ du registre `equipement`
   (#25) — la traduction se fait ici, une fois. */
const matchesFacets = (entry, { muscle, pattern, equipment }) =>
  (!muscle || (entry.muscles?.[muscle] ?? 0) > 0) &&
  (!pattern || entry.pattern === pattern) &&
  (!equipment || (entry.equipement ?? []).includes(equipment));

/* Les entrées rendues portent leur id et sont des copies de surface :
   à lire, jamais à modifier — `muscles` et `equipement` restent ceux du
   registre. */
export function filterExercises(query, facets = {}) {
  const toks = words(query);
  return Object.entries(EXERCISES)
    .filter(([, entry]) => matchesQuery(entry, toks) && matchesFacets(entry, facets))
    .map(([id, entry]) => ({ id, ...entry }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/* Les valeurs de facette qu'au moins une entrée porte. EXERCISES ne change
   pas à l'exécution : la liste se calcule une fois au chargement, et
   l'écran n'a rien à calculer pour éviter de proposer une facette qui ne
   rendrait rien. Le cas existe — « kettlebell » est dans le vocabulaire
   d'équipement et aucune entrée ne le porte (test/exercise-filter.test.js) —
   et une facette qui rend une liste vide se lit comme une panne. */
const withMatches = (values, key) => values.filter((v) => filterExercises("", { [key]: v }).length > 0);

export const FACET_VALUES = {
  muscle: withMatches(MUSCLE_GROUPS, "muscle"),
  pattern: withMatches(PATTERNS, "pattern"),
  equipment: withMatches(EQUIPMENT, "equipment"),
};
