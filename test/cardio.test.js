import { test } from "node:test";
import assert from "node:assert/strict";

import { AFTER_HINTS, AFTER_KINDS, cardioPlan } from "../src/cardio.js";

/* #33 : AFTER_KINDS est la liste que le validateur contrôle, AFTER_HINTS ce
   que l'appli rend. Les dériver l'une de l'autre est ce qui garantit qu'un
   indice ajouté demain est accepté par le format sans qu'on y pense — et
   qu'aucune valeur acceptée ne fasse appeler undefined au rendu. */
test("AFTER_KINDS décrit exactement les indices rendus", () => {
  assert.deepEqual(AFTER_KINDS, Object.keys(AFTER_HINTS));
  assert.ok(AFTER_KINDS.length > 0);
});

test("chaque indice rend une phrase à partir du plan cardio de la semaine", () => {
  const cardio = cardioPlan(3);
  for (const kind of AFTER_KINDS) {
    const text = AFTER_HINTS[kind](cardio);
    assert.equal(typeof text, "string");
    assert.ok(text.length > 0, `${kind} rend une phrase vide`);
  }
});
