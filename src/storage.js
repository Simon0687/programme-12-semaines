/* =========================================================
   Adaptateur de stockage et cycle de vie du journal (#21)

   Store injecté, jamais d'accès module-level au storage (même convention
   que backup.js, #8) : c'est ce qui rend loadJournal()/saveJournal()
   testables avec un faux store en mémoire, sans passer par window.storage
   ni localStorage.

   loadJournal() rend un verdict typé au lieu de lever, un par situation
   distinguée par l'appelant (App.jsx) :
     { ok: true,  journal, migrated: false, dropped }
     { ok: true,  journal, migrated: true, backupOk: true | false, dropped }
     dropped = nombre de lignes de séance illisibles écartées (#32) ; une
     copie verbatim du journal d'origine est déposée sous
     <key>_backup_dropped dès qu'il est non nul.
     { ok: false, reason: "no-store" }  // store indisponible (#21 Edge cases)
     { ok: false, reason: "absent" }    // pas de clé : première utilisation
     { ok: false, reason: "too-new" }   // écrit par une version plus récente
     { ok: false, reason: "invalid", detail? } // schemaVersion hors bornes
                                         // (#10), activeProgramId sans entrée
                                         // correspondante, ou forme refusée
     { ok: false, reason: "corrupt" }   // JSON.parse a échoué (#10)

   `detail` (#38 Q4) porte la phrase du refus — chemin JSON et règle
   enfreinte — quand le verdict vient de journal-shape. Avant, les 73 rejets
   distincts du validateur arrivaient ici et en repartaient tous en
   « invalid », message jeté : le panneau Données ne pouvait dire que « ton
   journal a été refusé », jamais pourquoi. Le message était pourtant déjà
   écrit, et déjà écrit pour être **adressable** (#19) — produit puis jeté au
   dernier mètre.

   C'est un **ajout**, jamais un remplacement : `reason` garde exactement ses
   cinq valeurs, donc les quatre branches d'App.jsx ne bougent pas d'une
   ligne. C'est aussi ce qui garantit que ce changement ne peut pas casser le
   chemin de chargement.

   ctx (#16) est transmis tel quel à migrate() : ce module ne sait pas ce
   qu'il contient (aujourd'hui { legacyDefinition, buildProgram }, requis
   dès qu'une migration traverse la v2), seul schema.js en connaît la forme.
   ========================================================= */

import { migrate, withVersion } from "./schema.js";
import { sanitizeJournal, validateDefinition, validateEnvelope, validatePreMigration } from "./journal-shape.js";
import { backupDroppedOnce, backupOnce } from "./backup.js";

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

  /* Même refus d ambiguïté que du côté collé (#32) : un journal stocké dont
     le schemaVersion a disparu serait relu comme un journal v1 et perdrait ses
     cycles à la migration. */
  const badPre = validatePreMigration(parsed);
  if (badPre) return { ok: false, reason: "invalid", detail: badPre.message };

  const res = migrate(parsed, ctx);
  if (res.tooNew) return { ok: false, reason: "too-new" };
  if (!res.ok) return { ok: false, reason: "invalid" };

  /* Contrôle de forme avant toute lecture de res.data (#32). L'ordre est
     ce qui compte : c'est la déstructuration de `programs` qui levait, sur
     un journal tronqué, l'exception qui bloquait l'appli sur son spinner.
     Absorbe les cas plus anciens que validateEnvelope couvre aussi — item 5
     de #21 (activeProgramId sans entrée) et l'entrée sans définition de #26,
     App.jsx lisant `active.definition` sans repli. */
  const badEnvelope = validateEnvelope(res.data);
  if (badEnvelope) return { ok: false, reason: "invalid", detail: badEnvelope.message };

  const { activeProgramId, programs } = res.data;

  /* Même barre qu'un fichier chargé, pour le seul cycle actif (#32, Q2) :
     depuis #26 la définition stockée n'est plus une référence vers le bundle
     mais le programme que l'appli exécute, donc rien ne justifie qu'elle soit
     moins vérifiée parce qu'elle arrive du stockage plutôt que d'un fichier.
     Les cycles inactifs ne sont pas jugés ici — ils ne sont pas exécutés, et
     les rejeter fermerait l'accès à un journal dont le cycle courant va
     parfaitement bien. */
  const badDefinition = validateDefinition(programs[activeProgramId].definition);
  if (badDefinition) return { ok: false, reason: "invalid", detail: badDefinition.message };

  /* Filtrage des lignes illisibles (#32). La copie de l'original précède le
     retour : le journal rendu ici est celui que l'autosave réécrira, donc
     sans cette copie, écarter une ligne reviendrait à la supprimer du
     stockage au premier geste de l'utilisateur. Même règle que pour une
     migration (#8) — on ne réécrit jamais sans avoir mis l'original de côté. */
  const { journal, dropped } = sanitizeJournal({ activeProgramId, programs });
  if (dropped) await backupDroppedOnce(store, key, raw);

  if (!res.migrated) return { ok: true, journal, migrated: false, dropped };

  const backupOk = await backupOnce(store, key, res.from, raw); // #8 : copier l'original avant d'activer la réécriture
  return { ok: true, journal, migrated: true, backupOk, dropped };
}

/* La garde à l'écriture ferme la route par laquelle l'appli pouvait
   s'infliger elle-même le blocage que #32 corrige : withVersion({}) laisse
   tomber les champs undefined à la sérialisation et écrit littéralement
   {"schemaVersion":4} — exactement l'entrée qui, au démarrage suivant,
   faisait lever le chargement. Aucun journal trafiqué à la main n'est
   nécessaire pour y arriver, un bug d'état suffit.

   Le verdict rendu est celui qui existait déjà pour une écriture en échec,
   donc l'appelant n'a rien de nouveau à gérer : storageOk tombe, l'appli
   affiche « Non enregistré » et cesse de réécrire. Un enregistrement qui
   s'arrête en le disant vaut mieux qu'un journal détruit en silence. */
export async function saveJournal(store, key, journal) {
  if (!store) return { ok: false, failed: true };
  if (validateEnvelope(withVersion(journal))) return { ok: false, failed: true };
  try {
    const r = await store.set(key, JSON.stringify(withVersion(journal)), false);
    return r ? { ok: true } : { ok: false, failed: false };
  } catch (e) {
    return { ok: false, failed: true };
  }
}
