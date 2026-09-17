import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SCHEMA_VERSION, LEGACY_PROGRAM_ID, applyChain, migrate, versionOf,
  weekKey, genId, dateForSlot, slotForDate, findLog, writeLog,
} from "../src/schema.js";
import { testCtx } from "./helpers/migration-ctx.js";
import { LEGACY_DEFINITION } from "../src/legacy-program.js";

test("weekKey : format des clés cardio/check-in (#24), inchangé par #16 (hors périmètre, #29)", () => {
  assert.equal(weekKey(1), "w1");
  assert.equal(weekKey(7), "w7");
});

test("genId : deux appels ne renvoient jamais la même valeur", () => {
  const a = genId(), b = genId();
  assert.notEqual(a, b);
  assert.equal(typeof a, "string");
});

test("dateForSlot : startDate + 7×(semaine-1) + (jour-1) (#16)", () => {
  assert.equal(dateForSlot("2026-01-05", 1, 1), "2026-01-05"); // semaine 1, lundi = startDate
  assert.equal(dateForSlot("2026-01-05", 1, 2), "2026-01-06"); // semaine 1, mardi
  assert.equal(dateForSlot("2026-01-05", 1, 6), "2026-01-10"); // semaine 1, samedi
  assert.equal(dateForSlot("2026-01-05", 2, 1), "2026-01-12"); // semaine 2, lundi
  assert.equal(dateForSlot("2026-01-05", 7, 1), "2026-02-16"); // semaine 7 (décharge), lundi
  assert.equal(dateForSlot("2026-01-05", 12, 6), "2026-03-28"); // semaine 12, samedi
});

/* ---------- slotForDate, l'inverse de dateForSlot (#39) ----------

   `day` se lisait sous deux conventions : un décalage depuis startDate dans
   dateForSlot, un Date#getDay() dans App.jsx. Elles ne coïncidaient que sur un
   départ le lundi, et seulement de 1 à 6. Ces cas épinglent celle qui reste. */

test("slotForDate : aller-retour avec dateForSlot sur tout un cycle", () => {
  /* La propriété qui définit la fonction : quelle que soit la semaine et le
     jour, dateForSlot puis slotForDate rendent le couple de départ. Un départ
     un mercredi, pour que la coïncidence avec getDay() ne puisse pas sauver
     un test. */
  for (const start of ["2026-01-05", "2026-03-04", "2026-10-25"]) {
    for (let w = 1; w <= 12; w++) {
      for (let d = 1; d <= 7; d++) {
        assert.deepEqual(slotForDate(start, dateForSlot(start, w, d)), { week: w, day: d }, `${start} S${w} J${d}`);
      }
    }
  }
});

test("slotForDate : un programme qui part un mercredi tombe juste", () => {
  /* 2026-03-04 est un mercredi. Le jour 1 du cycle est ce mercredi, pas lundi :
     c'est le cas nominal de #19 — on installe l'appli un mercredi et on
     commence dans la foulée — et c'est celui que getDay() décalait de deux
     jours sur toute la durée du cycle. */
  assert.deepEqual(slotForDate("2026-03-04", "2026-03-04"), { week: 1, day: 1 });
  assert.deepEqual(slotForDate("2026-03-04", "2026-03-09"), { week: 1, day: 6 });
  /* La semaine du cycle bascule au mardi suivant, pas au lundi : elle compte
     depuis startDate. Sous getDay(), le 10 mars aurait rendu 2 — le jour 2 de
     la semaine 1 — soit la séance du jeudi annoncée un mardi. */
  assert.deepEqual(slotForDate("2026-03-04", "2026-03-10"), { week: 1, day: 7 });
  assert.deepEqual(slotForDate("2026-03-04", "2026-03-11"), { week: 2, day: 1 });
});

test("slotForDate : le dimanche est le jour 7, jamais 0", () => {
  /* Le trou de #39 : `day: 0` datait la séance la veille du départ du cycle, et
     `day: 7` la datait juste mais n'était jamais annoncé comme le jour même,
     getDay() ne rendant pas 7. */
  assert.deepEqual(slotForDate("2026-01-05", "2026-01-11"), { week: 1, day: 7 });
  assert.equal(dateForSlot("2026-01-05", 1, 7), "2026-01-11");
});

