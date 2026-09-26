# Design — Plan de repli dynamique (#120)

Source : [`spec.md`](spec.md), [`decisions-spec.md`](decisions-spec.md)
(Q1 hybride, Q2 ordre de déclaration, Q3 pas de plancher, Q4 recomposition —
validées par Simon le 2026-09-26).

## Résumé

Un nouveau module `src/fallback.js` (méthode pure, comme `cardio.js` :
aucun import d'écran) calcule, depuis `resolveWeek(program, "b1")`
(`assertions.js:123`, déjà utilisé pour le volume), un ordre de repli par
séance et une recomposition d'exercices par niveau. `generator.js` l'appelle
une fois à la génération et écrit le résultat sur `program.fallback`
(structuré, plus un tableau de paragraphes). `plan.js` remplace la lecture
actuelle de `program.fallback` (texte brut) par la mise en forme de cette
structure. La règle de non-répétition se calcule à l'affichage, en dérivant
l'état de la semaine passée depuis les séances déjà validées dans le journal
— **aucun nouveau champ de journal** : on regarde qui a validé quoi, pas
besoin de stocker "quel niveau a été appliqué".

## Fichiers touchés

- **`src/fallback.js`** (nouveau) — calcul pur : couverture musculaire par
  séance, ordre de sacrifice, recomposition d'exercices, et l'ajustement de
  non-répétition.
- **`src/generator.js`** — `toProgram()` (`:579`) appelle
  `buildFallbackLevels()` et écrit `program.fallback` à côté de
  `program.volume` (`:631`, juste après `volume: volumeTable(...)`).
- **`src/plan.js`** — la fonction qui construit la section "fallback"
  (`:452-457` actuellement) change de source de données : elle consomme
  `program.fallback.levels` au lieu de `program.fallback` (tableau de
  strings), et appelle une nouvelle fonction de mise en forme,
  `fallbackBlocks(levels, activeLevel)`.
- **`src/journal-shape.js`** — `validateProgram()`/la fonction qui valide
  `program.fallback` (aucune validation dédiée aujourd'hui, le champ est
  juste lu tel quel) doit valider la nouvelle forme structurée. Module
  sensible (override WORKFLOW.md) : à traiter avec la même rigueur que le
  reste des champs de `program`.
- **`src/App.jsx`** — la fonction qui construit `prog` / passe les props à
  `<Block>` (autour de `:1793`, où `hasCardioContent` est déjà lu) calcule
  `activeLevel` : combien de séances de la semaine précédente ont été
  validées, pour dériver dynamiquement "quel niveau s'est appliqué" — sans
  nouveau champ stocké.
- **`test/fallback.test.js`** (nouveau) — tests unitaires de `fallback.js`.
- **`test/plan.test.js`** — cas existants sur la section fallback à adapter
  à la nouvelle forme.

## Approche

### Forme des données

```jsonc
// program.fallback — écrit une fois à la génération
{
  "levels": [
    {
      "keep": ["hautA", "hautC"],               // séances gardées telles quelles
      "merge": {                                 // 0 ou 1 fusion par niveau
        "from": ["hautB", "jambes"],
        "into": {
          "id": "tirageJambes",
          "name": "Tirage + jambes",
          "ex": [["slotTraction", 3], ["slotRowing", 2], ["slotSquat", 3], ["slotLegCurl", 2]]
        }
      }
    },
    // niveau suivant : un "keep" plus court, jusqu'à 1 séance (pas de plancher, Q3)
  ]
}
```

`levels[0]` = repli à N-1 séances, `levels[1]` = N-2, etc. (Q3 : la boucle
descend naturellement jusqu'à `keep.length + (merge ? 1 : 0) === 1`, sans
garde spéciale.)

### Fonctions de `fallback.js`

```js
// Couverture : quels muscles une séance travaille, dérivé de resolveWeek().
function sessionCoverage(session)          // Set<muscle>, via contribution() (assertions.js)

// Ordre de sacrifice : la séance la plus "redondante" en tête.
function rankSessionsForCut(sessions)       // session[] triée, la plus coupable d'abord
  // score = somme, sur chaque muscle qu'elle couvre, de 1/(nb de séances qui le couvrent)
  // une séance seule sur un muscle (score de ce muscle = 1) pèse plus lourd qu'une
  // séance qui le partage (score = 1/2, 1/3…) → jambes (seule) ne sort jamais en tête.
  // Égalité : ordre de déclaration dans SESSIONS (Q2), donc tri stable, pas de hasard.

// Priorité d'exercice : composés d'abord (Q1 de design.md du #120 initial —
// déjà décidé au niveau spec : type/cout_systemique).
function rankExercisesForCut(rows)          // row[] triée, isolation/cout_systemique bas d'abord

// Recompose une séance à partir des rows de plusieurs séances fusionnées,
// bornée à un total de séries (voir Question ouverte 1 sur la borne).
function composeSession(rowsFromMerged, capSets)

// Construit tous les niveaux, du plus doux (N-1) au plus dur (1).
function buildFallbackLevels(week)          // week = resolveWeek(program, "b1")

// Ajustement de non-répétition, appliqué à l'affichage seulement :
// si `lastCutId` (dérivé du journal) correspond à la séance que
// rankSessionsForCut aurait mise en tête, elle est repoussée d'un cran.
function avoidRepeat(rankedSessions, lastCutId)
```

### Dérivation de l'état "semaine passée" sans nouveau champ de journal

`App.jsx` sait déjà, pour la semaine courante, quelles séances ont un
statut validé (`doneMap`, utilisé en `:937` pour `programSummaries`). Pour la
semaine précédente, la même lecture donne "combien de séances ont été
validées sur N prévues" → l'écart avec N donne le niveau de repli qui
*aurait dû* s'appliquer, et les séances non validées donnent `lastCutId`.
Aucune écriture supplémentaire : c'est une lecture, comme `journalSessionCount`
(`program-list.js`) le fait déjà pour d'autres besoins.

### Où `fallbackBlocks()` vit

Dans `plan.js`, à côté de `nutritionBlocks()`/`cardioSection()` — même
famille de fonctions (donnée structurée → blocs `{t, text}` pour `<Block>`).

## Séquencement

1. `feat(fallback): ajouter fallback.js (couverture, ordre, recomposition)` —
   module pur, testé isolément, ne touche à rien d'existant. **Mergeable
   seul.**
2. `feat(generator): générer program.fallback à la création` — appelle
   `buildFallbackLevels()` dans `toProgram()`, écrit le nouveau champ. Le
   reste de l'app ignore encore ce champ (aucune régression possible).
3. `feat(journal-shape): valider la forme structurée de program.fallback` —
   ajoute la validation. Module sensible, tests de régression complets.
4. `feat(plan): afficher program.fallback structuré` — remplace la lecture
   actuelle dans `plan.js`, ajoute `fallbackBlocks()`.
5. `feat(app): dériver le niveau de repli actif depuis le journal` — calcul
   de `lastCutId`/niveau appliqué, passé à `fallbackBlocks()` pour
   l'ajustement de non-répétition.
6. `test: couvrir fallback.js et la section Plan de repli` — si pas déjà
   fait au fil des étapes précédentes.

## Tests

- Unitaires (`test/fallback.test.js`) : `sessionCoverage`, `rankSessionsForCut`
  (cas de l'exemple réel de Simon : 2 séances Haut + 1 Jambes → Jambes ne
  sort jamais en tête), `rankExercisesForCut` (composés survivent),
  `composeSession` (recomposition), `avoidRepeat` (repousse la répétition).
- Intégration (`test/plan.test.js`) : `buildPlan()` sur un programme généré
  produit une section "Plan de repli" avec le bon nombre de niveaux.
- Régression (`test/journal-shape.test.js`) : anciens journaux avec
  `program.fallback` en tableau de strings (programme de Simon actuel) —
  vérifier explicitement ce qui doit se passer (voir Question ouverte 2).
- Manuel : ouvrir le Plan sur un programme fraîchement généré, vérifier le
  texte des niveaux de repli.

## Risques & compromis

- **Rétrocompatibilité du format** : le programme personnel de Simon porte
  déjà `program.fallback` comme un tableau de 4 paragraphes de texte brut.
  La nouvelle forme structurée n'est pas compatible avec l'ancienne — voir
  Question ouverte 2, c'est le point le plus risqué de ce design.
- **Alternative rejetée** : recalculer à chaque affichage (Option B de
  `decisions-spec.md` Q1) — écartée parce que Simon a confirmé l'hybride
  (priorité figée à la génération, cf. Q1).
- **Compromis accepté** : la borne de séries d'une séance composite (Q1 du
  design ci-dessus) reste à fixer — voir Question ouverte 1.

## Hors scope / suites possibles

- Le "conseil vivant" en cours de semaine, déjà noté dans `spec.md` — suite
  séparée, pas ce ticket.

## Questions ouvertes

None — tranchées en autonomie pour permettre le passage au code (Simon
relit à l'usage) :

1. **Borne de séries de la séance composite.** `composeSession()` réutilise
   `targets.capPerSession` (`generator.js:674`, déjà calculé par le
   générateur pour plafonner une séance normale) plutôt qu'un nombre
   inventé — cohérent avec le reste du fichier, aucune nouvelle constante.
2. **Rétrocompatibilité du format.** `validateProgram()` accepte les deux
   formes : un tableau de strings (l'ancien format, celui du programme
   personnel de Simon aujourd'hui) est laissé tel quel et continue de
   s'afficher via l'ancien chemin de `plan.js` ; la forme `{ levels }` est
   validée et affichée via `fallbackBlocks()`. Même principe que
   `normalizeCardio()` (`cardio.js:158`), qui tolère déjà un format hérité à
   côté du format courant. Simon n'a besoin de migrer son propre programme
   que s'il veut le nouveau comportement (recomposition, non-répétition) —
   rien ne casse dans l'intervalle.
