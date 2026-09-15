# Revue de design des 4 écrans — Claude Design (2026-09-14)

**Outil :** Claude Design (canvas `Revue de design.dc.html`)
**Projet :** « Application log de musculation », `38382bbc-b120-4ce1-ba6c-497ec9205f58`
**Modèle :** non communiqué par l'outil
**Design system employé pour les maquettes :** Nocturne (`_ds/nocturne-31046579…`)

## Ce sur quoi la revue s'est basée

Le `github.md` du projet Claude Design déclare :

- dépôt `Simon0687/programme-12-semaines`, branche `main` ;
- une seule lecture du dépôt, le 2026-09-14T20:25:14Z, portant sur `plan.js`,
  les maquettes `design/` et `input.css` ;
- « 3 incohérences de données repérées **dans les captures** » (c'est l'outil qui
  le dit).

Autrement dit : le contenu du Plan a été lu dans la source, tout le reste a été
jugé sur quatre captures d'écran longues prises à 22:12–22:13. `App.jsx`,
`ExerciseSheet.jsx`, `display.js` et `cardio.js` figurent dans sa table de
correspondance écran → fichiers, mais rien n'indique qu'ils aient été ouverts.
C'est la clé de lecture du triage
([docs/reviews/2026-09-14-design-review-triage.md](../../reviews/2026-09-14-design-review-triage.md)).

## Forme de ce document

Les six artboards du canvas (1a Semaine, 1b Séance, 1c Fiche exo, 1d Plan,
1e Plan › Progression, 1f Plan › Volume) sont des maquettes visuelles ; hors du
rendu, leurs libellés ne se lisent pas. Ce document reprend donc **la substance
argumentée** — principes, bugs annoncés, constats et correctifs — et laisse les
maquettes dans le canvas, qui reste consultable.

---

## Le système proposé

**Un seul accent.** « Aujourd'hui l'ambre, le vert et le blanc se disputent
l'œil. Nocturne est mono : l'accent ne marque que ce qui est vivant — le jour, la
charge prévue, la série en cours. Ce qui est fait passe en neutre avec une coche
fine. »

**Deux chiffres, pas un paragraphe.** « Entre deux séries tu lis la charge prévue
et la dernière fois. Le "pourquoi" se déplie. »

**Une hiérarchie réelle.** « Libellés de section en 10,5 px capitales espacées,
valeurs en 17–34 px. Aujourd'hui tout est à 14–16 px. »

**Le pouce d'abord.** « Cibles ≥ 44 px, actions primaires en bas d'écran, jamais
au bout d'un scroll de 3 000 px. »

## Les bugs annoncés

> **Bilan de la semaine** — « Sommeil moyen (h) » et « Énergie (1–5) »
> apparaissent deux fois, et « Rameur Z2 dimanche » est listé deux fois à
> l'identique.
>
> **Haut A, exercice 2** — les séries sont numérotées S1, S2, S2, S3.
>
> **Haut A, exercices 4 et 5** — prévu 20 kg et 7,5 kg, saisi 25 kg et 10 kg.
> L'écart est invisible à l'écran alors que c'est exactement ce que le moteur de
> progression va lire.

## 1a — Semaine

1. Trois métiers dans un seul scroll : la séance du jour, la checklist cardio, le
   bilan du dimanche. → le bilan devient une ligne qui ouvre son écran ; il ne
   pèse plus 1 000 px sous le pli.
2. « aujourd'hui » est une pastille de 60 px : rien ne dit ce que je fais
   maintenant. → carte du jour en tête, nom en 26 px, les deux charges clés, un
   bouton de 46 px.
3. 12 champs gris vides pour le cardio, étiquetés seulement par leur placeholder.
   → une ligne par séance, les champs n'apparaissent qu'au clic, étiquettes
   au-dessus et donc persistantes.
4. « 2 sur 5 validées » en gris 12 px à droite, et rien sur les 12 semaines. →
   compteur à points, et rail de 12 segments sous le titre (décharge S7 marquée).
5. Le prévu de la séance du jour n'est visible qu'après l'avoir ouverte. → les
   charges des deux premiers exercices remontent sur la carte.

## 1b — Séance

1. Les 7 exercices sont dépliés en même temps : 2 500 px, et rien ne dit où j'en
   suis. → un seul bloc actif ; les faits se replient sur une ligne avec leur
   résultat, les suivants sur une ligne avec leur prévu.
