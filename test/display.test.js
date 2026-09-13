import test from "node:test";
import assert from "node:assert/strict";
import {
  setSummary, muscleRows, detailRows, chartGeometry, dateShort, dayNumber, MUSCLE_LABELS,
} from "../src/display.js";
import { EXERCISES, UNSELECTABLE_IDS, MUSCLE_GROUPS } from "../src/registry.js";

/* ---------- setSummary : sortie épinglée avant le déplacement ----------

   Les chaînes attendues sont celles que produisait App.jsx:66-74 avant #17,
   relevées à la lecture du code et non de la nouvelle implémentation : c'est
   ce qui fait de ces tests un filet et pas une tautologie. Toute évolution du
   format (un « / main » pour perHand, par exemple) doit donc casser ici
   d'abord — et c'est voulu, cf. #23. */

test("setSummary : charge en kg, RIR unique", () => {
  const sets = [{ w: 87.5, r: 6, rir: 1 }, { w: 87.5, r: 5, rir: 1 }, { w: 87.5, r: 5, rir: 1 }];
  assert.equal(setSummary(sets, { name: "Développé couché barre" }), "87,5 kg 6/5/5 @ 1 RIR");
});

test("setSummary : poids du corps lesté et poids du corps nu", () => {
  assert.equal(setSummary([{ w: 10, r: 6, rir: 1 }, { w: 10, r: 5, rir: 1 }], { unit: "bw" }), "+10 kg 6/5 @ 1 RIR");
  assert.equal(setSummary([{ w: 0, r: 8, rir: 3 }, { w: 0, r: 8, rir: 3 }], { unit: "bw" }), "PDC 8/8 @ 3 RIR");
});

test("setSummary : secondes, répétitions et porté", () => {
  assert.equal(setSummary([{ w: null, r: 60, rir: 2 }, { w: null, r: 55, rir: 2 }], { unit: "time" }), "60/55 s @ 2 RIR");
  assert.equal(setSummary([{ w: null, r: 10, rir: 1 }], { unit: "reps" }), "10 @ 1 RIR");
  assert.equal(setSummary([{ w: 24, r: 40, rir: 2 }], { unit: "carry" }), "24 kg 40 s @ 2 RIR");
});

test("setSummary : plusieurs RIR sont joints par un tiret", () => {
  assert.equal(setSummary([{ w: 80, r: 8, rir: 1 }, { w: 80, r: 8, rir: 2 }], {}), "80 kg 8/8 @ 1-2 RIR");
});

test("setSummary : valeurs manquantes rendues « ? », jamais une exception", () => {
  assert.equal(setSummary([{ w: 80, r: null, rir: 1 }], {}), "80 kg ? @ 1 RIR");
  assert.equal(setSummary([{ w: null, r: 8, rir: null }], {}), "0 kg 8 @ ? RIR");
});

test("setSummary : aucune série => tiret cadratin", () => {
  assert.equal(setSummary([], {}), "—");
  assert.equal(setSummary(null, {}), "—");
});

/* ---------- Libellés et bloc Détails ---------- */

test("MUSCLE_LABELS couvre exactement les groupes du registre", () => {
  assert.deepEqual(Object.keys(MUSCLE_LABELS).sort(), [...MUSCLE_GROUPS].sort());
});

test("muscleRows : trié décroissant, un seul dominant, somme à 100 %", () => {
  const rows = muscleRows(EXERCISES.dc);
  assert.deepEqual(rows.map((r) => [r.label, r.pct]), [
    ["Pectoraux", 60], ["Triceps", 20], ["Deltoïde antérieur", 20],
  ]);
  assert.equal(rows.filter((r) => r.dominant).length, 1);
  assert.equal(rows[0].dominant, true);
});

test("muscleRows : la somme fait 100 % sur toutes les entrées du registre", () => {
  for (const [id, ex] of Object.entries(EXERCISES)) {
    if (!ex.muscles) continue;
    const total = muscleRows(ex).reduce((a, r) => a + r.pct, 0);
    assert.equal(total, 100, `${id} : somme des muscles = ${total}`);
  }
});

