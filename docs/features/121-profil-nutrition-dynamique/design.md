# Design — Profil et Nutrition dynamiques (#121)

Source : [`spec.md`](spec.md), [`decisions-spec.md`](decisions-spec.md)
(Q1 champs calculés stockés, Q2 poids hebdo sans effet, Q3 trois paliers,
Q4 brief enrichi — validées par Simon le 2026-09-26).

## Résumé

Un nouveau module pur `src/nutrition.js` calcule les 4 champs dérivés
(`startKcal`, `maintenanceKcal`, `macros`, `targetWeightKg`) à partir des 6
champs bruts du profil, et génère le texte du brief IA. Un formulaire
d'édition dans la section Nutrition de `App.jsx` écrit le profil complet
(bruts + dérivés) sur `definition.profile` via `updateActive()` (le
mécanisme déjà utilisé pour `cardio`/`checkin`). `plan.js` change la
condition d'affichage de la section (toujours visible) et remplace les
listes hardcodées par le rendu du brief.

## Fichiers touchés

- **`src/nutrition.js`** (nouveau) — calcul pur (BMR, TDEE, macros, cible,
  variante masse/sèche/maintien) et génération du texte du brief.
- **`src/plan.js`** — `nutritionBlocks(profile)` (`:229`) et la condition
  `profile ? {...} : null` (`:462`) changent : la section est toujours
  émise ; son contenu dépend de la présence du profil.
- **`src/journal-shape.js`** — la validation de `profile` (`:528-544`)
  s'étend pour accepter, en plus des 4 champs déjà exigés, les 6 champs
  bruts optionnels. Module sensible (override WORKFLOW.md).
- **`src/App.jsx`** — nouveau composant `NutritionProfileForm` (formulaire
  de saisie/édition), une fonction `setProfile(rawFields)` qui appelle
  `computeNutritionProfile()` puis écrit via `updateActive()` (comme
  `setCardio`, `:848`), et le remplacement de l'affichage de la section
  Nutrition dans `<Block>` pour montrer soit l'appel à l'action soit le
  contenu rempli.
- **`test/nutrition.test.js`** (nouveau) — tests du calcul.
- **`test/plan.test.js`** — cas existants sur la section Nutrition à
  adapter (section toujours présente).

## Approche

### Forme des données

```jsonc
// definition.profile — les 6 champs bruts + les 4 champs dérivés (Q1)
{
  "tailleCm": 178,
  "poidsKg": 82,
  "age": 34,
  "sexe": "h",                  // "h" | "f" — seules deux variantes Mifflin-St Jeor
  "activite": "modere",         // "sedentaire" | "modere" | "actif" (Q3)
  "objectif": "masse",          // "masse" | "seche" | "maintien"

  // dérivés, écrits uniquement par computeNutritionProfile() — jamais saisis
  "maintenanceKcal": 2850,
  "startKcal": 3100,
  "macros": { "p": 180, "f": 90, "c": 320 },
  "targetWeightKg": [83, 85]
}
```

### `src/nutrition.js`

```js
export const ACTIVITY_FACTORS = { sedentaire: 1.2, modere: 1.4, actif: 1.6 }; // Q3

function bmr({ tailleCm, poidsKg, age, sexe }) {
  // Mifflin-St Jeor : 10*poids + 6.25*taille - 5*age + (5 si h, -161 si f)
}

export function computeNutritionProfile(raw) {
  // raw = les 6 champs bruts ; retourne { ...raw, maintenanceKcal, startKcal, macros, targetWeightKg }
  // objectif "masse"   -> startKcal = maintenance + surplus ; cible = poids + gain visé
  // objectif "seche"   -> startKcal = maintenance - déficit ; cible = poids - perte visée
  // objectif "maintien"-> startKcal = maintenance ; cible = [poids, poids]
}

export function adjustmentTable(objectif) {
  // la table Si/Alors existante (plan.js:263-267) pour "masse", sa variante
  // miroir pour "seche" (perte trop lente/rapide), plate pour "maintien"
}

export function firstWeeksNote(objectif) {
  // "eau/glycogène" pour masse, variante miroir pour sèche
}

export function aiBrief(profile, sessionsPerWeek) {
  // texte copiable : kcal, macros, objectif, rythme d'entraînement (Q4)
}
```

