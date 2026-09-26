# Décisions — Plan de repli dynamique (#120)

Source : spec.md
Périmètre : choix produit/exigences uniquement (pas de choix d'implémentation
— ceux-là suivront dans decisions.md, une fois design.md écrit).
Statut : en attente des réponses de Simon

## Q1 — Calculé à la génération, ou recalculé à l'affichage ?

**Question.** Le plan de repli doit-il être une donnée figée au moment où le
programme est généré (comme `program.volume`, produit une fois par
`volumeTable()` dans `generator.js:551`), ou une fonction pure recalculée à
chaque ouverture du Plan à partir de `SESSIONS` et du registre (comme
`cardioSection()` dans `plan.js:166`, qui relit `program.cardio` et le
registre à chaque rendu) ? Si rien n'est tranché, l'implémentation improvise
et le choix devient accidentel plutôt que voulu.

**Option A — Baked à la génération, comme `volume`**
- Ce que ça veut dire : `generator.js` calcule l'ordre de repli des séances et
  des exercices une fois, et l'écrit sur `program.fallback` (structuré, pas
  du texte) au moment où `toProgram()` construit le reste du programme.
- Implications : suit le précédent exact de `volumeTable()` — même endroit,
  même style d'appel. `plan.js` n'a qu'à lire la donnée et produire le texte,
  sans logique de calcul.
- Pour : cohérent avec `volume` et les charges de départ, qui sont déjà
  "cuites" à la génération ; aucune dépendance au registre au moment de
  l'affichage du Plan (plus rapide, plus simple à tester).
- Contre : un programme généré avant un changement de règle de calcul ne se
  met pas à jour tout seul — il faudrait régénérer pour voir la nouvelle
  logique s'appliquer (comme pour `volume` aujourd'hui, ce n'est pas un
  problème nouveau).

**Option B — Fonction pure à l'affichage, comme `cardioSection`**
- Ce que ça veut dire : `program.fallback` n'existe pas ; `plan.js` calcule
  l'ordre de repli à la volée depuis `SESSIONS` et le registre à chaque appel
  de `buildPlan()`.
- Implications : une nouvelle fonction dans `plan.js`, pas de nouveau champ
  sur `program`. Un programme importé (sans passer par le générateur)
  bénéficie automatiquement du calcul, sans rien stocker.