test("slotForDate : avant le départ, rien — pas un jour négatif", () => {
  assert.equal(slotForDate("2026-01-05", "2026-01-04"), null);
  assert.equal(slotForDate("2026-01-05", "2025-12-01"), null);
});

test("slotForDate : la semaine n'est pas plafonnée, c'est l'appelant qui décide", () => {
  /* App.jsx en a besoin des deux façons : ramener la navigation sur la dernière
     semaine, et éteindre la pastille « aujourd'hui ». Plafonner ici lui
     retirerait le moyen de distinguer les deux. */
  assert.deepEqual(slotForDate("2026-01-05", "2026-03-30"), { week: 13, day: 1 });
});

test("slotForDate : un changement d'heure ne décale pas le jour", () => {
  /* Le calcul passe par Date.UTC. Une soustraction de dates locales rend 89,96
     jours sur un cycle qui traverse le passage à l'heure d'été (2026-03-29 en
     France), et Math.floor en fait un jour de moins pour tout le reste du
     cycle. */
  assert.deepEqual(slotForDate("2026-03-02", "2026-03-30"), { week: 5, day: 1 });
  assert.deepEqual(slotForDate("2026-03-02", "2026-05-25"), { week: 13, day: 1 });
  /* Et dans l'autre sens, le retour à l'heure d'hiver (2026-10-25). */
  assert.deepEqual(slotForDate("2026-10-05", "2026-10-26"), { week: 4, day: 1 });
});

test("findLog / writeLog : crée au premier écrit, réutilise le même id ensuite (#16)", () => {
  let logs = {};
  logs = writeLog(logs, "2026-01-05", "hautA", { ex: { dc: [{ w: "70", r: "8", rir: "2" }] } });
  const created = findLog(logs, "2026-01-05", "hautA");
  assert.ok(created);
  assert.equal(created.date, "2026-01-05");
  assert.equal(created.slot, "hautA");
  assert.equal(created.kind, null); // pas encore validée
  assert.equal(created.done, false);
  assert.equal(created.deletedAt, null);
  assert.equal(created.schemaVersion, SCHEMA_VERSION);

  logs = writeLog(logs, "2026-01-05", "hautA", { done: true, kind: "normal" });
  const updated = findLog(logs, "2026-01-05", "hautA");
  assert.equal(updated.id, created.id); // même enregistrement, pas un doublon
  assert.equal(updated.done, true);
  assert.equal(updated.kind, "normal");
  assert.deepEqual(updated.ex, { dc: [{ w: "70", r: "8", rir: "2" }] }); // préservé du premier écrit
  assert.equal(Object.keys(logs).length, 1);
});

test("findLog : absent -> null", () => {
  assert.equal(findLog({}, "2026-01-05", "hautA"), null);
});

test("versionOf : schemaVersion absent ou invalide => v1", () => {
  assert.equal(versionOf({ logs: {} }), 1);
  assert.equal(versionOf({ schemaVersion: undefined }), 1);
  assert.equal(versionOf({ schemaVersion: "2" }), 1);
  assert.equal(versionOf({ schemaVersion: 1.5 }), 1);
  assert.equal(versionOf({ schemaVersion: 3 }), 3);
  assert.equal(versionOf(null), 1);
});

test("migrate : no-op à la version courante (v3), résultat équivalent à l'entrée", () => {
  const input = {
    schemaVersion: SCHEMA_VERSION,
    activeProgramId: "x",
    programs: { x: { definition: null, logs: { abc: { id: "abc", date: "2026-01-05", slot: "hautA", kind: "normal", done: true } }, cardio: {}, checkin: {} } },
  };
  const res = migrate(input, testCtx());
  assert.equal(res.ok, true);
  assert.equal(res.migrated, false);
  assert.deepEqual(res.data, input);
});

