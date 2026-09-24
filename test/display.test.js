import test from "node:test";
import assert from "node:assert/strict";
import {
  setSummary, rowIsDone, completedSets, muscleRows, detailRows, chartGeometry, framed, valueText, deltaText, dateShort, dayNumber, MUSCLE_LABELS, KIND_LABELS, PATTERN_LABELS, dayName, weekdayName, adviceSummary, unitColumns, unitLoadLabel,
} from "../src/display.js";
import { EXERCISES, UNSELECTABLE_IDS, MUSCLE_GROUPS, PATTERNS } from "../src/registry.js";
import { fmt } from "../src/progression.js";

/* ---------- setSummary ----------

   Les chaînes à charge constante sont celles que produisait App.jsx:66-74
   avant #17 : elles restent le filet du déplacement de #23, au séparateur de
   RIR près. Elles n'ont pas bougé depuis, et ne bougent pas ici.

   Ce qui a changé le 2026-09-14 : la forme compacte prenait la charge maximale
   et concaténait toutes les reps, donc elle inventait des séries dès que la
   charge variait. L'explicite — « 8@90/8@85/10@70 kg » — l'a remplacée.

   Ce qui change avec #50 : l'explicite était l'objet le plus large des deux
   écrans qui la portent, pour un cas devenu ordinaire depuis la molette (#46).
   La forme bornée — « 90 → 70 kg 8/8/10 » — dit la même vérité dans la largeur
   de la compacte. Les attentes ci-dessous sont donc réécrites, pas reformulées :
   c'est le contrat qui change. Ce qu'il faut continuer d'interdire est nommé
   par le test des bornes : aucune charge affichée qu'aucune série n'a portée. */

test("setSummary : charge constante, la forme compacte est exacte et ne bouge pas", () => {
  const sets = [{ w: 87.5, r: 6, rir: 1 }, { w: 87.5, r: 5, rir: 1 }, { w: 87.5, r: 5, rir: 1 }];
  assert.equal(setSummary(sets, { name: "Développé couché barre" }), "87,5 kg 6/5/5 · 1 RIR");
});

test("setSummary : charge variable, les deux bornes et les reps", () => {
  /* Le cas relevé sur capture : « 90 kg 8/8/10 » laissait croire à dix reps à
     90 kg, alors que le 10 avait été fait à 70. Les bornes ne le laissent pas
     croire — elles n'apparient plus rien — mais elles n'effacent pas le 90. */
  const sets = [{ w: 90, r: 8, rir: 1 }, { w: 85, r: 8, rir: 1 }, { w: 70, r: 10, rir: 2 }];
  assert.equal(setSummary(sets, {}), "90 → 70 kg 8/8/10 · 1-2 RIR");
});

test("setSummary : le sens de la flèche suit la séance, il n'est pas trié", () => {
  /* Une charge qui monte et une charge qui décroche sont deux séances
     différentes ; triées, elles s'écriraient pareil. */
  const monte = [{ w: 70, r: 8 }, { w: 70, r: 8 }, { w: 72.5, r: 8 }];
  assert.equal(setSummary(monte, {}), "70 → 72,5 kg 8/8/8");
  const descend = [{ w: 72.5, r: 8 }, { w: 70, r: 8 }, { w: 70, r: 8 }];
  assert.equal(setSummary(descend, {}), "72,5 → 70 kg 8/8/8");
});

test("setSummary : des bornes, pas les extrémités de la séance", () => {
  /* 90 n'est ni la première ni la dernière charge. L'encadrer est tout l'objet
     de la forme : « rien au-dessus de 90 » resterait faux sans lui. */
  assert.equal(setSummary([{ w: 70, r: 8 }, { w: 90, r: 5 }, { w: 80, r: 6 }], {}), "70 → 90 kg 8/5/6");
});

