# Decisions — Moteur de génération dans l'app vs pack LLM externe

Source : [`docs/generation/README.md`](README.md) §4 (« Quel moteur ? — choix
enregistré le 2026-09-10, argument non refermé ») et la section « Flagged, not
decided here » de [`decisions.md` de #25](../features/25-closed-exercise-registry/decisions.md).
Portée : **choix produit** — ce que l'app fabrique elle-même et ce qu'elle
délègue. Les choix d'implémentation du registre (Q7/Q8) sont tranchés et
intouchés ; ce document ne les rouvre pas.
Langue : français, comme le reste de `docs/generation/`.
Statut : en attente des réponses de Simon.

---

## Ce que la question est devenue

L'idée d'origine : un carnet de suivi, et un LLM — que tout le monde a déjà —
pour écrire un programme cohérent. Le §4 du README a posé la contradiction
(questionnaire = « le moteur est hors périmètre » ; doc moteur = « zéro appel
LLM »), Simon a tranché pour la branche LLM le 2026-09-10, et le README a
enregistré que la recommandation inverse restait sur la table.

Ce qui change aujourd'hui, c'est que Simon ajoute un troisième chemin qui
n'était dans aucun des deux documents : **construire un programme dans l'app**,
sous deux formes qui ne coûtent pas du tout la même chose —

1. **donner des contraintes, l'app propose** = le moteur du §3, dans `src/` ;
2. **choisir ses exercices un par un** = un éditeur au-dessus du registre fermé,
   qui n'a besoin d'aucun modèle de volume.

Les quatre questions ci-dessous les séparent. Q2 est la moins chère et ne dépend
d'aucune autre ; Q3 est celle qui rend Q1 mesurable au lieu de spéculative.

**Un point à noter sur l'antériorité.** L'étude fonctionnelle du 2026-09-12
([`docs/external_audit/functionnal audit/`](../external_audit/functionnal%20audit/2026-09-12-etude-philosophie-produit.md),
§10 étape 5) pose la même question et la reporte — mais elle la pose comme
*« moteur déterministe **externe** ou LLM encadré par le validateur »*. Le
troisième chemin, le moteur **dans** l'app, n'apparaît dans aucun document du
dépôt avant ce document-ci. C'est l'apport de la question de Simon, et c'est
pourquoi les options A et C de Q1 ne suffisent pas à couvrir le sujet.

### Ce que la décision ne change pas, quelle que soit la réponse

- Le registre fermé (`src/registry.js`, ~60 entrées, champs d'exécution +
  sélection) — #25 l'a déjà réconcilié pour les deux branches.
- Le format de définition (`formatVersion: 2`) et `parseProgramImport()` : tout
  générateur, humain, moteur ou LLM, produit le même objet et entre par la même
  porte.
- Les invariants 2.1 (stocker la valeur, pas la référence) et 2.2 (le journal
  n'enregistre jamais le prescrit) : aucun générateur n'écrit dans le journal.
- Les butoirs partagés : `weeks !== 12` refusé ([import.js:205](../../src/import.js#L205)),
  et les textes S7/S12 codés en dur dans [plan.js:100](../../src/plan.js#L100).
  Ils bloquent la liberté structurelle dans **toutes** les branches (#14).

---

## Q1 — Qui calcule le programme : un moteur dans l'app, ou un LLM externe ?

**Question.** Le doc moteur décrit 7 étapes déterministes (split, cible de
volume, plafond temporel, sélection gloutonne, placement, prescription,
progression) et chiffre son coût : 400–600 lignes, 1–2 jours, *« le catalogue
est le chantier, pas l'algorithme »* — or le catalogue est fait (#25). Le choix
du 2026-09-10 envoie ces 7 étapes dans un prompt (#19) plutôt que dans `src/`.
Laissée sans réponse, la question bloque le contenu de #19 (`priority: later`)
et laisse `moteur-generation-programme.md` dans un état ambigu : ni code, ni
prompt.

**Option A — Pack LLM externe** *(le choix enregistré le 2026-09-10)*
- Ce que ça veut dire : #19 livre un prompt système (questionnaire §8), le
  registre sérialisé, les vocabulaires fermés et les valeurs déjà connues.
  L'utilisateur parle à son IA, récupère un JSON, le charge. Aucun code de
  génération dans `src/`.
- Implications : `moteur-generation-programme.md` devient du **texte de
  prompt** — les 4 contradictions relevées dans `decisions.md` de #25 (§2 vs §5
  sur le développé militaire, l'exemple qui somme 53 séries pour 51 annoncées,
  `cible(m)` négative, le score qui mélange les unités) deviennent des
  hallucinations autorisées et doivent être corrigées avant livraison. Aucune
  migration, aucun module nouveau. L'app reste un carnet, au sens strict.
- Pour : zéro méthode à maintenir dans le code ; distribution triviale (un
  fichier, un prompt) ; les données de santé (`contraintes_articulaires`,
  `avis_medical_recommande`, art. 9) restent entre l'utilisateur et *son* LLM,
  argument du README §5 ; cohérent avec #18 fermé (pas de backend, pas de
  compte) ; le principe affiché « l'app exécute, elle ne génère pas »
  (ARCHITECTURE §3) tient tel quel — comme la formule de l'étude fonctionnelle
  §1, *« L'IA comprend et propose. L'application vérifie et mémorise.
  L'utilisateur décide. »*, que la triage du 2026-09-12 retient comme un bon
  énoncé du partage actuel.
- Contre : le composant qui décide du programme n'est pas testable en CI ; le
  mode d'échec nommé par le questionnaire §10 — *« une extraction fausse produit
  un programme cohérent mais faux »* — n'est rattrapé que par le validateur
  (Q3) ; la qualité dépend du modèle et de sa version ; l'onboarding sort de
  l'app, copie, colle, revient.

**Option B — Moteur déterministe dans l'app**
- Ce que ça veut dire : un module pur (`src/generator.js`), les 6 écrans du §1.1
  / §1.2 en entrée, une `definition` en sortie, chargée par le même chemin qu'un
  fichier importé.
- Implications : module sans React (invariant 2.6), donc testable sous
  `node --test` comme le reste ; consomme les champs de sélection de
  `EXERCISES` que #25 Q8 a justement peuplés pour ça ; sortie déjà couverte par
  `validateProgram()` ([import.js:84](../../src/import.js#L84)) ; les 6
  assertions du §7 deviennent des **tests sur 20 combinaisons**, pas seulement
  un garde-fou runtime. Oblige à réécrire le non-goal n°3 d'ARCHITECTURE.md.
  Ne débloque pas `weeks !== 12` ni les textes S7/S12 — partagé avec A.
- Pour : reproductible ; c'est la seule branche où « programme faux » devient un
  test rouge en CI plutôt qu'un déséquilibre visible six semaines plus tard ;
  aucune dépendance externe, aucune latence, aucun copier-coller ; l'onboarding
  ne quitte jamais l'app.
- Contre : l'app porte la méthode — chaque évolution de la méthode devient une
  release ; ne couvre pas les cas §6 hors modèle (compétition, blessure
  évolutive, sport secondaire), que le doc moteur lui-même renvoie à l'édition
  manuelle — c'est-à-dire à Q2. Et la formule de l'étude fonctionnelle §1
  (*« L'IA comprend et propose, l'application vérifie et mémorise »*) devient
  fausse : c'est l'app qui propose. Le partage reste défendable — l'utilisateur
  décide toujours, et rien n'est calculé approximativement — mais l'énoncé est
  à réécrire, pas à invoquer.

**Option C — Moteur hors app, outil séparé** *(la recommandation littérale du README §4)*
- Ce que ça veut dire : les mêmes 400–600 lignes, mais dans `tools/`, produisant
  un fichier de définition. L'app ne change pas.
- Implications : sert à fabriquer les programmes livrés (le neutre de #26 se
  dérive déjà du §5) ; l'utilisateur final ne peut pas s'en servir, il lui faut
  Node.
- Pour : le déterminisme sans toucher à l'app ; non-goal intact ; réversible.
- Contre : **ne répond pas à la question posée** — « faire un prog dans
  l'application » ; et si le moteur existe en JS, le garder hors de l'app est
  une frontière que rien ne défend une fois qu'elle coûte un écran.

**Recommandation. B, mais séquencée derrière Q3.** L'argument qui survit même si
le LLM devenait gratuit et parfaitement fiable : *les 6 assertions ne sont pas
un filet posé sur la génération, elles **sont** le modèle de volume.* Vérifier
« volume par muscle dans les fourchettes », « fréquence de stimulation ≥ 1,5 »,
« durée estimée ≤ durée demandée » et « thème annoncé = muscles travaillés »
suppose d'avoir écrit la table de cibles (étape 2), le modèle de temps (étape 3)
et le comptage des contributions via `EXERCISES[id].muscles`. Ce qui reste
au-delà, c'est une boucle gloutonne sur le déficit (étape 4), un placement
(étape 5) et trois tables reps/RIR/repos (étape 6). Le validateur est
**obligatoire dans les trois options** — c'est acté dans `decisions.md` de #25.
Donc choisir A après l'avoir écrit, c'est posséder la moitié difficile et
déléguer la moitié facile — trier une liste par déficit — au seul composant
qu'on ne peut pas tester.

Réversibilité : forte, et dans les deux sens. A comme B produisent le même
objet (`definition`) et se branchent au même point. Rien du générateur n'atterrit
dans le journal (invariant 2.2), donc abandonner l'un pour l'autre ne demande
aucune migration. Le pack LLM reste livrable par-dessus un moteur : c'est alors
un mode « je préfère parler à mon IA », pas l'unique chemin.

**Décision de Simon.** _(à remplir)_

---

## Q2 — L'éditeur manuel : même chantier que le moteur, ou chantier séparé ?

**Question.** Simon a énoncé deux modes in-app d'un seul souffle (« donner des
contraintes et l'app propose **OU** choisir ses exos un par un »). Ils ne sont
pas de la même taille : le second n'a besoin d'aucun modèle de volume, d'aucune
cible, d'aucun budget. Sans réponse, le petit chantier reste attaché au gros et
ne sort jamais.

**Option A — Chantier séparé, indépendant de Q1**
- Ce que ça veut dire : un écran qui construit `program = { SLOTS, SESSIONS,
  CORE, WARM }` en piochant dans `EXERCISES` (registre fermé, `name`, `muscles`,
  `equipement` déjà là pour filtrer et présenter). Sortie passée à
  `validateProgram()`, qui couvre déjà les ids inconnus (`unknown-exercise`),
  les slots orphelins, les `reps` malformées, les clés `warm`/`core` absentes.
- Implications : aucun format nouveau, aucun validateur nouveau, aucune
  migration. Dépend de #22 (App.jsx dérive encore la forme de littéraux) et de
  #34 (l'onglet Plan décrit le programme fourni, pas l'actif) ; bute sur
  `weeks !== 12` et sur les textes S7/S12 tant que #14 n'est pas passé. Répond
  au « seul vrai trou » que le doc moteur s'attribue (§6 : contexte hors modèle
  → *« édition manuelle du programme généré, pas un LLM »*).
- Pour : le moins cher des trois chemins, et **le seul utile dans les trois
  options de Q1** — corriger un programme sorti d'un LLM, corriger un programme
  sorti du moteur, ou en écrire un de zéro. C'est aussi le premier bout-en-bout
  réel de la chaîne registre → `program` → `validateProgram` → `buildProgram`,
  déclenché par un humain plutôt que par un fichier de test.
- Contre : un programme écrit à la main peut être déséquilibré — sauf à faire
  tourner les assertions de Q3 dessus, en avertissement.

**Option B — L'éditeur est l'UI du moteur, livré avec lui**
- Ce que ça veut dire : un seul écran, le mode manuel étant le moteur « à vide »,
  avec le budget qui se remplit pendant qu'on choisit.
- Implications : l'éditeur ne sort pas avant que le modèle de volume existe.
- Pour : une seule surface, une seule cohérence visuelle ; le retour « il te
  reste 12 séries » pendant la sélection est réellement mieux.
- Contre : un chantier de deux jours pris en otage par un chantier de deux
  semaines, et Q1 n'est toujours pas tranchée.

**Recommandation. A, et en premier — avant même de répondre à Q1.** Il ne
dépend d'aucune des deux branches, il fait travailler le registre pour de vrai,
et il transforme Q1 d'une question d'architecture en une question de confort :
« l'app remplit-elle l'éditeur toute seule, ou l'utilisateur le remplit-il à la
main ? ». Le budget en direct de l'option B reste ajoutable ensuite, exactement
au même endroit.

**Décision de Simon.** _(à remplir)_

---

## Q3 — Où vit le validateur des 6 assertions, et rejette-t-il ou avertit-il ?

**Question.** `decisions.md` de #25 clôt sa réflexion sur « pas encore actionné :
décider si le validateur est dans #19 ou une issue à part ». Il s'agit des 6
assertions du §7 (volume dans les fourchettes, fréquence ≥ 1,5, pas de pattern
dupliqué dans une séance, ≥ 48 h entre deux sollicitations primaires, durée
estimée ≤ demandée, thème annoncé = muscles travaillés). Sans réponse, aucune
branche de Q1 n'a de garde-fou, et le mode d'échec « cohérent mais faux » reste
entier.

**Option A — Issue dédiée, avant #19**
- Ce que ça veut dire : un module pur, par exemple `src/assertions.js`, qui prend
  un `program` et rend un verdict dans la forme de l'invariant 2.4
  (`{ ok, findings[] }`, jamais de `throw`), testé sur les 20 combinaisons
  fréquence × durée du §7.
- Implications : ne dépend de rien — le registre est peuplé, les patterns et
  les `muscles` sont là, l'invariant de verdict est établi. Là où #19 est
  `priority: later` et attend #14.
- Pour : sur le chemin critique dans les trois options de Q1 ; et surtout, **il
  mesure combien de moteur il reste à écrire** — le construire, c'est instrumenter
  Q1 au lieu de la trancher à l'aveugle.
- Contre : une issue de plus dans une file déjà longue (4 bugs `priority: high`).

**Option B — Sous-tâche de #19**
- Ce que ça veut dire : le validateur sort avec le pack.
- Pour : un seul chantier, une seule livraison.
- Contre : il n'existe pas tant que #19 n'est pas débloquée par #14, alors qu'il
  est utile dès le premier programme écrit à la main (Q2).

**Recommandation. A.** Et un point à trancher dans la même issue : **rejeter ou
avertir**. `parseProgramImport()` doit rester une porte fermée — verdict typé,
rejet. Les 6 assertions, non : un déséquilibre de volume n'est pas une donnée
invalide, c'est un avis. Les garder séparées, sinon un programme légitimement
asymétrique (rééducation, priorité forte assumée) devient impossible à charger.
Le message reste « adressable à une IA » comme #19 l'exige, mais il conseille au
lieu de bloquer.

**Décision de Simon.** _(à remplir)_

---

## Q4 — La collecte des inputs : écrans in-app ou conversation LLM ?

**Question.** Le questionnaire §10 tranche déjà à moitié (hybride : chips pour
fréquence/durée/objectif/ancienneté, LLM pour l'inventaire home gym, les
douleurs et l'arbitrage d'infaisabilité). Ce que ça ne dit pas : si Q1 = B, le
LLM n'est plus nécessaire à la génération — reste-t-il nécessaire à la collecte ?

**Option A — Six écrans in-app, aucun LLM**
- Ce que ça veut dire : les 5 écrans du §1.1 plus l'écran 6 repliable du §1.2.
  Les douleurs deviennent 6 articulations × 3 niveaux ; l'inventaire home gym,
  une liste de cases dérivée du vocabulaire `EQUIPMENT` de `src/registry.js`.
- Implications : l'onboarding est entièrement hors-ligne et instantané. Le
  « script de refus » du §6 (l'arbitrage d'infaisabilité) devient un calcul :
  l'app connaît le budget, elle peut chiffrer ce qui saute.
- Pour : le mode d'échec de la collecte LLM — extraction fausse → programme
  cohérent mais faux — est exactement celui que Q1 = B cherche à éliminer ; le
  rétablir à l'entrée annule le gain. Zéro latence, zéro donnée de santé qui
  sort. Le questionnaire §10 reconnaît lui-même que le LLM n'apporte rien sur 4
  des 6 champs.
- Contre : §10 a raison sur les douleurs — une phrase libre est plus agréable
  que 18 boutons radio. On perd l'élégance, pas l'information.

**Option B — Hybride §10**
- Ce que ça veut dire : chips pour les tours 1–2, LLM pour les tours 3–4–6.
- Implications : un appel réseau au moment de l'onboarding (README §5 : *« une
  app qui appelle un service tiers au moment précis de l'onboarding échoue à
  l'installation »*) ou un copier-coller — donc un onboarding en deux temps,
  même avec le moteur dans l'app.
- Pour : la meilleure ergonomie sur les deux champs où elle compte vraiment.
- Contre : réintroduit dans l'app la dépendance externe que Q1 = B venait de
  retirer, pour deux champs sur six.

**Recommandation. A pour la v1**, B gardé comme surcouche facultative — un
bouton « affiner avec ton IA » qui pré-remplit un prompt, jamais le chemin
obligatoire. Le pack LLM de l'option A de Q1 n'est alors pas perdu : il devient
ce bouton.

**Décision de Simon.** _(à remplir)_

---

## Comment appliquer

Une fois les quatre cases remplies :

1. **`docs/generation/README.md` §4** — remplacer l'encadré « choix enregistré
   le 2026-09-10, argument non refermé » par la décision et sa date. C'est le
   seul endroit qui porte encore les deux positions en parallèle.
2. **`decisions.md` de #25**, section « Flagged, not decided here: which engine »
   — la clore d'un renvoi vers ce document. Q7/Q8 restent intacts.
3. **`docs/ARCHITECTURE.md` §3** — si Q1 = B, le non-goal *« No calculation
   delegated to a language model »* devient vrai d'une manière nouvelle et sa
   formulation (*« A model proposes and explains, the app verifies »*) doit être
   réécrite : c'est l'app qui propose.
4. **`moteur-generation-programme.md`** — si Q1 = A, corriger d'abord les 4
   contradictions listées dans `decisions.md` de #25 ; si Q1 = B, elles
   redeviennent de simples bugs de spec à corriger en écrivant le code.
5. **Issues à ouvrir**, dans cet ordre : l'éditeur manuel (Q2), le validateur
   des 6 assertions (Q3), puis le moteur ou le pack selon Q1. #19 est réécrite
   ou fermée en fonction.
