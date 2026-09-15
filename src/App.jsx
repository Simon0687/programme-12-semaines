import { useState, useEffect, useMemo, useRef } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Timer, Download, Upload, Zap, X } from "lucide-react";
import { SCHEMA_VERSION, emptyJournal, weekKey, dateForSlot, findLog, writeLog, withVersion } from "./schema.js";
import { parseJournalImport, parseProgramImport } from "./import.js";
import { listBackups, readDroppedBackup, backupPreImportOnce, readPreImportBackup } from "./backup.js";
import { createStore, loadJournal, saveJournal } from "./storage.js";
import { saveFile, readFile } from "./file-io.js";
import { readScreen, writeScreen, resolveScreen } from "./screen-state.js";
import { readLastExport, writeLastExport, toIsoDate, isExportStale, journalHasContent, daysBetween } from "./export-state.js";
import { unusableProgramIds } from "./journal-shape.js";
import { buildProgram, getKeySlots, hasCardioContent, hasCardioItems, hasMobilityDays } from "./program.js";
import { AFTER_HINTS } from "./cardio.js";
import { num, fmt, blockOf, phaseOf, setsFor, lastEntry, lastEntryLabel, planned, computeKind, workingSets, loadDrops, loadText } from "./progression.js";
import { setSummary } from "./display.js";
import { EXERCISE_IDS } from "./registry.js";
import ExerciseSheet from "./ExerciseSheet.jsx";
import { buildPlan, PLAN_INTRO, PHASE_NOTES } from "./plan.js";
import { useLoadPicker, LoadPickerOverlay, LOAD_FIELD_STYLE } from "./LoadPicker.jsx";
import { buildBilan } from "./bilan.js";
import { DEFAULT_DEFINITION, parseLocalDate } from "./definition.js";
import { LEGACY_DEFINITION } from "./legacy-program.js";

/* =========================================================
   Programme 12 semaines — Simon
   Départ lundi 7 septembre 2026. Données conservées via window.storage.
   ========================================================= */

const KEY = "prog12_simon_v1";
const STORE = createStore();
/* #15 : objets navigateur passés explicitement à file-io.js, jamais lus par
   lui (ARCHITECTURE §2.7, même raison que le store injecté). */
const FILE_ENV = typeof window === "undefined" ? {} : { nav: window.navigator, doc: window.document, url: window.URL };
/* #41 : sessionStorage passe par la même porte que le reste — injecté dans
   screen-state.js, jamais lu par lui (ARCHITECTURE §2.7). En navigation
   privée, Safari fait lever l'accès lui-même, d'où le try autour. */
const SCREEN_STORAGE = (() => { try { return typeof window === "undefined" ? null : window.sessionStorage; } catch (e) { return null; } })();
/* Contexte de migration (#16) : injecté dans migrate()/MIGRATIONS[2],
   jamais construit par schema.js lui-même (cycle d'import, voir schema.js
   MIGRATIONS[2]). Depuis #26, la définition transmise est nommément le
   programme hérité (src/legacy-program.js) et non « le bundle courant » :
   un journal historique a été tenu contre ce programme-là, et le bundle par
   défaut va cesser d'être le même. */
const MIGRATION_CTX = { legacyDefinition: LEGACY_DEFINITION, buildProgram };
/* Journal présent en stockage mais illisible : schemaVersion hors bornes ou
   JSON corrompu (#10). Persistant (pas un toast) et affiché hors de tout
   onglet, puisque le problème survient avant même que l'utilisateur en
   choisisse un. */
/* Une seule phrase pour deux causes — migration impossible et forme illisible
   (#32, décisions Q5) : elle ne prétend plus qu'une mise à jour a été tentée,
   ce qui était faux dans le second cas, et garde la moitié qui compte pour
   quelqu'un devant une appli bloquée : rien n'a été détruit. */
const LOAD_ERROR_MESSAGE = "Le journal enregistré n'a pas pu être lu. Rien n'a été chargé, rien n'a été écrasé.";
/* #41 : les sept champs saisis du bilan, dans l'ordre du formulaire. La liste
   n'est pas décorative — elle sert au compteur affiché sur l'en-tête de la
   section repliée, qui est ce qui permet de savoir où on en est sans déplier.
   « douleurs » n'y est plus : la douleur remonte des notes de séance. */
