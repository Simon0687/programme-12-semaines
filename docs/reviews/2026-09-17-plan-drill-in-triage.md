# Ce que le projet retient de 1c « drill-in » — `dev` at f734f88 (2026-09-17)

Source : [Claude Design, Onglet Plan, trois refontes](../external_audit/Claude%20Design/2026-09-17-onglet-plan-trois-refontes.md),
projet `251f1f2f…`, sync du 2026-09-17T09:40Z.

Comme pour le triage du 2026-09-14, chaque affirmation ci-dessous est vérifiée
contre le code, pas contre les maquettes. Un audit est consultatif
([README](../external_audit/README.md)) ; ce document est la passe de
vérification.

**Différence de méthode, et elle compte.** La revue du 2026-09-14 avait jugé le
Plan depuis `plan.js` seul et conclu à un mur de 5 000 px, sans voir l'accordéon
qui le replie (§R5 du triage précédent). Celle-ci a lu `App.jsx`, `plan.js`,
`progression.js` et le programme neutre avant de dessiner, et sa maquette 0a est
une reconstitution fidèle de l'existant. Elle sait donc ce qu'elle remplace.

---

## 1. L'idée porteuse : un sous-titre qui compte, pas qui aguiche

C'est le seul endroit où 1c dit quelque chose que ni 1a ni 1b ne disent, et ce
n'est pas une idée de navigation.

