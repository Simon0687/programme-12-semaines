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
import { exerciseHistory, recordsFor, seriesByCycle, chartMode, ESTIMATE_REPS } from "./exercise-history.js";
import { loadText, fmt } from "./progression.js";
import { setSummary, dateShort, periodLabel, chartGeometry, axisLabel, detailRows, KIND_LABELS } from "./display.js";

const CHART = { w: 358, h: 162 };

/* Copie, pas logique : ce que l'axe et la table de records annoncent selon
   l'unité de l'exercice. La règle des records est écrite sous la table
   parce qu'une table de records qu'on ne sait pas lire est un piège — et
   parce que « ou plus » est exactement ce qui la rend décroissante. */
const COPY = {
  kg: {
    chart: "10RM estimé",
    note: `Charge estimée pour dix répétitions, calculée sur la meilleure série du jour. Grisée en dessous de ${ESTIMATE_REPS.min} reps ou au-dessus de ${ESTIMATE_REPS.max}, où l'estimation cesse d'être crédible.`,
    rule: "Charge la plus lourde jamais portée sur ce nombre de reps ou plus.",
  },
  carry: {
    chart: "Tenue et charge de la meilleure série",
    note: "Deux progressions sur une même abscisse : la tenue en courbe, la charge en barres. Aucune estimation ici — extrapoler une charge portée sur un temps donnerait un résultat qui ne veut rien dire.",
    rule: "Charge la plus lourde jamais portée sur ce nombre de reps ou plus.",
  },
  bw: {
    chart: "Reps et lest de la meilleure série",
    note: "Deux progressions sur une même abscisse : les reps en courbe, le lest en barres. Aucune estimation ici — un 10RM calculé sur six tractions donnerait un lest négatif.",
    rule: "Lest le plus lourd jamais porté sur ce nombre de reps ou plus.",
  },
  time: { chart: "Tenue de la meilleure série", rule: "Aucune charge sur cet exercice : le record est la tenue la plus longue.", best: "Meilleure tenue" },
  reps: { chart: "Répétitions de la meilleure série", rule: "Aucune charge sur cet exercice : le record est la meilleure série.", best: "Meilleure série" },
};

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

