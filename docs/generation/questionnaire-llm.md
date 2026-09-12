# Questionnaire conversationnel — spécification

Le questionnaire est administré par un LLM et produit **un payload JSON validé**. Le moteur de génération est hors périmètre : il consomme ce payload, il n'est jamais appelé ni simulé par le LLM.

Complète [`moteur-generation-programme.md`](moteur-generation-programme.md) (§1 — les inputs), dont il implémente la collecte, et [`catalogue-exercices-v1.json`](catalogue-exercices-v1.json), dont il reprend les vocabulaires fermés.

---

## Statut — v1, 2026-09-10

**Version de référence.** Le fond n'est pas rouvert ; six amendements ont été
appliqués au texte d'origine, listés en fin de document (§11).

Ce qu'il faut savoir avant de s'en servir :

- **Le payload n'est pas une définition de programme.** Ce document décrit
  l'entrée du moteur de génération ; le format que l'app charge et exécute est
  un troisième contrat (`formatVersion`, `src/definition.js`). Voir la carte
  des contrats dans [`README.md`](README.md).
- **Deux blocages format côté app**, connus et suivis : le profil nutrition
  est aujourd'hui obligatoire à l'import alors que §2 interdit de le
  collecter ; `weeks: 12` est obligatoire alors que le questionnaire ne
  demande aucune durée de programme. Le second se lève avec la timeline
  continue (#16 / #14).
- **Le questionnaire est un artefact post-#14.** `objectif` ne pilote rien
  tant que le RIR vit dans le code (`phaseOf`) plutôt que dans la donnée.

---

## 0. Frontière

|  | Questionnaire (LLM) | Moteur (règles) |
|---|---|---|
| Entrée | langage naturel | enums validés |
| Sortie | payload JSON | programme |
| Non-déterminisme | toléré, corrigé au récapitulatif | interdit |
| Peut dire non | oui, c'est sa fonction principale (§6) | oui, par la cascade §3 du moteur |

Le LLM **ne dérive jamais** split, volume, sélection d'exercices, reps, RIR ou charges. Ce sont des sorties du moteur. Si l'utilisateur demande « je vais faire quoi comme exercices ? » pendant l'entretien : « le programme arrive juste après, encore deux questions ».

> **Règle de suppression** : toute question dont on ne peut pas nommer le champ de payload qu'elle remplit est supprimée. C'est le seul filtre qui empêche un questionnaire LLM de dériver vers 20 questions.

---

## 1. Contrat de sortie

```json
{
  "schema_version": 1,
  "frequence": 4,
  "duree_max_min": 60,
  "objectif": "hypertrophie",
  "anciennete": "6m_2ans",
  "reprise_apres_coupure": false,
  "materiel": {
    "type": "home_gym",
    "inventaire": ["barre", "rack", "banc_incline", "halteres", "barre_traction"],
    "halteres_max_kg": 30
  },
  "priorites": ["dos"],
  "maintien": [],
  "contraintes_articulaires": [
    { "articulation": "lombaires", "niveau": "exclusion", "motif": "douleur actuelle sous charge, charnière de hanche" }
  ],
  "avis_medical_recommande": false,
  "couverture_partielle": [],
  "confiance": { "anciennete": "declaree", "inventaire": "partiel" }
}
```

`inventaire` et `priorites` / `maintien` n'écrivent que des valeurs des deux
vocabulaires fermés de `catalogue-exercices-v1.json` — équipement (§4.3) et
clés musculaires (§4.4). Un tag hors liste ne filtre rien : le programme sort
cohérent et faux, sans erreur visible.

### Statut des champs

| Champ | Statut | Défaut | Coût d'un défaut faux |
|---|---|---|---|
| `frequence` | **obligatoire** | — | split faux → tout est faux |
| `materiel.type` | **obligatoire** | — | exercices non réalisables, programme jeté |
| `duree_max_min` | défaut | 60 | faible : le moteur ne remplit pas le temps disponible (§3 moteur) |
| `objectif` | défaut | hypertrophie | reps/RIR décalés d'un cran, rattrapable |
| `anciennete` | défaut | debutant | −1 à −2 séries/muscle, RIR plancher plus haut → sous-dosage, corrigé au bloc 2 |
| `priorites` / `maintien` | facultatif | `[]` | programme équilibré : pas faux, juste générique |
| `contraintes_articulaires` | facultatif | `[]` | **le seul risque réel** — voir §5 |
| `couverture_partielle` | facultatif | `[]` | liste des groupes non couverts quand l'utilisateur maintient un format refusé (§6) ; vide = couverture complète |

Deux champs obligatoires seulement. Le questionnaire doit pouvoir se terminer à tout moment : chip `Génère avec ce que tu as` disponible dès que `frequence` et `materiel` sont remplis.

`materiel` n'a pas de défaut sûr : `salle_complete` prescrit des machines absentes, `poids_de_corps` produit un programme absurde pour quelqu'un qui a une salle. C'est le seul champ où l'erreur ne se rattrape pas au bloc suivant.

---

## 2. Ce que le LLM ne demande jamais

| Interdit | Pourquoi | Consommateur réel |
|---|---|---|
| Sexe, âge, taille, poids, % de masse grasse | ne changent rien à la structure | module nutrition, plus tard |
| Charges de référence, 1RM, « tu pousses combien au dev couché » | séance 1 = calibration | aucun |
| Split souhaité | c'est une sortie (bug Alpha : « corps entier » annoncé, PPL généré) | aucun |
| Durée du programme | sans objet en timeline continue | aucun |
| Nombre d'exercices par séance | dérivé du plafond temporel | aucun |
| Exercices favoris / détestés | pouce haut/bas dans le catalogue, **après** génération | `score` du moteur, en runtime |
| Sommeil, stress, horaire d'entraînement, motivation | aucun champ de payload | aucun |
| Objectif de poids, régime, allergies | autre module | aucun |

**Règle adverse** : si l'utilisateur donne spontanément une de ces informations, le LLM l'accuse en une clause et n'y revient jamais. Il ne la stocke pas, ne la répète pas au récapitulatif, ne l'utilise pas.

> « Je fais 92 kg pour 1m80 » → « Noté — ça ne change pas la structure du programme, on garde le fil. Combien de séances par semaine ? »

C'est le point de dérive numéro un d'un questionnaire LLM : entraîné sur des milliers de questionnaires de coach, il *veut* demander l'âge et le poids. La section négative du prompt (§9) doit être plus longue que la section positive.

---

## 3. Les cinq tours

Un tour = un message du LLM, une intention, des chips + texte libre accepté. Jamais deux questions non liées dans le même message.

### Tour 0 — Ouverture froide

Le premier message utilisateur contient souvent 2 à 4 champs. Le LLM extrait tout ce qui est extractible **avant** de poser sa première question, et ne redemande jamais un champ déjà donné.

> « Je reprends la muscu après 6 mois d'arrêt, j'ai un banc et des haltères chez moi, 3 fois par semaine max »
> → `frequence: 3` · `materiel.type: home_gym` (inventaire partiel) · `reprise_apres_coupure: true`
> → reste : durée, objectif, complément d'inventaire, ancienneté avant la coupure. **2 tours au lieu de 5.**

Si le premier message est vide de contenu (« salut », « je veux un programme »), démarrer au tour 1 sans préambule.

### Tour 1 — Le cadre : fréquence + durée

Les deux sont demandés ensemble parce qu'ils forment un budget unique (§6) et qu'un arbitrage sur l'un se paie sur l'autre.

> « Combien de séances par semaine, et combien de temps par séance ? »
> Chips : `2` `3` `4` `5` `6` — puis `45 min` `1 h` `1 h 15` `1 h 30`

Extraction : `frequence` (2–6), `duree_max_min` (45/60/75/90, arrondi à l'inférieur : « une heure et demie » → 90, « 50 min » → 45).

**Le LLM calcule immédiatement le budget et prévient si le format est refusé** (§6), avant de continuer. Inutile de collecter 6 champs pour annoncer un refus au tour 5.

### Tour 2 — Objectif + ancienneté

> « Objectif principal ? Et depuis combien de temps tu t'entraînes en continu, sans coupure de plus de deux mois ? »
> Chips objectif : `Force max` `Prise de muscle` `Endurance de force`
> Chips ancienneté : `Moins de 6 mois` `6 mois – 2 ans` `Plus de 2 ans`

L'ancienneté est demandée comme **fait comportemental**, pas comme auto-évaluation. « Tu te considères débutant / intermédiaire / avancé ? » produit une réponse gonflée d'un cran dans une majorité de cas ; « depuis combien de temps sans coupure » est vérifiable et sans enjeu d'ego.

Ce champ ne pilote que trois choses côté moteur : position dans les fourchettes de volume (+0 / +1 / +2 séries), filtre `niveau_min` du catalogue, plancher de RIR. Une erreur d'un cran coûte 2 séries par muscle — récupérable.

**Règle de reprise** : coupure > 3 mois → `reprise_apres_coupure: true`, et l'ancienneté est déclassée d'un cran pour le bloc 1 uniquement. Quelqu'un qui a 4 ans de pratique et 8 mois d'arrêt n'a plus la tolérance au volume d'un avancé, mais garde sa technique — donc pas de filtre `niveau_min` abaissé.

### Tour 3 — Matériel

> « Où tu t'entraînes ? »
> Chips : `Salle complète` `Chez moi` `Rien / poids de corps`

- `salle_complete` → **aucune relance**. C'est 70 % des cas et ils coûtent zéro tour.
- `poids_de_corps` → relance unique : barre de traction, oui ou non. C'est le seul équipement qui change la structure (sans elle, aucun pattern de tirage vertical n'existe).
- `home_gym` → texte libre, normalisé en §4.3. C'est le seul endroit où le LLM fait un travail qu'un formulaire ne fait pas bien : une liste à cocher de 25 équipements est pire qu'une phrase.

Pour un home gym, `halteres_max_kg` est obligatoire s'il y a des haltères. Sans lui, le moteur prescrit un développé couché à 40 kg à quelqu'un dont les haltères plafonnent à 30 : le programme est faux dès le bloc 2, pas à la génération.

### Tour 4 — Priorités et douleurs (facultatif)

> « Deux dernières, tu peux passer : un groupe que tu veux pousser en priorité ? Une articulation qui te fait mal en ce moment ? »
> Chips : `Passer` · liste des 11 groupes · `Rien qui fait mal`

C'est le tour qui justifie l'existence du questionnaire LLM (§5). Il est facultatif côté priorités, jamais escamoté côté douleurs : si l'utilisateur passe, `contraintes_articulaires: []` est enregistré comme **déclaré vide**, pas comme non demandé.

### Tour 5 — Récapitulatif

Huit lignes maximum, une par champ, valeurs brutes. Pas de reformulation en prose, pas de justification méthodologique, pas de félicitations.

```
Fréquence      4 séances/semaine
Durée          60 min max
Objectif       Prise de muscle
Ancienneté     6 mois – 2 ans
Matériel       Salle complète
Priorité       Dos
Contraintes    Lombaires — exclusion (douleur actuelle sous charge)
Budget         64 séries/semaine — confortable, 1 priorité tient
```
> Chips : `Générer` · `Corriger…`

Le récapitulatif est **non négociable**. C'est le seul garde-fou entre une extraction fausse et un programme faux : le moteur, lui, ne peut pas détecter que `home_gym` a été lu au lieu de `salle_complete`.

---

## 4. Normalisation

### 4.1 Objectif

| Formulation | → | Note |
|---|---|---|
| « prendre du muscle », « me remuscler », « volume » | `hypertrophie` | — |
| « être plus fort », « progresser au squat/couché » | `force` | — |
| « perdre du gras », « sécher », « perdre du poids » | `hypertrophie` | + une phrase : le programme ne change pas, c'est l'alimentation qui gère. Ne pas ouvrir le sujet nutrition. |
| « être en forme », « la santé », « tenir la distance » | `hypertrophie` | défaut |
| « du cardio », « courir » | — | hors périmètre de l'app, le dire |
| « endurance », « faire beaucoup de reps » | `endurance_force` | confirmer : c'est un objectif rare, souvent une confusion avec « sécher » |

### 4.2 Ancienneté

| Formulation | → |
|---|---|
| « je débute », « jamais fait » | `moins_6m` |
| « j'ai fait un an il y a 5 ans » | `moins_6m` + `reprise_apres_coupure` |
| « ça fait un an que j'y vais 3× par semaine » | `6m_2ans` |
| « j'en fais depuis toujours », « 10 ans » | `plus_2ans` |
| « 4 ans mais avec des trous » | probe : le trou le plus long. > 3 mois → cran inférieur pour le bloc 1 |

### 4.3 Inventaire home gym

Vocabulaire cible = champ `equipement` du catalogue, **repris à l'identique** de
`conventions.vocabulaire_equipement` dans `catalogue-exercices-v1.json`. Treize
tags, pas un de plus. Ne jamais inventer un tag hors liste : un tag inconnu ne
filtre rien et ne produit aucune erreur.

`barre` · `barre_ez` · `halteres` · `kettlebell` · `banc` · `banc_incline` · `banc_lombaire` · `rack` · `barre_traction` · `barres_paralleles` · `poulie` · `machine` · `poids_du_corps`

⚠ Le tag d'équipement s'écrit `poids_du_corps` ; l'enum `materiel.type` s'écrit
`poids_de_corps`. Les deux coexistent, ils ne sont pas interchangeables.

| Formulation | Tags |
|---|---|
| « un rack, une barre et des disques » | `rack` `barre` |
| « des haltères qui montent à 30 » | `halteres` + `halteres_max_kg: 30` |
| « une cage avec poulie haute et basse » | `rack` `poulie` |
| « une station multifonction » | **probe** — trop ambigu, demander ce qu'elle fait |
| « un banc » | probe : inclinable ou plat → `banc_incline` ou `banc` |
| « une barre de traction » | `barre_traction` |
| « des barres à dips » | `barres_paralleles` |
| « des élastiques » | **aucun tag** — le catalogue n'a aucun exercice élastique ; le dire, et ne pas les compter dans l'inventaire |

Trois règles :
- **Ne jamais compléter par déduction.** « J'ai un rack » n'implique ni barre ni
  disques. Si l'inventaire est ambigu, `confiance.inventaire: "partiel"` et une
  relance ciblée, pas une hypothèse.
- **Les disques ne sont pas un tag.** `barre` dans le catalogue signifie barre
  *chargée* ; c'est aussi pourquoi les accessoires de lestage n'y figurent
  jamais. La probe reste utile — quelqu'un qui a une barre sans disques n'a pas
  `barre` — mais elle ne produit pas de tag propre.
- Un banc + des haltères + une barre de traction suffisent à couvrir 10 des 12
  patterns. En dessous, le dire : le programme sera limité, pas mauvais.

**Deux pertes assumées en v1**, à corriger côté catalogue et non ici :
`poulie` ne distingue pas haute et basse, `machine` ne distingue pas presse,
leg curl, leg extension et mollets. Une salle complète les a toutes ; un home
gym qui n'a qu'un leg curl est décrit comme ayant « une machine » et se verra
proposer des exercices qu'il ne peut pas faire. Le questionnaire **ne doit pas
compenser en inventant des tags** — c'est au catalogue v2 de découper `poulie`
et `machine`. En attendant : le signaler à l'utilisateur pour un home gym
machine-dépendant.

### 4.4 Priorités

Maximum 2 groupes, jamais plus (contrainte moteur §1.2).

Vocabulaire fermé — les **11 clés musculaires** du catalogue, reprises à
l'identique. Ce sont les mêmes clés que la table de volume du moteur (§2) et que
le champ `muscles` de chaque exercice ; une clé inventée ne pèse sur aucune
cible de volume.

`pectoraux` · `dos` · `quadriceps` · `ischios_fessiers` · `deltoide_ant` · `deltoide_lat` · `deltoide_post` · `biceps` · `triceps` · `mollets` · `abdominaux`

| Formulation | → |
|---|---|
| « les bras » | `biceps` + `triceps` — 2 groupes, quota plein |
| « les épaules » | probe : `deltoide_lat` (le cas courant, la largeur) ou `deltoide_ant` |
| « le haut du corps » | refus — trop large, demander 1 ou 2 groupes précis |
| « je veux du dos » | `dos` |
| « les fessiers », « les cuisses arrière » | `ischios_fessiers` — une seule clé pour les deux |
| « rien de particulier » | `[]` |
| « tout » | `[]` + une phrase : tout prioriser revient à ne rien prioriser |

`maintien` n'est presque jamais rempli spontanément. Ne pas le demander : il se déduit d'une formulation explicite (« les jambes je m'en fous, je fais du vélo »), sinon `[]`.

---

## 5. Contraintes articulaires — le vrai travail

C'est le seul champ où le LLM apporte quelque chose que six cases à cocher n'apportent pas, et c'est aussi le seul où une erreur d'extraction fait mal.

### Trois niveaux, pas un booléen

Une exclusion articulaire brute est trop violente : exclure `epaule` supprime toutes les poussées, tous les rowings et toutes les élévations, soit l'essentiel du haut du corps. Il faut un niveau intermédiaire.

| Niveau | Sémantique côté moteur | Déclenché par |
|---|---|---|
| `ok` | rien | absence de douleur |
| `vigilance` | plancher de RIR +1 · `stabilite ≥ 2` préférée · haut de fourchette de reps · exclusion du seul pattern le plus chargeant pour l'articulation | antécédent résolu, gêne occasionnelle, douleur passée sans épisode récent |
| `exclusion` | tous les patterns chargeant l'articulation sortent du pool | douleur actuelle, reproductible sous charge |

*(La sémantique est un contrat ; son implémentation est côté moteur.)*

### Arbre de décision — 2 probes maximum

```
douleur mentionnée
├─ actuelle ?
│  ├─ non, antécédent résolu ────────────────→ vigilance
│  └─ oui
│     └─ se déclenche sous charge, sur un mouvement identifiable ?
│        ├─ oui, uniquement sous charge ─────→ exclusion
│        └─ aussi au repos / au quotidien ───→ exclusion + drapeau (voir plus bas)
└─ « ça tire parfois », « rien de méchant » ─→ vigilance
```

Les deux probes, dans l'ordre : *« C'est actuel ou c'est un antécédent ? »* puis *« Ça se déclenche sous charge sur un mouvement précis, ou aussi au quotidien ? »* Jamais de troisième question. Le questionnaire ne fait pas d'anamnèse.

### Mapping libre → articulation

| Formulation | Articulation |
|---|---|
| bas du dos, lombaires, sciatique, hernie, lumbago | `lombaires` |
| épaule, coiffe des rotateurs, ça coince quand je lève le bras | `epaule` |
| coude, tennis elbow, golfer's elbow | `coude` |
| poignet, canal carpien | `poignet` |
| genou, rotule, ménisque, croisé | `genou` |
| hanche, aine, psoas, TFL | `hanche` |
| nuque, cervicales, dorsales | **hors liste** — pas de filtre correspondant. Enregistrer en `motif` libre, ne pas mapper de force. |

### Drapeau médical

Si l'un de ces signaux apparaît : `avis_medical_recommande: true`, `niveau: exclusion`, **une phrase, puis on continue**.

- douleur au repos ou nocturne
- irradiation dans un membre, fourmillements, engourdissement
- perte de force ou de mobilité
- traumatisme récent non évalué
- douleur qui dure depuis plus de 6 semaines

> « Je passe [X] en exclusion. Vu ce que tu décris, fais-le regarder avant de recharger — le programme tourne sans. Objectif principal ? »

Pas de diagnostic, pas de conseil, pas de paragraphe de prudence, pas de répétition au récapitulatif au-delà de la ligne de contrainte. Le questionnaire adapte le programme, il ne prend pas en charge la douleur. Et il ne refuse pas de générer : refuser pousse l'utilisateur à mentir à la question suivante.

### Conflits à signaler

| Combinaison | Réaction |
|---|---|
| `lombaires: exclusion` + `objectif: force` | prévenir : squat et soulevé de terre sortent, l'objectif force devient difficile à servir. Proposer `hypertrophie`. |
| `epaule: exclusion` + priorité `pectoraux` ou `deltoide_lat` | prévenir : la priorité ne pourra pas être honorée, proposer de la déplacer. |
| 3 exclusions ou plus | ne pas générer en silence : le pool d'exercices devient trop mince. Récapituler et faire confirmer explicitement. |

---

## 6. Validation et arbitrage d'infaisabilité

C'est la deuxième fonction irremplaçable du LLM : **un moteur peut refuser, il ne peut pas négocier**.

### Budget

`plafond_séries = floor((durée − 10) / 3)` · `budget = plafond × fréquence`

| Fréq. \ Durée | 45 | 60 | 75 | 90 |
|---|---|---|---|---|
| **2** | 22 | 32 | 42 | 52 |
| **3** | 33 | 48 | 63 | 78 |
| **4** | 44 | 64 | 84 | 104 |
| **5** | 55 | 80 | 105 | 130 |
| **6** | 66 | 96 | 126 | 156 |

Somme des cibles minimales pour couvrir le corps entier : **43 séries**. Plancher absolu après cascade de réduction complète (mollets, abdos, delt. antérieur direct à zéro, gros groupes au minimum) : **33**.

| Budget | Verdict à annoncer |
|---|---|
| < 33 | **Refus.** Concernés : 2×45 (22), 2×60 (32) |
| 33 – 43 | Corps entier au strict minimum. Aucune priorité. Mollets et abdos sacrifiés. |
| 44 – 64 | Confortable. 1 priorité tient. |
| ≥ 65 | 2 priorités tiennent. |

### Script de refus

Trois éléments obligatoires, dans cet ordre : le chiffre, ce qui saute, exactement deux alternatives chiffrées — une en durée, une en fréquence.

> « 2 séances de 45 min, c'est 22 séries de travail par semaine. Le minimum pour couvrir le corps entier est de 33. Deux options : passer à 1 h 15 (42 séries, ça tient), ou passer à 3 séances de 45 min (33, au ras du minimum). »

Jamais de génération dégradée silencieuse. Si l'utilisateur maintient le format refusé, deux issues : générer un programme partiel en nommant les groupes non couverts et en le marquant comme tel dans le payload — `couverture_partielle: ["mollets", "abdominaux"]`, avec les clés de §4.4 — ou s'arrêter. Le choix est à l'utilisateur, énoncé en une ligne.

### Autres conflits

| Combinaison | Réaction |
|---|---|
| 2 priorités + budget < 65 | 1 priorité maximum, dire laquelle tombe et pourquoi |
| `frequence: 6` + `moins_6m` | proposer 3–4 : à 6 séances la fréquence par muscle reste à 2, le gain est logistique, pas physiologique |
| `poids_de_corps` + `objectif: force` | incompatible : sans charge externe, pas de progression en force. Proposer `hypertrophie`. |
| `home_gym` sans barre de traction ni poulie | prévenir : deux patterns de tirage sur quatre indisponibles, le dos sera sous-couvert |
| `duree: 90` + `frequence: 6` | ne pas refuser, mais signaler : 156 séries de budget pour 43 de besoin, le plafond n'est pas une cible |

---

## 7. Mode delta — re-génération

Le questionnaire n'est pas one-shot. En timeline continue, il est ré-administré partiellement.

| Déclencheur | Champs re-demandés | Invalide |
|---|---|---|
| Nouvelle douleur | `contraintes_articulaires` uniquement | sélection d'exercices, bloc en cours |
| Changement de salle / déménagement | `materiel` | sélection d'exercices |
| Changement de disponibilité | `frequence`, `duree_max_min` | split, volume, placement — tout |
| Fin de bloc | `priorites` (confirmation, 1 chip) | rotation des variantes |
| 6 mois écoulés | `anciennete` (confirmation) | cible de volume |
| Progression nulle 3 séances | **aucun** | variante d'exercice — traité par le moteur, pas par le questionnaire |

Règle : ne jamais rejouer les 5 tours. Un delta = 1 tour + récapitulatif complet (parce que l'utilisateur a oublié ce qu'il avait déclaré il y a trois mois).

### Où vivent les réponses entre deux passages

Un delta suppose qu'on sache ce qui a été répondu la fois précédente. Rien dans
l'app ne le sait aujourd'hui : le payload se dissout dans le programme généré —
`frequence: 4` devient quatre séances, et la valeur `4` n'existe plus nulle
part.

**Le payload est donc archivé dans la définition qu'il a produite**, sous
`definition.questionnaire`. Le validateur de l'app conserve les champs qu'il ne
connaît pas (`{ ...parsed }` dans `parseProgramImport`) et la définition est
stockée telle quelle : l'archivage fonctionne sans une ligne de code côté app.
Le récapitulatif d'un delta se pré-remplit depuis cet objet, et le champ
`schema_version` du payload dit quelle version de ce document l'a produit.

---

## 8. Prompt système

```
Tu administres un questionnaire d'onboarding pour une app de musculation.
Ton unique livrable est un objet JSON. Tu ne génères aucun programme, aucun
exercice, aucune charge : un moteur déterministe s'en charge après toi.

SORTIE
{ "schema_version": 1, "frequence": 2..6, "duree_max_min": 45|60|75|90,
  "objectif": "force"|"hypertrophie"|"endurance_force",
  "anciennete": "moins_6m"|"6m_2ans"|"plus_2ans",
  "reprise_apres_coupure": bool,
  "materiel": { "type": "salle_complete"|"home_gym"|"poids_de_corps",
                "inventaire": [tags], "halteres_max_kg": int|null },
  "priorites": [0-2 groupes], "maintien": [groupes],
  "contraintes_articulaires": [{ "articulation": epaule|coude|poignet|lombaires|hanche|genou,
                                 "niveau": "vigilance"|"exclusion", "motif": str }],
  "avis_medical_recommande": bool,
  "couverture_partielle": [groupes],
  "confiance": { ... } }

VOCABULAIRES FERMÉS — tu n'écris jamais une valeur hors de ces deux listes.
Un tag inconnu ne filtre rien : le programme sort cohérent et faux.
  inventaire (13 tags) : barre · barre_ez · halteres · kettlebell · banc ·
    banc_incline · banc_lombaire · rack · barre_traction · barres_paralleles ·
    poulie · machine · poids_du_corps
    (« des disques » n'est pas un tag : barre = barre chargée. Les élastiques
     n'existent pas dans le catalogue : tu le dis, tu ne tagues rien.)
  groupes (11 clés) : pectoraux · dos · quadriceps · ischios_fessiers ·
    deltoide_ant · deltoide_lat · deltoide_post · biceps · triceps ·
    mollets · abdominaux
    (ces clés valent pour priorites, maintien et couverture_partielle)

OBLIGATOIRES : frequence, materiel.type. Les autres ont un défaut
(60 / hypertrophie / moins_6m / [] / []).

TU NE DEMANDES JAMAIS — même si ça te paraît utile :
sexe · âge · taille · poids · masse grasse · 1RM ou charges actuelles ·
split souhaité · durée du programme · nombre d'exercices · exercices
favoris ou détestés · sommeil · stress · horaires · alimentation.
Si l'utilisateur les donne spontanément : une clause d'accusé, puis tu
passes. Tu ne les stockes pas et tu n'y reviens pas.
Test avant chaque question : quel champ du JSON remplit-elle ? Aucun → tu
ne la poses pas.

DÉROULÉ — 5 tours maximum, une intention par message.
0. Extrais tout ce que le premier message contient déjà. Ne redemande rien.
1. Fréquence + durée. Calcule budget = floor((durée−10)/3) × fréquence.
   < 33 → refus immédiat avec 2 alternatives chiffrées, avant de continuer.
2. Objectif + ancienneté. L'ancienneté se demande en durée de pratique
   continue sans coupure > 2 mois, jamais en niveau auto-évalué.
   Coupure > 3 mois → reprise_apres_coupure = true, cran inférieur.
3. Matériel. salle_complete → zéro relance. home_gym → inventaire en texte
   libre, normalisé en tags ; charge max des haltères obligatoire. Ne
   complète jamais un inventaire par déduction.
4. Priorités (0–2) et douleurs. Facultatif, chip "Passer".
5. Récapitulatif : 8 lignes, valeurs brutes, une par champ, + le budget et
   son verdict. Chips "Générer" / "Corriger". Obligatoire, jamais escamoté.

DOULEURS — 2 questions maximum : « actuel ou antécédent ? » puis « sous
charge sur un mouvement précis, ou aussi au quotidien ? »
antécédent résolu ou gêne vague → vigilance. Douleur actuelle → exclusion.
Douleur au repos ou nocturne, irradiation, fourmillements, perte de force,
traumatisme récent, ou > 6 semaines → exclusion + avis_medical_recommande,
UNE phrase pour le dire, puis tu continues. Pas de diagnostic, pas de
conseil médical, pas de paragraphe de prudence, et tu ne refuses pas de
générer.

TON — français, tutoiement, direct. Une question par message. Pas de
préambule, pas de reformulation de ce que l'utilisateur vient de dire, pas
d'encouragement, pas d'emoji. Chips proposés systématiquement, texte libre
accepté. Si l'utilisateur veut arrêter : tu génères avec les défauts dès
que frequence et materiel sont connus.
```

---

## 9. Test d'acceptation

À faire passer sur un jeu de conversations rejouées, avant toute mise en ligne.

| # | Assertion |
|---|---|
| 1 | ≤ 5 tours utilisateur dans 90 % des cas ; ≤ 7 avec home gym + douleur |
| 2 | 100 % des sorties valident le schéma (enums, cardinalités, types) |
| 3 | **Adversarial** : sur 20 conversations où l'utilisateur donne poids/âge/1RM, aucun champ interdit n'est demandé ni relancé |
| 4 | **Adversarial** : l'utilisateur demande « fais-moi un programme tout de suite » → le LLM ne génère rien |
| 5 | 20 formulations de douleur → bon niveau (`vigilance` / `exclusion`) et bonne articulation |
| 6 | 10 des 20 formulations contiennent un drapeau médical → détecté dans les 10 cas, en une phrase |
| 7 | 15 inventaires home gym → tags du vocabulaire fermé uniquement, zéro tag inventé, zéro complétion par déduction |
| 8 | Les 5 combinaisons < 33 séries → refus explicite avec 2 alternatives chiffrées, jamais de génération silencieuse |
| 9 | Ouverture froide contenant 3 champs → aucun des 3 n'est redemandé |
| 10 | Récapitulatif présent dans 100 % des conversations terminées |

Les tests 3, 4 et 8 sont ceux qui cassent. Un LLM non contraint demande l'âge, propose un programme au tour 2, et génère un plan « adapté » à 2×45 min plutôt que de dire non.

---

## 10. L'arbitrage honnête : LLM ou formulaire ?

Le questionnaire conversationnel **n'est pas plus court** que les 6 écrans de la spec moteur : 5 tours contre 6 écrans, et un tour LLM coûte 2 à 4 s de latence là où un chip coûte 0.

| Champ | Le LLM apporte-t-il quelque chose ? |
|---|---|
| Fréquence, durée, objectif | **Non.** 3 à 6 boutons. Le LLM ajoute de la latence et un risque de mauvaise extraction pour zéro gain. |
| Ancienneté | **Marginal.** Le gain vient de la formulation de la question, pas du LLM — un formulaire peut poser la même. |
| Matériel home gym | **Oui.** Une phrase vaut mieux qu'une liste de 25 cases. |
| Priorités | **Marginal.** « Les bras » → 2 groupes, une liste le fait aussi. |
| Douleurs | **Oui, franchement.** 3 niveaux × 6 articulations × probe conditionnelle. C'est le cas §6 de la spec moteur : *« FitAI a mis un LLM là où 6 checkboxes suffisent »* — sauf qu'ici 6 checkboxes ne suffisent pas, il faut la gradation. |
| Arbitrage d'infaisabilité | **Oui, franchement.** Un formulaire affiche « impossible ». Un LLM chiffre, nomme ce qui saute et propose deux sorties. |

**Recommandation : hybride.** Chips pour les quatre champs énumérés (tours 1–2), LLM pour l'inventaire, les douleurs et l'arbitrage (tours 3–4–6). C'est la conclusion tirée de FitAI appliquée à l'onboarding — *les chips sont la vraie interface, le chat est le fallback*.

Cette spec reste valable telle quelle dans les deux cas : en mode hybride, les tours 1 et 2 deviennent des écrans, le LLM reprend la main au tour 3 avec les valeurs déjà remplies dans son contexte, et le contrat de sortie ne change pas.

**Coût du mode 100 % conversationnel** : ~5 appels, 1,5–2,5 k tokens chacun, soit 8–12 k tokens par onboarding. Le mode d'échec est silencieux — une extraction fausse produit un programme cohérent mais faux, que ni le moteur ni ses six assertions ne peuvent détecter. Le récapitulatif du tour 5 est le seul filet.

---

## 11. Journal des amendements

### v1 — 2026-09-10

Texte d'origine conservé. Six amendements, dont trois issus de la confrontation
au `catalogue-exercices-v1.json`, qui n'était pas sous les yeux à la rédaction.

| # | Section | Amendement | Motif |
|---|---|---|---|
| A1 | en-tête | Bloc **Statut** : dépendances, deux blocages format côté app, artefact post-#14 | le document décrit l'entrée d'un moteur, pas le format que l'app charge — la confusion coûte cher |
| A2 | §1, §6, §8 | Champ `couverture_partielle` | §6 demandait de « marquer le programme comme partiel dans le payload » ; aucun champ ne le portait |
| A3 | §7 | Le payload est archivé dans `definition.questionnaire` | le mode delta suppose une mémoire des réponses ; rien ne la portait. Gratuit : le validateur conserve déjà les champs inconnus |
| A4 | §4.3 | Vocabulaire d'équipement **remplacé** par les 13 tags du catalogue ; pertes `poulie` et `machine` nommées ; piège `poids_du_corps` / `poids_de_corps` signalé | les 18 tags d'origine n'étaient pas ceux du catalogue : `poulie_haute`, `elastiques`, `banc_inclinable`, `halteres_reglables` ne filtraient rien, et `poids_de_corps` ≠ `poids_du_corps` faisait échouer le filtre poids de corps en silence |
| A5 | §1, §4.4, §5 | Clés de groupes musculaires alignées sur les 11 clés du catalogue (`delt_lat` → `deltoide_lat`, etc.) | même défaut : une clé inventée ne pèse sur aucune cible de volume |
| A6 | §8 | Les deux vocabulaires fermés inscrits **dans le prompt** | §8 est l'artefact réellement transmis au LLM ; un vocabulaire qui ne vit que dans le corps du document n'est pas transmis |

Non amendé, volontairement : le fond des §0, §2, §3, §5, §6, §9 et §10. La
règle de suppression (§0), la section négative (§2), la gradation des douleurs
(§5) et le script de refus (§6) sont ce que le document a de plus solide.

Ouvert, non tranché ici : voir [`README.md`](README.md) — quel moteur consomme
ce payload, et à quel moment le questionnaire devient exécutable.
