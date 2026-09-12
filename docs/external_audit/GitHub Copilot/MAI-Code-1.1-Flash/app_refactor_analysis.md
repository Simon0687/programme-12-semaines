# Audit externe — refonte de App.jsx

## IA
- Nom : GitHub Copilot
- Modèle : MAI-Code-1.1-Flash

## Contexte
Le point de friction principal du projet est actuellement [src/App.jsx](../../src/App.jsx). Il agit comme un monolithe qui mélange plusieurs responsabilités :

- chargement et migration du journal
- stockage local
- import et validation de définition
- sélection du programme actif
- calcul du cycle actuel (semaine / jour / session)
- génération de la vue de séance
- gestion du timer, des inputs, des cartes, des sauvegardes et du rendu global

Les modules déjà bien séparés montrent une architecture saine en cours de clarification :

- [src/program.js](../../src/program.js) : construction du bundle actif
- [src/storage.js](../../src/storage.js) : persistance et lecture
- [src/schema.js](../../src/schema.js) : migration / identité du journal
- [src/import.js](../../src/import.js) : validation des imports
- [src/progression.js](../../src/progression.js) : logique de charge, historique et planification
- [src/plan.js](../../src/plan.js) : contenu éditorial du plan

Le point clé est que App n’a plus besoin de connaître les détails de fond ; il a besoin d’orchestrer l’état et la vue.

---

## Diagnostic principal

### Problèmes constatés
- App gère l’état métier et la vue dans le même bloc.
- Il réintroduit des dérivations déjà calculées ailleurs.
- Il contient des effets de bord, des timers, des imports, des sauvegardes et le rendu UI dans un seul fichier.
- Plusieurs champs portent des responsabilités de “state machine” alors qu’ils devraient être dans un module de domaine ou un hook dédié.

### Points positifs
- Le découpage fonctionnel est globalement bon.
- La logique pure est déjà propre dans [src/progression.js](../../src/progression.js), [src/program.js](../../src/program.js), [src/import.js](../../src/import.js).
- L’architecture de données est assez solide pour permettre une extraction modulaire sans remise à zéro totale.

---

## Recommandation stratégique

Je recommande une refonte en 3 couches :

1. State / domain layer
   - journal
   - programme actif
   - définition
   - sélection de session / semaine / jour
   - état de chargement
   - timer
   - UI state local (onglet, import, notifications)

2. Service / adapter layer
   - stockage
   - import
   - migration
   - timing
   - persistance

3. View / UI layer
   - rendu des tabs
   - sections
   - cartes d’exercice
   - formulaires
   - boutons et interactions locales

Le but n’est pas une réécriture radicale, mais une extraction progressive avec des frontières nettes.

---

## Plan détaillé de refacto

### Phase 0 — définir la frontière avant de toucher le rendu
Objectif :
- arrêter d’ajouter de la logique dans App
- définir clairement les responsabilités à extraire

Actions :
- créer un module “app state” ou “session model”
- identifier les sous-ensembles d’état :
  - journal
  - programme actif
  - définition
  - sélection de session / semaine / jour
  - statut loaded / saveStatus / storageOk
  - timer state
  - UI state (onglet, toast, texte importé)

Impact :
- faible sur l’UX
- fort sur la lisibilité
- réduit le risque de régression

Questions ouvertes :
- garder un simple objet state dans App ou passer à un reducer ?
- vaut-il la peine d’ajouter un store dédié maintenant ou plus tard ?

Recommandation :
- commencer par un objet state structuré
- éviter un store global trop tôt
- n’introduire un reducer que si la complexité devient manifeste

---

### Phase 1 — extraire le state de session et le cycle actuel
Objectif :
- sortir de App la logique de calcul de la semaine active, du jour, de la session et des dates

À extraire :
- calcul START / dayIdx / currentWeek / weekday
- sélection de la session active
- logique de “programme courant”
- logique de “définition active”

Nouveau module probable :
- app-session.js ou cycle-state.js

Impact :
- faible en UI
- fort en testabilité
- très bon pour réduire les bugs de dérivation

