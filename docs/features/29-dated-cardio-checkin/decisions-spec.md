# Decisions — Dated cardio and check-in (#29)

Source : [`spec.md`](spec.md)
Statut : **tranché par Claude le 2026-09-24**, sur mandat d'autonomie. Les deux
réponses sont techniques plus que produit ; la seule qui engage un choix est Q1,
et elle se résout en lisant ce que la donnée est.

---

## Q1 — Une entrée par semaine, ou une par jour ?

L'issue laissait la question ouverte : « one entry per real week (or per day, to
be decided when this is designed) ».

**Recommandation : par semaine**, clé = la date du premier jour de la semaine de
cycle, `dateForSlot(startDate, week, 1)`.

L'argument n'est pas le coût, c'est **ce que ces données sont**. Le check-in
demande « poids **moyen** », « sommeil **moyen** » : ce sont des agrégats d'une
semaine, déjà. Les découper par jour ne les rendrait pas plus précis, ça poserait
une question à laquelle personne n'a répondu — que devient « poids moyen » quand
on le saisit un mardi ? — et il faudrait l'inventer pour migrer les journaux
existants, où l'information du jour **n'existe pas**.

Le cardio a l'air plus découpable depuis #34, qui donne un `day` à chaque séance
de conditionnement. Mais ce jour est **dans le programme**, pas dans le journal :
`ca[it.id]` est déjà indexé par séance de cardio, et chaque séance sait quel jour
elle tombe. La semaine est le conteneur, l'item porte le jour. Il n'y a rien à
gagner à dupliquer cette information dans la clé.

**Ce qui ferait changer d'avis :** un besoin de noter deux fois la même séance de
cardio dans la semaine, ou un check-in quotidien. Les deux seraient des
changements de produit, avec leur propre écran.

## Q2 — Ces entrées gagnent-elles `id`, `updatedAt`, `deletedAt` ?

L'issue le suggère : « apply the same shape to cardio and check-in entries ».

**Recommandation : non. Seule la clé change.**

#16 a posé ces champs sur les séances pour des raisons qui ne se transposent
pas :

| Champ | Pourquoi une séance en a besoin | Pourquoi pas ici |
|---|---|---|
| `id` | Deux appareils sans backend ne doivent jamais collisionner sur une clé engendrée | La clé **est** la date, dérivée de la donnée. Rien à engendrer, rien à faire collisionner |
| `updatedAt` | « Validée le … » s'affiche, et #40 a montré qu'un horodatage faux est indétectable | Rien n'affiche la date de saisie d'un check-in, et rien ne la demande |
| `deletedAt` | Une séance se supprime | Une case se décoche, un champ se vide. Il n'y a pas de suppression à tracer |

Ajouter trois champs « par symétrie » coûterait une forme à valider, à exporter
et à documenter, **pour aucun lecteur**. La note de l'issue — « réutiliser le
motif de #16 plutôt que d'en inventer un second » — parle du motif de *migration*
et d'indexation par date, et c'est celui-là qui est repris intégralement.

---

## Ce qui se décide ici

| | Question | Réponse |
|---|---|---|
| Q1 | Semaine ou jour ? | **Semaine**, clé = `dateForSlot(startDate, week, 1)` — c'est ce que la donnée est déjà |
| Q2 | Les champs de synchronisation de #16 ? | **Non.** Seule la clé change ; les trois champs n'auraient aucun lecteur |
