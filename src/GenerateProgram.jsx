/* =========================================================
   Écran de collecte — trois réponses, puis une proposition (#58)

   Comme ProgramEditor.jsx, ce fichier n'émet que du balisage : les
   vocabulaires, le moteur et les phrases du rapport viennent de
   src/generator.js, qui est testé sous `node --test` (ARCHITECTURE §2.6).

   Ce qu'il possède, et qui n'est pas de la donnée : les trois réponses en
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
import { FREQUENCIES, DURATIONS, PRESETS, generate } from "./generator.js";

function Chip({ selected, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={`h-11 px-4 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-focus
        ${selected ? "bg-accent text-ink-inverse" : "bg-surface-raised text-ink border border-rule"}`}>
      {children}
    </button>
  );
}

function Question({ label, children }) {
  return (
    <div className="mt-5">
      <p className="text-sm text-ink-muted">{label}</p>
      <div className="flex gap-2 flex-wrap mt-2">{children}</div>
    </div>
  );
}

/* Ce que le rapport dit, en français et sans jargon de cascade. Les deux
   listes ne disent pas la même chose et ne se fusionnent donc pas : l'une
   est une décision du budget, l'autre une limite du matériel ou du format. */
function Report({ report }) {
  const { cut, uncovered } = report;
  if (!cut.length && !uncovered.length) return null;
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
    </div>
  );
}

export default function GenerateProgram({ today, onBack, onAccept }) {
  const [frequency, setFrequency] = useState(null);
  const [duration, setDuration] = useState(null);
  const [equipment, setEquipment] = useState(null);
  const [result, setResult] = useState(null);

  /* Changer une réponse jette la proposition : la garder à l'écran sous des
     contraintes qui ne sont plus celles qui l'ont produite serait le seul
     endroit de l'appli où ce qui est affiché ne décrit pas l'état. */
  const answer = (set) => (v) => { set(v); setResult(null); };

  const complete = frequency !== null && duration !== null && equipment !== null;

  /* Rien à signaler : la proposition part directement dans l'éditeur, sans
     faire lire un écran vide pour le plaisir d'un clic de plus. La décision
     se prend ici, dans le gestionnaire, et jamais pendant le rendu : appeler
     le parent depuis le corps du composant serait une mise à jour d'état en
     plein rendu. */
  const run = () => {
    const r = generate({ frequency, duration, equipment }, today);
    if (r.ok && !r.report.cut.length && !r.report.uncovered.length) { onAccept(r.definition); return; }
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
        Trois réponses suffisent : le reste — le découpage des séances, les exercices, les séries et les
        répétitions — se calcule. La proposition s'ouvre ensuite dans l'éditeur, et rien n'est enregistré
        tant que tu ne l'as pas validée.
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

      <Question label="Avec quel matériel ?">
        {Object.entries(PRESETS).map(([key, preset]) => (
          <Chip key={key} selected={equipment === key} onClick={() => answer(setEquipment)(key)}>{preset.label}</Chip>
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
