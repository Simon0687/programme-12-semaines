# Rétro-spécification — app de musculation (20 écrans)

Analyse fonctionnelle à partir des captures. Vocabulaire (10RM, RIR, deload, trophées) et ergonomie : très probablement **Alpha Progression** ou un clone direct.

---

## 1. Architecture de navigation

**Bottom nav, 3 onglets** (pas de 4e, pas de tab bar contextuelle) :

| Onglet | Contenu |
|---|---|
| Haltères | Accueil : calendrier semaine, programme actif, liste des séances, accès bibliothèque |
| Courbe | Analytics : cartes de graphiques configurables |
| Silhouette | Profil : stats, salle, mesures, paramètres, aide |

Tout le reste (création, édition, exécution de séance) passe par des **modales plein écran empilées** avec `Annuler` / `Retour` en haut à gauche et CTA bleu pleine largeur en bas. Pattern constant : 1 question = 1 écran.

---

## 2. Onboarding / profil utilisateur

Données collectées :

- **Sexe** (avec justification explicite dans la FAQ)
- **Niveau d'expérience** — 5 paliers : Débutant `<6 mois` · Intermédiaire `6+ mois` · Avancé `1,5+ ans` · Pro `4+ ans` · Élite `8+ ans`
- **Salle** ("Ma salle") = inventaire d'équipement disponible → filtre le pool d'exercices
- **Infos de base** (écran dédié, contenu non visible : taille / âge probable)
- **Poids de corps** : valeur courante + `+` d'ajout rapide, historisé
- **Mesures corporelles** — par côté, liste alphabétique : avant-bras D/G, bras D/G, cou, cuisse D/G, hanches, largeur des épaules, … (liste tronquée dans la capture)

Le niveau d'expérience n'est pas décoratif : il **modifie les recommandations en aval** (ex. sur l'écran fréquence, hint « Pour les pros, nous recommandons 5+ séances »).

---

## 3. Arbre de création

```
Créer
├── Programme  (multi-semaines, "Populaire")
│   ├── Générateur de programme  → questionnaire 7 étapes
│   └── Programme vide           → construction manuelle
└── Séance     (one-shot, hors programme)
```

Deux niveaux d'entrée : planification long terme vs séance isolée. Les deux mènent au même éditeur.

---

## 4. Générateur automatique — paramètres

Séquence d'écrans, dans l'ordre :

| # | Paramètre | Valeurs |
|---|---|---|
| 1 | **Objectif** | Force maximale (~4-10 réps) · Prise de muscle (~6-15 réps, "Populaire") · Endurance de force (~12-20 réps) |
| 2 | **Focus musculaire** | Carte anatomique face/dos, deux listes : `Cibler (n)` / `Négliger (n)`, vides par défaut |
| 3 | **Fréquence** | 1× à 6× / semaine, grille 2 colonnes |
| 4 | **Durée de séance** | Courte ~1 h · Moyenne ~1:20 · Longue ~1:35 |
| 5 | **Durée du programme** | 6 semaines (défaut) |
| 6 | **Split** | Corps entier (défaut affiché) |
| 7 | **Paramètres experts** | 4 toggles, tous ON par défaut : `Suivre le RIR`, `Périodiser les séries`, `Périodiser le RIR`, `Deload` |

CTA final : `Générer un programme`.

> ⚠️ Incohérence à vérifier : split annoncé « Corps entier » mais programme généré = **Push-Pull-Legs sur 6 jours**. Soit le champ est réécrit par le générateur en fonction de fréquence × durée, soit les captures viennent de deux runs.

L'objectif ne pilote pas un nombre de réps fixe mais une **fourchette** — la prescription réelle est ensuite calculée par exercice (6 réps pour le développé couché, 10 pour les dips, 12 pour le tirage menton sur un même programme "prise de muscle").

---

## 5. Modèle de données inféré

```
Programme
 ├─ nom, durée (semaines), split, semaine courante
 └─ Jour[] (Push, Legs, Pull, Push, Legs, Pull)
     └─ Exercice[]
         ├─ référence exercice + variante d'équipement (Barre / Haltères / Poids de corps / Machine / Barre EZ)
         ├─ prescription programme : séries min-max, réps cible, RIR min-max  → "2-4 séries · 6 réps · 0-3 RIR"
         ├─ prescription résolue pour la semaine N              → "2×6 réps · 3 RIR"
         ├─ techniques : dropsets (n), supersets (groupe)
         └─ séries d'échauffement (n, auto)
Séance réalisée
 └─ Set[] : # / kg / réps / RIR / 10RM estimé / validé
```

Point structurant : la prescription est **une fourchette au niveau programme** et **une valeur au niveau semaine**. La périodisation = résolution de la fourchette semaine après semaine (semaine 1 = bas de fourchette : 15 séries sur 15-29 possibles).

---

## 6. Éditeur de programme

- Onglets horizontaux = jours du cycle (Push · Legs · Pull · Push · Legs · Pull)
- En-tête jour : nom éditable, `Jour 1`, compteur `7 exercices · 15-29 séries` + info, **carte musculaire face/dos avec les groupes sollicités surlignés** (feedback de couverture immédiat)
- Liste d'exercices : vignette photo, nom, équipement, pastille de prescription
- Menu `…` par exercice : `Dropsets` · `Supersets` · `Remplacer` · `Retirer` + fiche info `(i)`
- Icône clé à molette = réglages du programme
- CTA `Enregistrer`

---

## 7. Techniques d'intensification

- **Dropsets** : nombre configurable, charges **auto-calculées à −25 % cumulés** (30 → 22,5 → 16,9 → 12,7 kg), consigne « Max de réps possible »
- **Supersets** : groupement de 2+ exercices, matérialisé par une **barre verticale rouge** sur les lignes concernées
- **Séries d'échauffement** : générées automatiquement (« 1 série d'échauffement »), repliables, hors comptage des séries de travail

