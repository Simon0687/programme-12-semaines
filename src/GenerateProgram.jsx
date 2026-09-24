/* =========================================================
   Écran de collecte — cinq réponses, puis une proposition (#58, #82)

   Comme ProgramEditor.jsx, ce fichier n'émet que du balisage : les
   vocabulaires, le moteur et les phrases du rapport viennent de
   src/generator.js, qui est testé sous `node --test` (ARCHITECTURE §2.6).

   Ce qu'il possède, et qui n'est pas de la donnée : les réponses en
   cours et la proposition affichée. Rien n'est stocké — la proposition part
   dans l'éditeur, et c'est l'éditeur qui décide d'enregistrer (#36 Q4). Un
   rechargement en pleine collecte retombe sur Semaine, comme en pleine
   édition : `editeur` et `generateur` sont volontairement absents de
   SCREENS (src/screen-state.js).

   Deux écrans en un, et c'est voulu : la proposition ne saute pas
   directement dans l'éditeur quand le moteur a quelque chose à dire. Un
   format qui a perdu ses mollets doit le dire là où on l'a demandé, pas
   laisser le découvrir six semaines plus tard — « un moteur qui dit non vaut
   mieux qu'un moteur qui remplit » (§3 étape 3).
   ========================================================= */

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import {
  FREQUENCIES, DURATIONS, PRESETS, LEVELS, OBJECTIVES,
  LEVEL_LABELS, OBJECTIVE_LABELS, JOINTS, JOINT_LABELS, generate,
} from "./generator.js";

function Chip({ selected, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={`h-11 px-4 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-focus
        ${selected ? "bg-accent text-ink-inverse" : "bg-surface-raised text-ink border border-rule"}`}>
      {children}
    </button>
  );
}

/* `hint` ne décrit pas la question, il dit ce que la réponse change dans le
   programme. Deux des cinq en ont besoin : « intermédiaire » et
   « hypertrophie » ne veulent rien dire tant qu'on ne sait pas sur quoi ils
   agissent, et les supposer sans le dire était exactement le défaut du lot 1. */
function Question({ label, hint, children }) {
  return (
    <div className="mt-5">
      <p className="text-sm text-ink-muted">{label}</p>
      {hint && <p className="text-xs text-ink-soft mt-0.5">{hint}</p>}
      <div className="flex gap-2 flex-wrap mt-2">{children}</div>
    </div>
  );
}

/* Ce que le rapport dit, en français et sans jargon de cascade. Les trois
   listes ne disent pas la même chose et ne se fusionnent donc pas : la
   première est une décision du budget, la deuxième une limite du matériel ou
   du format, la troisième (#61) un arbitrage entre deux muscles. */
