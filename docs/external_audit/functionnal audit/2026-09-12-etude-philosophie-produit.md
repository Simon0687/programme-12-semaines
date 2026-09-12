# Etude fonctionnelle - philosophie du produit et place de l'IA

## Date et statut

- Date : 2026-09-12
- Type : étude fonctionnelle et stratégique
- Statut : consultatif, à transformer en décisions via le workflow du projet
- Périmètre : code source, tests, documentation projet, documents de génération et mémoire Claude

Cette étude ne constitue pas une spécification technique et ne doit pas être
appliquée directement. Les recommandations retenues doivent devenir des issues,
puis passer par le niveau de documentation approprié.

## 1. Verdict

Le projet est cohérent avec une vision moderne et responsable de l'IA, à une
condition : l'IA ne doit pas être présentée comme l'autorité qui invente ou
modifie silencieusement l'entraînement.

La position la plus solide est :

> L'IA comprend et propose. L'application vérifie et mémorise. L'utilisateur décide.

L'application actuelle est déjà un carnet d'entraînement local, déterministe et
versionné. Elle n'est pas encore un carnet véritablement assisté par IA : le
bilan est copié dans un chat externe et la réponse de l'IA ne revient pas dans
une boucle d'adaptation contrôlée.

## 2. Philosophie proposée

Le produit devrait être défini comme un système fermé d'apprentissage de
l'entraînement :

```text
Intention et contraintes
        -> programme structuré
        -> séance réellement effectuée
        -> journal daté
        -> bilan hebdomadaire
        -> interprétation et options d'adaptation
        -> décision confirmée par l'utilisateur
```

L'IA intervient surtout pour le langage, le contexte et l'interprétation. Les
règles critiques restent calculées par le code.

### Ce que l'IA peut faire

- comprendre une demande formulée naturellement ;
- collecter le matériel, les priorités et les contraintes ;
- transformer une conversation en payload JSON ;
- expliquer une prescription ;
- interpréter plusieurs semaines d'historique ;
- formuler des hypothèses ;
- proposer plusieurs adaptations ;
- produire un programme conforme à un contrat fermé, puis corriger ses erreurs.

### Ce que l'IA ne doit pas faire seule

- inventer des exercices ou des identifiants ;
- calculer approximativement les volumes ;
- décider qu'une douleur est sans risque ;
- modifier le journal sans confirmation ;
- remplacer les règles de progression testées ;
- transformer une recommandation en décision persistante sans trace.

## 3. Pourquoi cette place de l'IA est cohérente

La société utilise de plus en plus l'IA comme interface générale : on lui
parle en langage naturel au lieu de remplir de nombreux formulaires. Le projet
peut tirer parti de cette évolution sans abandonner la vérifiabilité.

L'IA est particulièrement utile pour les informations difficiles à formaliser
par un formulaire :

- « j'ai une poulie basse, des haltères et un banc inclinable » ;
- « mon coude me gêne seulement sur les extensions » ;
- « je reprends après huit mois d'arrêt » ;
- « j'ai bien dormi mais mes performances chutent depuis deux séances ».

En revanche, les calculs de volume, d'espacement, de progression et de
compatibilité avec le registre sont des problèmes déterministes. Les confier à
un modèle de langage crée un risque inutile, même si le modèle reçoit les bonnes
règles dans son prompt.

Donner les règles à un LLM réduit le risque de compréhension, mais ne garantit
pas l'exécution correcte de boucles, de comptes et de contraintes cumulatives.
La validation post-génération en code reste donc obligatoire.

## 4. Architecture de confiance

La vision long terme issue de la mémoire Claude est un pipeline en trois
contrats :

1. payload du questionnaire ;
2. programme généré ;
3. définition chargée par l'application.

Ces contrats ne doivent pas être confondus. Une fréquence ou une durée saisie
par l'utilisateur peut être utilisée pour générer un programme, mais elle ne
remplace pas la définition que l'application exécute.

### Répartition recommandée

#### Niveau 1 : calcul et validation dans l'application

