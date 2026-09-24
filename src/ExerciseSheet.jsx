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
import { exerciseHistory, recordsFor, seriesByCycle, chartMode, headline, ESTIMATE_REPS } from "./exercise-history.js";
import { loadText, fmt } from "./progression.js";
import { setSummary, dateShort, periodLabel, chartGeometry, axisLabel, detailRows, valueText, deltaText, KIND_LABELS } from "./display.js";
import { traitsOf } from "./units.js";

const CHART = { w: 358, h: 162 };

/* Copie, pas logique : ce que l'axe et la table de records annoncent selon
   l'unité de l'exercice. La règle des records est écrite sous la table
   parce qu'une table de records qu'on ne sait pas lire est un piège — et
   parce que « ou plus » est exactement ce qui la rend décroissante, et ce qui
   fait depuis #63 qu'une charge n'y figure qu'une fois. La phrase dit donc la
   règle de lecture, ligne à ligne, et non le calcul qui la produit. */
/* #67 : « 10RM estimé », « Records », « Historique », « Technique »,
   « Détails » — cinq titres au même poids que les chiffres qu'ils
   introduisent, et la page se lisait comme cinq dalles. #49 avait sorti le
   chiffre de tête de cette égalité en le passant à 32 px ; les quatre
   intertitres restants descendent ici d'un cran, en petites capitales.

   Ils ne disparaissent pas : un intertitre en petites capitales se repère à sa
   forme avant de se lire, ce qu'un libellé de 14 px au milieu de valeurs de
   14 px ne fait pas. La hiérarchie se joue sur la casse et la taille, pas sur
   une couleur de plus — l'écran n'a toujours qu'un ambre, celui de la courbe.

   La forme n'est pas inventée ici : c'est exactement celle des intertitres de
   groupe de l'index du Plan (`PlanIndex`, #62). Deux écrans qui nomment un
   groupe de contenus doivent le nommer pareil. */
const SECTION = "mt-6 text-xs uppercase tracking-wider text-ink-muted";

const COPY = {
  kg: {
    chart: "10RM estimé",
    note: `Charge estimée pour dix répétitions, calculée sur la meilleure série du jour. Grisée en dessous de ${ESTIMATE_REPS.min} reps ou au-dessus de ${ESTIMATE_REPS.max}, où l'estimation cesse d'être crédible.`,
    rule: "Chaque charge une fois, au meilleur nombre de reps jamais tenu dessus.",
  },
  carry: {
    chart: "Tenue et charge de la meilleure série",
    note: "Deux progressions sur une même abscisse : la tenue en courbe, la charge en barres. Aucune estimation ici — extrapoler une charge portée sur un temps donnerait un résultat qui ne veut rien dire.",
    rule: "Chaque charge une fois, au meilleur nombre de reps jamais tenu dessus.",
  },
  bw: {
    chart: "Reps et lest de la meilleure série",
    note: "Deux progressions sur une même abscisse : les reps en courbe, le lest en barres. Aucune estimation ici — un 10RM calculé sur six tractions donnerait un lest négatif.",
    rule: "Chaque lest une fois, au meilleur nombre de reps jamais tenu avec lui.",
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

/* Le libellé n'est plus rendu au-dessus du cadre : c'est la tête de fiche qui
   nomme la valeur depuis #49. Il reste le nom accessible du tracé — un lecteur
   d'écran n'a pas la mise en page pour rattacher l'un à l'autre. */
function Chart({ geo, mode, label, note }) {
  return (
    <>
      <svg width={CHART.w} height={CHART.h} viewBox={`0 0 ${CHART.w} ${CHART.h}`} className="block mt-3 max-w-full" role="img" aria-label={label}>
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
      <div className="flex items-center gap-3 flex-wrap text-xs text-ink-faint mt-0.5">
        <span className="inline-flex items-center gap-1.5">
          <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" className="fill-data-mark" /></svg>séance
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="2.6" className="fill-surface stroke-data-mark" strokeWidth="1.3" /></svg>
          calibration ou décharge
        </span>
        {geo.dots.some((d) => d.dim) && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" className="fill-data-dim" /></svg>estimation peu fiable
          </span>
        )}
        {geo.barTop && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="8" height="8" viewBox="0 0 8 8"><rect x="2" y="0" width="4" height="8" rx="1" className="fill-data-bar" /></svg>
            {mode.line === "time" ? "charge" : "lest"}
          </span>
        )}
      </div>
      {note && <p className="mt-1.5 text-xs text-ink-faint leading-4">{note}</p>}
    </>
  );
}

/* Le seul chiffre que cet écran existe pour donner, rendu comme tel (#49).
   Avant, « 10RM estimé » était un titre de section de 14 px comme les quatre
   autres : la page se lisait en cinq dalles de même poids et « est-ce que je
   progresse » n'avait aucune réponse visuelle. Le libellé n'a pas disparu, il
   est passé sous le nombre et en plus petit — il nomme la valeur au lieu de lui
   disputer la place.

   La variation nomme sa base. « Depuis le début de ce cycle » et « depuis la
   première séance » sont deux nombres différents et le lecteur ne peut pas
   deviner lequel il regarde ; c'est la seconde qui est affichée, et elle le
   dit. La date correspondante est juste dessous, dans le compte de séances. */
