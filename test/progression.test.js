import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildProgram } from "../src/program.js";
import { LEGACY_DEFINITION } from "../src/legacy-program.js";
import { planned, history, lastEntry, lastEntryLabel, computeKind, workingSets, loadDrops, normalizeSets, setsOf, historyBefore } from "../src/progression.js";
import { dateForSlot } from "../src/schema.js";

/* Pins the behaviour of planned() as it shipped in 1.0.0. #3-#6 have long
   since moved the program data out, #16 re-keyed the journal by date, #31
   changed which load the verdict is pronounced on and #23 pulled the shared
   readers out of the duplicated copies - and every expected value below has
   survived all four unchanged, which is the point of the file. They are the
   current output of the code, not an independent recalculation: a drift is a
   regression to investigate, not a test to "fix". Q2/Q3/Q5 are
   pinned as-is per docs/features/2-tests-progression-logic/spec.md.
   The RIR<=1 gate on the top-of-range branch, originally pinned here, was
   superseded by #28: reaching the top of the range now increases the load
   on its own, RIR is informative only.

   #16: the engine reads date+kind instead of a week-keyed log. Fixtures
   still take a "week" (it's the natural way to describe a fixture) but S()
   turns it into the same date/kind a real validation would have produced
   (dateForSlot/computeKind, #16) - so every expected value below stays
   exactly what it was before the migration to a dated timeline. */

/* #26 : la fixture nomme le programme hérité au lieu de lire le bundle. Toutes
   les valeurs attendues de ce fichier ont été figées contre ce programme-là ;
   les faire dépendre de « le défaut » les ferait basculer avec lui. */
const prog = buildProgram(LEGACY_DEFINITION);
const START = "2026-01-05"; // lundi, arbitraire - seule la cohérence interne à ce fichier compte

/* ---- fixtures -------------------------------------------------------- */

const si = (sid) => prog.SESSIONS.findIndex((s) => s.id === sid);
const dateOf = (week, sid) => dateForSlot(START, week, prog.SESSIONS[si(sid)].day);
const set = (w, r, rir) => ({ w, r, rir });

// One validated session log per entry: { week, sid, vid, sets }.
// sets are stored the way the app stores them: [{ w, r, rir }, ...].
const S = (...entries) => ({
  logs: Object.fromEntries(
    entries.map(({ week, sid, vid, sets }) => {
      const date = dateOf(week, sid);
      return [`${date}_${sid}`, { id: `${date}_${sid}`, date, slot: sid, kind: computeKind(week), done: true, ex: { [vid]: sets } }];
    })
  ),
  cardio: {},
  checkin: {},
});

/* ---- no history --------------------------------------------------- */

describe("no history", () => {
  test("variant with a starting load: week 1 suggests it", () => {
    const p = planned(prog, S(), "dc", 1, si("hautA"), dateOf(1, "hautA"));
    assert.equal(p.load, prog.V.dc.start); // 72.5
    assert.equal(p.text, "72,5 kg");
    assert.equal(p.why, "charge de départ");
  });

  test("variant with no starting load: ramp-up (Paliers)", () => {
    const p = planned(prog, S(), "reardelt", 1, si("hautA"), dateOf(1, "hautA")); // b1 = rpd, no start
    assert.equal(p.load, null);
    assert.equal(p.text, "Paliers");
  });

  test("time variant: null load, target text at the phase RIR", () => {
    const p = planned(prog, S(), "sideplank", 1, si("basA"), dateOf(1, "basA"));
    assert.equal(p.load, null);
    assert.equal(p.text, "Cible 20–40 s à 2–3 RIR");
  });

  test("reps variant: null load, target text", () => {
    const p = planned(prog, S(), "abwheel", 1, si("hautB"), dateOf(1, "hautB"));
    assert.equal(p.load, null);
    assert.equal(p.text, "Cible 6–10 reps à 2–3 RIR");
  });

  test("nothing throws for a bare state", () => {
    assert.doesNotThrow(() => planned(prog, S(), "dc", 1, si("hautA"), dateOf(1, "hautA")));
    assert.doesNotThrow(() => planned(prog, S(), "squat", 7, si("basA"), dateOf(7, "basA")));
    assert.doesNotThrow(() => planned(prog, S(), "carry", 1, si("hautB"), dateOf(1, "hautB")));
  });
});

/* ---- calibration (reference week 1 or 7) -------------------------- */

describe("calibration", () => {
  const wk1 = (...sets) => S({ week: 1, sid: "hautA", vid: "dc", sets });

  test("all sets at the top of the range: +5%, snapped to incr", () => {
    const p = planned(prog, wk1(set(72.5, 8, 3), set(72.5, 8, 3), set(72.5, 8, 3)), "dc", 2, si("hautA"), dateOf(2, "hautA"));
    assert.equal(p.load, 75); // roundTo(72.5 * 1.05, 2.5)
    assert.equal(p.load % prog.V.dc.incr, 0);
    assert.equal(p.why, "calibration : +5 %");
  });

  test("all sets at the top of the range at a low RIR: +5% fires too (#28)", () => {
    const p = planned(prog, wk1(set(80, 8, 1), set(80, 8, 1), set(80, 8, 1)), "dc", 2, si("hautA"), dateOf(2, "hautA"));
    assert.equal(p.load, 85); // roundTo(80 * 1.05, 2.5)
    assert.equal(p.why, "calibration : +5 %");
  });

  test("one set below the bottom of the range: -5%", () => {
    const p = planned(prog, wk1(set(72.5, 3, 2), set(72.5, 6, 2), set(72.5, 6, 2)), "dc", 2, si("hautA"), dateOf(2, "hautA"));
    assert.equal(p.load, 70); // roundTo(72.5 * 0.95, 2.5)
    assert.equal(p.why, "calibration : −5 %");
  });

  test("in range but not maxed: load held", () => {
    const p = planned(prog, wk1(set(72.5, 6, 2), set(72.5, 6, 2), set(72.5, 6, 2)), "dc", 2, si("hautA"), dateOf(2, "hautA"));
    assert.equal(p.load, 72.5);
    assert.equal(p.why, "charge validée en calibration");
  });
});

