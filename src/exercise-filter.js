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

/* Les valeurs de facette qu'au moins une entrée porte. Le cas existe —
   « kettlebell » est dans le vocabulaire d'équipement et aucune entrée ne le
   porte (test/exercise-filter.test.js) — et une facette qui rend une liste
   vide se lit comme une panne.

   Chaque facette n'énumère que les valeurs qu'au moins une entrée porte,
   indépendamment de ce qui est déjà coché sur les autres facettes.

   #64 avait tenté l'inverse : restreindre chaque liste à ce qui reste
   viable compte tenu des autres, pour éviter d'afficher deux facettes qui
   ensemble ne rendent rien. Mais `applyFacet` sait déjà résoudre ce
   conflit après le clic — il garde la facette qu'on vient de toucher et
   lâche l'autre — et la restriction empêchait justement de cliquer sur la
   valeur qui aurait déclenché cette résolution : choisir un autre muscle
   obligeait à d'abord remettre le mouvement à zéro. Les listes restent
   donc fixes, et c'est `applyFacet` qui absorbe le conflit.

   La requête texte n'entre pas dans ce calcul non plus, pour la même
   raison de stabilité : elle se corrige lettre à lettre, et des options
   qui bougent pendant la frappe rendraient l'écran instable. Elle porte
   d'ailleurs sur les 73 entrées, facettes comprises ou non (note
   d'en-tête). */
export const FACET_KEYS = ["muscle", "pattern", "equipment"];
const VOCAB = { muscle: MUSCLE_GROUPS, pattern: PATTERNS, equipment: EQUIPMENT };

export function facetValues() {
  const viable = (key) => VOCAB[key].filter((v) => filterExercises("", { [key]: v }).length > 0);
  return { muscle: viable("muscle"), pattern: viable("pattern"), equipment: viable("equipment") };
}

/* Ce que le sélecteur propose à l'ouverture, rien de coché : la constante
   d'avant #64, conservée telle quelle pour les appelants qui n'ont pas de
   sélection à passer. */
export const FACET_VALUES = facetValues({});

/* Cocher une facette qui contredit une autre garde **celle qu'on vient de
   toucher** et lâche l'autre. L'inverse — refuser le choix, ou rendre une
   liste vide — ferait porter à l'utilisateur la correction d'un état que
   l'écran a laissé exister.

   Décocher ne peut jamais vider : on sort sans rien toucher. Sinon, les
   autres facettes tombent une à une, dans l'ordre déclaré, et la boucle
   s'arrête dès que la combinaison rend quelque chose — au pire il ne reste
   que la valeur choisie, qui rend au moins une entrée puisqu'elle était
   proposée. */
export function applyFacet(facets, key, value) {
  const next = { ...facets, [key]: value };
  if (!value) return next;
  for (const k of FACET_KEYS) {
    if (k === key || !next[k]) continue;
    if (filterExercises("", next).length === 0) next[k] = "";
  }
  return next;
}

/* Les facettes qui décrivent un exercice donné — ce que la Séance coche en
   ouvrant le sélecteur sur un créneau (#55 Q3 = C, étendu au muscle en #64).
   Le muscle retenu est le dominant de la répartition ; à part égale, l'ordre
   alphabétique tranche, pour que deux ouvertures du même écran ne cochent pas
   deux facettes différentes.

   L'équipement n'en fait pas partie : remplacer un exercice parce que la
   machine est prise est le cas courant, et pré-cocher son matériel
   masquerait exactement les remplaçants qu'on cherche. */
export function facetsOf(entry) {
  const muscles = Object.entries((entry && entry.muscles) || {}).filter(([, v]) => typeof v === "number" && v > 0);
  muscles.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return { muscle: muscles.length ? muscles[0][0] : "", pattern: (entry && entry.pattern) || "" };
}
