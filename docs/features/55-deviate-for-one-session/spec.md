# Spec — Deviate from the program for one session (#55)

## Contexte

Deux gestes de salle, relevés par Simon le 2026-09-15 :

> « la machine de press est prise, je passe au bench, mais la séance prochaine je
> veux reprendre la machine de press »

> « un jour je suis chaud, je veux ajouter une série »

Aucun des deux n'est une modification de programme, et c'est ce qui les rend
impossibles à exprimer aujourd'hui : les deux seuls leviers sont l'éditeur (#36),
qui change **toutes** les semaines restantes, et rien.

Le coût de passer par l'éditeur n'est pas théorique. Les trois jointures
documentées dans `docs/data-model.html` lient une séance enregistrée à son
programme par `(date, slot)` et par l'identifiant d'exercice : changer
l'identifiant d'une séance, son jour ou la fourchette de reps d'un créneau relit
des séances déjà faites sous un programme sous lequel elles n'ont jamais été
exécutées. Une machine prise vingt minutes ne doit pas coûter ça.

Issue : #55, `feat`, `priority: medium`. Sort de la discussion Q2 de #36.

## Niveau : A

Matrice `.claude/WORKFLOW.md`. Q1 — un journal déjà enregistré se lira-t-il
autrement ? **Non**, et c'est démontrable : la marque de substitution est absente
de tout journal écrit avant cette issue, et « absente » se lit « aucune
substitution », ce qui est exactement ce qui s'est passé. Q2 — la donnée
change-t-elle de forme ? **Oui**, la ligne de séance gagne un champ. → **Niveau A**.

## Périmètre

**Dedans**

- Remplacer l'exercice d'un créneau **pour une séance et une seule**.
- Ajouter une série au-delà de ce que le programme prescrit.
- Montrer les deux à l'écran, et les retrouver à la réouverture de la séance.
- Ce que le bilan hebdomadaire en dit.

**Dehors**

- **#36 Q2** — l'éditeur peut-il toucher un cycle commencé. Cette issue existe
  précisément pour que la question redevienne tranchable, en retirant du besoin
  d'édition les deux tiers qui n'en étaient pas.
- **Retirer une série** — déjà acquis. `validate()` écrit `done: true` avec ce
  qui est rempli, et `normalizeSets()` (#23) écarte toute série sans répétitions :
  une ligne laissée vide n'a pas eu lieu. Rien à faire.
- **Changer la fourchette de reps ou le repos d'un créneau pour un jour.** Un
  autre besoin, une autre issue : ce qui est prescrit n'est pas ce qui est fait,
  et la fourchette est ce sur quoi le moteur juge.
- **Proposer un remplaçant.** Le registre porte `pattern` et `muscles`, donc la
  matière existe ; suggérer est une décision de moteur, pas d'écran.

## Comportement attendu

**Séance**

- Sur une carte d'exercice, une affordance « remplacer » ouvre le sélecteur du
  registre (#36) et pose l'exercice choisi **sur ce créneau, pour cette séance**.
- La carte porte alors une marque visible : on doit voir qu'on a dévié, pas le
  déduire. Une déviation qu'on ne voit pas est une déviation qu'on oublie, puis
  qu'on met en doute en relisant son historique six semaines plus tard.
- La carte annonce toujours la prescription du créneau (fourchette, RIR) ; c'est
  la charge prévue qui change, parce qu'elle est celle du remplaçant et se lit
  dans **son** historique à lui.
- Une commande ajoute une série au-delà des séries prescrites.

**Semaine suivante**

- Le même créneau, la semaine d'après, propose l'exercice prescrit. La
  substitution ne survit pas à la séance, par construction : elle vit sur la
  ligne de journal d'une date.

**Fiche exercice (#17)**

- Les séries faites sur le remplaçant nourrissent la progression **du
  remplaçant**, et apparaissent dans sa propre fiche, sans rien de particulier :
  `history()` lit `rec.ex[vid]` par exercice, pas par créneau.
- L'exercice prescrit n'a simplement aucune entrée à cette date. C'est la lecture
  juste : il n'a pas été fait.

**Bilan**

- Un créneau clé substitué nomme le remplaçant. Aujourd'hui la ligne
  disparaîtrait entièrement — `keyLines` rend `null` faute de séries sous
  l'identifiant prescrit — et une ligne absente se lit « pas fait », ce qui est
  faux.

## Critères d'acceptation

- [ ] Séance en cours, exercice prescrit impossible → un autre exercice du
      registre fermé se choisit **pour cette séance seulement**, et l'occurrence
      suivante du même créneau revient au prescrit.
- [ ] Séance validée après substitution → les séries sont stockées sous
      l'identifiant du remplaçant, et `definition` est **inchangée octet pour
      octet**, avant comme après.
- [ ] Séance rouverte après substitution → le remplaçant et ses séries
      s'affichent, pas l'exercice prescrit avec des champs vides.
- [ ] Une série de plus que prescrit se saisit, et compte dans la charge de
      travail comme les autres.
- [ ] La semaine suivante, la prescription est identique à ce qu'elle aurait été
      sans la déviation.
- [ ] Un exercice substitué est visiblement marqué comme tel sur l'écran Séance.
- [ ] `definition` ne gagne aucun champ. La ligne de séance en gagne un, et un
      journal qui ne le porte pas se lit exactement comme aujourd'hui.
- [ ] `npm test` en entier au vert, y compris les cas de `journal-shape` sur la
      forme des lignes de séance.

## Impact données et stockage

- **`definition` : aucun.** C'est ce qui rend l'issue bon marché, et c'est la
  propriété à ne pas perdre en chemin.
- **Ligne de séance : un champ.** `ex` est indexé par identifiant d'exercice
  (`src/schema.js`), donc les séries d'un remplaçant sont déjà stockables telles
  quelles, dans la même ligne, sans rien de neuf. Ce qui manque est
  l'**appariement créneau → remplaçant**, que `ex` seul ne porte pas.
- **Séries supplémentaires : rien du tout.** `onSet()` fait déjà croître le
  tableau jusqu'à l'index qu'on lui donne (`while (rows.length <= i) rows.push({})`).
  Seul le rendu plafonne, à `setsFor(n, week)`.
- **`SCHEMA_VERSION` : voir `decisions-spec.md` Q1.** L'absence du champ est
  univoque, donc la question est de savoir si un bump se justifie pour un champ
  dont l'absence dit la vérité.

## Cas limites

- **Deux substitutions dans la même séance.** Deux machines prises le même jour.
  C'est ce cas qui départage les deux réponses de Q1.
- **Substituer par un exercice déjà présent dans la séance.** Le créneau A passe
  sur l'exercice du créneau B : `ex[vid]` porterait alors les séries des deux
  créneaux mélangées, et la fiche exercice compterait une séance de dix séries.
- **Substituer un créneau clé en S12**, où la dernière série est AMRAP.
- **Un remplaçant sans charge de départ**, donc en paliers : `planned()` rend
  « Paliers » et non une charge, ce qui est le comportement juste.
- **Un remplaçant d'une autre unité** — remplacer un développé (`kg`) par des
  pompes (`bw`) change les colonnes de saisie en cours de séance.
- **Rouvrir une séance substituée après avoir édité le programme** (#36) : la
  variante du créneau a pu changer entre-temps.

## Questions ouvertes

Les quatre de l'issue, plus une cinquième que la mesure fait apparaître. Voir
[`decisions-spec.md`](decisions-spec.md).
