import test from "node:test";
import assert from "node:assert/strict";
import { exerciseHistory, recordsFor, recordEntries, seriesByCycle, chartPoint, chartMode, headline, estimate10RM } from "../src/exercise-history.js";

/* Deux cycles, comme un journal réel après un an : l'ancien porte ses propres
   noms de séance (« Pousser »), le nouveau les siens (« Haut A »). C'est la
   définition épinglée de chaque cycle qui les fournit (#26), pas le programme
   actif — sans quoi l'historique de mars se lirait avec le vocabulaire
   d'aujourd'hui. */
function journal() {
  return {
    activeProgramId: "cur",
    programs: {
      old: {
        definition: { name: "Haut/Bas 4 jours", program: { SESSIONS: [{ id: "push", name: "Pousser" }] } },
        logs: {
          a: { date: "2026-06-01", slot: "push", done: true, kind: "normal", ex: { dc: [{ w: "77,5", r: "7", rir: "1" }, { w: "77,5", r: "6", rir: "1" }] } },
          b: { date: "2026-05-25", slot: "push", done: true, kind: "normal", ex: { dc: [{ w: "75", r: "8", rir: "1" }] } },
        },
        cardio: {}, checkin: {},
      },
      cur: {
        definition: { name: "Haut/Bas 5 jours", program: { SESSIONS: [{ id: "hautA", name: "Haut A" }, { id: "hautB", name: "Haut B" }] } },
        logs: {
          c: { date: "2026-08-31", slot: "hautA", done: true, kind: "normal", ex: { dc: [{ w: "87,5", r: "5", rir: "1" }, { w: "87,5", r: "4", rir: "1" }] } },
          d: { date: "2026-08-24", slot: "hautA", done: true, kind: "normal", ex: { dc: [{ w: "85", r: "8", rir: "1" }, { w: "85", r: "6", rir: "1" }] } },
          e: { date: "2026-06-22", slot: "hautA", done: true, kind: "calibration", ex: { dc: [{ w: "75", r: "8", rir: "3" }] } },
          f: { date: "2026-09-07", slot: "hautA", done: false, kind: "normal", ex: { dc: [{ w: "90", r: "6", rir: "1" }] } },
        },
        cardio: {}, checkin: {},
      },
    },
  };
}

test("exerciseHistory : les deux cycles répondent, du plus ancien au plus récent", () => {
  const h = exerciseHistory(journal(), "dc");
  assert.deepEqual(h.map((e) => e.date), ["2026-05-25", "2026-06-01", "2026-06-22", "2026-08-24", "2026-08-31"]);
  assert.deepEqual(h.map((e) => e.programId), ["old", "old", "cur", "cur", "cur"]);
});

test("exerciseHistory : chaque ligne porte le nom de séance de SON cycle", () => {
  const h = exerciseHistory(journal(), "dc");
  assert.equal(h[0].sessionName, "Pousser");
  assert.equal(h[0].programName, "Haut/Bas 4 jours");
  assert.equal(h[4].sessionName, "Haut A");
  assert.equal(h[4].programName, "Haut/Bas 5 jours");
});

test("exerciseHistory : une séance en cours n'apparaît nulle part", () => {
  /* La ligne du 7 sept. porte 90 kg et done: false. Elle ne doit ni figurer
     dans l'historique, ni pouvoir devenir un record : une série 3 peut encore
     démentir ce qu'annonçait la série 1. */
  const h = exerciseHistory(journal(), "dc");
  assert.equal(h.some((e) => e.date === "2026-09-07"), false);
  const { rows } = recordsFor(h, "kg");
  assert.equal(rows.some((r) => r.load === 90), false);
});

test("exerciseHistory : les chaînes du journal sont converties en nombres", () => {
  const h = exerciseHistory(journal(), "dc");
  assert.deepEqual(h[4].sets, [{ w: 87.5, r: 5, rir: 1 }, { w: 87.5, r: 4, rir: 1 }]);
});

test("exerciseHistory : un exercice jamais fait rend une liste vide", () => {
  assert.deepEqual(exerciseHistory(journal(), "incl_mach"), []);
});

/* ---------- Fermé par défaut (ARCHITECTURE §2.4) ---------- */

test("exerciseHistory : une charge utile ex mal formée ne fait jamais lever", () => {
  /* isLogRow (journal-shape.js) accepte ces lignes : il vérifie que `ex` est un
     objet, jamais ce qu'il y a dedans. history() lève dessus
     (TypeError: … .map is not a function). Ce module, non. */
  for (const bad of ["87,5", 42, null, { 0: { w: 80, r: 8 } }, [1, 2, 3], [null, "x"]]) {
    const j = journal();
    j.programs.cur.logs.z = { date: "2026-09-01", slot: "hautA", done: true, kind: "normal", ex: { dc: bad } };
    let h;
    assert.doesNotThrow(() => { h = exerciseHistory(j, "dc"); }, `ex.dc = ${JSON.stringify(bad)}`);
    assert.equal(h.some((e) => e.date === "2026-09-01"), false, "et n'apporte aucune série");
  }
});