/* ---- progression (reference week not 1/7) ------------------------ */

describe("progression", () => {
  test("all sets maxed at <= 1 RIR: + the variant increment, not %-rounded", () => {
    const p = planned(
      prog,
      S({ week: 2, sid: "hautA", vid: "dc", sets: [set(75, 8, 1), set(75, 8, 1), set(75, 8, 1)] }),
      "dc", 3, si("hautA"), dateOf(3, "hautA")
    );
    assert.equal(p.load, 75 + prog.V.dc.incr); // 77.5, exact
    assert.match(p.why, /^\+2,5 kg/);
  });

  test("lower-body increment (squat, +5 kg)", () => {
    const p = planned(
      prog,
      S({ week: 2, sid: "basA", vid: "squat", sets: [set(105, 8, 1), set(105, 8, 1), set(105, 8, 1)] }),
      "squat", 3, si("basA"), dateOf(3, "basA")
    );
    assert.equal(p.load, 105 + prog.V.squat.incr); // 110
  });
});

/* ---- stalling --------------------------------------------------- */

describe("stalling", () => {
  test("two sets below the range once: load held", () => {
    const p = planned(
      prog,
      S({ week: 3, sid: "hautA", vid: "dc", sets: [set(80, 3, 1), set(80, 3, 1), set(80, 6, 1)] }),
      "dc", 4, si("hautA"), dateOf(4, "hautA")
    );
    assert.equal(p.load, 80);
    assert.equal(p.why, "même charge : une séance sous la fourchette, on retente");
  });

  test("two sessions in a row below the range: -5%", () => {
    const p = planned(
      prog,
      S(
        { week: 3, sid: "hautA", vid: "dc", sets: [set(80, 3, 1), set(80, 3, 1), set(80, 6, 1)] },
        { week: 4, sid: "hautA", vid: "dc", sets: [set(80, 2, 1), set(80, 2, 1), set(80, 5, 1)] }
      ),
      "dc", 5, si("hautA"), dateOf(5, "hautA")
    );
    assert.equal(p.load, 75); // roundTo(80 * 0.95, 2.5)
    assert.equal(p.why, "−5 % : deux séances sous la fourchette");
  });
});

/* ---- week 7 deload -------------------------------------------- */

describe("week 7 deload", () => {
  test("cut is applied to the already-computed next load, then rounded (Q2, pinned)", () => {
    const p = planned(
      prog,
      S({ week: 6, sid: "hautA", vid: "dc", sets: [set(100, 8, 1), set(100, 8, 1), set(100, 8, 1)] }),
      "dc", 7, si("hautA"), dateOf(7, "hautA")
    );
    // week 6 was due +2.5 -> next 102.5 -> roundTo(102.5 * 0.85, 2.5) = 87.5
    assert.equal(p.load, 87.5);
    assert.equal(p.why, "décharge −15 %");
  });

  test("week 8 resumes from the pre-deload session, not the deload load", () => {
    const p = planned(
      prog,
      S(
        { week: 6, sid: "hautA", vid: "dc", sets: [set(100, 8, 1), set(100, 8, 1), set(100, 8, 1)] },
        { week: 7, sid: "hautA", vid: "dc", sets: [set(85, 8, 4), set(85, 8, 4), set(85, 8, 4)] }
      ),
      "dc", 8, si("hautA"), dateOf(8, "hautA")
    );
    assert.equal(p.load, 100 + prog.V.dc.incr); // 102.5, from week 6
    assert.notEqual(p.load, 85 + prog.V.dc.incr); // not from the week-7 deload load
    assert.match(p.why, /^\+2,5 kg/);
  });
});

/* ---- block-2 variant introduced in week 7 ------------------- */

describe("new block-2 variant in week 7", () => {
  test("week 7: no prior history, shows the ramp-up branch", () => {
    const p = planned(prog, S(), "tristretch", 7, si("hautA"), dateOf(7, "hautA")); // b2 = skull, no start
    assert.equal(p.load, null);
    assert.equal(p.text, "Paliers");
  });

  test("week 8: the week-7 entry is treated as calibration, not progression", () => {
    const p = planned(
      prog,
      S({ week: 7, sid: "hautA", vid: "skull", sets: [set(20, 12, 4), set(20, 12, 4)] }),
      "tristretch", 8, si("hautA"), dateOf(8, "hautA")
    );
    assert.equal(p.why, "calibration : +5 %"); // calibration branch, because base.kind === "deload"
    assert.equal(p.load, 22); // roundTo(20 * 1.05, 2)
  });
});

/* ---- same variant twice in one week ---------------------- */

describe("same variant twice in one week", () => {
  test("the second session accounts for the first (e.si < si)", () => {
    const st = S({ week: 5, sid: "hautA", vid: "lat_db", sets: [set(14, 12, 1), set(14, 12, 1)] });
    const first = planned(prog, st, "latraise", 5, si("hautA"), dateOf(5, "hautA")); // si 0: does not see itself
    const second = planned(prog, st, "latraise", 5, si("hautC"), dateOf(5, "hautC")); // si 3: sees Haut A
    assert.equal(first.text, "Paliers"); // no history yet
    assert.equal(second.load, 14 + prog.V.lat_db.incr); // 16, progressed off Haut A
  });
});

/* ---- bodyweight -> added load -------------------------- */

