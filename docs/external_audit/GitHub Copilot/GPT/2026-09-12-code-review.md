# Audit externe - `dev` au 2026-09-12

## IA et modèle

- IA : GitHub Copilot
- Modèle : GPT
- Audit précédent : [docs/reviews/2026-09-09-code-review.md](../../reviews/2026-09-09-code-review.md)

## Périmètre et méthode

Audit architectural et fonctionnel centré sur [src/App.jsx](../../src/App.jsx), les modules qu’il orchestre, les tests associés et les évolutions réalisées depuis l’audit du 9 septembre.

L’objectif est de distinguer :

- les problèmes encore présents ;
- les problèmes corrigés depuis l’audit précédent ;
- les risques introduits ou révélés par la timeline datée et les programmes personnalisés ;
- les prochaines étapes de refacto avec leur impact.

---

## 1. Ce qui tient bien

Les refontes prévues par l’ancien audit sont désormais largement présentes :

- le stockage est extrait dans [src/storage.js](../../src/storage.js), avec des verdicts testables et une sauvegarde pré-migration ;
- le schéma et les migrations sont centralisés dans [src/schema.js](../../src/schema.js) ;
- les logs utilisent une timeline datée via `dateForSlot`, `findLog` et `writeLog` ;
- le bundle actif est construit par [src/program.js](../../src/program.js) ;
- le registre fermé des exercices est centralisé dans [src/registry.js](../../src/registry.js) ;
- les constantes de forme du programme et l’état mémorisé ne sont plus codés en dur dans `App.jsx` ;
- le cardio conditionnel, l’absence de cardio et l’absence de mobilité sont gérés ;
- la progression est isolée et largement couverte par [test/progression.test.js](../../test/progression.test.js) ;
- les modules purs peuvent être testés avec `node --test` sans dépendre de React.

L’architecture est donc nettement meilleure que celle examinée le 9 septembre. `App.jsx` reste cependant le point de convergence de l’état, de l’orchestration, du formatage et du rendu, avec environ 700 lignes et plusieurs hypothèses implicites sur la validité des données.

---

## 2. Findings

Sévérité : **bug** = comportement incorrect ou crash actuel ; **dette** = comportement correct mais bloque ou renchérit une évolution ; **smell** = problème local de clarté ou de duplication.

### F1 - Un journal structurellement invalide peut encore bloquer l’application - bug P0/P1

[src/storage.js](../../src/storage.js) vérifie que `programs[activeProgramId]` existe, mais ne valide pas complètement :

- que `programs` est un objet ;
- que le programme actif est un objet ;
- que `definition`, `logs`, `cardio` et `checkin` ont la bonne forme ;
- que les entrées de logs sont valides.

Exemples de données problématiques :

```json
{"schemaVersion":3}
```

ou :

```json
{"schemaVersion":3,"activeProgramId":"x","programs":{"x":null}}
```

Ces cas peuvent provoquer une exception lors du premier rendu au lieu d’un verdict d’erreur exploitable.

**Impact :** spinner permanent, rejet mal typé ou écran blanc à partir d’un JSON syntaxiquement valide mais structurellement corrompu.

---

### F2 - La validation des programmes importés reste incomplète - bug P1

[src/import.js](../../src/import.js) vérifie les références principales, mais pas suffisamment la structure imbriquée :

- les éléments de `session.ex` et `core.ex` ne sont pas toujours vérifiés comme des tuples de deux éléments ;
- les valeurs de `day`, du nombre de séries et des bornes de `reps` ne sont pas complètement contrôlées ;
- `startingLoads` peut recevoir une structure enumerable inadéquate ;
- `after` n’est pas limité aux valeurs prises en charge, comme `z2` ou `mob`.

Certaines données mal formées peuvent provoquer une exception pendant une boucle de déstructuration au lieu de retourner `{ ok: false, reason, message }`.

Un `after` inconnu peut également faire échouer la résolution d’un message post-séance dans `App.jsx`.

**Impact :** un fichier importé peut encore produire un crash plutôt qu’une erreur persistante et compréhensible.

---

### F3 - Régression d’affichage après le passage à la timeline datée - bug P1

