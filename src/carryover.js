/* =========================================================
   La charge qu'un exercice emporte dans un nouveau cycle (#74)

   Un cycle ne s'ouvrait sur aucune mémoire : le moteur (`planned()`) ne lit
   que le programme actif, donc la semaine 1 d'un nouveau cycle proposait
   « Paliers — charge devinée » après douze semaines de journal. La fiche
   exercice (#17) savait ; l'écran de séance non.

   Ce module répond à une seule question, tous cycles confondus : « à quelle
   charge cet exercice doit-il démarrer, dans un créneau qui demande cette
   fourchette de répétitions ? ». L'éditeur l'appelle à la création du cycle
   et écrit la réponse dans les charges de départ — **une valeur, jamais une
   référence** (ARCHITECTURE §2.1) : relire un ancien journal n'en dépend pas.

   Le moteur n'est pas élargi, et c'est voulu (en-tête d'exercise-history.js) :
   une série de 8 dans du 4–8 ne vaut pas une série de 8 dans du 8–12. D'où la
   règle asymétrique décidée le 2026-09-24 (docs/features/74-…/decisions-spec.md,
   Q2 = D) :

   - vers **autant ou moins** de répétitions, la charge est reprise telle
     quelle. Elle pèche par légèreté, et la progression la rattrape (+5 %
     après la calibration, puis le cran à chaque haut de fourchette) ;
   - vers **plus** de répétitions, elle est convertie par le 10RM estimé de la
     fiche, au haut de la nouvelle fourchette, et **jamais au-dessus** de la
     charge d'origine : l'estimation ne sert qu'à alléger, donc son erreur
     tombe du côté prudent. Poids du corps lesté et portage n'ont pas
     d'estimation (même raison que la fiche) : repris tels quels.

   Pur, ne lève pas, n'importe pas React (§2.4, §2.6).
   ========================================================= */

import { exerciseHistory, estimate10RM, chartMode } from "./exercise-history.js";
import { workingSets, roundTo } from "./progression.js";
import { findLog } from "./schema.js";
import { EXERCISES } from "./registry.js";
import { traitsOf } from "./units.js";

const isObj = (x) => typeof x === "object" && x !== null && !Array.isArray(x);
const isRange = (r) => Array.isArray(r) && r.length === 2 && r.every(Number.isFinite) && r[0] <= r[1];

/* Les séances qui ne peuvent pas servir de référence : c'est
   `SKIPPED_AS_BASE` de progression.js, pour la même raison — une charge
   décidée par autre chose que la progression (décharge, séance allégée,
   séance test) ne dit pas ce qu'on soulève. Recopiée plutôt qu'exportée :
   progression.js est un module sensible, et exporter sa constante pour un
   lecteur de plus n'en changerait pas le sens. */
const SKIPPED = new Set(["deload", "allege", "test"]);

/* La fourchette du créneau qui portait cet exercice dans cette séance-là,
   lue dans la définition *de ce cycle*. Substitution comprise (#55) : le
   journal écrit l'exercice réellement fait sous `log.sub[slotId]`. `null`
   quand on ne peut pas savoir — cycle sans définition, séance disparue. */
function sourceRange(journal, entry, vid) {
  const cycle = journal.programs[entry.programId];
  const program = isObj(cycle) && isObj(cycle.definition) && isObj(cycle.definition.program) ? cycle.definition.program : null;
  if (!program || !isObj(program.SLOTS) || !Array.isArray(program.SESSIONS)) return null;
  const session = program.SESSIONS.find((s) => isObj(s) && s.id === entry.slot);
  if (!session) return null;
  const rows = [
    ...(Array.isArray(session.ex) ? session.ex : []),
    ...(isObj(program.CORE) && isObj(program.CORE[session.core]) && Array.isArray(program.CORE[session.core].ex) ? program.CORE[session.core].ex : []),
  ];
  const log = isObj(cycle.logs) ? findLog(cycle.logs, entry.date, entry.slot) : null;
  const sub = log && isObj(log.sub) ? log.sub : {};
  for (const row of rows) {
    const slotId = Array.isArray(row) ? row[0] : null;
    const slot = slotId != null ? program.SLOTS[slotId] : null;
    if (!isObj(slot)) continue;
    if (sub[slotId] === vid || slot.b1 === vid || slot.b2 === vid) return isRange(slot.reps) ? slot.reps : null;
  }
  return null;
}

/* → null | { load, date, fromLoad, fromReps, converted }
   `targetRange` : la fourchette [min, max] du créneau du nouveau programme,
   ou null si on ne la connaît pas (alors pas de conversion). */
export function carriedLoad(journal, vid, targetRange) {
  const v = EXERCISES[vid];
  if (!v || !isObj(journal) || !isObj(journal.programs)) return null;
  if (!traitsOf(v.unit).hasLoad) return null; // secondes, répétitions : rien à reporter

  const entries = exerciseHistory(journal, vid);
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (SKIPPED.has(entry.kind)) continue;

    const range = sourceRange(journal, entry, vid);
    const reps = entry.sets.map((s) => s.r);
    const [mn, mx] = range || [Math.min(...reps), Math.max(...reps)];
    const work = workingSets(entry.sets, mn, mx);
    const fromLoad = work.load;
    const fromReps = Math.max(...work.sets.map((s) => s.r));

    let load = fromLoad;
    if (chartMode(v.unit).kind === "estimate" && range && isRange(targetRange) && targetRange[1] > range[1] && fromLoad > 0) {
      const top = targetRange[1];
      const conv = roundTo((estimate10RM(fromLoad, fromReps) * 40) / (30 + top), v.incr || 1);
      if (conv > 0) load = Math.min(conv, fromLoad);
    }
    return { load, date: entry.date, fromLoad, fromReps, converted: load < fromLoad };
  }
  return null;
}
