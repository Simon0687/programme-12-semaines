import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildProgram } from "../src/program.js";
import { STARTING_LOADS } from "../src/profile.js";
import { planned, history, lastEntry, computeKind } from "../src/progression.js";
import { dateForSlot } from "../src/schema.js";

/* Pins the behaviour of planned() as it shipped in 1.0.0, before #3-#6
   start moving the program data around. Every expected value here is the
   current output of the code, not an independent recalculation - a drift
   is a regression to investigate, not a test to "fix". Q2/Q3/Q5 are
   pinned as-is per docs/features/2-tests-progression-logic/spec.md.
   The RIR<=1 gate on the top-of-range branch, originally pinned here, was
   superseded by #28: reaching the top of the range now increases the load
   on its own, RIR is informative only.

   #16: the engine reads date+kind instead of a week-keyed log. Fixtures
   still take a "week" (it's the natural way to describe a fixture) but S()
   turns it into the same date/kind a real validation would have produced
   (dateForSlot/computeKind, #16) - so every expected value below stays
   exactly what it was before the migration to a dated timeline. */

const prog = buildProgram({ startingLoads: STARTING_LOADS });
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
