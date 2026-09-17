# Decisions — Cardio is Simon's cardio or nothing at all (#34)

Source : [`spec.md`](spec.md)
Portée : **choix produit uniquement** — ce que `program.cardio` a le droit
d'exprimer. Le découpage en modules, la forme des écrans et celle des tests
appartiennent au tour `design.md`.
Statut : **en attente de la réponse de Simon.** Les recommandations ci-dessous
sont argumentées et prêtes à être appliquées.

---

## Ce qui a changé depuis la spec, et qui la débloque

La spec se terminait par : *« son answer depends on a product decision Simon
opened on 2026-09-12 — whether program generation moves into the app or stays
with an external LLM »*.

**Cette décision est tombée le 2026-09-15** : `docs/generation/decisions-moteur.md`
Q1 = **B, moteur déterministe dans l'app**, et Q4 = **A, écrans in-app, aucun
LLM**. #58 est dans `dev`. La dépendance que la spec nommait n'existe plus.

Trois mesures faites sur `dev` at f734f88, parce qu'elles déplacent les
arguments de la spec :

1. **Le moteur produit `cardio: null`** (`src/generator.js:555`) et **l'éditeur
   manuel aussi** (`src/program-editor.js:115`, décision #36 Q3). Autrement dit :
   *tout programme que l'application sait produire aujourd'hui est sans cardio.*
2. **`"default"` a exactement un utilisateur** : `public/programs/haut-bas-5j.json`.
   Le programme neutre livré dit `null`, et le validateur n'accepte rien d'autre
   que ces deux valeurs (`src/journal-shape.js:233`).
3. **`cardio: undefined` résout vers la règle bundlée**, pas vers rien
   (`buildProgram`, `src/program.js:57`) — un programme importé qui *oublie* le
   champ hérite du rameur de Simon sans l'avoir demandé. C'est un repli par
   omission, la forme la plus silencieuse du problème.

Un point de la spec est par ailleurs réglé : le suivi « `CARDIO_DAY_NOTES` est
indexé par `getDay()`, une seconde façon de dire où tombe une séance » est
traité par **#39**, livré dans `dev`. La table est désormais indexée comme
`SESSIONS[].day`, un décalage de 1 à 7 depuis `startDate`.

---

## Q1 — Que devient `program.cardio` ?

**La question.** `"default"` résout vers une règle écrite pour une personne :
« Rameur Z2 », ~105–115 W, 130–138 bpm, cadence 18–20, drag factor 110–120,
« mercredi, après Haut B », mobilité les mardi, jeudi et dimanche
(`src/cardio.js`).

Un fait neuf, et il ne vient pas d'un raisonnement. La revue Claude Design du
2026-09-17 dessine un onglet Plan où chaque sujet porte un **compte dérivé** du
programme actif — « 11 groupes · 7 séries max ». Sous cette forme, la section
cardio doit écrire quelque chose comme « 3 séances · mercredi, jeudi, dimanche ».
Le paragraphe actuel avait le droit d'être vague ; un compte, non
([triage §3](../../reviews/2026-09-17-plan-drill-in-triage.md)). La prose
bundlée tenait parce que personne ne lui demandait de chiffre.

### Option 1 — Le cardio devient de la donnée de programme

- **Ce que ça veut dire.** La définition porte son conditionnement : minutes,
  puissances, fréquences cardiaques, jours, intervalles, mobilité. `cardio.js` ne
  garde que ce qui est vraiment de la méthode. Le validateur contrôle le tout.
- **Pour.** Cohérent avec #25 : ce qui décrit un programme vit dans le programme.
  Aucun écran ne peut plus décrire le conditionnement d'un autre.
- **Contre, et c'est mesurable.** `cardioPlan(w)` encode une périodisation —
  paliers de Z2 par tranches de deux semaines, intervalles absents en S1, S7 et
  S12, recalibrage en S1. Porter ça en donnée, c'est **inventer un vocabulaire de
  périodisation avant que #14 n'ait défini le premier**, exactement ce que la
  spec s'interdit. Et l'élargissement bénéficie à qui ? Le moteur émet `null`.

### Option 2 — Le cardio reste une règle bundlée, honnêtement cadrée

- **Ce que ça veut dire.** `"default"` est documenté comme « le conditionnement
  de Simon », l'écran dit de quel programme il parle, et un programme qui veut
  autre chose déclare `null` et s'en passe.
- **Pour.** Une ligne de doc et une phrase d'écran. Le format reste fermé.
- **Contre.** Ça fige une zone de seconde classe, et surtout **ça ne survit pas à
  la première demande de chiffre** (voir plus haut). Ça laisse aussi le repli par
  omission de la mesure 3 : oublier le champ, c'est hériter du rameur.

### Option 3 — Séparer, et nommer le troisième terme

- **Ce que ça veut dire.** La spec proposait deux tas : les faits structurels
  (quels jours, combien de séances, quelle modalité) au programme, la courbe de
  périodisation à la méthode. **Il en manque un troisième, et c'est lui qui rend
  le découpage évident** : ~105–115 W et 130–138 bpm ne sont ni de la méthode ni
  de la structure. C'est une **charge de départ**. Ce sont les watts *de Simon*,
  au même titre que ses 87,5 kg au développé couché.

  L'application sait déjà découper une prescription de force en trois :

  | Force | Cardio, par le même découpage |
  |---|---|
  | `registry.js` — quels exercices existent | quelles modalités existent (rameur, vélo, marche inclinée…) |
  | `program.SLOTS` / `SESSIONS` — quel créneau quel jour | quelles séances de conditionnement, quels jours |
  | `definition.startingLoads` — les nombres de cet athlète | la puissance et la FC de départ de cet athlète |
  | `progression.js` — comment la charge évolue | `cardioPlan(w)` — comment les minutes montent |

  Le cardio n'a pas besoin d'un quatrième modèle. Il a besoin du même, appliqué.

- **Pour.** C'est la ligne que #25 a déjà tracée, prolongée d'un cran au lieu
  d'être rejouée. Aucun vocabulaire de périodisation nouveau : la courbe reste
  dans `cardio.js`, où #14 viendra la chercher avec celle des charges. Le
  validateur n'a que du structurel à vérifier — un jour de 1 à 7, une modalité
  connue, une référence de séance qui existe — et c'est exactement le genre de
  contrainte que #25 a montré qu'on savait fermer.
- **Contre.** Trois endroits touchés au lieu d'un, et il faut un petit catalogue
  de modalités (trois ou quatre entrées) là où il n'y en avait aucun.

**Recommandation : option 3.**

L'argument qui tient même si tout le reste est levé : **les watts ne sont pas de
la méthode.** Même en supposant que le moteur produise un jour du cardio, même en
supposant #14 livré et la périodisation généralisée, `~105–115 W` restera une
mesure faite sur un corps un jour donné. La ranger avec `cardioPlan` est une
erreur de catégorie, et c'est celle qui a produit le bug : ce n'est pas « la
prose est bundlée », c'est « la calibration d'une personne est stockée dans la
méthode ». L'option 2 laisse cette erreur en place et lui met une étiquette ;
l'option 1 la déplace en bloc dans le format sans la corriger.

---

## Q2 — La règle reste-t-elle indexée par numéro de semaine ?

**La question.** `cardioPlan(w)` place ses paliers sur S1, S7 et S12. Tout cardio
porté en donnée hérite de ces seuils, et #14 (« deloads and rotation driven by
policy and signal, not by week number ») existe précisément pour les supprimer.

