# Spec — Deloads and rotation driven by policy and signal (#14)

Issue : #14, `feat`. Épic *Planning & progression*. Réécrite le 2026-09-09
après une revue de conception ; absorbe #9.
Dépendances, toutes levées : #16 (timeline datée, pour `kind`), #25 (format
`program` data-only qui héberge `policies`).

## Niveau : A

Q1 — un journal déjà enregistré se lira-t-il autrement ? **Non, et c'est le
premier critère d'acceptation** : `DEFAULT_POLICIES` *est* la forme livrée, donc
un programme sans `policies` produit des charges identiques au centième. Q2 —
la donnée change-t-elle de forme ? **Oui** : `program.policies` naît, et le
check-in accueille deux champs. Q3 — refonte ? **Oui** aussi. → **Niveau A**,
avec l'override des modules sensibles (`progression.js`, `program.js`,
`journal-shape.js`).

## Le problème

La forme du cycle était un jeu de numéros de semaine compilés en flot de
contrôle, à cinq endroits indépendants : `phaseOf`, `blockOf`, `setsFor`, quatre
tests dans `planned()`, et la règle AMRAP de la semaine 12. **Rien ne le lisait
dans la donnée**, et quelqu'un qui décharge toutes les 4 semaines — ou jamais —
n'était pas représentable du tout.

Deux problèmes se cachaient derrière le premier :

1. **Décharge et rotation étaient fusionnées.** « Semaine 7 » voulait dire à la
   fois *coupe le volume* et *change de variante*, alors que l'un répond à la
   fatigue et l'autre au plateau. Laissés ensemble, quelqu'un qui décharge
   toutes les 4 semaines changerait aussi d'exercices toutes les 4 semaines.
2. **Un calendrier est de toute façon le mauvais déclencheur.** Les vrais
   critères sont déjà écrits dans l'onglet Plan de l'appli : performance qui
   baisse sur plusieurs exercices clés, sommeil dégradé, effort perçu qui
   dérive. Ce sont des signaux, pas des dates.

## Périmètre

**Dedans** — trois politiques, deux fonctions pures, la validation, la
recommandation et sa réponse, la séance test manuelle.

**Dehors**, et l'issue le dit elle-même : un DSL de règles, un plan persisté, un
ordonnanceur, des seuils par utilisateur avant qu'il y ait un second
utilisateur. `afterNSessions` / `afterNDeloads` restent une **forme réservée**,
acceptée par le validateur, non construite.

## Critères d'acceptation

- [x] La forme d'aujourd'hui est exprimable en politiques et produit des charges
      et libellés identiques — **`test/progression.test.js` non modifié**
- [x] L'AMRAP automatique de la semaine 12 est retiré ; une séance test se
      déclare à la main, écrit `kind: "test"`, et le moteur micro l'écarte
      comme une décharge
- [x] Un programme qui décharge toutes les 4 semaines coupe à chacune **sans
      faire tourner les exercices en même temps**
- [x] Un programme avec `deload: null` ne coupe jamais, jamais
- [x] `evaluateDeload()` est pure et testée sur des historiques fabriqués :
      régression, sommeil, cas combiné, sous le seuil, hystérésis
- [x] Une décharge recommandée peut être acceptée ou reportée, et le choix est
      enregistré
- [x] Une politique incohérente est refusée par le validateur, avec sa raison

## Impact données et stockage

- **`program.policies`** : nouveau, optionnel. Son absence se lit « la forme
  livrée », jamais « aucune politique » — c'est ce qui laisse tous les
  programmes déjà tenus continuer de décharger en semaine 7.
- **`checkin[date].deload`** et **`checkin[date].sommeilScore`** : deux champs
  sur un objet déjà libre, à côté de `poids` et `sommeil`. **Aucun champ de
  premier niveau, aucune migration, aucun bump de `SCHEMA_VERSION`.**
- **`kind: "test"`** : une valeur de plus dans un champ qui en portait déjà
  quatre.

## Questions ouvertes

Voir [`decisions-spec.md`](decisions-spec.md).
