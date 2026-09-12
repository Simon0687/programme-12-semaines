# Moteur de génération de programme — inputs, règles, sorties

Objectif : générer un programme complet à partir d'un questionnaire court, par règles déterministes uniquement. **Zéro appel LLM.** Complète les deux rétro-spécifications (Alpha Progression, FitAI) et applique la méthode du template 12 semaines (BLOC B).

Principe directeur : séparer **données de référence** (écrites une fois), **inputs utilisateur** (le minimum irréductible) et **variables dérivées** (calculées, jamais demandées). Tout ce qui est dérivable ne doit pas être un écran — c'est la différence entre 7 écrans (Alpha), 17 écrans (FitAI) et 5.

---

## 1. Les inputs

### 1.1 Demandés — 5 écrans

| # | Input | Valeurs | Ce que ça pilote |
|---|---|---|---|
| 1 | **Fréquence** | 2 à 6 séances/sem | split, fréquence de stimulation, volume total disponible |
| 2 | **Durée max** | 45 / 60 / 75 / 90 min | plafond de séries par séance |
| 3 | **Objectif** | force / hypertrophie / endurance de force | fourchettes de reps, RIR cible, temps de repos |
| 4 | **Niveau** | débutant `<6 mois` / intermédiaire `6 mois–2 ans` / avancé `2 ans+` | position dans les fourchettes de volume, `niveau_min` des exercices, plancher de RIR |
| 5 | **Matériel** | salle complète / home gym (inventaire) / poids de corps | filtre du pool d'exercices |

### 1.2 Demandés — écran 6, repliable et facultatif

| # | Input | Valeurs |
|---|---|---|
| 6 | **Priorités** | 0 à 2 groupes prioritaires, 0 à n groupes en maintien |
| 7 | **Exclusions** | 6 cases : épaule / coude / poignet / lombaires / hanche / genou → exclut des **patterns**, pas des exercices nommés |

Défaut si non rempli : aucune priorité, aucune exclusion. Le programme se génère sans.

### 1.3 Ce qu'il ne faut **pas** demander

- **Sexe, âge, taille, poids** : ne changent rien à la structure du programme. Ils servent à la nutrition, ailleurs, plus tard.
- **Split** : c'est une sortie, pas une entrée. Il se déduit de fréquence × durée sous la contrainte de 2 stimulations par muscle (étape 1). Alpha le demande quand même — un écran de plus pour faire trancher à l'utilisateur une question dont le moteur a déjà la réponse, et une occasion de produire un split incohérent avec la fréquence choisie.
- **Charges de référence** : séance 1 = calibration. C'est ton différenciateur face aux deux benchmarks, qui vendent du gating (« se débloque dans 2 séances ») en guise de méthode.
- **Durée du programme** : sans objet si tu passes en timeline continue.

### 1.4 Dérivés (calculés, jamais saisis)

split · cible de volume par muscle · plafond de séries par séance · nombre d'exercices par séance · sélection des exercices · reps / RIR / repos · placement dans la semaine · nom de séance.

### 1.5 Runtime (boucle fermée, alimente les régénérations)

Par série : charge, reps, RIR → e10RM. Par muscle : fatigue cumulée. Par semaine : séances faites / prévues.

---

## 2. Données de référence — le catalogue

C'est **80 % du coût réel**. Le moteur fait 400–600 lignes ; le catalogue, c'est 60–80 fiches × 10 champs saisies à la main.

```json
{
  "id": "developpe-couche-halteres",
  "nom": "Développé couché haltères",
  "equipement": ["halteres", "banc"],
  "pattern": "poussee_horizontale",
  "type": "compose",
  "muscles": { "pectoraux": 0.6, "triceps": 0.2, "deltoide_ant": 0.2 },
  "stabilite": 2,
  "niveau_min": 1,
  "articulations": ["epaule", "coude", "poignet"],
  "increment_kg": 2.0,
  "cout_systemique": 2
}
```

| Champ | Usage dans le moteur |
|---|---|
| `pattern` | non-répétition d'un pattern dans une séance · rotation des variantes entre blocs |
| `muscles` | allocation du volume **et** modèle de fatigue — une seule table pour les deux (donnée volée à FitAI) |
| `stabilite` (1 barre libre lourde → 3 machine/poulie) | plancher de RIR, autorisation d'aller à l'échec |
| `niveau_min` | pas de soulevé de terre prescrit à un débutant en semaine 1 |
| `articulations` | filtre d'exclusion (input 7) |
| `increment_kg` | arrondi de progression + toggle ±0,25/±1,00 kg |
| `cout_systemique` (1–3) | limite le nombre d'exercices coûteux par séance et par semaine |