`plan.js` importe ces fonctions ; `nutritionBlocks()` devient un
assemblage des blocs à partir de leurs résultats, au lieu de listes
écrites en dur.

### Formulaire et écriture

```js
// App.jsx
const setProfile = (raw) => updateActive((st) => ({
  definition: { ...st.definition, profile: computeNutritionProfile(raw) },
}));
```

Réutilise `updateActive()` (`App.jsx:260`), qui patch déjà `programs[id]`
sans passer par le validateur d'import (comme `setCardio`/`setCheck` déjà en
place) — cohérent avec le reste de l'écriture en direct sur le cycle actif.

### Affichage (section toujours visible)

```js
// plan.js, remplace la ligne 462
profile ? { id: "nutrition", ..., blocks: nutritionBlocks(profile) }
        : { id: "nutrition", title: "Nutrition", group: "programme",
            blocks: [{ t: "p", text: "Renseigne ton profil pour calculer tes calories et macros." },
                     { t: "cta", label: "Renseigner mon profil" }] }
```

(`{ t: "cta" }` est un nouveau type de bloc pour `<Block>`/`PlanViews.jsx` —
un bouton qui ouvre `NutritionProfileForm`, à la différence des blocs
purement textuels existants.)

## Séquencement

1. `feat(nutrition): ajouter nutrition.js (calcul BMR/macros/cible/brief)` —
   module pur, testé isolément. **Mergeable seul.**
2. `feat(journal-shape): valider les 6 champs bruts optionnels du profil` —
   module sensible, tests de régression complets sur les journaux existants
   (profil actuel de Simon, sans champs bruts, doit continuer à valider).
3. `feat(plan): section Nutrition toujours visible, contenu dérivé de nutrition.js` —
   remplace `nutritionBlocks()` et la condition d'affichage.
4. `feat(app): formulaire de saisie/édition du profil nutrition` —
   `NutritionProfileForm`, `setProfile()`, bloc `{t:"cta"}` dans
   `PlanViews.jsx`.
5. `test: couvrir nutrition.js et la section Nutrition` — si pas déjà fait
   au fil des étapes précédentes.

## Tests

- Unitaires (`test/nutrition.test.js`) : `computeNutritionProfile()` pour
  les trois objectifs (signe du surplus/déficit, sens de la cible),
  `adjustmentTable()` (variante masse vs sèche), `aiBrief()` (contient bien
  kcal/macros/objectif/rythme).
- Intégration (`test/plan.test.js`) : section Nutrition visible sans
  profil (bloc CTA) et avec profil (headline/tuiles/brief).
- Régression (`test/journal-shape.test.js`) : le profil actuel de Simon
  (4 champs calculés, sans les 6 bruts) continue de valider et de
  s'afficher à l'identique.
- Manuel : remplir le formulaire pour les trois objectifs, vérifier le
  signe des calculs et le contenu du brief copié.

## Risques & compromis

- **Sexe non binaire** (cas limite de la spec) : Mifflin-St Jeor n'a que
  deux variantes. Choix retenu : le formulaire propose "h"/"f" comme les
  deux options disponibles pour ce calcul spécifique (pas une déclaration
  d'identité générale) — documenté dans le libellé du champ plutôt
  qu'ignoré.
- **Alternative rejetée** : dériver les 4 champs sans les stocker (Option B
  de Q1) — casserait le journal actuel de Simon (voir `decisions-spec.md`).
- **Compromis accepté** : `setProfile()` ne passe pas par le validateur
  d'import avant écriture, comme le reste de l'édition en direct du cycle
  actif (`setCardio`, `setCheck`) — cohérent avec l'existant, pas une
  nouvelle exception.

## Hors scope / suites possibles

- Suivi automatique de la dérive de poids (déjà noté dans `spec.md`).

## Questions ouvertes

None.
