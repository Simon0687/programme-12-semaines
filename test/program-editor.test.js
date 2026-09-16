import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  emptyProgram, emptyDraft, draftFrom, toDefinition, withNewId, uniqueId, nextMonday, isDirty,
  addSession, removeSession, moveSession, patchSession,
  addRow, removeRow, moveRow, patchRow,
  addWarm, setWarmText, renameWarm, removeWarm, addCore, setCoreLabel, removeCore,
  referencedExercises, setStartingLoad,
} from "../src/program-editor.js";
import { validateProgram, validateDefinition } from "../src/journal-shape.js";
import { LEGACY_DEFINITION } from "../src/legacy-program.js";
import bundled from "../public/programs/upper-lower-4j.json" with { type: "json" };

/* Le programme livré sert de sujet à presque tout ce qui suit : c'est le
   seul programme dont on sait qu'il est valide *et* représentatif (slots
   partagés entre blocs, drapeaux key/fail, quatre séances). Les mêmes
   octets que ceux qu'un utilisateur peut charger. */
const seed = () => draftFrom(bundled);
const valid = (draft) => assert.equal(validateProgram(draft.program), null);
const rowsOf = (draft, sid) => draft.program.SESSIONS.find((s) => s.id === sid).ex;

describe("emptyProgram / emptyDraft : un écran neuf est déjà enregistrable", () => {
  test("le programme vide passe validateProgram", () => {
    assert.equal(validateProgram(emptyProgram()), null);
  });

  test("la définition d'un brouillon neuf passe validateDefinition, une fois son id posé", () => {
    const draft = withNewId(emptyDraft(new Date(2026, 8, 16)), []);
    assert.equal(validateDefinition(toDefinition(draft)), null);
  });

  test("sans id, la définition est refusée — c'est withNewId qui décide du cycle, pas toDefinition", () => {
    const bad = validateDefinition(toDefinition(emptyDraft(new Date(2026, 8, 16))));
    assert.equal(bad.reason, "missing-field");
  });

  test("12 semaines et cardio null, sans que l'écran ait à les demander", () => {
    const def = toDefinition(withNewId(emptyDraft(new Date(2026, 8, 16)), []));
    assert.equal(def.weeks, 12);
    assert.equal(def.program.cardio, null);
  });
});

describe("nextMonday", () => {
  test("un mercredi renvoie le lundi suivant", () => {
    assert.equal(nextMonday(new Date(2026, 8, 16)), "2026-09-21");
  });

  test("un lundi se renvoie lui-même : rien n'oblige à attendre une semaine", () => {
    assert.equal(nextMonday(new Date(2026, 8, 21)), "2026-09-21");
  });

  test("un dimanche renvoie le lendemain", () => {
    assert.equal(nextMonday(new Date(2026, 8, 20)), "2026-09-21");
  });
});

describe("aller-retour : ouvrir puis enregistrer sans rien toucher", () => {
  /* Le critère d'acceptation central de #36 : l'entrée de l'éditeur est un
     objet `program`, pas un état interne. S'il fallait convertir dans les
     deux sens, c'est ici que la conversion perdrait quelque chose. */
  test("la définition rendue est identique à celle qu'on a ouverte", () => {
    assert.deepEqual(toDefinition(seed()), bundled);
  });

  test("y compris volume, fallback et cardio, que l'éditeur ne montre pas", () => {
    const { program } = toDefinition(seed());
    assert.deepEqual(program.volume, bundled.program.volume);
    assert.deepEqual(program.fallback, bundled.program.fallback);
    assert.equal(program.cardio, null);
  });

  test("le brouillon est une copie : muter le programme ouvert ne touche pas la source", () => {
    const draft = seed();
    draft.program.SESSIONS[0].name = "Changé";
    assert.equal(bundled.program.SESSIONS[0].name, "Upper A");
  });

  test("une définition d'avant #25, sans program, s'ouvre sur la structure héritée (même repli que buildProgram)", () => {
    const draft = draftFrom({ id: "vieux", startDate: "2026-01-05", startingLoads: {} });
    assert.deepEqual(draft.program, LEGACY_DEFINITION.program);
  });

  test("startingLoads et profile traversent sans être touchés", () => {
    const def = { ...bundled, startingLoads: { dc_db: 24 }, profile: { maintenanceKcal: 2600, startKcal: 2400, macros: { p: 180, f: 70, c: 250 }, targetWeightKg: [78, 80] } };
    assert.deepEqual(toDefinition(draftFrom(def)), def);
  });

  test("un programme sans profile n'en invente pas un (la clé reste absente)", () => {
    assert.equal("profile" in toDefinition(seed()), false);
  });
});

