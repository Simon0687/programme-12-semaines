import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { programSummaries, removeProgram } from "../src/program-list.js";

/* Trois cycles comme un journal réel en porte après quelques mois : l'actif en
   cours, un ancien terminé, et un essai que personne n'a jamais commencé. */
function journal() {
  return {
    activeProgramId: "cur",
    programs: {
      cur: {
        definition: { name: "Haut/Bas 5 jours", startDate: "2026-09-07", weeks: 12 },
        logs: {
          a: { id: "a", date: "2026-09-08", slot: "hautA", done: true, ex: { dc: [{ w: "80", r: "8" }] } },
          b: { id: "b", date: "2026-09-10", slot: "hautB", done: true, ex: {} },
          c: { id: "c", date: "2026-09-14", slot: "hautA", done: false, ex: { dc: [{ w: "82,5", r: "" }] } },
        },
        cardio: {}, checkin: {},
      },
      old: {
        definition: { name: "Haut/Bas 4 jours", startDate: "2026-06-01", weeks: 12 },
        logs: { d: { id: "d", date: "2026-06-02", slot: "push", done: true, ex: {} } },
        cardio: {}, checkin: {},
      },
      essai: {
        definition: { name: "Essai", startDate: "2026-09-20", weeks: 8 },
        logs: {}, cardio: {}, checkin: {},
      },
    },
  };
}

const byId = (rows, id) => rows.find((r) => r.id === id);

describe("programSummaries : ce qu'une ligne de cycle porte", () => {
  test("l'actif d'abord, puis du plus récemment utilisé au plus ancien", () => {
    assert.deepEqual(programSummaries(journal()).map((r) => r.id), ["cur", "old", "essai"]);
  });

  test("un cycle sans aucune séance passe après ceux qui en ont, jamais entre deux", () => {
    const j = journal();
    delete j.programs.cur.logs;
    /* L'actif reste en tête — c'est un rang, pas une date — et l'essai reste
       dernier bien que ce soit le plus récemment créé. */
    assert.deepEqual(programSummaries(j).map((r) => r.id), ["cur", "old", "essai"]);
  });

  test("`sessions` compte les séances validées, `entries` tout ce qui est écrit", () => {
    const cur = byId(programSummaries(journal()), "cur");
    assert.equal(cur.sessions, 2, "deux séances validées");
    assert.equal(cur.entries, 3, "la troisième est commencée, donc elle existe");
    assert.equal(cur.lastDate, "2026-09-10", "la dernière *validée*, pas la dernière touchée");
  });

  test("une séance supprimée ne compte pour rien", () => {
    const j = journal();
    j.programs.old.logs.d.deletedAt = "2026-09-01T10:00:00.000Z";
    const old = byId(programSummaries(j), "old");
    assert.equal(old.sessions, 0);
    assert.equal(old.entries, 0);
    assert.equal(old.lastDate, null);
    assert.equal(old.removable, true, "un cycle dont tout a été supprimé est vide");
  });

  test("le verdict d'exécutabilité vient d'ailleurs et n'est pas recalculé", () => {
    const rows = programSummaries(journal(), ["old"]);
    assert.equal(byId(rows, "old").usable, false);
    assert.equal(byId(rows, "cur").usable, true);
    assert.deepEqual(programSummaries(journal(), new Set(["essai"])).filter((r) => !r.usable).map((r) => r.id), ["essai"]);
  });

  test("sans définition, l'id fait office de nom plutôt qu'une ligne vide", () => {
    const j = journal();
    j.programs.old.definition = null;
    const old = byId(programSummaries(j), "old");
    assert.equal(old.name, "old");
    assert.equal(old.startDate, null);
  });
});

describe("removable : ce qui peut disparaître sans rien emporter", () => {
  test("l'essai qui n'a rien produit, oui", () => {
    assert.equal(byId(programSummaries(journal()), "essai").removable, true);
  });

  test("le cycle actif, jamais — il faut d'abord en activer un autre", () => {
    assert.equal(byId(programSummaries(journal()), "cur").removable, false);
  });

  test("un cycle qui porte des séances, jamais : c'est de l'histoire", () => {
    assert.equal(byId(programSummaries(journal()), "old").removable, false);
  });

  test("une saisie en cours suffit à retenir un cycle", () => {
    const j = journal();
    j.programs.essai.logs = { z: { id: "z", date: "2026-09-21", slot: "hautA", done: false, ex: { dc: [{ w: "60" }] } } };
    assert.equal(byId(programSummaries(j), "essai").removable, false);
  });

  test("un check-in ou une ligne de cardio retiennent un cycle autant qu'une séance", () => {
    const j = journal();
    j.programs.essai.checkin = { "2026-09-21": { sommeilScore: 3 } };
    assert.equal(byId(programSummaries(j), "essai").removable, false);

    const j2 = journal();
    j2.programs.essai.cardio = { "2026-09-21": { z2: { min: 30 } } };
    assert.equal(byId(programSummaries(j2), "essai").removable, false);
  });
});

describe("removeProgram : la règle tient dans la fonction, pas dans le bouton", () => {
  test("un cycle vide et inactif part, et le reste du journal ne bouge pas", () => {
    const j = journal();
    const next = removeProgram(j, "essai");
    assert.deepEqual(Object.keys(next.programs).sort(), ["cur", "old"]);
    assert.equal(next.activeProgramId, "cur");
    assert.deepEqual(Object.keys(j.programs).sort(), ["cur", "essai", "old"], "l'original n'est pas modifié");
  });

  test("refuse l'actif, refuse un cycle qui porte des séances, refuse un id inconnu", () => {
    const j = journal();
    assert.equal(removeProgram(j, "cur"), null);
    assert.equal(removeProgram(j, "old"), null);
    assert.equal(removeProgram(j, "inexistant"), null);
  });

  test("refuse le dernier cycle, même vide", () => {
    const j = { activeProgramId: "autre", programs: { seul: { definition: { name: "Seul" }, logs: {}, cardio: {}, checkin: {} } } };
    assert.equal(byId(programSummaries(j), "seul").removable, true, "il est bien vide et non actif");
    assert.equal(removeProgram(j, "seul"), null, "et pourtant il reste : un journal sans programme ne se rend pas");
  });
});
