/* =========================================================
   Référence › Exercices — chercher dans le registre fermé (#116)

   Remplace #78 (fermée « pas prévu » en attendant cette refonte) : le
   catalogue et la fiche existaient déjà, il manquait une porte pour
   parcourir le premier sans passer par une séance. C'est la dernière ancre
   du manuel de Référence.

   Contrôlé, comme ExercisePicker.jsx : la recherche et le filtre arrivent en
   props, parce que la page qui l'héberge démonte quand on ouvre une fiche
   (App.jsx tient l'état, voir le commentaire à `exerciseQuery`). Aucun
   calcul propre — filterExercises() (exercise-filter.js) fait la recherche,
   matchesBucket() (exercise-groups.js) le filtre par groupe, ce fichier
   n'émet que du balisage (§2.6).
   ========================================================= */

import { Search } from "lucide-react";
import { filterExercises } from "./exercise-filter.js";
import { MUSCLE_BUCKETS, matchesBucket } from "./exercise-groups.js";
import { EXERCISES } from "./registry.js";
import { PATTERN_LABELS, EQUIPMENT_LABELS } from "./display.js";

const FIELD = "h-11 w-full px-3 rounded-md bg-surface-raised border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-focus";
const REGISTRY_SIZE = Object.keys(EXERCISES).length;

function Chip({ selected, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={`shrink-0 h-8 px-3 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-focus ${selected ? "bg-accent text-ink-inverse font-medium" : "bg-surface-raised text-ink-soft border border-rule"}`}>
      {children}
    </button>
  );
}

export default function ReferenceExercises({ q, onQueryChange, bucket, onBucketChange, onProgramIds, onOpen }) {
  const results = filterExercises(q, {}).filter((e) => matchesBucket(e, bucket));
  return (
    <div className="mt-2">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input value={q} onChange={(e) => onQueryChange(e.target.value)} placeholder={`Chercher parmi ${REGISTRY_SIZE}`}
          aria-label="Chercher un exercice" className={`${FIELD} pl-9`} />
      </div>
      <div className="flex gap-2 mt-2 overflow-x-auto">
        <Chip selected={!bucket} onClick={() => onBucketChange("")}>Tous</Chip>
        {MUSCLE_BUCKETS.map(([key, label]) => (
          <Chip key={key} selected={bucket === key} onClick={() => onBucketChange(bucket === key ? "" : key)}>{label}</Chip>
        ))}
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
