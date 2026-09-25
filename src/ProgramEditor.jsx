/* =========================================================
   Éditeur de programme — composer une séance à la main (#36, #113)

   Ce fichier n'émet que du balisage. Les mutations viennent toutes de
   src/program-editor.js, le filtrage du sélecteur de src/exercise-filter.js,
   les libellés de src/display.js : c'est ce que demande ARCHITECTURE §2.6,
   et c'est ce qui permet à la totalité de la logique de l'éditeur d'être
   testée sous `node --test`, sans moteur de rendu. #113 ne change aucune de
   ces trois choses — seule la présentation change, d'une page qui empile
   Séances/Gainage/Échauffements/Charges à des onglets.

   Le composant est contrôlé, comme ExerciseSheet.jsx : il reçoit un
   brouillon et rend le brouillon suivant à `onChange`. Il ne possède que
   l'état qui n'est pas de la donnée — l'onglet actif, la séance ouverte, le
   sélecteur d'exercices ouvert. Rien de ce qu'on tape ici n'est stocké tant
   que `onSave` n'a pas été appelé (#36 Q4) : le garde-fou de sortie vit dans
   App.jsx, seul à voir les onglets du bas.

   Ce que l'écran montre du format, et ce qu'il en tait : les ids de séance
   et de slot ne sont jamais affichés — ce sont des adresses, engendrées par
   program-editor.js. Les variantes de bloc (b1/b2) ne se montrent que
   lorsqu'un programme importé en porte deux différentes ; l'éditeur ne
   propose pas d'en créer, faute d'un écran qui dise ce que « bloc 1 » et
   « bloc 2 » veulent dire (suivi).
   ========================================================= */