test("migrate : journal v1 (plat) migré vers la version courante, séances datées sous le programme hérité (#6, #16, #26)", () => {
  const input = { schemaVersion: 1, logs: { w1_hautA: { done: true }, w7_basA: { done: true, ex: { squat: [{ w: "80", r: "5", rir: "2" }] } } }, cardio: { w1: { z2a: { done: true } } }, checkin: { w1: { poids: "90" } } };
  const res = migrate(input, testCtx());
  assert.equal(res.ok, true);
  assert.equal(res.from, 1);
  assert.equal(res.migrated, true);
  assert.equal(res.data.schemaVersion, SCHEMA_VERSION);
  assert.equal(res.data.activeProgramId, LEGACY_PROGRAM_ID);
  const active = res.data.programs[LEGACY_PROGRAM_ID];
  assert.deepEqual(active.definition, LEGACY_DEFINITION); // #26 : écrite en clair, plus de null résolu à la lecture
  const logs = Object.values(active.logs);
  assert.equal(logs.length, 2);
  const hautA = logs.find((l) => l.slot === "hautA");
  assert.equal(hautA.kind, "calibration"); // semaine 1
  assert.equal(hautA.done, true);
  const basA = logs.find((l) => l.slot === "basA");
  assert.equal(basA.kind, "deload"); // semaine 7
  assert.deepEqual(basA.ex, { squat: [{ w: "80", r: "5", rir: "2" }] });
  assert.deepEqual(active.cardio, input.cardio); // #16 ne touche pas cardio/checkin (#29)
  assert.deepEqual(active.checkin, input.checkin);
});

test("migrate : journal non versionné (v1 implicite) migré vers v3", () => {
  const res = migrate({ logs: { w1_hautA: { done: true } }, cardio: {}, checkin: {} }, testCtx());
  assert.equal(res.ok, true);
  assert.equal(res.from, 1);
  assert.equal(res.migrated, true);
  assert.equal(res.data.schemaVersion, SCHEMA_VERSION);
  const logs = Object.values(res.data.programs[LEGACY_PROGRAM_ID].logs);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].slot, "hautA");
  assert.equal(logs[0].date, "2026-09-07"); // startDate par défaut, semaine 1 jour 1
});

test("migrate : v1 avec logs/cardio/checkin absents => programme par défaut avec des objets vides", () => {
  const res = migrate({ schemaVersion: 1 }, testCtx());
  assert.equal(res.ok, true);
  const active = res.data.programs[LEGACY_PROGRAM_ID];
  assert.deepEqual(active.logs, {});
  assert.deepEqual(active.cardio, {});
  assert.deepEqual(active.checkin, {});
});

test("migrate : une entrée non validée (done absent) migre avec kind: null", () => {
  const res = migrate({ schemaVersion: 1, logs: { w3_hautB: { ex: {} } } }, testCtx());
  const logs = Object.values(res.data.programs[LEGACY_PROGRAM_ID].logs);
  assert.equal(logs[0].kind, null);
  assert.equal(logs[0].done, false);
});

test("migrate : clé de log non reconnue -> invalid, rien n'est détruit (#16)", () => {
  const input = { schemaVersion: 1, logs: { pas_une_cle_valide: { done: true } } };
  const res = migrate(input, testCtx());
  assert.equal(res.ok, false);
  assert.equal(res.invalid, true);
  assert.deepEqual(res.data, input);
});

test("migrate : slot absent du programme -> invalid, rien n'est détruit (#16)", () => {
  const input = { schemaVersion: 1, logs: { w1_exerciceInconnu: { done: true } } };
  const res = migrate(input, testCtx());
  assert.equal(res.ok, false);
  assert.equal(res.invalid, true);
});

test("migrate : idempotent sur un objet déjà à la version courante", () => {
  const current = migrate({ schemaVersion: 1, logs: { w1_hautA: { done: true } } }, testCtx()).data;
  const again = migrate(current, testCtx());
  assert.equal(again.migrated, false);
  assert.deepEqual(again.data, current);
});

/* #26 : `definition: null` voulait dire « le bundle courant », résolu à la
   lecture — un journal v2/v3 basculait donc avec le programme livré. v3 -> v4
   l'épingle. */
