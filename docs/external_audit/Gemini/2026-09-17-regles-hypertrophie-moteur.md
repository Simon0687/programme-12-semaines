# Règles d'hypertrophie pour le moteur de génération — étude Gemini

## Date et statut

- Date : 2026-09-17
- Outil : Gemini (version du modèle non précisée par la source)
- Type : étude de physiologie de l'entraînement, proposée comme jeu de règles pour le moteur
- Statut : **consultatif**. Voir `docs/external_audit/README.md` — un audit n'est jamais
  appliqué tel quel.
- Périmètre couvert par la source : fréquence, volume, intensité (RIR), repos
  inter-séries, plages de répétitions
- Périmètre du dépôt concerné : `docs/generation/moteur-generation-programme.md` §3 et §7,
  `src/assertions.js`, `docs/generation/decisions-moteur.md` Q3

Ce document contient deux parties nettement séparées : **§A**, l'étude telle qu'elle a été
reçue, reproduite sans modification ; **§B**, la vérification contre le dépôt, écrite par
Claude le 2026-09-17. Ne pas confondre les deux.

---

# §A — L'étude, telle que reçue

> L'approche que tu décris s'inscrit dans le paradigme du *High-Intensity Training* (HIT)
> popularisé par des figures comme Arthur Jones, Mike Mentzer ou Dorian Yates, et remis au
> goût du jour par la littérature sur les « répétitions effectives ».
>
> Toutefois, postuler que des séries courtes (4 à 8 répétitions) exécutées 1 à 2 fois par
> semaine constituent l'absolu « optimal » pour l'hypertrophie présente des failles
> conceptuelles et physiologiques.

## A.1 Analyse critique et angles morts de l'hypothèse

1. **Angle mort sur la fréquence (1 fois par semaine).** La synthèse protéique musculaire
   (MPS) consécutive à un entraînement culmine à 24 heures et revient au niveau de base
   après 36 à 48 heures chez un individu entraîné (MacDougall et al., 1995). Entraîner un
   muscle une seule fois par semaine laisse une fenêtre de 4 à 5 jours sans stimulus
   anabolique. La littérature (Schoenfeld et al., 2016) démontre formellement qu'une
   fréquence de 2 fois par semaine par groupe musculaire génère une hypertrophie supérieure
   à 1 fois par semaine.
2. **Angle mort sur la plage de répétitions (4-8 reps).** Restreindre la croissance
   musculaire aux séries courtes est une erreur physiologique. Les méta-analyses récentes
   (Schoenfeld et al., 2017 ; Morton et al., 2018) prouvent que l'hypertrophie est similaire
   sur un spectre allant de 3 à 30 répétitions, à condition que la série soit menée proche
   de l'échec. Limiter les exercices polyarticulaires à 4-8 répétitions systématiquement
   optimise la force (adaptation neuromusculaire), mais génère une fatigue articulaire et
   nerveuse disproportionnée à long terme si l'échec est visé à chaque séance.
3. **Angle mort sur la gestion de la fatigue (volume vs intensité).** Si l'entraînement est
   systématiquement mené à l'échec musculaire (RIR 0), le volume total doit être
   drastiquement réduit pour éviter le surentraînement systémique. Le consensus fixe le
   volume optimal de maintien à ~4-6 séries par semaine, et l'optimisation entre 10 et 20
   séries par muscle par semaine. Si l'intensité est maximale, le moteur algorithmique devra
   borner le volume à la fourchette très basse (6-10 séries).

## A.2 Contexte physiologique : le modèle des répétitions effectives

Pour que l'algorithme génère un programme viable, il doit coder la mécanique de
l'hypertrophie, qui repose sur la **tension mécanique** et le **recrutement des unités
motrices**.

Selon le principe de taille de Henneman, les unités motrices à haut seuil (qui contrôlent
les fibres musculaires avec le plus grand potentiel de croissance) ne sont recrutées que
lorsque les fibres à bas seuil sont fatiguées ou que la charge est extrêmement lourde
(>80-85 % 1RM).