Chaque ligne de l'index porte un sous-titre de la forme `11 groupes · 7 séries
max`, `5 déclencheurs · 2 recettes`, `Aucune enregistrée — paliers en S1`. Ce ne
sont pas des accroches : ce sont des **mesures du programme actif**. Un index
fait de ces lignes-là répond déjà à une partie des questions sans qu'on ouvre
quoi que ce soit, et surtout il ne peut pas être vague.

Vérification, sous-titre par sous-titre, contre ce que le code peut produire
aujourd'hui :

| Sous-titre de la maquette | Dérivable ? | D'où |
|---|---|---|
| Volume — `11 groupes · 7 séries max` | **Oui, exactement** | `program.volume.length` et le max de la colonne 2. Mesuré : `upper-lower-4j` donne 11 et 7, au caractère près la maquette ; `haut-bas-5j` donne 12 et 10 |
| Charges de départ — `Aucune enregistrée — paliers en S1` | **Oui** | `Object.keys(definition.startingLoads).length` — 0 sur le programme neutre, 6 sur celui de Simon |
| Plan de repli — `3, 2 ou 1 séance dans la semaine` | **Oui** | `program.fallback` porte 4 paragraphes sur les deux programmes ; le décompte se lit |
| Données — `Export 12 sept. · stockage persistant` | **Oui** | `readLastExport()` (#15) et `storageOk`, tous deux déjà dans `App.jsx` |
| Structure — `Calibration, bloc 1, décharge, bloc 2, bilan` | **Oui, mais constante** | c'est la table `weeks` de `buildPlan`, invariante : de la méthode |
| Progression — `6 règles · incréments de charge` | **Constante** | la section est « toujours (méthode, cf. progression.js) » |
| Décharge — `5 déclencheurs · 2 recettes` | **Constante** | idem |

**Trois lignes sur sept sont des constantes.** C'est la première limite
mesurable de 1c : un index dont presque la moitié des lignes navigue vers du
texte qui ne bougera jamais d'un programme à l'autre. Ce n'est pas rédhibitoire
— une référence a le droit d'être stable — mais ça affaiblit l'argument « chaque
ligne dit où en est *ce* programme ».

## 2. Le groupement méthode / programme / appareil existe déjà dans la donnée

C'est le finding le plus rentable, et la revue ne le formule pas comme tel : elle
range les sept lignes sous **La méthode**, **Ce programme** et **Appareil**.

Cette taxonomie n'est pas une invention de mise en page. C'est **exactement** la
ligne que #25 et #26 ont tracée entre méthode bundlée et donnée de programme, et
l'en-tête de `src/plan.js` l'annote déjà, section par section :

- `structure`, `progression`, `deload` — « toujours (méthode) » ;
- `volume`, `fallback`, `startloads`, `cardio`, `nutrition` — tirées de la
  donnée, et **omises quand cette donnée est absente**.

L'écran, lui, aplatit les huit sections en une seule liste où rien ne distingue
une règle qui vaut pour tout le monde d'un fait sur le programme chargé. Montrer
le groupement ne coûte pas de donnée nouvelle : il suffit d'ajouter un champ
`group` aux sections que `buildPlan()` rend déjà, et de les rendre sous leurs
intertitres.

**Et ça se tient indépendamment de 1c.** L'accordéon actuel peut porter ce
groupement sans devenir un index. C'est la part de 1c qu'on peut prendre sans
rien défaire.

## 3. Ce que 1c rend visible sur #34, et qui vaut mieux qu'un argument

La section `cardio` est la dernière qui soit de la prose bundlée là où les autres
sont dérivées ([spec #34](../features/34-cardio-follows-the-active-program/spec.md)).
Sous 1c, elle doit porter un sous-titre du même genre que les autres — donc
compter les séances de conditionnement du programme actif.

Or `cardio: "default"` résout vers `CARDIO_ITEMS` : deux rameurs Z2 et un
intervalle, les mercredi, jeudi et dimanche de Simon. Un index qui écrit
« 3 séances · mercredi, jeudi, dimanche » sous un programme importé énonce un
fait **faux et daté**, là où le paragraphe actuel se contentait d'être hors sujet.

C'est le meilleur argument disponible pour l'option 1 ou 3 de #34, et il ne vient
pas d'un raisonnement : il vient de ce que la maquette doit écrire dans la case.

## 4. Un défaut du code que la maquette recopie fidèlement

L'en-tête de 1c affiche « Référence du programme. Les modifications se font dans
le chat. » La revue ne l'a pas inventé : c'est `PLAN_INTRO` (`src/plan.js`), mot
pour mot, moins la fin (« le fichier est régénéré »).

**Cette phrase est périmée depuis le 2026-09-15.** #36 a livré l'éditeur manuel
et #58 le moteur de génération : les modifications se font dans l'application.
Un utilisateur qui lit cette ligne aujourd'hui cherche un chat qui n'existe pas.
Correction d'une ligne, aucune décision produit — Niveau C.

## 5. Ce que 1c coûte, et ce qu'il ne faut pas lui laisser défaire

- **L'accordéon permet d'ouvrir deux sections à la fois.** Comparer le tableau de
  volume et le plan de repli est un geste aujourd'hui ; sous 1c, c'est deux
  allers-retours. Une référence se consulte souvent en croisant deux endroits.
- **Le bilan reste sur Semaine.** #41 l'y a mis délibérément (« le bilan est une
  chose de la semaine »), et le triage du 2026-09-14 l'avait déjà défendu contre
  la même proposition (§R6). 1c n'y touche pas — à vérifier si une variante le
  fait.
- **Sept lignes ne font pas un mur.** L'argument de la revue précédente (5 000 px,
  aucun repère) était faux. 1c doit donc se justifier sur autre chose que le
  volume de texte : sur le fait que l'index *mesure* le programme, pas sur le
  fait qu'il le raccourcit.
- **La navigation, elle, est bon marché.** `screen-state.js` modélise déjà un
  écran plus une cible (`sessionId`, `exerciseId`, #41/#17) et valide la cible
  mémorisée contre le programme actif au montage. Une page de Plan est la même
  forme : `{ screen: "plan", topic: "volume" }`, avec le `backLabel` qui existe.

## 6. Candidats d'issue

Non créés — Simon décide ce qui entre au tracker
([README](../external_audit/README.md)).

| # | Ce que c'est | Nature | Taille |
|---|---|---|---|
| D1 | §4 — `PLAN_INTRO` dit « dans le chat » alors que #36 et #58 ont livré l'éditeur et le moteur | `fix` | une ligne |
| D2 | §2 — grouper les sections du Plan en méthode / ce programme / appareil, via un champ `group` sur ce que rend `buildPlan()` | `feat` | petite, sans décision produit |
| D3 | §1 — donner à chaque section un compte dérivé (volume, charges de départ, repli, données), affiché sur le titre replié | `feat` | moyenne |
| D4 | §5 — le Plan devient un index et chaque sujet une page | `feat` | grande, `/spec` → `/decide` |

D1 et D2 sont indépendants de la refonte et la précèdent naturellement : D2
produit la taxonomie que D4 afficherait, et si D4 n'est jamais fait, D2 vaut
quand même. **D3 est le cœur de 1c** — c'est lui qui transforme l'index en
mesure, et il se livre sur l'accordéon actuel, avant toute refonte de navigation.
D4 ne se décide pas avant que Simon ait repensé l'onglet lui-même.

**Et il faut le dire franchement : D3 ne peut pas être honnête tant que #34
n'est pas tranché.** Un compte sous la section cardio compterait les séances de
Simon sous n'importe quel programme (§3).

---

## 7. Ce qui a été livré (2026-09-17)

Les quatre candidats sont dans `dev`, dans l'ordre que §6 donnait.

| # | État | Où |
|---|---|---|
| **D1** | livré | `PLAN_INTRO` dit ce que #36 et #58 ont rendu vrai |
| **D2** | livré | `buildPlan()` rend un `group` par section ; l'index les range sous **La méthode / Ce programme / Appareil** |
| **D3** | livré | `buildPlan()` rend un `meta` par section — le compte dérivé |
| **D4** | livré | le Plan est un index, chaque sujet a sa page |

**#34 est passé avant, et c'était la bonne décision.** Le compte de la ligne
Cardio se lit aujourd'hui « 3 séances · mercredi, jeudi, dimanche » sur le
programme de Simon — sous `cardio: "default"`, il aurait écrit la même chose sous
n'importe quel programme importé. C'est exactement le mensonge que §3 annonçait,
et il aurait été livré avec D3.

Ce que les mesures de §1 ont donné une fois codées :

- `11 groupes · 7 séries max` sur le programme neutre, **au caractère près la
  maquette**. Le programme de Simon donne `12 groupes · 10 séries max`.
- Les trois constantes sont restées constantes, et se voient comme telles. C'est
  une information — « cette référence ne bouge pas d'un programme à l'autre » —
  et non un défaut à cacher.
- La ligne Données rend `Export 12 sept. · stockage persistant`, comme la
  maquette, depuis `readLastExport()` et l'état de persistance (#15).

Deux écarts avec 1c, tous deux assumés :

- **Le sujet ouvert n'est pas mémorisé.** Un rechargement rouvre l'index. Faire
  entrer une troisième cible dans `screen-state.js` (#41) aurait demandé de la
  valider contre le programme actif comme les deux autres, pour un confort que
  personne n'a demandé.
- **Le retour n'est pas en ambre.** La maquette le met à l'accent ; C2 du triage
  du 2026-09-14 dit que l'accent porte déjà trop de sens, et une flèche de retour
  n'est pas une donnée. Même `text-ink-soft` que la fiche exercice (#17).

Ce que l'accordéon savait faire et que l'index ne sait plus : **ouvrir deux
sujets à la fois pour les comparer**. §5 l'annonçait. C'est le point à juger à
l'usage, et le seul qui justifierait de revenir en arrière.
