# Design technique — First launch (#19)

Source : [`spec.md`](spec.md), [`decisions-spec.md`](decisions-spec.md).

**Écart de process assumé.** Le code a précédé ce document de quelques minutes —
les décisions produit étaient prises, et la mécanique s'est révélée plus courte
que prévu. Ce qui suit est donc le compte rendu des choix techniques, pas leur
anticipation. Le seul qui méritait vraiment d'être écrit avant est la décision 3,
et c'est celui qui a été découvert en codant : il aurait dû l'être ici.

---

## Décision 1 — `src/onboarding.js`, deux fonctions pures, aucun écran

`isFirstLaunch(res)` et `startingNow(definition, today)`. Le module ne connaît ni
React ni le stockage : il juge un verdict de chargement et produit une
définition. C'est ce qui rend les deux règles testables sous `node --test`, sans
moteur de rendu, et c'est la convention de tout ce qui vit sous `App.jsx`.

Il importe `nextMonday` de `program-editor.js` plutôt que de réécrire le calcul.
Les deux modules répondent à la même question — d'où part un cycle qu'on crée
maintenant — et un cycle fourni n'a aucune raison de démarrer autrement qu'un
cycle composé à la main.

## Décision 2 — Le premier lancement n'est jamais stocké

`isFirstLaunch()` lit `reason === "absent"`, que `loadJournal()` rend déjà. Le
critère d'acceptation « aucun champ stocké » n'a demandé aucun travail : la
donnée répondait à la question.

La conséquence à tenir en tête : **cet état ne survit pas à un rechargement.**
Si l'athlète recharge la page sans avoir rien choisi, l'accueil réapparaît — ce
qui est correct, puisque rien n'a été décidé ni écrit.

## Décision 3 — Au premier lancement, le premier programme *remplace* le bundle

C'est le point que la lecture de l'écran seul ne montre pas, et il décide si
l'issue tient sa promesse.

`App.jsx` initialise son état avec `emptyJournal(DEFAULT_DEFINITION)` : même
pendant que l'accueil est affiché, le journal **en mémoire** contient déjà le
programme fourni. `loadProgram()` ajoutait un cycle à ceux qui existent. Enchaîné
tel quel, générer son programme depuis l'accueil aurait laissé **deux cycles**
dans le journal, dont un que personne n'a voulu et que l'appli ne sait pas
supprimer — exactement ce que la décision Q1 refuse.

`loadProgram()` lit donc `welcome` : tant que l'accueil est là, le programme
fourni n'est pas un cycle, c'est un état initial, et le premier vrai programme
prend sa place au lieu de s'installer à côté.

L'écran aurait tenu sa promesse et la donnée l'aurait trahie. C'est le genre
d'écart qui ne se voit qu'à la relecture d'un journal, six mois plus tard.

## Décision 4 — L'accueil passe avant la coquille, pas dedans

Un retour anticipé dans `Programme()`, juste après la garde `!loaded`. Deux
raisons :

1. L'en-tête partagé annonce « Semaine 1 sur 12 » et les flèches de semaine.
   Au-dessus d'un choix pas encore fait, c'est **exactement** ce que l'issue
   existe pour ne plus dire.
2. La barre d'onglets du bas propose Semaine / Séance / Plan — trois entrées
   dans un cycle qu'on n'a pas choisi.

Le retour anticipé fait **deux exceptions**, `generateur` et `editeur` : ce sont
les mêmes écrans qu'ailleurs, ouverts par les mêmes fonctions, et leur bouton
retour repasse par `goPlan()`, ce qui ramène à l'accueil tant qu'aucun programme
n'a été enregistré. Aucun écran d'accueil dupliqué, aucune navigation parallèle.

## Décision 5 — Quatre routes, dont une qui n'est pas un défaut

Générer / Composer / Charger un fichier sont les trois portes que Plan offre
déjà, remontées au moment où elles servent.

La quatrième — « Regarder le programme fourni » — est ce qui rend l'écran
honnête : une appli dont la valeur est invisible tant qu'aucun programme n'existe
ne peut pas ouvrir sur trois boutons et du vide. Elle ne fait que
`setWelcome(false)` : **rien n'est écrit**, le journal reste celui en mémoire, et
la première écriture n'arrive qu'au premier geste réel — une série saisie. Un
athlète qui regarde puis génère n'a toujours qu'un cycle.

## Ce qui n'a pas bougé, et c'est le point

- `public/programs/upper-lower-4j.json` — pas une ligne. Une date figée dans un
  fichier livré est le défaut ; la mouvance appartient au code qui s'en sert, et
  c'est ce qui garde `DEFAULT_DEFINITION` comparable telle quelle dans les quatre
  fichiers de tests qui l'utilisent comme donnée de référence.
- `SCHEMA_VERSION` — aucun bump, aucune migration.
- Le chemin de chargement d'un journal existant — aucune branche de plus.

## Tests

`test/onboarding.test.js`, nouveau :

- `absent` est le seul verdict d'accueil ; `no-store`, `too-new`, `corrupt` et
  `invalid` n'en sont pas, et le test les énumère un par un parce que les
  confondre serait un bug **différent** à chaque fois ;
- un chargement réussi n'en est pas un, même sans une seule séance enregistrée —
  « vide » et « absent » ne sont pas la même chose ;
- `startingNow` ne touche pas la définition d'origine et n'en change que la date ;
- le bug corrigé, énoncé comme tel : `slotForDate()` sur la date du fichier livré
  place un janvier 2027 au-delà de la douzième semaine ; recalculée, elle rend
  `null` — le cycle n'a pas commencé.

**Vérifié en plus sur le vrai chemin de chargement** (script jeté après coup) :
les cinq verdicts de `loadJournal()`, et qu'un appareil vierge n'écrit
**rien** en stockage tant que rien n'est choisi.

## Critères d'acceptation, et où ils se vérifient

| Critère (spec) | Vérifié par |
|---|---|
| Une route vers son propre programme avant tout cycle | le retour anticipé, décisions 4 et 5 |
| Aucun champ stocké en plus | `isFirstLaunch` lit un verdict, décision 2 |
| Le cycle fourni démarre au prochain lundi | `startingNow`, `onboarding.test.js` |
| Un journal existant ouvre l'appli comme avant | `isFirstLaunch` faux sur `ok: true` |
| `no-store` n'est pas un premier lancement | `onboarding.test.js`, un cas par verdict |
| Journal illisible non plus | idem |
| `npm test` entier au vert | — |