- Pour : toujours à jour si la règle de calcul change ; couvre gratuitement
  le cas "programme importé" (l'un des cas limites de la spec).
- Contre : casse le parallèle avec `volume`, qui reste une donnée figée sur
  le même objet `program` — deux sections voisines ("Ce programme") avec deux
  philosophies de calcul différentes.

**Recommandation.** Option A pour la partie stable (priorité de séance,
priorité d'exercice) — elle suit exactement le précédent `volume`, donc reste
lisible à côté de `volumeTable()`. Mais la règle de non-répétition (dépend du
journal, donc jamais connue à la génération) ne peut pas être bakée : elle
doit rester une fonction appliquée au moment de l'affichage, qui combine
`program.fallback` (l'ordre baké) avec le dernier niveau de repli lu dans le
journal. Réversible sans douleur : si Option A s'avère fausse, migrer vers B
ne change que `generator.js`/`plan.js`, aucun format de journal n'est en jeu.

**Décision de Simon :** Hybride confirmé. Ordre de priorité figé à la
génération (comme `volume`) ; la règle de non-répétition et le choix du
niveau applicable à une semaine donnée restent calculés dynamiquement à
partir du journal, dans tous les cas — cette partie n'était de toute façon
pas figeable (2026-09-26).

## Q2 — Critère de tie-break entre séances à couverture égale

**Question.** Si deux séances couvrent des groupes musculaires jugés
équivalents (aucune n'est structurellement "unique" sur un groupe), laquelle
saute en premier au premier niveau de repli ?

**Option A — Ordre de déclaration dans `SESSIONS`**
- Ce que ça veut dire : à égalité, on coupe la première séance dans l'ordre
  où `generator.js` les construit (boucle sur `session` à `generator.js:609`).
- Implications : déterministe et reproductible sans donnée supplémentaire ;
  suit le même principe que `secondBlock()` (`generator.js:571`), qui fait
  déjà tourner les isolations par ordre d'id dans le pool.
- Pour : zéro nouvelle donnée, cohérent avec un précédent déjà dans le
  fichier.
- Contre : arbitraire du point de vue utilisateur (pourquoi Haut B avant
  Haut C ?) — mais l'énoncé du problème dit déjà qu'à ce niveau les séances
  sont équivalentes, donc l'arbitraire ne coûte rien de réel.

**Option B — Alternance semaine après semaine**
- Ce que ça veut dire : à égalité, le choix change d'une semaine réduite à
  l'autre, pour répartir l'usure entre séances équivalentes.
- Implications : nécessite de lire l'historique du journal même pour ce
  cas — logique supplémentaire, alors que la règle de non-répétition (Q1)
  couvre déjà "ne pas répéter la même séance sacrifiée deux fois de suite".
- Pour : perçu comme plus juste sur le long terme.
- Contre : redondant avec la règle de non-répétition déjà prévue dans la
  spec — cette dernière traite déjà le cas où une séance a été coupée la
  semaine passée.

**Recommandation.** Option A. La règle de non-répétition (déjà dans la spec)
couvre le vrai problème pratique ; ajouter une alternance en plus serait de
la complexité sans bénéfice mesurable, pour un cas qui — par construction —
n'a pas d'ordre "juste" a priori. Réversible : changer le tie-break ne touche
qu'une fonction interne, aucune donnée stockée.

**Décision de Simon :** Option A confirmée (2026-09-26).

## Q3 — Plancher sur le nombre de niveaux de repli

**Question.** La spec écrit "N-1 niveaux, jusqu'à 1 séance". Faut-il un
plancher (ex. ne jamais descendre sous 2 séances), ou l'algorithme va-t-il
naturellement jusqu'à 1 séance sans cas particulier à coder ?

**Option A — Pas de plancher, on descend jusqu'à 1 séance**
- Ce que ça veut dire : le dernier niveau de repli fusionne tout dans une
  séance unique, mécaniquement, sans règle spéciale.
- Implications : aucun code de garde supplémentaire ; le cas limite "1 seule
  séance/semaine" de la spec devient juste "le dernier niveau, et le seul".
- Pour : plus simple, un seul chemin de calcul pour tous les niveaux.
- Contre : une seule séance qui tente de couvrir tous les groupes peut
  devenir très longue (aucune limite sur son volume) — mais c'est un
  problème de contenu de la séance, pas de la logique de repli elle-même.

**Option B — Plancher à 2 séances**
- Ce que ça veut dire : le repli s'arrête à 2 séances minimum, jamais 1.
- Implications : une règle explicite en plus ("si N-k < 2, s'arrêter à 2"),
  sans justification dans les exemples fournis par Simon (qui vont jusqu'à
  "2 séances, Haut C + full body" — jamais jusqu'à 1).
- Pour : évite une séance fourre-tout hypothétiquement trop longue.
- Contre : règle inventée sans exemple réel qui la motive.

**Recommandation.** Option A. Aucun exemple donné par Simon n'a besoin d'aller
jusqu'à 1 séance, mais coder un plancher arbitraire sans cas d'usage serait
de la spéculation. Si l'usage réel montre qu'une séance à 1 niveau est
ingérable, le plancher s'ajoute alors facilement (une condition en plus dans
la même fonction) — décision réversible à faible coût.

**Décision de Simon :** Option A confirmée (2026-09-26).

## Q4 — Fusionner une séance intacte, ou recomposer depuis plusieurs séances ?

**Question.** L'exemple de départ de Simon (4→3 séances) ne supprime pas une
séance en gardant l'autre intacte : "tirage + jambes" combine des exercices
venant à la fois d'une séance Haut (tractions, rowing) et de la séance
Jambes. Le calcul de repli doit-il se limiter à "garder une séance entière /
en supprimer une autre", ou recomposer une séance composite à partir des
exercices prioritaires de plusieurs séances ?

**Option A — Garder une séance intacte, supprimer l'autre entièrement**
- Ce que ça veut dire : à chaque niveau de repli, une liste "gardée/
  supprimée" par séance, sans toucher au contenu de celles qui restent.
- Implications : calcul simple (pas de recomposition d'exercices), mais ne
  reproduit pas le comportement réel de Simon.
- Pour : le plus simple à calculer et à tester.
- Contre : ne correspond pas à l'exemple qui a motivé cette issue — la
  séance jambes de Simon absorbe des exercices d'une autre séance plutôt que
  de rester seule.

**Option B — Recomposer une séance fusionnée depuis les exercices
prioritaires de plusieurs séances**
- Ce que ça veut dire : au niveau de repli concerné, prendre les exercices
  les plus prioritaires (règle de Q du design : `type`/`cout_systemique`,
  déjà actée pour la priorité d'exercice) parmi les séances qui se
  rapprochent, et les assembler en une séance composite à volume borné.
- Implications : réutilise la règle de priorité d'exercice déjà décidée,
  mais l'applique à travers plusieurs séances plutôt qu'à l'intérieur d'une
  seule — une extension du même mécanisme, pas une nouvelle règle. Reste à
  fixer en design : combien de séries au total vise la séance composite.
- Pour : correspond exactement à l'exemple réel qui a lancé cette réflexion.
- Contre : légèrement plus de travail de calcul, mais sans nouvelle
  mécanique à inventer.

**Recommandation.** Option B — c'est ce que montre l'exemple concret de
Simon, et ça ne fait qu'étendre une règle déjà actée plutôt que d'en ajouter
une nouvelle. Réversible : revenir à A plus tard ne changerait qu'une
fonction de composition, aucune donnée stockée.

**Décision de Simon :** Option B confirmée (2026-09-26).

## Piste pour une suite séparée (hors scope de #120)

En travaillant Q1, Simon a évoqué un besoin plus large : un conseil "vivant"
qui, en cours de semaine, lirait combien de séances ont déjà été validées et
recommanderait *maintenant* quoi prioriser pour le reste de la semaine
(distinct du texte de référence générique que #120 produit). Ça toucherait
l'onglet Semaine, pas seulement la section Plan de repli — candidat pour une
issue séparée, à spécifier après #120.

## Comment appliquer

Une fois les trois décisions remplies, elles se reportent dans spec.md :
retirer les questions résolues de "Open questions" (qui devient "None"), et
noter les choix retenus dans "Impact données et stockage" (Q1) et "Cas
limites" (Q2/Q3).
