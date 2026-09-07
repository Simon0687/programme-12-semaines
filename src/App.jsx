import { useState, useEffect, useMemo, useRef } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Timer, Copy, Zap, X } from "lucide-react";
import { SCHEMA_VERSION, migrate } from "./schema.js";
import { V, SLOTS, SESSIONS, CORE, WARM, cardioPlan, CARDIO_ITEMS, MOB_DAYS } from "./program.js";
import { num, fmt, blockOf, phaseOf, setsFor, lastEntry, planned } from "./progression.js";

/* =========================================================
   Programme 12 semaines — Simon
   Départ lundi 7 septembre 2026. Données conservées via window.storage.
   ========================================================= */

const START = new Date(2026, 8, 7);
const KEY = "prog12_simon_v1";
const STORE = (() => {
  if (typeof window !== "undefined" && window.storage) return window.storage;
  try {
    const ls = window.localStorage; ls.getItem("__t");
    return {
      async get(k) { const v = ls.getItem(k); if (v == null) throw new Error("missing"); return { key: k, value: v }; },
      async set(k, v) { ls.setItem(k, v); return { key: k, value: v }; },
    };
  } catch (e) { return null; }
})();
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const DAYNAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/* Objet à écrire dans le stockage / l'export : schemaVersion frère de logs/cardio/checkin. */
const withVersion = (state) => ({ schemaVersion: SCHEMA_VERSION, logs: state.logs, cardio: state.cardio, checkin: state.checkin });
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dateLabel = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const weekRange = (w) => {
  const a = addDays(START, (w - 1) * 7), b = addDays(a, 6);
  return `${a.getDate()}${a.getMonth() === b.getMonth() ? "" : " " + MONTHS[a.getMonth()]} – ${dateLabel(b)}`;
};

/* ---------- Résumé des séries ---------- */
function setSummary(sets, v) {
  if (!sets || !sets.length) return "—";
  const unit = v.unit || "kg";
  const kg = Math.max(...sets.map((s) => (s.w == null ? 0 : s.w)));
  const reps = sets.map((s) => (s.r == null ? "?" : s.r)).join("/");
  const rir = [...new Set(sets.map((s) => (s.rir == null ? "?" : s.rir)))].join("-");
  const kgTxt = unit === "time" || unit === "reps" ? "" : unit === "bw" ? (kg > 0 ? `+${fmt(kg)} kg ` : "PDC ") : `${fmt(kg)} kg `;
  return `${kgTxt}${reps}${unit === "time" || unit === "carry" ? " s" : ""} @ ${rir} RIR`;
}

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
function ExerciseCard({ idx, slotId, nSets, week, si, state, rows, onSet, onTimer }) {
  const slot = SLOTS[slotId];
  const vid = slot[blockOf(week)];
  const v = V[vid];
  const unit = v.unit || "kg";
  const sets = setsFor(nSets, week);
  const plan = useMemo(() => planned(state, slotId, week, si), [state, slotId, week, si]);
  const last = useMemo(() => lastEntry(state, vid, week, si), [state, vid, week, si]);
  const [open, setOpen] = useState(false);
  const phase = phaseOf(week);
  const failOk = slot.fail && week >= 3 && week !== 7;
  const amrap = week === 12 && slot.key;
  const cols = unit === "time" ? ["s / côté", "RIR"] : unit === "reps" ? ["reps", "RIR"] : unit === "carry" ? ["kg", "s / côté", "RIR"] : unit === "bw" ? ["lest kg", "reps", "RIR"] : ["kg", "reps", "RIR"];
  const fields = unit === "time" || unit === "reps" ? ["r", "rir"] : ["w", "r", "rir"];
  const repLabel = unit === "time" || unit === "carry" ? `${slot.reps[0]}–${slot.reps[1]} s` : `${slot.reps[0]}–${slot.reps[1]} reps`;

  return (
    <div className="py-4 border-b border-slate-700">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-slate-100 leading-snug">{idx}. {v.name}</div>
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
      {last && <div className="text-sm text-slate-400">Dernière fois (S{last.week}, {last.session}) : {setSummary(last.sets, v)}</div>}

      <button onClick={() => setOpen(!open)} className="mt-1 text-sm text-slate-400 inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded">
        Technique <ChevronDown size={14} className={open ? "rotate-180" : ""} />
      </button>
      {open && <p className="text-sm text-slate-300 leading-relaxed mt-1">{v.cue}</p>}

      <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: fields.length === 3 ? "2rem 1fr 1fr 1fr" : "2rem 1fr 1fr" }}>
        <div />
        {cols.map((c) => <div key={c} className="text-xs text-slate-400 text-center">{c}</div>)}
        {Array.from({ length: sets }).map((_, i) => {
          const row = rows[i] || {};
          return [
            <div key={`n${i}`} className="text-sm text-slate-400 self-center">S{i + 1}</div>,
            ...fields.map((f) => (
              <input key={`${i}${f}`} inputMode="decimal" aria-label={`Série ${i + 1} ${f}`}
                value={row[f] == null ? "" : row[f]}
                placeholder={f === "w" && plan.load != null ? fmt(plan.load) : ""}
                onChange={(e) => onSet(vid, i, f, e.target.value)}
                className="h-11 w-full text-center rounded-md bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400" style={{ fontVariantNumeric: "tabular-nums" }} />
            )),
          ];
        })}
      </div>
    </div>
  );
}