- **A — Garder les numéros de semaine, et attendre #14.** La courbe reste dans
  `cardio.js` et continue de lire `w`. Quand #14 remplacera les numéros par une
  politique, il le fera pour les charges *et* pour le cardio, en un seul endroit.
- **B — Refuser d'encoder un numéro de semaine dans le format.** Le format ne
  porterait que des faits sans calendrier ; la périodisation attendrait #14.

**Recommandation : A**, et elle découle de Q1. Sous l'option 3 la courbe **ne
descend pas dans le format** : elle reste de la méthode. La question ne se pose
donc pas au format, seulement à `cardio.js`, qui a déjà le problème et le partage
avec `phaseOf()` et `setsFor()`. Créer un second vocabulaire de périodisation
maintenant, c'est garantir que #14 aura deux migrations au lieu d'une.

## Q3 — Que produit le moteur, une fois le format ouvert ?

**Pas dans la spec** — elle a été écrite avant que le moteur n'existe. La mesure
1 la rend obligatoire : #58 émet `cardio: null`, donc ouvrir le format sans rien
dire laisserait le moteur produire des programmes sans conditionnement dans une
application qui saurait désormais en exprimer.

- **A — Le moteur continue d'émettre `null`.** Le cardio devient exprimable pour
  les programmes importés et composés ; générer du conditionnement est une issue
  à part, avec sa question de collecte (« fais-tu du cardio ? combien de fois ? »).
