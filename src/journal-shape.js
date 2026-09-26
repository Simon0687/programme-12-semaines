/* =========================================================
   Forme du journal et des définitions — l'autorité unique (#32)

   Ce module ne parle que de *forme*. Il ne juge jamais le contenu d'un
   entraînement (une charge absurde, un volume délirant) : il dit si une
   donnée peut être exécutée sans que l'appli plante ou invente.

   Il existe parce que le journal a trois portes d'entrée — un fichier de
   programme, un journal collé, le journal stocké — et qu'avant #32 une
   seule était gardée. Les trois appellent désormais les mêmes fonctions,
   si bien que la barre ne peut plus diverger d'une porte à l'autre : ce
   n'est plus une promesse tenue par la relecture, c'est la structure.

     validateProgram(program)       le catalogue data-only (#25), déplacé
                                    ici depuis import.js sans changement
     validateDefinition(definition) tout ce que parseProgramImport jugeait
                                    en ligne, moins la normalisation

   Chaque fonction rend `null` si la donnée est acceptable, sinon
   { reason, message } — même vocabulaire que src/import.js, et un message
   pensé pour être recollé à une IA (#19) : chemin JSON + règle violée,
   jamais un jugement sur le contenu.

   Ne lève jamais, pour aucune entrée : c'est l'invariant qui permet à
   loadJournal() de rester fermé par défaut sans try/catch (#32). Il n'a
   été tenu qu'à partir de #33 — avant, une paire mal formée dans
   SESSIONS[].ex levait, et depuis que #32 branche ce module dans le
   chargement, ce jeté bloquait l'appli sur son spinner. La suite
   test/journal-shape.test.js l'éprouve désormais sur de vrais programmes
   déformés, pas seulement sur des valeurs absurdes.
   ========================================================= */

import { EXERCISE_IDS } from "./registry.js";
import { DEFINITION_FORMAT_VERSION, parseLocalDate } from "./definition.js";
import { AFTER_KINDS, MODALITY_IDS, CARDIO_KINDS, BASELINE_KEYS } from "./cardio.js";
import { ACTIVITY_FACTORS, OBJECTIVES } from "./nutrition.js";

const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const isObj = (x) => typeof x === "object" && x !== null && !Array.isArray(x);

/* ---------- Le vocabulaire des refus, déclaré une seule fois (#38) ----------

   Il vivait dans `import.js` (`IMPORT_MESSAGES`) pendant que les raisons
   étaient **produites** ici. Rien ne reliait les deux listes, et c'est
   exactement comme ça qu'`unsupported-field` a survécu à #25 : la raison
   avait cessé d'être émise, sa ligne est restée, et personne ne pouvait le
   voir en lisant l'un ou l'autre fichier.

   La déclaration est donc à l'endroit où les raisons naissent, et
   `test/journal-shape.test.js` vérifie la bijection **dans les deux sens** :
   aucune raison déclarée qui ne soit émise quelque part, aucune raison émise
   qui ne soit déclarée. Une raison morte devient impossible à garder au lieu
   d'attendre qu'on la remarque deux issues plus tard.

   La phrase est le **repli** : un rejet qui porte son propre message — avec
   son chemin JSON et la règle enfreinte — garde le sien. C'est ce que #19
   demande d'un message : qu'il soit adressable, c'est-à-dire assez précis pour
   qu'on agisse dessus.

   Deux raisons se ressemblent et ne disent pas la même chose (#38 Q2). Elles
   sont voisines ici pour que la différence se lise :

   - `not-a-program`  : ce fichier n'est pas un programme — tu t'es trompé de
                        fichier.
   - `invalid-program`: c'est bien un programme, et une ligne de son catalogue
                        custom est fausse — corrige celle-là.

   Les fusionner ferait lire « ce fichier ne décrit pas un programme » à
   quelqu'un dont le programme est bon à une faute de frappe près. */
export const REJECTIONS = {
  /* Reconnaissance du document — `import.js` */
  "invalid-json": "Ce fichier n'est pas du JSON valide.",
  "not-a-journal": "Ce JSON ne contient pas de journal (clé « logs » ou « programs » absente).",
  "not-a-program": "Ce fichier ne décrit pas un programme.",
  "too-new": "Ce fichier a été créé par une version plus récente de l'appli. Mets l'appli à jour, puis réimporte.",
  "migration-failed": "Ce journal n'a pas pu être mis à jour vers le format actuel.",

  /* Forme du journal et de la définition — ce module */
  invalid: "Ce journal n'a pas la forme attendue.",
  "missing-field": "Champ manquant dans le programme.",
  "invalid-field": "Champ présent mais invalide dans le programme.",
  "unsupported-weeks": "Ce programme ne compte pas 12 semaines.",
  "invalid-program": "Le catalogue d'exercices custom (program) est mal formé.",
  "unknown-exercise": "Le programme référence un exercice absent du registre.",
  "unknown-cardio-rule": "Le programme référence une modalité ou une règle cardio que l'appli ne connaît pas.",
};

