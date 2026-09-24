# Spec — Coverage before frequency when slots run out (#61)

Issue : #61, `fix`, `priority: low`. Épic *Programme configurable*.
Trouvée en construisant #60 — **mesurée, pas prédite**.

## Niveau : B

Matrice `.claude/WORKFLOW.md`. Q1 non (aucun journal stocké ne se relit
autrement : un programme généré est une définition, épinglée à l'écriture).
Q2 non. Q3 non — c'est une règle d'allocation qui change, pas une compétence.
Q4 **oui** : la sortie du moteur change sur une partie de la matrice, et
`test/generator.test.js` porte un contrat global. → **Niveau B**, spec courte.

`generator.js` n'est pas dans les modules sensibles de l'override (schema,
storage, progression, program, import, default-program).

## Le problème

À deux séances par semaine, le moteur laissait les deltoïdes latéral et
postérieur **sans aucun exercice**, sur les deux presets et à toutes les durées.
#60 devait le corriger et ne l'a pas fait : la cause n'est pas le plancher de
fréquence, c'est **l'ordre dans lequel les créneaux sont distribués**.

Douze créneaux offerts (2 × `MAX_EXERCISES`), quatorze demandés. `planSlots()`
servait dans l'ordre de `PRIORITY` en donnant à chaque muscle **tous** les
créneaux qu'il voulait avant de passer au suivant : les six premiers prenaient
les douze, et les deux deltoïdes — derniers de la liste — n'avaient rien.

## La question, et la réponse

> Qu'est-ce qui vaut le plus quand les créneaux manquent : une deuxième séance
> pour un muscle qui en a déjà une, ou une première pour un muscle qui n'en a
> aucune ?

**Une première pour tout le monde.** Un muscle sans exercice est un trou dans la
semaine ; un muscle servi une fois au lieu de deux est une fréquence basse. Les
six assertions signalent les deux, mais la seconde se rattrape la semaine
suivante — la première, non.

**Avec une restriction que la première version du correctif n'avait pas, et qui
a été ajoutée sur mesure.** « Couverture d'abord » appliqué partout dégradait
**18 combinaisons**, dont plusieurs en faisant annoncer « épaules » à une séance
qui n'en travaillait plus (assertion 6 — une fausse annonce, pas une fréquence
basse). La règle ne se déclenche donc que quand l'allocation d'origine a
**réellement** laissé quelqu'un dehors : c'est la lettre de la question posée,
« quand les créneaux manquent ». Quand ils ne manquent pas, il n'y a aucun
arbitrage à rendre, et en rendre un sans conflit est ce qui cassait le reste.

Le test est exact, pas approché : on ne compare pas une demande totale à une
capacité totale — la contrainte est par séance et par `focus` — on **exécute**
l'allocation d'origine et on regarde si elle a laissé un trou.

## Le prix, et pourquoi il est annoncé

Couvrir tout le monde se paie : à 2 × 60, biceps et triceps passent de deux
séances à une. Les six assertions le signalent, et le contrat du moteur est
**« aucun signalement que le rapport n'ait annoncé lui-même »**.

Le rapport gagne donc une troisième liste, `underFrequency`. L'en-tête du module
dit « ce qui n'a pas eu de créneau est déclaré, pas oublié » ; ce qui en a eu
**moins qu'il n'en fallait** relève de la même règle. Sans elle, l'avis de Plan
signalerait une fréquence basse que rien n'expliquerait.

## Ce que ça change, mesuré sur les 180 combinaisons

| | avant | après |
|---|---|---|
| Combinaisons générées | 171 | 171 |
| Total de constats des six assertions | 216 | **177** |
| Combinaisons avec un muscle non couvert | 75 | **57** |

**27 combinaisons changent, 0 se dégrade, 144 sont identiques.** Toutes les
combinaisons qui changent sont à **2 séances** (2 × 60, 2 × 75, 2 × 90, sur les
trois presets et les trois niveaux) — exactement le format que l'issue nomme.

`underFrequency` est non vide sur 39 des 171 générées (les 27 ci-dessus plus 12
à 3 séances, où l'allocation d'origine servait déjà court sans le dire). 14
d'entre elles passaient jusqu'ici sans écran de rapport et s'y arrêtent
désormais, avec une phrase vraie à lire.

## Critères d'acceptation

- [x] Aucun muscle à cible non nulle laissé sans créneau pendant qu'un autre en
      tient deux pour une cible qui tient dans un
- [x] Les combinaisons re-mesurées, et celles qui changent listées
- [x] `generate()` garde son contrat : aucun signalement que le rapport n'ait
      annoncé — `underFrequency` est ce qui le maintient vrai
- [x] `npm test` en entier au vert (838)

## Ce qui reste hors de portée

Le deltoïde latéral au **poids du corps** reste non couvert, et ce n'est pas une
allocation : le registre n'a aucun exercice primaire pour lui sans matériel
(mesuré en #59). Aucune règle de distribution ne donne ce qui n'existe pas. Le
rapport le déclare, et un test le dit explicitement pour que les deux causes ne
se confondent jamais.
