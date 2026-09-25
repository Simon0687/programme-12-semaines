/* =========================================================
   Les composants purs de l'onglet Plan et du cardio — extraits d'App.jsx (#87)

   Déplacement pur : quatre composants qui étaient déjà groupés au bas
   d'App.jsx, repris ligne pour ligne. Aucun n'a d'état, aucun ne lit le
   journal ; tout ce qu'ils rendent arrive en props.

   Ils sortent pour la même raison que la carte d'exercice (#17, #87) : tant
   qu'ils vivaient dans le fichier, le journal et le programme étaient à
   portée de main et il n'en coûtait rien d'aller y lire. En sortant, ils
   n'ont plus que six symboles à importer, et c'est la mesure de leur
   pureté.

   `Block` rend ce que `plan.js` décrit : la structure du Plan est une
   donnée, et ce fichier n'est que son moteur de rendu (§2.6 — aucun calcul
   dans un composant).
   ========================================================= */

import { ChevronLeft } from "lucide-react";
import { cardioWhen, mobilityDayNames } from "./display.js";
import { hasCardioItems, hasMobilityDays } from "./program.js";
import { PHASE_BG, PHASE_SHORT_LABELS, PHASE_ORDER } from "./phase-colors.js";

export function Block({ block }) {
  if (block.t === "p") return <p>{block.text}</p>;
  /* #104 : deux formes de plus, et c'est tout ce que le rendu avait à
     apprendre. Le reproche « beaucoup de texte » ne venait pas de la quantité
     d'information mais de ce vocabulaire à trois formes : faute de liste, les
     cinq déclencheurs de décharge s'écrivaient en une phrase de 299
     caractères séparée par des points-virgules. La forme suit ce que le
     contenu *est*, au lieu de l'aplatir. */
  if (block.t === "h") return <h3 className="text-ink font-medium pt-2">{block.text}</h3>;
  if (block.t === "ul")
    return (
      <ul className="list-disc pl-5 space-y-1 marker:text-ink-faint">
        {block.items.map((it) => <li key={it}>{it}</li>)}
      </ul>
    );
  if (block.t === "table" && block.variant === "weeks")
    return (
      <table className="w-full text-sm">
        <tbody>
          {block.rows.map(([a, b]) => (
            <tr key={a} className="border-t border-rule"><td className="py-1.5 pr-3 text-ink-muted whitespace-nowrap align-top">{a}</td><td className="py-1.5">{b}</td></tr>
          ))}
        </tbody>
      </table>
    );
  if (block.t === "table" && block.variant === "volume")
    return (
      <table className="w-full text-sm">
        <tbody>
          {block.rows.map(([g, n, o]) => (
            <tr key={g} className="border-t border-rule"><td className="py-1.5 pr-2">{g}</td><td className="py-1.5 pr-2 text-accent text-right">{n}</td><td className="py-1.5 text-ink-muted">{o}</td></tr>
          ))}
        </tbody>
      </table>
    );
  return null;
}
/* Même en-tête que la fiche exercice (#17) : bouton de retour collant, titre
   en dessous. Le retour est en `text-ink-soft` et non en ambre — l'accent
   porte déjà trop de sens (triage du 2026-09-14, C2), et une flèche de retour
   n'est pas une donnée. */
export function PlanPage({ title, onBack, children }) {
  return (
    <>
      <div className="sticky top-0 z-10 bg-surface border-b border-rule px-4 pt-1 pb-2">
        <button onClick={onBack} className="h-11 -ml-2 px-2 inline-flex items-center gap-1 text-sm text-ink-soft focus:outline-none focus:ring-2 focus:ring-focus rounded">
          <ChevronLeft size={18} />Programme
        </button>
        <div className="text-xl font-semibold leading-tight">{title}</div>
      </div>
      <div className="px-4 pt-3 pb-6 text-sm text-ink-soft leading-relaxed space-y-2">{children}</div>
    </>
  );
}

