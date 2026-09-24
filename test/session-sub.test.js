import test from "node:test";
import assert from "node:assert/strict";
import { prescribedVid, subVid, vidFor, isSubstituted, withSub, takenVids, slotIdsOf } from "../src/session-sub.js";
import { buildProgram } from "../src/program.js";
import { LEGACY_DEFINITION } from "../src/legacy-program.js";

/* Le programme hérité sert de banc, comme dans progression.test.js : il porte
   des créneaux à variante unique (dc : b1 === b2) et l'aplatissement
   exercices + gainage dont takenVids a besoin. */
const prog = buildProgram(LEGACY_DEFINITION);
const session = prog.SESSIONS[0];
const [firstSlot] = session.ex[0];
const [secondSlot] = session.ex[1];
const [thirdSlot] = session.ex[2];

/* ---------- prescribedVid ---------- */

test("prescribedVid : ce que le programme demande, variante de bloc comprise", () => {
  assert.equal(prescribedVid(prog, "dc", 3), prog.SLOTS.dc.b1);
  assert.equal(prescribedVid(prog, "dc", 9), prog.SLOTS.dc.b2);
});

test("prescribedVid : un créneau inconnu du bundle rend undefined, il ne lève pas", () => {
  /* Un jeté pendant le rendu ne laisse pas un écran en erreur, il démonte
     l'appli — et le journal en mémoire part avec elle. */
  assert.equal(prescribedVid(prog, "creneau-qui-nexiste-pas", 3), undefined);
  assert.equal(prescribedVid(undefined, "dc", 3), undefined);
});

/* ---------- subVid et vidFor ---------- */

test("vidFor : sans sub, l'exercice du créneau — un journal d'avant #55 se lit à l'identique", () => {
  assert.equal(vidFor(prog, {}, "dc", 3), prog.SLOTS.dc.b1);
  assert.equal(vidFor(prog, { sub: undefined }, "dc", 3), prog.SLOTS.dc.b1);
  assert.equal(vidFor(prog, null, "dc", 3), prog.SLOTS.dc.b1);
});

test("vidFor : avec un sub, le remplaçant", () => {
  const log = { sub: { dc: "dc_db" } };
  assert.equal(vidFor(prog, log, "dc", 3), "dc_db");
  assert.equal(subVid(log, "dc"), "dc_db");
});

test("deux substitutions dans la même séance s'apparient chacune à son créneau", () => {
  /* Le cas qui départage les deux réponses de Q1 : deux machines prises le
     même jour. Une déduction depuis `ex` trouverait deux entrées orphelines
     et deux créneaux vides, sans rien pour les apparier. */
  const log = { sub: { [firstSlot]: "dc_db", [secondSlot]: "pushup" } };
  assert.equal(vidFor(prog, log, firstSlot, 3), "dc_db");
  assert.equal(vidFor(prog, log, secondSlot, 3), "pushup");
  assert.equal(vidFor(prog, log, thirdSlot, 3), prescribedVid(prog, thirdSlot, 3));
});

test("vidFor : un sub que le bundle ne résout pas retombe sur le prescrit, sans lever", () => {
  /* Programme édité entre deux visites (#36) : la substitution est perdue, la
     séance reste lisible. Le contraire n'est pas un compromis acceptable. */
  const log = { sub: { dc: "exercice-retire-du-registre" } };
  assert.equal(vidFor(prog, log, "dc", 3), prog.SLOTS.dc.b1);
  assert.equal(isSubstituted(prog, log, "dc", 3), false);
});

test("vidFor : un sub mal formé est ignoré comme une absence", () => {
  for (const sub of ["dc_db", ["dc_db"], 42, { dc: "" }, { dc: 7 }, { dc: null }]) {
    assert.equal(vidFor(prog, { sub }, "dc", 3), prog.SLOTS.dc.b1, `sub = ${JSON.stringify(sub)}`);
  }
});

/* ---------- isSubstituted ---------- */

test("isSubstituted : vrai seulement quand l'exercice rendu diffère du prescrit", () => {
  assert.equal(isSubstituted(prog, {}, "dc", 3), false);
  assert.equal(isSubstituted(prog, { sub: { dc: "dc_db" } }, "dc", 3), true);
  assert.equal(isSubstituted(prog, { sub: { dc: prog.SLOTS.dc.b1 } }, "dc", 3), false);
});

/* ---------- withSub ---------- */

test("withSub : poser un remplaçant écrit l'entrée et laisse les autres", () => {
  const log = { sub: { autre: "pushup" } };
  assert.deepEqual(withSub(log, "dc", "dc_db", prog.SLOTS.dc.b1), { sub: { autre: "pushup", dc: "dc_db" } });
});

test("withSub : rechoisir le prescrit efface l'entrée, il ne l'écrit pas", () => {
  /* Une marque « substitué » posée sur l'exercice prescrit serait fausse, et
     c'est ce qui donne l'annulation sans affordance de plus. */
  const log = { sub: { dc: "dc_db", autre: "pushup" } };
  assert.deepEqual(withSub(log, "dc", prog.SLOTS.dc.b1, prog.SLOTS.dc.b1), { sub: { autre: "pushup" } });
});

test("withSub : la dernière entrée retirée retire sub — l'absence reste la forme canonique", () => {
  const log = { sub: { dc: "dc_db" } };
  assert.deepEqual(withSub(log, "dc", prog.SLOTS.dc.b1, prog.SLOTS.dc.b1), { sub: undefined });
  assert.deepEqual(withSub({}, "dc", null, prog.SLOTS.dc.b1), { sub: undefined });
});

test("withSub : n'écrit jamais dans la ligne reçue", () => {
  const log = { sub: { dc: "dc_db" } };
  withSub(log, "autre", "pushup", "prescrit");
  assert.deepEqual(log.sub, { dc: "dc_db" });
});

/* ---------- takenVids ---------- */

test("takenVids : les exercices que les autres créneaux tiennent, le créneau courant exclu", () => {
  const ids = slotIdsOf(prog, session);
  const taken = takenVids(prog, {}, ids, 3, firstSlot);
  assert.equal(taken.has(prescribedVid(prog, firstSlot, 3)), false);
  assert.equal(taken.has(prescribedVid(prog, secondSlot, 3)), true);
});

test("takenVids compte les créneaux résolus, pas les prescrits", () => {
  /* Deux substitutions en chaîne ne doivent pas rouvrir le trou qu'elles
     ferment : si le créneau 2 est passé sur « pompes », c'est « pompes » qui
     est pris, et son exercice prescrit qui est redevenu libre. */
  const log = { sub: { [secondSlot]: "pushup" } };
  const taken = takenVids(prog, log, slotIdsOf(prog, session), 3, firstSlot);
  assert.equal(taken.has("pushup"), true);
  assert.equal(taken.has(prescribedVid(prog, secondSlot, 3)), false);
});

test("slotIdsOf : les exercices puis le gainage, dans l'ordre de la séance", () => {
  const ids = slotIdsOf(prog, session);
  assert.deepEqual(ids, [...session.ex.map(([id]) => id), ...prog.CORE[session.core].ex.map(([id]) => id)]);
});

test("slotIdsOf : une séance sans gainage connu rend ses seuls exercices", () => {
  assert.deepEqual(slotIdsOf(prog, { ex: [["dc", 3]], core: "inexistant" }), ["dc"]);
  assert.deepEqual(slotIdsOf(prog, undefined), []);
});
