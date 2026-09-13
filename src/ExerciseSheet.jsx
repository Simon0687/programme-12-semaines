/* =========================================================
   Fiche exercice — un écran par exercice, tous cycles confondus (#17)

   Regarde ce que ce composant reçoit : le journal, un identifiant
   d'exercice, un libellé et un retour. Ni `prog`, ni `week`, ni `session`.
   C'est la raison d'être du fichier : dans `App.jsx`, ces trois-là sont
   lexicalement à portée et rien n'empêcherait de les lire « juste pour
   afficher un petit détail pratique » — le jour où ça arrive, l'écran cesse
   silencieusement d'être ouvrable depuis ailleurs qu'une séance, et
   personne ne s'en aperçoit avant d'essayer. Une liste de props rend la
   contrainte vérifiable d'un coup d'œil (#17 design, question ouverte 2).

   `backLabel` est l'adresse de retour, pas un contexte : ouverte depuis un
   futur onglet « Exercices », la fiche rend exactement le même écran et
   seul ce libellé change.

   Le composant n'effectue aucun calcul : tout vient de
   `exercise-history.js` (lecture du journal) et de `display.js` (libellés
   et géométrie), qui se chargent tous deux sous `node --test`. Ce fichier
   n'émet que du balisage — c'est ce que demande ARCHITECTURE §2.6.
   ========================================================= */

import { useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import { EXERCISES } from "./registry.js";
import { exerciseHistory } from "./exercise-history.js";
import { setSummary, dateShort, periodLabel, KIND_LABELS } from "./display.js";

/* Un groupe par cycle, du plus récent au plus ancien. Les entrées arrivent
   dans l'ordre inverse : l'historique se lit en commençant par hier. */
function byCycle(entries) {
  const out = [];
  for (const e of [...entries].reverse()) {
    let g = out[out.length - 1];
    if (!g || g.programId !== e.programId) {
      g = { programId: e.programId, programName: e.programName, rows: [] };
      out.push(g);
    }
    g.rows.push(e);
  }
  return out;
}

function HistoryRow({ entry, v }) {
  const kind = KIND_LABELS[entry.kind];
  return (
    <div className="py-2 min-h-[2.5rem] flex items-center justify-between gap-2">
      <div className="text-sm text-slate-400 inline-flex items-center gap-1.5 flex-wrap">
        {dateShort(entry.date)}
        {/* Sans nom de séance — définition d'un cycle abîmé (#32) — la date
            seule suffit : c'est l'identité du log (ARCHITECTURE §2.3). */}
        {entry.sessionName && <span>· {entry.sessionName}</span>}
        {kind && <span className="rounded-full px-2 py-0.5 text-xs bg-slate-800 text-slate-300">{kind}</span>}
      </div>
      <div className="text-sm text-slate-100 text-right">{setSummary(entry.sets, v)}</div>
    </div>
  );
}

export default function ExerciseSheet({ journal, exerciseId, backLabel, onBack }) {
  const v = EXERCISES[exerciseId];
  /* Un objet neuf à chaque render défait tout useMemo qui en dépend
     (App.jsx:217-221, la même leçon qu'en #22). */
  const entries = useMemo(() => exerciseHistory(journal, exerciseId), [journal, exerciseId]);
  const groups = useMemo(() => byCycle(entries), [entries]);

  /* resolveScreen garantit un id connu ; ce repli existe pour que le
     composant ne soit pas le seul endroit du code à supposer le contraire. */
  if (!v) return null;

  return (
    <>
      <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700 px-4 pt-1 pb-2">
        <button onClick={onBack} className="h-11 -ml-2 px-2 inline-flex items-center gap-1 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded">
          <ChevronLeft size={18} />{backLabel}
        </button>
        <div className="text-xl font-semibold leading-tight">{v.name}</div>
      </div>

      <div className="px-4 pb-6">
        {entries.length === 0 ? (
          <div className="mt-6">
            <div className="text-base font-medium text-slate-100">Jamais fait.</div>
            <p className="mt-1 text-sm text-slate-400 leading-relaxed">
              Aucune série enregistrée pour cet exercice, dans aucun cycle. La première
              série validée ouvrira ici son historique.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-5 text-sm text-slate-400">Historique</div>
            {groups.map((g, i) => (
              <div key={g.programId}>
                {/* Un séparateur entre cycles, jamais de fusion : le nom de
                    séance affiché est celui de la définition épinglée de ce
                    cycle-là (#26), pas celui qu'aurait le créneau aujourd'hui. */}
                {i > 0 && (
                  <div className="flex items-center gap-2 pt-4 pb-3">
                    <div className="flex-1 h-px bg-slate-700" />
                    <div className="text-xs text-slate-500 whitespace-nowrap">
                      {g.programName ? `${g.programName} · ` : ""}
                      {periodLabel(g.rows[g.rows.length - 1].date, g.rows[0].date)}
                    </div>
                    <div className="flex-1 h-px bg-slate-700" />
                  </div>
                )}
                <div className={`divide-y divide-slate-700 border-b border-slate-700 ${i === 0 ? "mt-2 border-t" : "border-t"}`}>
                  {g.rows.map((e) => <HistoryRow key={`${e.programId}${e.date}${e.slot}`} entry={e} v={v} />)}
                </div>
              </div>
            ))}
          </>
        )}

        {v.cue && (
          <>
            <div className="mt-6 text-sm text-slate-400">Technique</div>
            <p className="mt-1 text-sm text-slate-300 leading-relaxed">{v.cue}</p>
          </>
        )}
      </div>
    </>
  );
}