/* ---------- Application ---------- */
export default function Programme() {
  const today = startOfDay(new Date());
  const dayIdx = Math.floor((today - START) / 86400000);
  const curWeek = Math.min(12, Math.max(1, Math.floor(dayIdx / 7) + 1));
  const weekday = today.getDay();

  const [state, setState] = useState({ logs: {}, cardio: {}, checkin: {} });
  const [loaded, setLoaded] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  const [saveStatus, setSaveStatus] = useState("");
  const [tab, setTab] = useState("seance");
  const [week, setWeek] = useState(curWeek);
  const [sessionId, setSessionId] = useState("hautA");
  const [timer, setTimer] = useState(null);
  const [, setTick] = useState(0);
  const [toast, setToast] = useState("");
  const [ioText, setIoText] = useState("");
  const skipSave = useRef(true);

  useEffect(() => {
    (async () => {
      try {
        if (!STORE) { setStorageOk(false); return; }
        const r = await STORE.get(KEY, false);
        if (r && r.value) {
          const res = migrate(JSON.parse(r.value));
          if (res.ok) {
            setState({ logs: res.data.logs || {}, cardio: res.data.cardio || {}, checkin: res.data.checkin || {} });
            if (res.migrated) {
              skipSave.current = false; // Q2 : réécrire la forme migrée dès ce chargement
              showToast("Journal mis à jour vers le nouveau format.");
            }
          } else {
            // Q1 : journal écrit par une version plus récente — ne rien charger,
            // et le garde-fou de la sauvegarde empêche de l'écraser.
            setStorageOk(false);
            showToast("Ce journal vient d'une version plus récente de l'appli. Mets l'appli à jour.");
          }
        }
      } catch (e) { /* première utilisation : clé absente */ }
      finally { setLoaded(true); }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (!storageOk) return; // Q1 : stockage indisponible ou journal trop récent — ne pas écraser
    if (skipSave.current) { skipSave.current = false; return; }
    const t = setTimeout(async () => {
      try {
        if (!STORE) throw new Error("no storage");
        const r = await STORE.set(KEY, JSON.stringify(withVersion(state)), false);
        setSaveStatus(r ? "Enregistré" : "Enregistrement échoué");
      } catch (e) { setStorageOk(false); setSaveStatus("Non enregistré"); }
    }, 600);
    return () => clearTimeout(t);
  }, [state, loaded, storageOk]);

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
    SESSIONS.forEach((s) => { m[s.id] = !!(state.logs[`w${week}_${s.id}`] && state.logs[`w${week}_${s.id}`].done); });
    return m;
  }, [state, week]);
  const weekDoneCount = useMemo(() => Object.values(doneMap).filter(Boolean).length, [doneMap]);

  useEffect(() => {
    const byDay = week === curWeek ? SESSIONS.find((s) => s.day === weekday) : null;
    if (byDay && !doneMap[byDay.id]) { setSessionId(byDay.id); return; }
    if (week === curWeek && (weekday === 0 || weekday === 4)) { setSessionId("cardio"); return; }
    const next = SESSIONS.find((s) => !doneMap[s.id]);
    setSessionId(next ? next.id : "cardio");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, loaded]);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 2500); };
  const wkey = (sid) => `w${week}_${sid}`;
  const phase = phaseOf(week);
  const session = SESSIONS.find((s) => s.id === sessionId);
  const si = SESSIONS.findIndex((s) => s.id === sessionId);
  const log = session ? state.logs[wkey(session.id)] || {} : {};

  const onSet = (vid, i, f, val) => {
    setState((st) => {
      const k = wkey(session.id);
      const cur = st.logs[k] || {};
      const ex = { ...(cur.ex || {}) };
      const rows = [...(ex[vid] || [])];
      while (rows.length <= i) rows.push({});
      rows[i] = { ...rows[i], [f]: val };
      ex[vid] = rows;
      return { ...st, logs: { ...st.logs, [k]: { ...cur, ex } } };
    });
  };
  const setNotes = (val) => setState((st) => { const k = wkey(session.id); return { ...st, logs: { ...st.logs, [k]: { ...(st.logs[k] || {}), notes: val } } }; });

  const validate = () => {
    setState((st) => {
      const k = wkey(session.id);
      const cur = st.logs[k] || {};
      const ex = { ...(cur.ex || {}) };
      const all = [...session.ex, ...CORE[session.core].ex];
      all.forEach(([slotId]) => {
        const vid = SLOTS[slotId][blockOf(week)];
        const p = planned(st, slotId, week, si);
        const rows = (ex[vid] || []).map((r) => (r.r && !r.w && p.load != null ? { ...r, w: String(p.load).replace(".", ",") } : r));
        if (rows.length) ex[vid] = rows;
      });
      return { ...st, logs: { ...st.logs, [k]: { ...cur, ex, done: true, date: new Date().toISOString().slice(0, 10) } } };
    });
    showToast(`${session.name} validée`);
  };
  const reopen = () => setState((st) => { const k = wkey(session.id); return { ...st, logs: { ...st.logs, [k]: { ...(st.logs[k] || {}), done: false } } }; });

  const setCardio = (id, f, val) => setState((st) => { const k = `w${week}`; const c = st.cardio[k] || {}; return { ...st, cardio: { ...st.cardio, [k]: { ...c, [id]: { ...(c[id] || {}), [f]: val } } } }; });
  const toggleMob = (i) => setState((st) => { const k = `w${week}`; const c = st.cardio[k] || {}; const m = [...(c.mob || [false, false, false])]; m[i] = !m[i]; return { ...st, cardio: { ...st.cardio, [k]: { ...c, mob: m } } }; });
  const setCheck = (f, val) => setState((st) => { const k = `w${week}`; return { ...st, checkin: { ...st.checkin, [k]: { ...(st.checkin[k] || {}), [f]: val } } }; });

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); showToast("Copié"); }
    catch (e) { setIoText(text); showToast("Sélectionne le texte ci-dessous pour le copier"); }
  };

  const bilanText = () => {
    const c = state.checkin[`w${week}`] || {};
    const ca = state.cardio[`w${week}`] || {};
    const done = SESSIONS.filter((s) => doneMap[s.id]);
    const missing = SESSIONS.filter((s) => !doneMap[s.id]).map((s) => s.name);
    const cardioLines = CARDIO_ITEMS.filter((it) => ca[it.id] && ca[it.id].done).map((it) => { const d = ca[it.id]; return `${it.label} ${d.min || "?"} min${d.w ? `, ${d.w} W` : ""}${d.hr ? `, ${d.hr} bpm` : ""}`; });
    const mob = (ca.mob || []).filter(Boolean).length;
    const keys = ["dc", "squat", "pull", "ohp", "hipthrust", "latraise"];
    const keyLines = keys.map((slotId) => {
      const vid = SLOTS[slotId][blockOf(week)];
      const sessionsW = SESSIONS.map((s) => state.logs[`w${week}_${s.id}`]).filter((l) => l && l.done && l.ex && l.ex[vid]);
      if (!sessionsW.length) return null;
      const sets = sessionsW.flatMap((l) => l.ex[vid]).map((x) => ({ w: num(x.w), r: num(x.r), rir: num(x.rir) })).filter((x) => x.r != null);
      if (!sets.length) return null;
      return `${V[vid].name} : ${setSummary(sets, V[vid])}`;
    }).filter(Boolean);
    return [
      `Bilan S${week} (${weekRange(week)}) — ${phase.label}`,
      `1. Poids moyen : ${c.poids || "?"} kg — tour de taille : ${c.taille || "?"} cm`,
      `2. Sommeil moyen : ${c.sommeil || "?"} h`,
      `3. Séances : ${done.length}/5${missing.length ? ` — manquées : ${missing.join(", ")}` : ""}`,
      `4. Cardio : ${cardioLines.length ? cardioLines.join(" ; ") : "aucun"} — mobilité ${mob}/3`,
      `5. Exos clés : ${keyLines.length ? keyLines.join(" ; ") : "aucune séance validée"}`,
      `6. Douleurs : ${c.douleurs || "aucune"} / RIR ressenti global : ${c.rir || "?"} / énergie : ${c.energie || "?"}/5`,
      `7. Nutrition : ${c.nutrition || "RAS"}`,
      `8. Remarques : ${c.remarques || "—"}`,
    ].join("\n");
  };

  const importData = () => {
    try {
      const parsed = JSON.parse(ioText);
      if (!parsed.logs) throw new Error("format");
      const res = migrate(parsed);
      if (!res.ok) {
        showToast("Ce fichier a été créé par une version plus récente de l'appli. Mets l'appli à jour, puis réimporte.");
        return;
      }
      setState({ logs: res.data.logs || {}, cardio: res.data.cardio || {}, checkin: res.data.checkin || {} });
      showToast(res.migrated ? "Journal mis à jour vers le nouveau format." : "Données importées");
    } catch (e) { showToast("JSON invalide"); }
  };

  const todayLine = (() => {
    if (dayIdx < 0) return `Le programme commence lundi ${dateLabel(START)}. Aujourd'hui : ${DAYNAMES[weekday]} ${dateLabel(today)}.`;
    if (dayIdx >= 84) return "Les 12 semaines sont terminées : bilan et programme suivant.";
    const s = SESSIONS.find((x) => x.day === weekday);
    const extra = weekday === 3 ? " puis rameur Z2" : weekday === 4 ? "rameur intervalles + mobilité" : weekday === 0 ? "rameur Z2 + mobilité" : weekday === 2 ? " puis mobilité" : "";
    return `Aujourd'hui, ${DAYNAMES[weekday]} ${dateLabel(today)} : ${s ? `${s.name} (${s.sub})${extra}` : extra}.`;
  })();

  const cardio = cardioPlan(week);
  const ca = state.cardio[`w${week}`] || {};
  const ci = state.checkin[`w${week}`] || {};

  if (!loaded) return <div className="min-h-screen bg-slate-900 text-slate-400 flex items-center justify-center">Chargement du journal…</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100" style={{ fontVariantNumeric: "tabular-nums" }}>
      <div className="max-w-md mx-auto pb-24">
        {/* En-tête */}
        <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700 px-4 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <button onClick={() => setWeek(Math.max(1, week - 1))} aria-label="Semaine précédente" className="h-9 w-9 rounded-md bg-slate-800 border border-slate-700 inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-amber-400"><ChevronLeft size={18} /></button>
            <div className="text-center">
              <div className="text-lg font-semibold">Semaine {week} <span className="text-slate-400 font-normal">sur 12</span></div>
              <div className="text-xs text-slate-400">{weekRange(week)} — {phase.label}, RIR {phase.rir}</div>
            </div>
            <button onClick={() => setWeek(Math.min(12, week + 1))} aria-label="Semaine suivante" className="h-9 w-9 rounded-md bg-slate-800 border border-slate-700 inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-amber-400"><ChevronRight size={18} /></button>
          </div>
          {timer && (
            <div className={`mt-2 flex items-center justify-between rounded-md px-3 h-11 ${remaining === 0 ? "bg-amber-400 text-slate-900" : "bg-slate-800 border border-slate-700"}`}>
              <span className="text-sm truncate">{remaining === 0 ? "Repos terminé, à toi" : `Repos — ${timer.label}`}</span>
              <span className="text-xl font-semibold">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</span>
              <button onClick={() => setTimer(null)} aria-label="Arrêter le repos" className="ml-2 focus:outline-none"><X size={18} /></button>
            </div>
          )}
        </div>

        {tab === "seance" && (
          <div className="px-4">
            <p className="text-sm text-slate-300 mt-3">{todayLine}</p>
            {!storageOk && <p className="text-sm text-amber-400 mt-2">Stockage indisponible ici : les saisies ne survivront pas à la fermeture. Exporte le JSON (onglet Plan) en fin de séance.</p>}

            <div className="flex gap-2 overflow-x-auto py-3 -mx-4 px-4">
              {SESSIONS.map((s) => (
                <button key={s.id} onClick={() => setSessionId(s.id)}
                  className={`shrink-0 h-10 px-3 rounded-full text-sm inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-amber-400 border ${sessionId === s.id ? "bg-amber-400 text-slate-900 border-amber-400" : "bg-slate-800 border-slate-700 text-slate-200"}`}>
                  {doneMap[s.id] && <Check size={14} />}{s.name}
                </button>
              ))}
              <button onClick={() => setSessionId("cardio")} className={`shrink-0 h-10 px-3 rounded-full text-sm border focus:outline-none focus:ring-2 focus:ring-amber-400 ${sessionId === "cardio" ? "bg-amber-400 text-slate-900 border-amber-400" : "bg-slate-800 border-slate-700 text-slate-200"}`}>Cardio et mobilité</button>
            </div>

            {session ? (
              <div>
                <div className="pb-2">
                  <div className="text-xl font-semibold">{session.name} <span className="text-slate-400 font-normal text-base">— {session.sub}</span></div>
                  <div className="text-sm text-slate-400">Jour conseillé : {DAYNAMES[session.day]}. {setsFor(session.ex.reduce((a, [, n]) => a + n, 0), week)} séries dures + abdos. {phase.note}</div>
                  {log.done && <div className="mt-2 text-sm text-emerald-400 inline-flex items-center gap-1"><Check size={15} />Validée le {log.date}. <button onClick={reopen} className="underline text-slate-300 ml-1 focus:outline-none">Rouvrir</button></div>}
                </div>
                <Section title="Échauffement">{WARM[session.warm]}</Section>
                {session.ex.map(([slotId, n], i) => (
                  <ExerciseCard key={slotId + week} idx={i + 1} slotId={slotId} nSets={n} week={week} si={si} state={state}
                    rows={(log.ex && log.ex[SLOTS[slotId][blockOf(week)]]) || []} onSet={onSet} onTimer={(sec, label) => setTimer({ end: Date.now() + sec * 1000, label })} />
                ))}
                <div className="pt-4 text-sm text-slate-400">{CORE[session.core].label}</div>
                {CORE[session.core].ex.map(([slotId, n], i) => (
                  <ExerciseCard key={slotId + week} idx={session.ex.length + i + 1} slotId={slotId} nSets={n} week={week} si={si} state={state}
                    rows={(log.ex && log.ex[SLOTS[slotId][blockOf(week)]]) || []} onSet={onSet} onTimer={(sec, label) => setTimer({ end: Date.now() + sec * 1000, label })} />
                ))}
                {(session.id === "hautB") && <p className="text-sm text-slate-400 mt-3">Après la séance : rameur Z2, {cardio.z2}</p>}
                {(session.id === "basA") && <p className="text-sm text-slate-400 mt-3">Après la séance : bloc mobilité, {cardio.mob}</p>}
                <label className="block mt-4">
                  <span className="text-xs text-slate-400">Notes de séance (douleur 0–10, forme, remarques)</span>
                  <textarea value={log.notes || ""} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full p-3 rounded-md bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </label>
                <div className="mt-4 flex items-center gap-3">
                  <Btn primary onClick={validate}><Check size={18} />{log.done ? "Mettre à jour la séance" : "Valider la séance"}</Btn>
                  <span className="text-xs text-slate-500">{saveStatus}</span>
                </div>
              </div>
            ) : (
              <CardioView week={week} cardio={cardio} ca={ca} setCardio={setCardio} toggleMob={toggleMob} />
            )}
          </div>
        )}

        {tab === "semaine" && (
          <div className="px-4">
            <p className="text-sm text-slate-300 mt-3">{phase.note}</p>
            <div className="mt-3 divide-y divide-slate-700 border-y border-slate-700">
              {SESSIONS.map((s) => {
                const l = state.logs[`w${week}_${s.id}`];
                const keySlot = s.ex[0][0];
                const vid = SLOTS[keySlot][blockOf(week)];
                const sets = l && l.ex && l.ex[vid] ? l.ex[vid].map((x) => ({ w: num(x.w), r: num(x.r), rir: num(x.rir) })).filter((x) => x.r != null) : [];
                return (
                  <button key={s.id} onClick={() => { setSessionId(s.id); setTab("seance"); }} className="w-full py-3 flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-amber-400 rounded">
                    <div>
                      <div className="font-medium inline-flex items-center gap-2">{l && l.done ? <Check size={16} className="text-emerald-400" /> : <span className="w-4 h-4 rounded-full border border-slate-600 inline-block" />}{s.name} <span className="text-slate-400 font-normal text-sm">{DAYNAMES[s.day]}</span></div>
                      <div className="text-sm text-slate-400 pl-6">{V[vid].name} : {sets.length ? setSummary(sets, V[vid]) : "—"}</div>
                    </div>
                    <ChevronRight size={16} className="text-slate-500" />
                  </button>
                );
              })}
            </div>
            <div className="mt-4">
              <CardioView week={week} cardio={cardio} ca={ca} setCardio={setCardio} toggleMob={toggleMob} compact />
            </div>
          </div>
        )}

        {tab === "bilan" && (
          <div className="px-4">
            <p className="text-sm text-slate-300 mt-3">Bilan de la semaine {week}, à remplir le dimanche puis à copier dans le chat. Indispensable : poids, séances, exos clés (auto), douleurs et RIR. Le reste est optionnel.</p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Field label="Poids moyen 7 pesées (kg)" value={ci.poids} onChange={(v) => setCheck("poids", v)} type="number" />
              <Field label="Tour de taille au nombril (cm)" value={ci.taille} onChange={(v) => setCheck("taille", v)} type="number" />
              <Field label="Sommeil moyen (h)" value={ci.sommeil} onChange={(v) => setCheck("sommeil", v)} type="number" />
              <Field label="Énergie (1–5)" value={ci.energie} onChange={(v) => setCheck("energie", v)} type="number" />
              <Field label="RIR ressenti global" value={ci.rir} onChange={(v) => setCheck("rir", v)} placeholder="ex. 1, ou dérive vers 2–3" wide />
              <Field label="Douleurs (0–10, où, depuis quand)" value={ci.douleurs} onChange={(v) => setCheck("douleurs", v)} placeholder="aucune" wide />
              <Field label="Écarts nutrition" value={ci.nutrition} onChange={(v) => setCheck("nutrition", v)} placeholder="RAS" wide />
              <Field label="Remarques" value={ci.remarques} onChange={(v) => setCheck("remarques", v)} wide />
            </div>
            <div className="mt-4 flex gap-3">
              <Btn primary onClick={() => copy(bilanText())}><Copy size={16} />Copier le bilan</Btn>
              <Btn onClick={() => setIoText(bilanText())}>Afficher</Btn>
            </div>
            <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-300 bg-slate-800 border border-slate-700 rounded-md p-3">{bilanText()}</pre>
          </div>
        )}

        {tab === "plan" && (
          <div className="px-4">
            <p className="text-sm text-slate-300 mt-3">Référence du programme. Les modifications se font dans le chat, le fichier est régénéré.</p>
            <Section title="Structure des 12 semaines" open>
              <table className="w-full text-sm">
                <tbody>
                  {[["S1", "Calibration, 2–3 RIR"], ["S2–S6", "Bloc 1, 1 RIR, double progression"], ["S7", "Décharge (volume −50 %, charges −15 %, 3–4 RIR) et calibration des variantes du bloc 2"], ["S8–S11", "Bloc 2, 1 RIR"], ["S12", "Bloc 2, dernière série AMRAP sur les exercices clés, mesures, re-baseline"]].map(([a, b]) => (
                    <tr key={a} className="border-t border-slate-700"><td className="py-1.5 pr-3 text-slate-400 whitespace-nowrap align-top">{a}</td><td className="py-1.5">{b}</td></tr>
                  ))}
                </tbody>
              </table>
              <p>Ancres conservées sur les deux blocs : développé couché, squat, hip thrust. Tout le reste change de variante en S7. Point volume à la fin de S4 : on décide ensemble s'il faut ajouter des séries sur les groupes prioritaires dès S5.</p>
            </Section>
            <Section title="Volume par semaine, et où il se fait">
              <table className="w-full text-sm">
                <tbody>
                  {[
                    ["Delt latéraux", "5", "Haut A 2 + Haut C 3"],
                    ["Delt postérieurs", "4", "Haut A 2 + Haut B 2"],
                    ["Delt antérieurs", "3", "Haut C 3 (développé assis) + les presses pecs"],
                    ["Pecs", "8", "Haut A 6 (couché 3, incliné 3) + Haut C 2 (pec deck)"],
                    ["Biceps", "5", "Haut B 2 + Haut C 3"],
                    ["Triceps", "5", "Haut A 2 + Haut C 3"],
                    ["Dos", "7", "Haut B 5 (tractions 3, rowing 2) + Bas B 2 (tirage serré)"],
                    ["Quadriceps", "5", "Bas A 3 (squat) + Bas B 2 (presse)"],
                    ["Ischios et fessiers", "6", "Bas A 3 (leg curl) + Bas B 3 (hip thrust)"],
                    ["Mollets", "6", "Bas A 3 + Bas B 3"],
                    ["Abdos chargés", "10", "2 séries à chaque séance (crunch, relevé de jambes, ab wheel)"],
                    ["Gainage anti-mouvement", "10", "2 séries à chaque séance (Pallof, planche latérale, carry) + McGill en mobilité"],
                  ].map(([g, n, o]) => (
                    <tr key={g} className="border-t border-slate-700"><td className="py-1.5 pr-2">{g}</td><td className="py-1.5 pr-2 text-amber-400 text-right">{n}</td><td className="py-1.5 text-slate-400">{o}</td></tr>
                  ))}
                </tbody>
              </table>
              <p>Une « série dure » = une série de travail menée à 1 RIR (ou à l'échec). Les séries d'échauffement ne comptent pas. Lecture : les delt latéraux font 5 séries dures par semaine, réparties sur 2 séances.</p>
            </Section>
            <Section title="Règles de progression">
              <p>Double progression. Quand toutes les séries d'un exercice atteignent le haut de la fourchette à ≤ 1 RIR, la charge monte à la séance suivante : barre +2,5 kg haut du corps, +5 kg bas du corps ; haltères +2 kg ; machines et poulies +5 kg ou le plus petit incrément disponible. Si 2 séries ou plus tombent sous le bas de la fourchette, on garde la charge ; si ça se répète, −5 %. L'appli calcule la charge prévue à partir de tes séances validées.</p>
              <p>Calibration (S1 et S7) : toutes les séries au haut de la fourchette avec ≥ 3 RIR → +5 % ; une série sous le bas de la fourchette → −5 %.</p>
              <p>Sur les isolations, une rep, une demi-rep ou une exécution plus stricte à charge égale comptent comme un progrès. Tractions : lest +2,5 kg dès 3 × 8 à ≤ 1 RIR. Relevé de jambes : genoux fléchis → jambes tendues → haltère entre les pieds. Planche latérale : +5 s par côté.</p>
              <p>Repos : 2–3 min sur les gros mouvements, 1–2 min sur les isolations, 1 min sur les abdos. Descente 2–4 s, montée forte. Concentrique dynamique, pas de ralentissement pour « sentir ».</p>
            </Section>
            <Section title="Décharge : déclencheurs et recette">
              <p>Déclencheurs : baisse de performance sur ≥ 2 exercices clés pendant 2 séances de suite malgré sommeil et alimentation corrects ; douleur articulaire ≥ 3/10 qui persiste plus de 48 h ou augmente ; sommeil &lt; 6 h plusieurs nuits ; FC de repos ou HRV dégradées 3 jours ou plus ; RIR ressenti qui dérive.</p>
              <p>Décharge complète : mêmes exercices, volume −50 %, charges −10 à −20 %, 3–4 RIR, cardio Z2 facile, une semaine. Allègement ciblé (une articulation qui se plaint) : on retire uniquement les exercices qui la sollicitent, on garde le reste, on remplace par une variante indolore. Toute douleur nouvelle = arrêt de l'exercice concerné, avis médical si elle persiste.</p>
            </Section>
            <Section title="Plan de repli (séances manquées)">
              <p>4 séances : Haut A, Haut B, Haut C, plus une seule séance jambes fusionnée (squat 3, hip thrust 2, leg curl 2, mollets 3, abdos B).</p>
              <p>3 séances : Haut A, Haut C, plus « tirage + jambes » (tractions 3, rowing appuyé 2, squat 3, leg curl 2, mollets 2, abdos B).</p>
              <p>2 séances : Haut C, plus un full body (squat 3, tractions 3, développé couché 3, élévations latérales 2, leg curl 2, abdos A).</p>
              <p>On ne rattrape jamais la semaine suivante, on reprend le plan. Les groupes prioritaires ne sautent pas deux semaines de suite : si une semaine a été réduite, la suivante commence par Haut C.</p>
            </Section>
            <Section title="Cardio et mobilité">
              <p>Rameur Z2 deux fois par semaine (mercredi après Haut B, dimanche) : 35 min en S1–S2, +5 min toutes les deux semaines jusqu'à 60 min en S12, 30 min faciles en S7. Cibles ~105–115 W, 130–138 bpm, cadence 18–20, drag factor 110–120. La durée progresse d'abord, la puissance ensuite.</p>
              <p>Intervalles le jeudi (optionnel, S2–S6 et S8–S11) : 4 × 4 min en Z4 puis 5 × 4 min en bloc 2, 3 min de récupération, cadence 24–28 pour limiter la charge lombaire. Toujours à 48 h d'une séance jambes. C'est la première chose qu'on retire si un déclencheur de décharge s'allume.</p>
              <p>Mobilité 10–15 min, 3 fois par semaine (mardi, jeudi, dimanche) : McGill Big 3 en pyramide descendante, 90/90 et couch stretch, thoracique, épaules. Échauffement spécifique avant chaque séance (voir la séance).</p>
            </Section>
            <Section title="Nutrition">
              <p>Maintenance estimée ≈ 3 150 kcal (Mifflin 1 916 et Katch-McArdle 2 071 → base 2 000 ; × 1,4 hors sport ; + ~370 kcal/jour d'entraînement). Départ : 3 400 kcal par jour, 7 jours sur 7. Protéines 185 g, lipides 85 g, glucides 470 g. Quatre repas à 40–50 g de protéines, glucides concentrés autour des séances.</p>
              <p>Lecture des deux premières semaines : +0,5 à 1 kg d'eau et de glycogène en S1, on juge la pente entre la moyenne de S2 et celle de S4. Pente +0,2–0,3 kg/sem → maintenance confirmée. Poids stable → 3 650 kcal. Plus de +0,4 kg/sem → 3 200 kcal.</p>
              <p>Ajustements (toutes les 2 semaines) : gain &gt; 0,4 kg/sem sur 2 semaines ou taille +1 cm sur 2 semaines → −150 à −200 kcal ; gain &lt; 0,1 kg/sem sur 2 semaines → +100 à +150 kcal ; taille +3 cm cumulés ou masse grasse estimée ≥ 15–16 % → retour à maintenance et réévaluation. Cible : 92,5–93,5 kg fin S12.</p>
              <p>Journée type, jour d'entraînement (~3 400 kcal) : matin, 100 g de flocons d'avoine, 300 ml de lait, une banane, 30 g de whey, 20 g d'amandes. Midi, 150 g de poulet, 120 g de riz basmati (cru), légumes, une cuillère d'huile d'olive, un yaourt grec. 60–90 min avant la séance, 200 g de fromage blanc, 2 tranches de pain complet et de la confiture. Soir, 150 g de saumon ou de bœuf 5 %, 300 g de pommes de terre, légumes, une cuillère d'huile. Collation, 250 g de fromage blanc, 30 g de miel, 30 g de noix. Jour de repos : mêmes totaux, la collation pré-séance devient un goûter.</p>
              <p>Version minimale, les 4 règles qui tiennent quand la semaine part en vrille : quatre repas avec 40 g de protéines ; pesée chaque matin ; mètre ruban et bilan copié-collé le dimanche ; le plancher alimentaire ne dépend pas de la séance, séance ratée = on mange pareil.</p>
              <p>Optionnel : créatine 3–5 g/j, whey pour atteindre 185 g, vitamine D 1 000–2 000 UI/j d'octobre à mars, caféine 100–200 mg avant séance.</p>
            </Section>
            <Section title="Charges de départ (S1)">
              <p>Développé couché 72,5 kg ; squat 105 kg (+5 kg en S2 si ≥ 3 RIR à 8 reps) ; développé épaules haltères 26 kg par main ; tirage vertical serré 90 kg ; tractions au poids du corps ; développé incliné haltères 30 kg par main à confirmer. Tout le reste en paliers : 50 → 75 → 100 % de la charge devinée, la première série dans la fourchette à 2–3 RIR devient la charge de travail. Hip thrust : paliers depuis 60 kg.</p>
            </Section>
            <Section title="Données : sauvegarde et restauration">
              <p>{storageOk ? "Le journal est enregistré automatiquement sur cet appareil." : "Stockage automatique indisponible ici."} Avant une mise à jour du fichier, exporte le JSON et colle-le dans le chat ou garde-le : il se réimporte ci-dessous.</p>
              <div className="flex gap-2 flex-wrap">
                <Btn small onClick={() => copy(JSON.stringify(withVersion(state)))}><Copy size={14} />Exporter le JSON</Btn>
                <Btn small onClick={() => setIoText(JSON.stringify(withVersion(state)))}>Afficher le JSON</Btn>
                <Btn small onClick={importData} disabled={!ioText}>Importer le JSON collé</Btn>
              </div>
              <textarea value={ioText} onChange={(e) => setIoText(e.target.value)} rows={4} placeholder="Colle ici un JSON exporté pour le réimporter" className="w-full p-2 rounded-md bg-slate-800 border border-slate-700 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </Section>
          </div>
        )}

        {toast && <div className="fixed left-1/2 -translate-x-1/2 bottom-20 bg-amber-400 text-slate-900 px-4 py-2 rounded-md text-sm font-medium shadow-none">{toast}</div>}

        {/* Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700">
          <div className="max-w-md mx-auto grid grid-cols-4">
            {[["seance", "Séance"], ["semaine", "Semaine"], ["bilan", "Bilan"], ["plan", "Plan"]].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} className={`h-14 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${tab === id ? "text-amber-400 font-medium" : "text-slate-400"}`}>
                {label}
                {id === "semaine" && (
                  <span className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${weekDoneCount === 5 ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-300"}`}>
                    {weekDoneCount}/5
                  </span>
                )}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

function CardioView({ week, cardio, ca, setCardio, toggleMob, compact }) {
  return (
    <div>
      {!compact && <div className="text-xl font-semibold pb-1">Cardio et mobilité, semaine {week}</div>}
      <div className="divide-y divide-slate-700 border-y border-slate-700">
        {CARDIO_ITEMS.map((it) => {
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
        <div className="py-3">
          <div className="font-medium">Mobilité, 3 fois par semaine</div>
          <div className="text-sm text-slate-400">{cardio.mob}</div>
          <div className="flex gap-4 mt-2">
            {MOB_DAYS.map((d, i) => (
              <label key={d} className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={!!(ca.mob && ca.mob[i])} onChange={() => toggleMob(i)} className="h-5 w-5 accent-amber-400" />{d}</label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