### Taxonomie des patterns — 12 entrées

| Famille | Patterns |
|---|---|
| Poussée | poussée horizontale · poussée verticale |
| Tirage | tirage vertical · tirage horizontal (rowing) |
| Bas du corps | dominante genou (squat) · charnière de hanche · extension de hanche (fessiers) |
| Isolations | triceps · biceps · deltoïde latéral · deltoïde postérieur |
| Périphérie | mollets · abdominaux |

Règle B.2 appliquée telle quelle : **jamais deux exercices du même pattern dans la même séance**. Une variante par pattern et par bloc, rotation au bloc suivant.

---

## 3. Le moteur — 7 étapes déterministes

### Étape 1 — Split

Ce n'est pas une table arbitraire, c'est la conséquence d'une contrainte : **chaque muscle doit être stimulé 2 fois par semaine**.

| Fréquence | Split | Fréq./muscle |
|---|---|---|
| 2 | Full body A / B | 2 |
| 3 | Full body A / B / C | 2–3 |
| 4 | Haut / Bas / Haut / Bas | 2 |
| 5 | Haut / Bas / Push / Pull / Bas | 2 |
| 6 | Push / Pull / Legs ×2 | 2 |

À 2–3 séances, le full body est **forcé** : c'est le seul moyen d'atteindre 2 stimulations. À 6, le PPL est forcé : le plafond de séries d'une séance ne permet pas de couvrir tout le corps 6 fois sans dépasser les fourchettes de volume.

### Étape 2 — Cible de volume par muscle (physiologie d'abord)

Table de base en séries de travail dures par semaine, reprise du BLOC B.2 :

| Muscle | Min | Max | Fréq. cible | Comptage |
|---|---|---|---|---|
| Dos | 6 | 10 | 2–3 | direct + indirect |
| Pectoraux | 6 | 10 | 2 | direct + indirect |
| Quadriceps | 6 | 10 | 2 | direct + indirect |
| Ischios / fessiers | 6 | 10 | 2 | direct + indirect |
| Deltoïde antérieur | 2 | 5 | 1–2 | direct + indirect |
| Deltoïde latéral | 2 | 5 | 1–2 | **direct seul** |
| Deltoïde postérieur | 2 | 3 | 1–2 | **direct seul** |
| Biceps | 3 | 6 | 2 | **direct seul** |
| Triceps | 3 | 6 | 2 | **direct seul** |
| Mollets | 4 | 8 | 2 | direct seul |
| Abdominaux | 3 | 6 | 2 | direct seul |

```
cible(m) = min(m)
         + (niveau == avancé ? 2 : niveau == intermédiaire ? 1 : 0)
         + (prioritaire ? max(m) − min(m) − bonus_niveau : 0)
cible(maintien) = 2
borne : [min(m), max(m)]
```

**Règle de comptage indirect** — c'est elle qui évite de doubler le volume des bras sans s'en rendre compte :

```
contribution(exo, m) = 1.0  si muscles[m] ≥ 0.5
                     = 0.5  si 0.2 ≤ muscles[m] < 0.5   (gros groupes + delt. ant. uniquement)
                     = 0    sinon
```

Pour les biceps, triceps, deltoïdes latéral et postérieur, la cible est exprimée en **séries directes** et l'indirect ne s'en déduit pas : c'est déjà intégré dans le fait que la fourchette est basse (3–6 et pas 10–15). Le guide le dit explicitement — les presses comptent déjà pour les chefs latéral et médial du triceps.

Conséquence concrète : 7 séries de presse dans la semaine apportent 3,5 séries de deltoïde antérieur → le déficit tombe à 0 et le moteur ne prescrit pas de développé vertical en plus. **Sans cette règle, le générateur produit systématiquement 40 à 50 % de trop sur épaules et bras** — c'est le bug des « muscles parasites » de FitAI vu de l'intérieur.

### Étape 3 — Plafond temporel (le temps est une contrainte, pas une cible)

```
plafond_séries = floor((durée_min − 10) / 3)      # 10 min d'échauffement, ~3 min/série
```

| Durée | Plafond | Exercices max |
|---|---|---|
| 45 min | 11 | 4 |
| 60 min | 16 | 5 |
| 75 min | 21 | 6 |
| 90 min | 26 | 6 |

