import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { anchorFor, stepsFromDelta, notchValue, notches, LONG_PRESS_MS, MOVE_CANCEL_PX, PX_PER_NOTCH } from "../src/load-picker.js";
import { num, fmt } from "../src/progression.js";
import { EXERCISES } from "../src/registry.js";

describe("anchorFor - l'ordre d'ancrage de #46", () => {
  test("la valeur saisie gagne sur le plan : un 73,75 tapé reste atteignable", () => {
    assert.equal(anchorFor(73.75, 75), 73.75);
  });

  test("sans saisie, on ancre sur la charge prevue", () => {
    assert.equal(anchorFor(null, 72.5), 72.5);
  });

  test("ni saisie ni plan : pas d'ancre, donc pas de roue", () => {
    assert.equal(anchorFor(null, null), null);
  });

  test("0 est une ancre valide (lest nul sur un exercice bw)", () => {
    assert.equal(anchorFor(0, 40), 0);
  });

  test("NaN n'est pas une ancre : num() peut rendre null, jamais NaN, mais le garde tient", () => {
    assert.equal(anchorFor(NaN, NaN), null);
  });
});

describe("stepsFromDelta", () => {
  test("monter le doigt alourdit", () => {
    assert.equal(stepsFromDelta(-PX_PER_NOTCH), 1);
    assert.equal(stepsFromDelta(-3 * PX_PER_NOTCH), 3);
  });

  test("descendre allege", () => {
    assert.equal(stepsFromDelta(2 * PX_PER_NOTCH), -2);
  });

  test("un tremblement sous le demi-cran ne bouge rien", () => {
    assert.equal(stepsFromDelta(PX_PER_NOTCH / 2 - 1), 0);
    assert.equal(stepsFromDelta(-(PX_PER_NOTCH / 2 - 1)), 0);
  });

  test("le seuil d'annulation du scroll reste en-deca d'un cran : on ne peut pas ouvrir la roue deja decalee", () => {
    assert.ok(MOVE_CANCEL_PX < PX_PER_NOTCH / 2);
  });
});

describe("notchValue - pas de derive decimale", () => {
  test("les increments du registre tombent juste", () => {
    assert.equal(notchValue(72.5, 2.5, 1), 75);
    assert.equal(notchValue(72.5, 2.5, -1), 70);
    assert.equal(notchValue(10, 1.25, 3), 13.75);
    assert.equal(notchValue(100, 10, -4), 60);
  });

  test("tous les increments du registre survivent a un aller-retour de 8 crans", () => {
    for (const v of Object.values(EXERCISES)) {
      if (!v.incr) continue;
      let x = 100;
      for (let i = 0; i < 8; i++) x = notchValue(x, v.incr, 1);
      for (let i = 0; i < 8; i++) x = notchValue(x, v.incr, -1);
      assert.equal(x, 100, `increment ${v.incr}`);
    }
  });

  test("une ancre batarde garde sa decimale sur toute la roue", () => {
    assert.equal(notchValue(73.75, 2.5, -1), 71.25);
    assert.equal(notchValue(73.75, 2.5, 1), 76.25);
  });

  test("le plancher est 0, jamais une charge negative", () => {
    assert.equal(notchValue(5, 5, -3), 0);
  });

  test("sans increment, la valeur ne bouge pas", () => {
    assert.equal(notchValue(60, undefined, 2), 60);
  });
});

describe("notches", () => {
  test("du plus lourd au plus leger, la valeur retenue au centre", () => {
    const rows = notches(72.5, 2.5, 0, 2);
    assert.deepEqual(rows.map((r) => r.value), [77.5, 75, 72.5, 70, 67.5]);
    assert.deepEqual(rows.map((r) => r.selected), [false, false, true, false, false]);
    assert.deepEqual(rows.map((r) => r.offset), [2, 1, 0, -1, -2]);
  });

  test("la roue suit les crans deja parcourus", () => {
    const rows = notches(72.5, 2.5, 2, 1);
    assert.deepEqual(rows.map((r) => r.value), [80, 77.5, 75]);
    assert.equal(rows.find((r) => r.selected).value, 77.5);
  });

  test("les crans ecretes par le plancher sont marques, pas dessines comme des choix", () => {
    const rows = notches(2.5, 2.5, -1, 2);
    assert.equal(rows.find((r) => r.selected).value, 0);
    const dup = rows.filter((r) => r.clamped);
    assert.equal(dup.length, 2);
    assert.ok(dup.every((r) => r.value === 0));
  });
});

describe("l'ecriture passe par le format existant", () => {
  test("un cran produit la chaine que le clavier aurait produite", () => {
    assert.equal(fmt(notchValue(70, 2.5, 1)), "72,5");
    assert.equal(num(fmt(notchValue(70, 2.5, 1))), 72.5);
  });

  test("aller-retour fmt/num sur une ancre batarde", () => {
    assert.equal(num(fmt(notchValue(73.75, 2.5, 0))), 73.75);
  });
});

test("le delai d'ouverture est celui de l'issue", () => {
  assert.equal(LONG_PRESS_MS, 180);
});