/* Référence à un slot dans SESSIONS[].ex ou CORE[].ex : la paire
   [id de slot, nombre de séries]. Vérifiée *avant* toute déstructuration
   (#33) — `for (const [slotId] of session.ex)` levait un TypeError sur un
   élément non itérable, et depuis #32 ce jeté traverse loadJournal, donc
   bloque l'appli sur son spinner au lieu de n'être qu'un fichier refusé
   en silence. Le compte de séries est contrôlé par la même occasion : un
   entier positif, ce qui règle aussi `-3` et `"trois"`. */
const isSlotRef = (e) => Array.isArray(e) && e.length === 2
  && typeof e[0] === "string" && e[0] !== ""
  && Number.isInteger(e[1]) && e[1] > 0;

/* Forme d'une entrée de `programs` : un cycle et ses trois registres.
   Séparée de validateEnvelope parce qu'elle sert deux fois et à deux
   sévérités — fatale pour le cycle actif (l'appli ne peut rien rendre
   sans lui), simple cause de non-sélection pour les autres (#32, Q3). */
export function validateProgramEntry(entry) {
  if (!isObj(entry)) return { reason: "invalid", message: "Entrée de programme invalide (objet attendu)" };
  if (!isObj(entry.definition)) return { reason: "invalid", message: "Entrée de programme sans définition" };
  for (const field of ["logs", "cardio", "checkin"]) {
    if (!isObj(entry[field])) return { reason: "invalid", message: `Entrée de programme : ${field} (objet attendu)` };
  }
  return null;
}

/* Contrôle *avant* migration, sur la donnée brute (#32).

   versionOf() lit « v1 » dès que schemaVersion n'est pas un entier, et
   MIGRATIONS[1] réécrit alors le document en enveloppe neuve à partir de
   ses seuls .logs — en ignorant un éventuel .programs. Un export dont le
   schemaVersion a sauté (troncature, copier-coller partiel, retouche à la
   main) se voit donc traiter en journal plat : ses cycles disparaissent
   sans un mot, et l'appli annonce « Données importées ».

   Le document est ambigu, et l'ambiguïté se refuse — un journal v1 réel
   n'a jamais porté de .programs, la combinaison ne peut pas être
   authentique. */
export function validatePreMigration(parsed) {
  if (!isObj(parsed)) return { reason: "invalid", message: "Ce JSON n'est pas un journal." };
  if (parsed.programs != null && !Number.isInteger(parsed.schemaVersion)) {
    return {
      reason: "invalid",
      message: "Ce journal contient des programmes mais aucun numéro de version : il serait lu comme un journal de la toute première version, et ses cycles seraient perdus.",
    };
  }
  return null;
}

/* Enveloppe du journal. Ne juge que ce qui empêche l'appli de rendre quoi
   que ce soit : le reste (un cycle inactif mal formé, une ligne de log
   illisible) se traite sans rejeter tout le journal.

   C'est ici que se ferme le mode d'échec le plus coûteux de #32 : avant,
   la déstructuration de `programs` dans loadJournal levait sur un journal
   tronqué, la promesse du chargement était rejetée, `setLoaded(true)`
   n'arrivait jamais et l'appli restait bloquée sur son spinner — sans
   accès au panneau qui aurait permis de réparer. Un écran blanc se
   recharge ; un spinner définitif, non. */
export function validateEnvelope(journal) {
  if (!isObj(journal)) return { reason: "invalid", message: "Ce JSON n'est pas un journal." };
  const { activeProgramId, programs } = journal;
  if (typeof activeProgramId !== "string" || activeProgramId === "") {
    return { reason: "invalid", message: "Champ invalide : activeProgramId (chaîne non vide attendue)" };
  }
  if (!isObj(programs)) return { reason: "invalid", message: "Champ invalide : programs (objet attendu)" };

  /* Une entrée non-objet (null, un nombre) casse jusqu'au sélecteur de
     cycles, qui lit p.definition pour tous les programmes stockés. */
  for (const [id, entry] of Object.entries(programs)) {
    if (!isObj(entry)) return { reason: "invalid", message: `Champ invalide : programs.${id} (objet attendu)` };
  }

  if (!programs[activeProgramId]) {
    return { reason: "invalid", message: `activeProgramId « ${activeProgramId} » n'a pas d'entrée dans programs.` };
  }
  return validateProgramEntry(programs[activeProgramId]);
}

/* startDate doit faire l'aller-retour : parseLocalDate puis reformatage
   redonnent la même chaîne. Attrape "2027-02-30" que le seul regex laisse
   passer (JS bascule au 2 mars). */
function roundTripsAsDate(iso) {
  const d = parseLocalDate(iso);
  if (Number.isNaN(d.getTime())) return false;
  const back = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return back === iso;
}

/* Contrôle de forme d'un program data-only (#25) — SLOTS/SESSIONS/CORE/
   WARM référençant uniquement des ids du registre fermé (EXERCISE_IDS). */
