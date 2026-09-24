# Decisions — Full pass on validation (#38)

Source : [`spec.md`](spec.md)
Statut : **tranché par Claude le 2026-09-24**, sur mandat d'autonomie.

Les quatre questions de l'issue, dans son ordre. **Deux reçoivent une réponse
négative** : l'issue proposait des simplifications que la mesure ne soutient
pas, et les forcer coûterait plus que l'encombrement qu'elles retirent. Dire non
avec la mesure fait partie du travail demandé — « une passe complète » n'est pas
« accepter la liste de courses ».

---

## Q1 — Le vocabulaire peut-il se réduire à ce sur quoi un appelant branche ?

**Non — mais la vraie question était ailleurs, et elle, oui.**

La prémisse est juste : rien dans l'appli ne branche sur `missing-field` vs
`invalid-field`. `App.jsx` ne branche que sur quatre valeurs, et toutes viennent
de `loadJournal`, pas de l'import : `too-new`, `invalid`, `corrupt`, `no-store`.

Mais `reason` n'est pas qu'une clé de branchement, c'est **la clé du message de
repli**. `IMPORT_MESSAGES[reason]` est ce qui s'affiche quand un rejet ne porte
pas de message propre, et l'éditeur s'en sert aussi (`saveDraft`). Fusionner
`missing-field` et `invalid-field` donnerait un seul message pour deux cas que
l'utilisateur distingue immédiatement — « il manque `startDate` » n'est pas « le
`startDate` que tu as écrit n'est pas une date ».

**Ce qui se réduit vraiment, et c'est le cœur de l'issue :** le vocabulaire n'est
pas trop large, il est **déclaré au mauvais endroit**. Les raisons sont produites
dans `journal-shape.js` et listées dans `import.js`. Rien ne relie les deux
listes, et c'est exactement comme ça qu'`unsupported-field` a survécu à #25 :
personne ne pouvait voir qu'il n'était plus émis.

**Décision :** le vocabulaire est déclaré **une fois**, là où les raisons sont
produites, et un test vérifie la bijection dans les deux sens — aucune raison
déclarée qui ne soit émise, aucune raison émise qui ne soit déclarée. Une raison
morte devient alors impossible à garder, au lieu d'attendre qu'on la remarque
deux issues plus tard.

C'est « un vocabulaire, un endroit » au sens propre du titre de l'issue, et c'est
plus fort que d'en retirer deux entrées à la main.

## Q2 — `not-a-program` et `invalid-program` sont-elles la même chose ?

**Non.** L'issue dit « deux raisons pour ce qu'un lecteur appellerait la même
chose ». Leurs messages disent l'inverse :

| Raison | Message | Ce que la personne doit faire |
|---|---|---|
| `not-a-program` | « Ce fichier ne décrit pas un programme. » | tu t'es trompé de fichier |
| `invalid-program` | « Le catalogue d'exercices custom (`program`) est mal formé. » | ton fichier est le bon, une ligne dedans est fausse |

Ce sont deux actions différentes. Les fusionner ferait lire « ce fichier ne
décrit pas un programme » à quelqu'un dont le programme est bon à une faute de
frappe près — et il irait chercher un autre fichier au lieu de corriger celui-là.

**Ce que l'issue a correctement repéré, c'est que les deux *noms* se
confondent**, pas les deux notions. Mais renommer une raison touche une trentaine
d'assertions de tests pour un identifiant que personne ne voit à l'écran ; le
gain est nul et le risque ne l'est pas. La confusion se règle là où elle se
produit : **en documentant les deux dans la déclaration unique de Q1**, côte à
côte, avec ce qui les sépare.

## Q3 — Les trois fonctions de forme se fondent-elles en moins ?

**Non, et c'est la décision que je défendrais le plus longtemps.**

Elles n'ont pas des « responsabilités qui se recouvrent » : elles tournent à
trois **moments** différents, sur trois **données** différentes, à trois
**sévérités** différentes. Chacune existe parce qu'un bug précis l'a exigée.

| Fonction | Quand | Sur quoi | Si elle échoue |
|---|---|---|---|
| `validatePreMigration` | **avant** `migrate()` | la donnée **brute** | le journal est refusé — sinon ses cycles disparaissent en silence (#32) |
| `validateEnvelope` | après `migrate()` | la donnée **migrée** | le journal est refusé — sinon l'appli reste bloquée sur son spinner (#32) |
| `validateProgramEntry` | à la lecture d'un cycle | **une** entrée | fatal si c'est le cycle actif, simple non-sélection sinon (#32 Q3) |

Les fondre demanderait de choisir un moment, une donnée et une sévérité.
**Chacun des trois choix rouvrirait un bug documenté**, et le troisième
casserait l'exigence 3 de l'issue — la sévérité graduée, qu'elle demande
elle-même de préserver. La liste « ce qui doit survivre » et la liste « ce qui
devrait fusionner » se contredisent ; la mesure tranche en faveur de la
première.

Il reste vrai qu'elles ont été ajoutées une par une et que rien ne les présente
ensemble. **Décision :** elles restent trois, et le tableau ci-dessus entre dans
l'en-tête du module. Ce qui manquait était une vue d'ensemble, pas une fusion.

## Q4 — `loadJournal` doit-il porter le détail au lieu de l'aplatir ?

**Oui, sans réserve. C'est la seule vraie perte d'information de la chaîne.**

73 rejets distincts, chacun avec un chemin JSON et la règle enfreinte, arrivent
dans `loadJournal` et en ressortent tous en `reason: "invalid"`, message jeté.
Le panneau Données ne peut dire que « ton journal a été refusé ».

C'est doublement dommage : le message existe déjà, il est déjà écrit pour être
lisible, et l'exigence 4 de l'issue dit qu'il doit être **adressable** —
c'est-à-dire collable quelque part avec assez d'information pour agir. Un
message produit puis jeté au dernier mètre ne l'est pour personne.

**Décision : `loadJournal` ajoute `detail`, et ne change rien d'autre.** La
raison coarse reste ce qu'elle est, donc les quatre branches d'`App.jsx` ne
bougent pas d'une ligne — ce qui est aussi la garantie que ce changement ne peut
pas casser le chemin de chargement. Le détail est un **ajout**, jamais un
remplacement.

---

## Ce qui se décide ici

| | Question | Réponse |
|---|---|---|
| Q1 | Réduire le vocabulaire ? | **Non — le déclarer une fois**, là où il est produit, avec un test qui interdit la divergence |
| Q2 | Fusionner les deux raisons confusables ? | **Non**, elles appellent deux actions différentes. Les documenter côte à côte |
| Q3 | Fondre les trois fonctions de forme ? | **Non** — trois moments, trois sévérités, trois bugs. Un tableau dans l'en-tête, pas une fusion |
| Q4 | Faire remonter le détail ? | **Oui.** Le seul endroit où de l'information est réellement perdue |

**Ce que ça retire, honnêtement.** Une raison morte, une liste dupliquée, et la
possibilité qu'elles reviennent. Pas 200 lignes. L'issue demandait « less of
it » ; la mesure dit que les 61 contrôles de champ sont ce que l'exigence 4
achète, et qu'il n'y a pas de gras ailleurs. Une passe qui rend moins que promis
en le démontrant vaut mieux qu'une passe qui atteint son chiffre en retirant des
garde-fous.