`history()` dans [src/progression.js](../../src/progression.js) retourne notamment `date`, `si`, `kind`, `session` et `sets`, mais pas `week`.

`App.jsx` affiche pourtant une valeur équivalente à :

```jsx
Dernière fois (S{last.week}, {last.session})
```

Le résultat peut afficher `Sundefined` pour une séance précédente disponible.

**Impact :** défaut visible dans l’interface, non couvert par les tests actuels.

**Correction recommandée :** afficher la date réelle de la dernière séance, ou dériver explicitement la semaine à partir du modèle de données si cette information reste nécessaire.

---

### F4 - Le programme importé et l’onglet Plan ne décrivent pas nécessairement le même programme - dette fonctionnelle P1

[src/program.js](../../src/program.js) accepte un programme data-only personnalisé, mais [src/plan.js](../../src/plan.js) conserve du contenu éditorial spécifique au programme par défaut :

- structure fixe de 12 semaines ;
- volumes fixes ;
- noms de séances et d’exercices fixes ;
- textes cardio et nutrition spécifiques.

Le programme importé peut donc être correctement affiché dans l’onglet Séance tandis que l’onglet Plan présente des informations qui ne correspondent pas au programme actif.

**Impact :** incohérence fonctionnelle et risque de décision utilisateur fondée sur des informations erronées.

**Décision nécessaire :** soit rendre `buildPlan()` dépendant du bundle importé, soit limiter explicitement le contrat des programmes importables à ceux compatibles avec le contenu éditorial existant.

---

### F5 - La logique pure et le formatage restent mélangés à React - dette P2

Les éléments suivants restent dans [src/App.jsx](../../src/App.jsx) :

- `setSummary` ;
- `bilanText` ;
- la normalisation des séries ;
- les labels d’unités ;
- `weekRange` et le formatage de dates ;
- l’orchestration de `validate`, `loadProgram` et des notifications.

Le finding F4 de l’audit précédent est donc toujours valide.

**Impact :** tests unitaires difficiles sans rendre le composant et risque de régression lors des évolutions liées au cardio, aux programmes personnalisés et à la timeline.

---

### F6 - Le cycle de vie reste concentré dans les effets React - dette P2

L’extraction de [src/storage.js](../../src/storage.js) a correctement rendu `loadJournal` et `saveJournal` testables. Toutefois, `App.jsx` conserve :

- l’interprétation des verdicts ;
- la gestion de `storageOk`, `loadError`, `saveStatus` et `skipSave` ;
- le déclenchement des sauvegardes ;
- les toasts et leurs effets secondaires.

Le finding F2 de l’ancien audit est donc corrigé au niveau module, mais seulement partiellement au niveau intégration.

**Impact :** aucun test ne vérifie encore le comportement complet du composant après montage, migration, échec de backup ou échec de sauvegarde.

---

### F7 - Les notifications concurrentes peuvent s’effacer prématurément - bug UI P2

`showToast()` crée un `setTimeout` indépendant pour chaque appel :

```js
setToast(m);
setTimeout(() => setToast(""), 2500);
```

Si deux notifications surviennent rapidement, le premier timer peut effacer le second message avant son délai normal.

**Correction recommandée :** conserver l’identifiant du timer et annuler le timer précédent avant d’en programmer un nouveau, ou gérer le toast avec un petit hook dédié.

---

### F8 - Couplages et duplications résiduels - smell P2

Points secondaires encore visibles :

- la valeur `definition: null` est résolue à plusieurs endroits ;
- `validate()` reformate localement les charges au lieu de réutiliser `fmt()` ;
- les unités sont interprétées dans plusieurs branches indépendantes ;
- `loadProgram()` mélange la valeur capturée `journal` et l’état `j` de l’updater ;
- certains commentaires de tests mentionnent encore l’ancien état pré-timeline ou pré-registre.

Ces points ne justifient pas une intervention isolée, mais doivent être corrigés opportunément lorsqu’un module concerné est touché.

---

## 3. Écart avec l’audit du 9 septembre

