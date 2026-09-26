/* =========================================================
   Référence › Exercices — chercher dans le registre fermé (#116)

   Remplace #78 (fermée « pas prévu » en attendant cette refonte) : le
   catalogue et la fiche existaient déjà, il manquait une porte pour
   parcourir le premier sans passer par une séance. C'est la dernière ancre
   du manuel de Référence.

   Les deux facettes croisées (muscle, mouvement) sont celles du sélecteur
   d'exercices de l'éditeur (ExercisePicker.jsx) plutôt qu'un vocabulaire à
   part : même comportement partout où on cherche dans le registre, et une
   seule règle de croisement à tenir (exercise-filter.js). Avant #12x, cette
   page avait ses six « jetons » musculaires propres (exercise-groups.js,
   #116) — écartés au profit de la cohérence avec l'éditeur. Le matériel n'en
   fait pas partie : un choix de plus pour une distinction que le nom de
   l'exercice donne déjà à la lecture.

   Contrôlé, comme ExercisePicker.jsx : la recherche et les facettes arrivent
   en props, parce que la page qui l'héberge démonte quand on ouvre une
   fiche (App.jsx tient l'état, voir le commentaire à `exerciseQuery`).
   Aucun calcul propre — filterExercises()/facetValues()/applyFacet()
   (exercise-filter.js) font tout le travail, ce fichier n'émet que du
   balisage (§2.6).
   ========================================================= */

import { useMemo } from "react";
import { Search } from "lucide-react";
import { filterExercises, facetValues, applyFacet } from "./exercise-filter.js";
import { MUSCLE_LABELS, PATTERN_LABELS, EQUIPMENT_LABELS } from "./display.js";

const FIELD = "h-11 w-full px-3 rounded-md bg-surface-raised border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-focus";

export default function ReferenceExercises({ q, onQueryChange, facets, onFacetsChange, onProgramIds, onOpen }) {
  const results = useMemo(() => filterExercises(q, facets), [q, facets]);
  const values = useMemo(() => facetValues(), []);
  const facet = (key, label, labels) => (
    <select value={facets[key]} onChange={(e) => onFacetsChange(applyFacet(facets, key, e.target.value))} aria-label={label}
      className="h-10 flex-1 min-w-0 px-2 rounded-md bg-surface-raised border border-rule text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus">
      <option value="">{label}</option>
      {values[key].map((v) => <option key={v} value={v}>{labels[v] || v}</option>)}
    </select>
  );
  return (
    <div className="mt-2">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input value={q} onChange={(e) => onQueryChange(e.target.value)} placeholder="Chercher un exercice"
          aria-label="Chercher un exercice" className={`${FIELD} pl-9`} />
      </div>
      <div className="flex gap-2 mt-2">
        {facet("muscle", "Muscle", MUSCLE_LABELS)}
        {facet("pattern", "Mouvement", PATTERN_LABELS)}
      </div>
      {results.length === 0 ? (
        <p className="text-sm text-ink-muted py-4">Aucun exercice ne correspond.</p>
      ) : (
        <div className="mt-2 divide-y divide-rule">
          {results.map((e) => (
            <button key={e.id} onClick={() => onOpen(e.id)}
              className="w-full py-3 text-left flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-focus rounded">
              <span className="flex-1 min-w-0">
                <span className="block text-ink">{e.name}</span>
                <span className="block text-xs text-ink-muted">
                  {e.pattern ? PATTERN_LABELS[e.pattern] || e.pattern : "Gainage et portés"}
                  {e.equipement?.length ? ` · ${e.equipement.map((k) => EQUIPMENT_LABELS[k] || k).join(", ")}` : ""}
                </span>
              </span>
              {onProgramIds.has(e.id) && <span className="shrink-0 text-xs text-ink-muted border border-rule rounded-full px-2 py-0.5">au prog.</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
