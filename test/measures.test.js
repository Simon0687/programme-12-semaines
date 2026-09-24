import test from "node:test";
import assert from "node:assert/strict";
import { measurePoints, bodyMeasures, MEASURE_INCR } from "../src/measures.js";
import { chartGeometry, framed } from "../src/display.js";
import { weekStartKey } from "../src/schema.js";

/* Un cycle qui démarre un lundi. Les clés du check-in ne sont pas écrites à
   la main : elles sont calculées comme l'application les calcule, sinon le
   test ne vérifierait que sa propre arithmétique. */
const START = "2026-08-03";
const at = (week, fields) => [weekStartKey(START, week), fields];
const checkin = (...rows) => Object.fromEntries(rows);

test("une mesure par semaine saisie, dans l'ordre du cycle", () => {
  const pts = measurePoints(checkin(
    at(3, { poids: "80" }),
    at(1, { poids: "82" }),
    at(2, { poids: "81,5" }),
  ), START, 12, "poids");
  assert.deepEqual(pts.map((p) => p.week), [1, 2, 3]);
  assert.deepEqual(pts.map((p) => p.value), [82, 81.5, 80]);
  assert.equal(pts[0].date, "2026-08-03");
});

test("une semaine sans pesée laisse un trou, jamais un zéro", () => {
  const pts = measurePoints(checkin(
    at(1, { poids: "82" }),
    at(2, { taille: "88" }),
    at(3, { poids: "" }),
    at(4, { poids: "80" }),
  ), START, 12, "poids");
  assert.deepEqual(pts.map((p) => p.week), [1, 4]);
  assert.ok(pts.every((p) => p.value > 0));
});

/* Le trou doit rester visible : c'est la date qui porte l'écart, pas le rang
   de la semaine. Deux semaines sautées éloignent deux fois plus deux points
   que deux semaines consécutives. */
test("l'écart d'un trou se voit sur l'abscisse", () => {
  const pts = measurePoints(checkin(
    at(1, { poids: "82" }), at(2, { poids: "81" }), at(4, { poids: "80" }),
  ), START, 12, "poids");
  const geo = chartGeometry([{ programId: "p", points: pts }], { w: 358, h: 162 }, MEASURE_INCR, 0);
  const [a, b, c] = geo.dots;
  assert.ok(c.x - b.x > (b.x - a.x) * 1.9, "deux semaines sautées doivent écarter deux fois plus");
});

test("une valeur nulle, négative ou illisible n'est pas une mesure", () => {
  for (const poids of ["0", "-3", "abc", "  ", null, undefined]) {
    const pts = measurePoints(checkin(at(1, { poids })), START, 12, "poids");
    assert.deepEqual(pts, [], `refusé : ${JSON.stringify(poids)}`);
  }
});

/* Une clé laissée par une startDate corrigée traîne dans le journal et ne
   correspond à aucune semaine du cycle courant. Elle ne doit pas s'inviter
   comme une treizième semaine. */
test("une entrée orpheline du journal n'ajoute pas de semaine", () => {
  const pts = measurePoints({
    ...checkin(at(1, { poids: "82" })),
    "2025-01-06": { poids: "95" },
  }, START, 12, "poids");
  assert.deepEqual(pts.map((p) => p.value), [82]);
});

test("au-delà de la dernière semaine du cycle, rien n'est lu", () => {
  const pts = measurePoints(checkin(at(12, { poids: "78" }), at(13, { poids: "77" })), START, 12, "poids");
  assert.deepEqual(pts.map((p) => p.week), [12]);
});

test("un journal sans check-in, sans date de départ ou sans semaines rend une série vide", () => {
  assert.deepEqual(measurePoints({}, START, 12, "poids"), []);
  assert.deepEqual(measurePoints(null, START, 12, "poids"), []);
  assert.deepEqual(measurePoints(checkin(at(1, { poids: "82" })), null, 12, "poids"), []);
  assert.deepEqual(measurePoints(checkin(at(1, { poids: "82" })), START, null, "poids"), []);
});

test("bodyMeasures rend les deux mesures, chacune avec sa dernière valeur", () => {
  const ms = bodyMeasures(checkin(
    at(1, { poids: "82", taille: "88" }),
    at(2, { poids: "81" }),
    at(3, { poids: "80", taille: "86" }),
  ), START, 12);
  assert.deepEqual(ms.map((m) => m.field), ["poids", "taille"]);
  const [poids, taille] = ms;
  assert.equal(poids.last, 80);
  assert.equal(poids.delta, -2);
  assert.equal(taille.last, 86);
  assert.equal(taille.delta, -2);
  assert.equal(poids.unit, "kg");
  assert.equal(taille.unit, "cm");
});

/* La variation part de la première semaine *mesurée*, pas de la semaine 1 :
   un dimanche manqué au départ ne doit pas priver le cycle de sa variation. */
test("la variation part de la première semaine mesurée", () => {
  const [poids] = bodyMeasures(checkin(at(5, { poids: "84" }), at(9, { poids: "80" })), START, 12);
  assert.equal(poids.delta, -4);
});

test("une seule mesure n'a pas de variation, aucune n'a pas de valeur", () => {
  const [un] = bodyMeasures(checkin(at(1, { poids: "82" })), START, 12);
  assert.equal(un.last, 82);
  assert.equal(un.delta, null);
  const [rien] = bodyMeasures({}, START, 12);
  assert.deepEqual(rien.points, []);
  assert.equal(rien.last, null);
  assert.equal(rien.delta, null);
});

/* Le motif de #76 : sur un poids de corps, le plancher proportionnel de la
   fiche exercice écrase la variation que le cycle cherche justement à
   produire. Ce test verrouille la raison d'être du paramètre — si quelqu'un
   remet le plancher par défaut sur ces courbes, une perte de quatre kilos
   redevient une ligne plate. */
test("l'axe d'un poids de corps se cadre sur la variation, pas sur 15 % de la médiane", () => {
  const vals = [82, 81.5, 80, 79.4, 78.2];
  const large = framed(vals, MEASURE_INCR);
  const juste = framed(vals, MEASURE_INCR, 0);
  assert.ok(large.max - large.min > 15, "le défaut reste celui de la fiche exercice");
  assert.ok(juste.max - juste.min <= 5, `empan trop large : ${juste.max - juste.min}`);
  assert.ok(juste.min <= 78.2 && juste.max >= 82, "l'axe contient toujours toutes les valeurs");
});

/* Le défaut ne bouge pas : la fiche exercice n'appelle pas avec un ratio. */
test("sans ratio passé, l'axe se comporte comme avant #76", () => {
  const vals = [60, 62, 65, 70];
  assert.deepEqual(framed(vals, 2.5), framed(vals, 2.5, 0.15));
  const geo = chartGeometry([{ programId: "p", points: vals.map((v, i) => ({ date: `2026-08-0${i + 1}`, value: v })) }], { w: 358, h: 162 }, 2.5);
  const same = chartGeometry([{ programId: "p", points: vals.map((v, i) => ({ date: `2026-08-0${i + 1}`, value: v })) }], { w: 358, h: 162 }, 2.5, 0.15);
  assert.deepEqual(geo.grid, same.grid);
});
