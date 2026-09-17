import { test } from "node:test";
import assert from "node:assert/strict";

import { IMPORT_MESSAGES, parseJournalImport, parseProgramImport } from "../src/import.js";
import { SCHEMA_VERSION, emptyJournal, withVersion } from "../src/schema.js";
import { DEFAULT_DEFINITION } from "../src/definition.js";
import { LEGACY_DEFINITION } from "../src/legacy-program.js";
import { testCtx } from "./helpers/migration-ctx.js";

/* Plancher valide : les champs que buildPlan() lit vraiment sont requis
   depuis #20 (maintenanceKcal, startKcal, macros p/f/c, targetWeightKg,
   startingLoads présent — {} accepté). */
const minimalDefinition = () => ({
  id: "test-cycle",
  startDate: "2027-01-04",
  weeks: 12,
  profile: {
    maintenanceKcal: 2500,
    startKcal: 2700,
    macros: { p: 1, f: 1, c: 1 },
    targetWeightKg: [70, 71],
  },
  startingLoads: {},
});

/* Les assertions portent sur reason, jamais sur message : la formulation
   est volontairement remise à plus tard (decisions-spec.md, Q2). */

test("parseJournalImport : texte illisible => invalid-json", () => {
  for (const t of ["{", "", "pas du json", "{,}"]) {
    assert.equal(parseJournalImport(t).reason, "invalid-json", t);
  }
});

test("parseJournalImport : JSON valide mais pas un journal => not-a-journal", () => {
  for (const t of ['{"a":1}', "null", "5", "[]", '"texte"']) {
    assert.equal(parseJournalImport(t).reason, "not-a-journal", t);
  }
});

test("parseJournalImport : schemaVersion non positif => migration-failed, pas invalid-json", () => {
  for (const v of [0, -3]) {
    const res = parseJournalImport(JSON.stringify({ schemaVersion: v, logs: {} }));
    assert.equal(res.ok, false);
    assert.equal(res.reason, "migration-failed", `schemaVersion ${v}`);
  }
});

test("parseJournalImport : version trop récente => too-new", () => {
  const res = parseJournalImport(JSON.stringify({ schemaVersion: 99, logs: { w1_hautA: { done: true } } }));
  assert.equal(res.ok, false);
  assert.equal(res.reason, "too-new");
});

test("parseJournalImport : journal à la version courante valide => ok, contenu préservé", () => {
  /* #26 a supprimé definition: null, #32 fait passer la définition active par
     le validateur : une enveloppe à la version courante porte donc une vraie
     définition et des lignes datées, comme celles que l'appli écrit. */
  const row = { id: "r1", date: "2026-09-07", slot: "hautA", ex: { dc: [{ w: 60, r: 8 }] }, done: true };
  const journal = {
    schemaVersion: SCHEMA_VERSION,
    activeProgramId: "x",
    programs: { x: { definition: { ...LEGACY_DEFINITION, id: "x" }, logs: { r1: row }, cardio: {}, checkin: {} } },
  };
  const res = parseJournalImport(JSON.stringify(journal));
  assert.equal(res.ok, true);
  assert.equal(res.migrated, false);
  assert.equal(res.dropped, 0);
  assert.deepEqual(res.data.programs.x.logs, { r1: row });
});

test("parseJournalImport : journal v1 (plat, sans schemaVersion) => ok, migré vers la version courante (#6, #16)", () => {
  const res = parseJournalImport(JSON.stringify({ logs: { w1_hautA: { done: true } }, cardio: {}, checkin: {} }), testCtx());
  assert.equal(res.ok, true);
  assert.equal(res.migrated, true);
  assert.equal(res.data.schemaVersion, SCHEMA_VERSION);
  assert.ok(res.data.activeProgramId);
  const logs = Object.values(res.data.programs[res.data.activeProgramId].logs);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].slot, "hautA");
  assert.equal(logs[0].done, true);
});