test("detailRows : un exercice complet rend ses quatre lignes", () => {
  assert.deepEqual(detailRows(EXERCISES.dc), {
    muscles: muscleRows(EXERCISES.dc),
    equipement: "Barre, banc, rack",
    articulations: "Épaule, poignet",
    type: "Composé",
  });
});

test("detailRows : sans champs de sélection, la section est absente et non vide", () => {
  /* Les quatre ids de UNSELECTABLE_IDS (#25) n'ont ni muscles ni équipement.
     `null` veut dire « ne rends pas la section », pas « rends-la vide ». */
  for (const id of UNSELECTABLE_IDS) {
    assert.equal(detailRows(EXERCISES[id]), null, `${id} devrait rendre null`);
  }
  assert.equal(detailRows(undefined), null);
});

/* ---------- Dates et géométrie ---------- */

test("dateShort et dayNumber", () => {
  assert.equal(dateShort("2026-09-07"), "7 sept.");
  assert.equal(dateShort("2026-03-16"), "16 mars");
  assert.equal(dayNumber("2026-09-08") - dayNumber("2026-09-07"), 1);
});

const SERIES = [
  {
    programId: "old", programName: "Haut/Bas 4 jours",
    points: [
      { date: "2026-03-16", value: 65, kind: "calibration" },
      { date: "2026-04-27", value: 60, kind: "deload" },
      { date: "2026-06-01", value: 77.5, kind: "normal" },
    ],
  },
  {
    programId: "cur", programName: "Haut/Bas 5 jours",
    points: [
      { date: "2026-06-22", value: 75, kind: "calibration" },
      { date: "2026-08-31", value: 87.5, kind: "normal" },
    ],
  },
];

test("chartGeometry : une polyligne par cycle, jamais une seule qui traverse", () => {
  const g = chartGeometry(SERIES, { w: 358, h: 162 });
  assert.equal(g.polylines.length, 2);
  assert.deepEqual(g.polylines.map((p) => p.programId), ["old", "cur"]);
  assert.equal(g.polylines[0].points.split(" ").length, 3);
  assert.equal(g.polylines[1].points.split(" ").length, 2);
});

test("chartGeometry : une charge plus lourde est plus haut sur la toile", () => {
  const g = chartGeometry(SERIES, { w: 358, h: 162 });
  const low = g.dots.find((d) => d.value === 60);
  const high = g.dots.find((d) => d.value === 87.5);
  assert.ok(high.y < low.y, `${high.y} devrait être au-dessus de ${low.y}`);
  assert.ok(high.x > low.x, "et plus à droite, puisque plus récente");
});

test("chartGeometry : calibration et décharge sont des points creux", () => {
  const g = chartGeometry(SERIES, { w: 358, h: 162 });
  assert.deepEqual(g.dots.map((d) => d.hollow), [true, true, false, true, false]);
});

test("chartGeometry : l'axe du temps est réel, pas un rang de séance", () => {
  /* Entre le 16 mars et le 1er juin il y a 77 jours ; entre le 1er juin et le
     22 juin, 21. Le second écart doit donc valoir environ le quart du premier,
     ce qu'un axe indexé sur le rang des séances rendrait égal. */
  const g = chartGeometry(SERIES, { w: 358, h: 162 });
  const [a, b, c, d] = g.dots.map((p) => p.x);
  assert.ok(Math.abs((d - c) / (c - a) - 21 / 77) < 0.05, `écarts ${a} ${b} ${c} ${d}`);
});

test("chartGeometry : aucune donnée => null, pas un cadre vide", () => {
  assert.equal(chartGeometry([], {}), null);
  assert.equal(chartGeometry([{ programId: "x", points: [] }], {}), null);
  assert.equal(chartGeometry(null, {}), null);
});

test("chartGeometry : une seule séance ne fait pas diviser par zéro", () => {
  const g = chartGeometry([{ programId: "x", points: [{ date: "2026-09-07", value: 80, kind: "normal" }] }], { w: 358, h: 162 });
  assert.equal(g.dots.length, 1);
  assert.ok(Number.isFinite(g.dots[0].x) && Number.isFinite(g.dots[0].y));
  assert.ok(g.grid.every((t) => Number.isFinite(t.y)));
});
