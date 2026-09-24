/* =========================================================
   Le bilan d'un cycle, en quelques lignes (#77)

   À la fin des douze semaines, l'écran Semaine ne disait qu'une phrase, sans
   porte. Il propose désormais de continuer (philosophie §6.7 : continuer est
   le chemin par défaut, changer de programme est une décision) — et, juste
   au-dessus, ce que le cycle a produit : les séances faites, et pour chaque
   exercice clé la charge de travail du début et celle de la fin.

   Volontairement court. La fiche exercice (#17) porte déjà les records, la
   courbe et l'historique complet ; ce bilan-ci n'a qu'une question à servir :
   « ça vaut la peine de continuer ? ».

   Lit le cycle **actif** seulement, via history() — c'est la bonne portée :
   on parle de ce cycle-ci, pas de la vie de l'exercice. Pur, ne lève pas,
   n'importe pas React (§2.4, §2.6).
   ========================================================= */

import { history, workingSets, loadText, fmt } from "./progression.js";
import { traitsOf } from "./units.js";

/* Mêmes séances écartées que la base du moteur (SKIPPED_AS_BASE,
   progression.js) : une décharge, une séance allégée ou un test ne disent pas
   ce qu'on soulève. */
const SKIPPED = new Set(["deload", "allege", "test"]);

const isObj = (x) => typeof x === "object" && x !== null && !Array.isArray(x);

/* → { done, planned, lines: [{ vid, name, first, last, text }] } */
export function cycleReview(prog, state, weeks) {
  const sessions = (prog && Array.isArray(prog.SESSIONS)) ? prog.SESSIONS : [];
  const ids = new Set(sessions.map((s) => s.id));
  const logs = state && isObj(state.logs) ? Object.values(state.logs) : [];
  const done = logs.filter((l) => isObj(l) && l.done && ids.has(l.slot)).length;
  const planned = (Number.isFinite(weeks) ? weeks : 0) * sessions.length;

  const lines = [];
  const seen = new Set();
  const keySlots = Object.entries((prog && prog.SLOTS) || {}).filter(([, s]) => isObj(s) && s.key);
  for (const [slotId, slot] of keySlots) {
    /* Les deux variantes du créneau, et toute substitution posée dessus
       (#55) : l'exercice réellement fait a sa propre ligne. */
    const vids = new Set([slot.b1, slot.b2]);
    for (const l of logs) if (isObj(l) && isObj(l.sub) && typeof l.sub[slotId] === "string") vids.add(l.sub[slotId]);
    const [mn, mx] = Array.isArray(slot.reps) ? slot.reps : [1, 99];

    for (const vid of vids) {
      if (!vid || seen.has(vid) || !prog.V || !prog.V[vid]) continue;
      const entries = history(prog, state, vid).filter((e) => !SKIPPED.has(e.kind));
      if (!entries.length) continue;
      seen.add(vid);
      const v = prog.V[vid];
      const first = workingSets(entries[0].sets, mn, mx).load;
      const last = workingSets(entries[entries.length - 1].sets, mn, mx).load;
      /* « 22 → 30 kg / main » quand l'unité se lit en kilos ; au poids du
         corps, chaque bout garde sa forme (« PDC + 5 kg → PDC + 10 kg »). */
      const t = traitsOf(v.unit);
      const text = !t.hasLoad ? null
        : t.bodyweight ? `${loadText(v, first)} → ${loadText(v, last)}`
        : `${fmt(first)} → ${loadText(v, last)}`;
      if (text) lines.push({ vid, name: v.name, first, last, text });
    }
  }
  return { done, planned, lines };
}
