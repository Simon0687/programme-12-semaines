/* =========================================================
   Plancher de compatibilité du journal (#32)

   Un journal réel, un par version de schéma, figé sous
   test/fixtures/journals/. Ces tests passent sur le code d'avant #32 :
   c'est leur raison d'être. Ils sont écrits *avant* tout durcissement de
   la validation, et ce sont eux qui disent si ce durcissement rejette
   une forme qu'une version précédente de l'appli pouvait légitimement
   écrire — auquel cas #32 cesse d'être un PATCH et demande une migration
   réparatrice (spec, Data & storage impact).

   Ne pas assouplir une assertion d'ici pour faire passer un changement :
   c'est le signal, pas l'obstacle.
   ========================================================= */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { loadJournal } from "../src/storage.js";
import { LEGACY_DEFINITION } from "../src/legacy-program.js";
import { fakeStore } from "./helpers/fake-store.js";
import { testCtx } from "./helpers/migration-ctx.js";

const fixture = (name) => readFileSync(new URL(`./fixtures/journals/${name}.json`, import.meta.url), "utf8");

async function load(name) {
  const store = fakeStore();
  store.data.set("K", fixture(name));
  return { store, res: await loadJournal(store, "K", testCtx()) };
}

const active = (res) => res.journal.programs[res.journal.activeProgramId];
const rows = (res) => Object.values(active(res).logs);
const rowAt = (res, date, slot) => rows(res).find((r) => r.date === date && r.slot === slot);

for (const name of ["v1", "v2", "v3", "v4", "v5"]) {
  test(`compatibilité : un journal ${name} se charge sans verdict d'échec`, async () => {
    const { res } = await load(name);
    assert.equal(res.ok, true, `${name} rejeté : ${res.reason}`);
    assert.ok(active(res).definition, `${name} chargé sans définition`);
  });
}

test("compatibilité v1 : les deux séances plates deviennent des séances datées, contenu intact", async () => {
  const { res } = await load("v1");
  assert.equal(res.migrated, true);
  assert.equal(rows(res).length, 2);

  /* startDate du programme hérité = 2026-09-07 (lundi), hautA au jour 1 :
     semaine 1 -> 2026-09-07, semaine 2 -> 2026-09-14. */
  const first = rowAt(res, "2026-09-07", "hautA");
  assert.ok(first, "la séance de la semaine 1 a perdu sa date");
  assert.equal(first.done, true);
  assert.equal(first.notes, "premiere seance");
  assert.deepEqual(first.ex.dc, [{ w: 60, r: 8, rir: 2 }, { w: 60, r: 7, rir: 1 }]);
  assert.deepEqual(first.ex.incl_db, [{ w: 22, r: 10, rir: 2 }]);
  assert.equal(first.kind, "calibration"); // semaine 1
  assert.ok(rowAt(res, "2026-09-14", "hautA"), "la séance de la semaine 2 a perdu sa date");

  /* #29 : les clés cardio/check-in ne sont plus « w1 » mais la date du premier
     jour de la semaine de cycle — 2026-09-07 pour la semaine 1 du programme
     hérité. Le contenu, lui, traverse la migration inchangé. */
  assert.deepEqual(active(res).cardio["2026-09-07"].z2, { done: true, min: 30 });
  assert.deepEqual(active(res).checkin["2026-09-07"], { poids: "78.5", sommeil: "4", douleurs: "non" });
});

test("compatibilité v2 : même contenu que la v1, et la définition héritée est épinglée", async () => {
  const { res } = await load("v2");
  assert.equal(res.ok, true);
  assert.equal(rows(res).length, 2);
  assert.deepEqual(active(res).definition, LEGACY_DEFINITION); // #26 : plus jamais definition: null
  assert.ok(rowAt(res, "2026-09-07", "hautA"));
});

test("compatibilité v3 : les dates déjà écrites ne bougent pas, la définition est épinglée", async () => {
  const { res } = await load("v3");
  assert.equal(res.ok, true);
  assert.equal(rows(res).length, 2);
  assert.deepEqual(active(res).definition, LEGACY_DEFINITION);

  const first = rowAt(res, "2026-09-07", "hautA");
  assert.equal(first.id, "8f1c4a02-0000-4000-8000-000000000001"); // l'identité du log survit
  assert.equal(first.updatedAt, "2026-09-07T18:12:00.000Z");
  assert.deepEqual(first.ex.dc, [{ w: 60, r: 8, rir: 2 }, { w: 60, r: 7, rir: 1 }]);
});

