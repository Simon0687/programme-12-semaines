# Spec — Move weekly cardio and check-in to dated records (#29)

Issue : #29, `feat`, `priority: later` → traitée le 2026-09-24. Épic *Cardio
improvement*. Suite directe de #16, qui l'avait explicitement laissée de côté.

## Contexte

`cardio[weekKey(week)]` et `checkin[weekKey(week)]` portent le défaut que #16 a
corrigé pour les séances : **ils sont indexés par un numéro de semaine relatif au
cycle, pas par une date.**

Reprendre un programme terminé avec une `startDate` rafraîchie remet le compteur
à 1, et l'entrée cardio de la semaine 1 du second passage **écrase celle du
premier**, en silence.

#16 l'avait laissé dehors à raison (`decisions-spec.md` Q2) : ni `planned()` ni
`history()` ne lisent `cardio` ou `checkin`, donc la justesse du moteur n'en
dépend pas. La conséquence est un affichage faux, pas un entraînement faussé.
Mais un affichage faux sur des mesures corporelles — poids, tour de taille,
sommeil — est exactement ce qu'on relit six mois plus tard pour juger d'un cycle.

## Niveau : A

Matrice `.claude/WORKFLOW.md`, première question et c'est plié.

**Q1 — un journal déjà enregistré se lira-t-il autrement ? Oui, et c'est le but.**
Les clés changent de nature. → **Niveau A**, avec migration et bump de
`SCHEMA_VERSION`.

L'override des modules sensibles s'applique aussi : `schema.js` est touché.

## Périmètre

**Dedans**

- La clé sous laquelle une entrée cardio et une entrée check-in sont écrites.
- La migration des journaux existants.
- Les quatre lectures d'`App.jsx` qui s'en servent (Semaine, Bilan, cardio,
  check-in).

**Dehors**

- **Le contenu des entrées.** Ni le cardio ni le check-in ne gagnent ou perdent
  un champ. Cette issue déplace une clé, elle ne redessine rien.
- **`id` / `updatedAt` / `deletedAt` sur ces entrées.** #16 les a posés sur les
  séances parce qu'une séance est un enregistrement qu'on crée, corrige et
  supprime. Une case cochée dans une checklist hebdomadaire n'a pas cette vie —
  voir `decisions-spec.md` Q2.
- **Passer au jour plutôt qu'à la semaine** — voir Q1. Ce serait un changement
  de produit, pas une correction.
- **Une affordance pour relire une semaine d'un cycle précédent.** La donnée
  cessera d'être écrasée ; la montrer est une autre issue.

## Comportement attendu

**Écriture**

Une entrée cardio ou check-in s'écrit sous la **date réelle du premier jour de
la semaine de cycle concernée** — `dateForSlot(startDate, week, 1)`. Deux
passages du même programme ont deux `startDate`, donc jamais la même clé pour
« semaine 1 ».

**Lecture**

Les quatre lectures d'`App.jsx` suivent. À `startDate` constante, l'appli affiche
exactement ce qu'elle affichait.

**Migration**

Un journal en v4 voit ses clés `w{n}` réécrites en dates, par programme, à partir
de la `startDate` que ce programme porte déjà (épinglée depuis #26). Aucune
donnée n'est perdue, aucune n'est déplacée d'une semaine.

## Critères d'acceptation

- [ ] Cardio et check-in sont stockés sous une date réelle, jamais `w{n}`.
- [ ] Deux passages du même programme ajoutent chacun leurs entrées ; rien n'est
      écrasé.
- [ ] Le cardio et le check-in d'un journal existant migrent automatiquement,
      dans la bonne semaine, sans intervention.
- [ ] `bilanText()`, Semaine et Bilan lisent juste de part et d'autre d'une
      frontière de cycle.
- [ ] Une copie du journal est déposée avant la réécriture (règle #8, déjà
      portée par `migrate()` / `backupOnce`).
- [ ] La migration est **idempotente** : la rejouer sur un journal déjà migré ne
      change rien.
- [ ] `npm test` en entier au vert.

## Impact données et stockage

- **`SCHEMA_VERSION` : 4 → 5.** C'est la définition même du cas : la lecture
  d'un journal existant change.
- **`cardio` / `checkin` : les clés, rien d'autre.** Les valeurs sont recopiées
  telles quelles.
- **`definition` : aucun impact.** La `startDate` est lue, jamais écrite.

## Cas limites

- **Un programme dont la `startDate` est invalide.** Les définitions des cycles
  *inactifs* ne sont pas validées au chargement (#32, Q2) : `dateForSlot` y
  rendrait `NaN-NaN-NaN`.
- **Une clé qui n'est pas `w{n}`.** Y compris une clé déjà datée — c'est ce qui
  rend l'idempotence possible.
- **Un cycle sans cardio ni check-in.** Les deux objets peuvent être vides.
- **Une semaine au-delà de `weeks`.** `w14` est écrivable aujourd'hui si on
  feuillette au-delà ; `dateForSlot` la convertit sans se plaindre, et c'est
  juste.

## Questions ouvertes

Deux. Voir [`decisions-spec.md`](decisions-spec.md).