describe("isDirty : ce que le garde-fou de sortie interroge", () => {
  test("un brouillon qu'on vient d'ouvrir est propre", () => {
    assert.equal(isDirty(seed()), false);
  });

  test("ajouter une séance le salit", () => {
    assert.equal(isDirty(addSession(seed())), true);
  });

  test("changer d'id ne salit rien : ce n'est pas une modification du contenu", () => {
    assert.equal(isDirty(withNewId(seed(), ["upper-lower-4j"])), false);
  });
});

describe("identifiants : engendrés, jamais saisis", () => {
  test("uniqueId suffixe jusqu'à trouver libre", () => {
    assert.equal(uniqueId("seance", []), "seance");
    assert.equal(uniqueId("seance", ["seance"]), "seance-2");
    assert.equal(uniqueId("seance", ["seance", "seance-2", "seance-3"]), "seance-4");
  });

  test("les accents et la ponctuation tombent", () => {
    assert.equal(withNewId({ name: "Été — Haut/Bas" }, []).id, "ete-haut-bas");
  });

  test("un nom qui ne laisse aucune lettre a quand même un id", () => {
    assert.equal(withNewId({ name: "///" }, []).id, "programme");
  });

  test("deux séances ne peuvent pas partager un id, même quand leurs noms coïncident", () => {
    /* Le mode d'échec que journal-shape.js:168 refuse : findLog rend la
       première correspondance, la seconde séance devient inatteignable. */
    let d = addSession(emptyDraft(new Date(2026, 8, 16))); // "Séance 2" -> seance-2
    d = removeSession(d, "seance");
    d = addSession(d); // à nouveau "Séance 2", mais seance-2 est pris
    const ids = d.program.SESSIONS.map((s) => s.id);
    assert.deepEqual(ids, ["seance-2", "seance-2-2"]);
    valid(d);
  });

  test("renommer une séance ne touche pas son id : le nom est une étiquette, l'id une adresse", () => {
    const d = patchSession(seed(), "upperA", { name: "Haut A" });
    assert.equal(d.program.SESSIONS[0].id, "upperA");
    assert.equal(d.program.SESSIONS[0].name, "Haut A");
  });
});

describe("séances", () => {
  test("la séance ajoutée tombe le jour suivant la dernière, sans dépasser dimanche", () => {
    const d = addSession(seed()); // dernière séance : day 5
    assert.equal(d.program.SESSIONS[4].day, 6);
    assert.equal(addSession(addSession(addSession(d))).program.SESSIONS.at(-1).day, 7);
    valid(d);
  });

  test("dimanche est un jour comme un autre (day: 7)", () => {
    const d = patchSession(seed(), "upperA", { day: 7 });
    assert.equal(d.program.SESSIONS[0].day, 7);
    valid(d);
  });

  test("un jour hors bornes est ramené dans 1–7 plutôt que refusé", () => {
    assert.equal(patchSession(seed(), "upperA", { day: 0 }).program.SESSIONS[0].day, 1);
    assert.equal(patchSession(seed(), "upperA", { day: 9 }).program.SESSIONS[0].day, 7);
  });

  test("l'ordre est libre et ne se déduit pas du jour", () => {
    const d = moveSession(seed(), "lowerA", -1);
    assert.deepEqual(d.program.SESSIONS.map((s) => s.id), ["lowerA", "upperA", "upperB", "lowerB"]);
    assert.deepEqual(d.program.SESSIONS.map((s) => s.day), [2, 1, 4, 5]);
    valid(d);
  });

  test("déplacer au-delà des bornes ne fait rien", () => {
    const d = seed();
    assert.equal(moveSession(d, "upperA", -1), d);
    assert.equal(moveSession(d, "lowerB", 1), d);
  });

  test("supprimer une séance emporte les slots que plus personne ne nomme", () => {
    const d = removeSession(seed(), "lowerB");
    assert.equal("quad2" in d.program.SLOTS, false);
    assert.equal("legcurl" in d.program.SLOTS, false);
    valid(d);
  });

  test("la dernière séance ne se supprime pas : SESSIONS vide est refusé par le validateur", () => {
    const d = emptyDraft(new Date(2026, 8, 16));
    assert.equal(removeSession(d, "seance"), d);
  });

  test("patchSession ignore un échauffement ou un gainage qui n'existe pas", () => {
    const d = patchSession(seed(), "upperA", { warm: "inexistant", core: "inexistant" });
    assert.equal(d.program.SESSIONS[0].warm, "upper");
    valid(d);
  });
});