import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronUp, ChevronDown, GripVertical, Plus, X } from "lucide-react";
import { EXERCISES } from "./registry.js";
import { DAY_NAMES, unitLoadLabel, carryNote, dateShort, weekdayName } from "./display.js";
import ExercisePicker from "./ExercisePicker.jsx";
import { intentSummary, PRESETS } from "./generator.js";
import { parseLocalDate } from "./definition.js";
import {
  addSession, removeSession, moveSession, patchSession,
  addRow, removeRow, moveRow, patchRow,
  addWarm, setWarmText, removeWarm,
  addCore, setCoreLabel, removeCore,
  referencedExercises, setStartingLoad, carryNewlyReferenced,
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

/* #113 : les quatre onglets, dans l'ordre où la maquette approuvée les
   nomme. `count` reste `null` pour Charges — un compte d'exercices chargés
   n'aurait pas dit la même chose qu'un compte de séances ou de blocs, et la
   maquette ne le propose pas. */
const TABS = [
  ["seances", "Séances", (program) => program.SESSIONS.length],
  ["gainage", "Gainage", (program) => Object.keys(program.CORE).length],
  ["echauffement", "Échauff.", (program) => Object.keys(program.WARM).length],
  ["charges", "Charges", null],
];

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

/* ---------- Une liste de lignes d'exercice, toujours dépliée ----------
   Le gainage n'a pas besoin du repli par exercice de #113 (SessionRows,
   plus bas) : un bloc en porte rarement plus de deux ou trois, et les
   séances et le gainage partagent quand même ces mêmes fonctions de
   mutation, à l'adresse près : { session: id } ou { core: clé }. */
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

/* ---------- Les exercices d'une séance ouverte (#113) ----------
   Un exercice à la fois : chaque ligne se replie sur son nom et un jeton
   "séries × reps", le détail s'ouvrant au tap — la même idée qu'un cran plus
   haut (une séance à la fois dans l'onglet Séances), appliquée à ses
   exercices. Repliées par défaut (retour de test) : rien ne s'ouvre tout
   seul, `useState` local plutôt que porté par le parent parce que ce
   composant est remonté à chaque changement de séance ouverte (`key={session.id}`
   à l'appel), ce qui remet l'exercice ouvert à zéro sans code de plus.

   Réordonner se fait à la poignée (retour de test sur #113 : le mécanisme
   standard, pas des flèches) — `moved()` (program-editor.js) n'échange que
   deux voisins, donc glisser au-delà d'une ligne rejoue cet échange à chaque
   ligne franchie plutôt que de sauter directement à l'index visé. */
function SessionRows({ program, owner, rows, apply, onPick }) {
  const [openIndex, setOpenIndex] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const rowHeight = useRef(0);
  const drag = useRef(null);

  const startDrag = (i, e) => {
    e.preventDefault();
    setOpenIndex(null);
    rowHeight.current = e.currentTarget.closest("[data-row]")?.getBoundingClientRect().height || 44;
    drag.current = { startY: e.clientY, from: i, at: i };
    setDragIndex(i);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const dragMove = (e) => {
    if (!drag.current) return;
    const steps = Math.round((e.clientY - drag.current.startY) / rowHeight.current);
    const target = Math.min(rows.length - 1, Math.max(0, drag.current.from + steps));
    while (drag.current.at !== target) {
      const dir = target > drag.current.at ? 1 : -1;
      apply(moveRow, owner, drag.current.at, dir);
      drag.current.at += dir;
    }
    setDragIndex(drag.current.at);
  };
  const endDrag = () => { drag.current = null; setDragIndex(null); };

  if (!rows.length) return <p className="text-sm text-ink-faint py-3">Aucun exercice.</p>;
  return (
    <div className="divide-y divide-rule">
      {rows.map(([slotId, sets], i) => {
        const slot = program.SLOTS[slotId];
        if (!slot) return null;
        const patch = (p) => apply(patchRow, owner, i, p);
        const open = openIndex === i;
        /* Clé = l'adresse du slot, pas l'index : glisser au-delà d'une ligne
           échange des index à chaque pas (moved(), ci-dessus), et une clé
           indexée aurait démonté puis remonté le nœud tenu par le doigt à
           chaque échange, coupant la capture du pointeur en plein geste. */
        return (
          <div key={slotId} data-row className={`py-2.5 ${dragIndex === i ? "bg-surface-raised rounded-md" : ""}`}>
            <div className="flex items-center gap-2">
              <span onPointerDown={(e) => startDrag(i, e)} onPointerMove={dragMove} onPointerUp={endDrag} onPointerCancel={endDrag}
                aria-label={`Déplacer ${EXERCISES[slot.b1]?.name || slot.b1}`} role="button"
                className="shrink-0 -ml-1.5 p-1.5 text-ink-faint touch-none cursor-grab active:cursor-grabbing">
                <GripVertical size={16} />
              </span>
              <button type="button" onClick={() => setOpenIndex(open ? null : i)} aria-expanded={open}
                className="flex-1 min-w-0 flex items-center gap-2 text-left focus:outline-none focus:ring-2 focus:ring-focus rounded">
                <span className="flex-1 min-w-0 truncate text-ink">{EXERCISES[slot.b1]?.name || slot.b1}</span>
                <span className="shrink-0 text-xs text-ink-muted bg-surface-raised border border-rule rounded-full px-2 py-0.5">{sets} × {slot.reps[0]}–{slot.reps[1]}</span>
                <ChevronDown size={16} className={`shrink-0 text-ink-faint transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
            </div>
            {open && (
              <div className="pt-2 pl-6">
                <div className="flex items-start gap-1">
                  <button type="button" onClick={() => onPick(owner, i, slot.b1 === slot.b2 ? null : "b1")}
                    className="flex-1 text-left text-sm text-ink-muted py-1.5 rounded focus:outline-none focus:ring-2 focus:ring-focus">
                    Changer l'exercice
                  </button>
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
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ProgramEditor({ draft, onChange, onBack, onSave, error, carry }) {
  /* { owner, index, block } — index null : ajouter une ligne ; sinon
     remplacer l'exercice de la ligne, `block` disant lequel des deux quand
     la ligne en porte deux. */
  const [picker, setPicker] = useState(null);
  const { program } = draft;
  /* #74 : un exercice qui entre dans le brouillon reçoit sa charge reportée
     s'il a un historique — et seulement lui, jamais un champ vidé exprès. */
  const apply = (fn, ...args) => onChange(carryNewlyReferenced(draft, fn(draft, ...args), carry));
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

  /* #113 : l'onglet actif, et la séance ouverte dans l'onglet Séances — une
     à la fois. Ni l'un ni l'autre n'est une donnée du brouillon : perdus au
     démontage de l'écran, comme le sélecteur d'exercices l'a toujours été. */
  const [tab, setTab] = useState("seances");
  const [openSessionId, setOpenSessionId] = useState(program.SESSIONS[0]?.id ?? null);
  const activeSessionId = program.SESSIONS.some((s) => s.id === openSessionId) ? openSessionId : program.SESSIONS[0]?.id ?? null;

  /* Une charge de départ est indexée par exercice, pas par ligne : un même
     exercice tenu par deux séances n'en a qu'une. Les exercices sans `incr`
     — planche latérale, ab wheel — ne portent aucune charge et n'ont donc
     pas de champ, plutôt qu'un champ qui ne servirait à rien. */
  const loads = useMemo(
    () => referencedExercises(program).map((id) => ({ id, v: EXERCISES[id] })).filter(({ v }) => v && v.incr != null),
    [program],
  );

  /* #113 : le résumé — matériel déclaré (un programme composé à la main n'en
     a pas, et le mot ne s'affiche pas), nombre de jours, durée déclarée. */
  const summary = [
    draft.intent && PRESETS[draft.intent.equipment] ? PRESETS[draft.intent.equipment].label : null,
    `${program.SESSIONS.length} j`,
    draft.intent?.duration ? `${draft.intent.duration} min` : null,
  ].filter(Boolean).join(" · ");
  const startLabel = draft.startDate ? `${weekdayName(parseLocalDate(draft.startDate))} ${dateShort(draft.startDate)}` : null;

  /* #113 : la phrase du validateur ne nomme jamais explicitement un onglet,
     mais elle cite toujours le champ fautif — program.SESSIONS, program.CORE
     ou program.WARM. Un repère plutôt qu'une preuve : mieux vaut désigner le
     bon onglet la plupart du temps que n'en désigner aucun. */
  const errorTab = !error ? null : error.includes("CORE") ? "gainage" : error.includes("WARM") ? "echauffement" : "seances";

  return (
    <div className="px-4">
      <div className="sticky top-0 z-10 bg-surface border-b border-rule -mx-4 px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="h-11 -ml-2 px-2 inline-flex items-center gap-1 text-sm text-ink-muted rounded focus:outline-none focus:ring-2 focus:ring-focus">
            <ChevronLeft size={18} />Programme
          </button>
          <div className="flex-1 text-lg font-semibold truncate">{draft.name || "Programme"}</div>
          <button type="button" onClick={onSave} className="h-11 px-4 shrink-0 rounded-md bg-accent text-ink-inverse font-medium focus:outline-none focus:ring-2 focus:ring-focus">
            Enregistrer
          </button>
        </div>
        {summary && <p className="text-sm text-ink-muted mt-1">{summary}</p>}
        {startLabel && <p className="text-sm text-ink-muted">Départ {startLabel} · 12 semaines</p>}
        {/* Le refus vient du validateur partagé (journal-shape.js), pas d'une
            règle de l'écran : la phrase est la sienne, mot pour mot, et c'est
            la même que celle d'un fichier importé refusé (§2.9). */}
        {error && <p role="alert" className="text-sm text-alert mt-2">{error}</p>}
        <div className="flex gap-1 mt-3 -mx-1">
          {TABS.map(([key, label, count]) => (
            <button key={key} type="button" onClick={() => setTab(key)}
              className={`flex-1 h-10 px-1 rounded-md text-sm font-medium relative focus:outline-none focus:ring-2 focus:ring-focus
                ${tab === key ? "bg-accent text-ink-inverse" : "bg-surface-raised text-ink-soft"}`}>
              {label}{count ? ` (${count(program)})` : ""}
              {errorTab === key && tab !== key && <span aria-hidden="true" className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-alert" />}
            </button>
          ))}
        </div>
      </div>

      {tab === "seances" && (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Nom du programme">
              <input value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} className={`mt-1 ${FIELD}`} />
            </Labeled>
            <Labeled label="Départ (un lundi)">
              <input type="date" value={draft.startDate} onChange={(e) => onChange({ ...draft, startDate: e.target.value })} className={`mt-1 ${FIELD}`} />
            </Labeled>
          </div>
          {/* #58 : l'intention déclarée d'un programme généré, en lecture seule.
              Rien n'y est modifiable — la changer sans régénérer produirait un
              programme jugé contre une intention qui n'est pas la sienne. Un
              programme composé à la main n'en a pas, et la ligne n'apparaît pas. */}
          {intentSummary(draft.intent) && (
            <p className="text-xs text-ink-muted mt-2">{intentSummary(draft.intent)}</p>
          )}

          {/* #113 : une séance ouverte à la fois. Les autres se replient sur
              leur jour, leur nom et leur nombre d'exercices — de quoi
              retrouver la bonne sans l'ouvrir. */}
          <div className="mt-4 space-y-2">
            {program.SESSIONS.map((s, i) => {
              const open = s.id === activeSessionId;
              if (!open) {
                return (
                  <button key={s.id} type="button" onClick={() => setOpenSessionId(s.id)}
                    className="w-full flex items-center justify-between gap-3 py-3 px-3 rounded-md border border-rule bg-surface-raised text-left focus:outline-none focus:ring-2 focus:ring-focus">
                    <span className="min-w-0">
                      <span className="block text-ink font-medium truncate">{s.name}</span>
                      <span className="block text-sm text-ink-muted">{DAY_NAMES[s.day - 1]}</span>
                    </span>
                    <span className="shrink-0 text-sm text-ink-muted">{s.ex.length} ex.</span>
                  </button>
                );
              }
              return (
                <div key={s.id} className="rounded-md border border-rule p-3">
                  <div className="flex items-start gap-1">
                    <IconBtn label="Replier la séance" onClick={() => setOpenSessionId(null)}><ChevronUp size={18} /></IconBtn>
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
                    <SessionRows key={s.id} program={program} owner={{ session: s.id }} rows={s.ex} apply={apply} onPick={openPicker} />
                  </div>
                  <AddBtn onClick={() => openPicker({ session: s.id })}>Ajouter un exercice</AddBtn>
                </div>
              );
            })}
          </div>
          <AddBtn onClick={() => apply(addSession)}>Ajouter une séance</AddBtn>
        </div>
      )}

      {tab === "gainage" && (
        <div className="mt-4">
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
        </div>
      )}

      {tab === "echauffement" && (
        <div className="mt-4">
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
        </div>
      )}

      {tab === "charges" && (
        <div className="mt-4">
          <p className="text-xs text-ink-faint">
            Celles des exercices déjà faits sont reprises de ton journal, et la semaine 1 de calibration les valide. Laissé vide, l'exercice démarre par des paliers, qui trouvent la charge à ta place. Zéro est une valeur : c'est une traction au poids du corps.
          </p>
          {loads.length === 0 ? (
            <p className="text-sm text-ink-faint py-3">Les exercices ajoutés aux séances apparaîtront ici.</p>
          ) : (
            <div className="mt-2 divide-y divide-rule border-y border-rule">
              {loads.map(({ id, v }) => (
                <div key={id} className="py-2 flex items-center gap-3">
                  {/* #74 : la provenance tant que la valeur est celle reportée ;
                      modifiée à la main, elle est la tienne et la note s'efface. */}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-ink">{v.name}</span>
                    {draft.carried?.[id] && draft.startingLoads[id] === draft.carried[id].load && (
                      <span className="block text-xs text-ink-faint">{carryNote(draft.carried[id], v)}</span>
                    )}
                  </span>
                  <input type="number" inputMode="decimal" aria-label={`Charge de départ, ${v.name}`}
                    value={draft.startingLoads[id] ?? ""}
                    onChange={(e) => apply(setStartingLoad, id, e.target.value === "" ? NaN : Number(e.target.value))}
                    className="h-10 w-20 shrink-0 px-2 text-center rounded-md bg-surface-raised border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-focus" />
                  <span className="w-16 shrink-0 text-xs text-ink-muted">{loadUnit(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {picker && <ExercisePicker onChoose={choose} onClose={() => setPicker(null)} />}
    </div>
  );
}
