import { useState, useEffect, useMemo, useRef } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Timer, Download, Upload, Zap, X, Repeat, Plus, Trash2, Copy, Sparkles, PenLine } from "lucide-react";
import { SCHEMA_VERSION, emptyJournal, weekStartKey, dateForSlot, slotForDate, findLog, writeLog, withVersion } from "./schema.js";
import { parseJournalImport, parseProgramImport, IMPORT_MESSAGES } from "./import.js";
import { listBackups, readDroppedBackup, backupPreImportOnce, readPreImportBackup } from "./backup.js";
import { createStore, loadJournal, saveJournal } from "./storage.js";
import { saveFile, readFile } from "./file-io.js";
import { readScreen, writeScreen, resolveScreen } from "./screen-state.js";
import { readRest, writeRest, acquireWakeLock, releaseWakeLock, makeChime } from "./rest-timer.js";
import { readLastExport, writeLastExport, toIsoDate, isExportStale, journalHasContent, daysBetween } from "./export-state.js";
import { unusableProgramIds, validateDefinition } from "./journal-shape.js";
/* #57 : journal-shape juge la donnée et peut refuser un fichier ; assertions
   juge l'entraînement et ne fait que conseiller (ARCHITECTURE §2, §2.9). */
import { assess, targetsFor } from "./assertions.js";
import { buildProgram, getKeySlots, hasCardioContent, hasCardioItems, hasMobilityDays } from "./program.js";
import { AFTER_HINTS } from "./cardio.js";
import { isDeloadWeek, withForcedDeloads, evaluateDeload } from "./policies.js";
import { num, fmt, phaseOf, setsFor, lastEntry, lastEntryLabel, historyBefore, history, planned, computeKind, workingSets, loadDrops, loadText, normalizeSets } from "./progression.js";
import { setSummary, dayName, weekdayName, adviceSummary, unitColumns, cardioWhen, mobilityDayNames, rowIsDone, completedSets } from "./display.js";
import { traitsOf } from "./units.js";
import { EXERCISE_IDS } from "./registry.js";
/* #55 : la seule réponse à « quel exercice ce créneau porte-t-il ? ». Elle
   était écrite six fois, chacune ne regardant que le programme. */
import { prescribedVid, vidFor, isSubstituted, withSub, takenVids, slotIdsOf } from "./session-sub.js";
/* #19 : le premier lancement est un verdict de chargement, pas un état stocké. */
import { isFirstLaunch, startingNow } from "./onboarding.js";
import Welcome from "./Welcome.jsx";
import ExerciseSheet from "./ExerciseSheet.jsx";
import ExercisePicker from "./ExercisePicker.jsx";
/* #68 : la porte de l'accueil, réemployée telle quelle par l'onglet Plan. */
import Route from "./Route.jsx";
/* #68 : les cycles enregistrés tels qu'une liste les montre, et la seule
   fonction qui a le droit d'en supprimer un. */
import { programSummaries, removeProgram } from "./program-list.js";
/* #64 : « quelles facettes décrivent cet exercice » est une question du
   registre, pas de l'écran — la Séance la pose, exercise-filter.js y répond. */
import { facetsOf } from "./exercise-filter.js";
import ProgramEditor from "./ProgramEditor.jsx";
import GenerateProgram from "./GenerateProgram.jsx";
import { emptyDraft, draftFrom, withNewId, toDefinition, isDirty } from "./program-editor.js";
import { buildPlan, PLAN_INTRO, PHASE_NOTES } from "./plan.js";
import { useLoadPicker, LoadPickerOverlay, PICKER_FIELD_STYLE } from "./LoadPicker.jsx";
import { fieldSetup } from "./load-picker.js";
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
/* #79 : les deux objets navigateur du repos, injectés comme le reste. */
const NAV = typeof window === "undefined" ? null : window.navigator;
const AUDIO_CTOR = typeof window === "undefined" ? null : (window.AudioContext || window.webkitAudioContext || null);
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
const BILAN_KEYS = ["poids", "taille", "sommeil", "sommeilScore", "energie", "rir", "nutrition", "remarques"];
const BILAN_FIELDS = BILAN_KEYS.length;
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const addDays = (d, n) =>{ const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dateLabel = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
/* #68 : ce qu'une ligne de cycle dit sous son nom. `programSummaries` rend des
   nombres et des dates ISO et s'interdit toute mise en forme ; la phrase se
   compose ici, une fois. Les séances d'abord — c'est ce qu'on perdrait — puis
   la date de départ, seule chose qui distingue deux cycles du même nom. */
const programMeta = (row) => {
  const bits = row.sessions > 0
    ? [`${row.sessions} séance${row.sessions > 1 ? "s" : ""}`, ...(row.lastDate ? [`dernière le ${dateLabel(parseLocalDate(row.lastDate))}`] : [])]
    : ["aucune séance enregistrée"];
  if (row.startDate) bits.push(`départ ${dateLabel(parseLocalDate(row.startDate))}`);
  return bits.join(" · ");
};

const weekRange = (start, w) => {
  const a = addDays(start, (w - 1) * 7), b = addDays(a, 6);
  return `${a.getDate()}${a.getMonth() === b.getMonth() ? "" : " " + MONTHS[a.getMonth()]} – ${dateLabel(b)}`;
};

/* ---------- Petits composants ---------- */
function Section({ title, children, open: o0 = false }) {
  const [open, setOpen] = useState(o0);
  return (
    <div className="border-b border-rule">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-3 text-left focus:outline-none focus:ring-2 focus:ring-focus rounded">
        <span className="font-medium text-ink">{title}</span>
        <ChevronDown size={18} className={`text-ink-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="pb-4 text-sm text-ink-soft leading-relaxed space-y-2">{children}</div>}
    </div>
  );
}
function Field({ label, value, onChange, placeholder, wide, type = "text" }) {
  return (
    <label className={`block ${wide ? "col-span-2" : ""}`}>
      <span className="text-xs text-ink-muted">{label}</span>
      <input type={type} inputMode={type === "text" ? "text" : "decimal"} value={value || ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-11 px-3 rounded-md bg-surface-raised border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-focus" />
    </label>
  );
}
function Btn({ children, onClick, primary, small, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${small ? "h-9 px-3 text-sm" : "h-12 px-4 text-base"} rounded-md font-medium inline-flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-40
        ${primary ? "bg-accent text-ink-inverse" : "bg-surface-raised text-ink border border-rule"}`}>
      {children}
    </button>
  );
}

/* ---------- Avis du validateur sur le programme actif (#57) ----------

   `assess()` existe depuis #37 sans qu'aucun écran l'appelle : ses tests
   étaient son seul appelant. Il est branché ici, à un seul endroit — en fin
   de la section Programme de Plan, sur le programme **actif**. Un seul site
   couvre les deux portes qui installent un programme, le fichier chargé et
   l'enregistrement de l'éditeur, puisque toutes deux finissent par
   loadProgram() : il n'y a pas deux avis à tenir d'accord.

   Ce composant ne lit jamais `code`, `muscle` ni `block`. Il rend `message`
   tel quel, dans l'ordre où le module l'a rendu. C'est ce qui tient « les
   phrases du validateur, non retouchées » par construction plutôt que par
   discipline — le compte compris, qui inclut la ligne « non vérifié ».
   Trier les findings ici reviendrait à réapprendre à la vue un vocabulaire
   qui appartient au moteur.

   Replié par défaut, et distinct de la ligne de refus de parseProgramImport()
   qui vit dans la même section par trois choses plutôt qu'une : la place (en
   fin de section, non collée au bouton), le rôle (aucun — un avis n'est pas
   une alerte : assess() conseille et ne bloque jamais, decisions-moteur.md Q3)
   et le geste (il faut l'ouvrir). La couleur ne peut pas porter la distinction,
   `alert` et `notice` étant le même ambre aujourd'hui. Les deux ne sont de
   toute façon jamais à l'écran ensemble : un fichier refusé n'est pas chargé. */
function ProgramAdvice({ findings }) {
  const [open, setOpen] = useState(false);
  /* Rien à dire : rien du tout — pas un panneau vide annonçant que tout va
     bien. Branche inatteignable en cliquant tant qu'aucune intention n'est
     déclarée, assess() ajoutant alors toujours no-declared-intent ; c'est
     l'écran de collecte d'intention qui la rendra vivante. */
  if (!findings.length) return null;
  return (
    <div className="pt-1">
      <button onClick={() => setOpen(!open)} aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 py-2 text-left text-sm text-notice focus:outline-none focus:ring-2 focus:ring-focus rounded">
        <span>{adviceSummary(findings.length)}</span>
        <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="text-sm text-ink-soft leading-relaxed">
          {findings.map((f, i) => <li key={i} className="border-t border-rule py-2">{f.message}</li>)}
        </ul>
      )}
    </div>
  );
}