describe("lignes d'exercice", () => {
  test("une ligne neuve porte une fourchette, un repos et trois séries", () => {
    const d = addRow(seed(), { session: "upperA" }, "squat");
    const [slotId, sets] = rowsOf(d, "upperA").at(-1);
    assert.equal(sets, 3);
    assert.deepEqual(d.program.SLOTS[slotId], { reps: [8, 12], rest: 90, b1: "squat", b2: "squat" });
    valid(d);
  });

  test("le registre est fermé : un exercice inconnu ne rentre pas", () => {
    const d = seed();
    assert.equal(addRow(d, { session: "upperA" }, "developpe-magique"), d);
    assert.equal(patchRow(d, { session: "upperA" }, 0, { b1: "inconnu" }).program.SLOTS.press.b1, "dc_db");
  });

  test("les blocs de gainage se composent avec les mêmes fonctions", () => {
    const d = addRow(seed(), { core: "coreA" }, "hlr");
    assert.equal(d.program.CORE.coreA.ex.length, 2);
    valid(d);
  });

  test("supprimer une ligne emporte son slot", () => {
    const d = removeRow(seed(), { session: "upperA" }, 0);
    assert.equal("press" in d.program.SLOTS, false);
    assert.equal(rowsOf(d, "upperA").length, 3);
    valid(d);
  });

  test("déplacer une ligne réordonne la séance seule", () => {
    const d = moveRow(seed(), { session: "upperA" }, 0, 1);
    assert.deepEqual(rowsOf(d, "upperA").map(([id]) => id), ["pulldown", "press", "latraise", "triceps"]);
    valid(d);
  });

  test("les séries vivent sur la référence, pas sur le slot", () => {
    const d = patchRow(seed(), { session: "upperA" }, 0, { sets: 5 });
    assert.deepEqual(rowsOf(d, "upperA")[0], ["press", 5]);
  });

  test("zéro série n'existe pas : la valeur est ramenée à un", () => {
    assert.equal(rowsOf(patchRow(seed(), { session: "upperA" }, 0, { sets: 0 }), "upperA")[0][1], 1);
  });

  test("un drapeau remis à faux disparaît au lieu de s'écrire", () => {
    const d = patchRow(seed(), { session: "upperA" }, 2, { fail: false });
    const [slotId] = rowsOf(d, "upperA")[2];
    assert.equal("fail" in d.program.SLOTS[slotId], false);
    valid(d);
  });

  test("changer d'exercice est permis et ne change rien d'autre", () => {
    const d = patchRow(seed(), { session: "upperA" }, 0, { b1: "dc" });
    assert.equal(d.program.SLOTS.press.b1, "dc");
    assert.equal(d.program.SLOTS.press.b2, "dc_db");
    valid(d);
  });
});

describe("slot partagé : éditer une ligne ne touche que sa séance", () => {
  /* Rien n'interdit à deux séances de nommer le même slot, et l'écran
     présente pourtant une ligne comme appartenant à la sienne. Dupliquer
     est sans conséquence : aucun id de slot ne figure dans le journal. */
  const shared = () => {
    const d = seed();
    return {
      ...d,
      program: {
        ...d.program,
        SESSIONS: d.program.SESSIONS.map((s) => (s.id === "upperB" ? { ...s, ex: [["press", 3], ...s.ex] } : s)),
      },
    };
  };

  test("le slot est dupliqué avant d'être édité", () => {
    const d = patchRow(shared(), { session: "upperB" }, 0, { rest: 200 });
    const [forked] = rowsOf(d, "upperB")[0];
    assert.notEqual(forked, "press");
    assert.equal(d.program.SLOTS[forked].rest, 200);
    assert.equal(d.program.SLOTS.press.rest, 150); // l'autre séance est intacte
    assert.deepEqual(rowsOf(d, "upperA")[0], ["press", 4]);
    valid(d);
  });

  test("changer les séries ne duplique rien : elles ne vivent pas sur le slot", () => {
    const d = patchRow(shared(), { session: "upperB" }, 0, { sets: 2 });
    assert.deepEqual(rowsOf(d, "upperB")[0], ["press", 2]);
    assert.deepEqual(rowsOf(d, "upperA")[0], ["press", 4]);
  });

  test("supprimer l'une des deux lignes garde le slot pour l'autre", () => {
    const d = removeRow(shared(), { session: "upperB" }, 0);
    assert.equal("press" in d.program.SLOTS, true);
    valid(d);
  });
});

