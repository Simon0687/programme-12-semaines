# Design technique — Deviate from the program for one session (#55)

Source : [`spec.md`](spec.md), [`decisions-spec.md`](decisions-spec.md) (tranché
le 2026-09-24 : Q1 = B, Q2 = A, Q3 = C).

Q4 et Q5 sont livrées depuis le 2026-09-17 (`c943d59`). Ce document ne couvre que
**la substitution**, la moitié restante.

---

## Le problème, en une phrase de code

`vid = prog.SLOTS[slotId][blockOf(week)]` est écrit **six fois** dans
l'application, et chacune de ces six lignes répond à la question « quel exercice
ce créneau porte-t-il ? » en ne regardant que le programme. La substitution est
exactement l'affirmation que le journal a, parfois, une réponse différente.

| Lieu | Ce que la ligne sert |
|---|---|
| `App.jsx` `ExerciseCard` | l'exercice que la carte affiche et sous lequel elle saisit |
| `App.jsx` rendu Séance (×2) | les `rows` passées à la carte |
| `App.jsx` `sessionSets` | ce que `validate()` écrit |
| `App.jsx` `bilanText` / `keyLines` | l'exercice dont le bilan parle |
| `progression.js` `planned()` | l'historique sur lequel le moteur se prononce |
| `App.jsx` liste Semaine | le résumé de la ligne de séance |

Corriger six sites en ligne serait six occasions de diverger. **Un seul module
répond désormais à la question**, et les six sites l'appellent.

## Décision 1 — Un module, `src/session-sub.js`, au-dessus de `progression.js`

Il porte quatre fonctions pures et rien d'autre :

```
prescribedVid(prog, slotId, week)   -> l'exercice du programme, inchangé
vidFor(prog, log, slotId, week)     -> celui du journal s'il y en a un, sinon le programme
withSub(log, slotId, vid, prescribed) -> le prochain `sub` (ou son absence)
takenVids(prog, log, session, week) -> les exercices que les autres créneaux tiennent déjà
```

**Pourquoi un module et pas une méthode de `progression.js`.** `sub` est une
donnée de journal, pas une règle de progression : le moteur doit continuer à
pouvoir répondre « quelle charge pour cet exercice » sans rien savoir des
créneaux. Le module importe `blockOf` de `progression.js` et se range donc
exactement là où vivent `display.js` et `exercise-history.js` — au-dessus du
moteur, jamais l'inverse (ARCHITECTURE §1). Le moteur reste une feuille.

**`vidFor` est tolérante par construction.** Un `sub` qui désigne un exercice
absent du bundle (`prog.V[vid]` indéfini — un programme édité entre deux visites,
cas limite de la spec) retombe sur l'exercice prescrit **au lieu de lever**. Un
jeté pendant le rendu ne laisse pas un écran en erreur, il démonte l'application
entière (App.jsx:1113 porte déjà ce raisonnement, mot pour mot).

## Décision 2 — `planned()` reçoit le `vid`, elle ne le calcule plus

`planned(prog, state, slotId, week, si, date, vid)` — septième paramètre
optionnel, défaut `slot[blockOf(week)]`.

C'est le seul changement de signature du moteur, et il est **rétro-compatible au
caractère près** : les appels existants ne passent pas le paramètre et obtiennent
l'exercice prescrit, comme avant. C'est ce qui permet à
`test/progression.test.js` de rester intact.

**Ce que ça produit à l'écran, et c'est la spec :** la fourchette de reps, le RIR
et le repos restent **ceux du créneau** — c'est le programme qui prescrit — tandis
que la charge prévue devient celle du remplaçant, lue dans **son** historique à
lui via `historyBefore(prog, state, vid, …)`. Un remplaçant jamais fait rend
« Paliers » ou sa charge de départ, sans cas particulier : c'est le chemin
`!base` qui existe déjà.

## Décision 3 — Le sélecteur sort de `ProgramEditor.jsx`

`Picker` (ProgramEditor.jsx:153) devient `src/ExercisePicker.jsx`, exporté, avec
deux props de plus :

- `initialFacets` — Q3 = C : la Séance l'ouvre avec `{ pattern }` du créneau
  pré-coché. L'éditeur ne passe rien et garde ses trois facettes vides.
- `disabledIds` + `disabledNote` — voir décision 4.

Le composant ne gagne aucune logique : `filterExercises()` et `FACET_VALUES`
restent dans `exercise-filter.js`, qui ne bouge pas. C'est un déplacement de
balisage, et `ProgramEditor.jsx` perd 45 lignes.

## Décision 4 — Substituer vers un exercice déjà tenu par la séance est refusé

C'est le cas limite que la spec signale et le seul qui corrompt vraiment :
`ex` est indexé par exercice, donc si le créneau A passe sur l'exercice du
créneau B, `ex[B]` porte les séries des deux et la fiche exercice compte une
séance de dix séries. Rien ne les redémêle après coup.

Le sélecteur rend ces entrées **visibles et inertes**, avec la raison écrite
(« déjà dans cette séance »), plutôt que de les masquer. Une entrée absente d'un
registre fermé se lit comme une panne — c'est l'argument que
`exercise-filter.js` tient déjà sur les facettes vides.

