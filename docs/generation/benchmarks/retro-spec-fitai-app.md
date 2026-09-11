# Rétro-spécification — FitAI, partie 2 : l'application (16 écrans)

Périmètre : après paywall, session réelle de 7 minutes (16:39 → 16:46) avec 3 séances enregistrées. Complète la rétro-spec du tunnel d'onboarding.

---

## 1. Architecture de navigation

**Bottom nav à 5 onglets** — deux de plus que l'app précédente, et les deux ajouts sont les plus intéressants :

| Onglet | Contenu |
|---|---|
| Routines | Liste des routines générées + « Nouvelle routine » / « Créateur IA » + onglet « Découvrir » |
| Exercices | Catalogue |
| Séance | Séance libre |
| **Récupération** | Modèle de fatigue par muscle + générateur de séance sur muscles frais |
| Compte | Dashboard : profil, coach hebdo, calendrier, historique, mensurations, stats |

Une **bulle d'assistant flottante** est présente sur tous les écrans, bottom-right. Défaut visible sur la capture d'accueil : elle recouvre le bouton `Démarrer` de la troisième routine.

Ton diagnostic « un nouvel écran pour chaque rep, exo, séance » est exact et chiffrable — voir §4.

---

## 2. Le modèle de fatigue — reconstitué et vérifié

C'est la pièce d'ingénierie la plus solide de l'app, et **elle ne contient aucune IA**.

Chaque exercice porte une distribution musculaire fixe (fiche exercice : développé couché haltères = Pectoraux 60 % / Triceps 20 % / Épaules 20 %). Le travail effectué est réparti sur ces muscles et soustrait d'un capital de récupération à 100 %, qui se recharge avec le temps.

**Vérification sur tes propres données :**

| Muscle | Séance 1 | Séance 2 | Cumul | Récupération affichée |
|---|---|---|---|---|
| Épaules | −31 % | −37 % | −68 % | **32 %** ✔ |
| Pectoraux | −13 % | −100 % | −113 % | **0 %** ✔ (plancher) |
| Triceps | −9 % | −100 % | −109 % | **0 %** ✔ |
| Abdos | −9 % | — | −9 % | **91 %** ✔ |
| Biceps | — | −2 % | −2 % | 97 % (attendu 98) |
| Grand dorsal | — | — | 0 | **100 %** ✔ |

Le modèle est donc **additif, dose-dépendant et borné**. Deux confirmations supplémentaires :

- L'écran de routine annonce **la fatigue prévue** avant la séance (Épaules 100 % → 0 %). Après n'avoir fait qu'1 exercice sur 6, le réel est de 31 % au lieu de 100 %. Le modèle réagit au volume réellement effectué, pas au plan.
- La constante de récupération est explicitée dans le verdict : « Laisse Pectoraux au repos. **Environ 72 h de plus.** »

**Boucle produit fermée** : l'onglet Récupération propose « Séance sur muscles reposés » → modale listant les muscles à 100 % (Grand dorsal, Avant-bras) → génère une séance nommée automatiquement « Dos Bras Fessiers Traps ». C'est cohérent de bout en bout.

> Ton objection — « on peut savoir où on se sent fatigué sans IA » — est juste sur le *sensing*, mais rate la vraie fonction. La valeur n'est pas de t'informer que tes pecs sont fatigués : c'est d'en faire **une contrainte machine sur la sélection d'exercices et le placement des séances**. C'est exactement le genre de signal que tu cherchais pour déclencher un deload autrement que par un numéro de semaine. Et le coût d'implémentation est une table de distribution musculaire par exercice + une décroissance temporelle — quelques dizaines de lignes, zéro appel LLM.

---

## 3. Le catalogue d'exercices

Fiche complète et bien structurée. C'est le deuxième élément à conserver.

