# Design technique — Dated cardio and check-in (#29)

Source : [`spec.md`](spec.md), [`decisions-spec.md`](decisions-spec.md).

---

## Décision 1 — `weekStartKey()` vit dans `schema.js`, à côté de `weekKey`

`weekStartKey(startDateIso, week)` = `dateForSlot(startDateIso, week, 1)`.

Elle est déclarée là où vivait celle qu'elle remplace, et `weekKey` **reste
exportée** : c'est la forme que `MIGRATIONS[4]` doit savoir reconnaître dans les
journaux déjà écrits, et la nommer vaut mieux qu'un littéral répété dans une
expression régulière. Son en-tête dit désormais que plus personne ne l'écrit.

`schema.js` reste une feuille — la nouvelle fonction n'appelle que `dateForSlot`,
qui est dans le même fichier.

## Décision 2 — `MIGRATIONS[4]` n'a besoin d'aucun `ctx`, et c'est une propriété de la v4

`MIGRATIONS[2]` devait recevoir `{ legacyDefinition, buildProgram }` parce qu'un
journal v2 pouvait porter `definition: null` — une *référence* au bundle, résolue
à la lecture.

Depuis #26 (v4), **chaque programme porte sa définition épinglée**. La
`startDate` dont la migration a besoin est donc déjà dans l'entrée qu'elle est en
train de convertir, et chaque cycle se date contre la sienne. La règle de #16 est
reprise mot pour mot : la date d'une semaine se dérive du programme sous lequel
elle a été tenue, jamais de celui que l'appli embarque aujourd'hui.

## Décision 3 — Une clé non reconnue traverse ; elle ne fait pas refuser le journal

C'est la seule décision où ce design **s'écarte** de #16, et l'écart est
délibéré.

`MIGRATIONS[2]` lève sur une clé de log qu'elle ne sait pas interpréter, et
c'était juste : perdre une séance en silence est inacceptable, et il n'existait
aucun repli sûr. Ici le calcul est différent — l'issue le dit elle-même, ni
`planned()` ni `history()` ne lisent ces données. **Faire perdre l'accès à deux
ans d'historique d'entraînement pour une clé cardio inattendue serait hors de
proportion.** C'est le raisonnement de #32 sur les lignes illisibles, tenu une
étape plus tôt.

Une clé qu'on ne sait pas convertir traverse intacte, et le lecteur ne la
trouvera simplement pas — exactement ce qui lui arrivait déjà avant la migration.

**Et ça donne l'idempotence gratuitement.** Une clé déjà datée ne matche pas
`^w(\d+)$`, donc rejouer l'étape ne change rien : la migration n'a pas besoin de
savoir si elle est déjà passée. C'est vérifié sur un vrai journal, pas seulement
en unitaire.

## Décision 4 — Une `startDate` inexploitable garde la clé d'origine

Les définitions des cycles **inactifs** ne sont pas validées au chargement (#32,
Q2) : une `startDate` absente ou hors format est atteignable, et `dateForSlot` y
rendrait `"NaN-NaN-NaN"`.

Écrire cette chaîne serait une donnée perdue sans le dire. La clé d'origine est
donc conservée : **une clé lisible vaut mieux qu'une clé fausse.** Le contrôle
porte sur le format de la `startDate` *et* sur le résultat, parce que les deux
peuvent échouer séparément.

## Décision 5 — Aucun champ de synchronisation

Conformément à Q2 : pas d'`id`, pas d'`updatedAt`, pas de `deletedAt`. La clé
**est** la date, dérivée de la donnée — il n'y a rien à engendrer, donc rien à
faire collisionner entre deux appareils. Et rien n'affiche la date de saisie d'un
check-in.

## Ce que ça touche dans `App.jsx`

Huit lignes, quatre lectures et trois écritures, toutes mécaniques :
`weekKey(week)` devient `weekStartKey(definition.startDate, week)`. Après quoi
`weekKey` n'apparaît plus une seule fois dans `App.jsx`.

## Tests

**`test/schema.test.js`** — huit cas neufs sur `MIGRATIONS[4]` : les clés
converties, la date tirée de la `startDate` du programme, chaque cycle contre la
sienne, l'idempotence, la clé inconnue qui traverse, les cinq formes de
`startDate` inexploitable, les maps vides ou absentes, et la non-altération de
l'argument. Plus deux cas sur `weekStartKey`, dont celui qui énonce le défaut
corrigé comme une propriété : deux passages ne partagent aucune clé.

**`test/journal-compat.test.js`** — le plancher de compatibilité monte d'une
version, et c'est le fonctionnement prévu de ce fichier. Son en-tête interdit
d'assouplir une assertion pour faire passer un changement ; ici ce ne sont pas
les assertions qui s'assouplissent, c'est **le contrat qui change** :

- un `v5.json` est ajouté, avec **deux** semaines datées — assez pour que
  l'idempotence se vérifie sur un vrai journal ;
- la v4 rejoint la liste des versions qui migrent, et son test vérifie
  désormais que ses séances ne bougent pas pendant que son cardio se date ;
- la boucle des sauvegardes d'avant-migration gagne `v4`.

Une assertion de `schema.test.js` disait « #16 ne touche pas cardio/checkin
(#29) » — elle nommait déjà l'issue qui allait la retourner. Elle est réécrite,
pas supprimée.

**Vérifié en plus sur le vrai chemin** (script jeté après coup) : un journal v4
chargé par `loadJournal()` migre avec sa copie de sécurité, deux passages du même
programme coexistent après un aller-retour en stockage, et la première semaine du
premier cycle survit intacte.

## Critères d'acceptation, et où ils se vérifient

| Critère (spec) | Vérifié par |
|---|---|
| Clés datées, jamais `w{n}` | `weekStartKey`, plus aucun `weekKey` dans `App.jsx` |
| Deux passages n'écrasent rien | `schema.test.js`, et l'aller-retour en stockage |
| Migration automatique, bonne semaine | `journal-compat.test.js`, fixtures v1→v4 |
| Bilan / Semaine justes de part et d'autre d'un cycle | les quatre lectures lisent la même clé que les écritures |
| Copie avant réécriture | `backupOnce` via `migrate()`, boucle de sauvegarde étendue à v4 |
| Migration idempotente | décision 3, vérifiée en unitaire et sur `v5.json` |
| `npm test` entier au vert | 835 |