- registre fermé des exercices ;
- volumes par groupe musculaire ;
- plafond temporel ;
- espacement des séances ;
- exclusions articulaires ;
- cohérence des séries et répétitions ;
- validation du programme importé ;
- sauvegarde, migration et historique.

#### Niveau 2 : données fermées transmises au LLM

- identifiants d'exercices ;
- vocabulaire matériel ;
- groupes musculaires ;
- patterns ;
- contraintes acceptées ;
- cibles déjà calculées par l'application ;
- schéma JSON exact.

#### Niveau 3 : jugement confié au LLM

- choix entre deux exercices valides ;
- ordre ou association d'exercices ;
- reformulation de la méthode ;
- cas non couverts par le modèle ;
- explication personnalisée ;
- arbitrage à présenter à l'utilisateur.

## 5. Ce que le dépôt fait déjà bien

Les fondations techniques soutiennent cette philosophie :

- progression pure et testée dans [src/progression.js](../../../src/progression.js) ;
- journal daté et append-only dans [src/schema.js](../../../src/schema.js) ;
- migrations et sauvegardes pré-migration dans [src/storage.js](../../../src/storage.js) et [src/backup.js](../../../src/backup.js) ;
- registre fermé dans [src/registry.js](../../../src/registry.js) ;
- construction du bundle dans [src/program.js](../../../src/program.js) ;
- verdicts d'import typés dans [src/import.js](../../../src/import.js) ;
- fonctionnement local et offline documenté dans [README.md](../../../README.md).

La distinction micro/macro est également pertinente :

- micro : charge, répétitions et RIR séance après séance ;
- macro : volume, rotation, récupération et décharge.

La progression micro doit rester déterministe. L'intelligence plus avancée doit
se concentrer sur la macro.

## 6. Limites actuelles

### 6.1 L'IA est extérieure à la boucle produit

L'utilisateur remplit le bilan, le copie dans un chat et doit interpréter puis
réappliquer manuellement la réponse. Il manque :

- une réponse structurée ;
- une liste de constats ;
- des hypothèses avec niveau de confiance ;
- des recommandations séparées des décisions ;
- une confirmation explicite ;
- une trace de l'adaptation ;
- une portée de modification : série, séance, semaine ou cycle.

### 6.2 Le programme importé peut diverger de l'onglet Plan

Le programme chargé est dynamique dans [src/program.js](../../../src/program.js),
mais le contenu éditorial de [src/plan.js](../../../src/plan.js) reste spécifique
au programme actuel. Un programme personnalisé peut donc être exécuté dans
l'onglet Séance alors que l'onglet Plan décrit d'autres volumes ou exercices.

C'est un problème de confiance fonctionnelle, pas seulement de présentation.

### 6.3 La validation n'est pas encore une validation physiologique complète

La forme JSON et les références principales sont contrôlées, mais la génération
IA exige aussi de vérifier les six assertions du moteur :

- volume dans les fourchettes ;
- absence de pattern dupliqué dans une séance ;
- espacement suffisant ;
- durée compatible avec la demande ;
- exercice disponible et compatible avec le matériel ;
- thème annoncé cohérent avec les muscles réellement travaillés.

### 6.4 Le modèle de récupération n'est pas encore livré

Le registre contient les distributions musculaires nécessaires, mais
l'application ne calcule pas encore une fatigue par muscle, une récupération
avec décroissance temporelle ou une fraîcheur de séance.

### 6.5 Le sens des données doit être protégé

Le cas `definition: null` montre qu'un changement peut conserver la même forme
JSON tout en changeant la signification d'un historique. Avant de remplacer le
programme par défaut, il faut figer la définition historique dans les journaux
existants.

Règle générale :

> Toute valeur de repli dépendant du code courant peut réinterpréter un ancien journal.

## 7. Fonctionnalités recommandées

### Priorité 1 - Fiabilité

- valider complètement la structure des journaux ;
- durcir la validation des programmes imbriqués ;
- sauvegarder avant un import destructif ;
- corriger les affichages incompatibles avec la timeline datée ;
- rendre l'onglet Plan dépendant du programme actif ;
- ajouter des tests d'intégration minimaux.