/* ---------- Carte exercice ---------- */
function ExerciseCard({ idx, slotId, nSets, week, weeks, si, date, prog, policies, state, rows, vid, substituted, isTest, open, onToggle, onSet, onTimer, onOpen, onSubstitute }) {
  const slot = prog.SLOTS[slotId];
  const v = prog.V[vid];
  const unit = v.unit || "kg";
  /* #55 : deux comptes, et les confondre est le bug. `prescribed` est ce que
     le programme demande — c'est lui que la ligne de prescription annonce, et
     il ne bouge pas parce qu'on a ajouté une série. `sets` est ce que la
     grille rend.

     Le `rows.length` du max n'est pas une précaution : sans lui, une série
     ajoutée existerait dans le journal (`onSet` fait croître le tableau
     jusqu'à l'index reçu) et **disparaîtrait de l'écran** à la réouverture de
     la séance — le pire des deux mondes. Il porte aussi, seul, la réouverture :
     `extra` est un état d'écran et ne survit pas au démontage, ce qui est
     voulu — une ligne ajoutée puis laissée vide n'a rien été.

     Rien de tout cela ne se stocke. Le bouton ne crée pas de ligne : il agrandit
     la grille, et la ligne naît au premier caractère tapé, comme les autres. */
  const prescribed = setsFor(nSets, week, policies);
  const [extra, setExtra] = useState(0);
  const sets = Math.max(prescribed + extra, rows.length);
  /* #55 : `vid` entre dans les dépendances, et c'est tout l'objet du septième
     paramètre de planned(). Substitué, le créneau garde sa fourchette, son RIR
     et son repos — c'est le programme qui prescrit — et la charge prévue se lit
     dans l'historique du remplaçant, qui peut n'en avoir aucun : « Paliers » et
     la charge de départ sont déjà le bon comportement pour ça. */
  const plan = useMemo(() => planned(prog, state, slotId, week, si, date, vid, policies), [prog, state, slotId, week, si, date, vid, policies]);
  const last = useMemo(() => lastEntry(prog, state, vid, date, si), [prog, state, vid, date, si]);
  /* #14 : « par rapport au dernier test ». Une séance test est un repère, pas
     une prescription : le moteur l'écarte de son calcul (SKIPPED_AS_BASE), donc
     la seule chose qu'elle produise est cette comparaison-là. Sans elle, prendre
     un repère ne servirait à rien — et un repère qui ne se compare à rien n'en
     est pas un. */
  const lastTest = useMemo(
    () => (isTest ? historyBefore(prog, state, vid, date, si).filter((e) => e.kind === "test").pop() || null : null),
    [isTest, prog, state, vid, date, si],
  );
  /* #66 : le repli de la consigne technique, distinct du repli de la carte
     elle-même, qui est tenu par le parent (une seule carte ouverte). */
  const [cueOpen, setCueOpen] = useState(false);
  const phase = phaseOf(week, policies, weeks);
  /* #14 : « pas en décharge » se lit dans la politique, plus dans un numéro de
     semaine écrit en dur. Un programme qui décharge en S5 autorisait encore
     l'échec cette semaine-là, et l'interdisait en S7 où il ne déchargeait pas. */
  const failOk = slot.fail && week >= 3 && !isDeloadWeek(week, policies.deload);
  /* #14 : l'AMRAP automatique de la dernière semaine est retiré. C'était un
     compte à rebours de calendrier — précisément ce que cette issue supprime —
     et il annonçait un repère que personne n'avait décidé de prendre. Il revient
     quand la séance est déclarée comme un test, ce qui est un geste. */
  const amrap = isTest && slot.key;
  /* #23 : trois ternaires indépendants sur la même unité, dont deux
     n'énuméraient pas les mêmes cas. Les en-têtes viennent de display.js
     (des mots), les deux autres de units.js (du sens) : une colonne de charge
     n'existe que si l'unité en porte une, et la colonne du milieu se nomme
     comme la mesure. */
  const u = traitsOf(v.unit);
  const cols = unitColumns(unit);
  const fields = u.hasLoad ? ["w", "r", "rir"] : ["r", "rir"];
  const repLabel = `${slot.reps[0]}–${slot.reps[1]} ${u.repUnit}`;

  /* #42 : « faite » est dérivé, pas stocké. Une série compte quand elle porte
     ses valeurs — c'est déjà la règle du moteur, planned() ne retient une
     série que si r != null (progression.js). Stocker un drapeau par série
     serait un champ neuf dans le journal, donc une migration, pour le seul
     confort de pouvoir décocher.

     RIR exclu du critère pour la même raison : planned() ne le lit jamais. Il
     est informatif, donc pré-rempli quand la phase donne un chiffre unique et
     laissé vide en calibration et en décharge, où la cible est une fourchette. */
  const filled = (row, f) => String((row && row[f]) ?? "").trim() !== "";
  /* #66 : la règle est sortie dans display.js, parce que la carte repliée la
     lit aussi — « 2 séries sur 3 » et la coche de la troisième ne peuvent pas
     répondre à deux définitions différentes. */
  const rowDone = (i) => rowIsDone(rows[i], unit);
  const nextIdx = Array.from({ length: sets }).findIndex((_, i) => !rowDone(i));
  const rirTarget = /^\d+$/.test(String(phase.rir)) ? String(phase.rir) : null;

  /* #46 : appui long sur un champ, glisser, relâcher. Corriger une valeur, c'est
     un cran d'écart — `v.incr` le connaît pour la charge, reps et RIR se comptent
     un par un — et le pavé numérique fait payer plusieurs frappes ce détour. Le
     tap court garde le clavier : la roue est le chemin rapide, pas une cage.

     D'abord livrée sur la seule charge, puis étendue aux trois colonnes une fois
     le geste essayé en salle. `fieldSetup()` porte ce qui les sépare. */
  const picker = useLoadPicker({ onCommit: (i, f, value) => onSet(vid, i, f, value) });
  const setupOf = (f) => fieldSetup(f, { unit, incr: v.incr, planLoad: plan.load, repTop: slot.reps[1], rirTarget: num(rirTarget) });

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

  /* #66 : ce que la carte repliée dit d'elle-même. Une carte faite porte son
     résultat, une carte à venir sa prescription — jamais rien qui demande
     d'ouvrir pour savoir si on l'a faite. Le compte passe par `completedSets`,
     la même règle que la coche de chaque rangée. */
  const doneCount = completedSets(rows, unit);
  const allDone = doneCount >= prescribed;
  const summary = normalizeSets(rows).length ? setSummary(normalizeSets(rows), v) : null;

  return (
    <div className="py-4 border-b border-rule">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* #17 : le nom ouvre la fiche de l'exercice. La cible existait déjà —
              c'est la première chose qu'on lit — et le chevron la signale.

              #66 : seulement sur la carte ouverte. Repliée, la ligne entière
              ouvre l'exercice : c'est le geste qu'on attend d'un accordéon, et
              un nom qui partirait vers une autre page sous le pouce de
              quelqu'un qui voulait juste déplier serait le piège classique de
              deux cibles empilées. */}
          {open ? (
            <button onClick={() => onOpen(vid)} className="text-left focus:outline-none focus:ring-2 focus:ring-focus rounded">
              <span className="font-medium text-ink leading-snug">{idx}. {v.name}</span>
              <ChevronRight size={15} className="inline text-ink-faint ml-1 mb-0.5" />
            </button>
          ) : (
            <button onClick={onToggle} aria-expanded={false} className="w-full text-left focus:outline-none focus:ring-2 focus:ring-focus rounded">
              <span className={`font-medium leading-snug ${allDone ? "text-ink-muted" : "text-ink"}`}>{idx}. {v.name}</span>
              <span className="block text-sm mt-0.5 truncate">
                {allDone ? (
                  <span className="text-ink-soft inline-flex items-center gap-1"><Check size={14} className="text-done shrink-0" />{summary}</span>
                ) : doneCount > 0 ? (
                  <span className="text-ink-soft">{doneCount}/{prescribed} séries · {summary}</span>
                ) : (
                  <span className="text-ink-muted">Prévu : <span className="text-accent font-medium">{plan.text}</span></span>
                )}
              </span>
            </button>
          )}
          {/* #55 : on doit *voir* qu'on a dévié, pas le déduire. Une déviation
              qu'on ne voit pas est une déviation qu'on oublie, puis qu'on met en
              doute en relisant son historique six semaines plus tard. La ligne
              nomme l'exercice remplacé, seule information que la carte ne porte
              plus nulle part ailleurs une fois le nom du remplaçant en titre. */}
          {substituted && (
            <div className="text-sm text-notice mt-0.5 inline-flex items-center gap-1">
              <Repeat size={13} />Remplace {prog.V[prescribedVid(prog, slotId, week)]?.name || "l'exercice prévu"}
            </div>
          )}
          {open && (
            <div className="text-sm text-ink-muted mt-0.5">
              {prescribed} × {repLabel}{v.side ? " par côté" : ""}, RIR {phase.rir}
              {failOk && <span className="ml-2 inline-flex items-center gap-1 text-badge"><Zap size={13} />dernière série à l'échec OK</span>}
              {amrap && <span className="ml-2 text-badge">Séance test : dernière série AMRAP</span>}
            </div>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {/* #66 : substitution et minuteur appartiennent à l'exercice qu'on est
              en train de faire. Sur une carte repliée, ils remplissaient la
              ligne de deux cibles pour un geste qu'on ne fait pas là. */}
          {open && (
            <>
              {/* Présent aussi sur une carte déjà substituée : c'est par lui qu'on
                  revient au prescrit, en le rechoisissant dans le sélecteur
                  (design.md décision 5). */}
              <button onClick={() => onSubstitute(slotId)} aria-label={`Remplacer ${v.name} pour cette séance`}
                className="h-9 px-2 rounded-md bg-surface-raised border border-rule text-ink-soft inline-flex items-center gap-1 text-sm focus:outline-none focus:ring-2 focus:ring-focus">
                <Repeat size={15} />
              </button>
              <button onClick={() => onTimer(slot.rest, v.name)} aria-label="Lancer le repos" className="h-9 px-2 rounded-md bg-surface-raised border border-rule text-ink-soft inline-flex items-center gap-1 text-sm focus:outline-none focus:ring-2 focus:ring-focus">
                <Timer size={15} />{Math.floor(slot.rest / 60)}:{String(slot.rest % 60).padStart(2, "0")}
              </button>
            </>
          )}
          <button onClick={onToggle} aria-expanded={open} aria-label={`${open ? "Replier" : "Ouvrir"} ${v.name}`}
            className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-md text-ink-faint focus:outline-none focus:ring-2 focus:ring-focus">
            <ChevronDown size={18} className={open ? "rotate-180" : ""} />
          </button>
        </div>
      </div>

      {open && (
        <>
          {/* #66 : entre deux séries, ce qui se lit est un nombre. Il était écrit
              à la taille de la phrase qui l'explique, au milieu de trois lignes
              de prose. Le « pourquoi » reste sous le chiffre, en gris : il ne
              disparaît pas, il cesse de lui disputer la place. */}
          <div className="mt-2 flex items-baseline gap-2 flex-wrap">
            <span className="text-[26px] leading-none font-semibold text-accent">{plan.text}</span>
            <span className="text-xs uppercase tracking-wider text-ink-muted">prévu</span>
          </div>
          {plan.why && <div className="text-sm text-ink-muted mt-1">{plan.why}</div>}
          {last && <div className="text-sm text-ink-muted mt-0.5">Dernière fois ({lastEntryLabel(last)}) : {setSummary(last.sets, v)}</div>}
          {lastTest && <div className="text-sm text-badge">Dernier test ({lastEntryLabel(lastTest)}) : {setSummary(lastTest.sets, v)}</div>}

          <button onClick={() => setCueOpen(!cueOpen)} className="mt-1 text-sm text-ink-muted inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-focus rounded">
            Technique <ChevronDown size={14} className={cueOpen ? "rotate-180" : ""} />
          </button>
          {cueOpen && <p className="text-sm text-ink-soft leading-relaxed mt-1">{v.cue}</p>}

          <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: fields.length === 3 ? "2rem 1fr 1fr 1fr 2.75rem" : "2rem 1fr 1fr 2.75rem" }}>
        <div />
        {cols.map((c) => <div key={c} className="text-xs text-ink-muted text-center">{c}</div>)}
        <div />
        {Array.from({ length: sets }).map((_, i) => {
          const row = rows[i] || {};
          const done = rowDone(i);
          const isNext = i === nextIdx;
          return [
            <div key={`n${i}`} className={`text-sm self-center ${done ? "text-done" : isNext ? "text-ink" : "text-ink-muted"}`}>S{i + 1}</div>,
            ...fields.map((f) => (
              <input key={`${i}${f}`} inputMode="decimal" aria-label={`Série ${i + 1} ${f}`}
                value={row[f] == null ? "" : row[f]}
                placeholder={f === "w" && plan.load != null ? fmt(plan.load) : ""}
                {...picker.handlers(i, f, num(row[f]), setupOf(f))}
                onChange={(e) => onSet(vid, i, f, e.target.value)}
                className={`h-11 w-full text-center rounded-md focus:outline-none focus:ring-2 focus:ring-focus ${done ? "bg-surface border border-rule-faint text-ink-muted" : isNext ? "bg-surface-raised border border-rule-strong text-ink" : "bg-surface-raised border border-rule text-ink"}`} style={{ fontVariantNumeric: "tabular-nums", ...PICKER_FIELD_STYLE }} />
            )),
            /* #42 : remplit depuis « Prévu », marque la série et lance le repos.
               Les champs restent modifiables : corriger, c'est taper par-dessus. */
            <button key={`v${i}`} onClick={() => validateRow(i)}
              aria-label={done ? `Relancer le repos après la série ${i + 1}` : `Valider la série ${i + 1}`}
              className={`h-11 w-11 rounded-md inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-focus ${done ? "bg-done border border-done text-ink-inverse" : isNext ? "bg-surface-raised border border-accent text-accent" : "bg-surface-raised border border-rule text-ink-dim"}`}>
              <Check size={20} strokeWidth={2.5} />
            </button>,
          ];
        })}
        {/* #55 : « un jour je suis chaud, je veux ajouter une série ». Retirer une
            série marchait déjà — une ligne sans répétitions n'a pas eu lieu
            (normalizeSets, #23) — seul l'ajout manquait.

            Visible seulement quand tout le prescrit est rempli (`nextIdx === -1`,
            la logique de #42). On décide d'ajouter une série **après** avoir fait
            les autres, jamais avant : plus tôt, le bouton ne pourrait produire
            qu'une rangée de champs vides de plus. Il se limite ainsi tout seul,
            sans plafond arbitraire — la troisième s'ajoute, il faut juste avoir
            rempli la deuxième.

            #65 : dans la grille, à la place qu'occuperait S{n+1}. La position
            dit ce qu'il ajoute, et il porte le gris des séries à venir — le
            même que la coche inerte au bout de la rangée. Un libellé
            n'apprenait rien de plus et posait une phrase au milieu d'une
            grille de chiffres. */}
        {nextIdx === -1 && (
          <button onClick={() => setExtra((n) => n + 1)} aria-label="Ajouter une série"
            className="h-11 w-8 self-center inline-flex items-center justify-center rounded-md bg-surface-raised border border-rule text-ink-dim focus:outline-none focus:ring-2 focus:ring-focus">
            <Plus size={16} strokeWidth={2.5} />
          </button>
        )}
          </div>
          <LoadPickerOverlay picker={picker.picker} />
        </>
      )}
    </div>
  );
}