test("exerciseHistory : entrées et journaux difformes rendent une liste vide", () => {
  for (const bad of [null, undefined, 42, "x", {}, { programs: null }, { programs: { p: 7 } }, { programs: { p: { logs: "x" } } }]) {
    assert.deepEqual(exerciseHistory(bad, "dc"), []);
  }
  assert.deepEqual(exerciseHistory(journal(), null), []);
});

test("exerciseHistory : une définition sans SESSIONS donne un nom nul, pas un jeté", () => {
  /* Le cas exact d'un cycle marqué inutilisable par #32 : ses séries sont
     intactes même quand sa définition ne l'est pas. */
  const j = journal();
  j.programs.old.definition = { name: "Cycle abîmé" };
  const h = exerciseHistory(j, "dc");
  assert.equal(h[0].sessionName, null);
  assert.equal(h[0].programName, "Cycle abîmé");
  assert.equal(h[0].sets.length, 1);

  j.programs.old.definition = null;
  const h2 = exerciseHistory(j, "dc");
  assert.equal(h2[0].programName, null);
  assert.equal(h2[0].sessionName, null);
});

/* ---------- Records ---------- */

test("recordsFor : « N reps ou plus », donc strictement décroissant (#63)", () => {
  const { mode, rows } = recordsFor(exerciseHistory(journal(), "dc"), "kg");
  assert.equal(mode, "byReps");
  /* 87,5 tenu sur 4 et sur 5 reps, 85 sur 6, 7 et 8 : deux charges, deux
     lignes, chacune au meilleur nombre de reps atteint dessus. */
  assert.deepEqual(rows, [
    { reps: 5, load: 87.5, date: "2026-08-31" },
    { reps: 8, load: 85, date: "2026-08-24" },
  ]);

  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i].load < rows[i - 1].load, `${rows[i].reps} reps : ${rows[i].load} >= ${rows[i - 1].load}`);
  }
});

/* Le cas de l'issue, en toutes lettres : la séance qui ajoute une rep à charge
   égale remplace la ligne au lieu d'en ouvrir une seconde. */
test("recordsFor : une rep de plus à la même charge ne crée pas une ligne de plus (#63)", () => {
  const entries = [
    { date: "2026-09-10", sets: [{ w: 105, r: 7, rir: 1 }] },
    { date: "2026-09-17", sets: [{ w: 105, r: 8, rir: 1 }] },
  ];
  assert.deepEqual(recordsFor(entries, "kg").rows, [{ reps: 8, load: 105, date: "2026-09-17" }]);
});

/* Une charge plus lourde sur moins de reps garde sa ligne : ce n'est pas un
   doublon, c'est l'autre bout de la courbe force/endurance. */
test("recordsFor : deux charges distinctes gardent leurs deux lignes (#63)", () => {
  const entries = [
    { date: "2026-09-10", sets: [{ w: 110, r: 5, rir: 1 }] },
    { date: "2026-09-17", sets: [{ w: 105, r: 8, rir: 1 }] },
  ];
  assert.deepEqual(recordsFor(entries, "kg").rows, [
    { reps: 5, load: 110, date: "2026-09-10" },
    { reps: 8, load: 105, date: "2026-09-17" },
  ]);
});

test("recordsFor : la date retenue est la première fois, pas la dernière", () => {
  const j = journal();
  j.programs.cur.logs.g = { date: "2026-09-01", slot: "hautA", done: true, kind: "normal", ex: { dc: [{ w: "87,5", r: "5", rir: "1" }] } };
  const { rows } = recordsFor(exerciseHistory(j, "dc"), "kg");
  assert.equal(rows.find((r) => r.reps === 5).date, "2026-08-31");
});

test("recordsFor : sans charge, une seule ligne", () => {
  const entries = [
    { date: "2026-08-01", sets: [{ w: null, r: 40, rir: 2 }, { w: null, r: 35, rir: 2 }] },
    { date: "2026-09-07", sets: [{ w: null, r: 60, rir: 2 }, { w: null, r: 55, rir: 2 }] },
  ];
  assert.deepEqual(recordsFor(entries, "time"), { mode: "best", best: 60, date: "2026-09-07" });
  assert.deepEqual(recordsFor(entries, "reps"), { mode: "best", best: 60, date: "2026-09-07" });
});