| Finding précédent | État actuel |
|---|---|
| F1 - import pouvant accepter un programme qui plante | Corrigé en grande partie par les évolutions précédentes, mais validation imbriquée encore incomplète |
| F2 - stockage directement dans `App.jsx` | Corrigé au niveau de `storage.js`, intégration React encore non testée |
| F3 - littéraux de forme du programme dans `App.jsx` | Corrigé par l’extraction et les dérivations depuis le bundle |
| F4 - logique pure dupliquée dans `App.jsx` | Toujours présent |
| F5 - clés `w<week>_<session>` | Corrigé par la timeline datée ; `weekKey` reste utilisé pour cardio et check-in lorsque nécessaire |
| F6 - mémorisation invalidée par un objet `state` recréé | Corrigé par la mémorisation de l’état actif |
| F7 - petits défauts UI | Toast concurrent et mélange bilan/import encore présents ou partiellement présents |
| F8 - commentaires périmés | Principalement corrigé, mais des commentaires de tests restent obsolètes |

Nouveaux constats ou risques rendus visibles par les évolutions récentes :

1. affichage de `last.week` incompatible avec la structure datée ;
2. validation insuffisante de la forme complète du journal ;
3. divergence entre programme personnalisé et contenu éditorial de l’onglet Plan.

---

## 4. Couverture de tests et manques

### Zones bien couvertes

- [test/storage.test.js](../../test/storage.test.js) : verdicts de chargement, migration, backup et sauvegarde ;
- [test/schema.test.js](../../test/schema.test.js) : migrations, timeline et écritures ;
- [test/import.test.js](../../test/import.test.js) : raisons d’erreur et programme data-only ;
- [test/progression.test.js](../../test/progression.test.js) : progression sur le cycle ;
- [test/program.test.js](../../test/program.test.js) : bundle, cardio et dérivations ;
- [test/registry.test.js](../../test/registry.test.js) : intégrité du registre ;
- [test/plan.test.js](../../test/plan.test.js) : structure du contenu éditorial.

### Manques principaux

- aucun test de rendu ou d’intégration de `App.jsx` ;
- aucun test du montage avec un journal structurellement invalide ;
- aucun test de `lastEntry` jusqu’au texte affiché ;
- aucun test des callbacks `validate`, `loadProgram` et `importData` ;
- aucun test des toasts, timers et transitions de programme actif ;
- aucune vérification de cohérence entre programme personnalisé et onglet Plan ;
- pas de tests couvrant toutes les structures imbriquées malformées d’un programme importé.

---

## 5. Plan de refacto recommandé

### Étape 1 - Fermer les frontières de validation

Ajouter des validateurs purs et partagés pour :

- la structure du journal ;
- le programme actif ;
- les entrées de logs ;
- les tuples `session.ex` et `core.ex` ;
- les champs `after`, `day`, `reps`, séries et charges.

Les appeler depuis `loadJournal` et `parseJournalImport`, avec des verdicts typés et des raisons distinctes pour les données absentes, invalides ou incompatibles.

**Impact :** faible sur le format de stockage, fort gain de robustesse. Aucun changement de format nécessaire.

**Risque :** rejeter des journaux historiques actuellement tolérés. Les cas legacy doivent donc être couverts par des tests de compatibilité avant de durcir les validations.

---

### Étape 2 - Corriger et extraire les fonctions d’affichage

Créer un module pur pour :

- normaliser les séries ;
- produire `setSummary` ;
- construire `bilanText` ;
- formater les dates et la dernière séance ;
- calculer les lignes cardio conditionnelles.

Corriger simultanément l’utilisation de `last.week` en affichant la date réelle ou en dérivant explicitement la semaine.

**Impact :** moyen. Réduit `App.jsx`, rend les régressions testables et traite directement le bug d’affichage de la timeline.

**Risque :** faible si les fonctions conservent leur contrat actuel et si les textes existants sont figés par des tests ciblés.

---

### Étape 3 - Extraire l’orchestration du journal

Créer un hook ou contrôleur dédié pour :

- le chargement initial ;
- les états `loaded`, `storageOk`, `loadError` et `saveStatus` ;
- la sauvegarde différée ;
- l’import / export ;
- le backup et les notifications.