- Animation avec contrôle **pause + vitesse (1.0x)**
- `Niveau 3` avec barres de difficulté (repris partout dans les listes)
- Note d'exercice libre
- **Graphique historique à 3 métriques** : Poids max / Volume / Puissance (1RM)
- Historique des séances, routines contenant l'exercice
- « Comment faire » (pas à pas) + « Conseils d'expert »
- **Convention de saisie explicitée** : haltères = poids total, « si tu soulèves 5 kg par bras, saisis 10 kg ». Détail que la plupart des apps laissent ambigu.
- Distribution musculaire en donut (60/20/20) — la donnée qui alimente le modèle de fatigue
- Équipement, type, et **variantes** cliquables (Pompe, Développé couché, Presse à haltères)

Défaut de copy : « **Mettez** l'accent sur un tempo contrôlé » — vouvoiement isolé dans une app intégralement tutoyée. Traduction non harmonisée.

---

## 4. La boucle d'exécution — le coût d'interaction

**Chemin pour enregistrer une série :**
`Enregistrer la série` → bottom sheet → molette reps → molette kg → slider RPE → `Terminé` → retour écran exercice.

Soit **4 à 6 interactions par série**. Sur la séance 2 (12 séries), ~60 interactions pour saisir 24 nombres.

Points bien vus malgré tout :

- Colonne **`Dernier`** dans le tableau des séries : la performance précédente à côté de la cible. C'est le bon endroit pour afficher une prescription calculée.
- Toggle **`±0.25 kg / ±1.00 kg`** : granularité d'incrément selon le matériel. Petit détail, vraie qualité.
- **RPE traduit en langage naturel** : `8.5 · 1 ou 2 reps de plus possibles.` C'est la traduction RPE↔RIR faite correctement, au bon endroit.

**Le chiffre le plus important de toute l'analyse pour toi :**

| Séance | Séries évaluées en RPE |
|---|---|
| 2 | 6 sur 12 (50 %) |
| 3 | 3 sur 9 (33 %) |

Sur un test de sept minutes, par un utilisateur motivé qui découvre l'app, **la moitié à deux tiers des RPE ne sont pas saisis**. L'app le sait et l'affiche.

Ton moteur repose sur l'auto-régulation par RIR. C'est ton avantage sur les deux benchmarks — mais il n'existe que si le champ est effectivement rempli. Sur une friction de +1 slider par série, le taux de remplissage réel tombe sous 50 %. Trois pistes : RIR **par exercice** et non par série (dernière série seulement), valeur **pré-remplie** par le moteur avec confirmation implicite, ou saisie **fusionnée** avec les reps (une grille reps × RIR en un geste).

---

## 5. L'assistant LLM

Architecture propre, et ce n'est pas juste un chat.

```
message utilisateur
  → proposition en langage naturel  ("je te conseille Élévation latérale debout, 3 × 10")
  → confirmation utilisateur         ("go")
  → chip d'action                    ("✓ Remplacer le prochain exercice")
  → application + accusé             ("✓ … remplacée … pour cette séance")
```

Trois choses à retenir :

1. **Function calling avec confirmation en deux temps.** Le modèle ne modifie rien sans validation explicite.
2. **Portée session vs routine.** Message d'accueil : « je peux ajuster les séries restantes, remplacer ou passer des exercices, ou changer les temps de repos d'aujourd'hui **sans toucher à ta routine enregistrée** ». C'est la bonne séparation : overrides éphémères / plan persistant. Ça te concerne directement pour ta timeline continue.
3. **Chips d'intentions pré-écrites** : `Allège les séries restantes`, `Remplace le prochain exercice`, `Comment est mon rythme jusque-là ?`, `Passe le dernier exercice`.

**Ta question — « est-ce vraiment ce qu'on veut quand on a 90 s de récup ? » — non, et les captures le prouvent.**

- Le temps de repos réglé est de **60 s**, pas 90.
- Une requête sur deux a échoué : `Désolé, une erreur s'est produite.`, sans retry automatique, il a fallu retaper la question.
- Le parcours « remplace le prochain exo » a coûté 2 messages tapés + 1 confirmation + 2 allers-retours réseau.

