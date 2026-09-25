/* =========================================================
   Écran de collecte — cinq réponses, puis une proposition (#58, #112)

   Comme ProgramEditor.jsx, ce fichier n'émet que du balisage : les
   vocabulaires, le moteur et les phrases du rapport viennent de
   src/generator.js, qui est testé sous `node --test` (ARCHITECTURE §2.6).
   #112 ne change ni l'un ni l'autre — seule la présentation des cinq
   questions change, d'une pile toujours ouverte à une question à la fois.

   Ce qu'il possède, et qui n'est pas de la donnée : les cinq réponses en
   cours, laquelle est ouverte, et la proposition affichée. Rien n'est
   stocké — la proposition part dans l'éditeur, et c'est l'éditeur qui
   décide d'enregistrer (#36 Q4). Un rechargement en pleine collecte retombe
   sur Semaine, comme en pleine édition : `editeur` et `generateur` sont
   volontairement absents de SCREENS (src/screen-state.js).

   Deux écrans en un, et c'est voulu : la proposition ne saute pas
   directement dans l'éditeur quand le moteur a quelque chose à dire. Un
   format qui a perdu ses mollets doit le dire là où on l'a demandé, pas
   laisser le découvrir six semaines plus tard — « un moteur qui dit non vaut
   mieux qu'un moteur qui remplit » (§3 étape 3).
   ========================================================= */

import { useState } from "react";
import { ChevronLeft, ChevronDown, Check, Building2, Home, PersonStanding } from "lucide-react";
import {
  FREQUENCIES, DURATIONS, PRESETS, LEVELS, OBJECTIVES,
  LEVEL_LABELS, OBJECTIVE_LABELS, generate,
} from "./generator.js";

/* #112 : un pictogramme par preset — la question se répond au coup d'œil,
   sans lire le nom. Une carte locale à l'écran, pas au générateur : ce sont
   trois clés stables (generator.js), pas une donnée qui pourrait en
   accueillir une quatrième sans qu'un tracé lui soit choisi ici. */
const EQUIPMENT_ICONS = { "salle-complete": Building2, "home-gym": Home, "poids-du-corps": PersonStanding };

/* #112 : les cinq questions, dans l'ordre où elles se répondent. `format`
   est le mot affiché — dans l'option, et dans le résumé une fois la
   question repliée — de sorte que les deux ne puissent jamais diverger.
   Aucune valeur par défaut nulle part ici : un niveau ou un objectif
   présélectionné serait une réponse que personne n'a donnée, recopiée
   ensuite dans `intent` et relue par l'avis de Plan comme une déclaration
   (#58 lot 2). */
const QUESTIONS = [
  { key: "frequency", label: "Combien de séances par semaine ?", type: "segmented", options: FREQUENCIES, format: (n) => String(n) },
  { key: "duration", label: "Combien de temps par séance ?", type: "segmented", options: DURATIONS, format: (n) => `${n} min` },
  {
    key: "equipment", label: "Avec quel matériel ?", type: "tiles", options: Object.keys(PRESETS), format: (k) => PRESETS[k].label,
    hint: "« Poids du corps » suppose une barre de traction, à hauteur réglable si possible : sans elle, rien ne vient entraîner le dos, les biceps ni les triceps.",
  },
  {
    key: "level", label: "Quel niveau ?", type: "list", options: LEVELS, format: (k) => LEVEL_LABELS[k],
    hint: "Une série de plus par muscle à chaque cran, dans la limite de la fourchette, et les barres libres qui s'ouvrent : squat et tractions à partir d'intermédiaire, soulevé de terre conventionnel en avancé.",
  },
  {
    key: "objective", label: "Quel objectif ?", type: "list", options: OBJECTIVES, format: (k) => OBJECTIVE_LABELS[k],
    hint: "Il fixe les répétitions et le repos. Ni le découpage des séances, ni le choix des exercices, ni le nombre de séries n'en dépendent.",
  },
];

