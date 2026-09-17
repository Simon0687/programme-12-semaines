# Claude Design — Onglet Plan, trois refontes (2026-09-17)

**Outil :** Claude Design (claude.ai/design)
**Projet :** `251f1f2f-92bb-4d41-9ce0-8b159b77b5e9` — fichier `Onglet Plan.dc.html`
**Lu par la revue** (son `github.md`, sync du 2026-09-17T09:40Z) : `src/App.jsx`
(l. 71-84 `Section`, 938-1010 écran Plan, 1039-1071 `Block`/`PlanContent`,
727-738 en-tête, 1022-1032 nav), `src/plan.js`, `src/progression.js` (`phaseOf`),
`public/programs/upper-lower-4j.json`, `tailwind.config.js`.

Statut : **consultatif** (voir [README](../README.md)). Ce fichier transcrit ce
que la revue propose ; ce que le projet en retient est dans
[docs/reviews/2026-09-17-plan-drill-in-triage.md](../../reviews/2026-09-17-plan-drill-in-triage.md).

---

## Ce que la revue a produit

Un canevas de quatre maquettes à 390 × 844, dont une reconstitution de l'existant :

| Id | Proposition |
|---|---|
| **0a** | État actuel, recréé depuis le code — 8 sections en accordéon, dont 6 en paragraphes pleins |
| **1a** | Une page qui respire — sommaire ancré, texte réduit à une ligne par règle |
| **1b** | Sous-onglets — Méthode / Programme / Données, un tap par intention |
| **1c** | **Drill-in** — le Plan devient un index, chaque sujet a sa page |

Différence de méthode avec la revue du 2026-09-14 : celle-ci **a lu le code**
avant de dessiner, `App.jsx` compris. La revue précédente avait jugé le Plan
depuis `plan.js` seul et conclu à un mur de 5 000 px, sans voir l'accordéon
([triage du 2026-09-14](2026-09-14-revue-4-ecrans.md), §R5).

---

## 1c — Drill-in, transcription

### L'index

**En-tête** — « Plan », puis en 12 px gris : « Référence du programme. Les
modifications se font dans le chat. »

**Carte du programme actif** — nom (`Upper/Lower 4 jours`), sous-titre
`S{{ week }} sur 12 · {{ phaseLabel }}`, pastille `actif` en contour ambre ;
dessous, un bouton pleine largeur « Exporter le journal » et un bouton carré
d'engrenage.

**Trois groupes de lignes**, chacun précédé d'un intertitre 11 px en petites
capitales espacées :

| Groupe | Ligne | Sous-titre |
|---|---|---|
| **La méthode** | Structure des 12 semaines | Calibration, bloc 1, décharge, bloc 2, bilan |
| | Progression | 6 règles · incréments de charge |
| | Décharge | 5 déclencheurs · 2 recettes |
| **Ce programme** | Volume par groupe | 11 groupes · 7 séries max |
| | Plan de repli | 3, 2 ou 1 séance dans la semaine |
| | Charges de départ | Aucune enregistrée — paliers en S1 |
| **Appareil** | Données et sauvegardes | Export 12 sept. · stockage persistant |

Chaque ligne est un `<button>` pleine largeur : icône ambre 18 px, titre 15 px,
sous-titre 12 px gris, chevron droit, filet de séparation en bas. Pas de zone
de texte, pas d'accordéon.

### La page

En-tête : un bouton retour ambre « ‹ Plan », puis le titre de la page en 20 px.
Corps : le contenu **intégral** du sujet, un seul par page.

Contenus dessinés :

- **Structure des 12 semaines** — une frise de 12 cases numérotées en tête, puis
  les cinq phases en lignes `S1 / S2–S6 / S7 / S8–S11 / S12`, puis le paragraphe
  des ancres et le point volume de S4.
- **Progression** — les règles en lignes condition → effet (« Toutes les séries
  au haut de la fourchette → +1 cran », « ≥ 2 séries sous la fourchette → charge
  tenue », « Ça se répète → −5 % », « Calibration S1 et S7, tout en haut →
  +5 % », « Une série sous le bas en calibration → −5 % », « Séance marquée
  allégée → référence gardée »), puis le tableau des crans (barre haut +2,5 kg,
  barre bas +5 kg, haltères +2 kg, machine/poulie +5 kg), puis les cas
  particuliers en prose.
- **Décharge** — « Déclencheurs, un seul suffit » en cinq lignes, puis deux
  recettes côte à côte (décharge complète : volume −50 %, charges −10 à −20 %,
  RIR 3–4, mêmes exercices ; allègement ciblé : en prose).
- **Volume par groupe** — le tableau des 11 groupes, colonne « d'où viennent les
  séries » (`Upper A 4 + Upper B 3`) et colonne total, puis la note « une série
  dure = une série de travail à 1 RIR ou à l'échec ».

### Ce que la revue propose d'essayer ensuite

« garde 1c mais avec la frise de 1a sur l'index » · « fusionne 1b et 1c :
sous-onglets + pages dédiées » · « montre l'état vide, sans programme chargé ».
