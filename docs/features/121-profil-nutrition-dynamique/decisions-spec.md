# Décisions — Profil et Nutrition dynamiques (#121)

Source : spec.md
Périmètre : choix produit/exigences uniquement.
Statut : en attente des réponses de Simon

## Q1 — Champs calculés stockés, ou purement dérivés à l'affichage ?

**Question.** `journal-shape.js:528-544` valide aujourd'hui que `profile`
porte `maintenanceKcal`, `startKcal`, `macros.{p,f,c}` et `targetWeightKg`
comme des nombres déjà là. Avec les 6 champs bruts (taille, poids, âge,
sexe, activité, objectif), faut-il continuer à stocker ces quatre valeurs
calculées (recalculées et réécrites à chaque changement d'un champ brut), ou
les calculer uniquement à l'affichage et arrêter de les stocker ? Ce choix
décide si un journal déjà enregistré (qui porte les champs calculés à la
main, sans champs bruts) continue de se lire à l'identique.

**Option A — Champs calculés stockés (les deux jeux de champs coexistent)**
- Ce que ça veut dire : `profile` porte les 6 champs bruts *et* les 4 champs
  calculés. Une fonction (ex. `computeNutritionProfile()`) recalcule et
  réécrit les 4 champs calculés à chaque sauvegarde du formulaire d'édition.
- Implications : `journal-shape.js` ne change quasiment pas (la validation
  actuelle des 4 champs reste valable telle quelle) ; il suffit d'ajouter la
  validation, optionnelle, des 6 champs bruts. Un journal existant, qui n'a
  que les 4 champs calculés, continue de fonctionner sans rien toucher —
  `nutritionBlocks()` n'a pas besoin de savoir d'où viennent les nombres.
- Pour : rétrocompatibilité gratuite, aucune migration, `plan.js:462` ne
  change pas de logique de lecture.
- Contre : deux sources de vérité possibles si quelqu'un modifie les champs
  bruts sans que le recalcul se déclenche (bug de synchronisation) — à
  garder en tête en design (le recalcul doit être le seul chemin d'écriture
  des 4 champs, jamais une saisie manuelle directe).

**Option B — Purement dérivé, rien de calculé n'est stocké**
- Ce que ça veut dire : `profile` ne porte que les 6 champs bruts ;
  `maintenanceKcal`/`startKcal`/`macros`/`targetWeightKg` disparaissent du
  format stocké, recalculés à chaque rendu de `nutritionBlocks()`.
- Implications : `journal-shape.js:531-543` doit changer de validation (exiger
  les 6 champs bruts, plus les 4 calculés) — et un journal existant qui porte
  seulement les 4 champs calculés (le format actuel, écrit à la main) *ne
  valide plus* : soit il faut une migration qui invente des champs bruts
  plausibles à partir de rien (impossible, la donnée n'existe pas), soit ces
  journaux perdent leur section Nutrition.
- Pour : une seule source de vérité, jamais de désynchronisation possible.
- Contre : casse le seul journal réel qui a un profil aujourd'hui (celui de
  Simon) sans reconstruction possible des champs bruts manquants — pousse
  vers un MAJOR avec migration à écrire, pour un problème (désynchronisation)
  qui se règle plus simplement en A.

**Recommandation.** Option A. Elle couvre le cas réel (le journal de Simon
porte déjà des champs calculés sans champs bruts) sans migration, et le
risque de désynchronisation se résout par une règle d'implémentation simple
("les 4 champs ne s'écrivent que via le recalcul"), pas par un changement de
format. Réversible : rien n'empêche de retirer les 4 champs stockés plus
tard si l'usage montre qu'Option B était plus sûre — l'inverse (B → A) serait
plus coûteux.

**Décision de Simon :** Option A confirmée (2026-09-26).

## Q2 — Le poids du bilan hebdo redéclenche-t-il le calcul du métabolisme ?

**Question.** `profile.poids` (calcul BMR/TDEE) et le `poids` du bilan hebdo
(`BILAN_KEYS`, `App.jsx:90`) sont deux données distinctes. La méthode
Nutrition existante ajuste déjà les calories via la table Si/Alors
(`plan.js:263-267`, ex. "gain > 0,4 kg/sem sur 2 semaines → −150 à
−200 kcal"), basée sur la tendance observée. Faut-il, en plus, recalculer
automatiquement le métabolisme (BMR/TDEE) à chaque nouvelle pesée
hebdomadaire ?

**Option A — Le poids hebdo n'alimente que la table Si/Alors, jamais le BMR**
- Ce que ça veut dire : `profile.poids` reste une photo prise à la création
  ou à une modification volontaire du profil ; le poids hebdo continue de
  nourrir uniquement l'ajustement empirique déjà en place.
- Implications : aucun nouveau déclencheur de recalcul à écrire ; le poids
  hebdo garde exactement son rôle actuel.
- Pour : cohérent avec la méthode existante, qui attend deux semaines et
  juge la pente plutôt que de réagir à chaque pesée — un recalcul
  hebdomadaire du BMR réintroduirait le bruit (eau, glycogène) que cette
  méthode ignore délibérément. Un écart de poids de 1 à 3 kg en cours de
  cycle ne change pas significativement le métabolisme de base.
- Contre : le poids utilisé par la formule devient légèrement daté avec le
  temps — négligeable sur 12 semaines, et corrigé de fait par la table
  Si/Alors.

**Option B — Chaque poids hebdo redéclenche un recalcul du BMR/TDEE**
- Ce que ça veut dire : la formule se recalcule à chaque nouvelle pesée.
- Implications : deux mécanismes d'ajustement calorique actifs en même
  temps (formule physiologique + table empirique), sans hiérarchie définie
  entre les deux en cas de désaccord.
- Pour : la formule reste "à jour" sur le poids réel.
- Contre : duplique la table Si/Alors avec une logique différente, et
  réintroduit le bruit hebdomadaire que la méthode actuelle évite déjà.

**Recommandation.** Option A — confirmée par Simon : un écart de poids
inter-cycle de 1 à 3 kg ne modifie pas significativement le métabolisme, et
la table Si/Alors existante couvre déjà l'ajustement réel sur la tendance.

**Décision de Simon :** Option A confirmée (2026-09-26).

## Q3 — Nombre de paliers pour le niveau d'activité

**Question.** La spec esquisse 3 paliers (sédentaire/modéré/actif). Un
facteur d'activité (multiplicateur du BMR pour obtenir la maintenance) a
souvent 4 à 5 paliers dans la littérature courante (sédentaire, léger,
modéré, actif, très actif). Combien de paliers exposer dans le formulaire ?

**Option A — 3 paliers (sédentaire / modéré / actif)**
- Ce que ça veut dire : un facteur multiplicateur par palier, ex. 1.2 / 1.4 /
  1.6 (valeurs à affiner en design).
- Implications : formulaire à 3 choix, cohérent avec "rester le plus simple
  possible" déjà retenu pour le cardio (#122) dans la même réflexion.
- Pour : cohérent avec l'esprit "simple d'abord" du reste de la réflexion ;
  moins de choix = moins d'hésitation à la saisie.
- Contre : un facteur d'activité à 3 paliers est plus grossier — l'écart
  kcal entre "modéré" et "actif" peut être large, donc le calcul de départ
  moins précis pour les cas aux marges de chaque palier.

**Option B — 4-5 paliers (échelle Harris-Benedict/Mifflin classique)**
- Ce que ça veut dire : sédentaire / légèrement actif / modérément actif /
  actif / très actif.
- Implications : formulaire à 4-5 choix, calcul plus fin.
- Pour : plus proche des références nutritionnelles standards, précision
  meilleure.
- Contre : va à l'encontre du principe "rester simple, ajouter un module
  plus tard" déjà choisi pour Cardio dans la même série de décisions — pour
  un calcul qui reste, de toute façon, une estimation de départ ajustée
  ensuite par la table Si/Alors sur les deux premières semaines réelles.

**Recommandation.** Option A. La table d'ajustement Si/Alors corrige déjà
l'estimation initiale sur la base de mesures réelles (poids, tour de
taille) — la précision du palier de départ compte moins que la simplicité
du formulaire, et c'est cohérent avec le choix déjà fait pour Cardio dans
cette même réflexion (rester minimal, ajouter un module plus tard si
besoin). Réversible : ajouter des paliers plus tard ne change qu'une liste
de choix et une table de facteurs, aucune donnée stockée ne casse.

**Décision de Simon :** Option A confirmée (2026-09-26).

## Q4 — Contenu du brief IA

**Question.** Le brief copiable doit contenir au minimum kcal/macros/
objectif (spec, critère d'acceptation). Faut-il y ajouter systématiquement
le contexte du programme (nombre de séances/semaine, jour d'entraînement vs
repos — `nutritionBlocks()` distingue déjà les deux dans le pliant "Journée
type" actuel), ou rester au strict minimum nutritionnel ?

**Option A — Brief minimal (kcal, macros, objectif)**
- Ce que ça veut dire : trois lignes de chiffres, sans contexte
  d'entraînement.
- Implications : le plus simple à générer et à maintenir ; l'IA externe
  n'a aucune information sur les jours de séance pour moduler les repas
  (ex. glucides concentrés autour de l'effort, mentionné dans le texte
  actuel `plan.js:258`).
- Pour : simple, rapide à écrire.
- Contre : perd une information que le texte hardcodé actuel donnait déjà
  (distinction jour d'entraînement / repos) — un léger recul par rapport à
  l'existant.

**Option B — Brief enrichi (+ rythme d'entraînement)**
- Ce que ça veut dire : kcal/macros/objectif, plus le nombre de séances/
  semaine (déjà connu via `SESSIONS.length`), pour que l'IA puisse suggérer
  une répartition différente jour d'entraînement / repos.
- Implications : légèrement plus de données à assembler (lire `SESSIONS`
  en plus de `profile`), mais aucune nouvelle donnée à stocker — tout existe
  déjà.
- Pour : ne perd rien par rapport au texte actuel, brief plus utile à l'IA.
- Contre : aucun réel, le coût d'implémentation est marginal.

**Recommandation.** Option B. Le rythme d'entraînement est une donnée déjà
disponible (aucun nouveau champ, aucun nouveau risque de désynchronisation),
et l'omettre reviendrait à appauvrir le brief par rapport à ce que le texte
hardcodé actuel donne déjà. Réversible sans coût : c'est une ligne de texte
en plus dans une fonction de génération, pas une donnée stockée.

**Décision de Simon :** Option B confirmée (2026-09-26).

## Comment appliquer

Une fois les trois décisions remplies, elles se reportent dans spec.md :
Q1 tranche "Impact données et stockage" (MINOR confirmé si Option A) ;
Q2 précise le formulaire dans "Comportement côté utilisateur" ; Q3 précise
le contenu du bloc "Brief pour ton IA". Les questions ouvertes de spec.md
passent à "None".