test("parseJournalImport : accepte .programs à la racine, pas seulement .logs (#6)", () => {
  const res = parseJournalImport(JSON.stringify({ schemaVersion: SCHEMA_VERSION, activeProgramId: "x", programs: { x: { definition: { ...LEGACY_DEFINITION, id: "x" }, logs: {}, cardio: {}, checkin: {} } } }));
  assert.notEqual(res.reason, "not-a-journal");
  assert.equal(res.ok, true);
});

test("parseJournalImport : un verdict positif ne porte ni reason ni message", () => {
  const res = parseJournalImport(JSON.stringify({ logs: {} }), testCtx());
  assert.equal(res.ok, true);
  assert.equal(res.reason, undefined);
  assert.equal(res.message, undefined);
});

test("parseJournalImport : le message d'un rejet vient de IMPORT_MESSAGES", () => {
  assert.equal(parseJournalImport("{").message, IMPORT_MESSAGES["invalid-json"]);
});

test("IMPORT_MESSAGES : aucune raison sans phrase", () => {
  for (const [reason, message] of Object.entries(IMPORT_MESSAGES)) {
    assert.equal(typeof message, "string", reason);
    assert.ok(message.length > 0, reason);
  }
});

test("parseProgramImport : texte illisible => invalid-json", () => {
  assert.equal(parseProgramImport("{").reason, "invalid-json");
});

test("parseProgramImport : JSON valide mais aucun champ de programme => not-a-program", () => {
  for (const t of ['{"a":1}', "null", "5", "[]"]) {
    assert.equal(parseProgramImport(t).reason, "not-a-program", t);
  }
});

test("parseProgramImport : champ requis manquant => missing-field", () => {
  for (const field of ["id", "startDate", "startingLoads"]) {
    const def = minimalDefinition();
    delete def[field];
    const res = parseProgramImport(JSON.stringify(def));
    assert.equal(res.ok, false);
    assert.equal(res.reason, "missing-field", field);
  }
});

test("parseProgramImport : profile nutrition absent => accepte la définition et remplace par le profil par défaut (#27)", () => {
  const def = { ...minimalDefinition() };
  delete def.profile;
  const res = parseProgramImport(JSON.stringify(def));
  assert.equal(res.ok, true);
  assert.deepEqual(res.definition.profile, DEFAULT_DEFINITION.profile);
});

test("parseProgramImport : sous-champ de profile lu par buildPlan absent => missing-field (#20)", () => {
  for (const path of [["maintenanceKcal"], ["startKcal"], ["macros"], ["macros", "p"], ["targetWeightKg"]]) {
    const def = minimalDefinition();
    let obj = def.profile;
    for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
    delete obj[path[path.length - 1]];
    const res = parseProgramImport(JSON.stringify(def));
    assert.equal(res.ok, false, path.join("."));
    assert.equal(res.reason, "missing-field", path.join("."));
  }
});

test("parseProgramImport : profile.macros = {} => missing-field (#20)", () => {
  const res = parseProgramImport(JSON.stringify({ ...minimalDefinition(), profile: { ...minimalDefinition().profile, macros: {} } }));
  assert.equal(res.ok, false);
  assert.equal(res.reason, "missing-field");
});

test("parseProgramImport : champ de profile présent mais du mauvais type => invalid-field (#20)", () => {
  const cases = [
    (d) => { d.profile.maintenanceKcal = "beaucoup"; },
    (d) => { d.profile.startKcal = "2700"; },
    (d) => { d.profile.macros.p = "185"; },
    (d) => { d.profile.targetWeightKg = [70]; },
    (d) => { d.profile.targetWeightKg = ["70", "71"]; },
  ];
  for (const mutate of cases) {
    const def = minimalDefinition();
    mutate(def);
    const res = parseProgramImport(JSON.stringify(def));
    assert.equal(res.ok, false, mutate.toString());
    assert.equal(res.reason, "invalid-field", mutate.toString());
  }
});