export function validateProgram(program) {
  if (typeof program !== "object" || program === null || Array.isArray(program)) {
    return { reason: "invalid-program", message: "Champ invalide : program (objet attendu)" };
  }
  for (const field of ["SLOTS", "SESSIONS", "CORE", "WARM"]) {
    if (program[field] == null) return { reason: "missing-field", message: `Champ manquant : program.${field}` };
  }

  const { SLOTS, SESSIONS, CORE, WARM } = program;

  if (typeof SLOTS !== "object" || Array.isArray(SLOTS)) return { reason: "invalid-program", message: "Champ invalide : program.SLOTS (objet attendu)" };
  for (const [slotId, slot] of Object.entries(SLOTS)) {
    if (typeof slot !== "object" || slot === null) return { reason: "invalid-program", message: `Champ invalide : program.SLOTS.${slotId} (objet attendu)` };
    /* reps : une vraie fourchette, [min, max] avec 0 < min <= max (#33).
       Le contrôle d'avant n'exigeait que « deux nombres », si bien que
       [8, 5] et [-5, -1] passaient — le premier affiche « 8–5 reps », le
       second une fourchette négative, et la double progression compare une
       performance à une borne qui n'a pas de sens. */
    if (!Array.isArray(slot.reps) || slot.reps.length !== 2 || !slot.reps.every(isNum)) {
      return { reason: "invalid-program", message: `Champ invalide : program.SLOTS.${slotId}.reps (deux nombres attendus)` };
    }
    if (slot.reps[0] <= 0 || slot.reps[0] > slot.reps[1]) {
      return { reason: "invalid-program", message: `Champ invalide : program.SLOTS.${slotId}.reps (fourchette [min, max] attendue, 0 < min <= max)` };
    }
    if (!isNum(slot.rest)) return { reason: "invalid-program", message: `Champ invalide : program.SLOTS.${slotId}.rest (nombre attendu)` };
    for (const b of ["b1", "b2"]) {
      if (typeof slot[b] !== "string") return { reason: "invalid-program", message: `Champ invalide : program.SLOTS.${slotId}.${b} (chaîne attendue)` };
      if (!EXERCISE_IDS.has(slot[b])) return { reason: "unknown-exercise", message: `program.SLOTS.${slotId}.${b} : « ${slot[b]} » n'est pas un exercice du registre.` };
    }
  }

  if (!Array.isArray(SESSIONS) || SESSIONS.length === 0) return { reason: "invalid-program", message: "Champ invalide : program.SESSIONS (tableau non vide attendu)" };

  /* Ids de séance uniques (#33). Pas une coquetterie : findLog(logs, date,
     slot) rend la *première* correspondance, donc deux séances partageant un
     id rendent la seconde inatteignable — le mode d'échec exact qui avait
     coulé la première tentative de #26. */
  const ids = SESSIONS.filter((s) => s && typeof s.id === "string").map((s) => s.id);
  const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
  if (duplicate) return { reason: "invalid-program", message: `program.SESSIONS : l'id « ${duplicate} » est utilisé par deux séances ; chaque séance doit avoir un id unique.` };
  if (typeof CORE !== "object" || Array.isArray(CORE)) return { reason: "invalid-program", message: "Champ invalide : program.CORE (objet attendu)" };
  if (typeof WARM !== "object" || Array.isArray(WARM)) return { reason: "invalid-program", message: "Champ invalide : program.WARM (objet attendu)" };
  for (const [k, v] of Object.entries(WARM)) {
    if (typeof v !== "string") return { reason: "invalid-program", message: `Champ invalide : program.WARM.${k} (chaîne attendue)` };
  }

  for (const [i, session] of SESSIONS.entries()) {
    if (typeof session !== "object" || session === null) return { reason: "invalid-program", message: `Champ invalide : program.SESSIONS[${i}] (objet attendu)` };
    if (typeof session.id !== "string" || session.id === "") return { reason: "invalid-program", message: `Champ invalide : program.SESSIONS[${i}].id (chaîne non vide attendue)` };

    /* day : 1 à 7, la plage qu'implique dateForSlot (startDate + 7×(semaine−1)
       + (day−1)). C'est le contrôle qui ferme la corruption silencieuse de
       #33 — un day absent ou non numérique donnait "NaN-NaN-NaN", et depuis
       #16 la date *est* l'identité du log : les séances n'étaient pas mal
       étiquetées, elles devenaient introuvables par findLog et non triables
       par history(). Une plage, pas un test d'analyse : day: 99 produit une
       vraie date, quatorze semaines plus loin.
       La contradiction que cette note signalait — App.jsx comparait ce champ
       à today.getDay(), qui ne coïncide avec le décalage que si startDate
       tombe un lundi — est levée par #39 : plus aucun lecteur ne fait de
       getDay() sur un `session.day`, et la plage 1-7 est désormais la plage
       de la seule convention qui reste. */
    if (!Number.isInteger(session.day) || session.day < 1 || session.day > 7) {
      return { reason: "invalid-program", message: `Champ invalide : program.SESSIONS[${i}].day (entier de 1 à 7 attendu)` };
    }
    if (!(session.warm in WARM)) return { reason: "invalid-program", message: `program.SESSIONS[${i}].warm : « ${session.warm} » n'est pas une clé de program.WARM.` };
    if (!(session.core in CORE)) return { reason: "invalid-program", message: `program.SESSIONS[${i}].core : « ${session.core} » n'est pas une clé de program.CORE.` };
    /* after : facultatif, mais s'il est présent il doit nommer un indice que
       l'appli sait rendre. App.jsx appelle AFTER_HINTS[session.after](cardio)
       sans repli : une valeur inconnue n'affiche pas « rien », elle appelle
       undefined et fait tomber l'écran Séance. La liste vient de cardio.js,
       qui possède les indices — pas d'une copie tenue à jour à la main. */
    if (session.after != null && !AFTER_KINDS.includes(session.after)) {
      return { reason: "invalid-program", message: `program.SESSIONS[${i}].after : « ${session.after} » n'est pas un indice connu (attendu ${AFTER_KINDS.map((k) => `"${k}"`).join(" ou ")}).` };
    }

    if (!Array.isArray(session.ex)) return { reason: "invalid-program", message: `Champ invalide : program.SESSIONS[${i}].ex (tableau attendu)` };
    /* Au moins un exercice (#36). Une séance vide n'est pas une séance
       maigre, c'est une séance que l'appli ne sait pas rendre : l'écran
       Semaine résume chaque ligne par son premier exercice (App.jsx:931),
       la fiche n'a rien à afficher et le bilan n'a pas d'exercice clé à
       reprendre. Le refus vit ici parce qu'il vaut pour les deux portes
       (§2.9) : un fichier importé porte le même trou qu'un brouillon
       enregistré trop tôt, et l'éditeur n'a aucune règle de forme à lui. */
    if (session.ex.length === 0) {
      const named = typeof session.name === "string" && session.name.trim();
      const who = named ? `La séance « ${named} »` : `program.SESSIONS[${i}]`;
      return { reason: "invalid-program", message: `${who} ne porte aucun exercice ; une séance doit en porter au moins un.` };
    }
    for (const [j, e] of session.ex.entries()) {
      if (!isSlotRef(e)) return { reason: "invalid-program", message: `Champ invalide : program.SESSIONS[${i}].ex[${j}] (paire [slot, nombre de séries] attendue, séries entier positif)` };
      if (!(e[0] in SLOTS)) return { reason: "invalid-program", message: `program.SESSIONS[${i}].ex : « ${e[0]} » n'est pas un slot de program.SLOTS.` };
    }
  }

  for (const [coreId, core] of Object.entries(CORE)) {
    if (typeof core.label !== "string") return { reason: "invalid-program", message: `Champ invalide : program.CORE.${coreId}.label (chaîne attendue)` };
    if (!Array.isArray(core.ex)) return { reason: "invalid-program", message: `Champ invalide : program.CORE.${coreId}.ex (tableau attendu)` };
    for (const [j, e] of core.ex.entries()) {
      if (!isSlotRef(e)) return { reason: "invalid-program", message: `Champ invalide : program.CORE.${coreId}.ex[${j}] (paire [slot, nombre de séries] attendue, séries entier positif)` };
      if (!(e[0] in SLOTS)) return { reason: "invalid-program", message: `program.CORE.${coreId}.ex : « ${e[0]} » n'est pas un slot de program.SLOTS.` };
    }
  }

  const badFallback = validateFallback(program.fallback, SESSIONS);
  if (badFallback) return badFallback;

  const badCardio = validateCardio(program.cardio, SESSIONS);
  if (badCardio) return badCardio;

  const badPolicies = validatePolicies(program.policies);
  if (badPolicies) return badPolicies;

  return null;
}

