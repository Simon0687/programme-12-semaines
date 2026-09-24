# Revue proactive — pistes produit, UI et dette (2026-09-24)

Statut : **consultatif**. Rien ici n'est une décision. Ce qui survit à ta
lecture devient une issue et repasse par `.claude/WORKFLOW.md`.

Contexte : écrit pendant le merge de la 3.0.0 vers `main`, sur `dev` à
`86239ba`. Aucun fichier de code touché, aucune branche créée.

---

## 0. Ce que j'ai fait

1. Lu l'architecture, les 30 modules de `src/`, les quatre écrans et les
   documents de génération.
2. Lancé la suite : **922 tests, 123 suites, 0 échec, 2,6 s**.
3. Cherché sur les forums et chez les apps concurrentes ce qui est attendu d'un
   carnet de muscu en 2026, et confronté chaque attente au code d'ici.
4. **Mesuré** au lieu de supposer, sur trois points où j'aurais pu proposer un
   refactor à l'aveugle (§5).

Les trois issues encore ouvertes sont #69 (backend, `later`), #35 (boucle
d'adaptation, `later`) et #48 (momentum de scroll, `low`). Autrement dit : le
carnet de commandes est vide. C'est le bon moment pour cette revue.

---

## 1. Où en est le produit, vu de l'extérieur

Le bench (Hevy, Strong, Boostcamp, Alpha Progression, FitAI, plus les retours
de forums français et anglophones) donne une liste assez stable de ce qu'on
attend d'un carnet. Confrontée à l'app :