- **B — Le moteur génère du cardio dès que le format l'accepte.** Il faut alors
  une question de plus à la collecte, un modèle de dose, et une assertion qui le
  juge — les six actuelles ne parlent que de musculation.

**Recommandation : A.** B ajoute une dimension d'entraînement au moteur alors que
#58 vient de livrer la première, et `decisions-moteur.md` Q4 a explicitement cadré
la collecte à cinq questions sans rien de présélectionné. Une sixième question se
décide, elle ne se glisse pas dans une issue de format. `null` reste par ailleurs
une réponse honnête : un programme de force sans conditionnement n'est pas un
programme incomplet.

---

## Conséquences, comme #34 les demande

**Pour #25.** L'option 3 **n'ouvre pas** le format au sens où #25 le craignait.
#25 a fermé le registre des exercices pour qu'un programme généré ne puisse pas
inventer d'identifiants ; l'option 3 applique le même remède au cardio — un
petit catalogue fermé de modalités — plutôt que d'ouvrir un champ de prose. Le
format gagne une structure vérifiable, pas une zone de texte libre. Un bump
**MINOR** de `DEFINITION_FORMAT_VERSION` : `"default"` et `null` restent valides,
et `"default"` doit continuer de résoudre exactement vers ce qu'il résout
aujourd'hui (ARCHITECTURE 2.1 — c'est le piège de `definition: null`, un champ
plus loin).

**Pour #19.** C'était le motif d'origine : *« a generated program that cannot
carry its own method prose ships with someone else's nutrition plan attached »*.
Sous l'option 3, un programme généré ne porte pas de cardio et n'hérite de celui
de personne — le repli par omission de la mesure 3 disparaît avec la clarification
du champ. #19 est de toute façon à réécrire pour d'autres raisons (le moteur a
remplacé le LLM externe) ; ce qu'il en reste de vrai sur le cardio est couvert
ici.

**Pour la nutrition.** La spec le notait : même classe de problème, prose bundlée
affichée quand un profil existe. L'option 3 renforce l'argument sans le trancher
— et le troisième terme vaut là aussi : un besoin calorique est une mesure sur
une personne, pas une méthode. À rouvrir après #34, pas pendant.

**Pour la revue design.** Le candidat D3 du
[triage du 2026-09-17](../../reviews/2026-09-17-plan-drill-in-triage.md) — un
compte dérivé sous chaque section du Plan — **ne peut pas être livré honnêtement
avant que Q1 ne soit tranchée.** C'est l'ordre : #34, puis D3, puis D4.

---

## Ce qui se décide ici, en une ligne chacune

| | Question | Recommandation |
|---|---|---|
| Q1 | Que devient `program.cardio` ? | **Option 3** — structure au programme, watts aux charges de départ, courbe à la méthode |
| Q2 | Le format encode-t-il des numéros de semaine ? | **Non, A** — la courbe ne descend pas dans le format ; #14 garde un seul chantier |
| Q3 | Le moteur génère-t-il du cardio ? | **Non, A** — une sixième question de collecte se décide à part |

**Décision de Simon.** _(à remplir)_
