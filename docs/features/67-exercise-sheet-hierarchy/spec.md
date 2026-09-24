# Spec — Fiche exercice : hiérarchie, et une couleur un sens (#67)

Issue : #67, `feat`, `priority: low`. Épic *Design & lisibilité*.
Source : revue Claude Design du 2026-09-14 §1c, triée dans
`docs/reviews/2026-09-14-design-review-triage.md` (C2, B4, F2), plus l'usage de
Simon du 2026-09-24.

## Niveau : B

Matrice `.claude/WORKFLOW.md`. Q1 non, Q2 non, Q3 non — aucune donnée, aucune
règle. Q4 **oui** : `alert` est un token global, sa valeur change sur les six
écrans qui l'emploient. → **Niveau B**.

## Ce qui était déjà livré, et qu'il fallait vérifier avant de recoder

Trois des cinq points de §1c sont derrière nous, et les rouvrir aurait été du
travail perdu :

| Point de la revue | État |
|---|---|
| 1c.1 échelle de l'axe, l'écart écrit en chiffres | livré en #49 |
| 1c.2 records, une seule donnée par ligne | la règle a changé en #63 ; la forme en cartes reste écartée, voir plus bas |
| 1c.3 trois barres ambre/grises → une barre empilée, une teinte | livré en #49 (`share-1..4`) |
| 1c.4 hiérarchie typographique | **fait ici** (le chiffre de tête l'avait été en #49) |
| 1c.5 étiquettes « ancre des deux blocs » sous le titre | **écarté** — voir plus bas |

## Ce que fait cette issue

**1. `alert` quitte la famille ambre.** C'est la raison d'être de #51, qui
l'annonçait mot pour mot : « séparer deux sens devient l'édition d'une ligne
ici ». Une erreur écrite de la couleur d'une valeur n'alerte pas — « Prévu :
28 kg » et « Charge invalide » se lisaient dans le même ambre à quelques
centimètres l'un de l'autre. `alert: colors.red[400]`, une ligne, six écrans.

Les cinq autres tokens ambre restent groupés. #51 avait tranché cette
granularité avec Simon (« C2 only needs `alert` to leave the family; the rest
can travel together until something says otherwise »), et rien dans l'usage du
2026-09-24 ne dit le contraire : `notice`, `badge` et `accent` ne disent pas un
refus, `alert` est le seul qui le dise.

**2. Les intertitres descendent d'un cran.** « Records », « Historique »,
« Technique », « Détails » étaient en 14 px, la taille des valeurs qu'ils
introduisent. Ils passent en petites capitales — la forme exacte des
intertitres de groupe de l'index du Plan (`PlanIndex`, #62), parce que deux
écrans qui nomment un groupe de contenus doivent le nommer pareil.

## Deux propositions écartées, et pourquoi

**Les records en cartes (1c.2).** La revue voulait « trois cartes par nombre de
reps, les non tentées visibles — elles disent quoi viser ». Une carte pour une
paire de nombres coûte trois fois la place d'une ligne, et #63 vient de réduire
la table à une ligne par charge : le vide de 200 px que la revue a photographié
n'existe plus. Surtout, « les non tentées visibles » demanderait d'inventer des
lignes que personne n'a faites, dans une table dont toute la valeur est de ne
contenir que de la donnée observée (`recordsFor`, « aucun modèle »).

**Les étiquettes d'ancre (1c.5).** Savoir qu'un exercice est une ancre des deux
blocs se lit dans le programme actif, pas dans le registre : la fiche s'ouvre
depuis n'importe quel cycle, y compris un cycle terminé dont l'exercice n'est
plus prescrit. L'étiquette serait vraie ou fausse selon le cycle qu'on regarde
— exactement le piège que #34 a fermé ailleurs. À reprendre le jour où la fiche
saura de quel cycle elle parle.

## Critères d'acceptation

- [x] Sur cet écran, aucune couleur ne porte deux sens : l'ambre n'y désigne que
      la courbe, les intertitres et les valeurs sont dans l'échelle de gris.
- [x] Une erreur de saisie ou d'import est rouge, partout dans l'app.
- [x] La répartition musculaire se lit comme des parts sommant à 100 % (#49,
      vérifié inchangé).
- [x] Aucun littéral de couleur dans le JSX (#51).
- [x] `npm test` vert (902).