function Headline({ data, mode, label }) {
  const unit = mode.line;
  return (
    <div className="mt-5">
      <div className="flex items-baseline gap-2.5 flex-wrap">
        {/* Grisé hors fenêtre d'estimation, comme les points de la courbe : un
            chiffre calculé sur une série de 3 reps ne doit pas être la chose la
            plus assurée de l'écran. */}
        <span className={`text-[32px] leading-none font-semibold ${data.dim ? "text-data-dim" : "text-ink"}`}>
          {valueText(data.value, unit)}
        </span>
        {/* En double progression, la valeur de la courbe seule effacerait ce qui
            la rend lisible : 8 tractions à vide et 8 à +20 kg s'écriraient
            pareil. */}
        {mode.kind === "dual" && data.bar > 0 && (
          <span className="text-base text-ink-soft">
            {mode.line === "time" ? "charge" : "lest"} {fmt(data.bar)} kg
          </span>
        )}
      </div>
      <div className="mt-1.5 text-sm text-ink-muted">
        {label}
        {/* Absente sur une seule séance — elle *est* la base, et « +0 »
            annoncerait un plateau au lieu d'une absence de recul. */}
        {data.delta != null && (
          <> · <span className="text-ink-soft">{deltaText(data.delta, unit)}</span> depuis la première séance</>
        )}
      </div>
    </div>
  );
}

function Records({ records, v, copy }) {
  const cell = "flex items-center h-10 border-b border-rule";
  return (
    <>
      <div className={SECTION}>Records</div>
      <div className="mt-0.5 text-xs text-ink-faint leading-4">{copy.rule}</div>
      <div className="mt-2 border-t border-rule">
        {records.mode === "best" ? (
          <div className={`${cell} justify-between gap-2`}>
            <div className="text-sm text-ink-muted">{copy.best}</div>
            <div className="flex items-center gap-4">
              <span className="text-[15px] font-medium text-ink">{records.best} {traitsOf(v.unit).repUnit}</span>
              <span className="text-sm text-ink-muted">{dateShort(records.date)}</span>
            </div>
          </div>
        ) : records.rows.map((r) => (
          <div key={r.reps} className={`${cell} gap-2`}>
            <div className="w-16 shrink-0 text-sm text-ink-muted">{r.reps} reps</div>
            <div className="flex-1 min-w-0 text-[15px] font-medium text-ink">{loadText(v, r.load)}</div>
            <div className="text-sm text-ink-muted">{dateShort(r.date)}</div>
          </div>
        ))}
      </div>
    </>
  );
}

/* Muscles, équipement, articulations, type : aucune donnée nouvelle, tout
   vient de EXERCISES[id]. #25 avait stocké ces champs pour un générateur et
   aucun écran ne les avait jamais lus.

   Une seule barre empilée depuis #49, là où il y en avait trois dont une
   ambrée. L'ambre disait ici « muscle principal » alors qu'il veut dire
   « alerte » partout ailleurs (trois `role="alert"` sur les erreurs de charge)
   ou « charge prévue » : une couleur, un sens. Et trois barres répétaient trois
   fois le même axe 0–100 pour des valeurs dont le registre garantit qu'elles
   somment à 1,0 (`registry.js:35`). La part se lit maintenant comme une part.

   Les largeurs sortent des pourcentages arrondis, et `display.test.js:84`
   vérifie qu'ils somment à 100 sur **toutes** les entrées du registre : la barre
   est donc pleine exactement, pas approximativement. Le dominant reste évident
   sans légende à déchiffrer — c'est le segment le plus large, et le plus clair. */
const MUSCLE_SHADES = ["bg-share-1", "bg-share-2", "bg-share-3", "bg-share-4"];
const shadeOf = (i) => MUSCLE_SHADES[i] || MUSCLE_SHADES[MUSCLE_SHADES.length - 1];

