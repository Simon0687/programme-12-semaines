# Moteur de génération de programme — note de rapprochement

**Document :** [`moteur-generation-programme.md`](./moteur-generation-programme.md)
**Fourni par :** Simon, 2026-09-10 — « la spec du moteur pour créer un programme,
toute l'intelligence du projet, à intégrer dans l'application pour export vers
LLM et création de programme »
**Statut :** matériau de méthode, **non consommé par le code**. Ne pas placer
dans `src/`.

> Cette note a d'abord été écrite dans `docs/method/`, supprimé le 2026-09-10 lors
> de la consolidation vers [`docs/generation/`](./README.md). Restaurée ici,
> liens mis à jour, texte inchangé. `decisions.md` de #25 la cite comme source.

C'est la **source** de [`catalogue-exercices-v1.json`](./catalogue-exercices-v1.json) :
la note de ce catalogue parlait déjà du « spec source » (taxonomie des patterns,
table de volume de l'étape 2) sans que le document soit dans le dépôt. Il l'est
maintenant.

---

## 1. La question à trancher avant tout le reste

Le document et la demande qui l'accompagne disent deux choses opposées.

| | Ce qui exécute les règles | Ce que ça implique |
|---|---|---|
| **Le document** (§ intro, §6, §7) | l'**application**, en JS déterministe. « Zéro appel LLM », « jamais dans la génération » | 400–600 lignes de moteur + catalogue riche ; nouvel épic ; reproductible, testable, hors-ligne, gratuit |
| **La roadmap actuelle** (mémoire `epic-configurable-program-roadmap`, #19, #25) | le **LLM** génère, l'app valide et exécute | pas de moteur à écrire ; le document devient du *prompt* ; l'app ne garantit rien qu'elle ne vérifie |
| **La demande** (« export vers LLM ») | le LLM | idem ci-dessus |

Ce n'est pas une nuance de vocabulaire : la première colonne fait du document un
**cahier des charges d'implémentation**, la seconde en fait un **texte de
référence à empaqueter**. Le périmètre, le coût et les issues concernées ne sont
pas les mêmes.

**Ce qui est vrai dans les deux cas** — et c'est l'argument à garder si la
contrainte « pas de backend, donc pas d'appel LLM dans l'app » venait à tomber :
**l'application doit savoir vérifier les 6 assertions du §7.** Un programme
généré par un LLM sans ces contrôles est exactement le FitAI que le document
démonte au §3. Un moteur JS qui les calcule sans les asserter est un FitAI plus
lent à écrire. Le validateur est la seule pièce qui n'a de coût perdu dans aucun
scénario — et c'est celle que #25 est déjà en train de construire.

---

## 2. Ce que le document change, issue par issue

| Issue | Effet du document |
|---|---|
| **#25** — registre fermé + forme `program` données | **Rouvre la Q4** (ids terses vs schéma riche). Tout le moteur repose sur `muscles` / `pattern` / `equipement` / `articulations` / `stabilite` / `niveau_min` / `cout_systemique` — champs que la spec #25 a explicitement laissés vides (`muscles` « réservé, non utilisé ») ou exclus. Sans eux, aucune règle du §3 n'est calculable, ni par le code ni par un LLM. |
| **#19** — pack remis à un LLM | **Destinataire naturel de « export vers LLM »**. Le pack devient : registre + §2 (table de volume) + §3 (règles) + §4 (forme de sortie) + §7 (assertions). Le §1.3 (« ce qu'il ne faut pas demander ») est le script de l'interview. |
| **#14** — deload/rotation par politique et signal | Le §7 fournit les déclencheurs tels quels (e10RM, RIR déclaré, récupération pondérée, douleur) et la recette de décharge. C'est la spec de `program.policies`. |
| **#16** — timeline datée | Le §5 « version dynamique » (récupération 72 h, séance proposable ≥ 70 %) est écrit pour cette issue. Une seule constante et la table `muscles`. |
| **#13** — nombre de séances variable, sans cardio | Prérequis dur : le moteur produit 2 à 6 séances, sans cardio ni mobilité. Aujourd'hui l'UI en suppose 5 avec cardio. |
| **Aucune issue existante** | Le questionnaire 5+1 écrans, les étapes 1 à 4 (split, volume, plafond, sélection gloutonne), les 20 combinaisons de test. **C'est un épic, pas une issue.** |

---

## 3. Écarts avec l'application d'aujourd'hui

- **Forme de sortie.** Le §4 propose `{ split, frequence, bloc, volume_cible,
  seances[] }` avec des ids lisibles. L'app exécute `SLOTS` / `SESSIONS` /
  `CORE` / `WARM` avec des slugs terses (`dc`, `incl_db`). Deux formats, aucun
  adaptateur. À trancher en même temps que la Q4 de #25.
- **Champs manquants pour l'UI Séance.** Le catalogue du §2 n'a ni `unit`, ni
  `perHand`, ni `side`, ni `cue`, ni `start` — l'écran Séance en a besoin. Écart
  déjà relevé dans la note du catalogue.
- **Cardio et échauffement absents.** Le document ne les traite pas. #25 les
  garde en règle nommée (`cardio: "default" | null`) et en texte libre.
- **`progression.js` existe déjà** et implémente la double progression du §7.
  Le §7 s'y branche, il ne la remplace pas.

---

## 4. Incohérences internes à lever avant de coder ou d'empaqueter

Elles comptent : un flou qui passe inaperçu dans un document devient un bug
silencieux en code, et une hallucination autorisée dans un prompt.

1. **§2 contredit §5.** Le §2 conclut : « le déficit [deltoïde antérieur] tombe à
   0 et le moteur ne prescrit pas de développé vertical en plus ». Le §5
   prescrit pourtant un **développé militaire haltères, 2 séries**, en Haut B.
   C'est aussi ce qui explique l'écart de comptage : l'exemple totalise
   **53 séries** prescrites pour une cible annoncée de **51**, alors que les
   déviations listées en fin de §5 s'annulent (+1 mollets, +1 abdos, −1 biceps,
   −1 triceps = 0). Les 2 séries de trop sont exactement ce développé militaire.
   → soit la règle du §2 est fausse, soit l'exemple l'est.
2. **Taxonomie des patterns : 12 annoncés, 13 listés**, et le §5 utilise
   « isolation ischios » qui n'existe dans aucune des deux listes. Le catalogue
   v1 contourne en ajoutant 3 patterns d'isolation
   (`iso_pectoraux`, `iso_quadriceps`, `iso_ischios`) — sans quoi la règle
   « jamais deux exercices du même pattern dans une séance » interdit
   squat + leg extension et RDL + leg curl.
3. **Muscles vs patterns.** La table de volume du §2 a 11 clés, dont
   « ischios / fessiers » fusionnés, alors que le §2 liste « extension de hanche
   (fessiers) » comme pattern distinct. Le catalogue v1 a tranché pour 11 clés.
4. **`cible(m)` peut être négative** pour un groupe prioritaire :
   `max − min − bonus_niveau` vaut `3 − 2 = 1` pour le deltoïde postérieur au
   niveau avancé, mais `2 − 2 − 2 = −2` … la borne `[min, max]` rattrape, mais
   la formule mérite d'être écrite comme un `clamp` explicite.
5. **Le score du §4 mélange des unités** (`3 × couverture` en séries,
   `2 × stabilité` en 1–3, `+1 × composé` en booléen). Reproductible, mais les
   poids ne sont pas comparables ; à requalifier avant d'en faire une règle
   opposable à un LLM.

---

## 5. Ce qu'il faut en faire

Le document ne rentre dans aucune issue ouverte : il est plus large que #25 et
plus précis que #19. Trois suites possibles, à trancher par Simon.

| | Suite | Ce que ça donne | Coût |
|---|---|---|---|
| **A** | **Le document devient le pack #19.** Registre + règles + assertions empaquetés, l'IA génère une définition, `parseProgramImport()` la refuse si elle viole une assertion. | « Export vers LLM » livré. Le §7 devient le validateur. | #25 doit adopter le schéma riche (Q4 rouverte) ; #19 passe de `priority: later` à actionnable |
| **B** | **Nouvel épic « moteur de génération »**, étapes 1 à 4 en JS, testé sur les 20 combinaisons, avant toute UI. | Ce que le document demande littéralement. Zéro dépendance externe. | Épic entier ; #25 doit quand même adopter le schéma riche |
| **C** | **Le validateur d'abord, le générateur ensuite.** Les 6 assertions du §7 comme module testable, alimenté par le registre riche. Puis A ou B au choix, sur la même base. | La pièce commune aux deux, livrable seule. | Une issue, sur le chemin de #25 |

Recommandation : **C, puis A.** Le validateur est le seul travail qui n'est perdu
dans aucun scénario, et il est le prérequis honnête de « export vers LLM » —
sans lui, on remet à un LLM le soin de se corriger lui-même. B reste ouvert
ensuite, sur exactement le même registre et les mêmes assertions.

**Décision préalable dans les trois cas : la Q4 de #25** (ids terses + `muscles`
réservé, ou schéma riche tout de suite). Tant qu'elle n'est pas tranchée, ni A ni
B ni C ne peut commencer.

---

## 6. Tranché le 2026-09-10

Simon a choisi la **suite A** : le document devient le pack #19, le LLM génère la
définition, l'app valide et exécute. Le choix est enregistré dans
[`decisions.md` de #25](../features/25-closed-exercise-registry/decisions.md),
qui note aussi que la recommandation inverse du [README §4](./README.md) — règles
pour la génération, moteur hors de l'app — **reste non réfutée** : enregistrer un
choix ne le tranche pas.

Le schéma riche est adopté dans #25 (Q8), avec les **ids terses conservés** (Q7)
parce que le journal est indexé par id d'exercice. Ces deux réponses sont la
réconciliation des registres, et elles valent quelle que soit la branche moteur.

Reste ouvert : les incohérences du §4 ci-dessus, à lever **avant** d'empaqueter —
un document contradictoire remis à un LLM autorise l'hallucination qu'il
contient. `decisions.md` en reprend quatre avec la preuve arithmétique de la
deuxième (53 séries prescrites pour 51 annoncées).
