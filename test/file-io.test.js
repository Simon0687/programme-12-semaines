import test from "node:test";
import assert from "node:assert/strict";
import { saveFile, readFile } from "../src/file-io.js";

/* Faux environnement navigateur, miroir de ce que App.jsx injectera
   ({ nav: navigator, doc: document, url: URL }). Aucun DOM n'est requis :
   c'est tout l'intérêt de l'injection (ARCHITECTURE §2.7). */
function fakeDoc() {
  const clicks = [];
  const el = {
    href: "",
    download: "",
    click() { clicks.push({ href: el.href, download: el.download }); },
  };
  return { clicks, createElement: () => el, body: { appendChild() {}, removeChild() {} } };
}

function fakeUrl() {
  const created = [];
  const revoked = [];
  return {
    created,
    revoked,
    createObjectURL(blob) { created.push(blob); return "blob:fake"; },
    revokeObjectURL(href) { revoked.push(href); },
  };
}

const abort = () => { const e = new Error("cancelled"); e.name = "AbortError"; return e; };
const payload = { name: "prog12-journal-2026-10-04.json", content: "{\"a\":1}", type: "application/json" };

test("saveFile : partage résolu => via share, rien n'est téléchargé", async () => {
  const doc = fakeDoc();
  const shared = [];
  const nav = { canShare: () => true, share: async (d) => { shared.push(d); } };

  const res = await saveFile({ nav, doc, url: fakeUrl() }, payload);

  assert.deepEqual(res, { ok: true, via: "share" });
  assert.equal(shared.length, 1);
  assert.equal(shared[0].files[0].name, payload.name);
  assert.equal(doc.clicks.length, 0);
});

test("saveFile : partage annulé => cancelled, et pas de repli en téléchargement", async () => {
  const doc = fakeDoc();
  const nav = { canShare: () => true, share: async () => { throw abort(); } };

  const res = await saveFile({ nav, doc, url: fakeUrl() }, payload);

  assert.deepEqual(res, { ok: false, reason: "cancelled" });
  /* Une annulation est une décision de l'utilisateur : lui imposer un
     téléchargement derrière serait passer outre. */
  assert.equal(doc.clicks.length, 0);
});

test("saveFile : partage refusé pour une autre raison => repli sur l'ancre", async () => {
  const doc = fakeDoc();
  const nav = { canShare: () => true, share: async () => { throw new Error("NotAllowedError"); } };

  const res = await saveFile({ nav, doc, url: fakeUrl() }, payload);

  assert.deepEqual(res, { ok: true, via: "download" });
  assert.equal(doc.clicks.length, 1);
});

test("saveFile : canShare refuse les fichiers => ancre, share jamais appelé", async () => {
  const doc = fakeDoc();
  let called = false;
  const nav = { canShare: () => false, share: async () => { called = true; } };

  const res = await saveFile({ nav, doc, url: fakeUrl() }, payload);

  assert.deepEqual(res, { ok: true, via: "download" });
  assert.equal(called, false);
});

test("saveFile : pas de navigator => ancre", async () => {
  const doc = fakeDoc();
  const res = await saveFile({ nav: null, doc, url: fakeUrl() }, payload);
  assert.deepEqual(res, { ok: true, via: "download" });
});

test("saveFile : l'ancre porte le nom de fichier demandé", async () => {
  const doc = fakeDoc();
  const url = fakeUrl();

  await saveFile({ nav: null, doc, url }, payload);

  assert.equal(doc.clicks[0].download, payload.name);
  assert.equal(doc.clicks[0].href, "blob:fake");
  assert.equal(url.created.length, 1);
});

test("saveFile : ni partage ni document => unsupported", async () => {
  const res = await saveFile({ nav: null, doc: null, url: fakeUrl() }, payload);
  assert.deepEqual(res, { ok: false, reason: "unsupported" });
});

test("saveFile : URL sans createObjectURL => unsupported", async () => {
  const res = await saveFile({ nav: null, doc: fakeDoc(), url: {} }, payload);
  assert.deepEqual(res, { ok: false, reason: "unsupported" });
});

test("saveFile : env absent => unsupported, sans lever", async () => {
  const res = await saveFile(undefined, payload);
  assert.deepEqual(res, { ok: false, reason: "unsupported" });
});

/* ---------- readFile ---------- */

function fakeReader(outcome, value) {
  return class {
    readAsText() {
      queueMicrotask(() => {
        if (outcome === "load") { this.result = value; this.onload(); }
        else { this.onerror(); }
      });
    }
  };
}

test("readFile : lecture réussie => ok et texte", async () => {
  const res = await readFile({}, fakeReader("load", "{\"a\":1}"));
  assert.deepEqual(res, { ok: true, text: "{\"a\":1}" });
});

test("readFile : lecture en échec => unreadable, jamais une exception", async () => {
  const res = await readFile({}, fakeReader("error"));
  assert.deepEqual(res, { ok: false, reason: "unreadable" });
});

test("readFile : pas de FileReader => unsupported", async () => {
  const res = await readFile({}, null);
  assert.deepEqual(res, { ok: false, reason: "unsupported" });
});