| Attendu ailleurs | Ici |
|---|---|
| Journal de séries rapide | **Mieux qu'ailleurs.** Le reproche n°1 sur les forums est « trop de taps pour saisir une série ». #42 remplit depuis « Prévu » et lance le repos en un tap ; #46 règle la charge au cran sans clavier. |
| RIR / RPE | **Natif**, et ce n'est pas un champ décoratif : c'est l'entrée du moteur. Ailleurs c'est une option à activer. |
| Chrono de repos | **Partiel** — il ne survit pas à l'écran éteint (P6). |
| Graphiques de progression | **Oui** (#17, #49, #63) : 10RM estimé, records, en-têtes de cycle. Au niveau des meilleurs. |
| Programme structuré multi-semaines | **Oui**, et composé dans l'app (#58), avec un rapport qui dit ce qu'il n'a pas pu servir. Les générateurs concurrents ne disent jamais ce qu'ils ont sacrifié. |
| Propriété des données, export | **Au-dessus du marché** (#15, #8, #32). Aucune app grand public ne copie l'original avant de filtrer. |
| Catalogue d'exercices consultable | **Non** — P5. |
| Calculatrice de disques | **Non** — P8. |
| Échauffement calculé | **Non**, c'est un texte figé — P7. |
| Mesures corporelles suivies dans le temps | **Collectées chaque dimanche, jamais rendues** — P3. |
| Volume réalisé par groupe musculaire | **Non**, alors que toutes les tables sont là — P1. |
| Modèle de fatigue, déclenchement de décharge | **Oui, et mieux** : #14 recommande, nomme ses raisons et enregistre les deux réponses. |
| Supersets, feed social, partage | Non, et **non-objectifs** — ne pas les traiter. |

Le produit n'a pas de retard fonctionnel. Ce qu'il a, ce sont **quatre boucles
ouvertes** : une donnée demandée et jamais rendue, un cycle qui se termine sans
porte, un historique que le moteur oublie à chaque nouveau cycle, et un registre
de 73 exercices qu'on ne peut pas consulter.

---

## 2. Propositions produit

### P1 — Le volume réalisé, par groupe musculaire · **Niveau B** · coût faible · *à faire en premier*

**Constat vérifié.** `assertions.js` sait déjà calculer le volume hebdomadaire
pondéré par muscle : `VOLUME` (les onze fourchettes), `contribution()` (la règle
de comptage indirect), `weeklyVolume(week)`. Ces fonctions ne tournent que sur le
**programme** — ce qui est prévu. Rien ne les fait tourner sur le **journal** —
ce qui a été fait. L'app juge donc son plan et ne regarde jamais le résultat.

**Proposition.** Un module `realised-volume.js` qui assemble, depuis les logs
validés d'une semaine, exactement la forme que `weeklyVolume()` attend —
`{ sessions: [{ rows: [{ sets, entry }] }] }`, où `sets` vaut `completedSets()`
et `entry` vaut `EXERCISES[vid]`. Puis une ligne par groupe sous le compte de
séances de l'écran Semaine : *dos 8 / 6–10 · pectoraux 4 / 6–10*.

**Pourquoi celle-là d'abord.** Le calcul est déjà écrit et testé ; ce qui manque
est l'adaptateur, une vingtaine de lignes. La substitution (#55) est gérée
gratuitement, puisqu'on lit le `vid` réellement enregistré et non celui que le
créneau prescrit. Et la règle de comptage est **la même** que celle du
validateur : le programme et sa réalisation se jugent enfin à la même aune, ce
qu'aucune addition de séries faite à la main ne donnerait.

C'est aussi **la moitié déterministe de #35**. Ce que #35 veut confier à un
modèle — « qu'est-ce qui a dérivé cette semaine ? » — commence par un chiffre que
le code sait produire seul.

### P2 — Les charges ne traversent pas les cycles · **Niveau A** · coût moyen

**Constat vérifié.** `generate()` rend `startingLoads: {}` (`generator.js:708`).
`history()` (`progression.js:196`) ne lit que le programme actif et écarte
explicitement les créneaux d'un autre programme. Donc, au premier jour d'un
nouveau cycle, `planned()` n'a aucune base et rend « Paliers : 50 → 75 → 100 %
de la charge devinée ». **Après douze semaines de journal, l'app redemande de
deviner.** Pendant ce temps, la fiche exercice (#17) affiche le 10RM estimé tous
cycles confondus : l'app sait, l'écran de séance ne sait pas.

**Ce que je ne propose pas, et pourquoi.** Élargir `history()` à tous les cycles.
L'en-tête de `exercise-history.js` donne l'argument, et il est bon : une série de
8 dans du 4–8 ne vaut pas une série de 8 dans du 8–12, donc le moteur doit rester
étroit.

**Proposition.** Reporter la charge **au moment de créer le cycle**, pas au
moment de la lire. Un module `carryover.js` qui rend, pour chaque exercice, la
dernière charge de travail observée tous cycles confondus (`workingSets()` et
`exerciseHistory()` existent) ; le générateur et l'éditeur pré-remplissent
`startingLoads` avec ; l'éditeur les montre, on les corrige, on enregistre.

C'est la forme exacte que demande ARCHITECTURE §2.1 : **on stocke la valeur, pas
la référence.** Une charge reportée devient une donnée du nouveau cycle, datée
par lui, et la relecture d'un ancien journal n'en est pas affectée.

**Niveau A** par Q3 : compétence nouvelle du système, et `startingLoads` change
de provenance. Q1 répond non — aucun journal existant ne se relit autrement —
donc ni migration ni bump de `SCHEMA_VERSION`.

### P3 — Rendre le poids et le tour de taille · **Niveau B** · coût faible

**Constat vérifié.** Le bilan hebdomadaire demande poids moyen, tour de taille,
sommeil, qualité de sommeil, énergie, RIR. Tout est stocké dans
`checkin[weekStartKey]`. La seule restitution est une ligne de texte dans
`bilan.js:50` : `Poids moyen : 82 kg — tour de taille : 88 cm`. Aucune courbe,
aucune tendance, aucun cumul.

**Proposition.** Réemployer `chartGeometry()` (`display.js:458`), qui est
générique — elle prend des séries de points et rend une géométrie SVG — pour
tracer poids et tour de taille semaine après semaine, dans la section Bilan de
l'écran Semaine.

**L'argument qui tient.** Une app qui réclame une donnée chaque dimanche et ne la
rend jamais apprend à ne plus la remplir. Le poids sur douze semaines est *la*
mesure que le programme cherche à déplacer ; c'est la seule donnée du check-in
dont la valeur est dans la courbe et pas dans le point.

### P4 — La fin de cycle est une impasse · **Niveau B** · coût moyen

**Constat vérifié.** `App.jsx:1204` : quand `at.week > definition.weeks`, l'écran
Semaine affiche *« Les 12 semaines sont terminées : bilan et programme
suivant. »* — une phrase, sans aucune porte. Le bilan de cycle n'existe pas, et
le programme suivant se crée comme le premier, à blanc.

**Proposition.** Un écran de fin de cycle, atteint depuis cette phrase : séances
faites sur prévues, records par exercice (`recordsFor()` existe), volume réalisé
par groupe (P1), progression des charges du premier au dernier jour ; puis un
bouton unique **« Créer le cycle suivant »** qui ouvre le générateur avec les
charges reportées (P2).

P2 et P4 se tiennent : P2 sans P4, le report est invisible ; P4 sans P2, le
bouton ouvre un cycle amnésique.

### P5 — Onglet Exercices · **Niveau B** · coût faible

**Constat vérifié.** Le code l'annonce deux fois, sans ironie.
`screen-state.js` : *« C'est déjà le comportement dont un futur onglet
“Exercices” aura besoin : il ouvrira la fiche sans aucune séance. »*
`ExerciseSheet.jsx` : *« ouverte depuis un futur onglet “Exercices”, la fiche
rend exactement le même écran et seul ce libellé change. »* Aujourd'hui, les 73
entrées du registre ne sont atteignables que par la carte d'un créneau de la
séance ouverte.

**Proposition.** Un écran qui liste le registre avec les facettes de #64
(`ExercisePicker` les porte déjà) et ouvre `ExerciseSheet` avec
`backLabel="Exercices"`. `resolveScreen()` gère déjà le cas d'une fiche sans
séance. Le travail est un écran de liste, pas une fonctionnalité.

**Le point à trancher, et il est réel.** La barre du bas passerait de deux
onglets à trois. #41 l'avait réduite à deux exprès. C'est un arbitrage à faire à
la lumière de U1, pas un détail d'implémentation.

### P6 — Le repos ne survit ni à l'écran éteint ni au recyclage iOS · **Niveau B** · coût faible

**Constat vérifié.** `timer` est un `useState` d'`App.jsx` et rien d'autre :
`screen-state.js` ne mémorise que l'écran, la séance et l'exercice. Or son propre
en-tête note que *« sur iOS la vue web est récupérée dès que l'appli passe en
arrière-plan, c'est-à-dire à chaque fois qu'on change de morceau entre deux
séries »*. À ce moment-là l'écran est restauré et **le repos est perdu**. La fin
de repos ne se signale que par `navigator.vibrate` (`App.jsx:674`), que Safari
iOS n'implémente pas : sur iPhone, il ne se passe rien du tout.

**Proposition, trois pièces indépendantes.**
1. **Wake Lock** tant qu'une séance est ouverte. Le bug qui cassait l'API dans
   les PWA installées est corrigé depuis iOS 18.4. Objet navigateur injecté,
   comme le store et `sessionStorage` (§2.7).
2. **Persister `timer.end`** à côté de l'état d'écran : au retour, le repos
   reprend là où il en est, ou a expiré.
3. **Un signal audible**, puisque la vibration n'existe pas sur iOS.

C'est la seule proposition de cette revue dont le défaut se constate en salle
plutôt que dans le code.

### P7 — L'échauffement calculé · **Niveau B** · coût faible

**Constat.** `prog.WARM[session.warm]` est un texte figé par séance. Le premier
exercice lourd a pourtant une charge prévue connue et un `incr` connu : l'échelle
40 / 55 / 70 / 85 % arrondie au cran est calculable, et `loadText()` sait déjà
l'écrire.

Rien n'est enregistré : un échauffement n'est pas une série de travail, et le
journal ne doit pas apprendre à en porter (§2.2).

### P8 — Calculatrice de disques · **Niveau B** · coût faible · *valeur à confirmer*

C'est la fonctionnalité la plus réclamée aux éditeurs concurrents. Un module pur
`plates.js` — barre de 20 kg, inventaire standard en constante, rendu de la pile
par côté — n'ajoute aucune donnée stockée et se teste sous `node --test`.

**Mais.** Tu t'entraînes en salle et tu fais ce calcul de tête depuis des mois.
Je la classe dernière et je te la laisse : c'est typiquement la fonctionnalité
qu'on écrit parce que les autres l'ont.

### P9 — Les exclusions articulaires dans le générateur · **Niveau B** · coût faible

**Constat vérifié.** Chaque entrée du registre porte `articulations`
(`epaule`, `coude`, `poignet`, `lombaires`, `hanche`, `genou`), renseigné sur
tout le catalogue. Ce champ n'est lu que par la fiche exercice, pour l'afficher.
`generate()` prend fréquence, durée, matériel, niveau, objectif et priorités —
**jamais une contrainte articulaire**. L'étude de philosophie produit range
pourtant les « exclusions articulaires » au niveau 1, dans ce que l'app doit
calculer elle-même.

**Proposition.** Une sixième question, facultative : « une articulation à
ménager ? ». Les exercices qui la chargent sortent du pool, et le `report` le dit
avec les autres arbitrages — l'écran de collecte sait déjà rendre ces listes.

**Pourquoi ça compte.** La première raison de changer un programme, ce n'est pas
l'ennui, c'est la douleur. Aujourd'hui la seule réponse de l'app est la
substitution d'une séance (#55) : un pansement, répété douze fois.

---

## 3. UI et navigation

### U1 — L'onglet Plan fait trois métiers · à trancher

Le Plan porte aujourd'hui, sous un seul index :

- **la méthode** — structure, progression, décharge : une référence qui ne bouge
  jamais ;
- **ce programme** — l'avis d'`assess()`, la liste des cycles, l'activation, la
  suppression, les quatre portes de création ;
- **l'appareil** — export, import, sauvegardes, état de persistance.

Les intertitres de `PLAN_GROUPS` nomment déjà les trois. Mais lire une règle
d'entraînement et supprimer un cycle sont deux gestes qui n'ont rien à faire
derrière le même onglet : l'un se fait au calme, l'autre est destructif.

**Deux formes possibles**, et je ne tranche pas sans toi :

- **(a)** sortir « Appareil » du Plan vers un troisième onglet *Réglages*, qui
  accueillerait aussi les préférences de P6 ;
- **(b)** garder deux onglets et assumer que Plan est le tiroir de tout ce qui
  n'est pas l'entraînement du jour.

Si P5 se fait, la question n'est plus reportable : on ne met pas quatre onglets
dans cette barre.

### U2 — Les flèches de semaine s'affichent au-dessus du Plan · **Niveau C**

**Constat vérifié.** L'en-tête collant partagé (`App.jsx:1298`) se rend sur tous
les écrans sauf Séance, Exercice et Éditeur. Donc en lisant « La méthode » — un
texte qui ne dépend d'aucune semaine — on a `‹ Semaine 4 sur 12 ›` en haut, et
deux flèches qui ne changent rien de visible sur la page ouverte.

La correction est petite : l'en-tête appartient à Semaine, et le Plan a déjà le
sien (`PlanPage`).

### U3 — Le Plan a perdu la comparaison (rappel)

Noté à la livraison de #62 et toujours en attente de ton jugement : l'index
drill-in ne permet plus d'ouvrir deux sections à la fois. Ça ne se décide pas
depuis le code, ça se décide à l'usage.

---

## 4. Dette et outillage

### R1 — `ARCHITECTURE.md` a dérivé sur trois points · **Niveau C** · priorité haute

Le document se présente comme l'autorité du dépôt. Trois de ses énoncés sont faux
aujourd'hui :

| Énoncé | État réel |
|---|---|
| §2.3 « **contradiction connue, non résolue** : `App.jsx` compare `SESSIONS[].day` à `today.getDay()` » | Levée par **#39**. `App.jsx:490` lit `slotForDate()`, et le commentaire sur place le dit. |
| §2.4 « une ligne où `ex.dc` vaut `"87,5"` fait lever `history()` […] c'est **#38**, pas ici » | **#38 est clos**, et ne portait pas là-dessus (c'était le vocabulaire de validation). `normalizeSets()` (#23) a par ailleurs neutralisé le cas décrit : `history()` ne lève plus. Le trou a changé de forme (R2) et **plus aucune issue ne le suit**. |
| §2.6 « ce qui reste dans `App.jsx` est de la dette, **suivie par #23** » | **#23 est clos.** La dette, elle, est toujours là (R3). |

Un document faux est pire qu'un document absent : celui-ci est cité par les
specs, et la prochaine issue qui s'appuiera sur §2.4 cherchera un trou qui
n'existe plus en ignorant celui qui existe.

### R2 — Quatre lecteurs de `log.ex[vid]` ne passent pas par `normalizeSets` · **Niveau B**

C'est le §2.4 dans sa forme actuelle, relevé ligne à ligne :

| Ligne | Code | Effet si `ex[vid]` vaut la chaîne `"87,5"` |
|---|---|---|
| `App.jsx:822` | `(ex[vid] \|\| []).map(…)` | `"87,5".map` n'existe pas → **TypeError à la validation de séance** |
| `App.jsx:835` | même forme, dans `dropsOf()` | idem |
| `App.jsx:1002` | `[...l.ex[vid]]` | étale la chaîne en caractères → bilan silencieusement faux |
| `App.jsx:1386` et `:1393` | `rows` passé à `ExerciseCard` | ne lève pas, mais la carte affiche n'importe quoi |

`|| []` ne protège de rien : une chaîne non vide est vraie. Les trois autres
lecteurs du dépôt (`progression.js:202`, `exercise-history.js:49`,
`display.js:135`) sont gardés. Un accesseur unique — `setsOf(log, vid)` — ferme
la famille.

**À relativiser honnêtement** : il faut un journal trafiqué ou importé à la main
pour y arriver. Mais l'issue porte la seule règle qui tienne ici : un jeté
pendant le rendu ne laisse pas un écran en erreur, il démonte l'appli entière —
écran blanc, et le journal en mémoire perdu avant que l'autosave n'ait pu
l'écrire. `App.jsx:1540` le dit déjà, pour un autre cas.

### R3 — `App.jsx` : 1 972 lignes, 35 `useState` · **Niveau B** · par morceaux

Un cinquième de `src/` dans un fichier. Deux extractions sont mécaniques et se
font sans toucher à l'état :

- **`ExerciseCard`** → `src/ExerciseCard.jsx` : 260 lignes, déjà un composant à
  props, aucun accès au journal complet ;
- **`CardioView`, `Block`, `PlanIndex`, `PlanPage`** : 147 lignes de composants
  purs, déjà rassemblés en bas du fichier.

Soit **−400 lignes sans rien décider**. §2.6 ne s'y oppose pas : la règle porte
sur le contenu (« aucun calcul dans un composant »), pas sur une liste de
fichiers — le document le dit explicitement, et c'est pour ça qu'il a été
reformulé à #17.

Ce que je **ne** propose pas : un store global ou un reducer. Refusé deux fois à
raison, et ces extractions n'en ont pas besoin.

### R4 — Aucune CI GitHub · **Niveau C** · coût très faible

`.github/` ne contient que des gabarits d'issue et de PR. Les tests tournent chez
Cloudflare, ce qui garde le déploiement — mais une PR sur GitHub n'affiche
**aucun check**, et rien n'empêche de merger `dev` → `main` sur un rouge. Un
workflow de quinze lignes (`npm ci && npm test`) rend le verdict visible là où la
décision se prend.

### R5 — Pas d'ESLint, alors que le code s'y réfère · **Niveau C**

`App.jsx:696` porte `// eslint-disable-next-line react-hooks/exhaustive-deps`, et
il n'y a pas d'ESLint dans le dépôt : ce commentaire ne désactive rien. Dans un
composant à 35 `useState`, 17 `useMemo` et 6 `useEffect`,
`react-hooks/exhaustive-deps` attrape une classe de bugs que la suite ne peut pas
voir — aucun test ne monte React.

À faire **seulement** si le premier passage donne peu d'avertissements. Un linter
qu'on installe et qu'on noie sous 200 `disable` est pire que pas de linter.

---

## 5. Ce que je ne recommande pas, et les chiffres qui le disent

Quatre refactors que j'aurais pu proposer de bonne foi. Mesurés, ils ne se
justifient pas.

**N1 — Indexer le journal par exercice, ou mémoïser `planned()`.** `history()`
parcourt tout le journal à chaque appel, une fois par carte, à chaque frappe.
Mesuré sur ce poste, programme haut-bas 5 jours, séance de 7 cartes :

| Journal | Un rendu de séance complet |
|---|---|
| 12 semaines (60 séances) | 0,19 ms |
| 36 semaines (180 séances) | 0,33 ms |
| 104 semaines (520 séances) | **1,01 ms** |

Même en comptant un facteur 10 pour un téléphone de milieu de gamme, on est à
10 ms pour deux ans d'historique. **Non.**

**N2 — S'inquiéter du quota de `localStorage`.**

| Journal | Taille | `JSON.stringify` |
|---|---|---|
| 1 cycle de 12 semaines | 25 Ko | 0,21 ms |
| 4 cycles | 98 Ko | 0,90 ms |
| 8 cycles (≈ 2 ans) | 197 Ko | 1,63 ms |

Le quota usuel est de 5 Mo par origine : environ vingt ans de journal. La
sérialisation complète toutes les 600 ms d'inactivité ne coûte rien. **Non.**

**N3 — Ouvrir #69 (backend) maintenant.** Rien dans ces mesures ne le déclenche.
§3 nomme le vrai déclencheur et il n'a pas changé : le multi-appareil ou le
multi-athlète. La durabilité est déjà traitée (#15, #8, #32).

**N4 — Un thème clair.** Les tokens de #51 le rendent bon marché, et une salle
bien éclairée est l'argument. Mais c'est de la finition sur un produit qui a
quatre boucles ouvertes. **Plus tard, si jamais.**

---

## 6. Ordre que je proposerais

**Lot 1 — fermer les boucles ouvertes.** Tout est bon marché, tout se voit :
P1 (volume réalisé), P3 (courbe de poids), U2 (flèches hors du Plan),
R1 (corriger l'architecture).

**Lot 2 — la continuité entre cycles.** P2 puis P4. C'est le seul niveau A de la
revue, et le plus gros gain d'usage : sans lui, le treizième lundi recommence à
zéro.

**Lot 3 — la séance en conditions réelles.** P6 (repos qui survit), P7
(échauffement calculé), R2 (l'accesseur unique).

**Lot 4 — à trancher avant de coder.** U1 (la barre du bas), puis P5 (onglet
Exercices), qui en dépend. P9 (exclusions articulaires) peut passer avant : il ne
touche à aucun écran existant.

**Hors lots, quand tu veux.** R3 (extraire `ExerciseCard`), R4 (CI), R5 (ESLint),
P8 (disques).
