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

   #119, maquette « Fiche exercice » (E1 à E4) : trois onglets au lieu de
   cinq sections empilées, Progrès par défaut. Deux tuiles répondent à « est-ce
   que je progresse » avant toute lecture ; matériel et type remontent en
   pastilles sous le titre ; l'historique se lit en lignes condensées dont le
   détail s'ouvre au toucher ; la consigne devient des points à picto. Tant
   qu'il n'y a rien à suivre (E4), pas d'onglets : une carte d'état, puis le
   descriptif.

   Deux éléments de la maquette ne sont pas repris, faute de donnée à portée
   de cette liste de props : la pastille « ancre » et la liste « Remplace dans
   le programme » (E4) lisent le programme, et le « Prochain palier » (E3)
   supposerait une règle de lest que le moteur n'a pas.
   ========================================================= */

import { useMemo, useState } from "react";
import {
  ChevronLeft, ChevronDown, Dumbbell, Cog, PersonStanding, TrendingUp, TrendingDown, Minus, Trophy, Info, Hand,
  LineChart, ListChecks, Timer, Zap, MoveVertical, TriangleAlert, Footprints, Dot,
} from "lucide-react";
import { EXERCISES } from "./registry.js";
import { exerciseHistory, recordsFor, recordEntries, seriesByCycle, chartMode, headline } from "./exercise-history.js";
import { loadText, fmt } from "./progression.js";
import {
  setCondensed, setLine, dateShort, periodLabel, chartGeometry, axisLabel, detailRows, sheetFacts, headlineTiles,
  cuePoints, KIND_LABELS,
} from "./display.js";
import { traitsOf } from "./units.js";

const CHART = { w: 358, h: 162 };

/* Copie, pas logique : ce que la tête de fiche et la table de records
   annoncent selon l'unité de l'exercice. La règle des records est écrite sous
   la table parce qu'une table de records qu'on ne sait pas lire est un piège
   — et parce que « ou plus » est exactement ce qui la rend décroissante, et ce
   qui fait depuis #63 qu'une charge n'y figure qu'une fois. */
const COPY = {
  kg: { chart: "10RM estimé", rule: "Chaque charge une fois, au meilleur nombre de reps jamais tenu dessus." },
  carry: { chart: "Tenue et charge de la meilleure série", rule: "Chaque charge une fois, au meilleur nombre de reps jamais tenu dessus." },
  bw: { chart: "Reps et lest de la meilleure série", rule: "Chaque lest une fois, au meilleur nombre de reps jamais tenu avec lui." },
  time: { chart: "Tenue de la meilleure série", rule: "Aucune charge sur cet exercice : le record est la tenue la plus longue.", best: "Tenue" },
  reps: { chart: "Répétitions de la meilleure série", rule: "Aucune charge sur cet exercice : le record est la meilleure série.", best: "Reps" },
};

/* Les pictogrammes de la maquette, ramenés à lucide-react (déjà embarqué,
   l'appli reste hors ligne) : une famille par clé de `display.js`, jamais un
   tracé choisi dans ce fichier sans clé en face. */
const GEAR_ICONS = { free: Dumbbell, machine: Cog, body: PersonStanding };
const CUE_ICONS = {
  caution: TriangleAlert, progress: TrendingUp, power: Zap, tempo: Timer, range: MoveVertical,
  grip: Hand, stance: Footprints, posture: PersonStanding, point: Dot,
};

const CHIP = "inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[11px] tracking-[0.02em] bg-chip text-ink";

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

/* L'intertitre de la maquette : petites capitales et un picto. La hiérarchie
   se joue sur la casse et la taille (#67), le picto dit de quoi parle le bloc
   avant qu'on le lise. */
function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5 text-[11px] uppercase tracking-[0.08em] text-ink-muted">
      <Icon size={13} />{children}
    </div>
  );
}

function Tags({ facts }) {
  const Gear = GEAR_ICONS[facts.gear];
  if (!facts.equipment && !facts.type && !facts.weighted) return null;
  return (
    <div className="flex gap-1.5 flex-wrap mt-2">
      {facts.equipment && <span className={CHIP}><Gear size={12} />{facts.equipment}</span>}
      {facts.type && <span className={CHIP}>{facts.type}</span>}
      {facts.weighted && <span className={CHIP}>lestable</span>}
    </div>
  );
}