describe("échauffements et gainage", () => {
  test("renommer un échauffement suit les séances qui le nomment", () => {
    const d = renameWarm(seed(), "upper", "Haut du corps");
    assert.equal("haut-du-corps" in d.program.WARM, true);
    assert.equal("upper" in d.program.WARM, false);
    assert.deepEqual(d.program.SESSIONS.map((s) => s.warm), ["haut-du-corps", "lower", "haut-du-corps", "lower"]);
    valid(d);
  });

  test("renommer conserve l'ordre d'affichage des blocs", () => {
    const d = renameWarm(seed(), "upper", "Haut");
    assert.deepEqual(Object.keys(d.program.WARM), ["haut", "lower"]);
  });

  test("un bloc encore nommé par une séance ne se supprime pas", () => {
    const d = seed();
    assert.equal(removeWarm(d, "upper"), d);
    assert.equal(removeCore(d, "coreA"), d);
  });

  test("un bloc que plus personne ne nomme s'en va, et emporte ses slots", () => {
    let d = addWarm(seed(), "Mobilité");
    assert.equal("mobilite" in d.program.WARM, true);
    d = removeWarm(d, "mobilite");
    assert.equal("mobilite" in d.program.WARM, false);

    d = patchSession(seed(), "upperA", { core: "coreA" });
    d = patchSession(d, "upperB", { core: "coreA" });
    d = removeCore(d, "coreB");
    assert.equal("pallof" in d.program.SLOTS, false);
    valid(d);
  });

  test("le texte et le libellé se modifient sans toucher aux clés", () => {
    const d = setCoreLabel(setWarmText(seed(), "upper", "Deux minutes de rameur."), "coreA", "Abdos");
    assert.equal(d.program.WARM.upper, "Deux minutes de rameur.");
    assert.equal(d.program.CORE.coreA.label, "Abdos");
    valid(d);
  });

  test("ajouter une séance à un programme sans bloc lui en crée un plutôt qu'une référence pendante", () => {
    const bare = { ...seed(), program: { ...seed().program, SESSIONS: [], WARM: {}, CORE: {} } };
    const d = addSession(bare);
    assert.equal(validateProgram(d.program), null);
  });
});

describe("charges de départ", () => {
  test("chaque exercice nommé par le programme apparaît une fois, dans l'ordre des séances", () => {
    const ids = referencedExercises(bundled.program);
    assert.equal(ids[0], "dc_db");
    assert.equal(new Set(ids).size, ids.length);
    /* lat_cable et lat_db sont les deux blocs d'un même slot : les deux
       comptent, puisque les deux se chargent. */
    assert.ok(ids.includes("lat_cable") && ids.includes("lat_db"));
  });

  test("un exercice tenu par b1 et b2 n'est listé qu'une fois", () => {
    assert.equal(referencedExercises(bundled.program).filter((id) => id === "dc_db").length, 1);
  });

  test("une charge saisie atterrit sous l'id d'exercice et survit à toDefinition", () => {
    const d = setStartingLoad(seed(), "dc_db", 24);
    assert.equal(toDefinition(d).startingLoads.dc_db, 24);
  });

  test("zéro est une valeur, pas une case vide : c'est le poids du corps aux tractions", () => {
    const d = setStartingLoad(seed(), "pullup", 0);
    assert.equal(d.startingLoads.pullup, 0);
  });

  test("un champ vidé retire la clé — la semaine 1 de calibration reprend la main", () => {
    let d = setStartingLoad(seed(), "dc_db", 24);
    d = setStartingLoad(d, "dc_db", NaN);
    assert.equal("dc_db" in d.startingLoads, false);
    assert.equal(validateDefinition(toDefinition(withNewId(d, []))), null);
  });

  test("un exercice hors registre ne peut pas porter de charge", () => {
    const d = seed();
    assert.equal(setStartingLoad(d, "inconnu", 50), d);
  });
});

describe("toute mutation laisse un programme que le validateur accepte", () => {
  const steps = [
    ["addSession", (d) => addSession(d)],
    ["removeSession", (d) => removeSession(d, "upperB")],
    ["moveSession", (d) => moveSession(d, "lowerB", -1)],
    ["patchSession", (d) => patchSession(d, "upperA", { name: "", sub: "", day: 3 })],
    ["addRow", (d) => addRow(d, { session: "lowerA" }, "carry")],
    ["removeRow", (d) => removeRow(d, { session: "lowerA" }, 0)],
    ["moveRow", (d) => moveRow(d, { session: "upperB" }, 2, -1)],
    ["patchRow", (d) => patchRow(d, { session: "upperA" }, 1, { reps: [3, 5], rest: 240, key: true, sets: 6 })],
    ["addWarm", (d) => addWarm(d, "Mobilité")],
    ["addCore", (d) => addCore(d, "Anti-flexion")],
    ["setStartingLoad", (d) => setStartingLoad(d, "hack", 80)],
  ];

  for (const [name, step] of steps) {
    test(name, () => {
      const d = step(seed());
      assert.equal(validateProgram(d.program), null);
      assert.equal(validateDefinition(toDefinition(withNewId(d, ["upper-lower-4j"]))), null);
    });
  }

  test("les onze enchaînées, sur le même brouillon", () => {
    const d = steps.reduce((acc, [, step]) => step(acc), seed());
    assert.equal(validateProgram(d.program), null);
    assert.equal(validateDefinition(toDefinition(withNewId(d, ["upper-lower-4j"]))), null);
  });
});
