/* =========================================================
   Écran de collecte — cinq réponses, puis une proposition (#58, #112)

   Comme ProgramEditor.jsx, ce fichier n'émet que du balisage : les
   vocabulaires, le moteur et les phrases du rapport viennent de
   src/generator.js, qui est testé sous `node --test` (ARCHITECTURE §2.6).
   #112 ne change ni l'un ni l'autre — seule la présentation des cinq
   questions change.

   Ce qu'il possède, et qui n'est pas de la donnée : les cinq réponses en
   cours et la proposition affichée. Rien n'est stocké — la proposition part
   dans l'éditeur, et c'est l'éditeur qui décide d'enregistrer (#36 Q4). Un
   rechargement en pleine collecte retombe sur Semaine, comme en pleine
   édition : `editeur` et `generateur` sont volontairement absents de
   SCREENS (src/screen-state.js).

   Deuxième retour de test (2026-09-26) : « on retire tout le texte, on
   reprend le mockup » (écran B3). Le paragraphe d'introduction et les deux
   aides sous « Niveau » et « Objectif » disparaissent ; chaque question se
   réduit à un picto, un libellé court et son contrôle. Comme sur la
   maquette, une seule question est active à la fois — la première sans
   réponse — les réponses données restent visibles et modifiables au-dessus,
   et les suivantes attendent, estompées, sans leur contrôle.

   Deux écrans en un, et c'est voulu : la proposition ne saute pas
   directement dans l'éditeur quand le moteur a quelque chose à dire. Un
   format qui a perdu ses mollets doit le dire là où on l'a demandé, pas
   laisser le découvrir six semaines plus tard — « un moteur qui dit non vaut
   mieux qu'un moteur qui remplit » (§3 étape 3). Ce rapport-là reste : ce
   n'est pas un texte d'aide, c'est la réponse du moteur.
   ========================================================= */

import { useState } from "react";
import {
  ChevronLeft, Building2, Home, PersonStanding, CalendarDays, Timer, Dumbbell, TrendingUp, Target, TriangleAlert,
} from "lucide-react";
import {
  FREQUENCIES, DURATIONS, PRESETS, LEVELS, OBJECTIVES,
  LEVEL_LABELS, OBJECTIVE_LABELS, generate,
} from "./generator.js";

/* #112 : un pictogramme par preset — la question se répond au coup d'œil,
   sans lire le nom. Une carte locale à l'écran, pas au générateur : ce sont
   trois clés stables (generator.js), pas une donnée qui pourrait en
   accueillir une quatrième sans qu'un tracé lui soit choisi ici. */
const EQUIPMENT_ICONS = { "salle-complete": Building2, "home-gym": Home, "poids-du-corps": PersonStanding };

/* Les cinq questions, dans l'ordre où elles se répondent, avec le libellé
   court et le picto de la maquette. Aucune valeur par défaut nulle part ici :
   un niveau ou un objectif présélectionné serait une réponse que personne n'a
   donnée, recopiée ensuite dans `intent` et relue par l'avis de Plan comme une
   déclaration (#58 lot 2). */
const QUESTIONS = [
  { key: "frequency", label: "Séances par semaine", icon: CalendarDays, type: "segmented", options: FREQUENCIES, format: (n) => String(n) },
  { key: "duration", label: "Durée par séance", icon: Timer, type: "segmented", options: DURATIONS, format: (n) => `${n} min` },
  { key: "equipment", label: "Matériel", icon: Dumbbell, type: "tiles", options: Object.keys(PRESETS), format: (k) => PRESETS[k].label },
  { key: "level", label: "Niveau", icon: TrendingUp, type: "pills", options: LEVELS, format: (k) => LEVEL_LABELS[k] },
  { key: "objective", label: "Objectif", icon: Target, type: "pills", options: OBJECTIVES, format: (k) => OBJECTIVE_LABELS[k] },
];

/* Une option choisie se dit par son contour et son texte à l'accent — le
   `seg-opt` coché de Nocturne — plutôt que par un aplat : cinq aplats pleins
   empilés feraient de l'écran une rangée de boutons primaires. */
