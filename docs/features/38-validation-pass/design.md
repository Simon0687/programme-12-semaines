# Design technique — Full pass on validation (#38)

Source : [`spec.md`](spec.md), [`decisions-spec.md`](decisions-spec.md).

Deux décisions sur quatre sont négatives, donc ce document est court : il n'y a
que deux changements, et le reste de la passe est une justification écrite de ce
qui **n'a pas** bougé.

---

## Changement 1 — `REJECTIONS` vit dans `journal-shape.js`

Le vocabulaire est déclaré là où les raisons sont produites, et `import.js` le
réexporte sous `IMPORT_MESSAGES` — le nom qu'`App.jsx` importe déjà. Aucun
appelant ne change.

**`unsupported-field` disparaît.** Il était déclaré et émis par personne depuis
que #25 a levé le refus global sur `program`.

**Et surtout : il ne peut plus revenir.** `test/journal-shape.test.js` vérifie la
bijection dans les deux sens, en lisant le source des trois modules :

- aucune raison déclarée qui ne soit émise quelque part — le sens qui aurait
  attrapé `unsupported-field` le jour même, au lieu de deux issues plus tard ;
- aucune raison émise qui ne soit déclarée — l'autre sens, celui où une raison
  sans phrase s'afficherait comme `undefined` ;
- chaque phrase est une phrase : plus de vingt caractères, terminée. Un
  identifiant recopié comme message ne passe pas.

**Le test lit le texte du source, pas le comportement, et c'est délibéré.** Ce
qu'on veut interdire est qu'une ligne existe sans emploi : c'est une propriété
du fichier, pas de l'exécution. Les 73 comportements de rejet sont couverts
ailleurs, par les tests qui les provoquent.

**Vérifié en le cassant.** Une raison morte a été réintroduite exprès : le test
échoue. Un test de garde qu'on n'a pas vu échouer ne garde rien.

## Changement 2 — `loadJournal` porte `detail`

Trois points de refus de `storage.js` transportent désormais la phrase du
validateur, et `App.jsx` la concatène au message de chargement.

`reason` ne change pas — mêmes cinq valeurs, mêmes quatre branches dans
`App.jsx`. C'est ce qui garantit que l'ajout ne peut pas casser le chemin de
chargement, et c'est pour ça que c'est un ajout et non un remplacement.

## Ce que ça a coûté aux tests, et pourquoi ce n'est pas un assouplissement

Onze assertions de `test/storage.test.js` figeaient l'objet entier :
`assert.deepEqual(res, { ok: false, reason: "invalid" })`. Elles cassaient toutes
à l'ajout de `detail`, **sans qu'aucun comportement de rejet ne change**.

Elles sur-spécifiaient : ce qu'elles veulent dire est « refusé, pour cette
raison, sans lever ». Elles passent par un helper `rejected(res, reason)` qui dit
exactement ça. Le détail, lui, a ses propres tests — quatre, dont un qui vérifie
que les verdicts sans détail (`absent`, `no-store`) n'en inventent pas.

C'est la distinction qui compte : on n'a pas relâché une assertion pour faire
passer un changement, on a retiré d'une assertion ce qu'elle n'avait jamais
voulu affirmer.

## Ce qui n'a pas bougé, et c'est l'essentiel du travail

| L'issue proposait | Verdict | Pourquoi |
|---|---|---|
| Réduire le vocabulaire des raisons | **Non** | `reason` est la clé du message de repli, pas seulement une clé de branchement |
| Fusionner `not-a-program` et `invalid-program` | **Non** | Deux actions différentes : « change de fichier » et « corrige cette ligne » |
| Fondre les trois fonctions de forme | **Non** | Trois moments, trois données, trois sévérités — et trois bugs documentés |
| Réduire les 61 contrôles de champ | **Hors périmètre** | Ils portent l'exigence 4 de l'issue elle-même |

Les cinq points de « ce qui doit survivre » sont intacts : un seul appelé pour
les trois portes, des verdicts jamais des jetés, la sévérité graduée, des
messages adressables, les fixtures v1→v5 vertes sans y toucher.

## Mesure finale

| | avant | après |
|---|---|---|
| Raisons déclarées | 12 | **11**, et la liste est vérifiée |
| Listes de raisons | 2 (produite / déclarée) | **1** |
| Détail perdu par `loadJournal` | 73 rejets → `invalid` nu | la phrase remonte |
| Tests | 838 | **845** |

L'issue demandait « less of it ». Le gras qu'elle visait n'existait pas là où
elle le cherchait : ce qui restait était une raison morte et une duplication de
liste. Les deux sont retirées, et la seconde ne peut plus se reformer.
