# Spec — First launch: a new athlete meets someone else's week 1 (#19)

Issue : #19, `feat`, `priority: medium`. Épic *Programme configurable*.
Réécrite le 2026-09-17 : le pack LLM est mort avec Q1 = B, et ce qui survit
tient en une phrase.

## Contexte

> Un nouvel athlète atterrit toujours à l'intérieur de la semaine 1 de
> quelqu'un d'autre, sans que rien ne le dise.

#26 a réglé la fuite de données — le bundle n'est plus le programme de Simon,
c'est un Upper/Lower neutre sans profil ni charges de départ. Mais il reste **un
programme que l'athlète n'a pas choisi**, sur une `startDate` qu'il n'a pas
fixée, avec un compteur de semaines qui avance déjà.

Et depuis le 2026-09-15, l'appli sait générer. Elle ne le propose simplement pas
au moment où c'est utile.

## Niveau : A

Matrice `.claude/WORKFLOW.md`, dans l'ordre.

**Q1 — un journal déjà enregistré se lira-t-il autrement ? Non**, et c'est
démontrable. Tout ce que cette issue touche ne s'applique qu'au cas où *il n'y a
pas de journal* (`loadJournal` rend `reason: "absent"`). Depuis #26, un journal
stocké porte sa définition épinglée : `DEFAULT_DEFINITION` n'est lu par aucun
chemin de relecture — les seuls usages hors tests sont l'état initial de
`App.jsx` et le repli de `profile` dans `import.js`.

**Q2 — la donnée change-t-elle de forme ou de persistance ? Oui.** Ce qui s'écrit
au premier enregistrement change : aujourd'hui c'est fatalement le bundle, avec
une date de départ figée dans le fichier. → **Niveau A.**

## Périmètre

**Dedans**

- Ce que voit un appareil qui n'a jamais ouvert l'appli.
- Comment l'appli sait qu'elle est à son premier lancement.
- La date de départ du programme fourni, quand il finit par être utilisé.
- La confirmation qu'aucun artefact de distribution n'est requis (Q4).

**Dehors**

- **Messages de validation prêts à coller** — #38 possède le vocabulaire de
  validation depuis sa réécriture.
- **Générer le cardio** — #34 `decisions-spec.md` Q3 : le moteur continue
  d'émettre `cardio: null` tant que générer du conditionnement n'est pas tranché
  pour soi-même.
- **Tout pack, prompt ou artefact d'IA externe.** Mort avec Q1 = B. Ne pas en
  faire renaître un par effet de bord.
- **Supprimer un cycle.** L'appli n'en a aucun moyen, et c'est un fait qui pèse
  dans la décision Q1 — mais l'affordance est une autre issue.
- **Un second passage d'accueil.** L'accueil est un événement unique ; le
  rejouer à la demande est un réglage, donc un écran de réglages, donc ailleurs.

## Comportement attendu

**Premier lancement, appareil vierge**

L'athlète voit un écran d'accueil **avant** tout cycle, qui lui propose
explicitement d'obtenir le sien. Il n'est pas posé dans une semaine 1 qu'il n'a
pas choisie, et rien n'est écrit en stockage tant qu'il n'a pas choisi.

**Les routes offertes**

Les trois qui existent déjà dans Plan — générer, composer, charger un fichier —
plus la possibilité assumée de **regarder d'abord**, qui est la seule façon de
rendre l'écran honnête : une app dont la valeur est invisible tant qu'aucun
programme n'existe doit laisser voir à quoi elle ressemble.

**Ce qui est écrit, et quand**

Rien au premier affichage. Le journal n'existe en stockage qu'après un geste
— un programme enregistré, ou le choix explicite de partir sur celui fourni.

**Le programme fourni, s'il est retenu**

Sa semaine 1 est celle qui commence, pas celle de septembre 2026. Aujourd'hui la
`startDate` est figée dans `public/programs/upper-lower-4j.json` : un appareil
ouvert en décembre affiche « Les 12 semaines sont terminées » sur un programme
que personne n'a commencé (#39 rend la phrase juste, ce qui rend le bug
visible).

**Lancements suivants**

Inchangés, au pixel près. Un journal existe, l'appli ouvre l'écran mémorisé.

## Critères d'acceptation

- [ ] Appareil qui n'a jamais ouvert l'appli → l'athlète se voit proposer
      d'obtenir **son** programme avant d'être placé dans un cycle qu'il n'a pas
      choisi.
- [ ] **Aucun champ stocké en plus** : ce qui détecte le premier lancement le
      détecte du journal qui existe déjà. Pas de bump de `SCHEMA_VERSION`, pas
      de booléen « onboarded ».
- [ ] Le programme fourni, s'il est retenu, démarre au prochain lundi — jamais
      dans le passé, jamais « terminé » avant d'avoir commencé.
- [ ] Un journal déjà stocké ouvre l'appli exactement comme avant : aucun écran
      d'accueil, aucun changement de date, aucun geste de plus.
- [ ] Stockage indisponible (`no-store`) → ce n'est **pas** un premier
      lancement. L'appli avertit déjà ; l'accueil réapparaîtrait à chaque
      ouverture.
- [ ] Un journal illisible (`corrupt`, `invalid`, `too-new`) → **pas** un
      premier lancement non plus. Le message de récupération existant tient
      l'écran ; proposer de générer par-dessus un journal qu'on refuse d'écraser
      serait une invitation à détruire.
- [ ] `npm test` en entier au vert.

## Impact données et stockage

- **`SCHEMA_VERSION` : aucun.** Le premier lancement est un verdict de
  chargement, pas un état stocké.
- **`DEFAULT_DEFINITION` : inchangée sur disque.** La date de départ se calcule
  à l'usage ; figer une date dans un fichier livré est précisément le défaut.
- **Journal : rien de neuf.** Ce qui change est *quand* la première écriture a
  lieu, pas ce qu'elle contient.

## Cas limites

- **Stockage indisponible** — chaque ouverture ressemble à un premier
  lancement. Traité par le critère ci-dessus.
- **Journal refusé** (`too-new`, `corrupt`, `invalid`) — il existe, il est
  simplement illisible. L'accueil ne doit pas s'y substituer.
- **Accueil quitté sans rien choisir, puis saisie d'une série.** Le geste écrit
  un journal ; il porte donc le programme fourni, avec sa date recalculée.
- **Appli rouverte le lendemain** après avoir enregistré un programme : journal
  présent, pas d'accueil.
- **Le prochain lundi tombe aujourd'hui.** `nextMonday()` rend le jour même —
  c'est déjà le comportement de `emptyDraft()`, et il ne change pas ici.

## Questions ouvertes

Les quatre de l'issue. Voir [`decisions-spec.md`](decisions-spec.md).