/* Politiques de cycle (#14). Le champ est **optionnel** : son absence se lit
   « la forme livrée », pas « aucune politique » — c'est ce qui laisse tous les
   programmes d'avant #14 continuer de décharger en semaine 7.

   Ce qui est refusé est ce qui rendrait le cycle inexécutable ou
   silencieusement faux, jamais ce qui est seulement inhabituel : décharger
   toutes les deux semaines est un choix discutable, pas une incohérence, et
   ce module ne juge que la forme.

   `deload: null` passe, et c'est une valeur légitime — « ne décharge
   jamais ». C'est la distinction que `resolvePolicies()` tient aussi. */
function validatePolicies(policies) {
  if (policies == null) return null;
  if (!isObj(policies)) {
    return { reason: "invalid-program", message: "Champ invalide : program.policies (objet attendu)" };
  }

  const { deload, rotation, test } = policies;

  if (deload != null) {
    if (!isObj(deload)) return { reason: "invalid-program", message: "Champ invalide : program.policies.deload (objet ou null attendu)" };
    /* `null` dit « jamais », un entier dit « toutes les n semaines ». Zéro ou
       un négatif ne disent rien : `week % (n + 1)` y rendrait une décharge à
       chaque semaine, ou une division par le mauvais nombre. */
    if (deload.everyNWeeks != null && !(Number.isInteger(deload.everyNWeeks) && deload.everyNWeeks >= 1)) {
      return { reason: "invalid-program", message: "Champ invalide : program.policies.deload.everyNWeeks (entier ≥ 1, ou null pour ne jamais décharger)" };
    }
    for (const f of ["loadFactor", "volumeFactor"]) {
      if (deload[f] == null) continue;
      /* Strictement entre 0 et 1 : à 0 la décharge supprime la séance, au-delà
         de 1 elle l'alourdit — deux façons de faire l'inverse de ce que le mot
         annonce, et qui ne se verraient qu'à l'usage. */
      if (!isNum(deload[f]) || deload[f] <= 0 || deload[f] > 1) {
        return { reason: "invalid-program", message: `Champ invalide : program.policies.deload.${f} (nombre entre 0 exclu et 1 inclus)` };
      }
    }
    if (deload.signalThreshold != null && !isNum(deload.signalThreshold)) {
      return { reason: "invalid-program", message: "Champ invalide : program.policies.deload.signalThreshold (nombre attendu)" };
    }
  }

  if (rotation != null) {
    if (!isObj(rotation)) return { reason: "invalid-program", message: "Champ invalide : program.policies.rotation (objet attendu)" };
    if (rotation.mode != null && !ROTATION_MODES.includes(rotation.mode)) {
      return { reason: "invalid-program", message: `program.policies.rotation.mode : « ${rotation.mode} » n'est pas un mode connu (attendu : ${ROTATION_MODES.join(", ")}).` };
    }
    if (rotation.mode === "everyNWeeks" && !(Number.isInteger(rotation.n) && rotation.n >= 1)) {
      return { reason: "invalid-program", message: "Champ invalide : program.policies.rotation.n (entier ≥ 1, requis par le mode « everyNWeeks »)" };
    }
  }

  if (test != null) {
    if (!isObj(test)) return { reason: "invalid-program", message: "Champ invalide : program.policies.test (objet attendu)" };
    if (test.mode != null && !TEST_MODES.includes(test.mode)) {
      return { reason: "invalid-program", message: `program.policies.test.mode : « ${test.mode} » n'est pas un mode connu (attendu : ${TEST_MODES.join(", ")}).` };
    }
  }

  return null;
}

