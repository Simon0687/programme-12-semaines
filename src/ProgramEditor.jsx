/* =========================================================
   Éditeur de programme — composer une séance à la main (#36)

   Ce fichier n'émet que du balisage. Les mutations viennent toutes de
   src/program-editor.js, le filtrage du sélecteur de src/exercise-filter.js,
   les libellés de src/display.js : c'est ce que demande ARCHITECTURE §2.6,
   et c'est ce qui permet à la totalité de la logique de l'éditeur d'être
   testée sous `node --test`, sans moteur de rendu.

   Le composant est contrôlé, comme ExerciseSheet.jsx : il reçoit un
   brouillon et rend le brouillon suivant à `onChange`. Il ne possède que
   l'état qui n'est pas de la donnée — le sélecteur d'exercices ouvert, sa
   recherche, ses facettes. Rien de ce qu'on tape ici n'est stocké tant que
   `onSave` n'a pas été appelé (#36 Q4) : le garde-fou de sortie vit dans
   App.jsx, seul à voir les onglets du bas.

   Ce que l'écran montre du format, et ce qu'il en tait : les ids de séance
   et de slot ne sont jamais affichés — ce sont des adresses, engendrées par
   program-editor.js. Les variantes de bloc (b1/b2) ne se montrent que
   lorsqu'un programme importé en porte deux différentes ; l'éditeur ne
   propose pas d'en créer, faute d'un écran qui dise ce que « bloc 1 » et
   « bloc 2 » veulent dire (suivi).
   ========================================================= */

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronUp, ChevronDown, Plus, X, Search } from "lucide-react";
import { EXERCISES } from "./registry.js";
import { filterExercises, FACET_VALUES } from "./exercise-filter.js";
import { MUSCLE_LABELS, PATTERN_LABELS, EQUIPMENT_LABELS, DAY_NAMES, unitLoadLabel } from "./display.js";
import { intentSummary } from "./generator.js";
import {
  addSession, removeSession, moveSession, patchSession,
  addRow, removeRow, moveRow, patchRow,
  addWarm, setWarmText, removeWarm,
  addCore, setCoreLabel, removeCore,
  referencedExercises, setStartingLoad,
} from "./program-editor.js";

const FIELD = "h-11 w-full px-3 rounded-md bg-surface-raised border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-focus";
const SMALL = "h-10 w-full px-2 text-center rounded-md bg-surface-raised border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-focus";

/* Un champ vidé rend "" et non 0 : la fourchette de reps et le repos se
   tapent, et un champ qu'on ne peut pas effacer se corrige au chiffre près.
   L'état transitoire est assumé — c'est le validateur qui tranche à
   l'enregistrement, avec sa phrase à lui (program-editor.js, en-tête). */
const numOrBlank = (v) => (v === "" ? "" : Number(v));

/* #23 : le libellé vit dans display.js, avec les autres mots d'interface. */
const loadUnit = unitLoadLabel;

/* Un échauffement n'a pas de nom dans le format : WARM[clé] est un texte nu,
   et la clé ne sort jamais à l'écran — la séance affiche le texte, sous le
   titre « Échauffement » (App.jsx:832). L'éditeur la traite donc comme les
   autres adresses, invisible, et désigne chaque échauffement par son rang et
   par ses premiers mots. C'est aussi ce qui garde intactes les clés d'un
   programme importé (« upper », « lower ») : rien ne les réécrit. */
const warmLabel = (i, text) => {
  const t = String(text || "").trim();
  return t ? `${i + 1} · ${t.length > 28 ? `${t.slice(0, 28)}…` : t}` : `Échauffement ${i + 1}`;
};

function IconBtn({ label, onClick, disabled, children }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} disabled={disabled}
      className="h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-md text-ink-muted disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-focus">
      {children}
    </button>
  );
}

function AddBtn({ onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className="mt-2 h-11 px-3 inline-flex items-center gap-2 rounded-md bg-surface-raised border border-rule text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus">
      <Plus size={16} />{children}
    </button>
  );
}

function Labeled({ label, children }) {
  return <label className="block"><span className="text-xs text-ink-muted">{label}</span>{children}</label>;
}