describe("pull-ups (unit bw)", () => {
  test("no added load reads as bodyweight", () => {
    const p = planned(prog, S(), "pull", 1, si("hautB"), dateOf(1, "hautB"));
    assert.equal(p.load, 0);
    assert.equal(p.text, "Poids du corps");
  });

  test("maxed at <= 1 RIR at bodyweight: suggestion becomes bodyweight + increment", () => {
    const p = planned(
      prog,
      S({ week: 2, sid: "hautB", vid: "pullup", sets: [set(0, 8, 1), set(0, 8, 1), set(0, 8, 1)] }),
      "pull", 3, si("hautB"), dateOf(3, "hautB")
    );
    assert.equal(p.load, 0 + prog.V.pullup.incr); // 2.5
    assert.equal(p.text, "PDC + 2,5 kg");
  });
});

/* ---- time-based progression --------------------------- */

describe("time-based variant (sideplank)", () => {
  test("all sets at the top of the range: null load, duration reason", () => {
    const p = planned(
      prog,
      S({ week: 1, sid: "basA", vid: "sideplank", sets: [set(null, 40, 2), set(null, 40, 2)] }),
      "sideplank", 2, si("basA"), dateOf(2, "basA")
    );
    assert.equal(p.load, null);
    assert.match(p.why, /\+5 s/);
  });

  test("below the top of the range: aim higher", () => {
    const p = planned(
      prog,
      S({ week: 1, sid: "basA", vid: "sideplank", sets: [set(null, 30, 2), set(null, 30, 2)] }),
      "sideplank", 2, si("basA"), dateOf(2, "basA")
    );
    assert.equal(p.load, null);
    assert.match(p.why, /viser le haut de la fourchette/);
  });
});

/* ---- edge cases (spec) -------------------------------- */

describe("edge cases", () => {
  test("a blank RIR no longer blocks the +increment branch: informative only (#28)", () => {
    const p = planned(
      prog,
      S({ week: 2, sid: "hautA", vid: "dc", sets: [set(75, 8, 1), set(75, 8, null), set(75, 8, 1)] }),
      "dc", 3, si("hautA"), dateOf(3, "hautA")
    );
    assert.equal(p.load, 75 + prog.V.dc.incr);
    assert.equal(p.why, "+2,5 kg : haut de fourchette atteint");
  });

  test("maxed at a high RIR still fires the increase (#28)", () => {
    const p = planned(
      prog,
      S({ week: 2, sid: "hautA", vid: "dc", sets: [set(75, 8, 4), set(75, 8, 4), set(75, 8, 4)] }),
      "dc", 3, si("hautA"), dateOf(3, "hautA")
    );
    assert.equal(p.load, 75 + prog.V.dc.incr);
    assert.equal(p.why, "+2,5 kg : haut de fourchette atteint");
  });

  test("carry is progressed as a load, not as a time exercise (Q3, pinned)", () => {
    const p = planned(
      prog,
      S({ week: 2, sid: "hautB", vid: "carry", sets: [set(24, 45, 1), set(24, 45, 1)] }),
      "carry", 3, si("hautB"), dateOf(3, "hautB")
    );
    assert.equal(p.load, 24 + prog.V.carry.incr); // 26 kg
  });

  test("range boundaries: a set exactly at mn is not 'below', exactly at mx is 'top' (Q5)", () => {
    const [mn, mx] = prog.SLOTS.dc.reps; // [4, 8]
    // every set exactly at mx, <= 1 RIR -> progression fires
    const top = planned(
      prog,
      S({ week: 2, sid: "hautA", vid: "dc", sets: [set(75, mx, 1), set(75, mx, 1)] }),
      "dc", 3, si("hautA"), dateOf(3, "hautA")
    );
    assert.equal(top.load, 75 + prog.V.dc.incr);
    // two sets exactly at mn -> not counted as below -> held, not cut
    const atFloor = planned(
      prog,
      S({ week: 3, sid: "hautA", vid: "dc", sets: [set(80, mn, 1), set(80, mn, 1), set(80, 6, 1)] }),
      "dc", 4, si("hautA"), dateOf(4, "hautA")
    );
    assert.equal(atFloor.load, 80);
    assert.equal(atFloor.why, "même charge : viser plus de reps");
  });
});

/* ---- supporting readers ------------------------------ */

describe("history / lastEntry", () => {
  test("history returns validated sets in chronological order", () => {
    const h = history(
      prog,
      S(
        { week: 3, sid: "hautC", vid: "lat_db", sets: [set(12, 12, 1)] },
        { week: 2, sid: "hautA", vid: "lat_db", sets: [set(10, 12, 1)] }
      ),
      "lat_db"
    );
    assert.deepEqual(h.map((e) => e.date), [dateOf(2, "hautA"), dateOf(3, "hautC")]);
  });

  test("lastEntry ignores the current session and later ones", () => {
    const st = S(
      { week: 2, sid: "hautA", vid: "lat_db", sets: [set(10, 12, 1)] },
      { week: 4, sid: "hautA", vid: "lat_db", sets: [set(14, 12, 1)] }
    );
    const entry = lastEntry(prog, st, "lat_db", dateOf(4, "hautA"), si("hautA"));
    assert.equal(entry.date, dateOf(2, "hautA"));
  });
});

/* #30 : la régression avait pu être livrée parce que rien ne couvrait le chemin
   entre lastEntry() et le texte affiché — history() a cessé de renvoyer `week`
   avec #16, et « S{last.week} » a silencieusement rendu « Sundefined ». Les
   deux derniers tests ferment ce chemin. */