test("recordsFor : aucune donnée", () => {
  assert.deepEqual(recordsFor([], "kg"), { mode: "byReps", rows: [] });
  assert.deepEqual(recordsFor([], "time"), { mode: "best", best: null, date: null });
  assert.deepEqual(recordsFor(null, "kg"), { mode: "byReps", rows: [] });
});

test("recordsFor : au poids du corps, le record porte le lest, PDC valant zéro", () => {
  const entries = [
    { date: "2026-07-01", sets: [{ w: null, r: 8, rir: 1 }] },
    { date: "2026-07-29", sets: [{ w: 10, r: 6, rir: 1 }] },
  ];
  const { rows } = recordsFor(entries, "bw");
  assert.deepEqual(rows.find((r) => r.reps === 6), { reps: 6, load: 10, date: "2026-07-29" });
  assert.deepEqual(rows.find((r) => r.reps === 8), { reps: 8, load: 0, date: "2026-07-01" });
});

/* ---------- Trophées de l'historique (#119) ---------- */

test("recordEntries : les séances qui portent un record de la table, et elles seules", () => {
  const h = exerciseHistory(journal(), "dc");
  const set = recordEntries(h, "kg");
  /* Deux lignes dans la table (87,5 × 5 le 31 août, 85 × 8 le 24 août) : deux
     trophées, posés sur ces deux séances-là. */
  assert.deepEqual(h.filter((e) => set.has(e)).map((e) => e.date), ["2026-08-24", "2026-08-31"]);
});

test("recordEntries : une ligne retirée comme redondante ne laisse pas de trophée (#63)", () => {
  const entries = [
    { date: "2026-09-10", sets: [{ w: 105, r: 7, rir: 1 }] },
    { date: "2026-09-17", sets: [{ w: 105, r: 8, rir: 1 }] },
  ];
  const set = recordEntries(entries, "kg");
  assert.equal(set.has(entries[0]), false);
  assert.equal(set.has(entries[1]), true);
});

test("recordEntries : même date dans deux cycles, seul le cycle du record est désigné", () => {
  const entries = [
    { date: "2026-09-07", programId: "a", sets: [{ w: 60, r: 8 }] },
    { date: "2026-09-07", programId: "b", sets: [{ w: 80, r: 8 }] },
  ];
  const set = recordEntries(entries, "kg");
  assert.deepEqual([...set].map((e) => e.programId), ["b"]);
});

test("recordEntries : sans charge, la séance de la meilleure série ; vide sans donnée", () => {
  const entries = [
    { date: "2026-08-01", sets: [{ w: null, r: 40 }] },
    { date: "2026-09-07", sets: [{ w: null, r: 60 }] },
  ];
  assert.deepEqual([...recordEntries(entries, "time")], [entries[1]]);
  assert.equal(recordEntries([], "time").size, 0);
  assert.equal(recordEntries(null, "kg").size, 0);
});

/* ---------- Courbe ---------- */

test("estimate10RM : Epley ramené à dix reps, exact à dix reps", () => {
  /* L'identité à r = 10 est la raison du choix : la courbe passe par la charge
     réellement portée quand la série fait dix reps, sans dérive. */
  assert.equal(estimate10RM(80, 10), 80);
  assert.equal(estimate10RM(90, 8), 85.5);
  assert.equal(estimate10RM(90, 2), 72);
  assert.equal(estimate10RM(null, 8), 0, "sans charge saisie, zéro et non une exception");
  assert.equal(estimate10RM(80, null), null, "sans reps, rien à estimer");
});

test("chartPoint : la meilleure série est la mieux estimée, pas la plus lourde", () => {
  /* Le défaut de la première version, en une assertion : 2 reps à 90 kg pèsent
     moins qu'un 8 reps à 85 kg, et la courbe doit le dire. */
  const e = { sets: [{ w: 90, r: 2 }, { w: 85, r: 8 }] };
  assert.equal(chartPoint(e, "kg").value, 80.8);
  assert.equal(chartPoint(e, "kg").reps, 8);
});

test("chartPoint : hors de 3–12 reps, le point est grisé et non écarté", () => {
  assert.equal(chartPoint({ sets: [{ w: 100, r: 2 }] }, "kg").dim, true);
  assert.equal(chartPoint({ sets: [{ w: 40, r: 20 }] }, "kg").dim, true);
  assert.equal(chartPoint({ sets: [{ w: 80, r: 3 }] }, "kg").dim, false);
  assert.equal(chartPoint({ sets: [{ w: 80, r: 12 }] }, "kg").dim, false);
});

test("chartPoint : en double progression, la série la plus lourde porte les deux", () => {
  /* Retenir la plus longue ferait monter la courbe chaque fois qu'on allège —
     l'inverse de ce que la double progression doit montrer. */
  const p = chartPoint({ sets: [{ w: 10, r: 6 }, { w: 0, r: 15 }] }, "bw");
  assert.deepEqual(p, { value: 6, bar: 10 });
  assert.deepEqual(chartPoint({ sets: [{ w: 24, r: 40 }] }, "carry"), { value: 40, bar: 24 });
  assert.equal(chartPoint({ sets: [{ w: 10, r: 6 }] }, "bw").dim, undefined, "aucune estimation, donc aucune réserve à afficher");
});

