/* =========================================================
   Les courbes du check-in — poids et tour de taille (#76)

   N'émet que du balisage. La lecture du journal est dans `measures.js`, la
   géométrie dans `chartGeometry` (display.js) — la même que la fiche
   exercice, paramètre d'axe mis à part (ARCHITECTURE §2.6).

   Deux cadres et non deux tracés dans un seul : des kilos et des centimètres
   partagent l'ordre de grandeur mais pas l'unité, et un axe unique les
   ferait lire l'un par l'autre. Le cadre est plus court que celui de la
   fiche exercice (120 px contre 162) parce qu'il vit dans une section
   repliée sous un formulaire de huit champs, et qu'il répond à une question
   plus simple : ça monte ou ça descend.

   Sous deux points, pas de cadre vide : la valeur seule. Un cadre à un point
   n'est pas une courbe, c'est une décoration qui promet une progression que
   personne n'a encore produite — la même règle qu'en fiche exercice.
   ========================================================= */

import { dateShort, chartGeometry } from "./display.js";
import { MEASURE_INCR, measureValueText, measureDeltaText } from "./measures.js";

const BOX = { w: 358, h: 120, padL: 34, padT: 8, padB: 24, padR: 0 };

/* Le plancher proportionnel de la fiche exercice écraserait la variation :
   15 % de 82 kg font douze kilos (display.js, MIN_SPAN_RATIO). Ici l'empan
   minimal ne vient que du cran de la mesure. */
const SPAN_RATIO = 0;

function Curve({ points, label }) {
  const geo = chartGeometry([{ programId: label, points }], BOX, MEASURE_INCR, SPAN_RATIO);
  if (!geo) return null;
  return (
    <svg width={BOX.w} height={BOX.h} viewBox={`0 0 ${BOX.w} ${BOX.h}`} className="block mt-2 max-w-full" role="img" aria-label={label}>
      {geo.grid.map((g) => (
        <g key={g.value}>
          <line x1={geo.plot.x0} y1={g.y} x2={geo.plot.x1} y2={g.y} className="stroke-data-grid" strokeWidth="1" />
          <text x={geo.plot.x0 - 5} y={g.y + 4} textAnchor="end" className="fill-data-dim" fontSize="11">{g.value}</text>
        </g>
      ))}
      {geo.polylines.map((pl) => (
        <polyline key={pl.programId} points={pl.points} fill="none" className="stroke-data-mark" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {geo.dots.map((d) => (
        <circle key={`${d.x}-${d.y}`} cx={d.x} cy={d.y} r="2.5" className="fill-data-mark" />
      ))}
      {geo.xLabels.map((l) => (
        <text key={`${l.x}${l.label}`} x={l.x} y={BOX.h - 8} textAnchor={l.anchor} className="fill-data-dim" fontSize="11">{l.label}</text>
      ))}
    </svg>
  );
}

function Measure({ data }) {
  const { label, unit, points, last, delta } = data;
  const delta_ = measureDeltaText(delta, unit);
  return (
    <div className="mt-4 first:mt-2">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-xs uppercase tracking-wider text-ink-muted">{label}</div>
        <div className="text-sm text-ink">
          {measureValueText(last, unit)}
          {delta_ && <span className="ml-2 text-ink-muted">{delta_} depuis le {dateShort(points[0].date)}</span>}
        </div>
      </div>
      {points.length > 1
        ? <Curve points={points} label={`${label} par semaine, en ${unit}`} />
        : (
          <p className="mt-1 text-xs text-ink-faint leading-4">
            {points.length === 0
              ? "Pas encore saisi dans ce cycle."
              : `Une seule semaine saisie, le ${dateShort(points[0].date)}. La courbe s'ouvrira au deuxième dimanche rempli.`}
          </p>
        )}
    </div>
  );
}

export default function MeasureCharts({ measures }) {
  return (
    <div style={{ fontVariantNumeric: "tabular-nums" }}>
      {measures.map((m) => <Measure key={m.field} data={m} />)}
    </div>
  );
}