Question ouverte :
- faut-il garder les dérivations purement mathématiques dans le module de progression ou les faire dans l’état ?

Recommandation :
- garder les calculs purement mathématiques dans les modules de domaine
- laisser App composer l’orchestration et la vue

---

### Phase 2 — extraire les effets de bord de chargement et de sauvegarde
Objectif :
- séparer “chargement du stockage” de “rendu UI”

À extraire :
- chargement du journal depuis storage
- écriture du journal
- gestion de l’état load/save
- gestion du backup
- migration initiale et statut de stockage

Approche :
- conserver [src/storage.js](../../src/storage.js) comme fondation
- créer un module d’orchestration comme app-load.js ou app-persistence.js

Impact :
- fort sur la robustesse
- faible sur l’UI
- réduit les effets de bord cachés dans App

Question ouverte :
- faut-il garder les notifications dans App ou les centraliser dans un layer dédié ?

Recommandation :
- garder les toasts dans App
- extraire seulement la logique métier de persistance

---

### Phase 3 — extraire la logique d’édition de séance
Objectif :
- faire de la vue d’édition une mini-machine à état

À extraire :
- doneMap
- logique de mise à jour du journal
- propriété d’une ligne de série
- reconstruction d’une séance à partir d’un slot
- validation du journal et sauvegarde des changements

Pourquoi c’est important :
- c’est la zone la plus dense et la plus sujette aux erreurs
- elle mélange plusieurs niveaux de logique à la fois

Impact :
- moyen à fort
- excellent pour la testabilité
- réduit le risque de régression sur la semaine, la date et le journal

Question ouverte :
- l’édition de séance doit-elle être un composant autonome ou un hook dédié ?

Recommandation :
- un hook dédié est le bon niveau intermédiaire
- cela évite de gonfler un store global sans nécessité

---

### Phase 4 — extraire les composants UI et leur logique associée
Objectif :
- rendre le rendu plus lisible sans casser l’UX

À extraire :
- cartes d’exercice
- section de séance
- logique de plan / last / phase / status
- rendu conditionnel selon l’état de progression

Impact :
- fort en clarté
- faible en risques si fait par extraction pure
- très utile pour réduire le fichier App

Question ouverte :
- faut-il garder les fonctions de planification dans App ou les déplacer vers un “view model” ?

Recommandation :
- garder la logique d’état dans les modules de domaine
- laisser le composant gérer uniquement :
  - présentation
  - mapping de props
  - interaction locale

---

### Phase 5 — extraire les onglets et le shell applicatif
Objectif :
- App ne doit plus contenir le détail de chaque onglet

À extraire :
- onglet Séance
- onglet Plan
- onglet Journal
- onglet Import / Export
- sections de stats / cardio / check-in

Impact :
- très fort sur la lisibilité
- faible sur la logique métier si la séparation est bien faite
- améliore la maintenance sur le long terme

Question ouverte :
- garder un App avec sous-composants statiques ou ajouter une arborescence par onglet ?

Recommandation :
- garder un shell App + sous-composants par onglet
- sans introduire un système de routing complexe

---

### Phase 6 — réévaluer la nécessité d’un reducer
Quand :
- dès que les actions métier dépassent la simple gestion d’état local

Exemples d’actions :
- loadJournal
- setWeek
- selectSession
- saveEntry
- importProgram
- deleteBackup
- setTimer

Si ces actions deviennent nombreuses, un reducer peut être pertinent.

Impact :
- fort sur la qualité de code
- risk moyen de refonte
- à introduire avec prudence

Recommandation :
- ne pas faire maintenant
- attendre le point où l’état devient en effet une machine à états compliquée

---

## Options comparées

### Option A — refactor minimaliste
Avantages :
- très peu de risque
- rapide à exécuter
- utile immédiatement

Inconvénients :
- App reste central
- la dette technique réapparaît vite
- la complexité visuelle reste élevée

