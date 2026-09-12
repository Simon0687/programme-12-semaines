# Audits externes

Analyses produites par des IA autres que celle qui développe le projet.

## Statut : consultatif

Ces documents ont valeur d'**avis**, pas de décision. Ils n'engagent ni la
roadmap, ni la priorisation, ni l'architecture. Claude garde la main sur la
conduite du travail : ce qui est retenu d'un audit passe par le circuit normal
du projet — une issue GitHub, puis `/spec` → `/decide` → `/design-tech` selon le
niveau (voir `.claude/WORKFLOW.md`).

Un audit n'est donc jamais appliqué tel quel. Il est lu, vérifié contre le code,
et ce qui survit à la vérification devient une issue.

## Vérifier avant de retenir

Un audit décrit le dépôt à un instant donné, et pas toujours correctement. Avant
qu'un finding devienne une issue, il doit être reproduit : le fichier et la ligne
existent, le comportement décrit est le comportement réel, la suite de tests
complète confirme le diagnostic.

Exemple concret, audit du 2026-09-12 : le finding F3 (`last.week` affiché alors
que `history()` ne renvoie plus ce champ depuis #16) a été vérifié et confirmé —
`src/App.jsx:125` contre `src/progression.js:47`. À l'inverse, plusieurs findings
de la même série décrivent `App.jsx` comme un monolithe portant encore le
stockage et la validation, ce que les extractions de #21, #22 et #25 ont déjà
traité.

## Organisation

```
docs/external_audit/<outil>/<modèle>/<date>-<sujet>.md
```

Chaque document indique en tête l'outil et le modèle qui l'a produit, pour que
l'origine d'un avis reste traçable.

Les revues produites par Claude lui-même vivent ailleurs, dans `docs/reviews/`.