describe("lastEntryLabel (#30)", () => {
  test("formate la date réelle et le nom de la séance", () => {
    assert.equal(lastEntryLabel({ date: "2026-09-23", session: "Haut B" }), "23 sept., Haut B");
  });

  test("jour sur un chiffre : pas de zéro de tête", () => {
    assert.equal(lastEntryLabel({ date: "2026-01-05", session: "Haut A" }), "5 janv., Haut A");
  });

  test("de lastEntry() au texte affiché : aucun champ manquant", () => {
    const st = S(
      { week: 2, sid: "hautA", vid: "lat_db", sets: [set(10, 12, 1)] },
      { week: 4, sid: "hautA", vid: "lat_db", sets: [set(14, 12, 1)] }
    );
    const entry = lastEntry(prog, st, "lat_db", dateOf(4, "hautA"), si("hautA"));
    assert.equal(lastEntryLabel(entry), "12 janv., Haut A");
  });

  test("aucune sortie de history() ne produit « undefined » dans le libellé", () => {
    const st = S(
      { week: 1, sid: "hautA", vid: "lat_db", sets: [set(10, 12, 2)] },
      { week: 3, sid: "hautC", vid: "lat_db", sets: [set(12, 12, 1)] },
      { week: 7, sid: "hautA", vid: "lat_db", sets: [set(9, 12, 3)] }
    );
    for (const entry of history(prog, st, "lat_db")) {
      assert.doesNotMatch(lastEntryLabel(entry), /undefined|NaN/);
    }
  });
});

/* ---- la charge de travail d'une séance (#31) ------------------------ */

describe("workingSets", () => {
  const s = (w, r) => ({ w, r, rir: null });
  const load = (sets, mn, mx) => workingSets(sets, mn, mx).load;

  test("la charge la plus lourde ayant atteint le haut de la fourchette", () => {
    /* Le cas qui a tranché la règle : 4 reps à 120 sont dans la fourchette 4–8,
       mais au ras du contrat. C'est le 8 à 100 qui est une série de travail, donc
       la suggestion partira de 100 et non de 120. */
    assert.equal(load([s(100, 8), s(120, 4)], 4, 8), 100);
    /* Et le jour où 120 est tenu au haut de la fourchette, il est adopté. */
    assert.equal(load([s(120, 8), s(120, 8), s(120, 8)], 4, 8), 120);
  });

  test("la plus lourde, pas celle qui a le plus de reps", () => {
    assert.equal(load([s(100, 7), s(105, 7), s(90, 8)], 4, 8), 105);
  });

  test("une charge qui a raté le bas de la fourchette n'est jamais retenue", () => {
    assert.equal(load([s(110, 5), s(110, 5), s(120, 3)], 4, 8), 110);
  });

  test("si aucune n'atteint le haut, la plus légère tentée", () => {
    assert.equal(load([s(120, 3), s(130, 2)], 4, 8), 120, "tout sous la fourchette");
    assert.equal(load([s(100, 4), s(110, 5)], 4, 8), 100, "dans la fourchette mais sous le haut");
  });

  test("le seuil suit la fourchette du créneau, il n'est pas codé en dur", () => {
    /* En 8–12 le haut commence à 10, donc 9 reps ne valident pas la charge. */
    assert.equal(load([s(20, 12), s(25, 9)], 8, 12), 20);
    assert.equal(load([s(20, 12), s(25, 10)], 8, 12), 25);
    /* Le seuil n'est pas arrondi : en 30–45 il vaut 37,5, donc 37 ne passe pas. */
    assert.equal(load([s(24, 40), s(28, 37)], 30, 45), 24);
    assert.equal(load([s(24, 40), s(28, 38)], 30, 45), 28);
  });

  test("une séance uniforme rend sa charge quelles que soient les reps", () => {
    /* La garantie qui fait passer les 32 tests existants sans les toucher : un
       seul groupe, que les deux clauses sélectionnent. */
    for (const reps of [[8, 8, 8], [6, 6, 6], [3, 6, 6], [2, 2, 2]]) {
      const sets = reps.map((r) => s(72.5, r));
      assert.equal(load(sets, 4, 8), 72.5, `reps ${reps.join("/")}`);
      assert.equal(workingSets(sets, 4, 8).sets.length, 3, "et toutes ses séries");
    }
  });

  test("rend les séries de la charge retenue, pas celles de la séance", () => {
    const w = workingSets([s(100, 8), s(100, 6), s(120, 4)], 4, 8);
    assert.deepEqual(w.sets.map((x) => x.r), [8, 6]);
  });

  test("mixed dit si la séance portait plusieurs charges", () => {
    assert.equal(workingSets([s(100, 8), s(120, 4)], 4, 8).mixed, true);
    assert.equal(workingSets([s(100, 8), s(100, 4)], 4, 8).mixed, false);
  });

  test("au poids du corps, zéro est une charge et non une absence", () => {
    /* PDC et PDC+10 sont deux charges distinctes ; une série sans charge saisie
       rejoint le groupe zéro, comme planned() l'a toujours lue. */
    assert.equal(load([s(0, 8), s(10, 6)], 4, 8), 10);
    assert.equal(load([s(null, 8), s(0, 6)], 4, 8), 0);
    assert.equal(workingSets([s(null, 8), s(0, 6)], 4, 8).mixed, false, "null et 0 sont le même groupe");
  });
});

/* ---- charges mixtes dans une même séance (#31) ----------------------- */