### Option B — refactor par domaine
Avantages :
- bon équilibre entre clarté, sécurité et vitesse
- sépare les responsabilités sans réécrire tout le projet
- correspond bien à l’architecture existante

Inconvénients :
- nécessite un peu de discipline sur les interfaces
- plus de fichiers à maintenir

### Option C — refactor complet avec reducer / store / architecture globale
Avantages :
- très propre sur le long terme
- excellent si l’app grandit

Inconvénients :
- trop lourd pour le niveau actuel
- plus de risques sur un projet déjà fonctionnel
- demande une phase de migration longue

Recommandation :
- privilégier l’Option B, avec une progression prudente et sans “big bang”

---

## Questions ouvertes à clarifier avant de démarrer

1. Veut-on une refonte “juste de structure” ou “préparer le prochain gros feature” ?
2. Le but est-il d’optimiser la lisibilité pour Claude / l’équipe, ou d’ouvrir la voie à de nouvelles fonctionnalités ?
3. Faut-il garder une architecture React simple sans store global ?
4. Priorité : supprimer la logique UI de App ou simplifier le state ?
5. Faut-il préparer un futur hook reducer ou rester sur un objet state simple ?

---

## Recommandation concrète

Je ferais cette séquence :

1. Extraire le state de cycle / session / semaine
2. Extraire la logique de persistance
3. Extraire l’édition de séance
4. Refactor UI des tabs et cards
5. Réévaluer le besoin d’un reducer après les 3 premiers blocs

C’est la bonne progression parce qu’elle :

- réduit le risque
- garde les modules existants valides
- simplifie App sans casser le flux de travail
- apporte des gains visibles dès le premier bloc

---

## Analyse d’impact par update

### Update 1 — extraction du state cycle
Impact :
- très faible sur l’UI
- fort sur la compréhension du code
- faible sur les composants
- excellent pour les tests

Risques :
- dérivation de dates / semaines / jours mal migrées
- confusion entre state UI et state métier

---

### Update 2 — extraction de la persistance
Impact :
- fort sur la fiabilité
- moyen sur l’UX
- faible sur le rendu
- très bénéfique pour la maintenance

Risques :
- mauvaise gestion des états “no-store”, “corrupt”, “too-new”
- sauvegarde perdue si le chemin backup est mal géré

---

### Update 3 — extraction de l’édition de séance
Impact :
- fort sur la stabilité fonctionnelle
- fort sur la qualité des tests
- moyen sur l’UI
- très utile car cette zone est précisément la plus sensible aux bugs

Risques :
- mauvaise migration de la logique d’édition
- perte d’identité des logs ou de la clé date / slot

---

### Update 4 — extraction des composants UI
Impact :
- fort sur la lisibilité
- fort sur la maintenance
- faible sur la logique métier
- faible sur les risques si les props restent stables

Risques :
- sur-division des responsabilités
- effets de bord sur le drilling de props

---

### Update 5 — reduction / store global
Impact :
- fort sur l’architecture
- potentiellement disruptif
- à faire seulement si la complexité l’exige vraiment

Risques :
- sur-architecture
- perte de vitesse / surcoût inutile

---

## Premier livrable concret recommandé

Je commencerais par :

- extraction de l’état de cycle
- extraction de la logique de persistance
- validation ciblée sur les tests existants

Puis seulement après :

- extraction de l’édition de séance
- extraction des tabs / composants

C’est le meilleur compromis entre “réécriture” et “réorganisation saine”.

---

## Conclusion

Le vrai problème n’est pas un bug fonctionnel unique, mais un symptôme architectural : [src/App.jsx](../../src/App.jsx) est devenu le container de tout. La bonne direction est de faire des extractions progressives, sans traumatiser le projet, et en gardant les modules de logique pure déjà bien assemblés.

La refonte la plus juste pour le code actuel est donc :

- extraire le state de cycle,
- extraire la persistance,
- extraire l’édition des séances,
- puis réévaluer le besoin d’un reducer.

C’est la voie qui maximise la qualité sans sur-investir dans une architecture trop lourde pour le contexte actuel.
