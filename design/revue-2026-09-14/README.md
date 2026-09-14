# Revue de design des 4 écrans — maquettes (2026-09-14)

Copie locale du canvas Claude Design « Application log de musculation »
(`38382bbc-b120-4ce1-ba6c-497ec9205f58`), rapatriée le 2026-09-14 pour que les
maquettes survivent au projet distant.

## Ce qu'il y a ici

| Fichier | Rôle |
|---|---|
| `Revue de design.dc.html` | le canvas entier — 6 artboards, copie exacte |
| `support.js` | runtime `dc-runtime` qui interprète `<x-dc>` |
| `_ds/nocturne-…/styles.css` | tokens du design system Nocturne |
| `_ds/nocturne-…/_ds_bundle.js` | bundle du DS (vide : Nocturne n'a pas de composant JS) |

Les six artboards vivent dans un seul fichier, en sections ancrées : `#1a`
Semaine, `#1b` Séance, `#1c` Fiche exo, `#1d` Plan, `#1e` Plan › Progression,
`#1f` Plan › Volume. Pas de `canvas.json` ici, contrairement à
`design/fiche-exercice/` et `design/seance-allegee/` où chaque artboard est un
fichier.

## Ouvrir

Ouvrir `Revue de design.dc.html` directement dans un navigateur. Les artboards
sont stylés en `style="…"` inline avec les valeurs Nocturne écrites en dur : ils
s'affichent sans dépendre de `styles.css`, qui n'apporte ici que la police Inter
(via Google Fonts) et sert d'archive du système.

## Ce qui n'a pas pu être rapatrié

Les quatre captures d'écran sur lesquelles la revue s'appuie
(`uploads/Screenshot_20260914_2212*.jpg`, des captures longues de 1440 × 11206 px)
dépassent la limite de 256 Kio du connecteur et n'en reviennent que tronquées.
Elles restent dans le projet Claude Design, et sur le téléphone.

C'est une limite à connaître : les trois « bugs » annoncés par la revue viennent
de ces captures, et deux d'entre eux sont réfutés par le code. Voir
[docs/reviews/2026-09-14-design-review-triage.md](../../docs/reviews/2026-09-14-design-review-triage.md).

## Statut

Consultatif. Le texte argumenté de la revue est versionné à part, dans
[docs/external_audit/Claude Design/2026-09-14-revue-4-ecrans.md](../../docs/external_audit/Claude%20Design/2026-09-14-revue-4-ecrans.md) ;
la vérification contre le code est dans `docs/reviews/`. Rien de tout cela n'est
décidé : les 7 issues candidates attendent l'arbitrage de Simon.