test("parseProgramImport : weeks !== 12 => unsupported-weeks (spec #6 Q2)", () => {
  const res = parseProgramImport(JSON.stringify({ ...minimalDefinition(), weeks: 10 }));
  assert.equal(res.ok, false);
  assert.equal(res.reason, "unsupported-weeks");
});

test("parseProgramImport : startDate non ISO-parsable => invalid-field (#20)", () => {
  const res = parseProgramImport(JSON.stringify({ ...minimalDefinition(), startDate: "pas une date" }));
  assert.equal(res.ok, false);
  assert.equal(res.reason, "invalid-field");
});

test("parseProgramImport : startDate qui ne fait pas l'aller-retour => invalid-field (#20)", () => {
  // JS Date bascule 2027-02-30 au 2 mars : le seul regex laissait passer.
  const res = parseProgramImport(JSON.stringify({ ...minimalDefinition(), startDate: "2027-02-30" }));
  assert.equal(res.ok, false);
  assert.equal(res.reason, "invalid-field");
});

test("parseProgramImport : startingLoads non numérique => invalid-field (#20)", () => {
  const res = parseProgramImport(JSON.stringify({ ...minimalDefinition(), startingLoads: { dc: "beaucoup" } }));
  assert.equal(res.ok, false);
  assert.equal(res.reason, "invalid-field");
});

/* program : accepté et validé depuis #25 (le blanket-reject "unsupported-field"
   de #20 est levé). minimalProgram() ne référence que des ids réels du
   registre (src/registry.js), pour isoler chaque cas de rejet. */
const minimalProgram = () => ({
  SLOTS: { dc: { reps: [4, 8], rest: 150, b1: "dc", b2: "dc" } },
  SESSIONS: [{ id: "s1", day: 1, warm: "upper", ex: [["dc", 3]], core: "coreA" }],
  CORE: { coreA: { label: "Abdos", ex: [] } },
  WARM: { upper: "5 min d'échauffement." },
});

test("parseProgramImport : program bien formé => ok, chargé tel quel (#25)", () => {
  const res = parseProgramImport(JSON.stringify({ ...minimalDefinition(), program: minimalProgram() }));
  assert.equal(res.ok, true);
  assert.deepEqual(res.definition.program, minimalProgram());
});

test("parseProgramImport : program n'est pas un objet => invalid-program (#25)", () => {
  for (const program of ["garbage", 42, ["a"]]) {
    const res = parseProgramImport(JSON.stringify({ ...minimalDefinition(), program }));
    assert.equal(res.ok, false, JSON.stringify(program));
    assert.equal(res.reason, "invalid-program", JSON.stringify(program));
  }
});

test("parseProgramImport : program.SLOTS/.SESSIONS/.CORE/.WARM manquant => missing-field (#25)", () => {
  for (const field of ["SLOTS", "SESSIONS", "CORE", "WARM"]) {
    const program = { ...minimalProgram() };
    delete program[field];
    const res = parseProgramImport(JSON.stringify({ ...minimalDefinition(), program }));
    assert.equal(res.ok, false, field);
    assert.equal(res.reason, "missing-field", field);
  }
});

test("parseProgramImport : program.SLOTS.<x>.b1 référence un id hors du registre => unknown-exercise (#25)", () => {
  const program = { ...minimalProgram(), SLOTS: { dc: { reps: [4, 8], rest: 150, b1: "invente-un-id", b2: "dc" } } };
  const res = parseProgramImport(JSON.stringify({ ...minimalDefinition(), program }));
  assert.equal(res.ok, false);
  assert.equal(res.reason, "unknown-exercise");
});

test("parseProgramImport : program.SLOTS.<x>.reps mal formé => invalid-program (#25)", () => {
  const program = { ...minimalProgram(), SLOTS: { dc: { reps: [4], rest: 150, b1: "dc", b2: "dc" } } };
  const res = parseProgramImport(JSON.stringify({ ...minimalDefinition(), program }));
  assert.equal(res.ok, false);
  assert.equal(res.reason, "invalid-program");
});