### Priorité 2 - Durabilité locale

- exporter le journal vers un vrai fichier ;
- partager ce fichier avec la Web Share API ;
- afficher la date du dernier export ;
- rappeler l'export après une période configurable ;
- demander la persistance du stockage avec `navigator.storage.persist()` ;
- guider la restauration sur un nouvel appareil.

La durabilité ne nécessite pas de backend. Le backend ne devient nécessaire
que pour le multi-appareil ou le suivi de plusieurs personnes.

### Priorité 3 - Contrat IA

- générer un prompt prérempli ;
- transmettre le registre fermé et les vocabulaires ;
- recevoir un JSON versionné ;
- valider les six assertions dans l'application ;
- retourner des erreurs précises, recollables dans le LLM ;
- supporter une boucle de réparation ;
- demander une confirmation avant l'import.

### Priorité 4 - Expérience du carnet

- créer une vue « Aujourd'hui » ;
- afficher la dernière performance à côté de la cible ;
- préremplir la charge précédente ;
- proposer la charge calculée ;
- accélérer la saisie du RIR ;
- ajouter un historique par exercice ;
- distinguer mesures, sensations, contexte et décision souhaitée.

### Priorité 5 - Intelligence macro

- fatigue par groupe musculaire ;
- récupération temporelle ;
- détection de stagnation ;
- détection de signaux de décharge ;
- adaptation de volume ;
- rotation des variantes ;
- séance alternative selon les muscles récupérés.

## 8. Recommandation UI

L'assistant ne devrait pas être une bulle présente partout. Pendant une séance,
la latence et la saisie sont des contraintes fortes.

Structure recommandée :

- **Aujourd'hui** : prochaine action, séance du jour, durée et alertes ;
- **Semaine** : calendrier, progression, récupération et adaptations en attente ;
- **Bilan** : check-in, résumé automatique et analyse IA ;
- **Plan** : méthode, programme, historique des adaptations et données.

Actions rapides possibles pendant une séance :

- alléger les séries restantes ;
- remplacer le prochain exercice ;
- expliquer la charge prévue ;
- noter une douleur.

Ces actions doivent être des commandes explicites, pas une conversation longue.

## 9. Modèle de bilan IA recommandé

La réponse IA devrait avoir une structure stable :

1. **Constats** : faits tirés du journal ;
2. **Hypothèses** : interprétations, avec niveau de confiance ;
3. **Recommandations** : options possibles ;
4. **Impact** : ce qui changerait concrètement ;
5. **Validation** : confirmation de l'utilisateur ;
6. **Limites** : rappel qu'une douleur persistante relève d'un professionnel de santé.

L'IA ne devrait pas produire uniquement un paragraphe libre impossible à auditer.

## 10. Feuille de route

### Étape 1 - fermer les frontières de confiance

Validation complète, sauvegarde avant import, correction des divergences de Plan,
protection du sens historique et tests d'intégration.

### Étape 2 - rendre le carnet durable et agréable

Export fichier, vue Aujourd'hui, saisie rapide, historique par exercice et
résumé automatique.

### Étape 3 - livrer le contrat IA

Prompt prérempli, JSON versionné, validateur post-génération, boucle de
réparation et confirmation avant application.

### Étape 4 - ajouter l'intelligence macro

Récupération, stagnation, signaux de décharge et adaptations réversibles.

### Étape 5 - généraliser la génération

Résoudre les contradictions du moteur de génération, puis décider si le
programme est généré par un moteur déterministe externe ou par un LLM encadré
par le validateur.

## Conclusion

Le projet ne doit pas devenir une application qui remplace un coach par un
chatbot. Sa proposition de valeur est plus forte :

> Un système d'entraînement local, versionné et explicable, auquel l'IA apporte
> une interface naturelle, une capacité d'interprétation et des propositions
> d'adaptation contrôlées.

La priorité n'est donc pas de rendre le prompt plus spectaculaire. Elle est de
rendre le format, le registre, la validation et l'historique suffisamment
solides pour que l'IA puisse être utile sans devenir une source silencieuse
d'erreurs.