/* Vocabulaires fermés des politiques. `onPlateau` est accepté par le
   validateur et traité comme « pas de rotation » par `blockIndex()` : la forme
   est réservée (#14, Notes), le déclencheur n'est pas construit. Écrire un
   programme qui la porte ne doit pas être refusé aujourd'hui pour être accepté
   demain — le fichier serait alors invalide entre deux versions de l'appli,
   ce qui est exactement le piège de `DEFINITION_FORMAT_VERSION`. */
const ROTATION_MODES = ["none", "everyNWeeks", "onPlateau"];
const TEST_MODES = ["manual", "afterNSessions", "afterNDeloads"];

/* ---------- La structure de conditionnement (#34) ----------

   Le champ acceptait `"default"` ou `null` et rien de plus ; il accepte
   désormais une structure. Ce qui la rend vérifiable est la fermeture que
   #25 a posée sur les exercices : une modalité et un genre se choisissent
   dans un catalogue, ils ne s'inventent pas. Un programme généré ou importé
   ne peut donc pas décrire un conditionnement que l'appli ne saurait pas
   rendre — c'était le risque que la spec nommait.

   `anchor` est l'identifiant d'une séance du programme, jamais du texte : la
   spec demandait qu'une référence pendante soit refusée à l'import plutôt
   que rendue telle quelle, et « après Haut B » sous un programme qui n'a pas
   de Haut B est exactement ça.

   Une seule modalité par genre, parce que `cardioPlan(w).z2` est une phrase
   unique : deux modalités en Z2 n'auraient pas de prescription à partager.
   La contrainte est dite ici plutôt que devinée à la résolution.

   Les messages nomment le champ fautif et énoncent la contrainte, sans
   référence au code — la règle de #19, qui vaut toujours sans IA au bout du
   fil : elle a simplement pour lecteur une personne. */
/* #120 : deux formes valides, jamais confondues.
     - un tableau de chaînes — l'ancien format, du texte écrit à la main
       (le programme de Simon aujourd'hui). Laissé tel quel : la migration
       n'est due que si Simon veut le nouveau comportement, pas subie.
     - un objet { levels } — la forme structurée que `buildFallbackLevels()`
       (fallback.js) produit à la génération. `keep` référence des séances
       existantes de program.SESSIONS, intactes — jamais fusionnées (retour
       de test du 2026-09-26 : une séance recomposée pouvait être
       irréaliste ; chaque niveau ne garde donc que des séances que le
       programme sait déjà exécuter telles quelles). */