const BILAN_KEYS = ["poids", "taille", "sommeil", "energie", "rir", "nutrition", "remarques"];
const BILAN_FIELDS = BILAN_KEYS.length;
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const DAYNAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const addDays = (d, n) =>{ const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dateLabel = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const weekRange = (start, w) => {
  const a = addDays(start, (w - 1) * 7), b = addDays(a, 6);
  return `${a.getDate()}${a.getMonth() === b.getMonth() ? "" : " " + MONTHS[a.getMonth()]} – ${dateLabel(b)}`;
};

/* ---------- Petits composants ---------- */
function Section({ title, children, open: o0 = false }) {
  const [open, setOpen] = useState(o0);
  return (
    <div className="border-b border-slate-700">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-3 text-left focus:outline-none focus:ring-2 focus:ring-amber-400 rounded">
        <span className="font-medium text-slate-100">{title}</span>
        <ChevronDown size={18} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="pb-4 text-sm text-slate-300 leading-relaxed space-y-2">{children}</div>}
    </div>
  );
}
function Field({ label, value, onChange, placeholder, wide, type = "text" }) {
  return (
    <label className={`block ${wide ? "col-span-2" : ""}`}>
      <span className="text-xs text-slate-400">{label}</span>
      <input type={type} inputMode={type === "text" ? "text" : "decimal"} value={value || ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-11 px-3 rounded-md bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400" />
    </label>
  );
}
function Btn({ children, onClick, primary, small, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${small ? "h-9 px-3 text-sm" : "h-12 px-4 text-base"} rounded-md font-medium inline-flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-40
        ${primary ? "bg-amber-400 text-slate-900" : "bg-slate-800 text-slate-100 border border-slate-700"}`}>
      {children}
    </button>
  );
}

/* ---------- Carte exercice ---------- */
function ExerciseCard({ idx, slotId, nSets, week, weeks, si, date, prog, state, rows, onSet, onTimer, onOpen }) {
  const slot = prog.SLOTS[slotId];
  const vid = slot[blockOf(week)];
  const v = prog.V[vid];
  const unit = v.unit || "kg";
  const sets = setsFor(nSets, week);
  const plan = useMemo(() => planned(prog, state, slotId, week, si, date), [prog, state, slotId, week, si, date]);
  const last = useMemo(() => lastEntry(prog, state, vid, date, si), [prog, state, vid, date, si]);
  const [open, setOpen] = useState(false);
  const phase = phaseOf(week);
  const failOk = slot.fail && week >= 3 && week !== 7;
  const amrap = week === weeks && slot.key;
  const cols = unit === "time" ? ["s / côté", "RIR"] : unit === "reps" ? ["reps", "RIR"] : unit === "carry" ? ["kg", "s / côté", "RIR"] : unit === "bw" ? ["lest kg", "reps", "RIR"] : ["kg", "reps", "RIR"];
  const fields = unit === "time" || unit === "reps" ? ["r", "rir"] : ["w", "r", "rir"];
  const repLabel = unit === "time" || unit === "carry" ? `${slot.reps[0]}–${slot.reps[1]} s` : `${slot.reps[0]}–${slot.reps[1]} reps`;

  /* #42 : « faite » est dérivé, pas stocké. Une série compte quand elle porte
     ses valeurs — c'est déjà la règle du moteur, planned() ne retient une
     série que si r != null (progression.js). Stocker un drapeau par série
     serait un champ neuf dans le journal, donc une migration, pour le seul
     confort de pouvoir décocher.

     RIR exclu du critère pour la même raison : planned() ne le lit jamais. Il
     est informatif, donc pré-rempli quand la phase donne un chiffre unique et
     laissé vide en calibration et en décharge, où la cible est une fourchette. */
  const filled = (row, f) => String((row && row[f]) ?? "").trim() !== "";
  const doneFields = fields.filter((f) => f !== "rir");
  const rowDone = (i) => doneFields.every((f) => filled(rows[i], f));
  const nextIdx = Array.from({ length: sets }).findIndex((_, i) => !rowDone(i));
  const rirTarget = /^\d+$/.test(String(phase.rir)) ? String(phase.rir) : null;

  /* #46 : appui long sur un champ de charge, glisser, relâcher. Corriger une
     charge, c'est un cran d'écart — `v.incr` le connaît, `planned()` donne
     l'ancre — et le pavé numérique fait payer quatre frappes ce détour. Le tap
     court garde le clavier : la roue est le chemin rapide, pas une cage. */
  const picker = useLoadPicker({ incr: v.incr, onCommit: (i, f, value) => onSet(vid, i, f, value) });

  /* Remplit ce qui manque, n'écrase jamais ce qui est là, et lance le repos.
     Sur une série déjà complète, relance simplement le repos : un bouton vert
     qui ne fait rien serait une fausse affordance, et effacer une saisie
     derrière un tap serait pire. */
  const validateRow = (i) => {
    const row = rows[i] || {};
    if (!rowDone(i)) {
      if (fields.includes("w") && !filled(row, "w") && plan.load != null) onSet(vid, i, "w", fmt(plan.load));
      if (!filled(row, "r")) onSet(vid, i, "r", String(slot.reps[1]));
      if (rirTarget && !filled(row, "rir")) onSet(vid, i, "rir", rirTarget);
    }
    onTimer(slot.rest, v.name);
  };

  return (
    <div className="py-4 border-b border-slate-700">
      <div className="flex items-start justify-between gap-3">
        <div>
          {/* #17 : le nom ouvre la fiche de l’exercice. La cible existait déjà —
              c’est la première chose qu’on lit — et le chevron la signale. */}
          <button onClick={() => onOpen(vid)} className="text-left focus:outline-none focus:ring-2 focus:ring-amber-400 rounded">
            <span className="font-medium text-slate-100 leading-snug">{idx}. {v.name}</span>
            <ChevronRight size={15} className="inline text-slate-500 ml-1 mb-0.5" />
          </button>
          <div className="text-sm text-slate-400 mt-0.5">
            {sets} × {repLabel}{v.side ? " par côté" : ""}, RIR {phase.rir}
            {failOk && <span className="ml-2 inline-flex items-center gap-1 text-amber-400"><Zap size={13} />dernière série à l'échec OK</span>}
            {amrap && <span className="ml-2 text-amber-400">S12 : dernière série AMRAP</span>}
          </div>
        </div>
        <button onClick={() => onTimer(slot.rest, v.name)} aria-label="Lancer le repos" className="shrink-0 h-9 px-2 rounded-md bg-slate-800 border border-slate-700 text-slate-300 inline-flex items-center gap-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
          <Timer size={15} />{Math.floor(slot.rest / 60)}:{String(slot.rest % 60).padStart(2, "0")}
        </button>
      </div>

      <div className="mt-2 text-sm">
        <span className="text-slate-100">Prévu : <span className="text-amber-400 font-medium">{plan.text}</span></span>
        {plan.why && <span className="text-slate-400"> — {plan.why}</span>}
      </div>
      {last && <div className="text-sm text-slate-400">Dernière fois ({lastEntryLabel(last)}) : {setSummary(last.sets, v)}</div>}

      <button onClick={() => setOpen(!open)} className="mt-1 text-sm text-slate-400 inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded">
        Technique <ChevronDown size={14} className={open ? "rotate-180" : ""} />
      </button>
      {open && <p className="text-sm text-slate-300 leading-relaxed mt-1">{v.cue}</p>}

      <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: fields.length === 3 ? "2rem 1fr 1fr 1fr 2.75rem" : "2rem 1fr 1fr 2.75rem" }}>
        <div />
        {cols.map((c) => <div key={c} className="text-xs text-slate-400 text-center">{c}</div>)}
        <div />
        {Array.from({ length: sets }).map((_, i) => {
          const row = rows[i] || {};
          const done = rowDone(i);
          const isNext = i === nextIdx;
          return [
            <div key={`n${i}`} className={`text-sm self-center ${done ? "text-emerald-400" : isNext ? "text-slate-100" : "text-slate-400"}`}>S{i + 1}</div>,
            ...fields.map((f) => (
              <input key={`${i}${f}`} inputMode="decimal" aria-label={`Série ${i + 1} ${f}`}
                value={row[f] == null ? "" : row[f]}
                placeholder={f === "w" && plan.load != null ? fmt(plan.load) : ""}
                {...(f === "w" ? picker.handlers(i, f, num(row[f]), plan.load) : {})}
                onChange={(e) => onSet(vid, i, f, e.target.value)}
                className={`h-11 w-full text-center rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400 ${done ? "bg-slate-900 border border-slate-800 text-slate-400" : isNext ? "bg-slate-800 border border-slate-600 text-slate-100" : "bg-slate-800 border border-slate-700 text-slate-100"}`} style={{ fontVariantNumeric: "tabular-nums", ...(f === "w" ? LOAD_FIELD_STYLE : null) }} />
            )),
            /* #42 : remplit depuis « Prévu », marque la série et lance le repos.
               Les champs restent modifiables : corriger, c'est taper par-dessus. */
            <button key={`v${i}`} onClick={() => validateRow(i)}
              aria-label={done ? `Relancer le repos après la série ${i + 1}` : `Valider la série ${i + 1}`}
              className={`h-11 w-11 rounded-md inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-amber-400 ${done ? "bg-emerald-400 border border-emerald-400 text-slate-900" : isNext ? "bg-slate-800 border border-amber-400 text-amber-400" : "bg-slate-800 border border-slate-700 text-slate-600"}`}>
              <Check size={20} strokeWidth={2.5} />
            </button>,
          ];
        })}
      </div>
      <LoadPickerOverlay picker={picker.picker} incr={v.incr} unit={unit === "bw" ? "kg" : unit} />
    </div>
  );
}

/* ---------- Application ---------- */
export default function Programme() {
  const [journal, setJournal] = useState(emptyJournal(DEFAULT_DEFINITION));
  const active = journal.programs[journal.activeProgramId];
  const definition = active.definition;
  /* #22 : un objet neuf à chaque render défait tout useMemo qui en dépend
     (ExerciseCard :104-105, doneMap :272-276), y compris sur le tick 500 ms
     du minuteur de repos (:260). Mémorisé sur active seul : logs/cardio/
     checkin n'existent que sous cette référence, jamais réassignés à côté. */
  const state = useMemo(() => ({ logs: active.logs, cardio: active.cardio, checkin: active.checkin }), [active]);
  const updateActive = (fn) => setJournal((j) => {
    const id = j.activeProgramId;
    return { ...j, programs: { ...j.programs, [id]: { ...j.programs[id], ...fn(j.programs[id]) } } };
  });

  /* Cycles stockés que cette version ne sait pas exécuter (#32). Dérivé à
     chaque changement de `programs`, jamais écrit dans le journal : un
     drapeau posé sur l'entrée serait recopié en stockage par withVersion()
     à la première sauvegarde, et deviendrait une donnée à migrer. */
  const unusable = useMemo(() => new Set(unusableProgramIds(journal.programs)), [journal.programs]);

  const START = parseLocalDate(definition.startDate);
  const today = startOfDay(new Date());
  const dayIdx = Math.floor((today - START) / 86400000);
  const curWeek = Math.min(definition.weeks, Math.max(1, Math.floor(dayIdx / 7) + 1));
  const weekday = today.getDay();
  const prog = useMemo(() => buildProgram(definition), [definition]);
  const plan = useMemo(() => buildPlan(definition), [definition]);

  const [loaded, setLoaded] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  const [saveStatus, setSaveStatus] = useState("");
  /* #41 : l'écran et la séance ouverte sont une seule valeur, pas deux. Elles
     changent toujours ensemble — on n'ouvre pas Séance sans dire laquelle, et
     quitter Séance ne laisse pas traîner un identifiant. Restaurée au montage
     depuis sessionStorage, puis validée contre le programme actif : une séance
     mémorisée peut appartenir à un cycle qu'on a quitté depuis. */
  const [nav, setNav] = useState(() => resolveScreen(readScreen(SCREEN_STORAGE), prog.SESSIONS.map((s) => s.id), EXERCISE_IDS));
  const screen = nav.screen;
  const goSemaine = () => { setPendingLight(null); setNav({ screen: "semaine", sessionId: null }); };
  const goPlan = () => setNav({ screen: "plan", sessionId: null });
  /* La question de #43 ne survit pas à un changement d'écran : revenir sur une
     séance ne doit pas rouvrir un panneau qu'on avait quitté sans répondre. */
  const openSession = (id) => { setPendingLight(null); setNav({ screen: "seance", sessionId: id }); };
  /* #17 : la fiche garde le sessionId en poche — il n’y est que l’adresse du
     retour, jamais un contexte. Ouverte sans séance (ce que fera un futur
     onglet « Exercices »), le retour ramène sur Semaine et rien d’autre ne
     change dans l’écran. */
  const openExercise = (vid) => setNav({ screen: "exercice", sessionId: nav.sessionId, exerciseId: vid });
  const closeExercise = () => (nav.sessionId ? setNav({ screen: "seance", sessionId: nav.sessionId }) : goSemaine());
  const [week, setWeek] = useState(curWeek);
  /* #16 : date nominale du créneau (semaine parcourue + jour de la séance)
     dans le cycle actif — remplace w{week}_{sessionId} comme identité de
     lookup, avant même la validation (une séance en cours d'édition doit
     pouvoir être retrouvée). Deux passages du même programme ont des
     definition.startDate différents, donc jamais la même date pour
     "semaine 1" : c'est ce qui évite l'écrasement (#16 spec.md Decision 3). */
  const dateOf = (sid) => dateForSlot(definition.startDate, week, prog.SESSIONS.find((s) => s.id === sid).day);
  /* Le repli garde `session` toujours défini, y compris quand on est sur
     Semaine et que nav.sessionId est null. C'est ce qui permet de supprimer
     les gardes qu'imposait l'ancienne sentinelle "cardio". */
  const sessionId = nav.sessionId || prog.SESSIONS[0].id;
  const [timer, setTimer] = useState(null);
  const [, setTick] = useState(0);
  const [toast, setToast] = useState("");
  const [importError, setImportError] = useState("");
  const [pendingImport, setPendingImport] = useState(null); // fichier lu et validé, pas encore appliqué (#11)
  const [pendingLight, setPendingLight] = useState(null); // exercices descendus sous la référence, question posée (#43)
  const [loadError, setLoadError] = useState("");
  const [programError, setProgramError] = useState(""); // #6 : rejet d'un fichier de programme
  const [backups, setBackups] = useState([]); // [{ from, value }] — sauvegardes d'avant-migration (#8)
  const [droppedBackup, setDroppedBackup] = useState(null); // copie d'avant filtrage des lignes illisibles (#32)
  const [preImportBackup, setPreImportBackup] = useState(null); // copie d'avant le premier import (#11)
  const [exportWarnDismissed, setExportWarnDismissed] = useState(false); // masqué pour cette session seulement (#15)
  const [persisted, setPersisted] = useState(null); // true | false | null (indisponible ici) — #15
  const [lastExport, setLastExport] = useState(null); // AAAA-MM-JJ du dernier export réussi (#15)
  const [exportStatus, setExportStatus] = useState("");
  const [bilanStatus, setBilanStatus] = useState("");
  const fileInputRef = useRef(null);
  const journalInputRef = useRef(null);
  const skipSave = useRef(true);

  useEffect(() => {
    (async () => {
      const res = await loadJournal(STORE, KEY, MIGRATION_CTX);
      if (res.ok) {
        setJournal(res.journal);
        /* #32 : des lignes de séance illisibles ont été écartées. Le dire est
           la condition qui rend ce filtrage acceptable — l'original est copié
           sous <clé>_backup_dropped, et le panneau « Données » sait le
           ressortir. Une perte annoncée se répare ; une perte muette, non. */
        if (res.dropped) showToast(`${res.dropped} séance${res.dropped > 1 ? "s" : ""} illisible${res.dropped > 1 ? "s" : ""} écartée${res.dropped > 1 ? "s" : ""} : voir « Données ».`);
        if (res.migrated) {
          if (res.backupOk) {
            skipSave.current = false; // Q2 : réécrire la forme migrée dès ce chargement
            showToast("Journal mis à jour vers le nouveau format.");
          } else {
            setStorageOk(false); // décisions #8 Q2 : sauvegarde impossible => on ne réécrit rien
            showToast("Sauvegarde de sécurité impossible : rien ne sera enregistré cette session.");
          }
        }
      } else if (res.reason === "too-new") {
        // Q1 : journal écrit par une version plus récente — ne rien charger,
        // et le garde-fou de la sauvegarde empêche de l'écraser.
        setStorageOk(false);
        showToast("Ce journal vient d'une version plus récente de l'appli. Mets l'appli à jour.");
      } else if (res.reason === "invalid" || res.reason === "corrupt") {
        // schemaVersion hors bornes ou JSON corrompu (#10) — même garde-fou,
        // message persistant plutôt qu'un toast qui disparaît.
        setStorageOk(false);
        setLoadError(LOAD_ERROR_MESSAGE);
      } else if (res.reason === "no-store") {
        setStorageOk(false);
      }
      // res.reason === "absent" : rien à faire, l'état initial useState(emptyJournal(DEFAULT_DEFINITION)) tient lieu de journal.
      setBackups(await listBackups(STORE, KEY, SCHEMA_VERSION));
      setDroppedBackup(await readDroppedBackup(STORE, KEY));
      setPreImportBackup(await readPreImportBackup(STORE, KEY));
      setLastExport(await readLastExport(STORE, KEY));
      /* #15 : demander à chaque chargement plutôt qu'une fois pour toutes.
         Les navigateurs accordent ou refusent sur des heuristiques
         d'engagement, sans invite, donc répéter ne dérange personne — et un
         refus d'aujourd'hui peut devenir un accord demain, une fois la PWA
         plus utilisée. Rien n'est stocké : persisted() répond à tout moment
         (decisions-spec.md Q6). */
      try {
        const s = navigator.storage;
        if (s && typeof s.persist === "function") {
          await s.persist();
          setPersisted(await s.persisted());
        }
      } catch (e) { /* API absente ou refusée : persisted reste null */ }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (!storageOk) return; // Q1 : stockage indisponible ou journal trop récent — ne pas écraser
    if (skipSave.current) { skipSave.current = false; return; }
    const t = setTimeout(async () => {
      const r = await saveJournal(STORE, KEY, journal);
      if (r.ok) setSaveStatus("Enregistré");
      else if (r.failed) { setStorageOk(false); setSaveStatus("Non enregistré"); }
      else setSaveStatus("Enregistrement échoué");
    }, 600);
    return () => clearTimeout(t);
  }, [journal, loaded, storageOk]);

  useEffect(() => {
    if (!timer) return;
    const i = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(i);
  }, [timer]);
  const remaining = timer ? Math.max(0, Math.ceil((timer.end - Date.now()) / 1000)) : null;
  useEffect(() => {
    if (timer && remaining === 0) {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      const t = setTimeout(() => setTimer(null), 4000);
      return () => clearTimeout(t);
    }
  }, [timer, remaining]);

  const doneMap = useMemo(() => {
    const m = {};
    prog.SESSIONS.forEach((s) => { const log = findLog(state.logs, dateOf(s.id), s.id); m[s.id] = !!(log && log.done); });
    return m;
  }, [prog, state, week, definition.startDate]);
  const weekDoneCount = useMemo(() => Object.values(doneMap).filter(Boolean).length, [doneMap]);

  /* #41 : l'effet qui devinait la séance à afficher est supprimé. Il n'existait
     que parce qu'on atterrissait sur Séance sans avoir choisi — il essayait le
     jour de la semaine, puis le cardio, puis la première séance non validée.
     Maintenant qu'on ne peut y arriver qu'en tapant une ligne de Semaine, ses
     trois replis n'ont plus de cas. Sa moitié utile — dire quelle séance est
     celle du jour — est devenue la pastille « aujourd'hui » sur la liste. */

  useEffect(() => {
    writeScreen(SCREEN_STORAGE, nav);
  }, [nav]);

  useEffect(() => {
    // #6 : basculer de cycle change START (definition.startDate), donc la
    // semaine "aujourd'hui" ; sans ça, week resterait sur la valeur du
    // cycle précédent.
    setWeek(curWeek);
    /* #41 : et la séance ouverte peut appartenir au cycle qu'on vient de
       quitter. resolveScreen la renvoie sur Semaine plutôt que d'ouvrir
       Séance sur un identifiant que prog.SESSIONS ne connaît pas. */
    setNav((n) => resolveScreen(n, prog.SESSIONS.map((s) => s.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journal.activeProgramId]);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 2500); };

  /* #15 : « jamais exporté » compte comme périmé, mais un journal vide n'a
     rien à perdre — c'est ici, et pas dans export-state.js, que les deux se
     composent : le module ne connaît pas le journal, App.jsx oui. */
  const todayIso = toIsoDate(today);
  const exportStale = useMemo(
    () => journalHasContent(journal) && isExportStale(lastExport, todayIso),
    [journal, lastExport, todayIso],
  );

  const phase = phaseOf(week);
  const session = prog.SESSIONS.find((s) => s.id === sessionId);
  const si = prog.SESSIONS.findIndex((s) => s.id === sessionId);
  const log = findLog(state.logs, dateOf(session.id), session.id) || {};

  const onSet = (vid, i, f, val) => {
    updateActive((st) => {
      const d = dateOf(session.id);
      const cur = findLog(st.logs, d, session.id) || {};
      const ex = { ...(cur.ex || {}) };
      const rows = [...(ex[vid] || [])];
      while (rows.length <= i) rows.push({});
      rows[i] = { ...rows[i], [f]: val };
      ex[vid] = rows;
      return { ...st, logs: writeLog(st.logs, d, session.id, { ex }) };
    });
  };
  const setNotes = (val) => updateActive((st) => ({ ...st, logs: writeLog(st.logs, dateOf(session.id), session.id, { notes: val }) }));

  /* Les séries de la séance telles qu'elles seront enregistrées : les poids
     vides remplis depuis « Prévu », exactement comme validate() le fait. La
     comparaison de #43 doit porter sur ça et non sur ce qui est tapé à l'écran,
     sans quoi une séance validée avec des poids vides passerait pour une baisse
     alors qu'elle porte la charge prévue. */
  const sessionSets = (st) => {
    const d = dateOf(session.id);
    const cur = findLog(st.logs, d, session.id) || {};
    const ex = { ...(cur.ex || {}) };
    const plans = [];
    [...session.ex, ...prog.CORE[session.core].ex].forEach(([slotId]) => {
      const vid = prog.SLOTS[slotId][blockOf(week)];
      const p = planned(prog, st, slotId, week, si, d);
      const rows = (ex[vid] || []).map((r) => (r.r && !r.w && p.load != null ? { ...r, w: String(p.load).replace(".", ",") } : r));
      if (rows.length) ex[vid] = rows;
      plans.push({ slotId, vid, plan: p });
    });
    return { d, cur, ex, plans };
  };

  /* Un descripteur par exercice, pour loadDrops() : la charge de travail des
     séries saisies face à celle de la base que le moteur a lue. */
  const dropsOf = (st) => {
    const { ex, plans } = sessionSets(st);
    return loadDrops(plans.map(({ slotId, vid, plan }) => {
      const v = prog.V[vid];
      const sets = (ex[vid] || []).map((r) => ({ w: num(r.w), r: num(r.r), rir: num(r.rir) })).filter((x) => x.r != null);
      if (!sets.length) return null;
      const [mn, mx] = prog.SLOTS[slotId].reps;
      return { vid, name: v.name, v, load: workingSets(sets, mn, mx).load, baseLoad: plan.baseLoad, incr: v.incr };
    }));
  };

  const validate = (allege = false) => {
    updateActive((st) => {
      const { d, cur, ex } = sessionSets(st);
      /* Sur une mise à jour, le kind stocké est conservé : corriger une note ne
         doit pas effacer un « allégée » répondu la veille (#43, Q1). La question
         se repose en rouvrant la séance, ce que la ligne « Validée le … ·
         Rouvrir » offre juste au-dessus. */
      const kind = cur.done ? (cur.kind ?? computeKind(week)) : (allege ? "allege" : computeKind(week));
      return { ...st, logs: writeLog(st.logs, d, session.id, { ex, done: true, kind }) };
    });
    setPendingLight(null);
    showToast(`${session.name} validée${allege ? " (allégée)" : ""}`);
  };

  /* Aucun contrôle permanent : la question n'existe que quand le cas se
     présente. Trois gardes, une par décision (#43) — jamais sur une séance déjà
     validée, jamais en semaine 1 ni 7 dont le kind pilote déjà le moteur, et
     seulement si un exercice est descendu de plus d'un incrément. */
  const askThenValidate = () => {
    if (log.done || computeKind(week) !== "normal") return validate(false);
    const drops = dropsOf(state);
    return drops.length ? setPendingLight(drops) : validate(false);
  };
  const reopen = () => updateActive((st) => ({ ...st, logs: writeLog(st.logs, dateOf(session.id), session.id, { done: false }) }));

  const setCardio = (id, f, val) => updateActive((st) => { const k = weekKey(week); const c = st.cardio[k] || {}; return { ...st, cardio: { ...st.cardio, [k]: { ...c, [id]: { ...(c[id] || {}), [f]: val } } } }; });
  const toggleMob = (i) => updateActive((st) => { const k = weekKey(week); const c = st.cardio[k] || {}; const m = [...(c.mob || Array(prog.MOB_DAYS.length).fill(false))]; m[i] = !m[i]; return { ...st, cardio: { ...st.cardio, [k]: { ...c, mob: m } } }; });
  const setCheck = (f, val) => updateActive((st) => { const k = weekKey(week); return { ...st, checkin: { ...st.checkin, [k]: { ...(st.checkin[k] || {}), [f]: val } } }; });

  /* #41 : le bilan sort en fichier, comme le journal — un seul geste à
     connaître pour les deux. Ça retire aussi le presse-papier du chemin, qui
     n'existe pas hors contexte sécurisé : en testant via l'IP du réseau
     local, « Copier » n'a jamais rien copié, il tombait silencieusement sur
     son repli. Même règle de synchronicité que l'export du journal : rien
     n'est attendu avant saveFile(). */
  const downloadBilan = () => {
    const name = `bilan-S${week}-${toIsoDate(new Date())}.txt`;
    saveFile(FILE_ENV, { name, content: bilanText(), type: "text/plain" }).then((res) => {
      if (!res.ok) setBilanStatus(res.reason === "cancelled" ? "" : "Impossible d'écrire un fichier sur cet appareil.");
      else setBilanStatus(name);
    });
  };

  /* #15 : saveFile() doit être atteint de façon synchrone depuis le clic —
     Safari abandonne navigator.share si l'appel passe derrière un await.
     Rien n'est attendu avant l'appel ; la suite se traite dans le .then(). */
  const exportJournal = () => {
    const name = `prog12-journal-${toIsoDate(new Date())}.json`;
    saveFile(FILE_ENV, { name, content: JSON.stringify(withVersion(journal)), type: "application/json" }).then(async (res) => {
      if (!res.ok) {
        // Une annulation est un choix, pas une panne : rien à signaler.
        setExportStatus(res.reason === "cancelled" ? "" : "Impossible d'écrire un fichier sur cet appareil.");
        return;
      }
      /* decisions-spec.md Q2 : « via: download » compte comme un succès, une
         ancre ne rapportant rien. C'est l'affichage de la date enregistrée,
         juste à côté, qui garde une valeur optimiste vérifiable à l'œil. */
      const iso = toIsoDate(new Date());
      await writeLastExport(STORE, KEY, iso);
      setLastExport(iso);
      setExportStatus(name);
    });
  };

  /* #15 : une sauvegarde se télécharge comme le journal, mais ne met jamais
     à jour lastExport — le fichier produit est un état ancien, pas une copie
     du journal courant. L'annoncer comme un export mentirait au rappel. */
  const downloadBackup = (name, value) => {
    saveFile(FILE_ENV, { name, content: value, type: "application/json" }).then((res) => {
      if (!res.ok) setExportStatus(res.reason === "cancelled" ? "" : "Impossible d'écrire un fichier sur cet appareil.");
      else setExportStatus(name);
    });
  };

  const bilanText = () => {
    const c = state.checkin[weekKey(week)] || {};
    const ca = state.cardio[weekKey(week)] || {};
    const done = prog.SESSIONS.filter((s) => doneMap[s.id]);
    const missing = prog.SESSIONS.filter((s) => !doneMap[s.id]).map((s) => s.name);
    const cardioLines = (prog.CARDIO_ITEMS || []).filter((it) => ca[it.id] && ca[it.id].done).map((it) => { const d = ca[it.id]; return `${it.label} ${d.min || "?"} min${d.w ? `, ${d.w} W` : ""}${d.hr ? `, ${d.hr} bpm` : ""}`; });
    const mob = (ca.mob || []).filter(Boolean).length;
    const keys = getKeySlots(prog);
    const keyLines = keys.map((slotId) => {
      const vid = prog.SLOTS[slotId][blockOf(week)];
      const sessionsW = prog.SESSIONS.map((s) => findLog(state.logs, dateOf(s.id), s.id)).filter((l) => l && l.done && l.ex && l.ex[vid]);
      if (!sessionsW.length) return null;
      const sets = sessionsW.flatMap((l) => l.ex[vid]).map((x) => ({ w: num(x.w), r: num(x.r), rir: num(x.rir) })).filter((x) => x.r != null);
      if (!sets.length) return null;
      return `${prog.V[vid].name} : ${setSummary(sets, prog.V[vid])}`;
    }).filter(Boolean);
    /* #13 : cardio et mobilité sont deux affordances indépendantes — un
       bundle peut n'avoir ni l'une ni l'autre, ou une seule des deux ; la
       ligne (et sa présence dans la liste numérotée) suit. */
    const cardioPart = hasCardioItems(prog) ? `Cardio : ${cardioLines.length ? cardioLines.join(" ; ") : "aucun"}` : null;
    const mobPart = hasMobilityDays(prog) ? `mobilité ${mob}/${prog.MOB_DAYS.length}` : null;
    const cardioLine = [cardioPart, mobPart].filter(Boolean).join(" — ") || null;
    /* #41 : les notes écrites pendant chaque séance remontent dans le bilan.
       Elles sont lues ici à la génération, jamais recopiées dans checkin :
       une synthèse stockée périmerait dès qu'on rouvre une séance pour
       corriger une note, et checkin n'a pas d'updatedAt pour arbitrer. */
    const notes = prog.SESSIONS
      .map((s) => ({ session: s.name, text: ((findLog(state.logs, dateOf(s.id), s.id) || {}).notes || "").trim() }))
      .filter((n) => n.text !== "");
    /* Tout ce qui précède dérive de prog et de state : ça reste ici, c'est ce
       qu'App.jsx sait faire. buildBilan n'assemble que le texte, et n'importe
       donc rien (#41, design.md décision 2). */
    return buildBilan({
      week,
      range: weekRange(START, week),
      phaseLabel: phase.label,
      checkin: c,
      doneCount: done.length,
      sessionCount: prog.SESSIONS.length,
      missing,
      cardioLine,
      keyLines,
      notes,
    });
  };

  /* Un rejet reste affiché dans le panneau ; le toast garde son rôle de
     confirmation, donc il ne double pas le message d'erreur. */
  const importData = async (parsed) => {
    const res = parsed;
    setImportError("");
    /* #11 : le journal actuel part en copie avant d'être remplacé, à partir
       des octets du stockage et non d'une re-sérialisation. Écrite une seule
       fois : un second import ne doit pas écraser l'état d'avant le premier
       par un journal qu'on est en train de regretter. Un stockage muet n'est
       pas un motif d'arrêt — l'import reste la porte de sortie d'un stockage
       bloqué (#12 ci-dessous). */
    if (STORE) {
      try {
        const raw = (await STORE.get(KEY, false)).value;
        if (raw) await backupPreImportOnce(STORE, KEY, raw);
      } catch (e) { /* pas de journal stocké : rien à sauvegarder */ }
      setPreImportBackup(await readPreImportBackup(STORE, KEY));
    }
    /* #12 : un import réussi est la seule porte de sortie d'un stockage
       bloqué (journal trop récent, schemaVersion invalide, backup #8
       impossible). Sans lever storageOk ici, l'autosave reste coupé et
       l'import n'est jamais persisté. skipSave doit aussi retomber :
       quand le blocage vient du chargement, l'effet de save sort sur
       !storageOk avant d'avoir consommé skipSave, qui est donc resté à
       true. STORE absent => on laisse l'effet de save constater l'échec. */
    skipSave.current = false;
    if (STORE) setStorageOk(true);
    setLoadError("");
    setJournal({ activeProgramId: res.data.activeProgramId, programs: res.data.programs });
    /* decisions-spec.md Q4 : à cet instant le journal est identique à un
       fichier posé sur le disque — exactement l'état que le rappel cherche à
       garantir. L'import remet donc le compteur à zéro comme un export. */
    const iso = toIsoDate(new Date());
    if (await writeLastExport(STORE, KEY, iso)) setLastExport(iso);
    showToast(res.migrated ? "Journal mis à jour vers le nouveau format." : "Données importées");
  };

  /* #15 : l'import passe par un fichier, en deux temps assumés. On lit et on
     valide au choix du fichier ; on n'écrit qu'à la confirmation. Le
     sélecteur rend le geste bien plus facile à déclencher que l'ancienne
     zone de collage, et remplacer le journal en place est irréversible. */
  const handleJournalFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = ""; // permet de rechoisir le même fichier
    if (!file) return;
    setImportError("");
    setPendingImport(null);
    const read = await readFile(file);
    if (!read.ok) { setImportError("Ce fichier n'a pas pu être lu."); return; }
    /* Même précaution que handleProgramFile (#33) : une exception levée ici
       partirait dans un gestionnaire d'événement et laisserait le panneau
       muet — l'utilisateur a choisi un fichier et il ne se passe rien. */
    let res;
    try {
      res = parseJournalImport(read.text, MIGRATION_CTX);
    } catch (err) {
      setImportError("Ce fichier n'a pas pu être lu.");
      return;
    }
    if (!res.ok) { setImportError(res.message); return; }
    setPendingImport({ name: file.name, res });
  };

  /* #6 : un id déjà présent reprend son cycle (logs/cardio/checkin intacts,
     definition rafraîchie) — jamais de journal écrasé par un rechargement. */
  const loadProgram = (definition) => {
    const existing = journal.programs[definition.id];
    setJournal((j) => ({
      ...j,
      activeProgramId: definition.id,
      programs: {
        ...j.programs,
        [definition.id]: existing ? { ...j.programs[definition.id], definition } : { definition, logs: {}, cardio: {}, checkin: {} },
      },
    }));
    showToast(existing ? "Cycle repris." : "Programme chargé.");
  };

  const handleProgramFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = ""; // permet de recharger le même fichier une deuxième fois
    if (!file) return;
    const read = await readFile(file);
    if (!read.ok) { setProgramError("Ce fichier n'a pas pu être lu."); return; }
    /* Le try/catch n'est pas décoratif (#33) : une exception levée ici part
       dans un gestionnaire d'événement, donc setProgramError ne s'exécute
       jamais et le panneau reste muet — l'utilisateur a chargé un fichier et
       il ne se passe rien, sans un mot. Le validateur ne lève plus, mais une
       lacune future doit dégrader en message, pas en silence. */
    let res;
    try {
      res = parseProgramImport(read.text);
    } catch (e) {
      setProgramError("Ce fichier n'a pas pu être lu.");
      return;
    }
    if (!res.ok) { setProgramError(res.message); return; }
    setProgramError("");
    loadProgram(res.definition);
  };

  /* #41 : « Aujourd'hui, jeudi : Upper B » est devenu la pastille sur la liste
     des séances — dire le jour à côté de la ligne concernée vaut mieux qu'une
     phrase au-dessus. Restent les deux cas que la pastille ne sait pas porter,
     parce qu'ils parlent du cycle et non du jour : avant le départ, et après
     les douze semaines. */
  const cycleNote =
    dayIdx < 0 ? `Le programme commence lundi ${dateLabel(START)}.`
    : dayIdx >= definition.weeks * 7 ? `Les ${definition.weeks} semaines sont terminées : bilan et programme suivant.`
    : null;

  const backSession = nav.sessionId ? prog.SESSIONS.find((s) => s.id === nav.sessionId) : null;
  const backLabel = backSession ? `Séance ${backSession.name}` : "Semaine";

  const cardio = prog.cardioPlan ? prog.cardioPlan(week) : null;
  const ca = state.cardio[weekKey(week)] || {};
  const ci = state.checkin[weekKey(week)] || {};
  const bilanFilled = BILAN_KEYS.filter((k) => (ci[k] || "") !== "").length;

  if (!loaded) return <div className="min-h-screen bg-slate-900 text-slate-400 flex items-center justify-center">Chargement du journal…</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100" style={{ fontVariantNumeric: "tabular-nums" }}>
      <div className="max-w-md mx-auto pb-24">
        {/* #41 : un en-tête par écran, plus un en-tête pour tout le monde.
            C'est la bascule dont tout le reste découle — les flèches de semaine
            n'avaient de sens au-dessus de Séance que parce qu'on pouvait y
            arriver sans avoir choisi. */}
        {screen !== "seance" && screen !== "exercice" && (
          <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700 px-4 pt-3 pb-2">
            <div className="flex items-center justify-between">
              <button onClick={() => setWeek(Math.max(1, week - 1))} aria-label="Semaine précédente" className="h-11 w-11 rounded-md bg-slate-800 border border-slate-700 inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-amber-400"><ChevronLeft size={18} /></button>
              <div className="text-center">
                <div className="text-lg font-semibold">Semaine {week} <span className="text-slate-400 font-normal">sur {definition.weeks}</span></div>
                <div className="text-xs text-slate-400">{weekRange(START, week)} — {phase.label}, RIR {phase.rir}</div>
              </div>
              <button onClick={() => setWeek(Math.min(definition.weeks, week + 1))} aria-label="Semaine suivante" className="h-11 w-11 rounded-md bg-slate-800 border border-slate-700 inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-amber-400"><ChevronRight size={18} /></button>
            </div>
          </div>
        )}

        {screen === "seance" && (
          <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700 px-4 pt-3 pb-2">
            {/* Ce que l'en-tête partagé et le rail disaient à eux deux, en deux
                lignes : quelle séance, quelle semaine, quel jour. */}
            <div className="text-xl font-semibold leading-tight">{session.name}</div>
            <div className="text-sm text-slate-400 mt-0.5">Semaine {week} · {DAYNAMES[session.day]} {dateLabel(parseLocalDate(dateOf(session.id)))} · {session.sub}</div>
            {timer && (
              <div className={`mt-2 flex items-center justify-between rounded-md px-3 h-11 ${remaining === 0 ? "bg-amber-400 text-slate-900" : "bg-slate-800 border border-slate-700"}`}>
                <span className="text-sm truncate">{remaining === 0 ? "Repos terminé, à toi" : `Repos — ${timer.label}`}</span>
                <span className="text-xl font-semibold">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</span>
                <button onClick={() => setTimer(null)} aria-label="Arrêter le repos" className="ml-2 focus:outline-none"><X size={18} /></button>
              </div>
            )}
          </div>
        )}

        {loadError && <p role="alert" className="mx-4 mt-3 text-sm text-amber-400">{loadError}</p>}

        {/* #15 : rendu ici, hors de tout onglet, pour la même raison que
            loadError — un rappel qu'on ne voit qu'en allant dans le panneau
            d'export ne sert à rien, puisque quelqu'un qui n'a pas exporté
            depuis un mois n'y va pas. Masquable pour la session : le voir
            revenir au lancement suivant est le comportement correct. */}
        {!loadError && exportStale && !exportWarnDismissed && (
          <div className="mx-4 mt-3 flex items-start justify-between gap-3 rounded-md border border-slate-700 bg-slate-800 p-3">
            <p className="text-sm text-amber-400">
              {lastExport
                ? `Dernier export il y a ${daysBetween(lastExport, todayIso)} jours. Télécharge une copie du journal : onglet Plan, section Données.`
                : "Aucune copie de ce journal n'a jamais quitté cet appareil. Télécharge-la : onglet Plan, section Données."}
            </p>
            <button onClick={() => setExportWarnDismissed(true)} aria-label="Masquer ce rappel" className="shrink-0 h-11 w-11 -my-1 -mr-1 inline-flex items-center justify-center text-slate-400 rounded focus:outline-none focus:ring-2 focus:ring-amber-400">
              <X size={18} />
            </button>
          </div>
        )}

        {screen === "seance" && (
          <div className="px-4">
            {!storageOk && !loadError && <p className="text-sm text-amber-400 mt-3">Stockage indisponible ici : les saisies ne survivront pas à la fermeture. Télécharge le journal (onglet Plan) en fin de séance.</p>}

            {/* #41 : le rail de chips est parti. Il faisait doublon avec la
                liste de Semaine — qui dit la même chose avec plus
                d'information — et n'existait que parce qu'on pouvait atterrir
                ici sans avoir choisi. La ligne « Aujourd'hui, … » et le titre
                dupliqué partent avec lui : l'en-tête les dit déjà. */}
            <div>
              <div>
                <div className="pt-3 pb-2">
                  <div className="text-sm text-slate-400">{setsFor(session.ex.reduce((a, [, n]) => a + n, 0), week)} séries dures + abdos. {PHASE_NOTES[phase.id]}</div>
                  {log.done && <div className="mt-2 text-sm text-emerald-400 inline-flex items-center gap-1"><Check size={15} />Validée le {log.updatedAt && log.updatedAt.slice(0, 10)}. <button onClick={reopen} className="underline text-slate-300 ml-1 focus:outline-none">Rouvrir</button></div>}
                </div>
                <Section title="Échauffement">{prog.WARM[session.warm]}</Section>
                {session.ex.map(([slotId, n], i) => (
                  <ExerciseCard key={slotId + week} idx={i + 1} slotId={slotId} nSets={n} week={week} weeks={definition.weeks} si={si} date={dateOf(session.id)} prog={prog} state={state}
                    rows={(log.ex && log.ex[prog.SLOTS[slotId][blockOf(week)]]) || []} onSet={onSet} onOpen={openExercise} onTimer={(sec, label) => setTimer({ end: Date.now() + sec * 1000, label })} />
                ))}
                <div className="pt-4 text-sm text-slate-400">{prog.CORE[session.core].label}</div>
                {prog.CORE[session.core].ex.map(([slotId, n], i) => (
                  <ExerciseCard key={slotId + week} idx={session.ex.length + i + 1} slotId={slotId} nSets={n} week={week} weeks={definition.weeks} si={si} date={dateOf(session.id)} prog={prog} state={state}
                    rows={(log.ex && log.ex[prog.SLOTS[slotId][blockOf(week)]]) || []} onSet={onSet} onOpen={openExercise} onTimer={(sec, label) => setTimer({ end: Date.now() + sec * 1000, label })} />
                ))}
                {session.after && cardio && (
                  <p className="text-sm text-slate-400 mt-3">
                    Après la séance : {AFTER_HINTS[session.after](cardio)}
                  </p>
                )}
                <label className="block mt-4">
                  <span className="text-xs text-slate-400">Notes de séance (douleur 0–10, forme, remarques)</span>
                  <textarea value={log.notes || ""} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Remontées dans le bilan de la semaine." className="mt-1 w-full p-3 rounded-md bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </label>
                {/* #43 : le panneau remplace le bouton — une seule décision, un
                    seul moment. Les deux boutons valident, ils ne diffèrent que
                    par ce qu'ils font à la référence, donc chacun dit son effet
                    au lieu d'un OK/Annuler à décoder. Aucun des deux n'est en
                    ambre : un choix sans bonne réponse ne doit pas porter de
                    défaut qui attire le pouce. Même motif que la confirmation
                    d'import, plus bas. */}
                {pendingLight ? (
                  <div className="mt-4 rounded-md border border-slate-700 bg-slate-800 p-3 space-y-2">
                    <p className="text-sm text-slate-100 font-medium">Séance plus légère que la précédente</p>
                    {pendingLight.map((d) => (
                      <p key={d.vid} className="text-sm text-slate-400">
                        {d.name} : <span className="text-slate-100">{loadText(d.v, d.load)}</span> au lieu de <span className="text-slate-100">{loadText(d.v, d.baseLoad)}</span>.
                      </p>
                    ))}
                    <p className="text-sm text-slate-400">
                      {pendingLight.length === 1
                        ? <>Si c'était volontaire, ta charge de référence ne bouge pas : la prochaine séance repartira de <span className="text-slate-100">{loadText(pendingLight[0].v, pendingLight[0].baseLoad)}</span>.</>
                        : "Si c'était volontaire, tes charges de référence ne bougent pas : la prochaine séance repartira d'où tu en étais."}
                    </p>
                    <div className="flex flex-col gap-2 pt-0.5">
                      <Btn onClick={() => validate(true)}><Check size={18} />Valider, séance allégée</Btn>
                      <Btn onClick={() => validate(false)}><Check size={18} />Valider, c'est ma nouvelle référence</Btn>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-3">
                    <Btn primary onClick={askThenValidate}><Check size={18} />{log.done ? "Mettre à jour la séance" : "Valider la séance"}</Btn>
                    <span className="text-xs text-slate-500">{saveStatus}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* #17 : la fiche ne reçoit ni prog, ni week, ni session — voir
            l’en-tête de ExerciseSheet.jsx. */}
        {screen === "exercice" && (
          <ExerciseSheet journal={journal} exerciseId={nav.exerciseId} backLabel={backLabel} onBack={closeExercise} />
        )}

        {screen === "semaine" && (
          <div className="px-4">
            {cycleNote && <p className="text-sm text-amber-400 mt-3">{cycleNote}</p>}
            <p className="text-sm text-slate-300 mt-3">{PHASE_NOTES[phase.id]}</p>
            {/* #41 : le compte remplace le badge que portait la barre du bas.
                Il monte ici parce que Semaine devient l'écran d'accueil : ce
                qu'on vient y chercher, c'est où on en est. */}
            <div className="mt-5 flex items-baseline justify-between gap-3">
              <span className="text-sm text-slate-400">Séances de la semaine</span>
              <span className={`text-sm ${weekDoneCount === prog.SESSIONS.length ? "text-emerald-400" : "text-slate-400"}`}>{weekDoneCount} sur {prog.SESSIONS.length} validées</span>
            </div>
            <div className="mt-2 divide-y divide-slate-700 border-y border-slate-700">
              {prog.SESSIONS.map((s) => {
                const l = findLog(state.logs, dateOf(s.id), s.id);
                const keySlot = s.ex[0][0];
                const vid = prog.SLOTS[keySlot][blockOf(week)];
                const sets = l && l.ex && l.ex[vid] ? l.ex[vid].map((x) => ({ w: num(x.w), r: num(x.r), rir: num(x.rir) })).filter((x) => x.r != null) : [];
                /* #41 : ce repère fait le travail de l'effet d'auto-sélection
                   qu'on supprime — dire quelle séance est celle du jour — sans
                   choisir à la place de l'utilisateur. Seulement sur la semaine
                   en cours : « aujourd'hui » n'a pas de sens en S7 quand on
                   feuillette une semaine passée. */
                const isToday = week === curWeek && s.day === weekday;
                return (
                  <button key={s.id} onClick={() => openSession(s.id)} className="w-full py-3 flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-amber-400 rounded">
                    <div>
                      <div className="font-medium inline-flex items-center gap-2 flex-wrap">
                        {l && l.done ? <Check size={16} className="text-emerald-400" /> : <span className="w-4 h-4 rounded-full border border-slate-600 inline-block" />}{s.name} <span className="text-slate-400 font-normal text-sm">{DAYNAMES[s.day]}</span>
                        {isToday && <span className="rounded-full px-2 py-0.5 text-xs bg-amber-400 text-slate-900 font-medium">aujourd'hui</span>}
                      </div>
                      <div className="text-sm text-slate-400 pl-6">{prog.V[vid].name} : {sets.length ? setSummary(sets, prog.V[vid]) : "—"}</div>
                    </div>
                    <ChevronRight size={16} className="text-slate-500" />
                  </button>
                );
              })}
            </div>
            {/* #41 : le cardio était déjà modifiable ici — `compact` ne cachait
                qu'un titre. Il gagne le sien, aligné sur celui des séances,
                maintenant qu'il est une section du hub et non plus une chip
                perdue dans le rail de Séance. */}
            {hasCardioContent(prog) && (
              <div className="mt-5">
                <div className="text-sm text-slate-400">Cardio et mobilité</div>
                <div className="mt-2">
                  <CardioView prog={prog} week={week} cardio={cardio} ca={ca} setCardio={setCardio} toggleMob={toggleMob} compact />
                </div>
              </div>
            )}

            {/* #41 : le bilan est une chose de la semaine, il vit donc dans la
                semaine — replié, avec son état lisible sans déplier. Réutilise
                le <Section> de l'onglet Plan plutôt que d'inventer un second
                accordéon. */}
            <div className="mt-5 border-t border-slate-700">
              <Section title={<>Bilan de la semaine <span className={bilanFilled === 0 ? "font-normal text-amber-400" : bilanFilled === BILAN_FIELDS ? "font-normal text-emerald-400" : "font-normal text-slate-400"}>· {bilanFilled === 0 ? "à remplir" : bilanFilled === BILAN_FIELDS ? "complet" : `${bilanFilled} sur ${BILAN_FIELDS}`}</span></>}>
                <p>À remplir le dimanche, puis à envoyer dans le chat. Séances, exos clés et notes de séance sont repris automatiquement. Indispensable à saisir : poids et RIR. Le reste est optionnel.</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Poids moyen 7 pesées (kg)" value={ci.poids} onChange={(v) => setCheck("poids", v)} type="number" />
                  <Field label="Tour de taille au nombril (cm)" value={ci.taille} onChange={(v) => setCheck("taille", v)} type="number" />
                  <Field label="Sommeil moyen (h)" value={ci.sommeil} onChange={(v) => setCheck("sommeil", v)} type="number" />
                  <Field label="Énergie (1–5)" value={ci.energie} onChange={(v) => setCheck("energie", v)} type="number" />
                  <Field label="RIR ressenti global" value={ci.rir} onChange={(v) => setCheck("rir", v)} placeholder="ex. 1, ou dérive vers 2–3" wide />
                  {/* #41 : plus de champ « Douleurs » à ressaisir le dimanche. La
                      douleur est déjà écrite dans les notes de chaque séance, au
                      moment où elle est ressentie, et ces notes remontent
                      maintenant dans le texte du bilan. Rien n'est supprimé du
                      stockage : checkin.wN.douleurs reste dans les journaux
                      existants et dans l'export, simplement plus affiché. */}
                  <Field label="Écarts nutrition" value={ci.nutrition} onChange={(v) => setCheck("nutrition", v)} placeholder="RAS" wide />
                  <Field label="Remarques" value={ci.remarques} onChange={(v) => setCheck("remarques", v)} wide />
                </div>
                {/* #41 : un bouton, pas de pavé de texte. L'aperçu ne servait
                    plus de repli depuis que le presse-papier a quitté ce
                    chemin, et un bilan qui fait maintenant neuf lignes ne se
                    relit pas dans une section repliée — on l'ouvre dans le
                    chat, là où on l'envoie. */}
                <div className="flex items-center gap-3">
                  <Btn primary onClick={downloadBilan}><Download size={16} />Télécharger le bilan</Btn>
                  <span className="text-xs text-slate-500">{bilanStatus}</span>
                </div>
              </Section>
            </div>
          </div>
        )}

        {screen === "plan" && (
          <div className="px-4">
            <p className="text-sm text-slate-300 mt-3">{PLAN_INTRO}</p>
            <PlanContent plan={plan} />
            <Section title="Programme">
              <p>{definition.name} — départ {dateLabel(START)}</p>
              <div className="flex gap-2 flex-wrap">
                <Btn small onClick={() => fileInputRef.current.click()}>Charger un programme</Btn>
              </div>
              <input ref={fileInputRef} type="file" accept="application/json" onChange={handleProgramFile} className="hidden" />
              {programError && <p role="alert" className="text-sm text-amber-400">{programError}</p>}
              {Object.keys(journal.programs).length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(journal.programs).map(([id, p]) => (
                    <Btn key={id} small primary={id === journal.activeProgramId} disabled={unusable.has(id)}
                      onClick={() => setJournal((j) => ({ ...j, activeProgramId: id }))}>
                      {(p.definition && p.definition.name) || id}
                    </Btn>
                  ))}
                </div>
              )}
              {unusable.size > 0 && (
                <p className="text-xs text-slate-400">
                  {unusable.size === 1 ? "Un cycle enregistré n'est pas exécutable" : `${unusable.size} cycles enregistrés ne sont pas exécutables`} par cette version : ils restent dans le journal et dans l'export, mais ne peuvent pas être activés.
                </p>
              )}
            </Section>
            <Section title="Données : sauvegarde et restauration">
              <p>{storageOk ? "Le journal est enregistré automatiquement sur cet appareil." : "Stockage automatique indisponible ici."} Avant une mise à jour du fichier, télécharge le journal et garde le fichier : il se réimporte ci-dessous.</p>
              <div className="flex gap-2 flex-wrap">
                <Btn small onClick={exportJournal}><Download size={14} />Télécharger le journal</Btn>
                <Btn small onClick={() => journalInputRef.current.click()}><Upload size={14} />Importer un fichier</Btn>
              </div>
              <input ref={journalInputRef} type="file" accept="application/json" onChange={handleJournalFile} className="hidden" />
              {/* #15 : la date est affichée, pas seulement enregistrée. Sur le
                  chemin « ancre », l'app ne peut pas savoir si le fichier a
                  atterri (decisions-spec.md Q2) — la montrer est ce qui rend
                  une valeur optimiste vérifiable. */}
              <p className="text-xs text-slate-400">{lastExport ? `Dernier export : ${dateLabel(parseLocalDate(lastExport))}.` : "Aucun export enregistré sur cet appareil."}</p>
              {/* #15 : dire ce que le navigateur a répondu, en clair. Un
                  stockage « éligible à l'éviction » est la raison d'être de
                  tout ce panneau — la nommer vaut mieux que la sous-entendre. */}
              <p className="text-xs text-slate-400">
                {persisted === true
                  ? "Le navigateur a marqué ce stockage comme persistant : il ne sera pas vidé pour faire de la place."
                  : persisted === false
                    ? "Le navigateur n'a pas accordé de stockage persistant : il peut vider ces données pour faire de la place. Le fichier reste la vraie sauvegarde."
                    : "Ce navigateur ne dit pas si le stockage est persistant."}
              </p>
              {exportStatus && <p className="text-xs text-slate-300">{exportStatus}</p>}
              {importError && <p role="alert" className="text-sm text-amber-400">{importError}</p>}
              {pendingImport && (
                <div className="rounded-md border border-slate-700 bg-slate-800 p-3 space-y-2">
                  <p className="text-sm text-slate-100">{pendingImport.name}</p>
                  <p className="text-sm text-slate-400">Remplacera le journal de cet appareil. Une copie de l'actuel est enregistrée avant, et reste téléchargeable ci-dessous.</p>
                  <div className="flex gap-2 flex-wrap">
                    <Btn small primary onClick={() => { const p = pendingImport; setPendingImport(null); importData(p.res); }}>Remplacer le journal</Btn>
                    <Btn small onClick={() => setPendingImport(null)}>Annuler</Btn>
                  </div>
                </div>
              )}
              {(backups.length > 0 || droppedBackup || preImportBackup) && (
                <div className="flex gap-2 flex-wrap">
                  {backups.map((b) => (
                    <Btn key={b.from} small onClick={() => downloadBackup(`prog12-journal-v${b.from}-avant-migration.json`, b.value)}><Download size={14} />Sauvegarde d'avant-migration (v{b.from})</Btn>
                  ))}
                  {/* #32 : le journal tel qu'il était avant que des séances
                      illisibles n'en soient écartées. Comme les autres
                      sauvegardes, elle n'est jamais restaurée toute seule :
                      on la sort du téléphone, on la relit, on décide. */}
                  {droppedBackup && <Btn small onClick={() => downloadBackup("prog12-journal-avant-lignes-ecartees.json", droppedBackup)}><Download size={14} />Journal d'avant les séances écartées</Btn>}
                  {preImportBackup && <Btn small onClick={() => downloadBackup("prog12-journal-avant-import.json", preImportBackup)}><Download size={14} />Journal d'avant le premier import</Btn>}
                </div>
              )}
            </Section>
          </div>
        )}

        {toast && <div className="fixed left-1/2 -translate-x-1/2 bottom-20 bg-amber-400 text-slate-900 px-4 py-2 rounded-md text-sm font-medium shadow-none">{toast}</div>}

        {/* Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700">
          {/* #41 : le badge de progression est parti avec cet onglet — il vit
              maintenant en tête de la liste des séances, sur l'écran où l'on
              atterrit et où l'on venait le lire. */}
          {/* #41 : deux entrées. Séance n'en est plus une — on l'ouvre depuis
              Semaine, et « Semaine » reste en ambre pendant qu'elle est
              ouverte : c'est à la fois où l'on est dans la hiérarchie et où
              l'on retourne. C'est ce qui permet à Séance de n'avoir aucune
              flèche de retour. */}
          <div className="max-w-md mx-auto grid grid-cols-2">
            <button onClick={goSemaine} className={`h-14 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${screen !== "plan" ? "text-amber-400 font-medium" : "text-slate-400"}`}>Semaine</button>
            <button onClick={goPlan} className={`h-14 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${screen === "plan" ? "text-amber-400 font-medium" : "text-slate-400"}`}>Plan</button>
          </div>
        </nav>
      </div>
    </div>
  );
}

/* ---------- Onglet Plan : rendu des blocs de src/plan.js ---------- */
function Block({ block }) {
  if (block.t === "p") return <p>{block.text}</p>;
  if (block.t === "table" && block.variant === "weeks")
    return (
      <table className="w-full text-sm">
        <tbody>
          {block.rows.map(([a, b]) => (
            <tr key={a} className="border-t border-slate-700"><td className="py-1.5 pr-3 text-slate-400 whitespace-nowrap align-top">{a}</td><td className="py-1.5">{b}</td></tr>
          ))}
        </tbody>
      </table>
    );
  if (block.t === "table" && block.variant === "volume")
    return (
      <table className="w-full text-sm">
        <tbody>
          {block.rows.map(([g, n, o]) => (
            <tr key={g} className="border-t border-slate-700"><td className="py-1.5 pr-2">{g}</td><td className="py-1.5 pr-2 text-amber-400 text-right">{n}</td><td className="py-1.5 text-slate-400">{o}</td></tr>
          ))}
        </tbody>
      </table>
    );
  return null;
}
function PlanContent({ plan }) {
  return plan.map((s) => (
    <Section key={s.id} title={s.title} open={s.open}>
      {s.blocks.map((b, i) => <Block key={i} block={b} />)}
    </Section>
  ));
}

function CardioView({ prog, week, cardio, ca, setCardio, toggleMob, compact }) {
  return (
    <div>
      {!compact && <div className="text-xl font-semibold pb-1">Cardio et mobilité, semaine {week}</div>}
      <div className="divide-y divide-slate-700 border-y border-slate-700">
        {hasCardioItems(prog) && prog.CARDIO_ITEMS.map((it) => {
          const plan = it.id === "int" ? cardio.intervals : cardio.z2;
          const d = ca[it.id] || {};
          if (it.id === "int" && !plan) return (
            <div key={it.id} className="py-3 text-sm text-slate-400">Pas d'intervalles cette semaine (calibration, décharge ou bilan) : Z2 uniquement.</div>
          );
          return (
            <div key={it.id} className="py-3">
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={!!d.done} onChange={(e) => setCardio(it.id, "done", e.target.checked)} className="mt-1 h-5 w-5 accent-amber-400" />
                <div>
                  <div className="font-medium">{it.label} <span className="text-slate-400 font-normal text-sm">{it.when}</span></div>
                  <div className="text-sm text-slate-400">{plan}</div>
                </div>
              </label>
              <div className="grid grid-cols-3 gap-2 mt-2 pl-8">
                {[["min", "min"], ["w", "W moyen"], ["hr", "bpm moyen"]].map(([f, l]) => (
                  <input key={f} inputMode="decimal" aria-label={`${it.label} ${l}`} placeholder={l} value={d[f] || ""} onChange={(e) => setCardio(it.id, f, e.target.value)} className="h-10 w-full text-center rounded-md bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                ))}
              </div>
            </div>
          );
        })}
        {hasMobilityDays(prog) && (
          <div className="py-3">
            <div className="font-medium">Mobilité, 3 fois par semaine</div>
            <div className="text-sm text-slate-400">{cardio.mob}</div>
            <div className="flex gap-4 mt-2">
              {prog.MOB_DAYS.map((d, i) => (
                <label key={d} className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={!!(ca.mob && ca.mob[i])} onChange={() => toggleMob(i)} className="h-5 w-5 accent-amber-400" />{d}</label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
