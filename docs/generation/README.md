# Génération de programme — carte du dossier

Tout ce qui concerne la **fabrication** d'un programme. L'app, elle, n'exécute
que le résultat : rien ici n'est du code livré, rien ici n'est encore branché.

Déposé dans le repo le 2026-09-10, depuis `Working files/Data`. Ces documents
existaient hors versionnement ; ils portent des décisions qui coûteraient cher à
re-dériver.

| Fichier | Ce que c'est | Statut |
|---|---|---|
| [`questionnaire-llm.md`](questionnaire-llm.md) | Collecte des inputs par un LLM → un payload JSON | **v1 de référence**, 6 amendements (§11) |
| [`moteur-generation-programme.md`](moteur-generation-programme.md) | Moteur déterministe, 7 étapes, **zéro appel LLM** : payload → programme | v1, non amendé |
| [`moteur-generation-programme.notes.md`](moteur-generation-programme.notes.md) | Note de rapprochement du moteur : impact issue par issue, écarts avec l'app, incohérences internes | — |
| [`catalogue-exercices-v1.json`](catalogue-exercices-v1.json) | 50 exercices × 11 champs de **sélection** (équipement, pattern, muscles, stabilité, articulations…) | v1, `schema_version: 1` |
| [`benchmarks/`](benchmarks/) | Rétro-spécifications Alpha Progression et FitAI | sources, non maintenues |

---

## 1. Trois contrats JSON, pas un

C'est la première chose à tenir au clair, parce que les trois se ressemblent et
qu'aucun n'est convertible en l'autre sans perte.

```
   utilisateur                LLM                    moteur                   app
        │                      │                        │                      │
        └──── langage ────► payload ──────────► programme généré ────► définition ────► exécution
                          §1 questionnaire      §4 moteur              src/definition.js
                          schema_version: 1                            formatVersion: 2
```

| | **payload** | **programme généré** | **définition** |
|---|---|---|---|
| Défini par | questionnaire §1 | moteur §4 | `src/definition.js` + `src/import.js` |
| Version | `schema_version` | — | `formatVersion` |
| Contenu | frequence, materiel, douleurs… | split, volume_cible, seances[] | id, startDate, profile, startingLoads, program |
| Validé par | le récapitulatif (tour 5) | les 6 assertions (§7 moteur) | `parseProgramImport()` |

**Aucun champ du payload n'est un champ de définition.** `frequence: 4` ne
survit nulle part : il se dissout en quatre entrées de `SESSIONS`. C'est ce qui
rend le mode delta (§7 questionnaire) impossible sans archivage — d'où
l'amendement A3 : le payload est rangé dans `definition.questionnaire`, ce que
le validateur accepte déjà sans modification (`{ ...parsed }`).

### Du programme généré vers la définition