describe("mixed loads in one session", () => {
  /* dc : fourchette 4–8, incrément 2,5 kg. Le haut de la fourchette commence
     donc à 6. Les verdicts attendus sont ceux de docs/features/
     31-working-load-not-heaviest-set/spec.md, Acceptance criteria. */

  test("un essai lourd au ras de la fourchette n'est pas adopté", () => {
    /* 4 reps à 120 sont dans la fourchette 4–8, mais c'est le 8 à 100 qui est la
       série de travail : on repart de 100 et on ajoute l'incrément. Avant #31,
       Math.max élisait 120 et la séance suivante était prescrite à 120. */
    const p = planned(
      prog,
      S({ week: 2, sid: "hautA", vid: "dc", sets: [set(100, 8, 1), set(120, 4, 0)] }),
      "dc", 3, si("hautA"), dateOf(3, "hautA")
    );
    assert.equal(p.load, 102.5);
    assert.match(p.why, /^\+2,5 kg/);
  });

  test("la charge lourde est adoptée dès qu'elle est tenue au haut de la fourchette", () => {
    const p = planned(
      prog,
      S(
        { week: 2, sid: "hautA", vid: "dc", sets: [set(100, 8, 1), set(120, 4, 0)] },
        { week: 3, sid: "hautA", vid: "dc", sets: [set(120, 8, 1), set(120, 8, 1), set(120, 8, 1)] }
      ),
      "dc", 4, si("hautA"), dateOf(4, "hautA")
    );
    assert.equal(p.load, 122.5, "méritée, pas supposée");
  });

  test("une charge qui a raté le bas de la fourchette ne devient pas la prescription", () => {
    /* Avant #31 : load = 120, lowCount = 1 donc aucune réduction, et l'appli
       demandait « viser plus de reps » à une charge qui venait d'en donner 3. */
    const p = planned(
      prog,
      S({ week: 2, sid: "hautA", vid: "dc", sets: [set(110, 5, 1), set(110, 5, 1), set(120, 3, 0)] }),
      "dc", 3, si("hautA"), dateOf(3, "hautA")
    );
    assert.equal(p.load, 110);
    assert.match(p.why, /^même charge : viser plus de reps/);
  });

  test("en calibration, le verdict porte sur la plus lourde ayant atteint le haut", () => {
    /* Le 8 reps a été fait à 90 : il ne valide pas 105. 105 a tenu 7 reps, dans
       la fourchette sans en atteindre le haut, donc la charge est validée telle
       quelle — le nombre que l'appli affichait déjà, pour une raison qui tient. */
    const p = planned(
      prog,
      S({ week: 1, sid: "hautA", vid: "dc", sets: [set(100, 7, 2), set(105, 7, 2), set(90, 8, 2)] }),
      "dc", 2, si("hautA"), dateOf(2, "hautA")
    );
    assert.equal(p.load, 105);
    assert.match(p.why, /^charge validée en calibration/);
  });

  test("quand rien n'a tenu la fourchette, la suggestion n'est jamais plus lourde que la plus légère tentée", () => {
    const p = planned(
      prog,
      S({ week: 1, sid: "hautA", vid: "dc", sets: [set(120, 3, 0), set(130, 2, 0)] }),
      "dc", 2, si("hautA"), dateOf(2, "hautA")
    );
    assert.ok(p.load <= 120, `${p.load} devrait être au plus 120`);
    assert.match(p.why, /^calibration : −5 %/);
  });

  test("une décharge lue comme base passe par la même règle", () => {
    /* base.kind === "deload" emprunte la branche calibration ; la charge jugée
       doit être celle de la règle, pas le maximum de la séance. */
    const p = planned(
      prog,
      S({ week: 7, sid: "hautA", vid: "dc", sets: [set(85, 8, 4), set(95, 4, 2)] }),
      "dc", 8, si("hautA"), dateOf(8, "hautA")
    );
    assert.equal(p.load, 90, "roundTo(85 * 1,05 ; 2,5) — jugé sur 85, pas sur 95");
  });
});
test("deux séances basses d'affilée réduisent, même quand la première portait un retour au calme", () => {
  /* La séance d'avant a tenu 6 reps à 100 puis en a manqué deux, et s'est
     terminée par 8 reps à 80. Sa charge de travail reste 100 — la plus lourde
     ayant atteint le haut de la fourchette — et elle y a bien deux séries
     basses. La série légère de fin ne met pas la séance à l'abri de la
     réduction. */
  const p = planned(
    prog,
    S(
      { week: 2, sid: "hautA", vid: "dc", sets: [set(100, 6, 1), set(100, 3, 0), set(100, 3, 0), set(80, 8, 1)] },
      { week: 3, sid: "hautA", vid: "dc", sets: [set(100, 3, 0), set(100, 3, 0), set(100, 6, 1)] }
    ),
    "dc", 4, si("hautA"), dateOf(4, "hautA")
  );
  assert.equal(p.load, 95, "roundTo(100 * 0,95 ; 2,5)");
  assert.match(p.why, /^−5 % : deux séances sous la fourchette/);
});

test("une séance d'avant dont seules les séries légères étaient basses ne compte pas comme basse", () => {
  /* La charge de travail de la séance d'avant est 100 (6 reps, au haut de la
     fourchette) ; ses deux séries basses ont été faites à 70, après coup. Elle
     n'est donc pas une séance sous la fourchette, et la réduction n'a pas lieu
     d'être — ce que l'ancien décompte, aveugle à la charge, aurait déclenché. */
  const p = planned(
    prog,
    S(
      { week: 2, sid: "hautA", vid: "dc", sets: [set(100, 6, 1), set(70, 3, 0), set(70, 3, 0)] },
      { week: 3, sid: "hautA", vid: "dc", sets: [set(100, 3, 0), set(100, 3, 0), set(100, 6, 1)] }
    ),
    "dc", 4, si("hautA"), dateOf(4, "hautA")
  );
  assert.equal(p.load, 100, "charge tenue");
  assert.match(p.why, /^même charge : une séance sous la fourchette, on retente/);
});

test("why nomme la charge jugée quand la séance en portait plusieurs", () => {
  const mixed = planned(
    prog,
    S({ week: 2, sid: "hautA", vid: "dc", sets: [set(110, 5, 1), set(110, 5, 1), set(120, 3, 0)] }),
    "dc", 3, si("hautA"), dateOf(3, "hautA")
  );
  assert.equal(mixed.why, "même charge : viser plus de reps (jugé sur 110 kg)");

  /* Sur une séance uniforme, la chaîne reste celle d'avant #31 au caractère
     près : c'est ce que les 32 tests épinglés exigent. */
  const uniform = planned(
    prog,
    S({ week: 2, sid: "hautA", vid: "dc", sets: [set(110, 5, 1), set(110, 5, 1)] }),
    "dc", 3, si("hautA"), dateOf(3, "hautA")
  );
  assert.equal(uniform.why, "même charge : viser plus de reps");
});