---

## 8. Exécution de séance

Écran d'entrée (avant démarrage) : nom, programme + semaine, `7 exercices · 15 séries`, bouton `Démarrer`, liste détaillée des prescriptions.

Pendant la séance :

- **Carrousel de vignettes** en haut = navigation entre exercices, soulignement rouge = progression
- En-tête exercice : nom, équipement (échangeable), réps cible (éditable), RIR cible (éditable)
- **Tableau de saisie** : `#` | `KG` | `RÉPS` | `RIR` | `10RM` — ligne active en blanc, lignes validées grisées, validation par ✓ vert
- Les valeurs sont **pré-remplies avec la série précédente** ; le 10RM est calculé, non saisi
- **Sélecteur de poids** : liste de suggestions par pas de 2,5 kg + pavé numérique custom + slider + décimales
- **Timer de repos** : lancé automatiquement à la validation d'une série, compte à rebours plein écran vert (2:59), bouton timer manuel
- Menu séance : heure de début, **durée live**, `Terminer` / `Mettre en pause` / `Réinitialiser`, toggles `Suivre le RIR` et `Deload` **au niveau séance**, `Partager`, `Enregistrer`
- **Coach tips inline** contextuels (« Comment trouver le meilleur poids de départ ») affichés sur la première série sans historique

---

## 9. Moteur de progression

C'est le cœur, et il tient en une métrique : **le 10RM estimé**.

- Chaque série validée produit un e10RM à partir de (charge, réps, RIR) : `30 kg × 6 réps @ 3 RIR → 29,3 kg`
- Le RIR est donc la variable d'auto-régulation : 6 réps à 3 RIR = 9 réps possibles → conversion vers un 10RM légèrement inférieur à la charge
- Le e10RM sert de : référence de progression, base de calcul des dropsets, série temporelle dans les graphiques
- **Deload** : géré à 3 niveaux — toggle générateur, toggle séance, et badge `D` sur le jour dans le calendrier ; la séance apparaît comme `Push · Deload`
- **Périodisation** séparée pour le volume (`Périodiser les séries`) et l'intensité (`Périodiser le RIR`)
- La FAQ admet une limite : « Pourquoi aucune recommandation de progression pour certains exercices ? » → tous les exercices ne sont pas progressables automatiquement

---

## 10. Suivi / analytics

- Sélecteur de période (`3 mois`)
- **Cartes ajoutables et configurables**, 3 types observés :
  - Exercice + équipement, métrique au choix (`kg`, `10RM`) — ex. Développé couché · Barre en 10RM
  - **Groupe musculaire**, métrique `Séries` (= volume hebdo par muscle)
  - Poids de corps
