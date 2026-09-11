# Catalogue d'exercices v1 — note de rapprochement

**Fichier :** [`docs/generation/catalogue-exercices-v1.json`](../../../generation/catalogue-exercices-v1.json)
**Fourni par :** Simon, 2026-09-10 — « JSON de référence des exercices, première version »
**Spec source :** [`docs/generation/moteur-generation-programme.md`](../../../generation/moteur-generation-programme.md)
— voir la carte du dossier, [`docs/generation/README.md`](../../../generation/README.md)
**Statut :** matériau de conception, **non consommé par le code**. Ne pas placer dans `src/`.

> **Emplacement canonique : [`docs/generation/`](../../../generation/).** Une copie
> du JSON vivait ici ; elle était identique au caractère près (comparée en JSON
> normalisé) et a été supprimée le 2026-09-10 au profit de celle du dossier
> `generation`, désignée par le [README](../../../generation/README.md) et par
> l'amendement de la [spec #25](../spec.md#amendment---2026-09-10-the-generation-catalogue-exists-and-it-is-a-second-registry).
> Cette note reste ici : elle porte le rapprochement catalogue ↔ #25, pas le catalogue.

## À quelle US le rattacher

- **US porteuse : #25** — *Closed exercise registry and a data-only `program`
  catalogue the validator can check*. C'est l'issue qui possède « le registre
  fermé d'exercices ». Ce fichier est une proposition concrète pour ce registre.
- **US en aval qui consomment ce vocabulaire :**
  - **#19** (onboarding / *program pack* remis à un LLM) — le registre est la
    pièce du pack qui interdit à l'IA d'inventer des ids.
  - **#14** (deload/rotation pilotés par politique et signal) et **#16**
    (timeline datée) — c'est là que le champ `muscles` (distribution) et un
    modèle de fatigue sont réellement exploités.
- Épic : *Configurable program* (voir `epic-configurable-program-roadmap` en
  mémoire projet).

## Peut-il être intégré en l'état ?

**Non.** Le fichier n'a pas la forme que le moteur exécute aujourd'hui, et il
tranche par avance des questions que la spec #25 a explicitement laissées
ouvertes ou exclues.

| Point | Fichier v1 | Décidé pour #25 (spec.md) |
|---|---|---|
| **Ids** | lisibles (`developpe-couche-barre`) | slugs terses conservés (`dc`, `incl_db`…) ; tout schéma d'id lisible / alias est **hors périmètre** (Q4) |
| **Champs par exercice** | `nom`, `equipement[]`, `pattern`, `type`, `muscles{}` (11 clés, somme 1.0), `stabilite`, `niveau_min`, `articulations[]`, `increment_kg`, `cout_systemique` | `name`, unité, incrément, `perHand`/`side`, `cue` (texte libre), + `muscles` **réservé et non utilisé** par #25 |
| **Distribution `muscles`** | renseignée pour les 50 entrées (somme = 1.0, vérifiée) | champ documenté mais **vide** ; peuplé en #14/#16 |
| **Périmètre** | catalogue seul | forme `program` complète : `SLOTS` / `SESSIONS` / `CORE` / `WARM` référençant les ids |
| **Cues / charges de départ / unité** | absents | requis par l'UI Séance (`unit`, `perHand`, `side`, `cue`, `start`) |
| **Versionnage** | `schema_version: 1` (sémantique propre) | `formatVersion` du fichier de définition passe 1 → 2 |
| **Cardio / échauffement** | absents | `cardio: "default" | null` + `WARM` en texte libre |

Autres écarts à noter avant toute reprise :
- 50 exercices ; `conventions.muscles` dit « 11 clés » et toutes les
  distributions somment bien à 1.0.
- `vocabulaire_equipement` liste `kettlebell` mais aucun exercice ne l'utilise
  (12 des 13 valeurs sont employées).
- `conventions.note_patterns` signale déjà des incohérences dans la taxonomie
  de patterns du spec source (12 annoncés / 13 listés, `isolation ischios`
  manquant) — ce fichier ajoute 3 patterns d'isolation pour les contourner.

## Ce qu'il faut en faire

C'est une **entrée pour l'étape `decide` de #25** : le fichier montre à quoi
ressemblerait un registre « riche » (orienté génération LLM + modèle de
fatigue) et oblige à trancher :

1. #25 garde-t-il les slugs terses + `muscles` réservé (spec actuelle), et ce
   schéma riche alimente #14/#16 plus tard ?
2. ou #25 adopte-t-il dès maintenant ce schéma (ids lisibles compris), ce qui
   rouvre la Q4 et élargit le périmètre ?

Tant que ce n'est pas tranché, le fichier reste ici comme référence, sous
contrôle de version, et n'est importé par aucun module.

## Encodage

L'original transmis avait des accents corrompus (mojibake UTF-8→Latin-1). La
copie ici est ré-encodée en UTF-8 propre ; les glyphes `≥`, `–` et `—` perdus
à la transmission ont été rétablis d'après le contexte. Si Simon a le fichier
source intact, le substituer sans hésiter.
