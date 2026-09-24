# Decisions — First launch (#19)

Source : [`spec.md`](spec.md)
Portée : **choix produit uniquement**. Les frontières de modules et la mécanique
d'écran appartiennent à `design.md`.
Statut : **tranché par Claude le 2026-09-24**, sur mandat d'autonomie de Simon
(« avance en autonomie, je teste en local »). Les quatre réponses sont en fin de
document, et chacune dit ce qui la ferait changer d'avis.

---

## Q1 — À quoi ressemble le premier lancement ?

- **A — Un écran d'accueil**, avant tout cycle : « Génère ton programme » /
  « Compose-le » / « Charge un fichier ».
- **B — Le programme neutre affiché, explicitement étiqueté démo**, avec une
  affordance « fais-le tien ».

**Recommandation : A.**

L'argument qui tranche n'est pas l'honnêteté de l'affichage — B peut être
honnête, l'étiquette est une ligne de texte. C'est **ce que B écrit dans le
journal.**

Sous B, la démo est un cycle comme un autre dès le premier geste : elle entre
dans `journal.programs`, elle apparaît dans le sélecteur de cycles, et
**l'application n'a aucun moyen de supprimer un cycle** — vérifié, il n'existe
pas d'affordance de suppression dans `App.jsx`. L'athlète qui génère ensuite le
sien se retrouve avec deux cycles à vie, dont un qu'il n'a jamais voulu, et le
seul moyen de s'en débarrasser est de vider le stockage du navigateur, c'est-à-dire
de tout perdre.

Ce n'est pas un détail d'écran, c'est une donnée qu'on impose. A ne l'impose
pas : tant que rien n'est choisi, rien n'est écrit.

**Ce que B avait raison de défendre**, et qui est retenu : une appli dont la
valeur est invisible tant qu'aucun programme n'existe ne peut pas ouvrir sur
trois boutons et du vide. L'accueil retenu **dit ce que l'appli fait** et laisse
une quatrième porte — « Regarder le programme fourni » — qui mène à l'appli
telle qu'elle est. La différence avec B tient en un mot : c'est un **choix**,
pas un défaut.

**Ce qui ferait changer d'avis :** qu'une affordance de suppression de cycle
existe. L'argument tombe alors entièrement, et B redevient défendable.

## Q2 — Comment l'appli sait-elle qu'elle est au premier lancement ?

**Rien à inventer, et c'est à confirmer plutôt qu'à décider.** `loadJournal()`
rend déjà `{ ok: false, reason: "absent" }` quand la clé n'existe pas en
stockage, et son commentaire le dit mot pour mot : « pas de clé : première
utilisation ».

**Décision : `reason === "absent"`, et rien d'autre.** Pas de booléen
« onboarded », qui serait un champ stocké — donc une migration — pour une
question à laquelle la donnée répond déjà. Le critère d'acceptation de l'issue
est tenu sans écrire une ligne de schéma.

**Les trois autres verdicts ne sont pas des premiers lancements**, et les
confondre serait un bug chacun :

| Verdict | Pourquoi ce n'est pas un premier lancement |
|---|---|
| `no-store` | Rien ne peut être stocké ; l'accueil reviendrait à **chaque** ouverture |
| `too-new` | Un journal existe, écrit par une version plus récente. L'appli refuse déjà de l'écraser — proposer de générer par-dessus serait une invitation à détruire |
| `corrupt` / `invalid` | Idem : le journal est là, illisible. Le message de récupération doit tenir l'écran |

## Q3 — La date de départ du cycle fourni bouge-t-elle ?

**Oui. C'est un bug à part entière, et il est bon marché.**

`public/programs/upper-lower-4j.json` porte `"startDate": "2026-09-14"`. Sur un
appareil ouvert en décembre, `slotForDate()` place aujourd'hui en semaine 13 et
l'écran annonce « Les 12 semaines sont terminées » — sur un programme que
personne n'a commencé. #39 n'a pas causé ça, il l'a rendu visible en rendant la
phrase juste.

**Décision : la date se calcule à l'usage, `nextMonday(today)`**, et le fichier
livré n'est pas modifié.

Deux raisons de ne pas toucher au JSON :

1. Une date figée dans un fichier livré est **exactement le défaut** — la
   changer ne ferait que déplacer la date à laquelle le bug revient.
2. `DEFAULT_DEFINITION` est comparé tel quel dans quatre fichiers de tests
   (`assertions`, `import`, `program`, `registry`). Le fichier est une donnée de
   référence ; la mouvance appartient au code qui s'en sert.

`nextMonday()` existe déjà (`src/program-editor.js`) et rend le jour même quand
on est lundi. C'est ce que `emptyDraft()` utilise pour un programme composé à la
main : un cycle fourni et un cycle composé doivent démarrer de la même façon.

## Q4 — Qu'est-ce qui remplace le pack comme histoire de distribution ?

**Rien, et c'est la réponse complète.**

Les quatre composants du pack ont chacun trouvé une place *dans* l'appli — le
registre (#25), le schéma (#33), la méthode (la spec du moteur), l'interrogatoire
(`GenerateProgram.jsx`, cinq questions). Il ne reste aucun consommateur.

« Distribuer un outil » (#18, 2026-09-09) se lit donc : **une URL et un
README**. L'appli porte le registre, le schéma, le moteur et le validateur ;
l'installer suffit à tout avoir.

**Décision : une ligne dans le README**, qui énonce la route — installer →
générer (cinq questions) → éditer si on veut → s'entraîner. Aucun artefact, aucun
code. La confirmation vaut surtout comme fermeture : c'est ce qui empêche le pack
de renaître par réflexe dans six mois.

---

## Ce qui se décide ici, en une ligne chacune

| | Question | Réponse |
|---|---|---|
| Q1 | À quoi ressemble le premier lancement ? | **A — un écran d'accueil avant tout cycle**, parce que B écrit un cycle indélébile dans le journal |
| Q2 | Comment l'appli le sait-elle ? | **`reason === "absent"`, seul** — aucun champ stocké, les trois autres verdicts n'en sont pas |
| Q3 | La date du cycle fourni bouge-t-elle ? | **Oui, `nextMonday(today)`, calculée à l'usage** — le fichier livré ne bouge pas |
| Q4 | Quelle distribution ? | **Une URL et un README.** Rien à construire, et le dire ferme la porte au pack |

**À relire par Simon.** Q1 est la seule qui engage un choix de produit plutôt
qu'une correction : si « je veux voir un programme en ouvrant l'appli » l'emporte
sur « je ne veux pas d'un cycle que je ne peux pas supprimer », c'est B, et le
changement est confiné à un écran.
