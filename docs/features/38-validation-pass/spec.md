# Spec — Full pass on validation (#38)

Issue : #38, `refactor`, `priority: medium`. Épic *Programme configurable*.
Source : Simon, 2026-09-12 — « je trouve qu'on a fortement complexifié la
validation d'import ».

## Niveau : A

Matrice `.claude/WORKFLOW.md`. Q1 non, Q2 non. **Q3 oui** : c'est le contrat de
validation qui se réorganise en travers de trois modules, pas un correctif
local. L'override des modules sensibles s'applique par-dessus — `storage.js` et
`import.js` sont nommément dedans.

## Mesuré sur `dev`, aujourd'hui

L'issue mesurait au merge de #33. Deux issues ont passé depuis (#34, #55), donc
la mesure est refaite avant de décider quoi que ce soit.

| | au merge de #33 | aujourd'hui |
|---|---|---|
| `src/journal-shape.js` | 352 lignes, 8 exports, 56 rejets | **469 lignes, 8 exports, 73 rejets** |
| `src/import.js` | 122 lignes, 12 raisons | 124 lignes, 12 raisons |
| `src/storage.js` | 118 lignes, 5 verdicts | 118 lignes, 5 verdicts |

**Où les 73 rejets se concentrent** — et c'est ce qui décide du périmètre :

| Fonction | Rejets | Ce qu'ils font |
|---|---|---|
| `validateProgram` | 28 | un champ du catalogue custom, un message avec son chemin |
| `validateDefinition` | 18 | idem, sur la définition |
| `validateCardio` | 15 | idem, sur les règles de conditionnement (#34) |
| `validateEnvelope` | 5 | ce qui empêche l'appli de rendre quoi que ce soit |
| `validateProgramEntry` | 3 | la forme d'un cycle stocké |
| `validatePreMigration` | 1 | l'ambiguïté de version, avant migration |

**61 des 73 rejets sont des contrôles de champ qui produisent un chemin JSON et
la règle enfreinte.** C'est l'exigence 4 de l'issue, pas de la complexité
accidentelle : les réduire, ce serait retirer ce que l'issue demande de garder.

## Ce que la mesure confirme, et ce qu'elle contredit

**Confirmé.**

- `unsupported-field` est **mort** : déclaré dans `IMPORT_MESSAGES`, émis par
  aucune ligne de code depuis que #25 a levé le refus global sur `program`.
- `storage.js` **jette le détail** : les 73 rejets deviennent tous `invalid`, et
  le panneau Données ne peut dire que « refusé », jamais pourquoi.
- Deux vocabulaires. Les raisons sont **produites** dans `journal-shape.js` et
  **déclarées** dans `import.js` : rien ne garantit que les deux listes
  coïncident, et c'est précisément comme ça qu'une raison morte survit.

**Contredit par la mesure, et c'est ce qui change le périmètre.**

- *« Rien ne branche sur `missing-field` vs `invalid-field` »* — exact, mais
  incomplet : `reason` n'est pas qu'une clé de branchement, c'est **la clé du
  message de repli**. Voir `decisions-spec.md` Q1.
- *« `not-a-program` vs `invalid-program` : deux raisons pour la même chose »* —
  la mesure dit non. Voir Q2.
- *« Trois fonctions de forme aux responsabilités qui se recouvrent »* — non
  plus. Les trois tournent à trois **moments** différents et à trois
  **sévérités** différentes. Voir Q3.

## Périmètre

**Dedans**

- Retirer ce qui est mort.
- **Une** déclaration du vocabulaire des raisons, à l'endroit où elles sont
  produites, et un test qui interdit qu'il diverge à nouveau.
- Faire remonter le détail jusqu'à `loadJournal`, sans changer ce sur quoi
  l'appli branche.

**Dehors**

- **Ajouter de la validation.** Non-objectif explicite de l'issue.
- **Réduire les 61 contrôles de champ.** Ils portent l'exigence 4.
- Le validateur de contenu des six assertions — autre métier, `assertions.js`.
- La convention `day` — réglée par #39.

## Critères d'acceptation

- [ ] Aucune raison déclarée n'est inémettable, aucune raison émise n'est
      indéclarée — **et un test le tient**, pour que ça reste vrai.
- [ ] Le vocabulaire est déclaré à un seul endroit.
- [ ] `loadJournal` rend le détail d'un refus ; le panneau Données peut dire
      *pourquoi* un journal stocké a été refusé.
- [ ] Ce sur quoi `App.jsx` branche (`too-new`, `invalid`, `corrupt`,
      `no-store`) est **inchangé**.
- [ ] Les cinq points de l'issue survivent : un seul appelé pour les trois
      portes, des verdicts jamais des jetés, la sévérité graduée, des messages
      adressables, les fixtures v1→v5 vertes sans y toucher.
- [ ] **Compte de comportements de rejet inchangé** : tout ce qui était refusé
      l'est encore, tout ce qui était accepté l'est encore. Les suites
      existantes sont la spécification.
- [ ] `npm test` en entier au vert.

## Questions ouvertes

Les quatre de l'issue. Voir [`decisions-spec.md`](decisions-spec.md) — **deux
reçoivent une réponse négative**, avec la mesure qui la soutient.