function Segmented({ q, value, onPick }) {
  return (
    <div className="flex rounded-md border border-rule overflow-hidden">
      {q.options.map((o, i) => (
        <button key={o} type="button" onClick={() => onPick(o)} aria-pressed={value === o}
          className={`flex-1 h-11 text-[13px] whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus
            ${i ? "border-l border-rule" : ""} ${value === o ? "text-accent-ink ring-1 ring-inset ring-accent" : "text-ink"}`}>
          {q.format(o)}
        </button>
      ))}
    </div>
  );
}

function GearTiles({ q, value, onPick }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {q.options.map((o) => {
        const Icon = EQUIPMENT_ICONS[o];
        const on = value === o;
        return (
          <button key={o} type="button" onClick={() => onPick(o)} aria-pressed={on}
            className={`p-3 rounded-md border flex flex-col items-start gap-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-focus
              ${on ? "border-accent" : "border-rule"}`}>
            {Icon && <Icon size={20} className={on ? "text-accent-ink" : "text-ink-muted"} />}
            <span className="text-[13px] text-ink">{q.format(o)}</span>
          </button>
        );
      })}
    </div>
  );
}

function Pills({ q, value, onPick }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {q.options.map((o) => (
        <button key={o} type="button" onClick={() => onPick(o)} aria-pressed={value === o}
          className={`h-10 px-3.5 rounded-md border text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus
            ${value === o ? "border-accent text-accent-ink" : "border-rule text-ink"}`}>
          {q.format(o)}
        </button>
      ))}
    </div>
  );
}

const CONTROLS = { segmented: Segmented, tiles: GearTiles, pills: Pills };

/* `state` : `active` (la première question sans réponse), `waiting` (après
   elle — estompée, sans contrôle) ou `answered`. */
function Question({ q, state, value, onPick }) {
  const Control = CONTROLS[q.type];
  const Icon = q.icon;
  return (
    <div className={`flex flex-col gap-2 ${state === "waiting" ? "opacity-45" : ""}`}>
      <div className={`flex items-center gap-2 text-[13px] ${state === "active" ? "text-ink" : "text-ink-muted"}`}>
        <Icon size={15} className={state === "active" ? "text-accent" : ""} />{q.label}
      </div>
      {state !== "waiting" && <Control q={q} value={value} onPick={onPick} />}
    </div>
  );
}

/* Ce que le rapport dit, en français et sans jargon de cascade. Les trois
   listes ne disent pas la même chose et ne se fusionnent donc pas : la
   première est une décision du budget, la deuxième une limite du matériel ou
   du format, la troisième (#61) un arbitrage entre deux muscles. */
function Report({ report }) {
  const { cut, uncovered, underFrequency = [] } = report;
  if (!cut.length && !uncovered.length && !underFrequency.length) return null;
  return (
    <div className="mt-3 flex gap-2 items-start p-3 rounded-md bg-surface-raised text-xs text-ink-soft">
      <TriangleAlert size={16} className="text-notice shrink-0" />
      <div className="space-y-1.5">
        {cut.length > 0 && (
          <p>Pas de place pour : {cut.join(", ").toLowerCase()}. Le temps va d'abord aux groupes principaux.</p>
        )}
        {uncovered.length > 0 && (
          <p>Rien ne couvre : {uncovered.join(", ").toLowerCase()}. À ajouter à la main dans l'éditeur si tu as de quoi.</p>
        )}
        {/* #61 : le prix de « couvrir tout le monde d'abord ». Dit ici, et pas
            seulement découvert plus tard dans l'avis de Plan — un arbitrage que
            le moteur rend à la place de quelqu'un doit être annoncé par lui. */}
        {underFrequency.length > 0 && (
          <p>Une séance par semaine au lieu de deux pour : {underFrequency.join(", ").toLowerCase()}.</p>
        )}
      </div>
    </div>
  );
}