function Chip({ selected, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={`h-11 px-4 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-focus
        ${selected ? "bg-accent text-ink-inverse" : "bg-surface-raised text-ink border border-rule"}`}>
      {children}
    </button>
  );
}

/* #112 : matériel, en tuiles pictogrammes plutôt qu'en chips — la seule des
   trois formes qui porte une icône, parce que c'est la seule question dont
   la réponse se reconnaît visuellement (une salle, une pièce, un corps). */
function Tile({ selected, icon: Icon, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={`flex flex-col items-center justify-center gap-1.5 h-24 rounded-md border text-sm font-medium text-center px-2 focus:outline-none focus:ring-2 focus:ring-focus
        ${selected ? "bg-accent text-ink-inverse border-accent" : "bg-surface-raised text-ink border-rule"}`}>
      {Icon && <Icon size={22} />}
      {children}
    </button>
  );
}

/* #112 : niveau et objectif, en liste plutôt qu'en chips — deux ou trois
   phrases qu'on lit l'une sous l'autre, pas des mots qu'on compare d'un
   regard. La coche remplace la teinte pleine de la chip. */
function ListRow({ selected, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className="w-full flex items-center justify-between gap-2 py-3 text-left focus:outline-none focus:ring-2 focus:ring-focus rounded">
      <span className={selected ? "text-ink font-medium" : "text-ink-soft"}>{children}</span>
      {selected && <Check size={16} className="text-accent shrink-0" />}
    </button>
  );
}

/* `hint` ne décrit pas la question, il dit ce que la réponse change dans le
   programme. Deux des cinq en ont besoin : « intermédiaire » et
   « hypertrophie » ne veulent rien dire tant qu'on ne sait pas sur quoi ils
   agissent, et les supposer sans le dire était exactement le défaut du lot 1. */
function OpenQuestion({ q, value, onPick }) {
  return (
    <div className="mt-5">
      <p className="text-sm text-ink-muted">{q.label}</p>
      {q.hint && <p className="text-xs text-ink-soft mt-0.5">{q.hint}</p>}
      {q.type === "segmented" && (
        <div className="flex gap-2 flex-wrap mt-2">
          {q.options.map((o) => <Chip key={o} selected={value === o} onClick={() => onPick(o)}>{q.format(o)}</Chip>)}
        </div>
      )}
      {q.type === "tiles" && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          {q.options.map((o) => (
            <Tile key={o} selected={value === o} icon={EQUIPMENT_ICONS[o]} onClick={() => onPick(o)}>{q.format(o)}</Tile>
          ))}
        </div>
      )}
      {q.type === "list" && (
        <div className="mt-1 divide-y divide-rule border-y border-rule">
          {q.options.map((o) => <ListRow key={o} selected={value === o} onClick={() => onPick(o)}>{q.format(o)}</ListRow>)}
        </div>
      )}
    </div>
  );
}

/* Une question déjà répondue, repliée au-dessus de celle qui est ouverte —
   toujours visible, toujours modifiable d'un tap (#112). */
function AnsweredQuestion({ label, value, onOpen }) {
  return (
    <button type="button" onClick={onOpen} aria-expanded={false}
      className="w-full flex items-center justify-between gap-2 py-3 border-b border-rule text-left focus:outline-none focus:ring-2 focus:ring-focus rounded">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="text-sm text-ink font-medium inline-flex items-center gap-1">{value}<ChevronDown size={14} className="text-ink-faint" /></span>
    </button>
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
    <div className="mt-4 space-y-2">
      {cut.length > 0 && (
        <p className="text-sm text-notice">
          Ce format ne laisse pas de place à : {cut.join(", ").toLowerCase()}. Le temps disponible passe d'abord
          sur les groupes principaux.
        </p>
      )}
      {uncovered.length > 0 && (
        <p className="text-sm text-notice">
          Rien ne couvre : {uncovered.join(", ").toLowerCase()}. Le matériel déclaré ou le nombre de séances
          ne permet pas de les travailler — à ajouter à la main dans l'éditeur si tu as de quoi.
        </p>
      )}
      {/* #61 : le prix de « couvrir tout le monde d'abord ». Dit ici, et pas
          seulement découvert plus tard dans l'avis de Plan — un arbitrage que
          le moteur rend à la place de quelqu'un doit être annoncé par lui. */}
      {underFrequency.length > 0 && (
        <p className="text-sm text-ink-muted">
          Une séance par semaine au lieu de deux pour : {underFrequency.join(", ").toLowerCase()}. Les créneaux
          du format sont allés d'abord à ce qui n'était pas travaillé du tout.
        </p>
      )}
    </div>
  );
}