/* ---------- Une liste de lignes d'exercice ----------
   Les séances et les blocs de gainage portent la même liste ([slot, séries])
   et sont édités par les mêmes fonctions, à l'adresse près : { session: id }
   ou { core: clé }. Un seul composant, donc. */
function Rows({ program, owner, rows, apply, onPick }) {
  if (!rows.length) return <p className="text-sm text-ink-faint py-3">Aucun exercice.</p>;
  return (
    <div className="divide-y divide-rule">
      {rows.map(([slotId, sets], i) => {
        const slot = program.SLOTS[slotId];
        if (!slot) return null;
        const patch = (p) => apply(patchRow, owner, i, p);
        return (
          <div key={`${slotId}-${i}`} className="py-3">
            <div className="flex items-start gap-1">
              <button type="button" onClick={() => onPick(owner, i, slot.b1 === slot.b2 ? null : "b1")}
                className="flex-1 text-left font-medium text-ink py-2 rounded focus:outline-none focus:ring-2 focus:ring-focus">
                {EXERCISES[slot.b1]?.name || slot.b1}
              </button>
              <IconBtn label="Monter cet exercice" onClick={() => apply(moveRow, owner, i, -1)} disabled={i === 0}><ChevronUp size={18} /></IconBtn>
              <IconBtn label="Descendre cet exercice" onClick={() => apply(moveRow, owner, i, 1)} disabled={i === rows.length - 1}><ChevronDown size={18} /></IconBtn>
              <IconBtn label="Retirer cet exercice" onClick={() => apply(removeRow, owner, i)}><X size={18} /></IconBtn>
            </div>
            {slot.b1 !== slot.b2 && (
              <button type="button" onClick={() => onPick(owner, i, "b2")}
                className="text-sm text-ink-muted text-left rounded focus:outline-none focus:ring-2 focus:ring-focus">
                Bloc 2 : {EXERCISES[slot.b2]?.name || slot.b2}
              </button>
            )}
            <div className="grid grid-cols-4 gap-2 mt-1">
              <Labeled label="Séries">
                <input type="number" inputMode="numeric" min="1" value={sets} onChange={(e) => patch({ sets: e.target.value })} className={`mt-1 ${SMALL}`} />
              </Labeled>
              <Labeled label="Reps min">
                <input type="number" inputMode="numeric" value={slot.reps[0]} onChange={(e) => patch({ reps: [numOrBlank(e.target.value), slot.reps[1]] })} className={`mt-1 ${SMALL}`} />
              </Labeled>
              <Labeled label="Reps max">
                <input type="number" inputMode="numeric" value={slot.reps[1]} onChange={(e) => patch({ reps: [slot.reps[0], numOrBlank(e.target.value)] })} className={`mt-1 ${SMALL}`} />
              </Labeled>
              <Labeled label="Repos (s)">
                <input type="number" inputMode="numeric" value={slot.rest} onChange={(e) => patch({ rest: numOrBlank(e.target.value) })} className={`mt-1 ${SMALL}`} />
              </Labeled>
            </div>
            <div className="flex gap-4 mt-2">
              {/* Les deux drapeaux du format, dits par ce qu'ils déclenchent
                  plutôt que par leur nom de champ : `key` sort l'exercice dans
                  le bilan et passe sa dernière série en AMRAP en S12, `fail`
                  autorise l'échec à partir de S3 (App.jsx:170). */}
              <label className="inline-flex items-center gap-2 text-sm text-ink-soft">
                <input type="checkbox" checked={!!slot.key} onChange={(e) => patch({ key: e.target.checked })} className="h-5 w-5 accent-accent" />
                Exercice clé
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-ink-soft">
                <input type="checkbox" checked={!!slot.fail} onChange={(e) => patch({ fail: e.target.checked })} className="h-5 w-5 accent-accent" />
                Échec autorisé
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Sélecteur d'exercices ----------
   Plein écran : sur un téléphone, 63 entrées et trois facettes ne tiennent
   pas dans un panneau replié. Se ferme sur un choix ou sur la croix, et ne
   touche jamais au brouillon — il rend un id à l'écran, qui appelle la
   mutation. */
function Picker({ onChoose, onClose }) {
  const [q, setQ] = useState("");
  const [facets, setFacets] = useState({ muscle: "", pattern: "", equipment: "" });
  const results = useMemo(() => filterExercises(q, facets), [q, facets]);
  const facet = (key, label, labels) => (
    <select value={facets[key]} onChange={(e) => setFacets({ ...facets, [key]: e.target.value })} aria-label={label}
      className="h-10 px-2 shrink-0 rounded-md bg-surface-raised border border-rule text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus">
      <option value="">{label}</option>
      {FACET_VALUES[key].map((v) => <option key={v} value={v}>{labels[v] || v}</option>)}
    </select>
  );
  return (
    <div className="fixed inset-0 z-20 bg-surface overflow-y-auto">
      <div className="max-w-md mx-auto px-4 pb-24">
        <div className="sticky top-0 bg-surface pt-3 pb-2 border-b border-rule">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un exercice" aria-label="Chercher un exercice" className={`${FIELD} pl-9`} />
            </div>
            <IconBtn label="Fermer le sélecteur" onClick={onClose}><X size={18} /></IconBtn>
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
            {results.map((e) => (
              <button key={e.id} type="button" onClick={() => onChoose(e.id)} className="w-full py-3 text-left rounded focus:outline-none focus:ring-2 focus:ring-focus">
                <div className="font-medium text-ink">{e.name}</div>
                {/* Les quatre entrées sans champs de sélection (#25) n'ont ni
                    mouvement ni matériel à afficher : la ligne dit ce qu'elles
                    sont plutôt que de rester vide. */}
                <div className="text-xs text-ink-muted">
                  {e.pattern ? PATTERN_LABELS[e.pattern] || e.pattern : "Gainage et portés"}
                  {e.equipement?.length ? ` · ${e.equipement.map((k) => EQUIPMENT_LABELS[k] || k).join(", ")}` : ""}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProgramEditor({ draft, onChange, onBack, onSave, error }) {
  /* { owner, index, block } — index null : ajouter une ligne ; sinon
     remplacer l'exercice de la ligne, `block` disant lequel des deux quand
     la ligne en porte deux. */
  const [picker, setPicker] = useState(null);
  const { program } = draft;
  const apply = (fn, ...args) => onChange(fn(draft, ...args));
  const openPicker = (owner, index = null, block = null) => setPicker({ owner, index, block });
  const choose = (id) => {
    const p = picker;
    setPicker(null);
    if (!p) return;
    if (p.index == null) apply(addRow, p.owner, id);
    else apply(patchRow, p.owner, p.index, p.block ? { [p.block]: id } : { b1: id, b2: id });
  };

  const warmKeys = Object.keys(program.WARM);
  const coreKeys = Object.keys(program.CORE);

  /* Une charge de départ est indexée par exercice, pas par ligne : un même
     exercice tenu par deux séances n'en a qu'une. Les exercices sans `incr`
     — planche latérale, ab wheel — ne portent aucune charge et n'ont donc
     pas de champ, plutôt qu'un champ qui ne servirait à rien. */
  const loads = useMemo(
    () => referencedExercises(program).map((id) => ({ id, v: EXERCISES[id] })).filter(({ v }) => v && v.incr != null),
    [program],
  );

  return (
    <div className="px-4">
      <div className="sticky top-0 z-10 bg-surface border-b border-rule -mx-4 px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="h-11 -ml-2 px-2 inline-flex items-center gap-1 text-sm text-ink-muted rounded focus:outline-none focus:ring-2 focus:ring-focus">
            <ChevronLeft size={18} />Plan
          </button>
          <div className="flex-1 text-lg font-semibold truncate">{draft.name || "Programme"}</div>
          <button type="button" onClick={onSave} className="h-11 px-4 shrink-0 rounded-md bg-accent text-ink-inverse font-medium focus:outline-none focus:ring-2 focus:ring-focus">
            Enregistrer
          </button>
        </div>
        {/* Le refus vient du validateur partagé (journal-shape.js), pas d'une
            règle de l'écran : la phrase est la sienne, mot pour mot, et c'est
            la même que celle d'un fichier importé refusé (§2.9). */}
        {error && <p role="alert" className="text-sm text-alert mt-2">{error}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <Labeled label="Nom du programme">
          <input value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} className={`mt-1 ${FIELD}`} />
        </Labeled>
        <Labeled label="Départ (un lundi)">
          <input type="date" value={draft.startDate} onChange={(e) => onChange({ ...draft, startDate: e.target.value })} className={`mt-1 ${FIELD}`} />
        </Labeled>
      </div>
      {/* #58 : l'intention déclarée d'un programme généré, en lecture seule.
          Rien n'y est modifiable — la changer sans régénérer produirait un
          programme jugé contre une intention qui n'est pas la sienne. Elle
          est là pour que l'avis de Plan soit lisible : les cibles qu'il
          oppose au programme sont écrites là où on l'édite. Un programme
          composé à la main n'en a pas, et la ligne n'apparaît pas. */}
      {intentSummary(draft.intent) && (
        <p className="text-xs text-ink-muted mt-2">{intentSummary(draft.intent)}</p>
      )}
      <p className="text-xs text-ink-faint mt-2">
        Douze semaines, comme tout programme que cette version sait exécuter. L'ordre des séances est celui de cette liste — le jour ne la réordonne pas.
      </p>

      {/* ---------- Séances ---------- */}
      <h2 className="text-sm text-ink-muted mt-6">Séances</h2>
      <div className="mt-2 space-y-3">
        {program.SESSIONS.map((s, i) => (
          <div key={s.id} className="rounded-md border border-rule p-3">
            <div className="flex items-start gap-1">
              <input value={s.name} onChange={(e) => apply(patchSession, s.id, { name: e.target.value })} aria-label="Nom de la séance" className={`${FIELD} font-medium`} />
              <IconBtn label="Monter la séance" onClick={() => apply(moveSession, s.id, -1)} disabled={i === 0}><ChevronUp size={18} /></IconBtn>
              <IconBtn label="Descendre la séance" onClick={() => apply(moveSession, s.id, 1)} disabled={i === program.SESSIONS.length - 1}><ChevronDown size={18} /></IconBtn>
              {/* La dernière séance ne se supprime pas : SESSIONS vide est
                  refusé par le validateur (program-editor.js, removeSession). */}
              <IconBtn label="Supprimer la séance" onClick={() => apply(removeSession, s.id)} disabled={program.SESSIONS.length <= 1}><X size={18} /></IconBtn>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Labeled label="Sous-titre">
                <input value={s.sub || ""} onChange={(e) => apply(patchSession, s.id, { sub: e.target.value })} placeholder="Pecs, épaules, triceps" className={`mt-1 ${FIELD}`} />
              </Labeled>
              <Labeled label="Jour">
                <select value={s.day} onChange={(e) => apply(patchSession, s.id, { day: e.target.value })} className={`mt-1 ${FIELD}`}>
                  {DAY_NAMES.map((d, n) => <option key={d} value={n + 1}>{d}</option>)}
                </select>
              </Labeled>
              <Labeled label="Échauffement">
                <select value={s.warm} onChange={(e) => apply(patchSession, s.id, { warm: e.target.value })} className={`mt-1 ${FIELD}`}>
                  {warmKeys.map((k, n) => <option key={k} value={k}>{warmLabel(n, program.WARM[k])}</option>)}
                </select>
              </Labeled>
              <Labeled label="Gainage">
                <select value={s.core} onChange={(e) => apply(patchSession, s.id, { core: e.target.value })} className={`mt-1 ${FIELD}`}>
                  {coreKeys.map((k) => <option key={k} value={k}>{program.CORE[k].label || k}</option>)}
                </select>
              </Labeled>
            </div>
            <div className="mt-3 border-t border-rule">
              <Rows program={program} owner={{ session: s.id }} rows={s.ex} apply={apply} onPick={openPicker} />
            </div>
            <AddBtn onClick={() => openPicker({ session: s.id })}>Ajouter un exercice</AddBtn>
          </div>
        ))}
      </div>
      <AddBtn onClick={() => apply(addSession)}>Ajouter une séance</AddBtn>

      {/* ---------- Blocs de gainage ---------- */}
      <h2 className="text-sm text-ink-muted mt-6">Blocs de gainage</h2>
      <p className="text-xs text-ink-faint">Chaque séance en nomme un ; deux séances peuvent partager le même.</p>
      <div className="mt-2 space-y-3">
        {coreKeys.map((k) => {
          const used = program.SESSIONS.some((s) => s.core === k);
          return (
            <div key={k} className="rounded-md border border-rule p-3">
              <div className="flex items-start gap-1">
                <input value={program.CORE[k].label} onChange={(e) => apply(setCoreLabel, k, e.target.value)} aria-label="Nom du bloc de gainage" className={`${FIELD} font-medium`} />
                <IconBtn label="Supprimer le bloc" onClick={() => apply(removeCore, k)} disabled={used}><X size={18} /></IconBtn>
              </div>
              {used && <p className="text-xs text-ink-faint mt-1">Utilisé par une séance : pour le supprimer, remplace-le d'abord dans la séance.</p>}
              <div className="mt-2 border-t border-rule">
                <Rows program={program} owner={{ core: k }} rows={program.CORE[k].ex} apply={apply} onPick={openPicker} />
              </div>
              <AddBtn onClick={() => openPicker({ core: k })}>Ajouter un exercice</AddBtn>
            </div>
          );
        })}
      </div>
      <AddBtn onClick={() => apply(addCore, "Gainage")}>Ajouter un bloc</AddBtn>

      {/* ---------- Échauffements ---------- */}
      <h2 className="text-sm text-ink-muted mt-6">Échauffements</h2>
      <p className="text-xs text-ink-faint">Le texte affiché en tête de séance. Chaque séance en nomme un ; deux séances peuvent partager le même.</p>
      <div className="mt-2 space-y-3">
        {warmKeys.map((k, i) => {
          const used = program.SESSIONS.some((s) => s.warm === k);
          return (
            <div key={k} className="rounded-md border border-rule p-3">
              <div className="flex items-center gap-1">
                <span className="flex-1 font-medium text-ink">Échauffement {i + 1}</span>
                <IconBtn label="Supprimer l'échauffement" onClick={() => apply(removeWarm, k)} disabled={used}><X size={18} /></IconBtn>
              </div>
              <textarea value={program.WARM[k]} onChange={(e) => apply(setWarmText, k, e.target.value)} rows={3} aria-label={`Échauffement ${i + 1}`}
                placeholder="5 min vélo, rotations d'épaules, deux séries montantes"
                className="mt-2 w-full px-3 py-2 rounded-md bg-surface-raised border border-rule text-ink text-sm focus:outline-none focus:ring-2 focus:ring-focus" />
              {used && <p className="text-xs text-ink-faint">Utilisé par une séance : pour le supprimer, remplace-le d'abord dans la séance.</p>}
            </div>
          );
        })}
      </div>
      <AddBtn onClick={() => apply(addWarm, "Échauffement")}>Ajouter un échauffement</AddBtn>

      {/* ---------- Charges de départ ---------- */}
      <h2 className="text-sm text-ink-muted mt-6">Charges de départ</h2>
      <p className="text-xs text-ink-faint">
        À remplir si tu connais tes charges. Laissé vide, l'exercice démarre par la semaine 1 de calibration, qui les trouve à ta place. Zéro est une valeur : c'est une traction au poids du corps.
      </p>
      {loads.length === 0 ? (
        <p className="text-sm text-ink-faint py-3">Les exercices ajoutés aux séances apparaîtront ici.</p>
      ) : (
        <div className="mt-2 divide-y divide-rule border-y border-rule">
          {loads.map(({ id, v }) => (
            <div key={id} className="py-2 flex items-center gap-3">
              <span className="flex-1 text-sm text-ink">{v.name}</span>
              <input type="number" inputMode="decimal" aria-label={`Charge de départ, ${v.name}`}
                value={draft.startingLoads[id] ?? ""}
                onChange={(e) => apply(setStartingLoad, id, e.target.value === "" ? NaN : Number(e.target.value))}
                className="h-10 w-20 shrink-0 px-2 text-center rounded-md bg-surface-raised border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-focus" />
              <span className="w-16 shrink-0 text-xs text-ink-muted">{loadUnit(v)}</span>
            </div>
          ))}
        </div>
      )}

      {picker && <Picker onChoose={choose} onClose={() => setPicker(null)} />}
    </div>
  );
}
