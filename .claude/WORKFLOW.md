# Workflow adapté à ce projet

Adapter l'intensité de documentation selon le type d'issue.

---

## La règle simple

| Type d'issue | Approche | Documentation |
|---|---|---|
| **Niveau A** — structurel/données | spec → decide → design-tech → code → tests | Complète |
| **Niveau B** — bug/refactor local | brief spec → code → tests | Légère |
| **Niveau C** — micro-correction | code → tests | Inline seulement |

**Un niveau qu'on n'arrive pas à trancher est un niveau A.** Pas de « B ou A
selon », pas de « plutôt B ». L'hésitation est le signal, pas un inconfort à
dissiper.

---

## Matrice de décision

Dans cet ordre. La première réponse OUI fixe le niveau.

### Q1 : Un journal déjà enregistré se lira-t-il différemment après ce changement ?
- OUI → **Niveau A**
- NON → Q2

C'est la question la plus importante, et la plus facile à rater : elle ne
parle pas de la *forme* de la donnée mais de son *sens*. Une donnée stockée
peut n'être qu'une référence au code courant — `definition: null` dans un
journal ne contient pas un programme, il pointe vers le bundle du moment
(`App.jsx`, `definition || DEFAULT_DEFINITION`). Changer le bundle
réinterprète alors tout l'historique **sans toucher un seul octet de sa
forme**.

Repérer les endroits concernés : tout `??`, tout `||`, tout défaut ou repli
sur le chemin de lecture est un point où la donnée stockée emprunte son sens
au code actuel. `buildProgram()` lit `definition.program ??
DEFAULT_DEFINITION.program` ; `MIGRATIONS[1]` écrit `definition: null`.

### Q2 : La donnée change-t-elle de forme ou de persistance ?
- OUI → **Niveau A**
- NON → Q3

### Q3 : Est-ce une refonte architecturale ou une nouvelle compétence du système ?
- OUI → **Niveau A**
- NON → Q4

### Q4 : Le comportement peut-il impacter plusieurs modules ou casser une régression ?
- OUI → **Niveau B** (spec courte)
- NON → **Niveau C**

---

## Override : les modules sensibles

**Cette règle gagne sur le tableau des niveaux et sur Q4.** Toute
modification de `schema.js`, `storage.js`, `progression.js`, `program.js`,
`import.js` ou `default-program.js` est **au minimum Niveau B**, et Niveau A
dès que Q1, Q2 ou Q3 répond OUI — y compris si le changement se présente
comme un « refactor local » ou un « simple contenu de données ».

Motif : ces modules portent le journal et la progression. Une fonction
retouchée dans `progression.js` peut changer silencieusement toutes les
charges suggérées, sans rien casser de visible.

---

## Niveau A : documentation stricte

**Quand :**
- Changement de format de donnée (programme, journal, bilan)
- Migration de schéma ou de stockage
- Nouvelle fonctionnalité touchant à la progression ou à la persistance
- Refactor d'un module sensible (voir l'override ci-dessus)
- Changement d'architecture ou de contrat global
- **Tout changement qui modifie la lecture d'un journal existant**, même sans
  changer sa forme

**Processus :**
1. Spec (quoi, pourquoi, contraintes)
2. Décisions architecturales (`decisions.md`)
3. Design technique (`design.md`)
4. Code, sur une branche partant de `dev`
5. Tests de régression + intégration

**Livrables :**
- Documents dans `docs/features/N-slug/`
- Code commenté sur les invariants
- Tests couvrant les cas limites
- Bump de `SCHEMA_VERSION` si la lecture d'un journal existant change

---

## Niveau B : spec courte + code

**Quand :**
- Bug de logique bien isolé
- Correctif de validation ou de calcul
- Refactor local (une fonction, un composant) hors module sensible
- Test ajouté pour verrouiller un comportement
- Amélioration d'UX sans impact sur les données

**Processus :**
1. Brief de 2-3 lignes dans le corps du commit
2. Code
3. Tests de régression

---

## Niveau C : code direct

**Quand :**
- Typo ou micro-correction sans logique
- Assertion ou garde-fou
- Correctif de style ou de lisibilité
- Cleanup mineur

**Processus :**
1. Code
2. Tests si pertinent

---

## Exemples de ce projet

| Issue | Niveau | Raison |
|---|---|---|
| #25 : registre fermé d'exercices | **A** | Le format de programme change, impact progression |
| #26 : programme par défaut neutre | **A** | Q1 : `definition: null` re-lie tout l'historique au nouveau bundle. La forme ne bouge pas, le sens si |
| #29 : cardio hebdo + check-in | **A** | Nouvelle dimension, impact journal + persistance |
| #20 : durcissement de `parseProgramImport` | **B** | Logique de validation, aucun journal existant relu autrement |
| #28 : progression de charge | **B** | Calcul cadré, mais `progression.js` → override, minimum B |
| Correctif de message d'erreur | **C** | Aucun impact |
| Typo dans l'UI | **C** | Aucun impact |

---

## Le cas #26, à garder comme étalon

#26 ressemblait à du Niveau B : 44 lignes de contenu dans un fichier de
données, aucun format touché, aucune migration écrite. Traité comme du B, il
a mis `dev` à 33 tests en échec sur 155 et détaché l'historique de son
programme. Le rattrapage tenté ensuite — une table d'alias ancien slot →
nouveau slot — faisait retomber deux anciennes séances sur la même
(`hautB` j3 et `hautC` j5 → `upperB` j4) et rendait la seconde inatteignable.

Ce que l'ancienne matrice demandait (« la donnée change-t-elle de forme ? »)
répondait **non**, correctement. C'est pour cela que Q1 a été ajoutée devant.

---

## À retenir

- **La donnée stockée change-t-elle de sens ? → A**, même si sa forme ne bouge pas
- **Module sensible ? → B minimum**, quelle que soit l'apparence du changement
- **En doute ? → A.** C'est une règle, pas un conseil
- **Valider avec `npm test` en entier** avant tout commit final, toute clôture
  d'issue et tout push — jamais sur les seuls fichiers de test qu'on vient de
  toucher
