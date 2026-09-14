import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildProgram } from "../src/program.js";
import { LEGACY_DEFINITION } from "../src/legacy-program.js";
import { planned, history, lastEntry, lastEntryLabel, computeKind, workingSets } from "../src/progression.js";
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