function Report({ report }) {
  const { cut, uncovered, underFrequency = [], spared = null } = report;
  if (!cut.length && !uncovered.length && !underFrequency.length && !spared) return null;
  return (
    <div className="mt-4 space-y-2">
      {/* #82 : en tête, parce que c'est la seule des quatre que
          l'utilisateur a demandée. Elle se lit comme un accusé de réception
          — voilà ce que ta contrainte a coûté — et non comme un reproche. */}
      {spared && (
        <p className="text-sm text-ink-muted">
          {spared.joint} ménagée : {spared.excluded} exercice{spared.excluded > 1 ? "s" : ""} écarté{spared.excluded > 1 ? "s" : ""}.
          {spared.lost.length > 0 && ` Plus rien ne couvre ${spared.lost.join(", ").toLowerCase()} sans la solliciter — à ajouter à la main dans l'éditeur si la douleur passe.`}
        </p>
      )}
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
  const [frequency, setFrequency] = useState(null);
  const [duration, setDuration] = useState(null);
  const [equipment, setEquipment] = useState(null);
  /* Aucune valeur par défaut, et c'est le point du lot 2 : un niveau
     présélectionné serait une réponse que personne n'a donnée, recopiée
     ensuite dans `intent` et relue par l'avis de Plan comme une déclaration.
     Le moteur garde ses constantes pour les appels muets — un écran, lui,
     peut demander. */
  const [level, setLevel] = useState(null);
  const [objective, setObjective] = useState(null);
  /* La seule des six qui a une valeur de départ, et c'est la bonne réponse
     pour la plupart des gens : `null` veut dire « aucune », pas « pas encore
     répondu ». Une question facultative qui bloquerait le bouton serait une
     question obligatoire déguisée. */
  const [spare, setSpare] = useState(null);
  const [result, setResult] = useState(null);

  /* Changer une réponse jette la proposition : la garder à l'écran sous des
     contraintes qui ne sont plus celles qui l'ont produite serait le seul
     endroit de l'appli où ce qui est affiché ne décrit pas l'état. */
  const answer = (set) => (v) => { set(v); setResult(null); };

  const complete = [frequency, duration, equipment, level, objective].every((v) => v !== null);

  /* Rien à signaler : la proposition part directement dans l'éditeur, sans
     faire lire un écran vide pour le plaisir d'un clic de plus. La décision
     se prend ici, dans le gestionnaire, et jamais pendant le rendu : appeler
     le parent depuis le corps du composant serait une mise à jour d'état en
     plein rendu. */
  const run = () => {
    const r = generate({ frequency, duration, equipment, level, objective, spare }, today);
    /* #61 : `underFrequency` entre dans la condition. Le raccourci existe pour
       éviter « un écran vide pour le plaisir d'un clic de plus » — un arbitrage
       que le moteur a rendu à la place de quelqu'un n'est pas un écran vide.
       Mesuré : 14 des 171 combinaisons générées s'arrêtent ici alors qu'elles
       passaient droit, et chacune a quelque chose de vrai à dire. */
    /* #82 : `spared` entre dans la condition pour la même raison que
       `underFrequency` en #61 — ce que la contrainte a coûté est quelque
       chose de vrai à dire, et le dire après coup dans l'avis de Plan
       arriverait six semaines trop tard. */
    if (r.ok && !r.report.cut.length && !r.report.uncovered.length && !r.report.underFrequency.length && !r.report.spared) { onAccept(r.definition); return; }
    setResult(r);
  };

  return (
    <div className="px-4">
      <div className="sticky top-0 z-10 bg-surface border-b border-rule -mx-4 px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="h-11 -ml-2 px-2 inline-flex items-center gap-1 text-sm text-ink-muted rounded focus:outline-none focus:ring-2 focus:ring-focus">
            <ChevronLeft size={18} />Plan
          </button>
          <div className="flex-1 text-lg font-semibold truncate">Générer un programme</div>
        </div>
      </div>

      <p className="text-sm text-ink-soft mt-3">
        Cinq réponses suffisent — une sixième, facultative, met une articulation de côté. Le reste — le
        découpage des séances, les exercices, les séries et les répétitions — se calcule. La proposition
        s'ouvre ensuite dans l'éditeur, et rien n'est enregistré tant que tu ne l'as pas validée.
      </p>

      <Question label="Combien de séances par semaine ?">
        {FREQUENCIES.map((n) => (
          <Chip key={n} selected={frequency === n} onClick={() => answer(setFrequency)(n)}>{n}</Chip>
        ))}
      </Question>

      <Question label="Combien de temps par séance ?">
        {DURATIONS.map((n) => (
          <Chip key={n} selected={duration === n} onClick={() => answer(setDuration)(n)}>{n} min</Chip>
        ))}
      </Question>

      <Question
        label="Avec quel matériel ?"
        hint="« Poids du corps » suppose une barre de traction, à hauteur réglable si possible : sans elle, rien ne vient entraîner le dos, les biceps ni les triceps."
      >
        {Object.entries(PRESETS).map(([key, preset]) => (
          <Chip key={key} selected={equipment === key} onClick={() => answer(setEquipment)(key)}>{preset.label}</Chip>
        ))}
      </Question>

      <Question
        label="Quel niveau ?"
        hint="Une série de plus par muscle à chaque cran, dans la limite de la fourchette, et les barres libres qui s'ouvrent : squat et tractions à partir d'intermédiaire, soulevé de terre conventionnel en avancé."
      >
        {LEVELS.map((key) => (
          <Chip key={key} selected={level === key} onClick={() => answer(setLevel)(key)}>{LEVEL_LABELS[key]}</Chip>
        ))}
      </Question>

      <Question
        label="Quel objectif ?"
        hint="Il fixe les répétitions et le repos. Ni le découpage des séances, ni le choix des exercices, ni le nombre de séries n'en dépendent."
      >
        {OBJECTIVES.map((key) => (
          <Chip key={key} selected={objective === key} onClick={() => answer(setObjective)(key)}>{OBJECTIVE_LABELS[key]}</Chip>
        ))}
      </Question>

      <Question
        label="Une articulation à ménager ? (facultatif)"
        hint="Les exercices qui la chargent sortent de la sélection — pas seulement d'une séance. Un groupe que plus rien ne couvre sans elle sera annoncé."
      >
        {/* « Aucune » est une chip comme les autres et non une absence de
            chip : sans elle, on ne peut pas revenir sur sa réponse, et le
            lot 2 a justement retiré tout ce qui était présélectionné sans
            avoir été répondu. */}
        <Chip selected={spare === null} onClick={() => answer(setSpare)(null)}>Aucune</Chip>
        {JOINTS.map((key) => (
          <Chip key={key} selected={spare === key} onClick={() => answer(setSpare)(key)}>{JOINT_LABELS[key]}</Chip>
        ))}
      </Question>

      <div className="mt-6">
        <button type="button" onClick={run} disabled={!complete}
          className="h-12 px-4 rounded-md bg-accent text-ink-inverse font-medium disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-focus">
          Générer
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