test("la mention survit à la coupe de décharge", () => {
  const p = planned(
    prog,
    S({ week: 6, sid: "hautA", vid: "dc", sets: [set(100, 8, 1), set(120, 4, 0)] }),
    "dc", 7, si("hautA"), dateOf(7, "hautA")
  );
  assert.match(p.why, /^décharge −15 % \(jugé sur 100 kg\)$/);
});

test("au poids du corps, la mention parle en lest", () => {
  /* Fourchette 4–8, donc le haut commence à 6. Le lest tenu 6 reps est la charge
     de travail, et la mention le dit dans le vocabulaire de loadText. */
  const leste = planned(
    prog,
    S({ week: 2, sid: "hautB", vid: "pullup", sets: [set(0, 10, 1), set(5, 6, 0)] }),
    "pull", 3, si("hautB"), dateOf(3, "hautB")
  );
  assert.match(leste.why, /\(jugé sur PDC \+ 5 kg\)$/);

  /* Le même lest manqué à 3 reps ne vaut pas charge de travail : c'est le poids
     du corps nu qui est jugé, et zéro se dit « Poids du corps », pas « 0 kg ». */
  const nu = planned(
    prog,
    S({ week: 2, sid: "hautB", vid: "pullup", sets: [set(0, 10, 1), set(5, 3, 0)] }),
    "pull", 3, si("hautB"), dateOf(3, "hautB")
  );
  assert.match(nu.why, /\(jugé sur Poids du corps\)$/);
});

/* ---- séance allégée (#43) -------------------------------------------- */

describe("séance allégée", () => {
  const wk = (week, sets, kind) => ({ week, sid: "hautA", vid: "dc", sets, kind });

  test("une base allégée n'est jamais lue : on repart de la séance d'avant", () => {
    /* Le cas qui motive #43. Sans le saut, 8 reps à 80 kg deviennent la
       référence et il faut neuf séances à +2,5 pour revenir à 102,5. */
    const p = planned(
      prog,
      S(
        { week: 2, sid: "hautA", vid: "dc", sets: [set(100, 8, 1), set(100, 8, 1), set(100, 8, 1)] },
        { week: 3, sid: "hautA", vid: "dc", sets: [set(80, 8, 3), set(80, 8, 3), set(80, 8, 3)] }
      ),
      "dc", 4, si("hautA"), dateOf(4, "hautA")
    );
    assert.equal(p.load, 82.5, "sans marquage, la séance légère fait référence");

    const st = S(
      { week: 2, sid: "hautA", vid: "dc", sets: [set(100, 8, 1), set(100, 8, 1), set(100, 8, 1)] },
      { week: 3, sid: "hautA", vid: "dc", sets: [set(80, 8, 3), set(80, 8, 3), set(80, 8, 3)] }
    );
    st.logs[`${dateOf(3, "hautA")}_hautA`].kind = "allege";
    const q = planned(prog, st, "dc", 4, si("hautA"), dateOf(4, "hautA"));
    assert.equal(q.load, 102.5, "marquée allégée, elle est sautée et la base reste 100");
  });

  test("une base allégée sans rien avant elle prend la branche normale", () => {
    /* Aucune séance sur quoi se rabattre : on repart d'elle, mais sans la coupe
       de la branche calibration, qu'elle n'a pas à expliquer. */
    const st = S({ week: 2, sid: "hautA", vid: "dc", sets: [set(80, 8, 1), set(80, 8, 1), set(80, 8, 1)] });
    st.logs[`${dateOf(2, "hautA")}_hautA`].kind = "allege";
    const p = planned(prog, st, "dc", 3, si("hautA"), dateOf(3, "hautA"));
    assert.equal(p.load, 82.5);
    assert.match(p.why, /^\+2,5 kg/, "branche normale, pas « calibration : +5 % »");
  });

  test("baseLoad porte la charge de la base réellement lue", () => {
    const st = S(
      { week: 2, sid: "hautA", vid: "dc", sets: [set(100, 8, 1), set(100, 8, 1), set(100, 8, 1)] },
      { week: 3, sid: "hautA", vid: "dc", sets: [set(80, 8, 3), set(80, 8, 3), set(80, 8, 3)] }
    );
    st.logs[`${dateOf(3, "hautA")}_hautA`].kind = "allege";
    assert.equal(planned(prog, st, "dc", 4, si("hautA"), dateOf(4, "hautA")).baseLoad, 100);
  });

  test("baseLoad est nul quand il n'y a pas de base, ou pas de charge", () => {
    assert.equal(planned(prog, S(), "dc", 1, si("hautA"), dateOf(1, "hautA")).baseLoad, null);
    assert.equal(planned(prog, S(), "reardelt", 1, si("hautA"), dateOf(1, "hautA")).baseLoad, null);
    assert.equal(planned(prog, S(), "sideplank", 1, si("basA"), dateOf(1, "basA")).baseLoad, null);
    const st = S({ week: 2, sid: "basA", vid: "sideplank", sets: [set(null, 40, 2), set(null, 35, 2)] });
    assert.equal(planned(prog, st, "sideplank", 3, si("basA"), dateOf(3, "basA")).baseLoad, null, "unité sans charge");
  });
});

/* ---- loadDrops (#43) -------------------------------------------------- */