/* ---------- La frise de phases (#107) ----------

   `phases` est un id de phase par semaine (indices 0..W-1, semaine i+1),
   déjà calculé par phaseOf() — ce composant ne connaît ni les politiques ni
   le calendrier, seulement le résultat. `current` est la semaine du jour
   (curWeek dans App.jsx), pas la semaine feuilletée dans l'onglet Semaine :
   la carte de l'index dit où en est le cycle, pas où on regarde. */
export function WeekTimeline({ phases, current }) {
  const used = PHASE_ORDER.filter((id) => phases.includes(id));
  return (
    <div className="mt-3">
      <div className="flex gap-1" role="img" aria-label={`Semaine ${current} sur ${phases.length}`}>
        {phases.map((id, i) => (
          <span key={i + 1}
            className={`flex-1 h-2 rounded-full ${PHASE_BG[id] || "bg-rule"} ${i + 1 === current ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""}`} />
        ))}
      </div>
      <div className="flex gap-3 flex-wrap mt-2">
        {used.map((id) => (
          <span key={id} className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
            <span className={`w-2 h-2 rounded-full shrink-0 ${PHASE_BG[id]}`} />{PHASE_SHORT_LABELS[id]}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CardioView({ prog, week, cardio, ca, setCardio, toggleMob, compact }) {
  return (
    <div>
      {!compact && <div className="text-xl font-semibold pb-1">Cardio et mobilité, semaine {week}</div>}
      <div className="divide-y divide-rule border-y border-rule">
        {hasCardioItems(prog) && prog.CARDIO_ITEMS.map((it) => {
          /* #34 : le genre, plus l'identifiant. `it.id === "int"` était
             l'identifiant d'une séance du programme de Simon, en dur dans la
             vue : un programme qui appelait ses intervalles autrement voyait
             sa prescription Z2 affichée sous eux. */
          const plan = it.kind === "intervals" ? cardio.intervals : cardio.z2;
          const d = ca[it.id] || {};
          if (it.kind === "intervals" && !plan) return (
            <div key={it.id} className="py-3 text-sm text-ink-muted">Pas d'intervalles cette semaine (calibration, décharge ou bilan) : Z2 uniquement.</div>
          );
          return (
            <div key={it.id} className="py-3">
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={!!d.done} onChange={(e) => setCardio(it.id, "done", e.target.checked)} className="mt-1 h-5 w-5 accent-accent" />
                <div>
                  <div className="font-medium">{it.label} <span className="text-ink-muted font-normal text-sm">{cardioWhen(it, prog.SESSIONS)}</span></div>
                  <div className="text-sm text-ink-muted">{plan}</div>
                </div>
              </label>
              <div className="grid grid-cols-3 gap-2 mt-2 pl-8">
                {[["min", "min"], ["w", "W moyen"], ["hr", "bpm moyen"]].map(([f, l]) => (
                  <input key={f} inputMode="decimal" aria-label={`${it.label} ${l}`} placeholder={l} value={d[f] || ""} onChange={(e) => setCardio(it.id, f, e.target.value)} className="h-10 w-full text-center rounded-md bg-surface-raised border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-focus" />
                ))}
              </div>
            </div>
          );
        })}
        {hasMobilityDays(prog) && (
          <div className="py-3">
            {/* #34 : le « 3 » était écrit en dur, comme les trois jours. Les deux
                viennent de MOB_DAYS, qui porte des décalages de 1 à 7 (#39) — les
                cases restent indexées par **position**, donc les coches déjà
                enregistrées restent en face du même jour. */}
            <div className="font-medium">Mobilité, {prog.MOB_DAYS.length} fois par semaine</div>
            <div className="text-sm text-ink-muted">{cardio.mob}</div>
            <div className="flex gap-4 mt-2">
              {mobilityDayNames(prog.MOB_DAYS).map((name, i) => (
                <label key={name} className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={!!(ca.mob && ca.mob[i])} onChange={() => toggleMob(i)} className="h-5 w-5 accent-accent" />{name}</label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