test("chartMode : chaque unité sait ce qu'elle fait progresser", () => {
  assert.deepEqual(chartMode("kg"), { kind: "estimate", line: "kg" });
  assert.deepEqual(chartMode(undefined), { kind: "estimate", line: "kg" }, "kg est l'unité implicite du registre");
  assert.deepEqual(chartMode("bw"), { kind: "dual", line: "reps", bar: "kg" });
  assert.deepEqual(chartMode("carry"), { kind: "dual", line: "time", bar: "kg" });
  assert.deepEqual(chartMode("time"), { kind: "raw", line: "time" });
  assert.deepEqual(chartMode("reps"), { kind: "raw", line: "reps" });
});

/* ---------- Le chiffre en tête de fiche (#49) ---------- */

test("headline : la valeur du jour, et sa variation depuis la toute première séance", () => {
  /* La base est le 25 mai, dans l'**autre** cycle : c'est exactement ce que la
     décision Q1 tranche — une frontière de cycle remettrait ce nombre à zéro
     tous les trois mois. */
  const h = headline(exerciseHistory(journal(), "dc"), "kg");
  assert.equal(h.value, 76.6, "le 10RM du 31 août");
  assert.equal(h.delta, 5.3, "contre 71,3 le 25 mai, dans le cycle précédent");
  assert.equal(h.dim, false);
});

test("headline : une seule séance n'a pas de variation, et surtout pas zéro", () => {
  /* Elle *est* la base : « +0 » annoncerait un plateau au lieu d'une absence de
     recul. */
  const h = headline([{ date: "2026-06-01", sets: [{ w: 80, r: 8 }] }], "kg");
  assert.equal(h.value, 76);
  assert.equal(h.delta, null);
});

test("headline : hors fenêtre d'estimation, le chiffre de tête est grisé", () => {
  /* Un 10RM calculé sur une série de 2 reps ne doit pas être la chose la plus
     assurée de l'écran — la courbe grise déjà ses points pour cette raison. */
  const h = headline([{ sets: [{ w: 100, r: 8 }] }, { sets: [{ w: 120, r: 2 }] }], "kg");
  assert.equal(h.dim, true);
});

test("headline : en double progression, le lest accompagne la valeur", () => {
  /* Les deux grandeurs, sans quoi 8 tractions à vide et 8 à +10 kg s'écriraient
     pareil. La variation porte sur ce que trace la courbe — les reps. */
  const h = headline([{ sets: [{ w: 0, r: 8 }] }, { sets: [{ w: 10, r: 6 }] }], "bw");
  assert.deepEqual([h.value, h.bar, h.delta], [6, 10, -2]);
});

test("headline : sans séance exploitable, rien à afficher", () => {
  assert.equal(headline([], "kg"), null);
  assert.equal(headline(null, "kg"), null);
  assert.equal(headline([{ sets: [] }], "kg"), null);
});

test("seriesByCycle : un segment par cycle, dans l'ordre", () => {
  const s = seriesByCycle(exerciseHistory(journal(), "dc"), "kg");
  assert.deepEqual(s.map((x) => x.programId), ["old", "cur"]);
  /* Les charges brutes montaient de 85 à 87,5 entre le 24 et le 31 août ; le
     10RM estimé descend de 80,8 à 76,6, parce que les reps sont passées de 8 à
     5. C'est très exactement ce que la courbe devait cesser de cacher. */
  assert.deepEqual(s[0].points.map((p) => p.value), [71.3, 71.7]);
  assert.deepEqual(s[1].points.map((p) => p.value), [71.3, 80.8, 76.6]);
  assert.equal(s[1].points[0].kind, "calibration");
});

test("seriesByCycle : sans charge, la courbe suit ce qui progresse", () => {
  const entries = [{ programId: "p", programName: "P", date: "2026-09-07", kind: "normal", sets: [{ w: null, r: 60, rir: 2 }, { w: null, r: 55, rir: 2 }] }];
  assert.equal(seriesByCycle(entries, "time")[0].points[0].value, 60);
  assert.equal(seriesByCycle(entries, "time")[0].points[0].bar, undefined, "aucune barre : il n'y a pas de charge");
});

test("seriesByCycle : une séance sans reps exploitables ne fait pas un point à zéro", () => {
  const entries = [{ programId: "p", date: "2026-09-07", kind: "normal", sets: [] }];
  assert.deepEqual(seriesByCycle(entries, "kg"), []);
});