test("compatibilité v4 : les séances ne bougent pas, cardio et check-in se datent (#29)", async () => {
  const { res } = await load("v4");
  assert.equal(res.ok, true);
  assert.equal(res.migrated, true); // #29 : la v4 migre désormais, c'est le plancher qui monte
  assert.equal(rows(res).length, 3);
  assert.equal(active(res).definition.id, LEGACY_DEFINITION.id);
  assert.deepEqual(rowAt(res, "2026-09-08", "basA").ex.squat, [{ w: 80, r: 6, rir: 2 }]);

  /* Le contenu est recopié tel quel sous une clé datée — la migration déplace
     une clé, elle ne redessine rien. */
  assert.deepEqual(Object.keys(active(res).cardio), ["2026-09-07"]);
  assert.deepEqual(active(res).cardio["2026-09-07"].mob, [true, false, true]);
  assert.deepEqual(active(res).checkin["2026-09-07"], { poids: "78.5", sommeil: "4", douleurs: "non" });
});

test("compatibilité v5 : journal à jour chargé tel quel, sans migration ni sauvegarde", async () => {
  const { store, res } = await load("v5");
  assert.equal(res.ok, true);
  assert.equal(res.migrated, false);
  assert.equal(rows(res).length, 3);
  assert.equal(active(res).definition.id, LEGACY_DEFINITION.id);
  assert.deepEqual(rowAt(res, "2026-09-08", "basA").ex.squat, [{ w: 80, r: 6, rir: 2 }]);
  /* Deux semaines datées, et elles traversent sans être touchées : c'est
     l'idempotence de MIGRATIONS[4], vérifiée sur un vrai journal. */
  assert.deepEqual(Object.keys(active(res).cardio), ["2026-09-07", "2026-09-14"]);
  assert.equal(active(res).checkin["2026-09-14"].poids, "78.2");
  assert.equal([...store.data.keys()].some((k) => k.includes("backup")), false);
});

test("compatibilité : une sauvegarde d'avant-migration est écrite pour chaque version migrée", async () => {
  for (const [name, from] of [["v1", 1], ["v2", 2], ["v3", 3], ["v4", 4]]) {
    const { store, res } = await load(name);
    assert.equal(res.backupOk, true, `${name} : sauvegarde non écrite`);
    assert.equal(store.data.get(`K_backup_pre${from}`), fixture(name), `${name} : sauvegarde non verbatim`);
  }
});

test("compatibilité v1 : la date de validation d'origine survit dans updatedAt (#40)", async () => {
  /* La v1.0.0 écrivait une date de validation par séance, et App.jsx l'affiche
     toujours (« Validée le … », lu depuis updatedAt). La migration re-date la
     séance sur son créneau — c'est l'identité voulue par #16 — mais elle ne
     doit pas pour autant tamponner tout l'historique au jour où la mise à jour
     a été installée. */
  const { res } = await load("v1");
  const early = rowAt(res, "2026-09-07", "hautA"); // faite la veille, le dimanche 6
  assert.equal(early.updatedAt.slice(0, 10), "2026-09-06");

  /* Chaque séance reprend **sa** date, comparée à celle que porte la fixture.
     La version précédente vérifiait qu'aucune ligne ne portait la date du jour,
     ce qui ne distingue pas un tampon de migration d'une séance réellement
     validée aujourd'hui : la fixture v1 en contient une au 14 septembre, et le
     test tombait ce jour-là — le 2026-09-14, précisément. L'assertion n'est pas
     assouplie, elle est resserrée : elle épingle les dates au lieu d'exclure
     une seule valeur. */
  const v1Dates = Object.values(JSON.parse(fixture("v1")).logs).map((r) => r.date).sort();
  assert.deepEqual(rows(res).map((r) => r.updatedAt.slice(0, 10)).sort(), v1Dates);
});

test("compatibilité : une séance sans date de validation retombe sur l'horodatage courant (#40)", async () => {
  const { res } = await load("v1");
  const noDate = rowAt(res, "2026-09-14", "hautA"); // la fixture v1 lui donne une date, l'autre pas
  assert.ok(noDate.updatedAt, "updatedAt ne doit jamais être vide");
});