/* Les tuiles de tête (#49 puis #119). Le chiffre reste la chose la plus
   grosse de l'écran ; grisé hors fenêtre d'estimation, comme les points de la
   courbe — un chiffre calculé sur une série de 3 reps ne doit pas être la
   chose la plus assurée de la page. */
function Tiles({ tiles, dual }) {
  return (
    <div className={`grid gap-2 ${dual ? "grid-cols-3" : "grid-cols-[1.3fr_1fr]"}`}>
      {tiles.map((t) => {
        const Trend = t.trend > 0 ? TrendingUp : t.trend < 0 ? TrendingDown : Minus;
        return (
          <div key={t.label} className={`rounded-md bg-surface-raised ${dual ? "p-2.5" : "p-3"}`}>
            {t.trend != null ? (
              <div className={`flex items-center gap-1 font-medium ${t.trend > 0 ? "text-accent-ink" : "text-ink-soft"} ${dual ? "text-lg leading-tight" : "text-xl leading-8"}`}>
                <Trend size={dual ? 16 : 18} />{t.value}
              </div>
            ) : (
              <div className="flex items-baseline gap-1">
                <span className={`font-medium leading-none ${dual ? "text-2xl" : "text-[32px]"} ${t.dim ? "text-data-dim" : "text-ink"}`}>{t.value}</span>
                {t.unit && <span className="text-sm text-ink-muted">{t.unit}</span>}
              </div>
            )}
            <div className="mt-1 text-[11px] leading-snug text-ink-muted">{t.label}</div>
          </div>
        );
      })}
    </div>
  );
}

/* Le libellé n'est plus rendu au-dessus du cadre : ce sont les tuiles qui
   nomment la valeur. Il reste le nom accessible du tracé — un lecteur d'écran
   n'a pas la mise en page pour rattacher l'un à l'autre. */