Mais la conclusion n'est pas « pas de LLM ». C'est que **la couche qui a de la valeur est celle des intentions → actions, pas la conversation**. Les chips sont la vraie interface : déterministes, un tap, latence nulle, et elles couvrent 90 % des cas réels (alléger, remplacer, passer, rallonger le repos). Le chat n'est que le fallback pour les 10 % restants — et il n'a pas sa place à 60 s de récup.

Le bon placement du LLM chez toi : **hors séance**. Debrief post-séance, bilan hebdomadaire (« Demander au Coach mon bilan de la semaine » existe d'ailleurs sur leur dashboard), interprétation des tendances. Là, la latence et le taux d'erreur n'ont aucune importance.

---

## 6. Démarrage à froid : leur réponse est le gating

Troisième confirmation, après le tunnel et l'app précédente.

- Prescription initiale : `3 séries × 14 reps × 10 kg` au développé épaules machine, pour un homme de 90 kg déclaré intermédiaire. Valeur par défaut, pas une estimation.
- Colonne `Dernier` vide, `Historique des séances : tu n'as pas encore effectué cet exercice.`
- Graphiques **verrouillés avec cadenas** : « Le rapport de musculation se débloque dans **2 séances** »
- Verdict séance 1 : « Encore une séance avec ces mouvements et **tes objectifs de séries se débloquent** »

Autrement dit : ils n'ont pas de solution, ils transforment l'absence de donnée en mécanique de rétention. C'est habile sur le plan produit et vide sur le plan méthodologique. Ton moteur RIR résout ce problème par le calcul dès la séance 2 — à condition que le RIR soit saisi (§4).

---

## 7. Qualité des données : aucun garde-fou

Toutes les valeurs suivantes ont été acceptées et propagées dans les métriques, les records et le modèle de fatigue :

| Donnée enregistrée | Problème |
|---|---|
| Presse pectorale inclinée `3 × 10 × 1 kg` | 1 kg sur une machine — impossible |
| Développé incliné haltères `3 × 14 × 64 kg` | 32 kg/bras × 14 reps — implausible |
| Séance 2 : **26 s**, 3798 kg, **108 kcal** | 108 kcal en 26 s = ~25 000 kcal/h |
| Séance 3 : **13 s**, 1782 kg, 63 kcal | idem |
| `4 records` en séance 2, `3 records` en séance 3 | tout est un record quand l'historique est vide |

Le volume cumulé affiché sur le dashboard (**6156 kg**) est arithmétiquement exact — 576 + 3798 + 1782 — et physiquement dénué de sens. Les kcal ne dérivent d'ailleurs pas du volume : 30 kg de volume → 15 kcal, 900 kg → 24 kcal. C'est un calcul temps × MET greffé sur des durées elles-mêmes fausses.

**Implication directe pour toi** : si tu construis un modèle de fatigue ou un moteur de progression sur le volume, une seule saisie aberrante empoisonne la prescription suivante. Trois bornes suffisent : plausibilité vs poids de corps, incrément minimal cohérent avec le matériel, écart maximal vs historique de l'exercice (avec demande de confirmation au-delà).

---

## 8. Incohérences relevées

- **Muscles parasites dans les routines générées** : « Épaules et bras » contient *Ischio-jambiers*, « Pectoraux et bras inclinés » contient *Mollets*. Le générateur remplit les créneaux plutôt que de respecter le thème annoncé. Même famille de bug que le split annoncé ≠ split généré de l'app précédente.
- **Compteur hebdo faux** : `3/5 séances cette semaine` suivi de « Encore **une** et tu atteins ton objectif ».
- **`Temps de séance : 45 minutes`** existe dans les paramètres mais **n'a jamais été demandé** dans les 17 écrans du tunnel. Valeur par défaut silencieuse.
- Durée de séance affichée au calendrier (`2 min`) alors que trois séances ont eu lieu le même jour.
- Le CTA vert **`Se connecter`** est répété sur chaque écran de fin de séance et sur le dashboard : tout est en local, rien n'est sauvegardé côté serveur tant qu'on ne crée pas de compte. Même problème de durabilité que le tien, traité par du nag.
- Cross-sell **DietAI** (« 60 % de réduction ») dans les paramètres : la nutrition est une app séparée, pas un module.

Point positif inattendu : la routine **« Dos et biceps protégés »**. C'est le seul endroit où ton texte libre sur le bas du dos ressort visiblement dans le produit. Le champ le plus tardif du tunnel est le seul qui ait produit de la personnalisation observable.

---

## 9. Delta avec ton app

| Axe | FitAI | La tienne |
|---|---|---|
| Modèle de fatigue | par muscle, additif, décroissance ~72 h, pilote la génération de séance | absent |
| Catalogue d'exercices | fiche riche + distribution musculaire + variantes + historique | à construire pour le multi-utilisateurs |
| Prescription | défauts figés, gating sur 2–3 séances | calculée dès la séance 2 (double progression + RIR) |
| Effort | RPE optionnel par série, **rempli à 33–50 %** | RIR structurant — donc friction critique |
| Assistant | chat LLM en séance, function calling, portée séance | aucun |
| Overrides | séance vs routine correctement séparés | à définir avec la timeline continue |
| Garde-fous de saisie | aucun | à prévoir avant tout modèle de charge |
| Historique | par exercice, 3 métriques, records | par exercice et date réelle (cible) |
| Durabilité | localStorage + nag « Se connecter » | localStorage + export JSON envisagé |

**À voler**

1. **Le modèle de récupération par muscle.** Table de distribution musculaire par exercice + décroissance temporelle. Il te donne gratuitement : un signal de deload objectif, un contrôle de couverture hebdo, et la génération de séance de rattrapage. Zéro IA.
2. **La distribution musculaire par exercice (60/20/20).** C'est la donnée de base qui alimente à la fois la fatigue, les stats par groupe et le contrôle d'équilibre. À intégrer dès la construction du catalogue.
3. **La colonne `Dernier`** à côté de la cible pendant la saisie. C'est là que ta prescription calculée doit s'afficher.
4. **`±0.25 / ±1.00 kg`** : granularité d'incrément selon le matériel.
5. **La traduction RPE↔RIR en clair** (`8.5 · 1 ou 2 reps de plus possibles`), qui rend le champ compréhensible sans documentation.
6. **La séparation override de séance / routine persistante.** Concept à reprendre tel quel dans ta timeline continue.
7. **Les chips d'intention** (alléger, remplacer, passer, prolonger le repos) — mais en actions déterministes, pas en chat.
8. **La convention de saisie haltères** documentée sur la fiche.

**À ne pas voler**

- 4 à 6 interactions par série. Vise 2, avec le RIR pré-rempli.
- Le RPE par série : par exercice suffit, et sera réellement rempli.
- Le chat LLM pendant la séance. Hors séance : oui.
- Le gating des graphiques comme substitut au démarrage à froid.
- Les kcal et la durée de séance non contrôlées.
- Le `Se connecter` en nag permanent : ton export JSON + `navigator.storage.persist()` traite la durabilité sans harceler.

---

## 10. Synthèse des trois benchmarks

| | App précédente | FitAI | Toi |
|---|---|---|---|
| Force | moteur de progression (e10RM unique) | modèle de fatigue + assistant actionnable | auto-régulation RIR |
| Faiblesse | onboarding redondant, aucune notion de fatigue | prescription creuse, données non contrôlées | mono-utilisateur, pas de catalogue, pas de fatigue |

Les trois pièces sont complémentaires et aucune des deux apps ne les a toutes. Un moteur qui combine **progression auto-régulée par RIR + modèle de fatigue par muscle + catalogue avec distribution musculaire** couvre les deux, avec un tunnel d'entrée trois fois plus court.

Le point de vigilance reste le même à chaque analyse : **tout dépend du taux de remplissage du RIR.** C'est le seul champ dont ton moteur ne peut pas se passer, et c'est précisément celui que les utilisateurs de FitAI sautent une fois sur deux.
