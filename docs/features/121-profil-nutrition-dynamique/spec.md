# Spec — Profil et Nutrition dynamiques (#121)

Issue : #121. Suite à la réflexion du 2026-09-26 sur les sections hardcodées
du Plan (#120/#121/#122).

## Niveau : A

Matrice `.claude/WORKFLOW.md`. Nouvelle compétence du moteur (Q3 oui).

## Contexte

`nutritionBlocks(profile)` (`plan.js:229`) dérive déjà le headline
kcal/maintenance, les tuiles macros, la table d'ajustement Si/Alors et la
cible de poids depuis `profile`. Mais `profile` lui-même n'est aujourd'hui
qu'*validé* (`journal-shape.js:528-544` exige `maintenanceKcal`, `startKcal`,
`macros.{p,f,c}`, `targetWeightKg` — tous des nombres déjà calculés), jamais
*calculé* par l'app : quelqu'un les écrit à la main. Il n'existe aucun
formulaire de saisie, `profile` n'apparaît nulle part dans `App.jsx`.

## Scope

- **In** : un profil biométrique à 6 champs (taille, poids, âge, sexe,
  niveau d'activité à 3 paliers — sédentaire/modéré/actif, objectif) d'où
  sont dérivés `startKcal`, `maintenanceKcal`, `macros`, `targetWeightKg`
  (formule Mifflin-St Jeor + facteur d'activité + règle masse/sèche/maintien).
  Les 4 champs calculés restent stockés sur `profile`, à côté des 6 champs
  bruts — jamais saisis à la main, réécrits uniquement par le recalcul
  (décision Q1).
- **In** : le poids hebdomadaire du bilan (`BILAN_KEYS`) n'a aucun effet sur
  ce calcul — seul un changement volontaire de `profile.poids` (via
  "Modifier mon profil") redéclenche le recalcul du métabolisme (décision
  Q2). Le poids hebdomadaire continue d'alimenter uniquement la table
  Si/Alors existante.
- **In** : un brief texte généré (copiable) résumant kcal/macros/objectif
  **et le rythme d'entraînement** (nombre de séances/semaine, déjà connu via
  `SESSIONS.length` — décision Q4), à donner à une IA externe pour obtenir
  des repas — remplace `meals`, `minimalRules`, `optional` dans
  `nutritionBlocks()`.
- **In** : la section Nutrition du Plan reste toujours visible ; si le
  profil est absent, elle affiche un appel à l'action au lieu de
  disparaître (change la condition `profile ? {...} : null` en
  `plan.js:462`).
- **In** : saisie et édition du profil depuis cette même section (pas
  d'écran séparé, pas de question forcée à la création du programme, pas
  dans Réglages).
- **Out** : génération de repas par l'app (pas de base d'aliments).
- **Out** : champs profil pour nb de repas, budget, contraintes
  alimentaires — laissés à l'IA externe via le brief.
- **Out** : toucher au `poids` hebdomadaire du bilan (`BILAN_KEYS`) — reste
  une donnée distincte du `poids` de profil.

## Comportement côté utilisateur

Onglet Plan, section "Nutrition" :
- **État vide** (pas de profil) : la section est présente, avec un texte du
  type "Renseigne ton profil pour calculer tes calories et macros" et un
  bouton "Renseigner mon profil".
- **Formulaire** (à l'ouverture du bouton, ou en édition d'un profil
  existant) : taille (cm), poids (kg), âge, sexe, niveau d'activité (liste
  courte : sédentaire/modéré/actif), objectif (prise de masse/sèche/maintien).
- **État rempli** : headline kcal/maintenance, tuiles macros, table
  d'ajustement, cible fin S12 — comme aujourd'hui, mais calculés (avec le
  bon signe et la bonne table selon l'objectif, pas seulement la variante
  "prise de masse" actuelle). Le pliant "Journée type" est remplacé par un
  bloc "Brief pour ton IA" avec un bouton "Copier le brief".
- Un lien "Modifier mon profil" reste visible en état rempli, pour changer
  d'objectif en cours de cycle (ex. bascule masse → sèche) ou corriger une
  valeur.

## Critères d'acceptation

- [ ] Étant donné un cycle sans `profile`, quand on ouvre le Plan, alors la
      section Nutrition est visible avec un appel à l'action (elle ne
      disparaît plus).
- [ ] Étant donné un profil rempli avec objectif "prise de masse", quand on
      calcule `startKcal`, alors il est supérieur à `maintenanceKcal`
      (surplus), et la cible fin S12 est supérieure au poids renseigné.
- [ ] Étant donné un profil rempli avec objectif "sèche", quand on calcule
      `startKcal`, alors il est inférieur à `maintenanceKcal` (déficit), et
      la cible fin S12 est inférieure au poids renseigné ; la table
      d'ajustement et le texte "lecture des deux premières semaines"
      utilisent la variante sèche (perte d'eau initiale, pas gain).
- [ ] Étant donné un profil rempli, quand on ouvre "Brief pour ton IA", alors
      le texte généré contient kcal, les trois macros et l'objectif —
      copiable en un geste (même pattern que le bouton existant pour le
      bilan).
- [ ] Étant donné un profil déjà rempli, quand on clique "Modifier mon
      profil" et qu'on change l'objectif, alors les valeurs affichées
      (kcal/macros/cible/table) se recalculent immédiatement.
- [ ] Étant donné un journal existant qui porte déjà un `profile` au format
      actuel (calculé à la main, sans champs bruts taille/poids/âge/sexe/
      activité), quand on ouvre le Plan, alors la section Nutrition
      continue d'afficher ces valeurs sans les recalculer ni les effacer.

## Impact données et stockage

MINOR : ajout de champs optionnels sur `profile` (taille, poids, âge, sexe,
niveau d'activité, objectif) qui s'ajoutent à ce que `journal-shape.js`
valide déjà (`maintenanceKcal`, `startKcal`, `macros`, `targetWeightKg`,
inchangés). Un journal sans les 6 champs bruts mais avec les champs calculés
actuels continue de se lire à l'identique — c'est ce qui évite le MAJOR
(décision Q1).

## Cas limites

- Profil partiellement rempli (ex. taille/poids saisis, objectif pas encore
  choisi) — état "brouillon", ne doit pas produire un calcul silencieusement
  faux (0 kcal, macros négatives…).
- Changement d'objectif en cours de cycle (semaine 6, bascule masse→sèche) —
  le calcul repart du poids que l'utilisateur saisit à ce moment-là dans
  "Modifier mon profil" (pas du poids hebdomadaire du bilan, jamais lu
  automatiquement — décision Q2), donc c'est à l'utilisateur de mettre à
  jour son poids dans le profil s'il veut un calcul à jour.
- Sexe hors binaire homme/femme : la formule Mifflin-St Jeor standard n'a que
  deux variantes — comportement à documenter en design plutôt qu'ignoré.

## Hors scope / suites possibles

- Suivi de la dérive de poids semaine par semaine pour ajuster
  automatiquement les kcal (aujourd'hui la table Si/Alors reste un texte de
  méthode, pas un calcul automatique) — pourrait être une issue séparée une
  fois ce ticket livré.

## Questions ouvertes

None — voir `decisions-spec.md` pour le détail des quatre décisions (Q1
champs calculés stockés à côté des champs bruts, Q2 poids hebdo sans effet
sur le métabolisme, Q3 trois paliers d'activité, Q4 brief enrichi du rythme
d'entraînement).