export default function GenerateProgram({ today, onBack, onAccept }) {
  const [answers, setAnswers] = useState({ frequency: null, duration: null, equipment: null, level: null, objective: null });
  /* La question ouverte, ou null quand les cinq sont répondues et que rien
     n'est en cours de modification. Distincte des réponses elles-mêmes :
     rouvrir une question déjà répondue ne doit pas en oublier une autre. */
  const [openIndex, setOpenIndex] = useState(0);
  const [result, setResult] = useState(null);

  const answeredCount = QUESTIONS.filter((q) => answers[q.key] !== null).length;
  const complete = answeredCount === QUESTIONS.length;

  /* Répondre avance à la première question qui ne l'est pas encore, jamais
     à la suivante dans l'absolu : rouvrir la question 2 pendant que 3, 4 et
     5 sont déjà répondues doit la refermer sans rien rouvrir d'autre.
     Changer une réponse jette la proposition, comme avant #112 : la garder
     à l'écran sous des contraintes qui ne sont plus celles qui l'ont
     produite serait le seul endroit de l'appli où ce qui est affiché ne
     décrit pas l'état. */
  const answer = (key, value) => {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    setResult(null);
    const from = QUESTIONS.findIndex((q) => q.key === key);
    const nextOpen = QUESTIONS.findIndex((q, i) => i > from && next[q.key] === null);
    setOpenIndex(nextOpen === -1 ? null : nextOpen);
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
    <div className="px-4">
      <div className="sticky top-0 z-10 bg-surface border-b border-rule -mx-4 px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="h-11 -ml-2 px-2 inline-flex items-center gap-1 text-sm text-ink-muted rounded focus:outline-none focus:ring-2 focus:ring-focus">
            <ChevronLeft size={18} />Programme
          </button>
          <div className="flex-1 text-lg font-semibold truncate">Nouveau</div>
          <div className="text-sm text-ink-muted shrink-0">{answeredCount} / {QUESTIONS.length}</div>
        </div>
      </div>

      <p className="text-sm text-ink-soft mt-3">
        Cinq réponses suffisent : le reste — le découpage des séances, les exercices, les séries et les
        répétitions — se calcule. La proposition s'ouvre ensuite dans l'éditeur, et rien n'est enregistré
        tant que tu ne l'as pas validée.
      </p>

      {QUESTIONS.map((q, i) => {
        if (i === openIndex) return <OpenQuestion key={q.key} q={q} value={answers[q.key]} onPick={(v) => answer(q.key, v)} />;
        if (answers[q.key] !== null) return <AnsweredQuestion key={q.key} label={q.label} value={q.format(answers[q.key])} onOpen={() => setOpenIndex(i)} />;
        return null;
      })}

      <div className="mt-6">
        <button type="button" onClick={run} disabled={!complete}
          className="h-12 px-4 rounded-md bg-accent text-ink-inverse font-medium disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-focus">
          Composer le programme
        </button>
      </div>

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
          <div className="mt-4">
            <button type="button" onClick={() => onAccept(result.definition)}
              className="h-12 px-4 rounded-md bg-accent text-ink-inverse font-medium focus:outline-none focus:ring-2 focus:ring-focus">
              Ouvrir dans l'éditeur
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