test("setSummary : aucune charge affichée qui n'ait été portée", () => {
  /* La règle que la compacte d'origine violait, tenue sur un échantillon :
     toute charge qui paraît dans la sortie est celle d'une série réelle. */
  const sets = [{ w: 62.5, r: 10 }, { w: 67.5, r: 8 }, { w: 65, r: 8 }];
  const out = setSummary(sets, {});
  const shown = out.match(/\d+(?:,\d+)?(?= (?:→|kg))/g) || [];
  assert.deepEqual(shown, ["62,5", "67,5"]);
  for (const s of shown) assert.ok(sets.some((x) => fmt(x.w) === s), `${s} n'a été portée par aucune série`);
});

test("setSummary : poids du corps lesté et poids du corps nu", () => {
  assert.equal(setSummary([{ w: 10, r: 6, rir: 1 }, { w: 10, r: 5, rir: 1 }], { unit: "bw" }), "+10 kg 6/5 · 1 RIR");
  assert.equal(setSummary([{ w: 0, r: 8, rir: 3 }, { w: 0, r: 8, rir: 3 }], { unit: "bw" }), "PDC 8/8 · 3 RIR");
  /* Lest variable : chaque borne porte son unité, donc aucun « kg » final qui
     suivrait un « PDC » nu. */
  assert.equal(setSummary([{ w: 10, r: 6, rir: 1 }, { w: 0, r: 8, rir: 1 }], { unit: "bw" }), "PDC+10 → PDC 6/8 · 1 RIR");
});

test("setSummary : secondes, répétitions et porté", () => {
  assert.equal(setSummary([{ w: null, r: 60, rir: 2 }, { w: null, r: 55, rir: 2 }], { unit: "time" }), "60/55 s · 2 RIR");
  assert.equal(setSummary([{ w: null, r: 10, rir: 1 }], { unit: "reps" }), "10 · 1 RIR");
  assert.equal(setSummary([{ w: 24, r: 40, rir: 2 }], { unit: "carry" }), "24 kg 40 s · 2 RIR");
  /* Le porté garde ses secondes derrière les reps, et ses kilos devant : les
     deux unités du même exercice ne se rencontrent pas. */
  assert.equal(setSummary([{ w: 24, r: 40, rir: 2 }, { w: 20, r: 45, rir: 2 }], { unit: "carry" }), "24 → 20 kg 40/45 s · 2 RIR");
});

test("setSummary : sans charge, jamais de bornes — il n'y a rien à encadrer", () => {
  assert.equal(setSummary([{ w: null, r: 60, rir: 2 }, { w: null, r: 45, rir: 2 }], { unit: "time" }), "60/45 s · 2 RIR");
  assert.equal(setSummary([{ w: null, r: 12 }, { w: null, r: 10 }], { unit: "reps" }), "12/10");
});

test("setSummary : plusieurs RIR sont joints par un tiret", () => {
  assert.equal(setSummary([{ w: 80, r: 8, rir: 1 }, { w: 80, r: 8, rir: 2 }], {}), "80 kg 8/8 · 1-2 RIR");
});

test("setSummary : un RIR non saisi ne s'affiche pas", () => {
  /* « @ ? RIR » occupait une ligne pour dire qu'on ne savait rien. */
  assert.equal(setSummary([{ w: null, r: 8, rir: null }], {}), "0 kg 8");
  assert.equal(setSummary([{ w: 80, r: 8, rir: null }, { w: 80, r: 8, rir: 2 }], {}), "80 kg 8/8 · 2 RIR");
});