Le modèle de Chris Beardsley stipule que seules les 5 dernières répétitions avant l'échec
musculaire absolu (les « répétitions effectives ») sont fortement stimulantes pour
l'hypertrophie, car la vitesse de contraction ralentit involontairement, maximisant
l'exposition des ponts actine-myosine à la tension mécanique. Une série de 5 répétitions à
l'échec ou une série de 15 répétitions à l'échec fournissent toutes deux environ 5
répétitions effectives.

## A.3 Règles strictes proposées pour le moteur

### A.3.1 Moteur de fréquence (`FREQ_TARGET`)

- **Règle :** `FREQ_TARGET = 2` (chaque groupe musculaire majeur ciblé 2 fois par semaine).
- **Contrainte d'espacement :** délai minimum de 48 heures (`REST_MIN = 48h`) et maximum de
  96 heures (`REST_MAX = 96h`) entre deux sollicitations d'un même groupe.
- **Application :** pas de « Bro-Split » (1 muscle/jour). Structures *Upper/Lower*,
  *Push/Pull/Legs* ou *Full Body*.

### A.3.2 Moteur de volume hebdomadaire (`VOL_WEEKLY`)

- **Règle :** la proximité à l'échec étant élevée, le volume est capé.
  `VOL_WEEKLY` = 6 à 10 séries effectives par groupe musculaire, par semaine.
- **Distribution :** si `FREQ_TARGET = 2`, 3 à 5 séries effectives par groupe et par séance.
- **Exclusion :** les séries d'échauffement (RIR > 3) ne comptent pas dans `VOL_WEEKLY`.

### A.3.3 Moteur d'intensité (`RIR_TARGET`)

Moduler la proximité à l'échec selon le profil biomécanique du mouvement, pour gérer la
fatigue du SNC et le risque de blessure.

- **Polyarticulaires lourds** (squat, soulevé de terre, développé couché) :
  `RIR_TARGET = 1 à 2`. L'échec absolu dégrade la technique et génère trop de fatigue
  systémique par rapport au stimulus local.
- **Polyarticulaires sur machines / poids du corps** (tirage vertical, hack squat, dips) :
  `RIR_TARGET = 0 à 1`.
- **Isolation** (curls, élévations latérales, leg extension) : `RIR_TARGET = 0`, échec
  musculaire absolu systématique, voire échec technique.

### A.3.4 Moteur de repos inter-séries (`REST_PERIOD`)

L'hypertrophie est altérée si le temps de repos est insuffisant pour clairer l'acidité
métabolique et restaurer l'ATP. L'algorithme ne doit pas générer de circuits cardio.