describe("loadDrops", () => {
  const e = (name, load, baseLoad, incr) => ({ vid: name, name, load, baseLoad, incr });

  test("une baisse de plus d'un incrément est retenue", () => {
    assert.deepEqual(loadDrops([e("dc", 80, 100, 2.5)]).map((x) => x.name), ["dc"]);
  });

  test("une baisse d'un incrément exactement ne l'est pas", () => {
    /* 102,5 devenus 100 faute de disques : un arrondi, pas une séance allégée —
       et un 8/8/8 à 100 redonne 102,5 dès la séance suivante. */
    assert.deepEqual(loadDrops([e("dc", 100, 102.5, 2.5)]), []);
    assert.deepEqual(loadDrops([e("squat", 100, 105, 5)]), []);
    assert.deepEqual(loadDrops([e("squat", 99, 105, 5)]).length, 1, "au-delà, oui");
  });

  test("une charge égale ou plus lourde n'est pas une baisse", () => {
    assert.deepEqual(loadDrops([e("dc", 100, 100, 2.5), e("squat", 110, 105, 5)]), []);
  });

  test("un exercice sans référence est ignoré, jamais compté comme une baisse", () => {
    /* Première fois qu'on le fait : rien à comparer. */
    assert.deepEqual(loadDrops([e("dc", 80, null, 2.5)]), []);
    assert.deepEqual(loadDrops([e("dc", null, 100, 2.5)]), []);
  });

  test("sans incrément utilisable, aucune baisse — le seuil n'aurait pas de sens", () => {
    assert.deepEqual(loadDrops([e("x", 10, 100, 0)]), []);
    assert.deepEqual(loadDrops([e("x", 10, 100, undefined)]), []);
  });

  test("plusieurs exercices, seuls ceux qui ont baissé ressortent, dans l'ordre", () => {
    const drops = loadDrops([
      e("dc", 80, 100, 2.5),
      e("row", 60, 60, 2.5),
      e("squat", 90, 105, 5),
      e("curl", 20, 21, 2.5),
    ]);
    assert.deepEqual(drops.map((x) => x.name), ["dc", "squat"]);
  });

  test("entrées difformes : liste vide, jamais une exception", () => {
    assert.deepEqual(loadDrops([]), []);
    assert.deepEqual(loadDrops(null), []);
    assert.deepEqual(loadDrops([null, undefined]), []);
  });
});

/* ---------- normalizeSets et historyBefore (#23) ----------

   Quatre copies de la normalisation, deux copies du filtre « avant ce
   créneau ». Ce qui suit épingle ce que les copies faisaient, pour que la
   version partagée ne puisse pas s'en écarter en silence. */

describe("normalizeSets", () => {
  test("les chaînes du journal deviennent des nombres, la virgule comprise", () => {
    assert.deepEqual(normalizeSets([{ w: "72,5", r: "8", rir: "1" }]), [{ w: 72.5, r: 8, rir: 1 }]);
  });

  test("une série sans répétitions n'a pas eu lieu, même si la charge est là", () => {
    /* La règle qui porte le sens : une ligne laissée vide sur une séance
       validée ne compte pas. Un poids réglé sur la barre puis reposé n'est pas
       une série. */
    assert.deepEqual(normalizeSets([{ w: "70", r: "", rir: "" }]), []);
    assert.deepEqual(normalizeSets([{ w: "70", r: "8" }, { w: "70", r: "" }]), [{ w: 70, r: 8, rir: null }]);
  });

  test("une charge absente reste null, elle ne devient pas zéro", () => {
    /* C'est setSummary qui décide qu'une charge absente vaut 0 pour ses bornes
       (display.js) ; le moteur, lui, distingue « pas de charge » de « zéro
       kilo », qui est une vraie valeur au poids du corps. */
    assert.deepEqual(normalizeSets([{ r: "12" }]), [{ w: null, r: 12, rir: null }]);
    assert.deepEqual(normalizeSets([{ w: "0", r: "8" }]), [{ w: 0, r: 8, rir: null }]);
  });

  test("ce qui n'est pas une liste d'objets ne lève pas, il ne rend rien", () => {
    /* Les gardes que exercise-history.js portait seul : il lit des journaux que
       personne n'a validés (#32), et c'est la fonction partagée qui doit les
       porter, pas une copie mieux informée que les autres. */
    assert.deepEqual(normalizeSets(undefined), []);
    assert.deepEqual(normalizeSets(null), []);
    assert.deepEqual(normalizeSets("8/8/8"), []);
    assert.deepEqual(normalizeSets([null, "x", 3, [], { w: "70", r: "8" }]), [{ w: 70, r: 8, rir: null }]);
  });
});

/* ---------- setsOf (#86) ----------

   L'accesseur des lignes brutes, pour l'écran de séance. Ce qui compte ici :
   jamais autre chose qu'un tableau, et l'index d'une ligne ne bouge pas —
   onSet écrit la série i. */