test("setSummary : valeurs manquantes rendues « ? », jamais une exception", () => {
  assert.equal(setSummary([{ w: 80, r: null, rir: 1 }], {}), "80 kg ? · 1 RIR");
  assert.equal(setSummary([{ w: 90, r: null, rir: 1 }, { w: 70, r: 8, rir: 1 }], {}), "90 → 70 kg ?/8 · 1 RIR");
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

/* ---------- Courbe : double progression et réserve d'estimation ---------- */

const DUAL = [
  {
    programId: "cur", programName: "Haut/Bas 5 jours",
    points: [
      { date: "2026-06-01", value: 8, kind: "normal", bar: 0 },
      { date: "2026-07-06", value: 6, kind: "normal", bar: 5 },
      { date: "2026-08-31", value: 8, kind: "normal", bar: 10 },
    ],
  },
];

test("chartGeometry : une barre par séance lestée, aucune pour le poids du corps nu", () => {
  const g = chartGeometry(DUAL, { w: 358, h: 162 });
  assert.equal(g.bars.length, 2, "la séance à lest nul n'a pas de barre");
  assert.deepEqual(g.bars.map((b) => b.value), [5, 10]);
  assert.ok(g.bars[1].h > g.bars[0].h, "un lest plus lourd fait une barre plus haute");
  assert.ok(g.bars.every((b) => Math.abs(b.y + b.h - g.plot.y1) < 0.2), "les barres partent du bas du cadre");
});

test("chartGeometry : barTop annonce le haut de l'échelle des barres", () => {
  const g = chartGeometry(DUAL, { w: 358, h: 162 });
  assert.ok(g.barTop.value >= 10, `l'échelle doit contenir le lest le plus lourd (${g.barTop.value})`);
  assert.ok(g.barTop.y > g.plot.y0, "les barres n'occupent que le bas du cadre, pas toute la hauteur");
});

test("chartGeometry : sans lest, ni barres ni axe de droite", () => {
  const flat = [{ programId: "p", points: DUAL[0].points.map((p) => ({ ...p, bar: 0 })) }];
  const g = chartGeometry(flat, { w: 358, h: 162 });
  assert.deepEqual(g.bars, []);
  assert.equal(g.barTop, null);
  assert.equal(g.plot.x1, 358, "et le tracé reprend toute la largeur");
});

test("chartGeometry : un point hors fenêtre d'estimation est marqué, pas déplacé", () => {
  const g = chartGeometry([{
    programId: "p",
    points: [
      { date: "2026-06-01", value: 80, kind: "normal", dim: false },
      { date: "2026-07-01", value: 90, kind: "normal", dim: true },
    ],
  }], { w: 358, h: 162 });
  assert.deepEqual(g.dots.map((d) => d.dim), [false, true]);
  assert.ok(g.dots[1].y < g.dots[0].y, "une estimation peu fiable reste tracée à sa valeur");
});

test("KIND_LABELS : une séance allégée se dit à l'écran, comme la décharge (#43)", () => {
  assert.equal(KIND_LABELS.allege, "allégée");
  assert.equal(KIND_LABELS.normal, undefined, "une séance normale n'a rien à annoncer");
});

test("chartGeometry : un point allégé est creux, comme une décharge (#43)", () => {
  /* Sans ça, un −20 kg volontaire se lirait comme une régression. */
  const g = chartGeometry([{
    programId: "p",
    points: [
      { date: "2026-06-01", value: 100, kind: "normal" },
      { date: "2026-07-01", value: 80, kind: "allege" },
      { date: "2026-08-01", value: 102, kind: "normal" },
    ],
  }], { w: 358, h: 162 });
  assert.deepEqual(g.dots.map((d) => d.hollow), [false, true, false]);
});

/* ---------- Plancher de l'axe : l'ordre ne doit plus passer pour l'ampleur (#49) ----------

   Ces tests portent sur l'empan de l'axe, jamais sur ses bornes exactes :
   `niceScale` arrondit vers l'extérieur, et figer « 60–80 » dans une assertion
   ferait tomber la suite au premier réglage des constantes, pour une raison
   sans rapport avec ce que le plancher promet. */

const span = (g) => g.grid[g.grid.length - 1].value - g.grid[0].value;
const spread = (g) => Math.max(...g.dots.map((d) => d.y)) - Math.min(...g.dots.map((d) => d.y));
const frameH = (g) => g.plot.y1 - g.plot.y0;
const oneCycle = (points) => [{ programId: "p", points }];

test("chartGeometry : 2,3 kg de progrès ne remplissent plus le cadre, et restent centrés", () => {
  /* Le cas de l'issue : 69 → 71,3 donnait un axe 69–72, donc la même fusée que
     20 kg auraient dessinée. */
  const g = chartGeometry(oneCycle([
    { date: "2026-06-01", value: 69, kind: "normal" },
    { date: "2026-07-01", value: 71.3, kind: "normal" },
  ]), { w: 358, h: 162 }, 2.5);
  assert.ok(span(g) >= 10.5, `empan ${span(g)} : au moins 15 % de la médiane`);
  /* Élargi symétriquement : ancré sur un bas fixe, l'axe décentrerait la
     courbe, ce qui est une autre façon de mentir. */
  const mid = (g.plot.y0 + g.plot.y1) / 2;
  for (const d of g.dots) assert.ok(Math.abs(d.y - mid) < frameH(g) / 4, `point à ${d.y}, milieu ${mid}`);
});

test("chartGeometry : un empan déjà large sort inchangé", () => {
  /* 60 → 87,5 : la médiane vaut 75 et son plancher 11,25, qui n'a rien à dire
     sur 27,5 kg d'écart. L'axe doit rester celui d'avant #49. */
  const g = chartGeometry(SERIES, { w: 358, h: 162 }, 2.5);
  assert.deepEqual(g.grid.map((t) => t.value), [60, 70, 80, 90]);
});

test("chartGeometry : un plateau bruité se lit plat", () => {
  /* Six mois tenus à 70 kg à ±1 kg près : le pire cas, parce qu'il ne se résout
     pas avec plus de données. */
  const g = chartGeometry(oneCycle([
    { date: "2026-03-01", value: 70, kind: "normal" },
    { date: "2026-05-01", value: 71, kind: "normal" },
    { date: "2026-07-01", value: 69, kind: "normal" },
    { date: "2026-09-01", value: 70, kind: "normal" },
  ]), { w: 358, h: 162 }, 2.5);
  assert.ok(spread(g) < frameH(g) * 0.2, `amplitude ${spread(g)} sur ${frameH(g)} px de cadre`);
});

test("framed : quelques incréments font plancher sous le plancher", () => {
  /* Élévations latérales, incr 2 : 15 % d'une médiane de 12,5 ne font que
     1,9 kg, soit une graduation plus fine que le pas de l'exercice — on
     graduerait du bruit. */
  const f = framed([12, 13], 2);
  assert.ok(f.max - f.min >= 6, `empan ${f.max - f.min}`);
});

test("framed : le plancher en incréments ne s'applique qu'avec un pas d'axe", () => {
  /* En double progression la courbe trace des reps ou des secondes alors
     qu'`incr` est en kilos : ExerciseSheet passe `null`, et seul le pourcentage
     joue. Sans ça, 6 → 8 tractions se verraient imposer un axe en kilos. */
  assert.deepEqual(framed([6, 8], null), framed([6, 8], 0));
  const withIncr = framed([6, 8], 2.5), without = framed([6, 8], null);
  assert.ok(withIncr.max - withIncr.min > without.max - without.min);
});

test("framed : une valeur unique ou nulle ne fait rien exploser", () => {
  for (const vals of [[80], [0, 0], [0]]) {
    const f = framed(vals, null);
    assert.ok(Number.isFinite(f.min) && Number.isFinite(f.max) && f.max > f.min, `${vals} → ${f.min}..${f.max}`);
  }
});

test("chartGeometry : l'aplat se referme sur le bas du cadre, un par cycle", () => {
  const g = chartGeometry(SERIES, { w: 358, h: 162 }, 2.5);
  assert.equal(g.polylines.length, 2);
  for (const pl of g.polylines) {
    const pts = pl.area.split(" ").map((p) => p.split(",").map(Number));
    assert.equal(pts.length, pl.points.split(" ").length + 2, "un point d'ancrage à chaque bout");
    assert.equal(pts[0][1], g.plot.y1);
    assert.equal(pts[pts.length - 1][1], g.plot.y1);
  }
});

test("valueText et deltaText : le chiffre de tête porte son unité et son signe", () => {
  assert.equal(valueText(87.5, "kg"), "87,5 kg");
  assert.equal(valueText(45, "time"), "45 s");
  assert.equal(valueText(8, "reps"), "8 reps");
  assert.equal(deltaText(7.5, "kg"), "+7,5 kg");
  assert.equal(deltaText(-2.5, "kg"), "−2,5 kg");
  assert.equal(deltaText(0, "kg"), "0 kg", "un plateau se dit, il ne se masque pas");
});

/* ---------- Libellés de facettes et jours (#36) ---------- */

test("PATTERN_LABELS couvre les seize patterns du registre, et rien d'autre", () => {
  assert.deepEqual(Object.keys(PATTERN_LABELS).sort(), [...PATTERNS].sort());
});

test("dayName lit un décalage de 1 à 7, pas un getDay()", () => {
  assert.equal(dayName(1), "lundi");
  assert.equal(dayName(6), "samedi");
  assert.equal(dayName(7), "dimanche", "le dimanche affichait « undefined » avant #36");
  assert.equal(dayName(0), "", "0 n'est pas un jour de séance : rien, jamais « dimanche »");
  assert.equal(dayName(8), "");
});

test("weekdayName lit une date du calendrier, là où dayName lit un décalage (#39)", () => {
  /* Les deux fonctions rendent des chaînes de la même liste et répondent à
     deux questions différentes. Sur un départ le lundi elles s'accordent, ce
     qui est exactement ce qui a permis à la confusion de #39 de vivre — la
     paire du mercredi est ce qui les sépare. */
  assert.equal(weekdayName(new Date(2026, 0, 5)), "lundi");
  assert.equal(weekdayName(new Date(2026, 2, 4)), "mercredi");
  assert.equal(weekdayName(new Date(2026, 9, 25)), "dimanche", "getDay() rend 0 ; la liste commence à lundi");
  assert.equal(dayName(1), "lundi");
  assert.notEqual(weekdayName(new Date(2026, 2, 4)), dayName(1), "un mercredi de départ n'est pas « lundi »");
});

/* ---------- adviceSummary (#57) ----------

   La seule phrase que #57 fabrique : tout le reste du bloc d'avis vient mot
   pour mot de assess(). Elle est testée pour son accord en nombre, qui est
   la seule chose qu'elle puisse rater. */

test("adviceSummary : au singulier à partir d'un point", () => {
  assert.equal(adviceSummary(1), "1 point à regarder sur ce programme");
});

test("adviceSummary : au pluriel à partir de deux", () => {
  assert.equal(adviceSummary(2), "2 points à regarder sur ce programme");
  assert.equal(adviceSummary(5), "5 points à regarder sur ce programme");
});

/* Zéro ne s'affiche pas — le bloc ne rend rien quand assess() ne trouve rien.
   La règle est pinnée quand même, parce que l'accord français du zéro est
   singulier et qu'un « 0 points » écrit par erreur signalerait un compte
   devenu faux ailleurs. */
test("adviceSummary : zéro reste au singulier", () => {
  assert.equal(adviceSummary(0), "0 point à regarder sur ce programme");
});

/* ---------- Les mots d'une unité (#23) ---------- */

test("unitColumns : la colonne de charge n'existe que là où il y a une charge", () => {
  assert.deepEqual(unitColumns("kg"), ["kg", "reps", "RIR"]);
  assert.deepEqual(unitColumns("bw"), ["lest kg", "reps", "RIR"]);
  assert.deepEqual(unitColumns("carry"), ["kg", "s / côté", "RIR"]);
  assert.deepEqual(unitColumns("time"), ["s / côté", "RIR"]);
  assert.deepEqual(unitColumns("reps"), ["reps", "RIR"]);
  assert.deepEqual(unitColumns(undefined), unitColumns("kg"), "une unité absente est du kilo");
});

test("unitLoadLabel : « lest » et « / main » se composent au lieu de s'exclure", () => {
  /* L'ancien ternaire faisait du « / main » l'exclusif du kilo sans qu'aucune
     règle ne le dise — le registre n'a simplement pas d'entrée qui soit à la
     fois au poids du corps et par main. La composition reste juste le jour où
     il en aurait une. */
  assert.equal(unitLoadLabel({ unit: "bw" }), "lest kg");
  assert.equal(unitLoadLabel({ perHand: true }), "kg / main");
  assert.equal(unitLoadLabel({ unit: "carry" }), "kg");
  assert.equal(unitLoadLabel({}), "kg");
  assert.equal(unitLoadLabel({ unit: "bw", perHand: true }), "lest kg / main");
});

/* ---------- Une série faite, à l'écran (#66) ----------

   Plus strict que `normalizeSets` du moteur, et c'est voulu : le moteur dit
   qu'une série sans reps n'a pas eu lieu, l'écran dit qu'une série sans sa
   charge n'est pas finie de saisir. Les deux règles sont justes, elles ne
   répondent pas à la même question. */

test("rowIsDone : charge et reps quand l'unité porte une charge", () => {
  assert.equal(rowIsDone({ w: "80", r: "8", rir: "1" }, "kg"), true);
  assert.equal(rowIsDone({ w: "80", r: "8" }, "kg"), true, "le RIR n'entre pas dans le critère");
  assert.equal(rowIsDone({ w: "", r: "8" }, "kg"), false, "une charge manquante est une saisie à finir");
  assert.equal(rowIsDone({ w: "80", r: "" }, "kg"), false);
  assert.equal(rowIsDone({ w: "80", r: "  " }, "kg"), false, "des espaces ne sont pas une valeur");
});

test("rowIsDone : les reps seules suffisent là où il n'y a pas de charge", () => {
  assert.equal(rowIsDone({ r: "45" }, "time"), true);
  assert.equal(rowIsDone({ r: "12" }, "reps"), true);
  assert.equal(rowIsDone({ w: "", r: "" }, "time"), false);
});

test("rowIsDone : au poids du corps la charge est le lest, donc exigée", () => {
  /* `bw` porte une charge (le lest), et zéro est une valeur : une traction à
     vide se saisit « 0 », pas en laissant le champ vide. */
  assert.equal(rowIsDone({ w: "0", r: "8" }, "bw"), true);
  assert.equal(rowIsDone({ r: "8" }, "bw"), false);
});

test("rowIsDone : rien du tout", () => {
  assert.equal(rowIsDone(null, "kg"), false);
  assert.equal(rowIsDone(undefined, "kg"), false);
  assert.equal(rowIsDone({}, "kg"), false);
});

test("completedSets : compte les séries finies, pas les lignes", () => {
  const rows = [{ w: "80", r: "8" }, { w: "80", r: "7" }, { w: "80", r: "" }, {}];
  assert.equal(completedSets(rows, "kg"), 2);
  assert.equal(completedSets([], "kg"), 0);
  assert.equal(completedSets(null, "kg"), 0);
});

test("completedSets : une ligne trouée au milieu ne bloque pas le compte", () => {
  /* Le compte sert à dire « 2 séries sur 3 », pas à dire où on en est :
     `nextIdx` s'en charge sur la carte ouverte. */
  const rows = [{ w: "80", r: "8" }, { w: "", r: "" }, { w: "80", r: "8" }];
  assert.equal(completedSets(rows, "kg"), 2);
});