test("parseProgramImport : program.SESSIONS[i].warm hors de program.WARM => invalid-program (#25)", () => {
  const program = { ...minimalProgram(), SESSIONS: [{ id: "s1", warm: "n-importe-quoi", ex: [["dc", 3]], core: "coreA" }] };
  const res = parseProgramImport(JSON.stringify({ ...minimalDefinition(), program }));
  assert.equal(res.ok, false);
  assert.equal(res.reason, "invalid-program");
});

test("parseProgramImport : program.cardio inconnu => unknown-cardio-rule ; \"default\"/null/absent => ok (#25)", () => {
  const bad = parseProgramImport(JSON.stringify({ ...minimalDefinition(), program: { ...minimalProgram(), cardio: "z2" } }));
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, "unknown-cardio-rule");

  for (const cardio of ["default", null, undefined]) {
    const program = { ...minimalProgram() };
    if (cardio !== undefined) program.cardio = cardio;
    const res = parseProgramImport(JSON.stringify({ ...minimalDefinition(), program }));
    assert.equal(res.ok, true, String(cardio));
  }
});

test("parseProgramImport : startingLoads référence un id hors du registre => unknown-exercise (#25)", () => {
  const res = parseProgramImport(JSON.stringify({ ...minimalDefinition(), startingLoads: { "invente-un-id": 50 } }));
  assert.equal(res.ok, false);
  assert.equal(res.reason, "unknown-exercise");
});

test("parseProgramImport : formatVersion supérieur au courant => too-new (#20)", () => {
  const res = parseProgramImport(JSON.stringify({ ...minimalDefinition(), formatVersion: 99 }));
  assert.equal(res.ok, false);
  assert.equal(res.reason, "too-new");
});

test("parseProgramImport : formatVersion non entier => invalid-field (#20)", () => {
  const res = parseProgramImport(JSON.stringify({ ...minimalDefinition(), formatVersion: "1" }));
  assert.equal(res.ok, false);
  assert.equal(res.reason, "invalid-field");
});

test("parseProgramImport : formatVersion absent, antérieur ou égal au courant => accepté ; au-delà => too-new (#20, #25)", () => {
  assert.equal(parseProgramImport(JSON.stringify(minimalDefinition())).ok, true);
  assert.equal(parseProgramImport(JSON.stringify({ ...minimalDefinition(), formatVersion: 1 })).ok, true); // #25 : un fichier v1 (sans program) charge toujours
  assert.equal(parseProgramImport(JSON.stringify({ ...minimalDefinition(), formatVersion: 2 })).ok, true); // #25 : un fichier v2 charge toujours
  assert.equal(parseProgramImport(JSON.stringify({ ...minimalDefinition(), formatVersion: 3 })).ok, true); // DEFINITION_FORMAT_VERSION courant depuis #34
  const tooNew = parseProgramImport(JSON.stringify({ ...minimalDefinition(), formatVersion: 4 }));
  assert.equal(tooNew.ok, false);
  assert.equal(tooNew.reason, "too-new");
});

test("parseProgramImport : définition minimale valide, sans program => ok", () => {
  const res = parseProgramImport(JSON.stringify(minimalDefinition()));
  assert.equal(res.ok, true);
  assert.equal(res.definition.id, "test-cycle");
});

test("parseProgramImport : name absent => ok, complété par id (#20 Q3)", () => {
  const def = minimalDefinition();
  assert.equal(def.name, undefined);
  const res = parseProgramImport(JSON.stringify(def));
  assert.equal(res.ok, true);
  assert.equal(res.definition.name, "test-cycle");
});

test("parseProgramImport : name présent => conservé tel quel", () => {
  const res = parseProgramImport(JSON.stringify({ ...minimalDefinition(), name: "Cycle test" }));
  assert.equal(res.ok, true);
  assert.equal(res.definition.name, "Cycle test");
});

test("parseProgramImport : définition complète valide => ok, préservée (name déjà présent)", () => {
  const full = { ...minimalDefinition(), name: "Cycle test", startingLoads: { dc: 72.5, squat: 105 } };
  const res = parseProgramImport(JSON.stringify(full));
  assert.equal(res.ok, true);
  assert.deepEqual(res.definition, full);
});