- **Polyarticulaires :** `REST_PERIOD >= 180s` (3 minutes minimum, jusqu'à 5).
- **Isolation :** `REST_PERIOD >= 90s` (1,5 minute minimum).

### A.3.5 Moteur des plages de répétitions (`REP_RANGE`)

Affecter les plages selon le type d'exercice, pour distribuer le stress entre tissu
conjonctif (lourd) et tissu musculaire (léger).

- **Mouvements de base** (tension mécanique prioritaire) : `REP_RANGE = 5-8`.
- **Mouvements secondaires / isolation** (stress métabolique prioritaire) :
  `REP_RANGE = 10-15`. Permet d'obtenir les 5 répétitions effectives sans surmener les
  tendons.

## A.4 Niveau de certitude et sources, tels qu'annoncés par la source

- **Niveau de certitude : élevé.** Les règles reposent sur le consensus scientifique actuel
  en physiologie de l'exercice (2015-2023).
- *Schoenfeld, B. J., et al. (2016).* « Effects of Resistance Training Frequency on Measures
  of Muscle Hypertrophy: A Systematic Review and Meta-Analysis. » (preuve contre la
  fréquence de 1×/semaine)
- *Schoenfeld, B. J., et al. (2017).* « Strength and Hypertrophy Adaptations Between Low- vs.
  High-Load Resistance Training. » (preuve que la plage 4-8 n'a pas le monopole de
  l'hypertrophie)
- *Morton, R. W., et al. (2018).* « A systematic review, meta-analysis and meta-regression of
  the effect of protein supplementation on resistance training-induced gains in muscle mass
  and strength in healthy adults. » (cadre général sur la réponse hypertrophique)
- *MacDougall, J. D., et al. (1995).* « The time course for elevated muscle protein synthesis
  following heavy resistance exercise. » (courbe de MPS justifiant la fréquence 2×)
- *Chris Beardsley*, « Hypertrophy: Muscle fiber growth caused by mechanical tension ».
  Modélisation théorique du recrutement des unités motrices et des *effective reps*.

---

# §B — Vérification contre le dépôt

> Écrit par Claude le 2026-09-17, contre `dev` à 8c4cf7b. Cette partie n'est pas de la
> source.

## B.1 Verdict

**Rien à changer dans le moteur. Aucune issue à ouvrir.**

Deux raisons, dans cet ordre d'importance :

1. **L'étude combat une hypothèse que le dépôt ne défend pas.** Les trois « angles morts »
   de §A.1 attaquent une position — séries de 4-8 reps, 1 à 2 stimulations par semaine,
   échec systématique — qui n'est écrite nulle part. `moteur-generation-programme.md` §3
   étape 6 prescrit déjà 5-10 reps sur les composés et 8-12 sur les isolations en
   hypertrophie, et §3 étape 1 **force** 2 stimulations par muscle et par semaine, au point
   d'en déduire le split plutôt que de le demander à l'utilisateur. La critique porte donc
   sur le prompt qui a été donné à Gemini, pas sur le projet.
2. **Les cinq « règles strictes » de §A.3 sont déjà écrites, et plus finement.** Voir le
   tableau B.2. Une seule proposition est absente du dépôt (`REST_MAX = 96h`), et elle est
   satisfaite par construction — voir B.4.

L'étude a donc une valeur réelle, mais ce n'est pas celle qu'elle croit avoir : elle
**confirme de l'extérieur** des valeurs numériques que le dépôt avait tirées du BLOC B du
template 12 semaines. C'est une corroboration, pas un apport.

## B.2 Correspondance règle par règle

| Règle Gemini (§A.3) | Où c'est déjà dans le dépôt | Écart |
|---|---|---|
| `FREQ_TARGET = 2` | §3 étape 1 : « chaque muscle doit être stimulé 2 fois par semaine », et c'est la contrainte **d'où le split est déduit** | Identique en cible. Le dépôt vérifie à ≥ 1,5 — voir B.3 |
| Pas de bro-split, Upper/Lower · PPL · Full Body | §3 étape 1, table des 5 splits : full body à 2-3, haut/bas à 4-5, PPL à 6 | Identique, et le dépôt justifie chaque ligne par le plafond de séries |
| `REST_MIN = 48h` | §3 étape 5, et **codé** : `assertRecovery()`, `src/assertions.js:404` | Identique, y compris la semaine circulaire (`hoursBetween`, `assertions.js:367`) |
| `REST_MAX = 96h` | absent | Le seul manque réel. Voir B.4 |
| `VOL_WEEKLY` 6-10 séries | `VOLUME` dans `src/assertions.js:62` : dos, pectoraux, quadriceps, ischios/fessiers tous en `{ min: 6, max: 10 }` | Identique au chiffre près |
| 3 à 5 séries par groupe et par séance | §3 étape 4 : `n ← clamp(déficit[m], 2, 4)` | Le dépôt borne à 2-4, Gemini à 3-5. Différence sans conséquence |
| Échauffement exclu du volume | §3 étape 3 : le plafond compte les **séries de travail**, l'échauffement est un forfait de 10 min | Identique |
| `RIR_TARGET` par catégorie de mouvement | §3 étape 6, plancher de RIR par `stabilite` : 3 (machine) → échec autorisé, 2 (haltères) → RIR ≥ 0, 1 (barre libre lourde) → RIR ≥ 1 | **Le dépôt fait mieux.** Voir B.5 |
| `REST_PERIOD` 180s / 90s | §3 étape 6, par objectif : hypertrophie 2-3 min composé / 1-2 min isolation | Voir B.6 : compatible, vérifié par le calcul |
| `REP_RANGE` 5-8 / 10-15 | §3 étape 6 : hypertrophie 5-10 composé / 8-12 isolation | Le dépôt est légèrement plus haut sur les composés et plus bas sur les isolations. Aucun des deux n'est « juste » — voir B.7 |

## B.3 Le vrai désaccord : contrainte dure ou avis

§A.3 demande que ces paramètres soient « encodés comme des contraintes dures ». **À
rejeter**, et pas par confort : c'est une décision déjà prise, tranchée par Simon le
2026-09-15 (`decisions-moteur.md` Q3).

> « Signalé, pas bloquant. Les 6 assertions rendent un avis lisible, le programme se charge
> quand même — un déséquilibre assumé (rééducation, priorité forte) reste chargeable.
> `parseProgramImport()` garde seule le droit de rejeter, sur la forme. »

`src/assertions.js` porte cette décision dans son en-tête : « il conseille, il ne bloque
jamais ». Durcir `FREQ_TARGET = 2` en contrainte rendrait impossible à charger un programme
de rééducation, ou un programme à priorité forte assumée — exactement le cas d'usage que la
décision protège.

Conséquence concrète, et c'est le meilleur argument contre la version dure : **le moteur du
dépôt produit lui-même des programmes à 1,5 stimulation.** La cascade de réduction (§3 étape
3, étape 6) descend un muscle non prioritaire à « une séance sur deux » quand 3 séances de
45 min ne suffisent pas à couvrir le corps. C'est pour ça que l'assertion 2 vérifie **≥ 1,5**
et non ≥ 2 : avec le seuil de Gemini, le moteur échouerait à son propre validateur sur les
combinaisons les plus contraintes, et le validateur signalerait une faute là où il n'y a
qu'un arbitrage assumé.

## B.4 `REST_MAX = 96h` — le seul apport, et il est déjà satisfait

C'est la seule proposition absente du dépôt : `assertRecovery()` ne vérifie qu'une borne
basse (`if (gap >= 48) continue`, `assertions.js:413`).

Vérification de ce que la borne haute attraperait, sur les tables de jours figées de §3
étape 5 :

| Fréquence | Jours | Écarts sur un même groupe |
|---|---|---|
| 2 | L · J | 72 h et 96 h |
| 3 | L · Me · V | 48 h, 48 h, 72 h |
| 4 | L · Ma · J · V | haut : 72 h / 96 h — bas : 72 h / 96 h |

**Aucune combinaison générée ne dépasse 96 h.** La contrainte est donc satisfaite par
construction, et l'ajouter au validateur ne changerait rien sur les 20 combinaisons du §7.

Elle ne pourrait se déclencher que sur un programme **édité à la main** (#36) — par exemple
un haut du corps placé lundi et mercredi, qui respecte les 48 h mais laisse 120 h de trou.

Décision : **pas d'issue maintenant.** Deux raisons. D'abord la valeur est nulle sur le
chemin du moteur. Ensuite la justification scientifique est le maillon le plus faible de
toute l'étude (voir B.8, point 2). À reconsidérer seulement si l'éditeur manuel de #36
montre des placements de ce type à l'usage.

## B.5 RIR : `stabilite` bat la catégorie de mouvement

Gemini range les exercices en trois tiers (polyarticulaire lourd → machine/poids de corps →
isolation) et attache un RIR à chacun. Le dépôt a le même découpage en trois, mais l'attache
à un **champ du catalogue**, `stabilite` (1 = barre libre lourde, 3 = machine/poulie), pas à
une liste d'exercices en dur.

La différence n'est pas cosmétique : les trois tiers de Gemini ne savent pas classer une
fente bulgare, un tirage horizontal à la poulie basse ou un soulevé de terre roumain aux
haltères. `stabilite` le fait, exercice par exercice, au moment de la saisie de la fiche —
et §2 rappelle que le catalogue, pas l'algorithme, est le vrai chantier. Sur le fond les
deux disent la même chose (RIR 1-2 sur barre libre lourde, RIR 0 sur isolation) ; le dépôt
le dit dans une forme qui s'étend à 80 fiches sans toucher au moteur.

## B.6 Repos : la vérification arithmétique

Les chiffres de Gemini (180 s composé, 90 s isolation) semblent en tension avec le modèle de
durée du dépôt, qui compte forfaitairement **3 min par série de travail**
(`plafond_séries = floor((durée − 10) / 3)`, et son inverse dans `assertDuration()`,
`assertions.js:532`). 3 min de repos plus l'exécution, ça fait plus de 3 min.

Vérifié sur les séances de l'exemple exécuté du §5, avec ~40 s d'exécution par série :

- **Haut A** — 8 séries composées, 6 d'isolation : 8×(180+40) + 6×(90+40) = 2540 s ≈ 42 min,
  plus 10 min d'échauffement = **52 min**. Le modèle forfaitaire annonce 10 + 3×14 = **52 min**.
- **Bas A** — 7 composées, 6 d'isolation : 7×220 + 6×130 = 2320 s ≈ 39 min, + 10 = **49 min**.
  Forfaitaire : 10 + 3×13 = **49 min**.

Le forfait de 3 min est donc **calibré juste** pour le mélange composé/isolation que produit
le moteur, aux chiffres de Gemini près. Rien à corriger. Le risque théorique — une séance
presque uniquement composée serait sous-estimée — est bloqué en amont par le cap dur de 6
exercices et la règle « jamais deux exercices du même pattern dans une séance ».

## B.7 Répétitions : ni l'un ni l'autre n'a raison, et c'est le point

Gemini prescrit 5-8 sur les composés et 10-15 sur les isolations ; le dépôt, 5-10 et 8-12.
L'écart est réel mais vide de sens, et l'étude fournit elle-même l'argument qui le vide :
si l'hypertrophie est équivalente de 3 à 30 répétitions à effort égal (§A.1 point 2), alors
le choix entre 5-8 et 5-10 ne se tranche pas par la physiologie. Il se tranche par la
praticabilité — et là, 5-10 vaut mieux que 5-8, parce que la double progression du dépôt
(§3 étape 7, `src/progression.js`) a besoin d'une fourchette assez large pour que « toutes
les séries en haut de fourchette » soit un événement qui arrive.

Une étude qui prescrit `REP_RANGE = 5-8` trois paragraphes après avoir démontré que la plage
n'a pas d'importance se contredit. Le dépôt, lui, choisit ses fourchettes sur un critère que
l'étude ne connaît pas : le moteur de progression qui va les consommer.

## B.8 Ce qui ne tient pas dans l'étude elle-même

Cinq réserves, par ordre décroissant de gravité. Elles ne changent rien au verdict B.1 —
elles comptent pour la prochaine fois qu'une étude de ce type arrivera.

1. **La preuve principale sur la fréquence est périmée.** Schoenfeld et al. 2016 conclut bien
   2× > 1×, mais la méta-analyse de suivi des mêmes auteurs (Schoenfeld, Grgic & Krieger,
   2019, *J Sports Sci*) montre qu'à **volume hebdomadaire égal**, la fréquence n'a pas
   d'effet propre : ce qu'on mesurait en 2016, c'était le volume supplémentaire que la
   fréquence 2× amenait avec elle. L'étude présente 2016 comme une démonstration « formelle »
   sans mentionner la correction. Ça ne change pas la règle — 2× reste le bon défaut, parce
   que c'est le moyen le plus simple de répartir le volume et de tenir le plafond de séries
   par séance — mais ça change la **raison**, et donc ce qu'on est prêt à en déduire.
2. **L'argument MPS est une inférence fragile.** Passer de la courbe de synthèse protéique
   aiguë (MacDougall 1995) à l'hypertrophie chronique est précisément le saut que la
   littérature a invalidé : Mitchell et al. 2014 (*PLoS ONE*) ne trouve aucune corrélation
   entre la MPS post-exercice et l'hypertrophie mesurée après 16 semaines chez les mêmes
   sujets. C'est la justification affichée de `REST_MAX = 96h`, ce qui pèse dans la décision
   de B.4.
3. **Une source est mal attribuée.** Morton et al. 2018 porte sur la **supplémentation en
   protéines**, comme son titre le dit — il est cité comme preuve sur les plages de
   répétitions. La référence pertinente est Morton et al. 2016 (*J Appl Physiol*), « Neither
   load nor systemic hormones determine resistance training-mediated hypertrophy ». Le « 3 à
   30 répétitions » vient, lui, de Schoenfeld, Grgic, Van Every & Plotkin 2021 (*Sports*),
   qui n'est pas cité.
4. **Le modèle des répétitions effectives est présenté comme acquis alors qu'il est
   contesté.** Beardsley est un modèle théorique, pas un résultat expérimental, et l'étude
   le signale à demi-mot (« modélisation théorique ») avant de s'en servir comme socle. Les
   travaux sur la proximité à l'échec (Refalo et al., 2023, *Sports Medicine*) trouvent une
   hypertrophie comparable pour des séries arrêtées à plusieurs répétitions de l'échec, ce
   qui est difficile à réconcilier avec « seules les 5 dernières comptent ». Conséquence
   directe pour le dépôt : le RIR 0 systématique sur isolation (§A.3.3) n'est pas soutenu
   par ce qu'on croit savoir, et le plancher par `stabilite` du dépôt, qui *autorise* l'échec
   sans l'imposer, est la position prudente.
5. **La contradiction interne sur le volume.** §A.1 point 3 annonce un optimum « entre 10 et
   20 séries », puis prescrit 6-10 deux lignes plus bas. Les deux chiffres ne sont pas
   réconciliés. Le dépôt retient 6-10 pour une raison que l'étude n'énonce pas : la
   fourchette doit tenir dans le plafond temporel de l'utilisateur (§3 étape 3), et un
   optimum qu'on ne peut pas exécuter n'est pas un optimum.

**Sur les sources en général.** Les références de §A.4 et celles de ce §B.8 n'ont pas été
vérifiées contre les articles eux-mêmes — ni par la source, visiblement, vu le point 3. À
traiter comme des pistes de lecture, pas comme des preuves. Le niveau de certitude « élevé »
annoncé en §A.4 n'est pas soutenu par le travail de citation qui l'accompagne.

## B.9 Suites

Aucune issue ouverte. Deux choses à retenir pour plus tard :

- **`REST_MAX = 96h`** : candidat au validateur, sans valeur tant que les programmes sont
  générés. À reconsidérer si l'éditeur manuel de #36 fait apparaître des placements à plus
  de 96 h d'écart.
- **La corroboration a une valeur documentaire.** Les fourchettes de `VOLUME`
  (`src/assertions.js:62`) viennent du BLOC B du template 12 semaines, sans justification
  externe dans le dépôt. Elles sont désormais recoupées par une source indépendante qui
  arrive aux mêmes chiffres. C'est à ça que ce document sert.