test("migrate : v3 avec definition: null épinglée sur le programme hérité (#26)", () => {
  const v3 = {
    schemaVersion: 3,
    activeProgramId: LEGACY_PROGRAM_ID,
    programs: { [LEGACY_PROGRAM_ID]: { definition: null, logs: {}, cardio: {}, checkin: {} } },
  };
  const res = migrate(v3, testCtx());
  assert.equal(res.ok, true);
  assert.equal(res.from, 3);
  assert.equal(res.migrated, true);
  assert.equal(res.data.schemaVersion, SCHEMA_VERSION);
  assert.deepEqual(res.data.programs[LEGACY_PROGRAM_ID].definition, LEGACY_DEFINITION);
});

test("migrate : v3 avec une définition chargée laissée intacte (#6, #26)", () => {
  const loaded = { id: "mon-cycle", startDate: "2026-03-02", weeks: 12 };
  const v3 = {
    schemaVersion: 3,
    activeProgramId: "mon-cycle",
    programs: { "mon-cycle": { definition: loaded, logs: {}, cardio: {}, checkin: {} } },
  };
  const res = migrate(v3, testCtx());
  assert.equal(res.ok, true);
  assert.deepEqual(res.data.programs["mon-cycle"].definition, loaded);
});

test("migrate : v1 -> v4 d'une traite, les dates viennent du programme hérité (#26)", () => {
  const res = migrate({ schemaVersion: 1, logs: { w1_hautA: { done: true } } }, testCtx());
  assert.equal(res.data.schemaVersion, SCHEMA_VERSION);
  const active = res.data.programs[LEGACY_PROGRAM_ID];
  assert.deepEqual(active.definition, LEGACY_DEFINITION);
  const logs = Object.values(active.logs);
  assert.equal(logs[0].date, "2026-09-07"); // startDate du programme hérité, S1 jour 1
});

test("migrate : version trop récente => flag de rejet, rien n'est détruit", () => {
  const input = { schemaVersion: 99, logs: { w1_hautA: { done: true } } };
  const res = migrate(input, testCtx());
  assert.equal(res.ok, false);
  assert.equal(res.tooNew, true);
  assert.equal(res.from, 99);
  assert.deepEqual(res.data, { schemaVersion: 99, logs: { w1_hautA: { done: true } } });
});

test("migrate : schemaVersion non positif => flag invalid, ne lève pas, rien n'est détruit", () => {
  for (const v of [0, -3]) {
    const input = { schemaVersion: v, logs: { w1_hautA: { done: true } } };
    const res = migrate(input, testCtx());
    assert.equal(res.ok, false);
    assert.equal(res.invalid, true);
    assert.equal(res.from, v);
    assert.deepEqual(res.data, input);
  }
});

test("migrate : n'altère pas son argument (v1 -> v3)", () => {
  const input = Object.freeze({ schemaVersion: 1, logs: Object.freeze({}), cardio: Object.freeze({}), checkin: Object.freeze({}) });
  assert.doesNotThrow(() => migrate(input, testCtx()));
});

test("applyChain : enchaîne les étapes 1 -> 2 -> 3 dans l'ordre", () => {
  const fake = {
    1: (d) => ({ ...d, schemaVersion: 2, steps: [...d.steps, 1] }),
    2: (d) => ({ ...d, schemaVersion: 3, steps: [...d.steps, 2] }),
  };
  const out = applyChain({ schemaVersion: 1, steps: [] }, 3, fake);
  assert.equal(out.schemaVersion, 3);
  assert.deepEqual(out.steps, [1, 2]);
});

test("applyChain : une étape manquante lève", () => {
  assert.throws(() => applyChain({ schemaVersion: 1 }, 2, {}), /Migration manquante depuis la v1/);
});

test("applyChain : transmet ctx tel quel à chaque étape", () => {
  const fake = { 1: (d, ctx) => ({ ...d, seen: ctx.tag }) };
  const out = applyChain({ schemaVersion: 1 }, 2, fake, { tag: "x" });
  assert.equal(out.seen, "x");
});