export default function GenerateProgram({ today, onBack, onAccept }) {
  const [answers, setAnswers] = useState({ frequency: null, duration: null, equipment: null, level: null, objective: null });
  const [result, setResult] = useState(null);

  const answeredCount = QUESTIONS.filter((q) => answers[q.key] !== null).length;
  const complete = answeredCount === QUESTIONS.length;
  const active = QUESTIONS.findIndex((q) => answers[q.key] === null);

  /* Changer une réponse jette la proposition, comme avant #112 : la garder à
     l'écran sous des contraintes qui ne sont plus celles qui l'ont produite
     serait le seul endroit de l'appli où ce qui est affiché ne décrit pas
     l'état. */
  const answer = (key, value) => {
    setAnswers({ ...answers, [key]: value });
    setResult(null);
  };

  /* Rien à signaler : la proposition part directement dans l'éditeur, sans
     faire lire un écran vide pour le plaisir d'un clic de plus. La décision
     se prend ici, dans le gestionnaire, et jamais pendant le rendu : appeler
     le parent depuis le corps du composant serait une mise à jour d'état en
     plein rendu. */
  const run = () => {
    const r = generate(answers, today);
    /* #61 : `underFrequency` entre dans la condition. Le raccourci existe pour
       éviter « un écran vide pour le plaisir d'un clic de plus » — un arbitrage
       que le moteur a rendu à la place de quelqu'un n'est pas un écran vide.
       Mesuré : 14 des 171 combinaisons générées s'arrêtent ici alors qu'elles
       passaient droit, et chacune a quelque chose de vrai à dire. */
    if (r.ok && !r.report.cut.length && !r.report.uncovered.length && !r.report.underFrequency.length) { onAccept(r.definition); return; }
    setResult(r);
  };

  return (
    <div className="px-4 pb-6">
      <div className="sticky top-0 z-10 bg-surface border-b border-rule -mx-4 px-4 pt-1 pb-3">
        <div className="flex items-center justify-between">
          <button type="button" onClick={onBack} className="h-11 -ml-2 px-2 inline-flex items-center gap-1 text-sm text-ink-soft rounded focus:outline-none focus:ring-2 focus:ring-focus">
            <ChevronLeft size={18} />Programme
          </button>
          <span className="text-sm text-ink-muted">{answeredCount} / {QUESTIONS.length}</span>
        </div>
        <div className="text-xl font-medium leading-tight">Générer</div>
        <div className="flex gap-1 mt-2.5">
          {QUESTIONS.map((q) => (
            <span key={q.key} className={`flex-1 h-[3px] rounded-full ${answers[q.key] !== null ? "bg-accent" : "bg-rule-strong"}`} />
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-5">
        {QUESTIONS.map((q, i) => (
          <Question key={q.key} q={q} value={answers[q.key]} onPick={(v) => answer(q.key, v)}
            state={i === active ? "active" : active !== -1 && i > active ? "waiting" : "answered"} />
        ))}
      </div>

      <button type="button" onClick={run} disabled={!complete}
        className="mt-6 w-full h-12 px-4 rounded-md bg-accent text-ink-inverse font-medium disabled:opacity-45 focus:outline-none focus:ring-2 focus:ring-focus">
        Composer le programme
      </button>

      {/* Le refus du §3 étape 3, dans les mots du moteur. Ce n'est pas une
          erreur de saisie : c'est un format qui ne tient pas, et les deux
          nombres qui le disent sont dans la phrase. */}
      {result && !result.ok && (
        <p role="alert" className="text-sm text-alert mt-4">
          {result.message} Passe à une durée plus longue, ou ajoute une séance.
        </p>
      )}

      {result && result.ok && (
        <div className="mt-6 border-t border-rule pt-4">
          <p className="font-medium">{result.definition.name}</p>
          <Report report={result.report} />
          <button type="button" onClick={() => onAccept(result.definition)}
            className="mt-4 w-full h-12 px-4 rounded-md bg-accent text-ink-inverse font-medium focus:outline-none focus:ring-2 focus:ring-focus">
            Ouvrir dans l'éditeur
          </button>
        </div>
      )}
    </div>
  );
}
