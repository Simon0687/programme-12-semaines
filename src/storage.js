/* =========================================================
   Adaptateur de stockage et cycle de vie du journal (#21)

   Store injecté, jamais d'accès module-level au storage (même convention
   que backup.js, #8) : c'est ce qui rend loadJournal()/saveJournal()
   testables avec un faux store en mémoire, sans passer par window.storage
   ni localStorage.

   loadJournal() rend un verdict typé au lieu de lever, un par situation
   distinguée par l'appelant (App.jsx) :
     { ok: true,  journal, migrated: false }
     { ok: true,  journal, migrated: true, backupOk: true | false }
     { ok: false, reason: "no-store" }  // store indisponible (#21 Edge cases)
     { ok: false, reason: "absent" }    // pas de clé : première utilisation
     { ok: false, reason: "too-new" }   // écrit par une version plus récente
     { ok: false, reason: "invalid" }   // schemaVersion hors bornes (#10),
                                         // ou activeProgramId sans entrée
                                         // correspondante dans programs
     { ok: false, reason: "corrupt" }   // JSON.parse a échoué (#10)

   ctx (#16) est transmis tel quel à migrate() : ce module ne sait pas ce
   qu'il contient (aujourd'hui { legacyDefinition, buildProgram }, requis
   dès qu'une migration traverse la v2), seul schema.js en connaît la forme.
   ========================================================= */

import { migrate, withVersion } from "./schema.js";
import { validateDefinition, validateEnvelope } from "./journal-shape.js";
import { backupOnce } from "./backup.js";

export function createStore() {
  if (typeof window !== "undefined" && window.storage) return window.storage;
  try {
    const ls = window.localStorage; ls.getItem("__t");
    return {
      async get(k) { const v = ls.getItem(k); if (v == null) throw new Error("missing"); return { key: k, value: v }; },
      async set(k, v) { ls.setItem(k, v); return { key: k, value: v }; },
    };
  } catch (e) { return null; }
}

export async function loadJournal(store, key, ctx) {
  if (!store) return { ok: false, reason: "no-store" };

  let raw = null;
  try { raw = (await store.get(key, false)).value; }
  catch (e) { /* clé absente : vraiment la première utilisation */ }
  if (!raw) return { ok: false, reason: "absent" };

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { return { ok: false, reason: "corrupt" }; }

  const res = migrate(parsed, ctx);
  if (res.tooNew) return { ok: false, reason: "too-new" };
  if (!res.ok) return { ok: false, reason: "invalid" };

  /* Contrôle de forme avant toute lecture de res.data (#32). L'ordre est
     ce qui compte : c'est la déstructuration de `programs` qui levait, sur
     un journal tronqué, l'exception qui bloquait l'appli sur son spinner.
     Absorbe les cas plus anciens que validateEnvelope couvre aussi — item 5
     de #21 (activeProgramId sans entrée) et l'entrée sans définition de #26,
     App.jsx lisant `active.definition` sans repli. */
  if (validateEnvelope(res.data)) return { ok: false, reason: "invalid" };

  const { activeProgramId, programs } = res.data;

  /* Même barre qu'un fichier chargé, pour le seul cycle actif (#32, Q2) :
     depuis #26 la définition stockée n'est plus une référence vers le bundle
     mais le programme que l'appli exécute, donc rien ne justifie qu'elle soit
     moins vérifiée parce qu'elle arrive du stockage plutôt que d'un fichier.
     Les cycles inactifs ne sont pas jugés ici — ils ne sont pas exécutés, et
     les rejeter fermerait l'accès à un journal dont le cycle courant va
     parfaitement bien. */
  if (validateDefinition(programs[activeProgramId].definition)) return { ok: false, reason: "invalid" };

  const journal = { activeProgramId, programs };
  if (!res.migrated) return { ok: true, journal, migrated: false };

  const backupOk = await backupOnce(store, key, res.from, raw); // #8 : copier l'original avant d'activer la réécriture
  return { ok: true, journal, migrated: true, backupOk };
}

export async function saveJournal(store, key, journal) {
  if (!store) return { ok: false, failed: true };
  try {
    const r = await store.set(key, JSON.stringify(withVersion(journal)), false);
    return r ? { ok: true } : { ok: false, failed: false };
  } catch (e) {
    return { ok: false, failed: true };
  }
}
