# Proposition — un parcours de navigation pour l'onglet Plan (2026-09-25)

Statut : **consultatif**. Rien ici n'est une décision. Ce document répond à une
demande directe — « l'onglet Plan contient tout, propose-moi un parcours plus
fluide » — et il est écrit pour alimenter le `/decide` de **#75**, dont le brief
a été abandonné le 2026-09-25 au matin. Il touche aussi **#78** (onglet
Exercices), qui attend #75 pour savoir où est sa porte.

Contexte : `dev` à `ef558d3`, v3.0.0 en production. Aucun fichier de code touché.
Sources : `docs/reviews/2026-09-24-pistes-produit-et-dette.md` (§1 le bench, §3
U1/U2/U3), `docs/external_audit/Claude Design/2026-09-17-onglet-plan-trois-refontes.md`,
`docs/reviews/2026-09-17-plan-drill-in-triage.md`.

---

## 0. Un point de calage

Le reproche formulé était « des menus déroulants, beaucoup de texte ». **Les
menus déroulants du Plan n'existent plus depuis #62** : l'accordéon de huit
sections a été remplacé par un index drill-in
([PlanViews.jsx:68](../../src/PlanViews.jsx#L68)), et c'est bien ce qui tourne en
v3.0.0. Les deux seuls `<Section>` repliables restants sont *Échauffement*
([App.jsx:1251](../../src/App.jsx#L1251)) et *Bilan de la semaine*
([App.jsx:1478](../../src/App.jsx#L1478)), tous deux hors du Plan.

Ça ne disqualifie pas le constat, ça le déplace : le drill-in a rangé les murs de
texte dans des pièces séparées, il ne les a pas abattus. Le reste de ce document
part de là.

---

## 1. Diagnostic

### 1.1 L'onglet fait trois métiers (= U1, = #75)

Sous un seul index cohabitent une règle d'entraînement qu'on lit au calme, la
suppression d'un cycle, et un import qui remplace le journal. `PLAN_GROUPS` nomme
déjà les trois familles ([PlanViews.jsx:62](../../src/PlanViews.jsx#L62)), mais
rien dans le dessin ne dit que ces gestes n'ont pas le même poids : toutes les
lignes ont le même chevron.

L'index fait **sept lignes** avec le programme fourni (méthode 3 · ce programme 3
· appareil 1) et **dix** avec une définition complète — cardio, nutrition et
charges de départ apparaissent alors, `buildPlan()` les omettant quand la donnée
manque ([plan.js:171](../../src/plan.js#L171)).

### 1.2 Derrière chaque ligne, un mur de prose

Mesuré en exécutant `buildPlan()` :

| Page | Texte | Le pire paragraphe |
|---|---|---|
| Progression | 1 219 car. en 5 paragraphes | 472 car. |
| Nutrition | 1 658 car. en 6 paragraphes | 576 car. |
| Décharge | 643 car. en 2 paragraphes | 344 car. |
| Structure | 463 car. + une table | 463 car. |

Sur un téléphone, 576 caractères d'affilée font une quinzaine de lignes sans
respiration. **C'est un problème de forme du contenu, pas de navigation** — et
c'est probablement la moitié de ce qui se ressent comme « pas lisible ».
`Block` ne connaît que trois formes : `p`, table `weeks`, table `volume`
([PlanViews.jsx:23](../../src/PlanViews.jsx#L23)). Il n'existe ni intertitre ni
liste : tout ce qui est une énumération — les cinq déclencheurs de décharge, les
quatre règles du plancher alimentaire — est écrit en phrases à rallonge séparées
par des points-virgules, parce que le vocabulaire de rendu n'offre rien d'autre.

### 1.3 Rien n'est contextuel

La méthode est rangée là où elle ne sert pas : on la lit assis, jamais au moment
où la règle s'applique. Une semaine de décharge affiche bien sa note de phase
(`PHASE_NOTES.deload`), mais les cinq déclencheurs qui expliquent *pourquoi* elle
tombe là sont à trois taps, dans un autre onglet, et rien ne les désigne. Idem
pour la règle de double progression : elle décide de la ligne « Prévu » de chaque
carte d'exercice, et aucune de ces cartes n'y mène.

Le seul pont existant est `PHASE_NOTES` ([plan.js:286](../../src/plan.js#L286)),
lu par l'en-tête de semaine et le sous-titre de séance. Il prouve que le principe
marche ; il ne couvre qu'une phrase par phase.

> Note : le symptôme le plus visible de cette famille — les flèches de semaine
> qui s'affichaient au-dessus du Plan, U2 de la revue du 2026-09-24 — **est déjà
> corrigé** par #83. L'en-tête de semaine ne se rend plus que sur `screen ===
> "semaine"` ([App.jsx:1168](../../src/App.jsx#L1168)).

### 1.4 Ce que l'index a perdu (= U3, rappel)

L'accordéon savait ouvrir deux sujets à la fois pour les comparer — volume ×
plan de repli. L'index ne le permet plus, et chaque page est un cul-de-sac :
aucun déplacement latéral, on remonte pour redescendre.

---

## 2. Ce que fait le reste du marché

Le bench du 2026-09-24 (Hevy, Strong, Boostcamp, Alpha Progression, FitAI, plus
les retours de forums) est net sur un point : **aucune de ces apps n'a d'onglet
« Plan »**. La référence y vit à deux endroits, jamais à un troisième :

- **sur l'objet programme** — ce que *ce* programme fait, ses volumes, sa
  structure : on le consulte quand on choisit ou qu'on doute ;
- **au point d'usage** — l'explication arrive quand la règle s'applique, dans la
  séance ou sur la fiche d'exercice.

Et les réglages ont toujours leur propre porte, jamais mélangés au contenu
d'entraînement.

---

## 3. Le parcours proposé

```
[ Semaine ]  ⚙                      [ Programme ]
     │                                    │
     ├─ séance → fiche exercice           ├─ Hypertrophie 12s · S4/12 · Bloc 1   (actif)
     └─ bilan                             ├─ Avis : 3 points à regarder        ›
                                          │
   ⚙ Réglages (plein écran)               ├─ CE PROGRAMME
     ├─ export / import du journal        │   Volume       11 groupes · 7 séries max  ›
     ├─ sauvegardes                       │   Cardio       2 × Z2 · 1 × intervalles   ›
     ├─ état de persistance               │   Repli        3 cas de figure            ›
     └─ (plus tard : son du chrono, #79)  │   Charges S1   9 exercices                ›
                                          │   Nutrition    3 150 kcal · 180/90/350    ›
                                          │
                                          ├─ MES PROGRAMMES   (activer · supprimer)
                                          ├─ + Nouveau programme
                                          └─ Référence                              ›
                                                 ├─ sommaire ancré : Structure ·
                                                 │  Progression · Décharge ·
                                                 │  Repos et exécution
                                                 └─ Catalogue des exercices (76)   ›
```

Quatre déplacements, et rien de plus.

### 3.1 L'onglet s'appelle « Programme » et atterrit sur le programme

Aujourd'hui, ouvrir Plan impose de choisir parmi sept à dix lignes avant de voir
quoi que ce soit sur l'entraînement en cours. La carte du programme actif est
déjà en tête de l'index ([App.jsx:1695](../../src/App.jsx#L1695)) — elle devient
la page, au lieu d'en être l'introduction.

Le drill-in **reste** pour les cinq pages de données du programme : ce sont des
tables courtes, et leur compte dérivé (`11 groupes · 7 séries max`) est
exactement ce qui dit s'il faut les ouvrir. C'était l'idée porteuse de #62 et
elle tient ; ce qui ne tient pas, c'est que la méthode et l'appareil soient
rangés dans le même tiroir.

### 3.2 La méthode redevient un manuel, en une page à sommaire ancré

Les trois à quatre lignes « La méthode » fusionnent en une page unique avec un
sommaire ancré en tête. On scrolle entre deux règles au lieu de remonter et
redescendre : **c'est la réponse à U3**, la comparaison perdue, sans revenir à
l'accordéon. C'est aussi, mot pour mot, la piste que la revue Claude Design
proposait d'essayer ensuite — « garde 1c mais avec la frise de 1a ».

### 3.3 La méthode vient à toi

`PHASE_NOTES` fait déjà la moitié du chemin : la note de phase s'affiche dans la
séance et l'en-tête de semaine ([plan.js:286](../../src/plan.js#L286)). On ajoute
les entrées contextuelles qui manquent — le bandeau de semaine de décharge ouvre
`référence#décharge`, la ligne « Prévu » de la carte d'exercice ouvre
`référence#progression`.

**C'est le vrai gain de fluidité du lot.** Le reste range mieux ; celui-ci fait
que le texte arrive au moment où il s'applique, au lieu d'attendre qu'on aille le
chercher. Une règle lue au bon moment n'a pas besoin d'être retenue.

### 3.4 « Données » part derrière ⚙

Export, import, sauvegardes, état de persistance quittent le Plan pour un écran
plein atteint par une icône dans l'en-tête de Semaine.

**L'argument qui tient même si on n'ajoute jamais rien à la barre :** c'est le
seul écran destructif de l'app — l'import remplace le journal — et il est
aujourd'hui à un tap d'un écran de lecture, dessiné exactement comme les lignes
qu'on ouvre par curiosité. L'argument que je ne mets pas en avant, c'est la
fréquence de visite (deux fois par cycle) : vrai, mais ça justifierait de le
ranger n'importe où, pas de le séparer.

---

## 4. Ce que ça donne pour #75 et #78

**#75 est répondue, et dans le sens de son brief abandonné :** la barre reste à
**deux onglets**, Semaine et Programme. Le ⚙ n'est pas un onglet — c'est une
icône d'en-tête, donc l'objection centrale du brief (« un onglet permanent pour
une seule ligne d'index ») ne s'applique pas. La recommandation B survit ; ce
document ne fait qu'ajouter qu'« Appareil » peut sortir du Plan *sans* coûter un
onglet, ce que la question binaire de l'issue ne permettait pas d'envisager.

**#78 change de porte, et l'argument de son brief s'en trouve renforcé.** Sa Q1
recommande le catalogue comme ligne de l'index Plan, « de même nature que Règles
de progression ». Sous ce parcours l'index disparaît : le catalogue va donc là où
cet argument le mène vraiment — **sur la page Référence, à côté du manuel**. Deux
matériaux fournis, fermés, qu'on consulte et qui ne répondent jamais « qu'est-ce
que je fais maintenant ». La conséquence pratique est nulle : une ligne, un
`screen` dédié comme le brief l'exige déjà, et la barre reste à deux.

C'est aussi ce qui débloque #78 sans rouvrir la question du nombre d'onglets.

---

## 5. Les lots, dans l'ordre

| # | Lot | Niveau | Coût | Dépend de |
|---|---|---|---|---|
| 1 | **Casser les murs de texte** — `Block` gagne `h` (intertitre) et `ul` (liste) ; aucun paragraphe au-dessus de ~300 car. dans `plan.js` | C | faible | rien |
| 2 | **⚙ Réglages** — « Données » sort du Plan vers un écran plein, atteint par une icône d'en-tête | B | faible | #75 tranchée |
| 3 | **L'onglet atterrit sur le programme actif** — renommage, la carte devient la page, cinq lignes « Ce programme » | B | moyen | lot 2 |
| 4 | **Référence** — manuel unique à sommaire ancré, puis les liens contextuels de §3.3 | B | moyen | lot 3 |

Le lot 1 ne dépend d'aucune décision de navigation et c'est celui qui se voit le
plus vite : il traite la moitié « lisibilité » du reproche à lui seul. Il peut
partir avant que #75 soit tranchée.

Le lot 4 se découpe : le manuel ancré d'abord, les liens contextuels ensuite —
chacun a sa valeur seul.

---

## 6. Ce que je ne propose pas, et pourquoi

- **Revenir à l'accordéon.** Il savait ouvrir deux sujets à la fois, et c'est la
  seule chose qu'il savait faire de mieux. Le sommaire ancré du lot 4 rend ça
  sans reprendre ce qu'il coûtait : sept titres identiques qui ne disent pas ce
  qu'il y a dedans.
- **Les sous-onglets (piste 1b de la revue Design).** Méthode / Programme /
  Appareil en segmented control garde les trois métiers derrière le même écran et
  ne touche ni aux murs de texte ni au caractère destructif de l'import. Ça
  déplace le tri sans le résoudre.
- **Un onglet Réglages.** Voir §4 : le brief de #75 a raison, et le ⚙ obtient le
  même résultat sans dépenser un emplacement.
- **Quatre onglets.** Même avec #78, la barre reste à deux sous ce parcours.
