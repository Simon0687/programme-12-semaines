# Design — Le conditionnement suit le programme actif (#34)

Source : [`spec.md`](spec.md), [`decisions-spec.md`](decisions-spec.md) (option 3,
validée par Simon le 2026-09-17).

## Le découpage, et où chaque terme atterrit

| Terme | Force (déjà là) | Cardio (#34) |
|---|---|---|
| Ce qui existe | `registry.js` — 63 exercices fermés | `MODALITIES` dans `cardio.js` — 5 modalités fermées |
| Ce que ce programme fait | `program.SLOTS` / `SESSIONS` | `program.cardio.sessions` + `mobility.days` |
| Les nombres de cette personne | `definition.startingLoads` | `definition.cardioBaseline` |
| Comment ça monte | `progression.js` | `cardioCurve()` dans `cardio.js` |

Le troisième terme est celui qui manquait, et c'est lui qui produisait le bogue.
`~105–115 W` vivait avec la courbe, donc tout programme qui demandait du cardio
héritait de la calibration de Simon.

## Format

```jsonc
"program": {
  "cardio": {
    "sessions": [
      { "id": "z2a", "modality": "rameur", "kind": "z2", "day": 3,
        "anchor": "hautB", "note": "ou le soir" }
    ],
    "mobility": { "days": [2, 4, 7] }
  }
},
"cardioBaseline": { "power": [105, 115], "hr": [130, 138] }
```

- `modality` ∈ `rameur | velo | marche | course | elliptique`, `kind` ∈ `z2 | intervals` —
  fermés, donc vérifiables : la fermeture de #25 appliquée au conditionnement.
- `day` est un décalage de 1 à 7 depuis `startDate`, la convention unique de #39.
- `anchor` est l'**identifiant** d'une séance de `SESSIONS`, jamais du texte. C'est
  ce qui permet de refuser « après Haut B » sous un programme sans Haut B, comme
  la spec le demandait, au lieu de rendre une référence pendante.
- `"default"` et `null` restent valides. `null` = aucun conditionnement.

`DEFINITION_FORMAT_VERSION` passe de 2 à 3, et **c'est l'inverse du raisonnement
de #58**. Là, `intent` était consultatif : une version antérieure l'ignorait sans
rien perdre, donc bumper aurait fait refuser un fichier exécutable pour rien. Ici
une version antérieure ne l'ignorerait pas — elle teste `cardio === null`, donc
elle prendrait un objet pour `"default"` et afficherait le rameur de Simon sous
le programme d'un autre. Refuser le fichier est le bon comportement ; le laisser
passer serait silencieusement faux.

## L'invariant, et comment il est tenu

`"default"` est écrit dans des définitions **déjà stockées** : `MIGRATIONS[1]` et
`MIGRATIONS[3]` écrivent `ctx.legacyDefinition` dans les journaux. ARCHITECTURE
2.1 interdit donc qu'il change de sens.

Deux choses le garantissent :

1. `DEFAULT_CARDIO` et `DEFAULT_BASELINE` figent la structure de Simon dans
   `cardio.js`, et `resolveCardio("default")` s'y branche. Le repli par omission
   (`cardio` absent) fait de même, parce qu'un fichier d'avant #34 qui omettait
   le champ désignait bien le rameur.
2. **`haut-bas-5j.json` n'écrit plus `"default"`** : il porte sa structure et ses
   cibles en clair. Un journal migré hier (qui porte la chaîne) et un journal
   migré demain (qui portera la structure) doivent être indiscernables, et
   `test/cardio.test.js` l'épingle sur les douze semaines, les trois séances,
   leurs libellés, leur « quand » et les jours de mobilité.

## Ce qui a bougé dans le code

| Module | Ce qui change |
|---|---|
| `cardio.js` | `MODALITIES`, `KIND_LABELS`, `BASELINE_TERMS`, `cardioCurve()`, `normalizeCardio()`, `resolveCardio()`. `CARDIO_DAY_NOTES` supprimée. Reste une feuille : elle ne nomme aucun jour |
| `display.js` | `cardioWhen(item, sessions)` et `mobilityDayNames(days)` — composer « mercredi, après Haut B (ou le soir) » demande `DAY_NAMES`, et un module de méthode n'a pas à porter de vocabulaire d'écran |
| `program.js` | `buildProgram` appelle `resolveCardio(p.cardio, definition.cardioBaseline)`. `getCardioDayNotes()` **dérive** au lieu de lire une table |
| `journal-shape.js` | `validateCardio()` et `validateCardioBaseline()`, messages nommant le champ et la contrainte |
| `plan.js` | `cardioSection()` dérive les trois paragraphes ; chacun disparaît quand sa matière n'existe pas |
| `App.jsx` | `CardioView` lit `it.kind` et non `it.id === "int"` ; jours et compte de mobilité dérivés |

**`CARDIO_DAY_NOTES` disparaît.** Elle énumérait à la main des jours que la
structure porte désormais, et ses clés étaient la dernière chose du format
indexée par `getDay()` — le second vocabulaire que #39 a supprimé partout
ailleurs. `getCardioDayNotes()` reste, en calcul.

## Ce qui ne change pas

- **Le moteur et l'éditeur émettent toujours `cardio: null`** (`decisions-spec.md`
  Q3 = A). Générer du conditionnement demande une sixième question de collecte,
  un modèle de dose et une assertion qui le juge : ça se décide, ça ne se glisse
  pas dans une issue de format.
- **La courbe ne descend pas dans le format** (Q2 = A). Elle lit un numéro de
  semaine comme `phaseOf()` et `setsFor()`, et #14 remplacera les trois au même
  endroit.
- **Aucun enregistrement de journal ne change de forme.** Les coches de cardio
  restent sous `weekKey(week)` (#29), et `ca.mob` reste indexé par **position**
  dans `MOB_DAYS` — d'où l'ordre croissant garanti par `resolveCardio`, sans quoi
  les coches déjà enregistrées changeraient de jour.
- **La nutrition** reste de la prose bundlée. Même classe de problème, et
  l'argument du troisième terme y vaut aussi — un besoin calorique est une mesure
  sur une personne — mais c'est une autre issue.

## Vérification

- 789 tests au vert. `test/cardio.test.js` (17 cas) tient l'invariant `"default"`
  et le fait que les autres programmes décrivent le leur ; `test/plan.test.js`
  épingle les trois paragraphes de Simon au caractère et vérifie qu'un programme
  de marche ne dit plus un mot de rameur, de watts ni de ses jours ;
  `test/journal-shape.test.js` (17 cas) tient la fermeture du catalogue,
  l'ancre pendante, la plage 1-7 et la contrainte d'une modalité par genre.
- La barre d'acceptation de l'issue — « charger le programme hérité ne doit pas
  produire un onglet Plan ni une check-list décrivant le programme neutre » —
  est tenue dans les deux sens : le neutre (`cardio: null`) n'affiche rien, et
  celui de Simon affiche exactement ce qu'il affichait.