function Details({ rows }) {
  const label = "w-36 shrink-0 text-sm text-ink-muted";
  return (
    <>
      <div className={SECTION}>Détails</div>
      <div className="mt-2 flex h-2 rounded-full overflow-hidden bg-surface-raised">
        {rows.muscles.map((m, i) => (
          <div key={m.key} className={shadeOf(i)} style={{ width: `${m.pct}%` }} />
        ))}
      </div>
      <div className="mt-2 flex flex-col gap-1">
        {rows.muscles.map((m, i) => (
          <div key={m.key} className="flex items-center gap-2">
            <span className={`w-2 h-2 shrink-0 rounded-sm ${shadeOf(i)}`} />
            <div className="flex-1 text-sm text-ink-soft">{m.label}</div>
            <div className="text-sm text-ink-muted">{m.pct} %</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        {rows.equipement && <div className="flex gap-2.5"><div className={label}>Équipement</div><div className="text-sm text-ink-soft">{rows.equipement}</div></div>}
        {rows.articulations && <div className="flex gap-2.5"><div className={label}>Articulations</div><div className="text-sm text-ink-soft">{rows.articulations}</div></div>}
        {rows.type && <div className="flex gap-2.5"><div className={label}>Type</div><div className="text-sm text-ink-soft">{rows.type}</div></div>}
      </div>
    </>
  );
}

function HistoryRow({ entry, v }) {
  const kind = KIND_LABELS[entry.kind];
  return (
    <div className="py-2 min-h-[2.5rem] flex items-center justify-between gap-2">
      <div className="text-sm text-ink-muted inline-flex items-center gap-1.5 flex-wrap">
        {dateShort(entry.date)}
        {/* Sans nom de séance — définition d'un cycle abîmé (#32) — la date
            seule suffit : c'est l'identité du log (ARCHITECTURE §2.3). */}
        {entry.sessionName && <span>· {entry.sessionName}</span>}
        {kind && <span className="rounded-full px-2 py-0.5 text-xs bg-surface-raised text-ink-soft">{kind}</span>}
      </div>
      <div className="text-sm text-ink text-right">{setSummary(entry.sets, v)}</div>
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

  /* resolveScreen garantit un id connu ; ce repli existe pour que le
     composant ne soit pas le seul endroit du code à supposer le contraire. */
  if (!v) return null;

  const copy = COPY[unit] || COPY.kg;
  /* Un seul libellé pour les deux : la tête de fiche le rend à l'écran, la
     courbe le garde comme nom accessible. Deux formulations divergentes
     décriraient le même chiffre de deux façons. */
  const chartLabel = `${copy.chart}${v.side ? ", par côté" : ""}`;
  const n = entries.length;
  const hasRecords = records.mode === "best" ? records.best != null : records.rows.length > 0;

  return (
    <>
      <div className="sticky top-0 z-10 bg-surface border-b border-rule px-4 pt-1 pb-2">
        <button onClick={onBack} className="h-11 -ml-2 px-2 inline-flex items-center gap-1 text-sm text-ink-soft focus:outline-none focus:ring-2 focus:ring-focus rounded">
          <ChevronLeft size={18} />{backLabel}
        </button>
        <div className="text-xl font-semibold leading-tight">{v.name}</div>
      </div>

      <div className="px-4 pb-6" style={{ fontVariantNumeric: "tabular-nums" }}>
        {n === 0 ? (
          <div className="mt-6">
            <div className="text-base font-medium text-ink">Jamais fait.</div>
            <p className="mt-1 text-sm text-ink-muted leading-relaxed">
              Aucune série enregistrée pour cet exercice, dans aucun cycle. La première
              série validée ouvrira ici sa courbe, ses records et son historique.
            </p>
          </div>
        ) : (
          <>
            {/* La tête de fiche, elle, s'affiche dès la première séance : elle
                n'a pas besoin de deux points, seulement d'une valeur. */}
            {head && <Headline data={head} mode={mode} label={chartLabel} />}
            {/* Pas de courbe sur une seule séance : un point isolé n'est pas une
                progression, et la liste en dessous le dit déjà. */}
            {geo && n > 1 && <Chart geo={geo} mode={mode} note={copy.note} label={chartLabel} />}
            <div className="mt-1.5 text-xs text-ink-faint">
              {n} séance{n > 1 ? "s" : ""} validée{n > 1 ? "s" : ""} depuis le {dateShort(entries[0].date)}.
            </div>

            {hasRecords && <Records records={records} v={v} copy={copy} />}

            <div className={SECTION}>Historique</div>
            {/* Un en-tête par cycle, le premier compris. Il ne manquait qu'au
                groupe le plus récent, et c'est ce qui a fait passer pour un bug
                une séance du 7 sept. enregistrée dans deux cycles différents
                (constaté le 2026-09-14) : deux lignes à la même date, dont une
                seule sous un nom de programme. Une date n'est unique que dans
                un cycle — rien n'empêche de valider le même jour dans deux
                cycles ouverts, et l'écran doit le dire au lieu de le laisser
                deviner. Le nom de séance affiché reste celui de la définition
                épinglée de ce cycle-là (#26), pas celui qu'aurait le créneau
                aujourd'hui. */}
            {groups.map((g, i) => (
              <div key={g.programId}>
                <div className={`flex items-center gap-2 pb-3 ${i === 0 ? "pt-2" : "pt-4"}`}>
                  <div className="flex-1 h-px bg-rule" />
                  <div className="text-xs text-ink-faint whitespace-nowrap">
                    {g.programName ? `${g.programName} · ` : ""}
                    {periodLabel(g.rows[g.rows.length - 1].date, g.rows[0].date)}
                  </div>
                  <div className="flex-1 h-px bg-rule" />
                </div>
                <div className="divide-y divide-rule border-y border-rule">
                  {g.rows.map((e) => <HistoryRow key={`${e.programId}${e.date}${e.slot}`} entry={e} v={v} />)}
                </div>
              </div>
            ))}
          </>
        )}

        {v.cue && (
          <>
            <div className={SECTION}>Technique</div>
            <p className="mt-1 text-sm text-ink-soft leading-relaxed">{v.cue}</p>
          </>
        )}

        {details && <Details rows={details} />}
      </div>
    </>
  );
}