Cap dur : 6 exercices par séance, 2 à 4 séries par exercice.

**Le plafond n'est jamais une cible.** Si le volume physiologique tient en 48 min, la séance dure 48 min. C'est la règle B.2 (« n'ajouter des séries qu'en cas de stagnation avérée — jamais pour occuper le temps disponible ») et c'est exactement ce que FitAI viole en remplissant les créneaux avec des ischio-jambiers dans une séance « Épaules et bras ».

**Test de faisabilité** : `Σ cible(m) ≤ Σ plafond_séries`. Si non, cascade de réduction, dans cet ordre, déterministe :

1. groupes en maintien → 0 en direct (ils survivent par l'indirect)
2. mollets et abdominaux → 0
3. isolations non prioritaires → bas de fourchette
4. deltoïde antérieur direct → 0 (couvert par les presses)
5. gros groupes non prioritaires → min
6. fréquence 1,5×/sem sur les non-prioritaires (un muscle une séance sur deux)
7. **échec explicite** : « 3 séances de 45 min = 33 séries de travail. Le minimum méthodologique pour couvrir le corps entier est de 33. Aucune marge pour une priorité : passe à 60 min ou à 4 séances. »

Un moteur qui dit non vaut mieux qu'un moteur qui remplit. Aucun des deux benchmarks ne le fait.

### Étape 4 — Sélection des exercices (glouton sur le déficit)

```
déficit[m] ← cible[m] pour tous les muscles de la semaine
répartir les muscles sur les séances selon le split

pour chaque séance :
  tant que déficit_max_de_la_séance > 1 et exercices < cap :
     m  ← muscle de la séance au plus grand déficit
     C  ← exos où m est primaire (part ≥ 0.5)
          ∩ équipement disponible
          ∩ articulations non exclues
          ∩ niveau_min ≤ niveau
          − patterns déjà utilisés dans cette séance
          − variantes déjà utilisées dans le bloc courant
     e  ← argmax(score) sur C,  départage par ordre d'id (reproductible)
     n  ← clamp(déficit[m], 2, 4)
     pour chaque muscle de e : déficit[muscle] −= n × contribution(e, muscle)
```

Score de candidat, entièrement déterministe :

```
score = 3 × couverture        (Σ des contributions sur les déficits encore ouverts)
      + 2 × stabilité         (si isolation, ou si l'objectif autorise l'échec)
      + 1 × composé           (si la séance a encore un créneau d'ouverture)
      − 2 × cout_systemique   (si déjà ≥ 2 exos coûteux dans la séance)
      + préférence            (pouce en haut : +1 · pouce en bas : −10)
```

**Condition d'arrêt : tous les déficits ≤ 1.** Sans tolérance, l'algorithme ne termine pas proprement et ajoute des séries d'1 unité.

Ordre dans la séance : `cout_systemique` décroissant → composés avant isolations → groupe prioritaire remonté d'un cran.

### Étape 5 — Placement dans la semaine

Deux règles :

| Type | Espacement minimal entre deux sollicitations **primaires** |
|---|---|
| Gros groupes (dos, pecs, quads, ischios) | 48 h |
| Petits groupes (bras, deltoïdes, mollets, abdos) | 24–48 h |
| Séance à fort coût systémique (squat lourd, charnière) | 72 h |

Et : jamais deux jours consécutifs sur le même pattern.

Tables résolues une fois pour toutes :

| Fréquence | Jours |
|---|---|
| 2 | L · J |
| 3 | L · Me · V |
| 4 | L · Ma · J · V |
| 5 | L · Ma · Me · V · Sa |
| 6 | L · Ma · Me · V · Sa · Di |

**Version dynamique — celle qui va avec ta timeline continue.** Au lieu de figer les jours, réutilise le modèle de fatigue de FitAI :

```
récup(m, t) = min(100, récup(m, t−Δ) + 100 × Δ_heures / 72)
coût(série, m) = k × contribution(exo, m) × intensité_relative
séance proposable ⟺ tous ses muscles primaires ≥ 70 % de récupération
```

Une seule constante (72 h) et la table `muscles` que tu as déjà. Bénéfices : une séance manquée ne casse plus le calendrier (l'app propose la prochaine séance **faisable**), et tu récupères gratuitement le signal de deload de l'étape 7.

### Étape 6 — Prescription

| Objectif | Reps composé | Reps isolation | RIR | Repos comp. / iso |
|---|---|---|---|---|
| Force max | 3–6 | 6–10 | 1–2 | 3–4 min / 2 min |
| Hypertrophie | 5–10 | 8–12 | 0–1 | 2–3 min / 1–2 min |
| Endurance de force | 12–15 | 12–20 | 1–2 | 90 s / 60 s |

Plancher de RIR par stabilité (garde-fou déterministe) :

| `stabilite` | Plancher |
|---|---|
| 3 — machine, poulie | RIR 0, échec autorisé |
| 2 — haltères, poids de corps | RIR ≥ 0 |
| 1 — barre libre lourde | RIR ≥ 1 |

Semaine 1 = **calibration** : RIR cible +2 sur toutes les séries, retour à la cible en semaine 2.

Charge de départ :
- avec référence → Epley + table RIR/%1RM, arrondi à `increment_kg`
- sans référence → montée par paliers en séance 1 ; la première série dans la fourchette à 2–3 RIR devient la charge de travail, le moteur prescrit dès la séance 2

### Étape 7 — Progression et décharge

Progression : double progression, déjà dans ton app. Toutes les séries en haut de fourchette → `+increment_kg` (RIR informatif, pas une condition, depuis #28). Deux séries ou plus sous le bas de fourchette → charge maintenue ; si répété → −5 %.

Décharge **par signal**, pas par numéro de semaine. Déclencheurs (OU logique) :
- e10RM en baisse sur ≥ 2 exercices clés, 2 séances consécutives
- à charge et répétitions identiques, RIR déclaré en baisse de ≥ 2 points sur 2 séances
- récupération moyenne pondérée < 50 % sur 3 jours consécutifs (étape 5 dynamique)
- douleur ≥ 3/10 sur plus de 48 h, si tu collectes le champ

Recette : mêmes exercices, volume −50 %, charge −10 %, RIR +3, une semaine.

Rotation des variantes : tous les 6 blocs de progression, **ou** quand la progression sur un exercice est nulle pendant 3 séances → variante suivante dans le même pattern.

---

## 4. Sortie

Stocker des **fourchettes au niveau programme** et résoudre à l'affichage semaine par semaine (règle volée à Alpha). Ne jamais figer 12 semaines de prescriptions : c'est ce qui rend la timeline continue impossible.

```json
{
  "split": "haut_bas",
  "frequence": 4,
  "bloc": 1,
  "volume_cible": { "dos": 7, "pectoraux": 7, "quadriceps": 7, "...": 0 },
  "seances": [
    { "id": "H1", "nom": "Haut A", "jour_type": 1,
      "exercices": [
        { "exo_id": "developpe-couche-halteres",
          "pattern": "poussee_horizontale",
          "series": [3, 4], "reps": [5, 10], "rir": [0, 1],
          "charge": null, "source_charge": "calibration" }
      ] }
  ]
}
```

Nom de séance : template déterministe sur les 2–3 muscles au plus fort volume → `Haut A · Dos & Épaules`. Pas de LLM ; FitAI le fait déjà sans IA (« Dos Bras Fessiers Traps »).

---

## 5. Exemple exécuté

**Input** : 4 séances/sem · 60 min · hypertrophie · intermédiaire · salle complète · aucune priorité.

**Dérivé** : split Haut/Bas/Haut/Bas (L, Ma, J, V) · plafond 16 séries/séance, 64/semaine.
**Cibles** (min +1) : dos 7 · pecs 7 · quads 7 · ischios-fessiers 7 · delt. lat. 3 · delt. post. 3 · biceps 4 · triceps 4 · mollets 5 · abdos 4 · delt. ant. 3 (couvert à 3,5 par l'indirect → **0 direct**).
**Total** : 51 séries réelles pour un plafond de 64. **Faisable, avec 13 séries de marge — donc les séances durent 45 à 52 min, pas 60.**

| Haut A (14 séries, ~52 min) | Pattern | Prescription |
|---|---|---|
| Développé couché haltères | poussée horizontale | 4 × 5-10 @ 0-1 RIR |
| Tirage vertical prise large | tirage vertical | 4 × 6-10 @ 0-1 RIR |
| Élévations latérales poulie | isolation delt. lat. | 3 × 10-12 @ 0 RIR |
| Extension triceps poulie | isolation triceps | 3 × 10-12 @ 0 RIR |

| Haut B (14 séries) | Pattern | Prescription |
|---|---|---|
| Développé incliné haltères | poussée horizontale | 3 × 8-12 @ 0-1 RIR |
| Rowing barre | tirage horizontal | 3 × 6-10 @ 1 RIR |
| Développé militaire haltères | poussée verticale | 2 × 6-10 @ 1 RIR |
| Oiseau poulie | isolation delt. post. | 3 × 12-15 @ 0 RIR |
| Curl haltères | isolation biceps | 3 × 8-12 @ 0 RIR |

| Bas A (13 séries) | Pattern | Prescription |
|---|---|---|
| Squat barre | dominante genou | 4 × 5-8 @ 1 RIR |
| Soulevé de terre roumain | charnière de hanche | 3 × 6-10 @ 1 RIR |
| Mollets debout | mollets | 3 × 8-12 @ 0 RIR |
| Gainage lesté | abdominaux | 3 × 30-45 s |

| Bas B (12 séries) | Pattern | Prescription |
|---|---|---|
| Presse à cuisses | dominante genou | 3 × 8-12 @ 0-1 RIR |
| Leg curl allongé | isolation ischios | 4 × 8-12 @ 0 RIR |
| Mollets assis | mollets | 3 × 10-15 @ 0 RIR |
| Crunch poulie | abdominaux | 2 × 12-15 @ 0 RIR |

Contrôle automatique : dos 7 ✔ · pecs 7 ✔ · quads 7 ✔ · ischios-fessiers 7 ✔ · delt. lat. 3 ✔ · delt. post. 3 ✔ · biceps 3 (−1, toléré) · triceps 3 (−1, toléré) · mollets 6 (+1) · abdos 5 (+1) · delt. ant. 2 direct + 3,5 indirect ✔.

**Même input à 3 séances × 45 min** : plafond 33, cible 51. La cascade retire mollets et abdominaux (−9), ramène les bras au minimum (−2), les deltoïdes latéral et postérieur à 2 (−2), les gros groupes au min (−4), le delt. antérieur direct à 0. Reste 34 pour 33 → passage de la fréquence des pectoraux à 1,5×. Message du moteur : *« Ce format couvre le corps entier au strict minimum méthodologique. Aucune marge pour une priorité. »*

---

## 6. Ce que les règles ne savent pas faire

| Cas | Réponse sans LLM |
|---|---|
| Texte libre « mal au bas du dos » | 6 cases articulaires. FitAI a mis un LLM là où 6 checkboxes suffisent — et c'est le seul endroit où son texte libre a produit quelque chose de visible. |
| Préférence subjective d'exercice | Pouce haut/bas dans le catalogue, pondéré dans le `score`. |
| Explication pédagogique du programme | Templates paramétrés sur les décisions déjà prises par le moteur. |
| Contexte hors modèle (compétition, blessure évolutive, sport secondaire) | **Seul vrai trou.** Réponse : édition manuelle du programme généré, pas un LLM. |

**Coût réel** : moteur 400–600 lignes (1–2 jours), catalogue 60–80 fiches (2–3 jours de saisie). Le catalogue est le chantier, pas l'algorithme.

Un LLM reste pertinent **hors séance** — debrief, bilan hebdo, interprétation de tendance — là où la latence et le taux d'erreur ne coûtent rien. Jamais dans la génération, jamais pendant la séance.

---

## 7. Ordre d'implémentation et test d'acceptation

1. Schéma catalogue + 25 exercices couvrant les 12 patterns, salle complète uniquement
2. Étapes 1-2-3 (split, volume, faisabilité) — testables sans UI
3. Étape 4 (sélection gloutonne)
4. Étape 5, version calendrier fixe
5. Étape 6, branchée sur ton moteur de double progression existant
6. Modèle de fatigue → remplace le calendrier fixe et alimente le deload par signal

**Test d'acceptation, à automatiser sur les 20 combinaisons fréquence × durée :**

1. volume par muscle dans les fourchettes (ou justifié par la cascade de réduction)
2. fréquence de stimulation ≥ 1,5 par muscle non exclu
3. aucun pattern dupliqué dans une même séance
4. espacement ≥ 48 h entre deux sollicitations primaires d'un gros groupe
5. durée estimée ≤ durée demandée
6. thème annoncé = muscles réellement travaillés (le test que FitAI échoue)

Un générateur qui passe ces 6 assertions sur 20 combinaisons n'a besoin d'aucune IA.
