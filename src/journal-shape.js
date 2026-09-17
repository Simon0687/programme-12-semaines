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
import { AFTER_KINDS } from "./cardio.js";

const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const isObj = (x) => typeof x === "object" && x !== null && !Array.isArray(x);

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
       Note : App.jsx compare encore ce champ à today.getDay() (0 = dimanche),
       ce qui ne coïncide avec l'offset que si startDate tombe un lundi. La
       plage retenue est correcte sous les deux conventions pour 1-6 ; la
       contradiction elle-même est une issue à part (design.md, suivis). */
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

  if (program.cardio !== undefined && program.cardio !== "default" && program.cardio !== null) {
    return { reason: "unknown-cardio-rule", message: `program.cardio : « ${program.cardio} » n'est pas une règle cardio connue (attendu "default" ou null).` };
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