function validateFallback(fallback, SESSIONS) {
  if (fallback == null) return null;
  if (Array.isArray(fallback)) {
    if (!fallback.every((t) => typeof t === "string")) {
      return { reason: "invalid-program", message: "Champ invalide : program.fallback (tableau de chaînes attendu, ancien format)" };
    }
    return null;
  }
  if (!isObj(fallback) || !Array.isArray(fallback.levels)) {
    return { reason: "invalid-program", message: "Champ invalide : program.fallback (tableau de chaînes, ou objet { levels } attendu)" };
  }

  const sessionIds = new Set((SESSIONS || []).map((s) => s.id));
  for (const [i, level] of fallback.levels.entries()) {
    const at = `program.fallback.levels[${i}]`;
    if (!isObj(level) || !Array.isArray(level.keep)) return { reason: "invalid-program", message: `Champ invalide : ${at}.keep (tableau attendu)` };
    for (const id of level.keep) {
      if (!sessionIds.has(id)) return { reason: "invalid-program", message: `${at}.keep : « ${id} » n'est pas une séance de program.SESSIONS.` };
    }
  }
  return null;
}

function validateCardio(cardio, SESSIONS) {
  if (cardio === undefined || cardio === "default" || cardio === null) return null;
  if (typeof cardio === "string") {
    return { reason: "unknown-cardio-rule", message: `program.cardio : « ${cardio} » n'est pas une règle cardio connue (attendu un objet, "default" ou null).` };
  }
  if (!isObj(cardio)) {
    return { reason: "invalid-program", message: "Champ invalide : program.cardio (objet, « default » ou null attendu)" };
  }
  if (!Array.isArray(cardio.sessions)) {
    return { reason: "invalid-program", message: "Champ invalide : program.cardio.sessions (tableau attendu)" };
  }

  const ids = new Set();
  const sessionIds = new Set((SESSIONS || []).map((s) => s.id));
  const modalityByKind = {};
  for (const [i, x] of cardio.sessions.entries()) {
    const at = `program.cardio.sessions[${i}]`;
    if (!isObj(x)) return { reason: "invalid-program", message: `Champ invalide : ${at} (objet attendu)` };
    if (typeof x.id !== "string" || x.id === "") return { reason: "invalid-program", message: `Champ invalide : ${at}.id (chaîne non vide attendue)` };
    if (ids.has(x.id)) return { reason: "invalid-program", message: `${at}.id : « ${x.id} » apparaît deux fois ; chaque séance de cardio a un identifiant unique.` };
    ids.add(x.id);
    if (!MODALITY_IDS.has(x.modality)) {
      return { reason: "unknown-cardio-rule", message: `${at}.modality : « ${x.modality} » n'est pas une modalité connue (attendu : ${[...MODALITY_IDS].join(", ")}).` };
    }
    if (!CARDIO_KINDS.includes(x.kind)) {
      return { reason: "unknown-cardio-rule", message: `${at}.kind : « ${x.kind} » n'est pas un genre connu (attendu : ${CARDIO_KINDS.join(", ")}).` };
    }
    if (!Number.isInteger(x.day) || x.day < 1 || x.day > 7) {
      return { reason: "invalid-program", message: `Champ invalide : ${at}.day (entier de 1 à 7 attendu, décalage depuis startDate)` };
    }
    if (x.anchor != null && !sessionIds.has(x.anchor)) {
      return { reason: "invalid-program", message: `${at}.anchor : « ${x.anchor} » n'est pas une séance de program.SESSIONS.` };
    }
    if (x.note != null && typeof x.note !== "string") {
      return { reason: "invalid-program", message: `Champ invalide : ${at}.note (chaîne attendue)` };
    }
    if (modalityByKind[x.kind] && modalityByKind[x.kind] !== x.modality) {
      return { reason: "invalid-program", message: `${at} : les séances de genre « ${x.kind} » partagent toutes la même modalité (« ${modalityByKind[x.kind]} » plus haut, « ${x.modality} » ici).` };
    }
    modalityByKind[x.kind] = x.modality;
  }

  if (cardio.mobility != null) {
    if (!isObj(cardio.mobility)) return { reason: "invalid-program", message: "Champ invalide : program.cardio.mobility (objet attendu)" };
    if (!Array.isArray(cardio.mobility.days)) return { reason: "invalid-program", message: "Champ invalide : program.cardio.mobility.days (tableau attendu)" };
    for (const [i, d] of cardio.mobility.days.entries()) {
      if (!Number.isInteger(d) || d < 1 || d > 7) {
        return { reason: "invalid-program", message: `Champ invalide : program.cardio.mobility.days[${i}] (entier de 1 à 7 attendu, décalage depuis startDate)` };
      }
    }
  }

  return null;
}

/* Les nombres de la personne, pas ceux du programme. Même forme de contrôle
   que `startingLoads`, et même raison d'être : deux bornes, des nombres, et
   une clé qui appartient au vocabulaire. */