/* ---------- Application ---------- */
export default function Programme() {
  /* #19 : le cycle fourni démarre au prochain lundi, pas à la date figée dans
     le fichier livré. Sans ça, un appareil ouvert trois mois après la
     publication affiche « Les 12 semaines sont terminées » sur un programme que
     personne n'a commencé. Calculé une fois, à l'initialisation : l'état ne doit
     pas se déplacer sous les pieds de l'utilisateur à minuit. */
  const [journal, setJournal] = useState(() => emptyJournal(startingNow(DEFAULT_DEFINITION, new Date())));
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
  /* #68 : une ligne par cycle, avec ce qu'il porte. Le verdict d'exécutabilité
     arrive en paramètre plutôt que d'être recalculé — un seul module décide
     qu'une définition est refusée (ARCHITECTURE §2.9). */
  const programRows = useMemo(() => programSummaries(journal, unusable), [journal, unusable]);

  const START = parseLocalDate(definition.startDate);
  const today = startOfDay(new Date());
  /* #39 : « où en est-on du cycle ? » se demande à startDate, jamais au
     calendrier. slotForDate rend le décalage de 1 à 7 qu'est `session.day`
     (schema.js) ; l'ancien `today.getDay()` rendait un index de jour de
     semaine JS, qui ne coïncide avec lui que si startDate tombe un lundi.

     `at` est null avant le départ, et sa semaine dépasse la durée du
     programme une fois le cycle fini : `curWeek` retombe alors sur la
     dernière semaine — c'est ce qu'on veut pour naviguer — mais `todayDay`
     s'éteint, parce qu'une pastille « aujourd'hui » sur une séance de S12
     qu'on a passée depuis trois semaines dit quelque chose de faux.

     Les deux bornes du cycle (cycleNote, plus bas) se lisent sur ce même
     `at` : avant le départ il est null, après la fin sa semaine dépasse
     `definition.weeks`. L'ancien `dayIdx` comptait des jours pour répondre
     à une question de semaines, et le faisait par soustraction de dates
     locales — 89,96 jours quand le cycle traverse un changement d'heure. */
  const at = slotForDate(definition.startDate, toIsoDate(today));
  const curWeek = Math.min(definition.weeks, Math.max(1, at ? at.week : 1));
  const todayDay = at && at.week <= definition.weeks ? at.day : null;
  const prog = useMemo(() => buildProgram(definition), [definition]);
  const plan = useMemo(() => buildPlan(definition), [definition]);
  /* #57 : les six assertions de #37, sur le programme que l'application
     exécute réellement — `prog` et non `definition.program`, ce qui donne
     gratuitement le repli LEGACY d'une définition d'avant #25.

     #58 : les cibles viennent de l'intention déclarée du cycle. Un programme
     composé à la main ou chargé depuis un fichier n'en porte pas ;
     `targetsFor({})` rend alors `null` et les trois assertions qui en
     dépendent se taisent, en le disant — c'est le comportement de #57, obtenu
     sans branche. Mémoïsé sur `definition` : ça ne rejoue ni à la saisie d'une
     série ni au changement de semaine. */
  const advice = useMemo(
    () => assess(prog, targetsFor(definition.intent ?? {})),
    [prog, definition],
  );

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
  /* Le sujet ouvert dans Plan n'est pas dans `nav` et ne se mémorise pas : un
     rechargement rouvre l'index, ce qui est la bonne réponse par défaut et
     évite de faire entrer une troisième cible dans screen-state.js (#41), qui
     valide les siennes contre le programme actif. Revenir sur Plan par la
     barre du bas ramène à l'index, comme on l'attend d'un onglet. */
  const [planTopic, setPlanTopic] = useState(null);
  const goPlan = () => { setPlanTopic(null); setNav({ screen: "plan", sessionId: null }); };
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
  /* #79 : relu au montage, pour qu'une vue web récupérée par iOS entre deux
     séries retrouve son repos là où il en est — ou expiré. */
  const [timer, setTimer] = useState(() => readRest(SCREEN_STORAGE, Date.now()));
  const chime = useRef(null);
  if (!chime.current) chime.current = makeChime(AUDIO_CTOR);
  /* Le tap qui lance le repos est le seul geste utilisateur de la chaîne :
     c'est là que Safari autorise le son qui la terminera. */
  const startRest = (sec, label) => {
    chime.current.unlock();
    setTimer({ end: Date.now() + sec * 1000, label });
  };
  const [, setTick] = useState(0);
  const [toast, setToast] = useState("");
  const [importError, setImportError] = useState("");
  const [pendingImport, setPendingImport] = useState(null); // fichier lu et validé, pas encore appliqué (#11)
  const [pendingLight, setPendingLight] = useState(null); // exercices descendus sous la référence, question posée (#43)
  const [loadError, setLoadError] = useState("");
  /* #19 : appareil vierge, aucun journal en stockage. Écran d'accueil tant que
     rien n'est choisi — et rien n'est écrit tant qu'il est là, ce qui est tout
     l'objet de la décision Q1 : l'appli ne sait pas supprimer un cycle, donc
     elle n'en impose pas un. Cet état ne se stocke pas : il naît du verdict de
     chargement et meurt au premier choix. */
  const [welcome, setWelcome] = useState(false);
  const [programError, setProgramError] = useState(""); // #6 : rejet d'un fichier de programme
  /* #68 : deux états d'écran, rien de stocké. `newProgram` ouvre les portes de
     création, `pendingDelete` porte l'id dont la suppression est proposée — la
     confirmation est un panneau dans l'appli, comme pour l'import (#11), et
     non un window.confirm qu'on écarte par réflexe. */
  const [newProgram, setNewProgram] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  /* #36 : le brouillon de l'éditeur vit ici et nulle part ailleurs — rien
     n'est écrit tant que « Enregistrer » n'a pas été touché (Q4). "editeur"
     n'est volontairement pas un écran de screen-state.js : writeScreen refuse
     un écran qu'il ne connaît pas, si bien qu'un rechargement en pleine
     édition rouvre le dernier écran écrit, Plan — qui est de toute façon le
     retour de l'éditeur. Aucun brouillon ne survit, ce qui répond à Q4 sans
     une ligne de code de plus. */
  const [editor, setEditor] = useState(null);
  const [editorError, setEditorError] = useState(""); // verdict du validateur au moment d'enregistrer
  const [pendingLeave, setPendingLeave] = useState(null); // sortie demandée alors que le brouillon a changé
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
        /* #38 Q4 : la phrase du refus, quand le validateur en a une. Elle porte
           le chemin JSON et la règle enfreinte, donc elle dit *quoi* réparer et
           pas seulement qu'il y a quelque chose à réparer. Sans elle, les 73
           rejets distincts de journal-shape arrivaient ici tous identiques. */
        setLoadError(res.detail ? `${LOAD_ERROR_MESSAGE} ${res.detail}` : LOAD_ERROR_MESSAGE);
      } else if (res.reason === "no-store") {
        setStorageOk(false);
      }
      /* #19 : « absent » est le seul verdict qui signifie premier lancement, et
         isFirstLaunch() porte pourquoi les trois autres n'en sont pas. L'état
         initial tient toujours lieu de journal — l'accueil ne le remplace pas,
         il empêche seulement qu'on soit posé dedans sans l'avoir voulu. */
      if (isFirstLaunch(res)) setWelcome(true);
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
  useEffect(() => { writeRest(SCREEN_STORAGE, timer); }, [timer]);
  /* Un repos relu après rechargement n'a pas eu son tap : iOS a aussi pu
     suspendre le son en arrière-plan. Tant qu'un repos court, n'importe quel
     tap sur l'écran le réautorise. Sans aucun tap avant la fin, seule la
     vibration reste — là où elle existe. */
  useEffect(() => {
    if (!timer || typeof document === "undefined") return;
    const unlock = () => chime.current.unlock();
    document.addEventListener("pointerdown", unlock);
    return () => document.removeEventListener("pointerdown", unlock);
  }, [timer]);
  const remaining = timer ? Math.max(0, Math.ceil((timer.end - Date.now()) / 1000)) : null;
  useEffect(() => {
    if (timer && remaining === 0) {
      /* #79 : vibrate n'existe pas dans Safari iOS — sur iPhone, la fin du
         repos ne produisait rien. Le son s'ajoute, il ne remplace pas. */
      if (NAV && NAV.vibrate) NAV.vibrate([200, 100, 200]);
      chime.current.play();
      const t = setTimeout(() => setTimer(null), 4000);
      return () => clearTimeout(t);
    }
  }, [timer, remaining]);

  /* #79 : l'écran reste allumé tant qu'une séance est ouverte. Le navigateur
     relâche le verrou dès que la page est masquée ; on le redemande au retour.
     Non pris en charge ou refusé : rien ne se passe, l'écran s'éteint comme
     avant. */
  useEffect(() => {
    if (screen !== "seance" || !NAV || typeof document === "undefined") return;
    let lock = null;
    let alive = true;
    const take = async () => {
      const l = await acquireWakeLock(NAV);
      if (alive) { releaseWakeLock(lock); lock = l; } else releaseWakeLock(l);
    };
    const onVisible = () => { if (document.visibilityState === "visible") take(); };
    take();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      releaseWakeLock(lock);
    };
  }, [screen]);

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

  /* #14 : les décharges décidées à la main, lues sur le check-in de leur
     semaine. Aucun champ de premier niveau ajouté — `deload` vit à côté de
     `poids` et `sommeil` dans un objet déjà libre, donc ni migration ni bump,
     et son absence se lit « aucune décision prise ». Même classe de champ que
     `sub` (#55). */
  const deloadAt = (w) => (state.checkin[weekStartKey(definition.startDate, w)] || {}).deload || null;
  const deloadChoice = (deloadAt(week) || {}).choice || null;
  const forcedDeloads = useMemo(() => {
    const out = [];
    for (let w = 1; w <= definition.weeks; w++) if ((deloadAt(w) || {}).choice === "accepted") out.push(w);
    return out;
  }, [state.checkin, definition.startDate, definition.weeks]);
  /* Les politiques réellement exécutées cette semaine : celles du programme,
     plus les décharges acceptées. Un seul objet, mémorisé, passé partout —
     un objet neuf à chaque rendu défait les useMemo qui en dépendent (#22). */
  const policies = useMemo(() => withForcedDeloads(prog.POLICIES, forcedDeloads), [prog.POLICIES, forcedDeloads]);

  const phase = phaseOf(week, policies, definition.weeks);
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

  /* #55 : le créneau dont le sélecteur est ouvert, ou null. État d'écran pur —
     rien n'est écrit tant qu'un exercice n'est pas choisi. */
  const [subSlot, setSubSlot] = useState(null);

  /* #66 : un seul exercice déplié. L'état porte la séance avec lui, si bien
     qu'ouvrir une autre séance repart du premier exercice à faire au lieu de
     désigner un créneau qui n'est pas dans cette séance-là. Rien n'est stocké :
     c'est une position de lecture, pas une donnée.

     Tant que personne n'a touché un en-tête, l'ouvert est **dérivé** — le
     premier exercice dont les séries prescrites ne sont pas toutes remplies.
     C'est ce qui fait qu'une séance reprise en cours s'ouvre là où on s'était
     arrêté, sans effet ni état à resynchroniser. */
  const [openEx, setOpenEx] = useState(null);
  const sessionSlots = useMemo(
    () => [...session.ex, ...prog.CORE[session.core].ex].map(([slotId, n]) => [slotId, n]),
    [session, prog],
  );
  const firstUnfinished = useMemo(() => {
    for (const [slotId, n] of sessionSlots) {
      const vid = vidFor(prog, log, slotId, week);
      const v = prog.V[vid];
      if (!v) continue;
      if (completedSets((log.ex && log.ex[vid]) || [], v.unit || "kg") < setsFor(n, week, policies)) return slotId;
    }
    return null;
  }, [sessionSlots, prog, log, week, policies]);
  const openSlot = openEx && openEx.sessionId === session.id ? openEx.slotId : firstUnfinished;
  const toggleEx = (slotId) => setOpenEx({ sessionId: session.id, slotId: openSlot === slotId ? null : slotId });

  /* Pose (ou retire) la substitution sur la ligne de séance du jour.
     `withSub` rend `{ sub: undefined }` quand il n'en reste aucune : l'absence
     du champ est la forme canonique de « aucune substitution », et JSON.stringify
     ne recopie pas une clé indéfinie — le journal stocké reste celui d'avant.

     Les séries déjà saisies sous l'exercice abandonné ne sont pas effacées
     (design.md décision 6) : elles ont eu lieu, elles appartiennent à
     l'historique de cet exercice-là, et sa fiche (#17) est l'endroit qui les
     concerne. */
  const substitute = (slotId, vid) => {
    setSubSlot(null);
    if (!slotId) return;
    updateActive((st) => {
      const d = dateOf(session.id);
      const cur = findLog(st.logs, d, session.id) || {};
      return { ...st, logs: writeLog(st.logs, d, session.id, withSub(cur, slotId, vid, prescribedVid(prog, slotId, week))) };
    });
  };

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
      /* #55 : l'exercice réellement tenu par le créneau, substitution comprise.
         C'est sous cet identifiant-là que validate() écrit, et c'est celui-là
         dont le moteur lit l'historique. */
      const vid = vidFor(prog, cur, slotId, week);
      const p = planned(prog, st, slotId, week, si, d, vid);
      const rows = (ex[vid] || []).map((r) => (r.r && !r.w && p.load != null ? { ...r, w: fmt(p.load) } : r));
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
      /* #14 : une séance déclarée « test » **avant** d'être faite garde son
         genre à la validation. C'est ce qui distingue le test de « allégée » :
         « allégée » se constate après coup, un test se décide avant — on pousse
         la dernière série à l'échec parce qu'on a choisi de prendre un repère,
         pas parce que la journée s'est mal passée. */
      const kind = cur.done
        ? (cur.kind ?? computeKind(week, policies))
        : (allege ? "allege" : cur.kind === "test" ? "test" : computeKind(week, policies));
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
    if (log.done || computeKind(week, policies) !== "normal") return validate(false);
    const drops = dropsOf(state);
    return drops.length ? setPendingLight(drops) : validate(false);
  };
  const reopen = () => updateActive((st) => ({ ...st, logs: writeLog(st.logs, dateOf(session.id), session.id, { done: false }) }));

  /* #14 : déclarer — ou retirer — le genre « test » sur la séance ouverte.
     Écrit tout de suite, et pas seulement à la validation : c'est ce qui permet
     aux cartes d'afficher le repère AMRAP *pendant* la séance, au moment où on
     décide de pousser la dernière série. Annuler remet le genre calculé, celui
     que la politique donne à cette semaine. */
  const toggleTest = () => updateActive((st) => {
    const d = dateOf(session.id);
    const cur = findLog(st.logs, d, session.id) || {};
    return { ...st, logs: writeLog(st.logs, d, session.id, { kind: cur.kind === "test" ? computeKind(week, policies) : "test" }) };
  });

  /* #29 : la clé est la date du premier jour de la semaine de cycle, plus un
     numéro relatif. Deux passages du même programme ont deux startDate, donc
     jamais la même clé pour « semaine 1 » — le second n'écrase plus le premier. */
  const setCardio = (id, f, val) => updateActive((st) => { const k = weekStartKey(definition.startDate, week); const c = st.cardio[k] || {}; return { ...st, cardio: { ...st.cardio, [k]: { ...c, [id]: { ...(c[id] || {}), [f]: val } } } }; });
  const toggleMob = (i) => updateActive((st) => { const k = weekStartKey(definition.startDate, week); const c = st.cardio[k] || {}; const m = [...(c.mob || Array(prog.MOB_DAYS.length).fill(false))]; m[i] = !m[i]; return { ...st, cardio: { ...st.cardio, [k]: { ...c, mob: m } } }; });
  const setCheck = (f, val) => updateActive((st) => { const k = weekStartKey(definition.startDate, week); return { ...st, checkin: { ...st.checkin, [k]: { ...(st.checkin[k] || {}), [f]: val } } }; });

  /* #14 : la réponse à une recommandation, enregistrée dans les deux cas.
     « Reporté » compte autant qu'« accepté » — c'est même le plus informatif
     des deux : une recommandation systématiquement déclinée dit que le seuil
     est trop bas, et c'est la donnée qui permettra de le régler plutôt que de
     le deviner. */
  const answerDeload = (choice) => setCheck("deload", { choice, at: toIsoDate(new Date()), score: deloadAdvice ? deloadAdvice.score : null });

  /* Les signaux que l'appli sait déjà calculer. Le sommeil vient du check-in
     hebdomadaire s'il a été rempli ; les deux autres se dérivent de
     l'historique, sans rien demander à personne. Un avis reste donc possible
     sur les seuls signaux objectifs — régression (2) plus dérive du RIR (1)
     atteint le seuil de 3 à lui seul. */
  const deloadAdvice = useMemo(() => {
    if (!policies.deload) return null;
    const keyLifts = getKeySlots(prog).map((slotId) => {
      const vid = prescribedVid(prog, slotId, week);
      const v = prog.V[vid];
      if (!v) return null;
      const [mn, mx] = prog.SLOTS[slotId].reps;
      return {
        name: v.name,
        history: history(prog, state, vid).map((e) => ({
          date: e.date, kind: e.kind, sets: e.sets, load: workingSets(e.sets, mn, mx).load,
        })),
      };
    }).filter(Boolean);
    const checkins = Object.entries(state.checkin)
      .map(([date, c]) => ({ date, sleep: num(c && c.sommeilScore) }))
      .filter((c) => c.sleep != null);
    const last = [...forcedDeloads].pop();
    return evaluateDeload(
      { keyLifts, checkins, lastDeload: last ? weekStartKey(definition.startDate, last) : null },
      policies.deload,
      todayIso,
    );
  }, [prog, state, week, policies, forcedDeloads, definition.startDate, todayIso]);

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
    const c = state.checkin[weekStartKey(definition.startDate, week)] || {};
    const ca = state.cardio[weekStartKey(definition.startDate, week)] || {};
    const done = prog.SESSIONS.filter((s) => doneMap[s.id]);
    const missing = prog.SESSIONS.filter((s) => !doneMap[s.id]).map((s) => s.name);
    const cardioLines = (prog.CARDIO_ITEMS || []).filter((it) => ca[it.id] && ca[it.id].done).map((it) => { const d = ca[it.id]; return `${it.label} ${d.min || "?"} min${d.w ? `, ${d.w} W` : ""}${d.hr ? `, ${d.hr} bpm` : ""}`; });
    const mob = (ca.mob || []).filter(Boolean).length;
    const keys = getKeySlots(prog);
    /* #55 Q2 = A : un créneau clé substitué nomme son remplaçant. Avant, la
       ligne cherchait les séries sous l'identifiant *prescrit*, n'en trouvait
       aucune et rendait null — la ligne disparaissait entièrement du bilan, et
       une ligne absente se lit « pas fait », ce qui est faux.

       Résolu séance par séance : la même semaine peut porter deux occurrences
       du créneau, l'une substituée et l'autre non, et les séries des deux
       comptent — chacune sous l'exercice qui l'a portée. */
    const keyLines = keys.map((slotId) => {
      const prescribed = prescribedVid(prog, slotId, week);
      /* Groupé par exercice *résolu*, et non par séance : sans substitution,
         toutes les séances de la semaine tombent dans le même groupe et la
         chaîne produite est identique au caractère près à celle d'avant #55.
         C'est la substitution qui crée un second groupe, jamais autre chose. */
      const byVid = new Map();
      for (const s of prog.SESSIONS) {
        const l = findLog(state.logs, dateOf(s.id), s.id);
        if (!l || !l.done || !l.ex) continue;
        const vid = vidFor(prog, l, slotId, week);
        if (!l.ex[vid]) continue;
        byVid.set(vid, [...(byVid.get(vid) || []), ...l.ex[vid]]);
      }
      const parts = [...byVid.entries()].map(([vid, rows]) => {
        const sets = normalizeSets(rows);
        if (!sets.length) return null;
        const v = prog.V[vid];
        if (!v) return null;
        const name = vid === prescribed ? v.name : `${prog.V[prescribed]?.name || prescribed} → ${v.name}`;
        return `${name} : ${setSummary(sets, v)}`;
      }).filter(Boolean);
      return parts.length ? parts.join(" ; ") : null;
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
  const loadProgram = (definition, toast) => {
    const existing = journal.programs[definition.id];
    /* #19 : au premier lancement, le programme fourni n'est pas un cycle — c'est
       un état initial que personne n'a choisi, et il n'a jamais touché le
       stockage. Le premier vrai programme le **remplace** donc au lieu de
       s'ajouter à côté.

       Sans ça, l'accueil tiendrait sa promesse à l'écran et la trahirait dans la
       donnée : générer son programme laisserait deux cycles dans le journal,
       dont un qu'on n'a jamais voulu et que l'appli ne sait pas supprimer —
       exactement ce que la décision Q1 refuse. */
    setJournal((j) => {
      const base = welcome ? {} : j.programs;
      return {
        ...j,
        activeProgramId: definition.id,
        programs: {
          ...base,
          [definition.id]: existing && !welcome ? { ...j.programs[definition.id], definition } : { definition, logs: {}, cardio: {}, checkin: {} },
        },
      };
    });
    setWelcome(false);
    showToast(toast || (existing && !welcome ? "Cycle repris." : "Programme chargé."));
  };

  /* ---------- Éditeur de programme (#36) ----------
     Deux portes vers le même écran : composer à blanc, ou partir du
     programme actif. La seconde ne touche pas au cycle en cours — ce lot
     enregistre toujours un nouveau cycle, si bien que la branche « id déjà
     présent » de loadProgram() n'est jamais atteinte depuis ici. Corriger un
     cycle en place est l'issue suivante (design.md, étape 8). */
  const openEditor = (draft) => { setEditorError(""); setEditor(draft); setNav({ screen: "editeur", sessionId: null }); };
  const closeEditor = (then) => { setEditor(null); setPendingLeave(null); setEditorError(""); then(); };
  /* Un brouillon modifié ne se perd pas sur un tap. Même panneau à deux
     boutons que l'import (#11) plutôt que window.confirm : la question se lit
     dans l'appli, et le bouton qui détruit n'est pas celui qu'on touche par
     réflexe. isDirty compare au brouillon d'ouverture, donc défaire ses
     modifications fait taire la question. */
  const askLeave = (then) => (editor && isDirty(editor) ? setPendingLeave(() => () => closeEditor(then)) : closeEditor(then));
  const guarded = (dest) => () => (screen === "editeur" ? askLeave(dest) : dest());

  /* L'enregistrement passe par le validateur partagé, celui des deux portes
     d'import (ARCHITECTURE §2.9) : l'éditeur n'a aucune règle de forme à lui,
     et un brouillon refusé n'écrit rien. L'id n'est décidé qu'ici — withNewId
     lit les cycles déjà présents pour ne pas en écraser un. */
  const saveDraft = () => {
    const composed = toDefinition(withNewId(editor, Object.keys(journal.programs)));
    const bad = validateDefinition(composed);
    if (bad) { setEditorError(bad.message || IMPORT_MESSAGES[bad.reason] || "Ce programme n'a pas pu être enregistré."); return; }
    setEditorError("");
    setEditor(null);
    loadProgram(composed, "Programme enregistré.");
    /* #57 : Plan, et non Semaine. Un programme qu'on vient de composer a plus
       de chances de demander une seconde passe que d'être exécuté dans la
       minute, et c'est dans Plan qu'on le rouvre — c'est aussi là que l'avis
       du validateur l'attend. Inconditionnel, avis ou pas (decisions-spec.md
       Q4) : un même geste qui finirait sur deux écrans selon le verdict serait
       une branche de plus à tenir en tête, pour rien.
       goPlan et non goSemaine laisse `pendingLight` en place, exactement comme
       l'onglet Plan de la barre du bas : la question de #43 appartient à la
       séance ouverte, pas à la navigation. */
    goPlan();
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
    !at ? `Le programme commence ${weekdayName(START)} ${dateLabel(START)}.`
    : at.week > definition.weeks ? `Les ${definition.weeks} semaines sont terminées : bilan et programme suivant.`
    : null;

  const backSession = nav.sessionId ? prog.SESSIONS.find((s) => s.id === nav.sessionId) : null;
  const backLabel = backSession ? `Séance ${backSession.name}` : "Semaine";

  const cardio = prog.cardioPlan ? prog.cardioPlan(week) : null;
  const ca = state.cardio[weekStartKey(definition.startDate, week)] || {};
  const ci = state.checkin[weekStartKey(definition.startDate, week)] || {};
  const bilanFilled = BILAN_KEYS.filter((k) => (ci[k] || "") !== "").length;

  if (!loaded) return <div className="min-h-screen bg-surface text-ink-muted flex items-center justify-center">Chargement du journal…</div>;

  /* #19 : l'accueil passe avant la coquille à onglets, et avant l'en-tête de
     semaine — « Semaine 1 sur 12 » au-dessus d'un choix pas encore fait dirait
     exactement ce que cette issue existe pour ne plus dire.

     Le générateur et l'éditeur restent atteignables depuis l'accueil : ce sont
     les mêmes écrans qu'ailleurs, ouverts par les mêmes fonctions, et leur
     retour rend la main à l'accueil tant qu'aucun programme n'a été enregistré.
     `saveDraft` et `loadProgram` lèvent `welcome` eux-mêmes — un programme
     existe, il n'y a plus rien à accueillir. */
  if (welcome && screen !== "generateur" && screen !== "editeur") {
    return (
      <div className="min-h-screen bg-surface text-ink" style={{ fontVariantNumeric: "tabular-nums" }}>
        <Welcome
          onGenerate={() => setNav({ screen: "generateur", sessionId: null })}
          onCompose={() => openEditor(emptyDraft(today))}
          onLoadFile={() => fileInputRef.current && fileInputRef.current.click()}
          /* Retenir le programme fourni est un choix, pas un défaut : c'est le
             seul geste qui le fait entrer dans le journal, et il est explicite. */
          onPreview={() => setWelcome(false)}
          error={programError}
        />
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleProgramFile} className="hidden" />
      </div>
    );
  }


  /* ---------- L'index de l'onglet Plan (revue Claude Design, 1c) ----------

     Le Plan était huit accordéons sur une page, plus deux sections d'écran.
     Il devient un index : une ligne par sujet, une page par sujet. Le triage
     du 2026-09-17 dit pourquoi ce n'est pas la navigation qui porte l'idée,
     mais le **sous-titre** — chaque ligne mesure le programme actif, elle ne
     l'aguiche pas. « 11 groupes · 7 séries max » ne peut pas être vague là où
     un paragraphe le pouvait.

     D'où l'ordre dans lequel ces trois choses ont été faites : #34 d'abord,
     parce qu'un compte sous la ligne Cardio aurait compté les séances de
     Simon sous n'importe quel programme.

     Le groupement n'est pas une invention de mise en page : c'est la ligne que
     #25 et #26 ont tracée entre méthode bundlée et donnée de programme, et que
     l'en-tête de plan.js annote déjà section par section. L'écran l'aplatissait.

     Les deux dernières entrées ne viennent pas de plan.js : elles sont de
     l'écran (des boutons, des fichiers), pas du contenu. Elles prennent leur
     place dans le même index parce que le lecteur, lui, ne fait pas la
     différence. */
  const planTopics = [
    ...plan.map((s) => ({ id: s.id, title: s.title, group: s.group, meta: s.meta })),
    {
      id: "programme",
      title: "Programme",
      group: "programme",
      /* Le compte qui compte ici est l'avis : `assess()` est déjà calculé (#57),
         et « 3 points à regarder » est ce qu'on vient vérifier. Le nom du
         programme n'est pas répété — la carte en tête de l'index le porte.

         #68 : le nombre de cycles s'y ajoute dès qu'il y en a plusieurs, parce
         que la page n'est plus seulement l'avis sur l'actif — c'est de là qu'on
         change de programme. À un seul cycle la mention n'apprendrait rien. */
      meta: [
        programRows.length > 1 ? `${programRows.length} programmes` : null,
        advice.findings.length ? adviceSummary(advice.findings.length) : "Rien à signaler sur ce programme",
      ].filter(Boolean).join(" · "),
    },
    {
      id: "donnees",
      title: "Données : sauvegarde et restauration",
      group: "appareil",
      meta: `${lastExport ? `Export ${dateLabel(parseLocalDate(lastExport))}` : "Jamais exporté"} · ${persisted === true ? "stockage persistant" : persisted === false ? "stockage non persistant" : "persistance inconnue"}`,
    },
  ];
  const planPage = planTopics.find((t) => t.id === planTopic) || null;
  return (
    <div className="min-h-screen bg-surface text-ink" style={{ fontVariantNumeric: "tabular-nums" }}>
      <div className="max-w-md mx-auto pb-24">
        {/* #41 : un en-tête par écran, plus un en-tête pour tout le monde.
            C'est la bascule dont tout le reste découle — les flèches de semaine
            n'avaient de sens au-dessus de Séance que parce qu'on pouvait y
            arriver sans avoir choisi.
            #83 : la même logique, poussée au bout. La liste d'exclusion laissait
            passer le Plan et le générateur, où les flèches changeaient une
            semaine que rien sur la page ne lit — et s'empilaient au-dessus de
            leur propre en-tête collant. L'en-tête de semaine appartient à
            Semaine ; les autres écrans portent le leur. */}
        {screen === "semaine" && (
          <div className="sticky top-0 z-10 bg-surface border-b border-rule px-4 pt-3 pb-2">
            <div className="flex items-center justify-between">
              <button onClick={() => setWeek(Math.max(1, week - 1))} aria-label="Semaine précédente" className="h-11 w-11 rounded-md bg-surface-raised border border-rule inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-focus"><ChevronLeft size={18} /></button>
              <div className="text-center">
                <div className="text-lg font-semibold">Semaine {week} <span className="text-ink-muted font-normal">sur {definition.weeks}</span></div>
                <div className="text-xs text-ink-muted">{weekRange(START, week)} — {phase.label}, RIR {phase.rir}</div>
              </div>
              <button onClick={() => setWeek(Math.min(definition.weeks, week + 1))} aria-label="Semaine suivante" className="h-11 w-11 rounded-md bg-surface-raised border border-rule inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-focus"><ChevronRight size={18} /></button>
            </div>
          </div>
        )}

        {screen === "seance" && (
          <div className="sticky top-0 z-10 bg-surface border-b border-rule px-4 pt-3 pb-2">
            {/* Ce que l'en-tête partagé et le rail disaient à eux deux, en deux
                lignes : quelle séance, quelle semaine, quel jour. */}
            <div className="text-xl font-semibold leading-tight">{session.name}</div>
            <div className="text-sm text-ink-muted mt-0.5">Semaine {week} · {dayName(session.day)} {dateLabel(parseLocalDate(dateOf(session.id)))} · {session.sub}</div>
            {timer && (
              <div className={`mt-2 flex items-center justify-between rounded-md px-3 h-11 ${remaining === 0 ? "bg-accent text-ink-inverse" : "bg-surface-raised border border-rule"}`}>
                <span className="text-sm truncate">{remaining === 0 ? "Repos terminé, à toi" : `Repos — ${timer.label}`}</span>
                <span className="text-xl font-semibold">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</span>
                <button onClick={() => setTimer(null)} aria-label="Arrêter le repos" className="ml-2 focus:outline-none"><X size={18} /></button>
              </div>
            )}
          </div>
        )}

        {loadError && <p role="alert" className="mx-4 mt-3 text-sm text-alert">{loadError}</p>}

        {/* #15 : rendu ici, hors de tout onglet, pour la même raison que
            loadError — un rappel qu'on ne voit qu'en allant dans le panneau
            d'export ne sert à rien, puisque quelqu'un qui n'a pas exporté
            depuis un mois n'y va pas. Masquable pour la session : le voir
            revenir au lancement suivant est le comportement correct. */}
        {!loadError && exportStale && !exportWarnDismissed && (
          <div className="mx-4 mt-3 flex items-start justify-between gap-3 rounded-md border border-rule bg-surface-raised p-3">
            <p className="text-sm text-notice">
              {lastExport
                ? `Dernier export il y a ${daysBetween(lastExport, todayIso)} jours. Télécharge une copie du journal : onglet Plan, section Données.`
                : "Aucune copie de ce journal n'a jamais quitté cet appareil. Télécharge-la : onglet Plan, section Données."}
            </p>
            <button onClick={() => setExportWarnDismissed(true)} aria-label="Masquer ce rappel" className="shrink-0 h-11 w-11 -my-1 -mr-1 inline-flex items-center justify-center text-ink-muted rounded focus:outline-none focus:ring-2 focus:ring-focus">
              <X size={18} />
            </button>
          </div>
        )}

        {screen === "seance" && (
          /* #66 : la barre d'action est fixe, donc le contenu lui réserve sa
             place — sans quoi les notes de séance finiraient dessous. Le
             panneau de #43 est plus haut que le bouton qu'il remplace, d'où
             les deux valeurs : la réserve suit ce que la barre porte. */
          <div className={`px-4 ${pendingLight ? "pb-64" : "pb-16"}`}>
            {/* #55 Q3 = C : le registre entier, avec les facettes du créneau
                déjà cochées — mouvement, et depuis #64 le muscle dominant :
                « une autre poussée horizontale pour les pectoraux » à zéro
                tap, et décocher rend les 73 entrées. Les exercices que les
                autres créneaux de la séance tiennent déjà sont inertes : `ex`
                étant indexé par exercice, deux créneaux sur le même identifiant
                mélangeraient leurs séries sans rien pour les redémêler. */}
            {subSlot && (
              <ExercisePicker
                onChoose={(vid) => substitute(subSlot, vid)}
                onClose={() => setSubSlot(null)}
                initialFacets={facetsOf(prog.V[vidFor(prog, log, subSlot, week)])}
                disabledIds={takenVids(prog, log, slotIdsOf(prog, session), week, subSlot)}
              />
            )}
            {!storageOk && !loadError && <p className="text-sm text-notice mt-3">Stockage indisponible ici : les saisies ne survivront pas à la fermeture. Télécharge le journal (onglet Plan) en fin de séance.</p>}

            {/* #41 : le rail de chips est parti. Il faisait doublon avec la
                liste de Semaine — qui dit la même chose avec plus
                d'information — et n'existait que parce qu'on pouvait atterrir
                ici sans avoir choisi. La ligne « Aujourd'hui, … » et le titre
                dupliqué partent avec lui : l'en-tête les dit déjà. */}
            <div>
              <div>
                <div className="pt-3 pb-2">
                  <div className="text-sm text-ink-muted">{setsFor(session.ex.reduce((a, [, n]) => a + n, 0), week, policies)} séries dures + abdos. {PHASE_NOTES[phase.id]}</div>
                  {log.done && <div className="mt-2 text-sm text-done inline-flex items-center gap-1"><Check size={15} />Validée le {log.updatedAt && log.updatedAt.slice(0, 10)}. <button onClick={reopen} className="underline text-ink-soft ml-1 focus:outline-none">Rouvrir</button></div>}
                </div>
                <Section title="Échauffement">{prog.WARM[session.warm]}</Section>
                {session.ex.map(([slotId, n], i) => (
                  <ExerciseCard key={slotId + week} idx={i + 1} slotId={slotId} nSets={n} week={week} weeks={definition.weeks} si={si} date={dateOf(session.id)} prog={prog} policies={policies} state={state}
                    vid={vidFor(prog, log, slotId, week)} substituted={isSubstituted(prog, log, slotId, week)} isTest={log.kind === "test"}
                    open={openSlot === slotId} onToggle={() => toggleEx(slotId)}
                    rows={(log.ex && log.ex[vidFor(prog, log, slotId, week)]) || []} onSet={onSet} onOpen={openExercise} onSubstitute={setSubSlot} onTimer={startRest} />
                ))}
                <div className="pt-4 text-sm text-ink-muted">{prog.CORE[session.core].label}</div>
                {prog.CORE[session.core].ex.map(([slotId, n], i) => (
                  <ExerciseCard key={slotId + week} idx={session.ex.length + i + 1} slotId={slotId} nSets={n} week={week} weeks={definition.weeks} si={si} date={dateOf(session.id)} prog={prog} policies={policies} state={state}
                    vid={vidFor(prog, log, slotId, week)} substituted={isSubstituted(prog, log, slotId, week)} isTest={log.kind === "test"}
                    open={openSlot === slotId} onToggle={() => toggleEx(slotId)}
                    rows={(log.ex && log.ex[vidFor(prog, log, slotId, week)]) || []} onSet={onSet} onOpen={openExercise} onSubstitute={setSubSlot} onTimer={startRest} />
                ))}
                {session.after && cardio && (
                  <p className="text-sm text-ink-muted mt-3">
                    Après la séance : {AFTER_HINTS[session.after](cardio)}
                  </p>
                )}
                <label className="block mt-4">
                  <span className="text-xs text-ink-muted">Notes de séance (douleur 0–10, forme, remarques)</span>
                  <textarea value={log.notes || ""} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Remontées dans le bilan de la semaine." className="mt-1 w-full p-3 rounded-md bg-surface-raised border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-focus" />
                </label>
              </div>
            </div>
            {/* #66 : l'action ne se mérite plus au bout du scroll. L'en-tête
                était collant depuis #41 et l'action ne l'était pas : l'écran
                gardait sa navigation sous les yeux et laissait filer la seule
                chose qu'on vient y faire. Elle tient au-dessus de la barre
                d'onglets, qui fait 56 px — d'où `bottom-14`.

                Le panneau de #43 vit **dans** cette barre plutôt qu'en dessous
                d'elle : c'est la même décision au même moment, et deux couches
                qui se disputent le bas de l'écran feraient exactement ce que
                cette issue corrige. Le panneau remplace le bouton, comme avant,
                seul l'endroit change. */}
            <div className="fixed left-0 right-0 bottom-14 z-10 bg-surface border-t border-rule">
              <div className="max-w-md mx-auto px-4 py-2">
                {/* #43 : le panneau remplace le bouton — une seule décision, un
                    seul moment. Les deux boutons valident, ils ne diffèrent que
                    par ce qu'ils font à la référence, donc chacun dit son effet
                    au lieu d'un OK/Annuler à décoder. Aucun des deux n'est en
                    ambre : un choix sans bonne réponse ne doit pas porter de
                    défaut qui attire le pouce. Même motif que la confirmation
                    d'import, plus bas. */}
                {pendingLight ? (
                  <div className="rounded-md border border-rule bg-surface-raised p-3 space-y-2">
                    <p className="text-sm text-ink font-medium">Séance plus légère que la précédente</p>
                    {pendingLight.map((d) => (
                      <p key={d.vid} className="text-sm text-ink-muted">
                        {d.name} : <span className="text-ink">{loadText(d.v, d.load)}</span> au lieu de <span className="text-ink">{loadText(d.v, d.baseLoad)}</span>.
                      </p>
                    ))}
                    <p className="text-sm text-ink-muted">
                      {pendingLight.length === 1
                        ? <>Si c'était volontaire, ta charge de référence ne bouge pas : la prochaine séance repartira de <span className="text-ink">{loadText(pendingLight[0].v, pendingLight[0].baseLoad)}</span>.</>
                        : "Si c'était volontaire, tes charges de référence ne bougent pas : la prochaine séance repartira d'où tu en étais."}
                    </p>
                    <div className="flex flex-col gap-2 pt-0.5">
                      <Btn onClick={() => validate(true)}><Check size={18} />Valider, séance allégée</Btn>
                      <Btn onClick={() => validate(false)}><Check size={18} />Valider, c'est ma nouvelle référence</Btn>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 flex-wrap">
                    <Btn primary onClick={askThenValidate}><Check size={18} />{log.done ? "Mettre à jour la séance" : "Valider la séance"}</Btn>
                    {/* #14 : le repère qu'on prend quand on décide de le prendre.
                        Il remplace l'AMRAP automatique de la dernière semaine —
                        un compte à rebours de calendrier que cette issue
                        supprime. Déclaré *avant* la séance, contrairement à
                        « allégée » qui se constate après : on ne pousse une
                        dernière série à l'échec que si on l'a voulu. */}
                    {!log.done && (
                      <Btn small onClick={toggleTest}>
                        <Zap size={15} />{log.kind === "test" ? "Séance test — annuler" : "Séance test"}
                      </Btn>
                    )}
                    <span className="text-xs text-ink-faint">{saveStatus}</span>
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

        {/* #58 : la collecte ne possède rien de stocké et ne passe la main
            qu'à l'éditeur — c'est lui, et lui seul, qui écrit. */}
        {screen === "generateur" && (
          <GenerateProgram today={today} onBack={goPlan} onAccept={(def) => openEditor(draftFrom(def))} />
        )}

        {screen === "editeur" && editor && (
          <>
            <ProgramEditor draft={editor} onChange={setEditor} onBack={() => askLeave(goPlan)} onSave={saveDraft} error={editorError} />
            {pendingLeave && (
              <div className="fixed left-0 right-0 bottom-14 z-20 bg-surface border-t border-rule">
                <div className="max-w-md mx-auto p-3 space-y-2">
                  <p className="text-sm text-ink-muted">Ce programme n'a pas été enregistré. Le quitter maintenant le perd.</p>
                  <div className="flex gap-2 flex-wrap">
                    <Btn small onClick={() => pendingLeave()}>Quitter sans enregistrer</Btn>
                    <Btn small primary onClick={() => setPendingLeave(null)}>Continuer l'édition</Btn>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {screen === "semaine" && (
          <div className="px-4">
            {cycleNote && <p className="text-sm text-notice mt-3">{cycleNote}</p>}
            {/* #14 : recommander, jamais imposer. L'avis nomme ce sur quoi il
                se fonde — une recommandation qu'on ne peut pas contester n'est
                pas discutable, elle est subie — et les deux réponses sont
                enregistrées, ce qui donnera de vraies données pour régler les
                seuils au lieu de les deviner. */}
            {deloadAdvice && deloadAdvice.recommended && !deloadChoice && (
              <div className="mt-3 p-3 rounded-lg bg-surface-raised border border-rule">
                <p className="text-sm text-ink">Une semaine de décharge se justifierait.</p>
                <ul className="mt-1 text-sm text-ink-muted list-disc pl-4 space-y-0.5">
                  {deloadAdvice.reasons.map((r) => <li key={r}>{r}</li>)}
                </ul>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <Btn small onClick={() => answerDeload("accepted")}>Décharger cette semaine</Btn>
                  <Btn small onClick={() => answerDeload("postponed")}>Pas maintenant</Btn>
                </div>
              </div>
            )}
            {deloadChoice === "accepted" && (
              <p className="text-sm text-notice mt-3">Semaine de décharge : volume et charges réduits, 3–4 RIR.</p>
            )}
            <p className="text-sm text-ink-soft mt-3">{PHASE_NOTES[phase.id]}</p>
            {/* #41 : le compte remplace le badge que portait la barre du bas.
                Il monte ici parce que Semaine devient l'écran d'accueil : ce
                qu'on vient y chercher, c'est où on en est. */}
            <div className="mt-5 flex items-baseline justify-between gap-3">
              <span className="text-sm text-ink-muted">Séances de la semaine</span>
              <span className={`text-sm ${weekDoneCount === prog.SESSIONS.length ? "text-done" : "text-ink-muted"}`}>{weekDoneCount} sur {prog.SESSIONS.length} validées</span>
            </div>
            <div className="mt-2 divide-y divide-rule border-y border-rule">
              {prog.SESSIONS.map((s) => {
                const l = findLog(state.logs, dateOf(s.id), s.id);
                /* Le résumé de la ligne est le premier exercice de la séance —
                   et une séance sans exercice n'en a pas. Le validateur refuse
                   cette forme aux deux portes depuis #36, mais la lecture reste
                   prudente : `s.ex[0][0]` sur une séance vide levait pendant le
                   *rendu*, et un jeté au rendu ne laisse pas un écran en erreur,
                   il démonte l'appli entière — écran blanc, et le journal en
                   mémoire perdu avant que l'autosave n'ait pu l'écrire. */
                const keySlot = s.ex[0]?.[0];
                /* #55 : le sixième site, et le seul que la Séance ne montre
                   pas. Lu sur l'exercice prescrit, le résumé d'une séance
                   substituée serait vide — les séries existent, sous un autre
                   identifiant — et la ligne se lirait « pas fait ». C'est le
                   même défaut que celui corrigé dans le bilan (Q2), à un écran
                   près. `vidFor` retombe sur le prescrit quand il n'y a pas de
                   substitution, donc la lecture prudente de #36 est intacte. */
                const vid = keySlot ? vidFor(prog, l, keySlot, week) : undefined;
                const sets = normalizeSets(vid && l && l.ex ? l.ex[vid] : null);
                /* #41 : ce repère fait le travail de l'effet d'auto-sélection
                   qu'on supprime — dire quelle séance est celle du jour — sans
                   choisir à la place de l'utilisateur. Seulement sur la semaine
                   en cours : « aujourd'hui » n'a pas de sens en S7 quand on
                   feuillette une semaine passée. */
                /* #39 : la contradiction de fond est levée — `todayDay` est
                   le même décalage depuis startDate que `s.day`, donc la
                   comparaison porte sur deux grandeurs de même nature. Un
                   programme qui part un mercredi allume la bonne pastille, et
                   le dimanche (jour 7) devient un jour comme les six autres.
                   Hors du cycle `todayDay` vaut null, qui n'égale aucun jour. */
                const isToday = week === curWeek && s.day === todayDay;
                return (
                  <button key={s.id} onClick={() => openSession(s.id)} className="w-full py-3 flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-focus rounded">
                    <div>
                      <div className="font-medium inline-flex items-center gap-2 flex-wrap">
                        {l && l.done ? <Check size={16} className="text-done" /> : <span className="w-4 h-4 rounded-full border border-rule-strong inline-block" />}{s.name} <span className="text-ink-muted font-normal text-sm">{dayName(s.day)}</span>
                        {isToday && <span className="rounded-full px-2 py-0.5 text-xs bg-accent text-ink-inverse font-medium">aujourd'hui</span>}
                      </div>
                      <div className="text-sm text-ink-muted pl-6">{prog.V[vid] ? `${prog.V[vid].name} : ${sets.length ? setSummary(sets, prog.V[vid]) : "—"}` : "Aucun exercice"}</div>
                    </div>
                    <ChevronRight size={16} className="text-ink-faint" />
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
                <div className="text-sm text-ink-muted">Cardio et mobilité</div>
                <div className="mt-2">
                  <CardioView prog={prog} week={week} cardio={cardio} ca={ca} setCardio={setCardio} toggleMob={toggleMob} compact />
                </div>
              </div>
            )}

            {/* #41 : le bilan est une chose de la semaine, il vit donc dans la
                semaine — replié, avec son état lisible sans déplier. Réutilise
                le <Section> de l'onglet Plan plutôt que d'inventer un second
                accordéon. */}
            <div className="mt-5 border-t border-rule">
              <Section title={<>Bilan de la semaine <span className={bilanFilled === 0 ? "font-normal text-notice" : bilanFilled === BILAN_FIELDS ? "font-normal text-done" : "font-normal text-ink-muted"}>· {bilanFilled === 0 ? "à remplir" : bilanFilled === BILAN_FIELDS ? "complet" : `${bilanFilled} sur ${BILAN_FIELDS}`}</span></>}>
                <p>À remplir le dimanche, puis à envoyer dans le chat. Séances, exos clés et notes de séance sont repris automatiquement. Indispensable à saisir : poids et RIR. Le reste est optionnel.</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Poids moyen 7 pesées (kg)" value={ci.poids} onChange={(v) => setCheck("poids", v)} type="number" />
                  <Field label="Tour de taille au nombril (cm)" value={ci.taille} onChange={(v) => setCheck("taille", v)} type="number" />
                  <Field label="Sommeil moyen (h)" value={ci.sommeil} onChange={(v) => setCheck("sommeil", v)} type="number" />
                  {/* #14 : la qualité, pas la durée. Les deux sont utiles et ne
                      disent pas la même chose — sept heures hachées ne valent
                      pas sept heures pleines — et c'est la qualité que le
                      score de décharge lit. Le champ existant reste : le bilan
                      hebdomadaire l'affiche depuis la v1. */}
                  <Field label="Qualité du sommeil (1–5)" value={ci.sommeilScore} onChange={(v) => setCheck("sommeilScore", v)} type="number" />
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
                  <span className="text-xs text-ink-faint">{bilanStatus}</span>
                </div>
              </Section>
            </div>
          </div>
        )}

        {screen === "plan" && (
          planPage ? (
            <PlanPage title={planPage.title} onBack={() => setPlanTopic(null)}>
              {planPage.id === "programme" ? (
                <>
                  <p>{definition.name} — départ {dateLabel(START)}</p>
                  {/* Avant le reste : un avis sur le programme actif se lit
                      pendant qu'on sait encore de quel programme on parle. */}
                  <ProgramAdvice findings={advice.findings} />

                  {/* #68 : la liste des cycles était une rangée de pastilles
                      identiques, apparue seulement au-delà de deux cycles, et
                      posée juste sous quatre boutons de création du même
                      dessin. Quatre verbes qui font des choses différentes se
                      ressemblaient, et « lequel est actif » tenait à un style.

                      Une ligne par cycle, ce qu'il porte écrit dessus, et les
                      deux intentions séparées : changer de cycle est une liste,
                      en créer un est une porte. Affichée même à un seul cycle :
                      « mes programmes » est la réponse à une question qu'on se
                      pose avant de savoir combien il y en a. */}
                  <div className="text-xs uppercase tracking-wider text-ink-muted pt-1">Mes programmes</div>
                  <div className="-mt-1">
                    {programRows.map((row) => (
                      <div key={row.id} className="py-3 border-b border-rule flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium truncate ${row.active ? "text-ink" : "text-ink-soft"}`}>{row.name}</span>
                            {row.active && <span className="shrink-0 text-xs text-ink-muted border border-rule rounded-full px-2 py-0.5">actif</span>}
                          </div>
                          <div className="text-sm text-ink-muted mt-0.5">{programMeta(row)}</div>
                          {!row.usable && (
                            <div className="text-sm text-notice mt-0.5">
                              Pas exécutable par cette version. Il reste dans le journal et dans l'export.
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {!row.active && row.usable && (
                            <Btn small onClick={() => setJournal((j) => ({ ...j, activeProgramId: row.id }))}>Activer</Btn>
                          )}
                          {/* #68 : un cycle ne se supprime que s'il n'a rien
                              produit — la règle est tenue par `removeProgram`,
                              ce bouton ne fait que ne pas proposer l'impossible.
                              Un cycle qui porte des séances est de l'histoire :
                              la fiche exercice la lit à travers tous les cycles
                              et rien ne la reconstruirait. */}
                          {row.removable && (
                            <button onClick={() => setPendingDelete(row.id)} aria-label={`Supprimer ${row.name}`}
                              className="h-9 w-9 inline-flex items-center justify-center rounded-md bg-surface-raised border border-rule text-ink-muted focus:outline-none focus:ring-2 focus:ring-focus">
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Même panneau à deux boutons que l'import (#11) : la question
                      se lit dans l'appli, et le bouton qui détruit n'est pas
                      celui qu'on touche par réflexe. */}
                  {pendingDelete && (
                    <div className="rounded-md border border-rule bg-surface-raised p-3 space-y-2">
                      <p className="text-sm text-ink font-medium">Supprimer ce programme ?</p>
                      <p className="text-sm text-ink-muted">
                        {(journal.programs[pendingDelete]?.definition?.name) || pendingDelete} n'a aucune séance enregistrée : il ne reste rien de lui après.
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <Btn small onClick={() => { const next = removeProgram(journal, pendingDelete); setPendingDelete(null); if (next) { setJournal(next); showToast("Programme supprimé."); } }}>Supprimer</Btn>
                        <Btn small onClick={() => setPendingDelete(null)}>Annuler</Btn>
                      </div>
                    </div>
                  )}

                  {/* #68 : une seule porte, qui demande ensuite comment — au
                      lieu de quatre boutons de même poids. Les trois premières
                      sont mot pour mot celles de l'accueil (#19) : la question
                      est la même, elle se présente pareil. */}
                  {newProgram ? (
                    <div className="grid gap-3">
                      <Route primary icon={<Sparkles size={18} />} onClick={() => { setNewProgram(false); setNav({ screen: "generateur", sessionId: null }); }}
                        title="Générer mon programme"
                        note="Cinq questions — jours, durée, matériel, niveau, objectif — et l'appli compose." />
                      <Route icon={<PenLine size={18} />} onClick={() => { setNewProgram(false); openEditor(emptyDraft(today)); }}
                        title="Composer le mien"
                        note="Séance par séance, dans le catalogue d'exercices de l'appli." />
                      <Route icon={<Upload size={18} />} onClick={() => { setNewProgram(false); fileInputRef.current.click(); }}
                        title="Charger un fichier"
                        note="Un programme déjà écrit, au format de l'appli." />
                      {/* #36 : « Partir du programme actif » et non « Modifier » —
                          tant que l'édition en place n'existe pas (étape 8), ce
                          bouton compose un nouveau cycle à partir de celui-ci, et un
                          nouveau cycle repart sur la calibration. */}
                      <Route icon={<Copy size={18} />} onClick={() => { setNewProgram(false); openEditor(draftFrom(definition)); }}
                        title="Partir du programme actif"
                        note={`Une copie de ${definition.name} à retoucher. Le cycle en cours n'est pas modifié.`} />
                      <Btn small onClick={() => setNewProgram(false)}>Annuler</Btn>
                    </div>
                  ) : (
                    <Btn primary onClick={() => setNewProgram(true)}><Plus size={16} />Nouveau programme</Btn>
                  )}
                  <input ref={fileInputRef} type="file" accept="application/json" onChange={handleProgramFile} className="hidden" />
                  {programError && <p role="alert" className="text-sm text-alert">{programError}</p>}
                </>
              ) : planPage.id === "donnees" ? (
                <>
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
                  <p className="text-xs text-ink-muted">{lastExport ? `Dernier export : ${dateLabel(parseLocalDate(lastExport))}.` : "Aucun export enregistré sur cet appareil."}</p>
                  {/* #15 : dire ce que le navigateur a répondu, en clair. Un
                      stockage « éligible à l'éviction » est la raison d'être de
                      tout ce panneau — la nommer vaut mieux que la sous-entendre. */}
                  <p className="text-xs text-ink-muted">
                    {persisted === true
                      ? "Le navigateur a marqué ce stockage comme persistant : il ne sera pas vidé pour faire de la place."
                      : persisted === false
                        ? "Le navigateur n'a pas accordé de stockage persistant : il peut vider ces données pour faire de la place. Le fichier reste la vraie sauvegarde."
                        : "Ce navigateur ne dit pas si le stockage est persistant."}
                  </p>
                  {exportStatus && <p className="text-xs text-ink-soft">{exportStatus}</p>}
                  {importError && <p role="alert" className="text-sm text-alert">{importError}</p>}
                  {pendingImport && (
                    <div className="rounded-md border border-rule bg-surface-raised p-3 space-y-2">
                      <p className="text-sm text-ink">{pendingImport.name}</p>
                      <p className="text-sm text-ink-muted">Remplacera le journal de cet appareil. Une copie de l'actuel est enregistrée avant, et reste téléchargeable ci-dessous.</p>
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
                </>
              ) : (
                (plan.find((s) => s.id === planPage.id) || { blocks: [] }).blocks.map((b, i) => <Block key={i} block={b} />)
              )}
            </PlanPage>
          ) : (
            <>
            {/* #83 : l'index perd l'en-tête de semaine et gagne le sien, du même
                dessin que celui de PlanPage — un titre, sans flèches. La
                semaine reste dite, sur la carte du programme actif. */}
            <div className="sticky top-0 z-10 bg-surface border-b border-rule px-4 pt-3 pb-2">
              <div className="text-xl font-semibold leading-tight">Plan</div>
            </div>
            <div className="px-4">
              <p className="text-sm text-ink-soft mt-3">{PLAN_INTRO}</p>
              {/* De quel programme cette référence parle, dit une fois en haut
                  plutôt que sous-entendu par chaque ligne. C'est la question
                  que #34 a passé une issue entière à rendre répondable : avant
                  lui, l'écran décrivait parfois un autre programme que celui
                  qui tourne. */}
              <div className="mt-3 rounded-md border border-rule bg-surface-raised px-3 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{definition.name}</div>
                  <div className="text-sm text-ink-muted">Semaine {week} sur {definition.weeks} · {phase.label}</div>
                </div>
                <span className="shrink-0 text-xs text-ink-muted border border-rule rounded-full px-2 py-0.5">actif</span>
              </div>
              <PlanIndex topics={planTopics} onOpen={setPlanTopic} />
            </div>
            </>
          )
        )}

        {toast && <div className="fixed left-1/2 -translate-x-1/2 bottom-20 bg-accent text-ink-inverse px-4 py-2 rounded-md text-sm font-medium shadow-none">{toast}</div>}

        {/* Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-rule">
          {/* #41 : le badge de progression est parti avec cet onglet — il vit
              maintenant en tête de la liste des séances, sur l'écran où l'on
              atterrit et où l'on venait le lire. */}
          {/* #41 : deux entrées. Séance n'en est plus une — on l'ouvre depuis
              Semaine, et « Semaine » reste en ambre pendant qu'elle est
              ouverte : c'est à la fois où l'on est dans la hiérarchie et où
              l'on retourne. C'est ce qui permet à Séance de n'avoir aucune
              flèche de retour. */}
          <div className="max-w-md mx-auto grid grid-cols-2">
            {/* #36 : l'éditeur s'ouvre depuis Plan et y retourne — c'est donc
                Plan qui reste allumé pendant qu'on édite, comme Semaine reste
                allumée pendant une séance. Les deux onglets passent par le
                garde-fou : quitter par le bas perd autant qu'en haut. */}
            <button onClick={guarded(goSemaine)} className={`h-14 text-sm focus:outline-none focus:ring-2 focus:ring-focus ${screen !== "plan" && screen !== "editeur" ? "text-accent font-medium" : "text-ink-muted"}`}>Semaine</button>
            <button onClick={guarded(goPlan)} className={`h-14 text-sm focus:outline-none focus:ring-2 focus:ring-focus ${screen === "plan" || screen === "editeur" ? "text-accent font-medium" : "text-ink-muted"}`}>Plan</button>
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
            <tr key={a} className="border-t border-rule"><td className="py-1.5 pr-3 text-ink-muted whitespace-nowrap align-top">{a}</td><td className="py-1.5">{b}</td></tr>
          ))}
        </tbody>
      </table>
    );
  if (block.t === "table" && block.variant === "volume")
    return (
      <table className="w-full text-sm">
        <tbody>
          {block.rows.map(([g, n, o]) => (
            <tr key={g} className="border-t border-rule"><td className="py-1.5 pr-2">{g}</td><td className="py-1.5 pr-2 text-accent text-right">{n}</td><td className="py-1.5 text-ink-muted">{o}</td></tr>
          ))}
        </tbody>
      </table>
    );
  return null;
}
/* ---------- Le Plan comme index (revue Claude Design, 1c) ----------

   Remplace l'accordéon de huit sections. Ce que l'accordéon savait faire et
   que ceci ne sait plus : ouvrir deux sujets à la fois pour les comparer.
   Ce qu'il ne savait pas faire : dire ce qu'il y a dedans sans l'ouvrir.

   Les intertitres sont la taxonomie que le code portait déjà sans la montrer
   — plan.js annote chaque section « toujours (méthode) » ou « tirée de la
   donnée ». Une règle qui vaut pour tout le monde et un fait sur le programme
   chargé ne se lisaient pas différemment ; maintenant si.

   Le sous-titre est un **compte**, pas une accroche : il dit la taille ou la
   forme de ce qu'il y a derrière. Sur les trois sujets de méthode c'est une
   constante — une référence a le droit de ne pas bouger — et ça se voit, ce
   qui est une information de plus et non un défaut à cacher. */
const PLAN_GROUPS = [
  ["methode", "La méthode"],
  ["programme", "Ce programme"],
  ["appareil", "Appareil"],
];

function PlanIndex({ topics, onOpen }) {
  return (
    <div className="pb-4">
      {PLAN_GROUPS.map(([group, label]) => {
        const rows = topics.filter((t) => t.group === group);
        if (!rows.length) return null;
        return (
          <div key={group} className="mt-5">
            <div className="text-xs uppercase tracking-wider text-ink-muted">{label}</div>
            <div className="mt-1">
              {rows.map((t) => (
                <button key={t.id} onClick={() => onOpen(t.id)}
                  className="w-full flex items-center gap-3 py-3.5 text-left border-b border-rule focus:outline-none focus:ring-2 focus:ring-focus rounded">
                  <span className="flex-1 min-w-0">
                    <span className="block text-ink">{t.title}</span>
                    {t.meta && <span className="block text-sm text-ink-muted mt-0.5">{t.meta}</span>}
                  </span>
                  <ChevronRight size={16} className="text-ink-faint shrink-0" />
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* Même en-tête que la fiche exercice (#17) : bouton de retour collant, titre
   en dessous. Le retour est en `text-ink-soft` et non en ambre — l'accent
   porte déjà trop de sens (triage du 2026-09-14, C2), et une flèche de retour
   n'est pas une donnée. */
function PlanPage({ title, onBack, children }) {
  return (
    <>
      <div className="sticky top-0 z-10 bg-surface border-b border-rule px-4 pt-1 pb-2">
        <button onClick={onBack} className="h-11 -ml-2 px-2 inline-flex items-center gap-1 text-sm text-ink-soft focus:outline-none focus:ring-2 focus:ring-focus rounded">
          <ChevronLeft size={18} />Plan
        </button>
        <div className="text-xl font-semibold leading-tight">{title}</div>
      </div>
      <div className="px-4 pt-3 pb-6 text-sm text-ink-soft leading-relaxed space-y-2">{children}</div>
    </>
  );
}

function CardioView({ prog, week, cardio, ca, setCardio, toggleMob, compact }) {
  return (
    <div>
      {!compact && <div className="text-xl font-semibold pb-1">Cardio et mobilité, semaine {week}</div>}
      <div className="divide-y divide-rule border-y border-rule">
        {hasCardioItems(prog) && prog.CARDIO_ITEMS.map((it) => {
          /* #34 : le genre, plus l'identifiant. `it.id === "int"` était
             l'identifiant d'une séance du programme de Simon, en dur dans la
             vue : un programme qui appelait ses intervalles autrement voyait
             sa prescription Z2 affichée sous eux. */
          const plan = it.kind === "intervals" ? cardio.intervals : cardio.z2;
          const d = ca[it.id] || {};
          if (it.kind === "intervals" && !plan) return (
            <div key={it.id} className="py-3 text-sm text-ink-muted">Pas d'intervalles cette semaine (calibration, décharge ou bilan) : Z2 uniquement.</div>
          );
          return (
            <div key={it.id} className="py-3">
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={!!d.done} onChange={(e) => setCardio(it.id, "done", e.target.checked)} className="mt-1 h-5 w-5 accent-accent" />
                <div>
                  <div className="font-medium">{it.label} <span className="text-ink-muted font-normal text-sm">{cardioWhen(it, prog.SESSIONS)}</span></div>
                  <div className="text-sm text-ink-muted">{plan}</div>
                </div>
              </label>
              <div className="grid grid-cols-3 gap-2 mt-2 pl-8">
                {[["min", "min"], ["w", "W moyen"], ["hr", "bpm moyen"]].map(([f, l]) => (
                  <input key={f} inputMode="decimal" aria-label={`${it.label} ${l}`} placeholder={l} value={d[f] || ""} onChange={(e) => setCardio(it.id, f, e.target.value)} className="h-10 w-full text-center rounded-md bg-surface-raised border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-focus" />
                ))}
              </div>
            </div>
          );
        })}
        {hasMobilityDays(prog) && (
          <div className="py-3">
            {/* #34 : le « 3 » était écrit en dur, comme les trois jours. Les deux
                viennent de MOB_DAYS, qui porte des décalages de 1 à 7 (#39) — les
                cases restent indexées par **position**, donc les coches déjà
                enregistrées restent en face du même jour. */}
            <div className="font-medium">Mobilité, {prog.MOB_DAYS.length} fois par semaine</div>
            <div className="text-sm text-ink-muted">{cardio.mob}</div>
            <div className="flex gap-4 mt-2">
              {mobilityDayNames(prog.MOB_DAYS).map((name, i) => (
                <label key={name} className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={!!(ca.mob && ca.mob[i])} onChange={() => toggleMob(i)} className="h-5 w-5 accent-accent" />{name}</label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
