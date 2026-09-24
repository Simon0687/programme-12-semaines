/* =========================================================
   Sélecteur d'exercices — le registre fermé, à l'écran (#36, extrait en #55)

   Plein écran : sur un téléphone, 73 entrées et trois facettes ne tiennent
   pas dans un panneau replié. Se ferme sur un choix ou sur la croix, et ne
   possède aucune donnée — il rend un id à son appelant, qui décide quoi en
   faire.

   Vivait dans ProgramEditor.jsx jusqu'à #55, où la Séance en a eu besoin pour
   la substitution. Rien n'a changé de son comportement en sortant : le
   filtrage reste dans exercise-filter.js, les libellés dans display.js, et ce
   fichier n'émet que du balisage (ARCHITECTURE §2.6).

   Deux props sont nées du second appelant :

   - `initialFacets` — la Séance l'ouvre avec le `pattern` du créneau déjà
     coché (#55 Q3 = C), et depuis #64 son muscle dominant aussi : « une autre
     poussée horizontale pour les pectoraux » à zéro tap, et décocher rend le
     registre entier. L'éditeur n'en passe pas et garde ses trois facettes
     vides, comme avant.

   - `disabledIds` / `disabledNote` — des entrées visibles et inertes, avec la
     raison écrite. Les masquer serait pire : dans un registre fermé, une
     entrée absente se lit comme une panne, et c'est déjà l'argument que
     exercise-filter.js tient sur les facettes qui ne rendent rien.
   ========================================================= */

import { useMemo, useState } from "react";
import { X, Search } from "lucide-react";
import { filterExercises, facetValues, applyFacet } from "./exercise-filter.js";
import { MUSCLE_LABELS, PATTERN_LABELS, EQUIPMENT_LABELS } from "./display.js";

const FIELD = "h-11 w-full px-3 rounded-md bg-surface-raised border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-focus";

const NO_FACETS = { muscle: "", pattern: "", equipment: "" };

export default function ExercisePicker({ onChoose, onClose, initialFacets, disabledIds, disabledNote = "déjà dans cette séance" }) {
  const [q, setQ] = useState("");
  /* Les facettes de départ sont une valeur initiale, jamais un contrôle : une
     fois le sélecteur ouvert, c'est l'utilisateur qui les tient. Passer par
     useState(() => …) plutôt que par une prop lue à chaque rendu est ce qui
     permet de décocher la facette pré-sélectionnée. */
  const [facets, setFacets] = useState(() => ({ ...NO_FACETS, ...(initialFacets || {}) }));
  const results = useMemo(() => filterExercises(q, facets), [q, facets]);
  /* #64 : ce que chaque liste déroulante propose dépend de ce qui est déjà
     coché — « Pectoraux » ne laisse plus choisir « Dominante genou ». Le
     calcul est dans exercise-filter.js : l'écran reçoit des listes, jamais une
     règle (ARCHITECTURE §2.6). */
  const values = useMemo(() => facetValues(facets), [facets]);
  const blocked = disabledIds instanceof Set ? disabledIds : new Set(disabledIds || []);
  const facet = (key, label, labels) => (
    <select value={facets[key]} onChange={(e) => setFacets(applyFacet(facets, key, e.target.value))} aria-label={label}
      className="h-10 px-2 shrink-0 rounded-md bg-surface-raised border border-rule text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus">
      <option value="">{label}</option>
      {values[key].map((v) => <option key={v} value={v}>{labels[v] || v}</option>)}
    </select>
  );
  return (
    <div className="fixed inset-0 z-20 bg-surface overflow-y-auto">
      <div className="max-w-md mx-auto px-4 pb-24">
        <div className="sticky top-0 bg-surface pt-3 pb-2 border-b border-rule">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              {/* #64 : pas d'autoFocus. Le clavier couvrait la moitié de la
                  liste avant qu'on ait rien lu, alors que parcourir les
                  facettes est le chemin rapide et la recherche le recours.
                  Le champ reste à un tap. */}
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un exercice" aria-label="Chercher un exercice" className={`${FIELD} pl-9`} />
            </div>
            <button type="button" aria-label="Fermer le sélecteur" onClick={onClose}
              className="h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-md bg-surface-raised border border-rule text-ink-soft focus:outline-none focus:ring-2 focus:ring-focus">
              <X size={18} />
            </button>
          </div>
          <div className="flex gap-2 mt-2 overflow-x-auto">
            {facet("muscle", "Muscle", MUSCLE_LABELS)}
            {facet("pattern", "Mouvement", PATTERN_LABELS)}
            {facet("equipment", "Matériel", EQUIPMENT_LABELS)}
          </div>
        </div>
        {results.length === 0 ? (
          <p className="text-sm text-ink-muted py-4">Aucun exercice ne correspond. Le registre est fermé : si rien ne convient, c'est qu'il y manque une entrée.</p>
        ) : (
          <div className="divide-y divide-rule">
            {results.map((e) => {
              const off = blocked.has(e.id);
              return (
                <button key={e.id} type="button" disabled={off} onClick={() => onChoose(e.id)}
                  className={`w-full py-3 text-left rounded focus:outline-none focus:ring-2 focus:ring-focus ${off ? "opacity-40" : ""}`}>
                  <div className={`font-medium ${off ? "text-ink-muted" : "text-ink"}`}>{e.name}</div>
                  {/* Les quatre entrées sans champs de sélection (#25) n'ont ni
                      mouvement ni matériel à afficher : la ligne dit ce qu'elles
                      sont plutôt que de rester vide. */}
                  <div className="text-xs text-ink-muted">
                    {off ? disabledNote : (
                      <>
                        {e.pattern ? PATTERN_LABELS[e.pattern] || e.pattern : "Gainage et portés"}
                        {e.equipement?.length ? ` · ${e.equipement.map((k) => EQUIPMENT_LABELS[k] || k).join(", ")}` : ""}
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