function validateCardioBaseline(baseline) {
  if (baseline == null) return null;
  if (!isObj(baseline)) return { reason: "invalid-field", message: "Champ invalide : cardioBaseline (objet attendu)" };
  for (const [k, v] of Object.entries(baseline)) {
    if (!BASELINE_KEYS.includes(k)) {
      return { reason: "invalid-field", message: `cardioBaseline : « ${k} » n'est pas une cible connue (attendu : ${BASELINE_KEYS.join(", ")}).` };
    }
    if (!Array.isArray(v) || v.length < 2 || !v.slice(0, 2).every(isNum)) {
      return { reason: "invalid-field", message: `Champ invalide : cardioBaseline.${k} (deux nombres attendus, borne basse puis borne haute)` };
    }
  }
  return null;
}

/* Forme d'une ligne de séance (#16). Volontairement minimale : l'identité
   d'un log est (date, slot) depuis la timeline datée, et c'est ce couple
   que findLog() et history() interrogent. Le reste — id, kind, updatedAt,
   deletedAt, schemaVersion — peut manquer sans que rien ne casse, et un
   journal migré depuis la v1 en est la preuve vivante. */
export function isLogRow(row) {
  if (!isObj(row)) return false;
  if (typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return false;
  if (typeof row.slot !== "string" || row.slot === "") return false;
  if (row.ex != null && !isObj(row.ex)) return false;
  /* #55 : `sub` est jugé sur sa forme et rien d'autre. Pas de contrôle que les
     valeurs sont des exercices du registre ni que les clés sont des créneaux
     connus : vidFor() (session-sub.js) retombe déjà sur l'exercice prescrit
     pour tout ce qu'elle ne reconnaît pas, et une ligne de séance n'a pas à
     être écartée — avec ses séries — pour un champ dont la lecture est sûre. */
  if (row.sub != null && !isObj(row.sub)) return false;
  return true;
}

/* Écarte les lignes illisibles plutôt que de refuser tout le journal
   (#32, Q3) : une ligne pourrie dans deux ans d'historique ne doit pas
   coûter l'accès au reste. Rend le journal filtré et le nombre de lignes
   retirées — ce compte n'est pas décoratif, c'est lui qui empêche la perte
   d'être silencieuse, et l'appelant écrit une copie de l'original avant
   que l'autosave ne réécrive la version filtrée. */
export function sanitizeJournal(journal) {
  let dropped = 0;
  const programs = Object.fromEntries(Object.entries(journal.programs).map(([id, entry]) => {
    if (!isObj(entry) || !isObj(entry.logs)) return [id, entry];
    const rows = Object.entries(entry.logs);
    const kept = rows.filter(([, row]) => isLogRow(row));
    if (kept.length === rows.length) return [id, entry];
    dropped += rows.length - kept.length;
    return [id, { ...entry, logs: Object.fromEntries(kept) }];
  }));
  return { journal: { ...journal, programs }, dropped };
}

/* Jugement complet d'une définition, quelle que soit sa provenance — un
   fichier chargé, un journal collé, ou le journal déjà stocké. C'est le
   corps de parseProgramImport d'avant #32, moins JSON.parse et moins la
   normalisation (`name ?? id`, `profile ?? défaut`), qui restent dans
   import.js : ce module juge, il ne complète pas.

   L'ordre des contrôles est celui d'origine, et il compte : une entrée qui
   viole plusieurs règles doit continuer à rendre la même reason qu'avant
   (les tests de #20 et #25 portent là-dessus).

   weeks !== 12 garde sa raison propre (spec #6 Q2) ; relâcher 12 est
   #9/#14. */
export function validateDefinition(definition) {
  if (typeof definition !== "object" || definition === null || Array.isArray(definition)) {
    return { reason: "not-a-program", message: undefined };
  }

  if (definition.program != null) {
    const bad = validateProgram(definition.program);
    if (bad) return bad;
  }

  /* formatVersion : absent ou ≤ courant accepté ; au-delà, même verdict
     qu'un journal trop récent — l'action utilisateur est la même. */
  if (definition.formatVersion != null) {
    if (!Number.isInteger(definition.formatVersion)) {
      return { reason: "invalid-field", message: "Champ invalide : formatVersion (entier attendu)" };
    }
    if (definition.formatVersion > DEFINITION_FORMAT_VERSION) return { reason: "too-new", message: undefined };
  }

  for (const field of ["id", "startDate", "startingLoads"]) {
    if (definition[field] == null) return { reason: "missing-field", message: `Champ manquant : ${field}` };
  }
  if (typeof definition.id !== "string" || definition.id === "") {
    return { reason: "invalid-field", message: "Champ invalide : id (chaîne non vide attendue)" };
  }

  if (definition.profile != null) {
    const p = definition.profile;
    if (typeof p !== "object" || Array.isArray(p)) return { reason: "invalid-field", message: "Champ invalide : profile (objet attendu)" };
    for (const field of ["maintenanceKcal", "startKcal"]) {
      if (p[field] == null) return { reason: "missing-field", message: `Champ manquant : profile.${field}` };
      if (!isNum(p[field])) return { reason: "invalid-field", message: `Champ invalide : profile.${field} (nombre attendu)` };
    }
    if (p.macros == null) return { reason: "missing-field", message: "Champ manquant : profile.macros" };
    for (const k of ["p", "f", "c"]) {
      if (p.macros[k] == null) return { reason: "missing-field", message: `Champ manquant : profile.macros.${k}` };
      if (!isNum(p.macros[k])) return { reason: "invalid-field", message: `Champ invalide : profile.macros.${k} (nombre attendu)` };
    }
    if (p.targetWeightKg == null) return { reason: "missing-field", message: "Champ manquant : profile.targetWeightKg" };
    if (!Array.isArray(p.targetWeightKg) || p.targetWeightKg.length < 2 || !p.targetWeightKg.slice(0, 2).every(isNum)) {
      return { reason: "invalid-field", message: "Champ invalide : profile.targetWeightKg (deux nombres attendus)" };
    }

    /* #121 : les champs bruts sont optionnels, et indépendants les uns des
       autres — un profil peut porter certains sans les autres (celui de
       Simon, public/programs/haut-bas-5j.json, porte déjà bodyweightKg/
       heightCm/birthdate depuis #5 sans sexe/activite/objectif, qui sont
       nouveaux). Chacun se valide seul, s'il est présent ; aucun n'exige la
       présence d'un autre. Un profil d'avant ce ticket (les 4 champs
       calculés ci-dessus seulement) continue de valider à l'identique. */
    for (const field of ["bodyweightKg", "heightCm"]) {
      if (p[field] != null && (!isNum(p[field]) || p[field] <= 0)) {
        return { reason: "invalid-field", message: `Champ invalide : profile.${field} (nombre positif attendu)` };
      }
    }
    if (p.birthdate != null && (typeof p.birthdate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(p.birthdate))) {
      return { reason: "invalid-field", message: "Champ invalide : profile.birthdate (AAAA-MM-JJ attendu)" };
    }
    if (p.sexe != null && p.sexe !== "h" && p.sexe !== "f") {
      return { reason: "invalid-field", message: `Champ invalide : profile.sexe (« h » ou « f » attendu)` };
    }
    if (p.activite != null && !Object.keys(ACTIVITY_FACTORS).includes(p.activite)) {
      return { reason: "invalid-field", message: `Champ invalide : profile.activite (attendu : ${Object.keys(ACTIVITY_FACTORS).join(", ")})` };
    }
    if (p.objectif != null && !OBJECTIVES.includes(p.objectif)) {
      return { reason: "invalid-field", message: `Champ invalide : profile.objectif (attendu : ${OBJECTIVES.join(", ")})` };
    }
  }

  if (definition.weeks !== 12) {
    return { reason: "unsupported-weeks", message: `Ce programme compte ${definition.weeks} semaines, 12 attendues.` };
  }

  if (typeof definition.startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(definition.startDate) || !roundTripsAsDate(definition.startDate)) {
    return { reason: "invalid-field", message: "Champ invalide : startDate (AAAA-MM-JJ, date réelle attendue)" };
  }

  /* startingLoads doit être un objet (#33) : `5` passait sans bruit, parce
     qu'Object.entries(5) vaut [] et que la boucle ne s'exécutait jamais —
     un contrôle qui ne contrôle rien est pire qu'un contrôle absent, il
     rassure. */
  if (!isObj(definition.startingLoads)) {
    return { reason: "invalid-field", message: "Champ invalide : startingLoads (objet attendu)" };
  }
  for (const [vid, load] of Object.entries(definition.startingLoads)) {
    if (!isNum(load)) return { reason: "invalid-field", message: `Charge de départ invalide pour ${vid} (nombre attendu)` };
    if (!EXERCISE_IDS.has(vid)) return { reason: "unknown-exercise", message: `startingLoads : « ${vid} » n'est pas un exercice du registre.` };
  }

  /* #34 : les cibles de cardio sont à `startingLoads` ce que les watts sont
     aux kilos — la calibration d'une personne, pas la méthode. D'où leur
     place ici, sur la définition, et non dans `program`. */
  const badBaseline = validateCardioBaseline(definition.cardioBaseline);
  if (badBaseline) return badBaseline;

  return null;
}

/* Cycles stockés que l'appli ne peut pas exécuter — mal formés, ou portant
   une définition que le validateur refuse. Ils restent dans le journal
   (les rejeter ferait perdre l'accès à un historique intact) mais ne
   doivent pas pouvoir devenir le cycle actif d'un simple clic : le
   sélecteur de programmes les rend inactifs à partir de cette liste.

   Dérivé, jamais stocké : marquer l'entrée elle-même reviendrait à écrire
   ce drapeau dans le journal à la première sauvegarde, withVersion()
   recopiant `programs` tel quel. */
export function unusableProgramIds(programs) {
  if (!isObj(programs)) return [];
  return Object.entries(programs)
    .filter(([, entry]) => validateProgramEntry(entry) || validateDefinition(entry.definition))
    .map(([id]) => id);
}