Le composant principal ne conserverait que l’état de navigation et le rendu.

**Impact :** moyen à élevé. Le comportement devrait rester identique, mais le cycle de vie deviendrait testable sans rendre toute l’interface.

**Risque :** modifier l’ordre des effets et déclencher une sauvegarde trop tôt. Ajouter des tests de séquence avant l’extraction.

---

### Étape 4 - Découper le rendu par onglet

Extraire les vues :

- Séance ;
- Semaine ;
- Bilan ;
- Plan.

Puis les composants transverses :

- `ExerciseCard` ;
- `CardioView` ;
- `Section`.

Cette étape doit venir après les étapes 1 à 3 afin d’éviter de déplacer la complexité sans réduire les responsabilités.

**Impact :** moyen. Améliore la lisibilité et limite le rayon des changements UI.

**Risque :** prop drilling et changement involontaire de l’identité des objets mémorisés. Les props publiques des composants doivent rester stables pendant l’extraction.

---

### Étape 5 - Décider le contrat des programmes personnalisés

Deux options sont cohérentes :

1. rendre `buildPlan()` entièrement dépendant du bundle importé ;
2. documenter et valider que l’import ne personnalise que les données consommées par l’onglet Séance, en conservant un Plan fixe.

**Impact :** fonctionnel et potentiellement majeur. Cette décision doit précéder une généralisation du générateur de programmes.

**Recommandation :** privilégier la première option à long terme, mais ne pas la mélanger avec une simple refacto structurelle. Elle doit faire l’objet d’une évolution fonctionnelle et de tests dédiés.

---

## 6. Options d’architecture

### Option A - Extraction minimale

Extraire uniquement quelques fonctions pures et composants.

- Avantage : risque faible et livraison rapide.
- Limite : `App.jsx` conserve l’orchestration complexe.
- Usage recommandé : correction immédiate de F3 et amélioration rapide de la couverture.

### Option B - Refacto progressive par domaine

Séparer validation, affichage pur, orchestration du journal et rendu UI dans cet ordre.

- Avantage : meilleur équilibre entre risque, testabilité et lisibilité.
- Limite : plusieurs petites étapes et davantage de modules.
- Usage recommandé : stratégie principale.

### Option C - Reducer ou store global complet

Centraliser les actions de journal, d’import, de navigation, de timer et de notifications.

- Avantage : modèle explicite si l’application devient une vraie machine à états.
- Limite : sur-architecture à ce stade et risque de régression plus élevé.
- Usage recommandé : ne pas retenir maintenant ; réévaluer après les étapes 1 à 3.

---

## 7. Recommandation finale

La priorité n’est plus une extraction mécanique de `App.jsx`. La priorité est de fermer les frontières de données et de corriger les régressions visibles avant de redistribuer le rendu.

Ordre recommandé :

1. corriger `last.week` et ajouter le test de régression ;
2. renforcer la validation structurelle du journal et des programmes importés ;
3. extraire les fonctions pures d’affichage et de résumé ;
4. extraire l’orchestration du cycle de vie du journal ;
5. découper les onglets et les composants UI ;
6. décider séparément du contrat fonctionnel de l’onglet Plan pour les programmes personnalisés ;
7. réévaluer seulement ensuite l’introduction d’un reducer.

Cette séquence conserve les gains déjà réalisés, traite d’abord les risques utilisateurs et évite de déplacer la complexité sans la réduire.

---

## Conclusion

Le code actuel est sensiblement plus robuste qu’au 9 septembre : le stockage, les migrations, la timeline et les dérivations du programme sont désormais mieux isolés. Les risques les plus importants ont changé de nature.

Les priorités sont maintenant :

- empêcher les données JSON syntaxiquement valides mais structurellement invalides d’atteindre le rendu ;
- corriger l’affichage issu de la timeline datée ;
- rendre explicite le contrat entre programmes personnalisés et contenu de l’onglet Plan ;
- poursuivre la réduction de `App.jsx` par extraction de logique pure avant de séparer les onglets.

La stratégie recommandée reste une refacto progressive par domaine, mais avec la validation des données et la correction de la régression timeline comme première étape.