test("parseProgramImport : la définition livrée avec l'appli passe son propre validateur (#20)", () => {
  const res = parseProgramImport(JSON.stringify(DEFAULT_DEFINITION));
  assert.equal(res.ok, true);
});

/* --------------------------------------------------------------
   #32 : les trois portes jugent une définition de la même façon.
   -------------------------------------------------------------- */

const pasted = (definition, logs = {}) => JSON.stringify({
  schemaVersion: SCHEMA_VERSION,
  activeProgramId: "x",
  programs: { x: { definition, logs, cardio: {}, checkin: {} } },
});

test("parseJournalImport : une définition que le fichier rejetterait est rejetée pour la même raison (#32)", () => {
  const bad = { id: "x", weeks: "douze", startDate: "pas-une-date", program: "n_importe_quoi", startingLoads: {} };
  const asJournal = parseJournalImport(pasted(bad), testCtx());
  const asFile = parseProgramImport(JSON.stringify(bad));

  assert.equal(asJournal.ok, false);
  assert.equal(asFile.ok, false);
  assert.equal(asJournal.reason, asFile.reason, "les deux portes doivent rendre la même raison");
  assert.equal(asJournal.message, asFile.message);
});

test("parseJournalImport : une enveloppe mal formée est rejetée, sans lever (#32)", () => {
  for (const journal of [
    { schemaVersion: SCHEMA_VERSION, programs: { x: {} } },
    { schemaVersion: SCHEMA_VERSION, activeProgramId: "x", programs: { x: {} } },
    { schemaVersion: SCHEMA_VERSION, activeProgramId: "x", programs: { x: null } },
    { schemaVersion: SCHEMA_VERSION, activeProgramId: "absent", programs: { x: { definition: {}, logs: {}, cardio: {}, checkin: {} } } },
    { logs: {}, programs: { x: {} } },
  ]) {
    const res = parseJournalImport(JSON.stringify(journal), testCtx());
    assert.equal(res.ok, false, `accepté à tort : ${JSON.stringify(journal)}`);
    assert.ok(res.message, "un rejet doit porter un message affichable");
  }
});

test("parseJournalImport : les lignes illisibles d'un journal collé sont écartées et comptées (#32)", () => {
  const res = parseJournalImport(pasted({ ...LEGACY_DEFINITION, id: "x" }, {
    r1: { id: "r1", date: "2026-09-07", slot: "hautA", done: true },
    r2: 42,
  }), testCtx());
  assert.equal(res.ok, true);
  assert.equal(res.dropped, 1);
  assert.deepEqual(Object.keys(res.data.programs.x.logs), ["r1"]);
});

/* Aller-retour export -> import (#15). Le critère d'acceptation de l'issue est
   « importing a file exported this way restores the journal exactly » : c'est
   ce qui rend le fichier téléchargé une vraie sauvegarde et pas un résumé. */
test("aller-retour : un journal exporté se réimporte à l'identique (#15)", () => {
  const j = emptyJournal(DEFAULT_DEFINITION);
  const id = j.activeProgramId;
  j.programs[id].logs = {
    lg_1: {
      id: "lg_1", date: "2026-10-01", slot: "upperB", kind: "normal",
      ex: { incl_db: [{ w: "24", r: "12", rir: "1" }] },
      notes: "epaule droite 2/10", done: true, deletedAt: null,
      updatedAt: "2026-10-01T19:47:12.331Z", schemaVersion: SCHEMA_VERSION,
    },
  };
  j.programs[id].checkin = { w3: { poids: "78,5" } };

  const res = parseJournalImport(JSON.stringify(withVersion(j)), testCtx());

  assert.equal(res.ok, true);
  assert.equal(res.migrated, false);
  assert.deepEqual(res.data.activeProgramId, j.activeProgramId);
  assert.deepEqual(res.data.programs, j.programs);
});