| Moteur §4 | App | État |
|---|---|---|
| `seances[].jour_type` | `SESSIONS[].day` | ✅ direct |
| `exercices[].reps: [5,10]` | `SLOTS[].reps` | ✅ direct |
| `exercices[].charge: null` + `source_charge: "calibration"` | `startingLoads` absent → rampe « Paliers » | ✅ déjà supporté ([progression.js:57](../../src/progression.js#L57)) |
| `exercices[].series: [3,4]` (fourchette) | `SESSIONS[].ex = [[slot, n]]` (entier) | ⚠️ le moteur stocke une fourchette et résout à l'affichage ; l'app fige un entier |
| `exercices[].rir: [0,1]` | aucun champ — le RIR vit dans `phaseOf()` | ❌ code, pas donnée → #14 |
| pas de `rest` | `SLOTS[].rest` | ⚠️ dérivable de l'objectif (§6 moteur) |
| une variante par exercice, rotation par politique | `SLOTS[].b1` / `b2` | ⚠️ le bloc 1 / bloc 2 de l'app est une rotation figée à deux temps |
| `volume_cible` | aucun champ | ❌ à archiver avec le payload |

---

## 2. Ce que le modèle actuel accueille déjà

Vérifié dans le code, pas supposé :

- **Charges absentes → « Paliers »** : `v.start == null` déclenche la rampe
  50/75/100 % ([progression.js:57](../../src/progression.js#L57)). Le refus de
  demander les 1RM (§2 questionnaire) est exécutable tel quel.
- **`startingLoads: {}` passe le validateur** — la boucle de vérification est
  vide, aucun rejet.
- **Les champs inconnus sont conservés** jusque dans `programs[id].definition` :
  l'archivage du payload ne demande aucun code.
- **Slugs stables, libellé à part** (`V[id].name`) : renommer un exercice ne
  casse pas l'historique.
- **Enveloppe multi-cycles** : une re-génération est un nouveau cycle, isolation
  prouvée en réel (#6).
- **Le budget §6 est calibré juste.** Le programme de Simon fait exactement
  **74 séries dures/semaine** (recalcul depuis `SESSIONS` + `CORE` ; la table de
  volume de [plan.js:64-77](../../src/plan.js#L64-L77) somme au même chiffre).
  La formule `floor((durée−10)/3) × fréquence` donne 80 pour 5×60 min. L'écart
  est le bon sens : le plafond n'est pas une cible. Seul accroc, `hautC` monte à
  18 séries pour un plafond de 16.
- **§2 est confirmé par le code** : `bodyweightKg`, `heightCm` et `birthdate` ne
  sont lus **nulle part** dans l'app. Ils traînent depuis #5. Ne pas les demander
  n'est pas une posture, c'est un constat.

---

## 3. Ce qui bloque

### B1 — Le profil nutrition est obligatoire, le questionnaire refuse de le collecter

[`import.js:117-137`](../../src/import.js#L117-L137) exige
`profile.maintenanceKcal`, `startKcal`, `macros.{p,f,c}` et `targetWeightKg`.
Le payload n'en porte aucun et §2 interdit de les demander. **Un programme issu
de ce questionnaire est rejeté sur `missing-field: profile.maintenanceKcal`.**

Ces champs ne servent qu'à interpoler la section Nutrition
([plan.js:122-127](../../src/plan.js#L122-L127)). → issue dédiée, petite :
`profile` facultatif + section non rendue quand il est absent.

### B2 — `weeks: 12` obligatoire, le questionnaire ne demande pas de durée

[`import.js:140`](../../src/import.js#L140) rejette tout ce qui n'est pas 12, et
`phaseOf` / `history` codent en dur les 12 semaines, la décharge en S7 et
l'AMRAP en S12. Le questionnaire est écrit pour la **timeline continue** — donc
pour l'après-#16 / #14. Ce n'est pas un défaut du document : c'est sa place dans
la file.

### B3 — Deux registres d'exercices, deux namespaces incompatibles

C'est le point qui a une fenêtre, parce qu'il porte sur une issue en cours de
conception (#25).

| | `BASE_V` ([program.js](../../src/program.js)) | `catalogue-exercices-v1.json` |
|---|---|---|
| Entrées | 40 | 50 |
| Ids | slugs courts : `dc`, `incl_db`, `pd_close` | kebab long : `developpe-couche-barre` |
| Champs | **exécution** : `name`, `incr`, `start`, `unit`, `perHand`, `side`, `cue` | **sélection** : `equipement`, `pattern`, `type`, `muscles`, `stabilite`, `niveau_min`, `articulations`, `increment_kg`, `cout_systemique` |

Les deux décrivent les mêmes objets sous deux angles, et **aucun n'est un
sur-ensemble de l'autre**. Le registre fermé de #25 est leur union, pas l'un des
deux. Un exemple suffit : le catalogue ne sait pas qu'une planche latérale se
mesure en secondes (`unit: "time"`), l'app ne sait pas qu'un développé couché
charge l'épaule et le poignet.

La décision Q4 de [#25](../features/25-closed-exercise-registry/spec.md)
(« garder les slugs courts ») a été prise sans ce catalogue sous les yeux : elle
est à rouvrir. Amendement déposé dans la spec de #25.

---

## 4. Quel moteur ? — choix enregistré le 2026-09-10, argument non refermé

> **Simon a choisi la branche LLM** : le document moteur devient le pack #19,
> l'IA génère la définition, l'app valide et exécute. Enregistré dans
> [`decisions.md` de #25](../features/25-closed-exercise-registry/decisions.md).
> La recommandation ci-dessous est l'inverse et reste sur la table — enregistrer
> un choix ne réfute pas son contre-argument. Ce qui suit est laissé tel quel
> pour que la question puisse être rouverte sans re-dériver le raisonnement.
>
> Conséquence pratique : **rien ne bloque**. La réconciliation des registres (B3)
> est sur le chemin critique dans les deux branches et elle est faite (#25, Q7 et
> Q8). Ce que le choix change, c'est seulement ce que #19 livre — un prompt ou un
> outil.
>
> Sous la branche retenue, un prérequis apparaît : le document moteur devient du
> *texte de prompt*, et ses contradictions internes deviennent des hallucinations
> autorisées. Elles sont listées dans
> [`moteur-generation-programme.notes.md`](moteur-generation-programme.notes.md) §4.

Les deux documents de ce dossier ne décrivent pas le même produit.

- Le **questionnaire** dit : « le moteur est hors périmètre, il consomme ce
  payload » — et l'app partage le questionnaire à un LLM qui rédige le
  programme.
- Le **moteur** dit : « zéro appel LLM », 400–600 lignes, 7 étapes
  déterministes, 6 assertions automatisables. Et il conclut : *« Un générateur
  qui passe ces 6 assertions sur 20 combinaisons n'a besoin d'aucune IA. »*

Les deux ne peuvent pas être vrais en même temps. Le §10 du questionnaire
tranche déjà à moitié — le LLM est irremplaçable sur **l'inventaire, les
douleurs et l'arbitrage d'infaisabilité**, et n'apporte rien sur la fréquence,
la durée et l'objectif.

**Recommandation : LLM pour la collecte, règles pour la génération, et le moteur
hors de l'app.**

L'argument qui tient même si le coût du LLM tombait à zéro : le §10 du
questionnaire nomme lui-même le mode d'échec — *« une extraction fausse produit
un programme cohérent mais faux, que ni le moteur ni ses six assertions ne
peuvent détecter »*. Un programme faux ne se voit pas à la lecture ; il se voit
six semaines plus tard, sur un déséquilibre de volume. C'est précisément ce
qu'un moteur déterministe rend impossible **et testable** — les 6 assertions
tournent en CI sur 20 combinaisons, sans jugement humain.

Et le principe « l'app exécute, elle ne génère pas » reste tenu à la lettre si
le moteur est **un outil séparé qui produit un fichier de définition**, pas un
module de l'app. L'app garde un seul rôle : valider et exécuter.

À trancher par Simon. Ce qui ne dépend pas de l'arbitrage, et qu'on peut faire
tout de suite : **la réconciliation des deux registres (B3)**. Elle est sur le
chemin critique dans les deux branches — un LLM comme un moteur a besoin d'un
catalogue unique, fermé, portant à la fois la sélection et l'exécution.

---

## 5. Ce qu'on partage au LLM, en totalité ou en partie

Si la branche LLM est retenue, la règle de partage :

| Section | Partagée ? |
|---|---|
| §8 prompt système, §1 contrat de sortie | **toujours, intégralement** — c'est le contrat |
| §4.3 équipement, §4.4 groupes, §5 mapping articulations | **toujours** — vocabulaires fermés ; ne pas les donner, c'est autoriser l'invention de tags |
| `catalogue-exercices-v1.json` | **toujours** — sans lui, des ids inventés |
| §3 tours 1–2 (fréquence, durée, objectif, ancienneté) | **remplacés par les valeurs** quand l'app les a collectées en chips |
| §6 budget et script de refus | **toujours** — sauf si l'app calcule le budget elle-même et refuse avant d'appeler (deux lignes, ça vaut le coup) |
| §9 tests d'acceptation, §10 arbitrage LLM/formulaire, §11 journal | **jamais** — documents de conception, pas instructions |

Autrement dit : l'app envoie le **prompt + les vocabulaires + le catalogue + les
valeurs déjà connues**. Elle n'envoie jamais ses propres critères de qualité.

**Qui appelle le LLM.** Le mode « prompt pré-rempli à copier » est le seul
cohérent avec la fermeture de #18 (pas de backend, pas de compte). L'argument
qui survit même si une clé d'API était gratuite : une app qui appelle un service
tiers **au moment précis de l'onboarding** échoue à l'installation, pas plus
tard. Et `contraintes_articulaires` + `avis_medical_recommande` sont des données
de santé (article 9) : tant que l'utilisateur parle à *son* LLM, personne d'autre
n'est responsable de traitement.

---

## 6. Suites

| Quoi | Où |
|---|---|
| B1 — définition sans profil nutrition | issue **#27** |
| B3 — réconciliation des deux registres | amendement dans la spec de [#25](../features/25-closed-exercise-registry/spec.md), à trancher avant `/design-tech` |
| Découper `poulie` et `machine` dans le catalogue | catalogue v2, noté en §4.3 du questionnaire |
| Quel moteur (§4 ci-dessus) | à trancher par Simon, aucune issue ouverte |
| B2 — timeline continue | rien à faire : #16 puis #14, déjà dans la file |

### Le programme neutre de #26 est le premier test de bout en bout

#26 demande un programme par défaut neutre : Haut / Bas, 4 séances, exercices
standard, ni squat ni soulevé de terre. L'exemple exécuté du
[moteur](moteur-generation-programme.md) (§5) est *exactement* cet input —
« 4 séances/sem · 60 min · hypertrophie · intermédiaire · salle complète » →
Haut/Bas/Haut/Bas, 51 séries pour un plafond de 64 — et la quasi-totalité des
exercices que #26 énumère existent déjà dans le catalogue, dont plusieurs parmi
ceux qui n'ont **pas** d'équivalent dans `BASE_V`.

Deux conséquences pratiques :

- #26 n'a pas à être écrit à la main en partant de rien : il se dérive du §5,
  moins le squat et le soulevé de terre, qu'il suffit de ne pas référencer.
- C'est le premier bout-en-bout vérifiable de toute la chaîne — un programme
  produit par les règles, validé par le registre, exécuté par l'app — avant même
  qu'un LLM soit branché. Si #26 tourne, la moitié du pipeline est prouvée.
