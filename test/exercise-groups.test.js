import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { MUSCLE_BUCKETS, matchesBucket } from "../src/exercise-groups.js";
import { EXERCISES, MUSCLE_GROUPS } from "../src/registry.js";

describe("MUSCLE_BUCKETS", () => {
  test("chaque groupe cité existe dans le registre, et aucun n'est cité deux fois", () => {
    const seen = new Set();
    for (const [key, label, groups] of MUSCLE_BUCKETS) {
      assert.ok(key && label, "clé et libellé non vides");
      assert.ok(groups.length > 0, `${key} : au moins un groupe`);
      for (const g of groups) {
        assert.ok(MUSCLE_GROUPS.includes(g), `${key} cite un groupe inconnu : ${g}`);
        assert.ok(!seen.has(g), `${g} apparaît dans deux buckets`);
        seen.add(g);
      }
    }
  });

  test("chaque bucket rend au moins une entrée du registre", () => {
    for (const [key] of MUSCLE_BUCKETS) {
      const hit = Object.values(EXERCISES).some((e) => matchesBucket(e, key));
      assert.ok(hit, `${key} : aucune entrée`);
    }
  });
});

describe("matchesBucket", () => {
  test("aucun bucket (chaîne vide ou absent) : tout correspond", () => {
    for (const e of Object.values(EXERCISES)) {
      assert.equal(matchesBucket(e, ""), true);
      assert.equal(matchesBucket(e, undefined), true);
    }
  });

  test("un bucket inconnu ne filtre rien plutôt que de tout rejeter", () => {
    assert.equal(matchesBucket(EXERCISES.dc, "cou"), true);
  });

  test("le développé couché est dans Pecs, pas dans Jambes", () => {
    assert.equal(matchesBucket(EXERCISES.dc, "pecs"), true);
    assert.equal(matchesBucket(EXERCISES.dc, "jambes"), false);
  });

  test("un exercice sans champ muscles ne correspond à aucun bucket réel", () => {
    const bare = { name: "test" };
    for (const [key] of MUSCLE_BUCKETS) assert.equal(matchesBucket(bare, key), false);
  });
});