## Décision 5 — Rechoisir l'exercice prescrit efface la marque

`withSub()` supprime l'entrée quand `vid === prescribed`, au lieu d'écrire
`sub[slotId] = prescribed`. Deux raisons, et la seconde est la vraie :

1. Annuler une substitution ne demande aucune affordance de plus — on rouvre le
   sélecteur et on reprend l'exercice du programme.
2. **Une marque « substitué » posée sur l'exercice prescrit serait fausse.**
   L'état du journal doit rester en bijection avec ce qui s'est passé, sinon la
   relecture à six semaines ment, ce qui est le défaut que Q1 existe pour
   éliminer.

Un `sub` devenu vide est retiré de la ligne (`{}` n'est pas écrit) : l'absence du
champ reste la forme canonique de « aucune substitution ».

## Décision 6 — Les séries de l'exercice abandonné ne sont pas effacées

Substituer A → B laisse `ex[A]` tel quel s'il portait déjà des séries. Le module
ne supprime rien.

**Pourquoi.** Effacer serait une perte de données décidée par un geste qui ne
l'annonce pas. Et le cas où ça compte est réel : on fait deux séries au
développé, la machine se libère, on bascule — ces deux séries ont eu lieu, elles
appartiennent à l'historique du développé. `history()` les lira sous A,
`keyLines` nommera B, et les deux disent la vérité.

La conséquence assumée : l'écran ne montre plus les séries de A une fois la
substitution posée. Elles sont dans la fiche exercice de A (#17), qui est
l'endroit qui les concerne.

## Décision 7 — `journal-shape.js` valide la forme, pas le contenu

`isLogRow()` gagne une ligne : `if (row.sub != null && !isObj(row.sub)) return false`.

Rien de plus. Pas de vérification que les valeurs sont des exercices du registre,
pas de vérification que les clés sont des créneaux connus : `vidFor()` retombe
déjà sur le prescrit pour tout ce qu'elle ne reconnaît pas, et un journal n'a pas
à être refusé pour un champ dont la lecture est sûre. C'est la règle que
l'en-tête de `isLogRow` énonce déjà — « volontairement minimale ».

**Aucun bump de `SCHEMA_VERSION`, aucune migration**, conformément à Q1 : il
n'existe aucun journal dont la lecture change.

## Ce que ça donne à l'écran

**Carte d'exercice substituée.** Le nom affiché est celui du remplaçant. Sous le
nom, une ligne de marque : `Remplace Développé couché barre`. La ligne de
prescription (`3 × 6–8 reps, RIR 1`) est inchangée — c'est le créneau qui parle.

**L'affordance.** Un bouton « Remplacer » à côté du minuteur de repos, toujours
présent, y compris sur une carte déjà substituée (c'est par lui qu'on revient au
prescrit).

**Bilan.** `keyLines` lit `vidFor()` au lieu du prescrit, et nomme les deux quand
ils diffèrent : `Développé couché barre → Développé haltères : 30 → 32,5 kg 8/8/8`.
Une ligne qui disparaissait se lit « pas fait », ce qui est faux — Q2 = A.

## Tests

`test/session-sub.test.js`, nouveau — les quatre fonctions, dont :

- deux substitutions dans la même séance s'apparient chacune à son créneau ;
- un `sub` vers un exercice absent du bundle rend le prescrit, sans lever ;
- rechoisir le prescrit retire l'entrée, et la dernière retirée retire `sub` ;
- `takenVids` compte les créneaux **résolus**, pas les prescrits — deux
  substitutions en chaîne ne doivent pas rouvrir le trou qu'elles ferment.

`test/progression.test.js` gagne un cas : `planned()` avec un `vid` explicite lit
l'historique de cet exercice-là. Le reste du fichier ne bouge pas, et c'est la
vérification que la décision 2 est bien rétro-compatible.

`test/journal-shape.test.js` : un `sub` objet passe, un `sub` chaîne ou tableau
fait écarter la ligne.

`test/bilan.test.js` : `buildBilan` n'apprend rien — la flèche est construite par
`App.jsx`, qui est déjà l'endroit qui connaît `prog`. Le module reste une feuille
(#41, décision 2).

## Critères d'acceptation, et où ils se vérifient

| Critère (spec) | Vérifié par |
|---|---|
| Substitution pour cette séance seulement | `session-sub.test.js` + `sub` porté par la ligne de date |
| Séries sous l'identifiant du remplaçant, `definition` intacte | `sessionSets()` lit `vidFor()`, `definition` n'est pas dans le chemin d'écriture |
| Séance rouverte → le remplaçant s'affiche | `vidFor()` au rendu, `session-sub.test.js` |
| Semaine suivante identique | `sub` vit sur `(date, slot)` : l'occurrence suivante est une autre ligne |
| Marque visible | ligne « Remplace … » sur la carte |
| Aucun champ de premier niveau ajouté | décision 7 |
| `npm test` entier au vert | — |