2. Trois lignes de prose au-dessus de chaque grille, alors qu'entre deux séries
   je lis deux chiffres. → « Prévu 28 kg » en 30 px, « dernière fois » à côté, le
   calcul derrière « Pourquoi 28 kg ».
3. Toutes les coches sont vertes, tous les champs identiques : la série en cours
   n'existe pas visuellement. → trois états — faite (neutre, coche fine), en
   cours (contour accent, 46 px), à venir (fantôme).
4. « Mettre à jour la séance » attend au bout du scroll. → barre d'action fixe en
   bas, au-dessus des onglets.
5. Le minuteur 2:30 est une pastille morte. → il se déclenche à la validation
   d'une série et occupe une bande avec sa progression.

## 1c — Fiche exercice

1. L'axe va de 68 à 72 : une progression de 2,3 kg dessine une fusée. → échelle
   fixe sur la fourchette de travail (60–80), et l'écart écrit en chiffres
   au-dessus de la courbe.
2. Records : un tableau à 3 colonnes pour une seule donnée, avec 200 px de vide.
   → trois cartes par nombre de reps, les non tentées visibles — elles disent
   quoi viser.
3. Trois barres ambre et grises pour 60/20/20 : la couleur dit « bien / moins
   bien » au lieu de dire « part ». → une barre empilée, une seule teinte en
   trois valeurs.
4. 10RM, Records, Historique, Technique, Détails : cinq titres au même poids, la
   page lit comme cinq pavés. → libellés en capitales 10,5 px, valeurs en
   19–36 px ; Technique et Détails repliés en bas.
5. Rien ne dit que cet exercice est une ancre des deux blocs, alors que ça change
   sa lecture. → trois étiquettes sous le titre.

## 1d — Plan

1. Un scroll d'environ 5 000 px, neuf sujets, aucun repère : on ne trouve pas
   « Nutrition » autrement qu'au pouce. → un sommaire de 8 lignes, chacune avec
   ce qu'elle contient ; le texte vit dans sa sous-page.
2. « Données : sauvegarde et restauration » est enterré sous la nutrition, en
   encadré ambre qui concurrence le bouton « Charger un programme ». → un bloc
   outil séparé en bas, deux actions au même poids, et la date de sauvegarde.
3. Les deux tableaux (semaines, volume) sont les seules choses lisibles de
   l'écran, et ils sont compressés. → ils deviennent le contenu principal de
   leurs sous-pages.
4. Un document de référence dans un outil de saisie : même typo, même densité que
   les écrans de séance. → sous-pages en mesure de lecture, interlignage 1,6,
   sous-titres.

## 1e — Plan › Progression

> Le paragraphe de tête faisait 90 mots et contenait quatre choses : la règle,
> quatre incréments, deux conditions d'échec, une note sur le calcul. La règle
> passe en 17 px contre un filet accent, les incréments deviennent un tableau,
> les conditions une liste. Aucun mot inventé, aucun mot perdu.
>
> « L'appli calcule la charge prévue à partir de tes séances validées » disparaît
> d'ici : c'est la réponse à « Pourquoi 28 kg » dans 1b, à lire là où la question
> se pose.
>
> La barre de pagination en bas enchaîne les sous-pages dans l'ordre du plan : on
> peut encore le lire en entier, mais par choix. Elle est hors du scroll — sur un
> texte de référence, un lien en fin de flux n'est jamais vu.

## 1f — Plan › Volume

> Tu dis que le Plan « affiche de la data ». C'est le seul endroit où il y en a
> vraiment : 11 groupes, un nombre de séries, et où elles se font. En tableau à
> trois colonnes serrées on lit des nombres ; en barres on voit d'un coup que les
> pecs sont à 8 et les triceps à 4 — c'est-à-dire la décision du point volume de
> fin de S4.
>
> Les valeurs sous 5 passent en teinte plus sombre du même accent : c'est le bas
> de la fourchette de volume, pas une autre couleur.

## Suites proposées par l'outil

« garde 1b mais montre tous les exercices dépliés » · « le rail des 12 semaines,
version plus lisible » · « dessine l'écran Bilan de 1a » · « autres directions
pour la fiche exo ».