function Chart({ geo, mode, label, count }) {
  return (
    <div>
      <svg width={CHART.w} height={CHART.h} viewBox={`0 0 ${CHART.w} ${CHART.h}`} className="block max-w-full" role="img" aria-label={label}>
        <defs>
          {/* `currentColor` plutôt qu'un hexadécimal : l'aplat hérite du token
              du tracé qu'il prolonge, donc les deux ne peuvent pas diverger —
              et le fichier ne code aucune couleur en dur (#51). */}
          <linearGradient id="curve-fill" className="text-data-mark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {geo.grid.map((g) => (
          <g key={g.value}>
            <line x1={geo.plot.x0} y1={g.y} x2={geo.plot.x1} y2={g.y} className="stroke-data-grid" strokeWidth="1" />
            <text x={geo.plot.x0 - 5} y={g.y + 4} textAnchor="end" className="fill-data-dim" fontSize="11">{axisLabel(g.value, mode.line)}</text>
          </g>
        ))}
        {/* L'aplat avant les barres, et non entre elles et la courbe : posé
            après, il les voilerait, or les lire ensemble est tout l'objet du
            régime `dual`. */}
        {geo.polylines.map((pl) => (
          <polygon key={`${pl.programId}-area`} points={pl.area} fill="url(#curve-fill)" />
        ))}
        {/* Les barres ensuite : la charge est le fond sur lequel se lit la
            courbe, pas l'inverse. */}
        {geo.bars.map((b) => (
          <rect key={`${b.date}-${b.x}`} x={b.x} y={b.y} width={b.w} height={b.h} rx="1" className="fill-data-bar" />
        ))}
        {geo.barTop && (
          <text x={geo.plot.x1 + 5} y={geo.barTop.y + 4} textAnchor="start" className="fill-data-dim" fontSize="11">
            {fmt(geo.barTop.value)} kg
          </text>
        )}
        {/* Une polyligne par cycle : relier deux cycles par-dessus la coupure
            inventerait une continuité qui n'a pas eu lieu. */}
        {geo.polylines.map((pl) => (
          <polyline key={pl.programId} points={pl.points} fill="none" className="stroke-data-mark" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {geo.dots.map((d) => (d.hollow
          ? <circle key={`${d.x}-${d.y}-h`} cx={d.x} cy={d.y} r="3" className={`fill-surface ${d.dim ? "stroke-data-dim" : "stroke-data-mark"}`} strokeWidth="1.5" />
          : <circle key={`${d.x}-${d.y}`} cx={d.x} cy={d.y} r="2.5" className={d.dim ? "fill-data-dim" : "fill-data-mark"} />))}
        {geo.xLabels.map((l) => (
          <text key={`${l.x}${l.label}`} x={l.x} y={CHART.h - 12} textAnchor={l.anchor} className="fill-data-dim" fontSize="11">{l.label}</text>
        ))}
      </svg>
      <div className="flex items-center gap-3 flex-wrap text-[11px] text-ink-muted mt-1">
        <span className="inline-flex items-center gap-1">
          <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" className="fill-data-mark" /></svg>séance
        </span>
        <span className="inline-flex items-center gap-1">
          <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="2.6" className="fill-surface stroke-data-mark" strokeWidth="1.3" /></svg>
          calibration / décharge
        </span>
        {geo.dots.some((d) => d.dim) && (
          <span className="inline-flex items-center gap-1">
            <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" className="fill-data-dim" /></svg>estimation peu fiable
          </span>
        )}
        {geo.barTop && (
          <span className="inline-flex items-center gap-1">
            <svg width="8" height="8" viewBox="0 0 8 8"><rect x="2" y="0" width="4" height="8" rx="1" className="fill-data-bar" /></svg>
            {mode.line === "time" ? "charge" : "lest"}
          </span>
        )}
        <span className="ml-auto">{count} séances</span>
      </div>
    </div>
  );
}

function Records({ records, v, copy }) {
  const bw = traitsOf(v.unit).bodyweight;
  const th = "py-1.5 text-left font-normal text-[11px] uppercase tracking-[0.08em] text-ink-muted";
  const date = "py-2 text-right text-ink-muted";
  return (
    <div>
      <SectionTitle icon={Trophy}>Records</SectionTitle>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-rule">
            {records.mode === "best"
              ? <th className={th}>{copy.best}</th>
              : bw ? <><th className={th}>Lest</th><th className={th}>Reps</th></> : <><th className={th}>Reps</th><th className={th}>Charge</th></>}
            <th className={`${th} text-right`}>Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {records.mode === "best" ? (
            <tr>
              <td className="py-2 font-medium text-ink">{records.best} {traitsOf(v.unit).repUnit}</td>
              <td className={date}>{dateShort(records.date)}</td>
            </tr>
          ) : records.rows.map((r) => (
            <tr key={r.reps}>
              {bw ? (
                <><td className="py-2 font-medium text-ink">{loadText(v, r.load)}</td><td className="py-2 text-ink-soft">{r.reps}</td></>
              ) : (
                <><td className="py-2 text-ink-muted">{r.reps}</td><td className="py-2 font-medium text-ink">{loadText(v, r.load)}</td></>
              )}
              <td className={date}>{dateShort(r.date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-1.5 items-start mt-1.5 text-[11px] leading-4 text-ink-faint">
        <Info size={12} className="shrink-0 mt-0.5" />{copy.rule}
      </div>
    </div>
  );
}

/* Une seule barre empilée depuis #49 : les parts somment à 1,0
   (`registry.js:35`) et `display.test.js:84` vérifie que les pourcentages
   arrondis somment à 100 sur toutes les entrées — la barre est pleine
   exactement. Le dominant est le segment le plus large et le plus clair. */
const MUSCLE_SHADES = ["bg-share-1", "bg-share-2", "bg-share-3", "bg-share-4"];
const shadeOf = (i) => MUSCLE_SHADES[i] || MUSCLE_SHADES[MUSCLE_SHADES.length - 1];

function Muscles({ rows, joints }) {
  return (
    <div>
      <SectionTitle icon={PersonStanding}>Muscles</SectionTitle>
      <div className="flex h-2 gap-0.5 rounded overflow-hidden">
        {rows.map((m, i) => <div key={m.key} className={shadeOf(i)} style={{ width: `${m.pct}%` }} />)}
      </div>
      <div className="flex gap-x-3 gap-y-1 flex-wrap mt-2 text-xs text-ink-soft">
        {rows.map((m, i) => (
          <span key={m.key} className="inline-flex items-center gap-1.5">
            <span className={`w-2 h-2 shrink-0 rounded-sm ${shadeOf(i)}`} />{m.label} {m.pct} %
          </span>
        ))}
      </div>
      {joints && (
        <div className="flex items-center gap-2 mt-2.5 text-xs text-ink-muted"><Hand size={14} />{joints}</div>
      )}
    </div>
  );
}

function Technique({ points }) {
  return (
    <div className="flex flex-col gap-2.5">
      {points.map((p) => {
        const Icon = CUE_ICONS[p.kind] || Dot;
        return (
          <div key={p.text} className="flex items-start gap-2.5 text-[13px] text-ink">
            <span className="w-7 h-7 shrink-0 rounded-md bg-chip text-accent-ink flex items-center justify-center"><Icon size={15} /></span>
            <span className="pt-1 leading-snug">{p.text}</span>
          </div>
        );
      })}
    </div>
  );
}

/* La ligne condensée, et le détail série par série au toucher (maquette E2).
   Le nom de séance passe dans le détail : les groupes par cycle suffisent à
   départager deux séances du même jour, ce que le nom faisait avant eux. Le
   trophée marque les séances qui portent un record encore dans la table. */
function HistoryRow({ entry, v, record, open, onToggle }) {
  const kind = KIND_LABELS[entry.kind];
  return (
    <div className="border-b border-rule">
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="w-full grid grid-cols-[52px_1fr_auto] gap-2 items-center py-2.5 text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-focus">
        <span className="text-xs text-ink-muted">{dateShort(entry.date)}</span>
        <span className="flex items-center gap-1.5 flex-wrap text-[13px] text-ink">
          {setCondensed(entry.sets, v)}
          {kind && <span className={`${CHIP} text-[10px]`}>{kind}</span>}
        </span>
        <span className="flex items-center gap-1.5">
          {record && <Trophy size={14} className="text-accent-ink" aria-label="record" />}
          <ChevronDown size={14} className={`text-ink-faint transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="pb-2.5 pl-[60px] text-xs text-ink-muted space-y-1">
          {entry.sessionName && <div className="text-ink-faint">{entry.sessionName}</div>}
          {/* Une série n'a pas d'autre identité que son rang. */}
          {entry.sets.map((s, i) => (
            <div key={i}>Série {i + 1} · <span className="text-ink-soft">{setLine(s, v)}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Un en-tête par cycle, le premier compris : une date n'est unique que dans
   un cycle, et rien n'empêche de valider le même jour dans deux cycles
   ouverts (constaté le 2026-09-14). */
function History({ groups, v, trophies }) {
  const [open, setOpen] = useState(null);
  return (
    <div>
      {groups.map((g) => (
        <div key={g.programId}>
          <div className="flex items-center gap-2 pt-3 pb-1.5">
            {g.programName && <span className="text-xs font-medium text-ink-soft">{g.programName}</span>}
            <span className="text-[11px] text-ink-faint">{periodLabel(g.rows[g.rows.length - 1].date, g.rows[0].date)}</span>
          </div>
          {g.rows.map((e) => {
            const k = `${e.programId}${e.date}${e.slot}`;
            return (
              <HistoryRow key={k} entry={e} v={v} record={trophies.has(e)} open={open === k}
                onToggle={() => setOpen(open === k ? null : k)} />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function ExerciseSheet({ journal, exerciseId, backLabel, onBack }) {
  const v = EXERCISES[exerciseId];
  const unit = (v && v.unit) || "kg";
  const mode = chartMode(unit);
  const [tab, setTab] = useState("progres");
  /* Un objet neuf à chaque render défait tout useMemo qui en dépend
     (App.jsx:217-221, la même leçon qu'en #22). */
  const entries = useMemo(() => exerciseHistory(journal, exerciseId), [journal, exerciseId]);
  const groups = useMemo(() => byCycle(entries), [entries]);
  const records = useMemo(() => recordsFor(entries, unit), [entries, unit]);
  const trophies = useMemo(() => recordEntries(entries, unit), [entries, unit]);
  const head = useMemo(() => headline(entries, unit), [entries, unit]);
  /* Le pas de l'**axe des valeurs**, pas celui de l'exercice : en double
     progression la courbe trace des reps ou des secondes tandis qu'`incr` est en
     kilos, et lui appliquer le plancher en incréments graduerait l'axe dans une
     unité qui n'est pas la sienne. */
  const axisIncr = mode.line === "kg" && v ? v.incr : null;
  const geo = useMemo(() => chartGeometry(seriesByCycle(entries, unit), CHART, axisIncr), [entries, unit, axisIncr]);
  /* null pour les quatre ids sans champs de sélection (#25) : une section
     absente, jamais une section vide. */
  const details = useMemo(() => detailRows(v), [v]);
  const facts = useMemo(() => sheetFacts(v), [v]);
  const points = useMemo(() => cuePoints(v && v.cue), [v]);

  /* resolveScreen garantit un id connu ; ce repli existe pour que le
     composant ne soit pas le seul endroit du code à supposer le contraire. */
  if (!v) return null;

  const copy = COPY[unit] || COPY.kg;
  const chartLabel = `${copy.chart}${v.side ? ", par côté" : ""}`;
  const n = entries.length;
  const hasRecords = records.mode === "best" ? records.best != null : records.rows.length > 0;
  const tabs = n === 0 ? [] : [["progres", "Progrès"], ["historique", "Historique"], ...(points.length ? [["technique", "Technique"]] : [])];
  const tiles = headlineTiles(head, unit, n ? entries[0].date : null, chartLabel);

  return (
    <>
      <div className="sticky top-0 z-10 bg-surface">
        <div className="px-4 pt-1 pb-3 border-b border-rule">
          <button onClick={onBack} className="h-11 -ml-2 px-2 inline-flex items-center gap-1 text-sm text-ink-soft focus:outline-none focus:ring-2 focus:ring-focus rounded">
            <ChevronLeft size={18} />{backLabel}
          </button>
          <div className="text-xl font-medium leading-tight">{v.name}</div>
          <Tags facts={facts} />
        </div>
        {tabs.length > 0 && (
          <div role="tablist" className="flex gap-4 px-4 text-[13px] border-b border-rule whitespace-nowrap">
            {tabs.map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`py-3 -mb-px border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus
                  ${tab === k ? "border-accent text-ink" : "border-transparent text-ink-muted"}`}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pt-4 pb-6 flex flex-col gap-4" style={{ fontVariantNumeric: "tabular-nums" }}>
        {n === 0 ? (
          <>
            <div className="flex gap-3 items-center p-4 rounded-lg bg-surface-raised">
              <span className="w-10 h-10 shrink-0 rounded-full bg-chip text-ink-soft flex items-center justify-center"><LineChart size={20} /></span>
              <div>
                <div className="text-[15px] font-medium text-ink">Jamais fait</div>
                <div className="text-xs text-ink-muted">La 1ʳᵉ série validée ouvre courbe et records.</div>
              </div>
            </div>
            {details && <Muscles rows={details.muscles} joints={facts.joints} />}
            {/* Hors maquette : E4 s'arrête aux muscles, mais un exercice jamais
                fait est celui dont on a le plus besoin de la consigne. */}
            {points.length > 0 && (
              <div>
                <SectionTitle icon={ListChecks}>Technique</SectionTitle>
                <Technique points={points} />
              </div>
            )}
          </>
        ) : tab === "historique" ? (
          <History groups={groups} v={v} trophies={trophies} />
        ) : tab === "technique" ? (
          <Technique points={points} />
        ) : (
          <>
            {tiles.length > 0 && <Tiles tiles={tiles} dual={mode.kind === "dual"} />}
            {/* Pas de courbe sur une seule séance : un point isolé n'est pas une
                progression. */}
            {geo && n > 1 && <Chart geo={geo} mode={mode} label={chartLabel} count={n} />}
            {n === 1 && <div className="text-[11px] text-ink-muted">1 séance validée, le {dateShort(entries[0].date)}.</div>}
            {hasRecords && <Records records={records} v={v} copy={copy} />}
            {details && <Muscles rows={details.muscles} joints={facts.joints} />}
          </>
        )}
      </div>
    </>
  );
}