function Chart({ geo, mode, label, note }) {
  return (
    <>
      <div className="mt-5 text-sm text-slate-400">{label}</div>
      <svg width={CHART.w} height={CHART.h} viewBox={`0 0 ${CHART.w} ${CHART.h}`} className="block mt-1 max-w-full" role="img" aria-label={label}>
        {geo.grid.map((g) => (
          <g key={g.value}>
            <line x1={geo.plot.x0} y1={g.y} x2={geo.plot.x1} y2={g.y} className="stroke-slate-800" strokeWidth="1" />
            <text x={geo.plot.x0 - 5} y={g.y + 4} textAnchor="end" className="fill-slate-500" fontSize="11">{axisLabel(g.value, mode.line)}</text>
          </g>
        ))}
        {/* Les barres d'abord : la charge est le fond sur lequel se lit la
            courbe, pas l'inverse. */}
        {geo.bars.map((b) => (
          <rect key={`${b.date}-${b.x}`} x={b.x} y={b.y} width={b.w} height={b.h} rx="1" className="fill-slate-700" />
        ))}
        {geo.barTop && (
          <text x={geo.plot.x1 + 5} y={geo.barTop.y + 4} textAnchor="start" className="fill-slate-500" fontSize="11">
            {fmt(geo.barTop.value)} kg
          </text>
        )}
        {/* Une polyligne par cycle : relier deux cycles par-dessus la coupure
            inventerait une continuité qui n'a pas eu lieu. */}
        {geo.polylines.map((pl) => (
          <polyline key={pl.programId} points={pl.points} fill="none" className="stroke-amber-400" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {geo.dots.map((d) => (d.hollow
          ? <circle key={`${d.x}-${d.y}-h`} cx={d.x} cy={d.y} r="3" className={`fill-slate-900 ${d.dim ? "stroke-slate-500" : "stroke-amber-400"}`} strokeWidth="1.5" />
          : <circle key={`${d.x}-${d.y}`} cx={d.x} cy={d.y} r="2.5" className={d.dim ? "fill-slate-500" : "fill-amber-400"} />))}
        {geo.xLabels.map((l) => (
          <text key={`${l.x}${l.label}`} x={l.x} y={CHART.h - 12} textAnchor={l.anchor} className="fill-slate-500" fontSize="11">{l.label}</text>
        ))}
      </svg>
      <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500 mt-0.5">
        <span className="inline-flex items-center gap-1.5">
          <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" className="fill-amber-400" /></svg>séance
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="2.6" className="fill-slate-900 stroke-amber-400" strokeWidth="1.3" /></svg>
          calibration ou décharge
        </span>
        {geo.dots.some((d) => d.dim) && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" className="fill-slate-500" /></svg>estimation peu fiable
          </span>
        )}
        {geo.barTop && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="8" height="8" viewBox="0 0 8 8"><rect x="2" y="0" width="4" height="8" rx="1" className="fill-slate-700" /></svg>
            {mode.line === "time" ? "charge" : "lest"}
          </span>
        )}
      </div>
      {note && <p className="mt-1.5 text-xs text-slate-500 leading-4">{note}</p>}
    </>
  );
}

function Records({ records, v, copy }) {
  const cell = "flex items-center h-10 border-b border-slate-700";
  return (
    <>
      <div className="mt-6 text-sm text-slate-400">Records</div>
      <div className="mt-0.5 text-xs text-slate-500 leading-4">{copy.rule}</div>
      <div className="mt-2 border-t border-slate-700">
        {records.mode === "best" ? (
          <div className={`${cell} justify-between gap-2`}>
            <div className="text-sm text-slate-400">{copy.best}</div>
            <div className="flex items-center gap-4">
              <span className="text-[15px] font-medium text-slate-100">{records.best}{v.unit === "time" ? " s" : " reps"}</span>
              <span className="text-sm text-slate-400">{dateShort(records.date)}</span>
            </div>
          </div>
        ) : records.rows.map((r) => (
          <div key={r.reps} className={`${cell} gap-2`}>
            <div className="w-16 shrink-0 text-sm text-slate-400">{r.reps} reps</div>
            <div className="flex-1 min-w-0 text-[15px] font-medium text-slate-100">{loadText(v, r.load)}</div>
            <div className="text-sm text-slate-400">{dateShort(r.date)}</div>
          </div>
        ))}
      </div>
    </>
  );
}

/* Muscles, équipement, articulations, type : aucune donnée nouvelle, tout
   vient de EXERCISES[id]. #25 avait stocké ces champs pour un générateur et
   aucun écran ne les avait jamais lus. Le muscle dominant en ambre, les
   autres en gris : c’est la distinction principal/secondaire, sans légende à
   lire ni anneau à déchiffrer pour trois valeurs. */
function Details({ rows }) {
  const label = "w-36 shrink-0 text-sm text-slate-400";
  return (
    <>
      <div className="mt-6 text-sm text-slate-400">Détails</div>
      <div className="mt-2 flex flex-col gap-1.5">
        {rows.muscles.map((m) => (
          <div key={m.key} className="flex items-center gap-2.5">
            <div className="w-36 shrink-0 text-sm text-slate-300">{m.label}</div>
            <div className="flex-1 h-1.5 rounded-full bg-slate-800">
              <div className={`h-1.5 rounded-full ${m.dominant ? "bg-amber-400" : "bg-slate-600"}`} style={{ width: `${m.pct}%` }} />
            </div>
            <div className="w-10 text-right text-sm text-slate-400">{m.pct} %</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        {rows.equipement && <div className="flex gap-2.5"><div className={label}>Équipement</div><div className="text-sm text-slate-300">{rows.equipement}</div></div>}
        {rows.articulations && <div className="flex gap-2.5"><div className={label}>Articulations</div><div className="text-sm text-slate-300">{rows.articulations}</div></div>}
        {rows.type && <div className="flex gap-2.5"><div className={label}>Type</div><div className="text-sm text-slate-300">{rows.type}</div></div>}
      </div>
    </>
  );
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
  const unit = (v && v.unit) || "kg";
  const mode = chartMode(unit);
  /* Un objet neuf à chaque render défait tout useMemo qui en dépend
     (App.jsx:217-221, la même leçon qu'en #22). */
  const entries = useMemo(() => exerciseHistory(journal, exerciseId), [journal, exerciseId]);
  const groups = useMemo(() => byCycle(entries), [entries]);
  const records = useMemo(() => recordsFor(entries, unit), [entries, unit]);
  const geo = useMemo(() => chartGeometry(seriesByCycle(entries, unit), CHART), [entries, unit]);
  /* null pour les quatre ids sans champs de sélection (#25) : une section
     absente, jamais une section vide. */
  const details = useMemo(() => detailRows(v), [v]);

  /* resolveScreen garantit un id connu ; ce repli existe pour que le
     composant ne soit pas le seul endroit du code à supposer le contraire. */
  if (!v) return null;

  const copy = COPY[unit] || COPY.kg;
  const n = entries.length;
  const hasRecords = records.mode === "best" ? records.best != null : records.rows.length > 0;

  return (
    <>
      <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700 px-4 pt-1 pb-2">
        <button onClick={onBack} className="h-11 -ml-2 px-2 inline-flex items-center gap-1 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded">
          <ChevronLeft size={18} />{backLabel}
        </button>
        <div className="text-xl font-semibold leading-tight">{v.name}</div>
      </div>

      <div className="px-4 pb-6" style={{ fontVariantNumeric: "tabular-nums" }}>
        {n === 0 ? (
          <div className="mt-6">
            <div className="text-base font-medium text-slate-100">Jamais fait.</div>
            <p className="mt-1 text-sm text-slate-400 leading-relaxed">
              Aucune série enregistrée pour cet exercice, dans aucun cycle. La première
              série validée ouvrira ici sa courbe, ses records et son historique.
            </p>
          </div>
        ) : (
          <>
            {/* Pas de courbe sur une seule séance : un point isolé n'est pas une
                progression, et la liste en dessous le dit déjà. */}
            {geo && n > 1 && <Chart geo={geo} mode={mode} note={copy.note} label={`${copy.chart}${v.side ? ", par côté" : ""}`} />}
            <div className="mt-1.5 text-xs text-slate-500">
              {n} séance{n > 1 ? "s" : ""} validée{n > 1 ? "s" : ""} depuis le {dateShort(entries[0].date)}.
            </div>

            {hasRecords && <Records records={records} v={v} copy={copy} />}

            <div className="mt-6 text-sm text-slate-400">Historique</div>
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

        {details && <Details rows={details} />}
      </div>
    </>
  );
}
