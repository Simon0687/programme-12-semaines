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

import { useState } from "react";
import { ChevronLeft, ChevronDown, TrendingDown, Bone, Moon, HeartPulse, Gauge } from "lucide-react";
import { cardioWhen, mobilityDayNames } from "./display.js";
import { hasCardioItems, hasMobilityDays } from "./program.js";
import { PHASE_BG, PHASE_SHORT_LABELS, PHASE_ORDER } from "./phase-colors.js";

/* #114 : plan.js ne connaît que des noms abstraits (§2.6, aucun import
   lucide-react hors de ce fichier) — c'est ici qu'un nom devient un tracé. */
const TRIGGER_ICONS = { decline: TrendingDown, pain: Bone, sleep: Moon, vitals: HeartPulse, rir: Gauge };

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
  /* #114 : une énumération de noms courts (les ancres du cycle), pas un
     argumentaire — les jetons le disent d'un coup d'œil, une liste à puces
     l'aurait fait lire ligne à ligne. */
  if (block.t === "chips")
    return (
      <div className="flex flex-wrap gap-2">
        {block.items.map((it) => (
          <span key={it} className="rounded-full px-2.5 py-1 text-xs bg-surface-raised border border-rule text-ink-soft">{it}</span>
        ))}
      </div>
    );
  /* #114 : un repère ou une consigne de sécurité, hors du flux de lecture
     ordinaire — « Point volume fin S4 », la règle de douleur nouvelle. */
  if (block.t === "callout")
    return <p className="rounded-md border border-rule bg-surface-raised px-3 py-2.5 text-notice">{block.text}</p>;
  /* #114 : les cinq déclencheurs de décharge, un pictogramme par entrée —
     l'icône ne remplace pas le texte, elle donne une forme à reconnaître
     avant même de lire. */
  if (block.t === "iconlist")
    return (
      <ul className="space-y-2.5">
        {block.items.map((it) => {
          const Icon = TRIGGER_ICONS[it.icon];
          return (
            <li key={it.text} className="flex items-start gap-2.5">
              {Icon && <Icon size={16} className="text-ink-muted shrink-0 mt-0.5" />}
              <span>{it.text}</span>
            </li>
          );
        })}
      </ul>
    );
  /* #114 : la structure des douze semaines, une frise verticale plutôt qu'une
     table à deux colonnes — les mêmes couleurs de phase que la timeline de
     l'index Programme (#107), pour que le même découpage se lise pareil aux
     deux endroits. */
  if (block.t === "phaseline")
    return (
      <div className="relative pl-5">
        <div className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-rule" aria-hidden="true" />
        <div className="space-y-4">
          {block.steps.map((s, i) => (
            <div key={i} className="relative">
              <span className={`absolute -left-5 top-1 w-3.5 h-3.5 rounded-full ring-2 ring-surface ${PHASE_BG[s.phase] || "bg-rule"}`} />
              <div className="text-xs uppercase tracking-wider text-ink-muted">{s.label}</div>
              <div className="text-ink">{s.text}</div>
            </div>
          ))}
        </div>
      </div>
    );
  /* #108 : le volume par groupe, en barres plutôt qu'en table — la question
     qu'on vient poser (« lequel est le plus gros ? ») se répond au premier
     coup d'œil, sans lire les nombres. */
  if (block.t === "bars") return <VolumeBars rows={block.rows} />;
  /* #114 : les deux recettes de décharge, côte à côte — ce qui change entre
     Complète et Ciblée se lisait avant en comparant deux paragraphes à la
     main. */
  if (block.t === "table" && block.variant === "compare")
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule">
            <th className="py-1.5 pr-3" />
            {block.head.map((h) => <th key={h} className="py-1.5 px-2 text-left text-ink font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {block.rows.map(([label, a, b]) => (
            <tr key={label} className="border-t border-rule align-top">
              <td className="py-1.5 pr-3 text-ink-muted whitespace-nowrap">{label}</td>
              <td className="py-1.5 px-2">{a}</td>
              <td className="py-1.5 px-2">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  /* #109 : Si/Alors — un en-tête fixe, deux colonnes. Distincte de "compare"
     (#114) : pas de colonne de libellé à gauche, chaque ligne est la paire
     complète. */
  if (block.t === "table" && block.variant === "ifthen")
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule">
            <th className="py-1.5 pr-3 text-left text-ink font-medium w-1/2">Si</th>
            <th className="py-1.5 text-left text-ink font-medium">Alors</th>
          </tr>
        </thead>
        <tbody>
          {block.rows.map(([si, alors]) => (
            <tr key={si} className="border-t border-rule align-top">
              <td className="py-1.5 pr-3">{si}</td>
              <td className="py-1.5 text-accent">{alors}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  /* #109 : le chiffre qui compte, avant tout le reste — plus grand que le
     texte courant, mais sans rejouer l'échelle de la fiche exercice (#49) :
     ici, c'est une ligne de section, pas l'unique raison d'être de l'écran. */
  if (block.t === "headline") return <p className="text-lg font-semibold text-ink pt-1">{block.text}</p>;
  /* #109 : les trois macros, côte à côte plutôt qu'en ligne de texte —
     comparer 180/90/350 demandait de les repérer dans une phrase. */
  if (block.t === "tiles")
    return (
      <div className="grid grid-cols-3 gap-2">
        {block.items.map((it) => (
          <div key={it.label} className="rounded-md border border-rule bg-surface-raised px-3 py-2.5 text-center">
            <div className="text-xs text-ink-muted">{it.label}</div>
            <div className="text-ink font-medium mt-0.5">{it.value}</div>
          </div>
        ))}
      </div>
    );
  /* #109 : une sous-section repliée, comptée dans son propre intertitre —
     "Journée type (5)". Récursif : ses blocs sont rendus par ce même Block,
     donc une consigne pliée peut porter n'importe laquelle des formes
     ci-dessus sans que ce composant ait à le savoir d'avance. */
  if (block.t === "fold") return <Fold title={block.title} count={block.count}>{block.blocks.map((b, i) => <Block key={i} block={b} />)}</Fold>;
  return null;
}

function Fold({ title, count, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 py-1.5 text-left focus:outline-none focus:ring-2 focus:ring-focus rounded">
        <span className="text-ink font-medium">{title} <span className="text-ink-muted font-normal">({count})</span></span>
        <ChevronDown size={16} className={`text-ink-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="pl-0.5 space-y-2">{children}</div>}
    </div>
  );
}

/* ---------- Le volume par groupe, en barres (#108) ----------

   `rows` arrive déjà trié et déjà mis à l'échelle par `value` (plan.js) ; ce
   composant ne fait qu'une division, purement visuelle : la largeur de
   chaque barre en proportion de la plus grande. Statique — un retour de test
   a retiré le détail « où ça se fait » par ligne : la barre et son chiffre
   répondent déjà à la question posée. */
function VolumeBars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-ink">{r.label}</span>
            <span className="text-accent font-medium shrink-0">{r.display}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-surface-raised overflow-hidden">
            <div className="h-full bg-accent rounded-full" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
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