describe("setsOf", () => {
  test("rend les lignes telles que tapées, vides comprises", () => {
    const log = { ex: { dc: [{ w: "72,5", r: "8" }, { w: "", r: "" }] } };
    assert.deepEqual(setsOf(log, "dc"), [{ w: "72,5", r: "8" }, { w: "", r: "" }]);
  });

  test("une chaîne sous ex[vid] ne se découpe pas en caractères", () => {
    /* Le cas de ARCHITECTURE §2.4 : `[..."87,5"]` rendait quatre lignes, que
       onSet réécrivait dans le journal ; `"87,5".map` levait à la validation. */
    assert.deepEqual(setsOf({ ex: { dc: "87,5" } }, "dc"), []);
  });

  test("log, ex ou exercice absents rendent un tableau vide", () => {
    assert.deepEqual(setsOf(undefined, "dc"), []);
    assert.deepEqual(setsOf(null, "dc"), []);
    assert.deepEqual(setsOf({}, "dc"), []);
    assert.deepEqual(setsOf({ ex: null }, "dc"), []);
    assert.deepEqual(setsOf({ ex: "abc" }, "dc"), []);
    assert.deepEqual(setsOf({ ex: { dc: null } }, "dc"), []);
    assert.deepEqual(setsOf({ ex: { dc: 3 } }, "dc"), []);
    assert.deepEqual(setsOf({ ex: {} }, "dc"), []);
  });

  test("une entrée qui n'est pas une ligne devient une ligne vide, à son index", () => {
    /* Remplacée et non écartée : écarter décalerait la série 2 en série 1, et
       onSet écrirait la saisie sur la mauvaise ligne. */
    const rows = setsOf({ ex: { dc: [null, "x", { w: "70", r: "8" }, []] } }, "dc");
    assert.deepEqual(rows, [{}, {}, { w: "70", r: "8" }, {}]);
    assert.equal(rows[2].r, "8");
  });

  test("normalizeSets lit setsOf comme il lit le journal", () => {
    const log = { ex: { dc: [null, { w: "70", r: "8" }, { w: "70", r: "" }] } };
    assert.deepEqual(normalizeSets(setsOf(log, "dc")), normalizeSets(log.ex.dc));
  });
});

describe("historyBefore", () => {
  const st = S(
    { week: 1, sid: "hautA", vid: "dc", sets: [set("70", "8", "2")] },
    { week: 2, sid: "hautA", vid: "dc", sets: [set("72,5", "8", "1")] },
    { week: 3, sid: "hautA", vid: "dc", sets: [set("75", "8", "1")] },
  );

  test("rend ce qui précède le créneau, jamais le créneau lui-même", () => {
    const d = dateOf(3, "hautA");
    const h = historyBefore(prog, st, "dc", d, si("hautA"));
    assert.deepEqual(h.map((e) => e.sets[0].w), [70, 72.5]);
  });

  test("le rang de la séance départage deux séances du même jour", () => {
    /* Depuis #16 un créneau s'identifie par (date, rang), pas par une semaine :
       une comparaison de dates seule classerait deux séances du même jour au
       hasard, et `lastEntry` citerait alors une séance que `planned` a ignorée. */
    const day = dateOf(1, "hautA");
    const two = {
      ...st,
      logs: {
        a: { id: "a", date: day, slot: prog.SESSIONS[0].id, kind: "normal", done: true, ex: { dc: [set("60", "8", "2")] } },
        b: { id: "b", date: day, slot: prog.SESSIONS[1].id, kind: "normal", done: true, ex: { dc: [set("65", "8", "2")] } },
      },
    };
    assert.deepEqual(historyBefore(prog, two, "dc", day, 1).map((e) => e.sets[0].w), [60]);
    assert.deepEqual(historyBefore(prog, two, "dc", day, 2).map((e) => e.sets[0].w), [60, 65]);
    assert.deepEqual(historyBefore(prog, two, "dc", day, 0).map((e) => e.sets[0].w), []);
  });

  test("lastEntry en est la dernière entrée, par construction", () => {
    /* Les deux lectures ne peuvent plus diverger : c'est tout l'objet de
       l'extraction. */
    const d = dateOf(3, "hautA");
    const h = historyBefore(prog, st, "dc", d, si("hautA"));
    assert.deepEqual(lastEntry(prog, st, "dc", d, si("hautA")), h[h.length - 1]);
  });
});

/* ---- #55 : planned() sur un exercice qu'on lui désigne ------------------ */

describe("planned() avec un vid explicite (#55)", () => {
  /* Deux séances de développé couché barre derrière soi, et rien au développé
     haltères : c'est la situation d'une machine prise un mardi. */
  const st = S(
    { week: 2, sid: "hautA", vid: "dc", sets: [set(80, 8, 1), set(80, 8, 1), set(80, 8, 1)] },
  );
  const d = dateOf(3, "hautA");

  test("sans le septième paramètre, rien ne change — c'est ce qui rend #55 bon marché", () => {
    /* Tout le reste de ce fichier appelle planned() à six paramètres, et aucune
       de ses valeurs attendues n'a bougé. Ce test dit explicitement ce que les
       autres supposent : le défaut est l'exercice que le créneau prescrit. */
    assert.deepEqual(
      planned(prog, st, "dc", 3, si("hautA"), d),
      planned(prog, st, "dc", 3, si("hautA"), d, prog.SLOTS.dc.b1),
    );
  });

  test("le vid passé décide de l'historique lu, pas le créneau", () => {
    /* La substitution vue du moteur. Le prescrit a trois séries au haut de
       fourchette derrière lui, donc il monte d'un incrément ; le remplaçant n'a
       ni historique ni charge de départ — `startingLoads` ne couvre que les
       exercices du programme — donc il rend « Paliers ».

       C'est le chemin `!base` qui existait déjà, et c'est le bon comportement :
       on ne devine pas une charge sur un exercice jamais fait. */
    const onSlot = planned(prog, st, "dc", 3, si("hautA"), d);
    const onSub = planned(prog, st, "dc", 3, si("hautA"), d, "dc_db");
    assert.equal(onSlot.load, 82.5);
    assert.equal(onSub.load, null);
    assert.equal(onSub.text, "Paliers");
  });

  test("le remplaçant lit son propre historique, pas celui du créneau", () => {
    const both = S(
      { week: 2, sid: "hautA", vid: "dc", sets: [set(80, 8, 1), set(80, 8, 1), set(80, 8, 1)] },
      { week: 2, sid: "basA", vid: "dc_db", sets: [set(30, 8, 1), set(30, 8, 1), set(30, 8, 1)] },
    );
    const onSub = planned(prog, both, "dc", 3, si("hautA"), d, "dc_db");
    assert.equal(onSub.load, 30 + prog.V.dc_db.incr);
    assert.match(onSub.why, /haut de fourchette atteint/);
  });
});