- État vide explicite « Aucune donnée » par carte
- Pas de dashboard imposé : l'utilisateur compose son tableau de bord

---

## 11. Gamification

- **Trophée** évolutif (bois → …) avec badges cumulés `+10`
- Compteur de séances totales
- **Streak** hebdomadaire (« 1 sem d'affilée ») — la FAQ parle de « séries d'entraînement »
- **Succès** et **trophées** documentés comme deux systèmes distincts
- Prompt de notation App Store intégré à l'accueil

---

## 12. Aide et support

- Lien `Aide` en pied de **chaque écran** (aide contextuelle, pas une doc centrale)
- FAQ recherchable, deux sections : questions principales / autres sujets
- Entrées orientées confiance : « Pourquoi l'appli a-t-elle besoin de mon sexe / mon expérience ? »
- Entrées orientées démarrage à froid : « Trouver le poids de départ », « Trouver les répétitions de départ »
- Contact direct (« Des questions ? Écris-nous »)

---

## 13. Absent des captures

Nutrition · cardio · mobilité · comptes/cloud/multi-appareils · social ou partage de programmes entre utilisateurs · notes par série · PR explicites · historique détaillé par exercice (probablement derrière « Exercices ») · RPE en alternative au RIR · gestion de blessure/exclusion d'exercice.

---

## 14. Lecture critique

**Ce qui marche**

- Une seule monnaie de progression (e10RM) qui irrigue saisie, dropsets et graphiques
- Fourchettes au niveau programme, valeurs résolues au niveau semaine : périodisation lisible sans écran de périodisation
- Carte musculaire comme feedback de couverture, pas comme décoration
- Aide contextuelle par écran + tips inline sur la première série sans historique — traite vraiment le problème du démarrage à froid
- Progressive disclosure : « Paramètres experts » repliables

**Ce qui crée la confusion (ton ressenti est justifié)**

- Deux points d'entrée de création qui se recouvrent (Programme / Séance, puis Générateur / Vide)
- Même toggle (`Deload`, `Suivre le RIR`) présent au niveau générateur ET séance, sans hiérarchie explicite
- 7 écrans de questionnaire avant de voir quoi que ce soit
- Le split affiché ne correspond pas au programme généré
- Modales empilées : à 3 niveaux de profondeur, on ne sait plus ce que `Annuler` annule
- Le 10RM apparaît dans la saisie sans jamais être expliqué à cet endroit

---

## 15. Delta avec ton app

| Axe | Cette app | La tienne |
|---|---|---|
| Métrique de progression | e10RM estimé, unique et transverse | double progression charge/réps auto-régulée RIR |
| Horizon | cycles de 6 semaines | cycles de 12 semaines (réflexion : timeline continue) |
| Deload | toggle + périodisation par numéro de semaine | par numéro de semaine (réflexion : déclenché par signal) |
| Configuration | questionnaire 7 étapes + 4 toggles experts | non |
| Équipement | « Ma salle » filtre le pool d'exercices | non observé |
| Multi-utilisateurs | oui, profil complet | mono-utilisateur, localStorage |
| Analytics | cartes configurables, volume par muscle | à préciser |

**À voler**

1. Le e10RM comme métrique pivot unique : simplifie graphiques, dropsets et comparaison inter-exercices.
2. Prescription en fourchette (programme) + valeur résolue (semaine) : c'est la même donnée à deux niveaux, ça évite de stocker 12 semaines de prescriptions figées — et ça se marie bien avec une timeline continue.
3. « Ma salle » comme filtre d'exercices : indispensable dès que tu ouvres à d'autres utilisateurs.
4. Carte musculaire de couverture sur l'éditeur de jour.
5. Le calendrier d'accueil avec état par séance (faite / à faire / deload).

**À ne pas voler**

- Les 7 écrans de configuration : ton moteur peut déduire la majorité (fréquence + durée → split).
- La duplication des toggles entre niveaux.
- Le split déclaré ≠ split généré.

**Question ouverte pour ton design** : eux résolvent le démarrage à froid par de la doc (FAQ + tips). Avec une progression auto-régulée par RIR, tu peux le résoudre par le calcul — première séance en repérage, le moteur calibre à la seconde. C'est un vrai différenciateur produit.
