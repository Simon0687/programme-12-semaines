# Spec — Séance : un exercice actif, une action qui ne fuit pas (#66)

Issue : #66, `feat`, `priority: medium`. Épic *Design & lisibilité*.
Source : revue Claude Design du 2026-09-14 §1b, triée dans
`docs/reviews/2026-09-14-design-review-triage.md` (C4), plus l'usage de Simon
du 2026-09-24.

## Niveau : A

Matrice `.claude/WORKFLOW.md`. Q1 non — rien de ce qui est stocké ne change, et
`log.ex` se relit exactement pareil. Q2 non. Q3 **oui** : c'est la façon dont
une séance se parcourt qui change, pas une couleur ni une règle locale. →
**Niveau A**.

Pas de `design.md` séparé : le changement tient dans un composant
(`ExerciseCard`) et dans l'état d'un écran, et les décisions ci-dessous sont
exactement ce qu'un design.md aurait porté. Les arguments vivent aussi dans le
code, là où le prochain lecteur les trouvera.

## Le problème

Sept exercices dépliés en même temps, environ 2 500 px, et rien ne dit où on en
est. L'en-tête est collant depuis #41 ; l'action, non : « Valider la séance »
attend au bout du scroll. L'écran garde sa navigation sous les yeux et laisse
filer la seule chose qu'on vient y faire.

Entre deux séries, ce qu'on lit est un nombre. Il était écrit à la taille de la
phrase qui l'explique, sous trois lignes de prose.

## Ce qui était déjà livré

Trois des cinq points de §1b sont derrière nous (#42), et le triage les avait
réfutés depuis le code : les trois états de série (faite / en cours / à venir),
le minuteur qui se déclenche à la validation et occupe une bande collante. Les
rouvrir aurait été du travail perdu — il ne reste de la revue que C4 et 1b.2.

## Les décisions

### 1. Une carte repliée dit ce qu'elle a produit, pas ce qu'elle est

Faite : son résumé (`setSummary`, la forme bornée de #50) précédé d'une coche
verte. Commencée : « 2/3 séries » et le résumé. Pas commencée : « Prévu :
72,5 kg ». Jamais rien qui oblige à ouvrir pour savoir si on l'a faite.

Le compte passe par `completedSets`, sorti dans `display.js` avec `rowIsDone`.
**Deux définitions de « faite » coexistent dans l'app et les confondre serait le
bug** : le moteur dit qu'une série sans répétitions n'a pas eu lieu
(`normalizeSets`, #23) ; l'écran dit qu'une série est faite quand elle porte
toutes ses valeurs, charge comprise. La seconde est plus stricte à dessein — une
charge oubliée est une saisie à finir, pas une série de plus — et c'est elle que
la coche de #42 raconte depuis qu'elle existe. La sortir du composant est ce qui
garantit que « 2 séries sur 3 » et la coche de la troisième ne se contredisent
jamais.

### 2. Rien ne s'ouvre tout seul à la validation d'une série

Écarté : replier l'exercice terminé et ouvrir le suivant automatiquement. Une
série se valide, **puis** se corrige — c'est la règle de #42, « corriger, c'est
taper par-dessus ». Un écran qui se referme sous le pouce à l'instant où la
dernière série est validée reprend d'une main ce que #42 a donné de l'autre.

Ce qui est dérivé, en revanche, c'est **l'état d'ouverture initial** : tant que
personne n'a touché un en-tête, la carte ouverte est le premier exercice dont
les séries prescrites ne sont pas toutes remplies. Une séance reprise s'ouvre là
où on s'était arrêté, sans effet à synchroniser ni état à stocker. Dès qu'un
en-tête est touché, ce choix-là prime — et il porte l'identifiant de la séance,
si bien qu'en ouvrir une autre repart du calcul.

### 3. Le nom n'ouvre la fiche exercice que sur la carte ouverte

Sur une carte repliée, toute la ligne déplie. C'est le geste qu'on attend d'un
accordéon, et deux cibles empilées — un nom qui part vers une autre page sous le
pouce de quelqu'un qui voulait déplier — est le piège classique de ce motif. La
fiche (#17) reste à un tap sur l'exercice qu'on est en train de faire, ce qui
est le moment où on la consulte.

Substitution et minuteur disparaissent aussi de la carte repliée : ce sont des
gestes qu'on fait sur l'exercice en cours.

### 4. Le panneau de #43 vit dans la barre d'action, pas sous elle

La barre tient au-dessus des onglets (`bottom-14`, la barre d'onglets fait
56 px). Quand « séance plus légère que la précédente » se déclenche, le panneau
**remplace** le bouton exactement comme avant — seul l'endroit change. Deux
couches qui se disputent le bas de l'écran feraient précisément ce que cette
issue corrige, et la question de #43 doit rester la seule chose à faire à ce
moment-là.

Le contenu réserve sa place sous la barre (`pb-16`, `pb-64` quand le panneau est
ouvert) : une action fixe qui masque les notes de séance n'aurait rien réglé.

## Critères d'acceptation

- [x] Une séance de sept exercices montre sa structure entière sans scroller.
- [x] Une carte repliée dit son résultat (faite) ou sa prescription (à venir).
- [x] La charge prévue est le plus gros élément de la carte ouverte ; le
      « pourquoi » reste lisible sous elle.
- [x] L'action de validation est atteignable à n'importe quelle position de
      scroll, et le panneau de #43 la remplace au même endroit.
- [x] Corriger une série déjà validée reste possible — rien ne se replie tout
      seul.
- [x] `npm test` vert (908), dont le compte de séries faites épinglé dans
      `test/display.test.js`.

## Ce qui reste ouvert

La barre de progression du minuteur (§1b.5, la seule moitié non livrée de #42) :
le compte à rebours est un nombre, la revue voulait une barre qui se vide. Rien
ne s'y oppose, ce n'est simplement pas ce que cette issue traite.
