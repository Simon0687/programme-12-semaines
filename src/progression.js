/* =========================================================
   Moteur de progression — charges prévues (#2)

   history() / lastEntry() / planned() / loadText() extraits de App.jsx
   sans changement de comportement, avec les petits helpers purs dont ils
   dépendent (num, fmt, roundTo, blockOf, phaseOf, setsFor). Aucun import
   React : ce module est chargeable par `node --test`.

   Les notes éditoriales de phaseOf() voyagent ici temporairement ;
   #4 (contenu de l'onglet Plan) les relogera.
   ========================================================= */

import { V, SLOTS, SESSIONS } from "./program.js";

export const num = (s) => {
  if (s === "" || s == null) return null;
  const n = parseFloat(String(s).replace(",", "."));
  return Number.isNaN(n) ? null : n;
};
export const fmt = (n) => (n == null ? "—" : String(Math.round(n * 100) / 100).replace(".", ","));
export const roundTo = (x, inc) => (inc ? Math.round(x / inc) * inc : x);

export const phaseOf = (w) =>
  w === 1 ? { id: "calib", label: "Calibration", rir: "2–3", note: "Séries à 2–3 RIR pour valider les charges. Exercices sans référence : paliers (≈ 50 → 75 → 100 % de la charge devinée), la première série dans la fourchette à 2–3 RIR devient la charge de travail." }
  : w <= 6 ? { id: "b1", label: "Bloc 1", rir: "1", note: "Toutes les séries à 1 RIR. Dès S3, dernière série à l'échec autorisée sur les exercices stables (marqués ⚡)." }
  : w === 7 ? { id: "deload", label: "Décharge et calibration du bloc 2", rir: "3–4", note: "Volume −50 %, charges −15 %, 3–4 RIR, cardio Z2 facile. Les nouvelles variantes du bloc 2 sont introduites cette semaine à 3–4 RIR : elles arrivent calibrées en S8." }
  : w <= 11 ? { id: "b2", label: "Bloc 2", rir: "1", note: "Variantes tournées, ancres conservées (couché, squat, hip thrust). 1 RIR, dernière série à l'échec autorisée sur les ⚡." }
  : { id: "bilan", label: "Bloc 2, semaine bilan", rir: "1", note: "Dernière séance de chaque exercice clé : dernière série en AMRAP à la charge prévue (re-baseline par Epley). Mesures : poids moyen, tour de taille, photos." };
export const blockOf = (w) => (w <= 6 ? "b1" : "b2");
export const setsFor = (n, w) => (w === 7 ? Math.ceil(n / 2) : n);

export function history(state, vid) {
  const out = [];
  for (let w = 1; w <= 12; w++) {
    SESSIONS.forEach((s, si) => {
      const log = state.logs[`w${w}_${s.id}`];
      if (!log || !log.done) return;
      const sets = ((log.ex && log.ex[vid]) || []).map((x) => ({ w: num(x.w), r: num(x.r), rir: num(x.rir) })).filter((x) => x.r != null);
      if (sets.length) out.push({ week: w, si, session: s.name, sets });
    });
  }
  return out;
}
export function lastEntry(state, vid, week, si) {
  const h = history(state, vid).filter((e) => e.week < week || (e.week === week && e.si < si));
  return h[h.length - 1] || null;
}
export function planned(state, slotId, week, si) {
  const slot = SLOTS[slotId];
  const vid = slot[blockOf(week)];
  const v = V[vid];
  const unit = v.unit || "kg";
  const [mn, mx] = slot.reps;
  const hist = history(state, vid).filter((e) => e.week < week || (e.week === week && e.si < si));
  let base = hist[hist.length - 1], prev = hist[hist.length - 2];
  if (base && base.week === 7 && hist.some((e) => e.week < 7)) {
    const nd = hist.filter((e) => e.week < 7);
    base = nd[nd.length - 1]; prev = nd[nd.length - 2];
  }
  const label = unit === "time" ? `${mn}–${mx} s` : unit === "carry" ? `${mn}–${mx} s` : `${mn}–${mx} reps`;

  if (!base) {
    if (unit === "time" || unit === "reps") return { load: null, text: `Cible ${label} à ${phaseOf(week).rir} RIR`, why: "" };
    if (v.start == null) return { load: null, text: "Paliers", why: "50 → 75 → 100 % de la charge devinée ; la première série dans la fourchette au bon RIR devient la charge de travail" };
    const l = week === 7 ? roundTo(v.start * 0.85, v.incr) : v.start;
    return { load: l, text: loadText(v, l), why: week === 7 ? "charge de départ −15 % (décharge)" : "charge de départ" };
  }
  const load = Math.max(...base.sets.map((s) => (s.w == null ? 0 : s.w)));
  const allTop = base.sets.every((s) => s.r >= mx);
  const rirs = base.sets.map((s) => s.rir);
  const lowCount = base.sets.filter((s) => s.r < mn).length;
  let next = load, why = "même charge";

  if (unit === "time" || unit === "reps") {
    const t = allTop ? `progresser : ${unit === "time" ? "+5 s" : "+1 rep ou amplitude"}` : `viser le haut de la fourchette (${label})`;
    return { load: null, text: `Cible ${label}`, why: `dernière fois ${base.sets.map((s) => s.r).join("/")} — ${t}` };
  }
  if (base.week === 1 || base.week === 7) {
    if (allTop && rirs.every((x) => x != null && x >= 3)) { next = roundTo(load * 1.05, v.incr); why = "calibration : +5 %"; }
    else if (lowCount >= 1) { next = roundTo(load * 0.95, v.incr); why = "calibration : −5 %"; }
    else why = "charge validée en calibration";
  } else if (allTop && rirs.every((x) => x != null && x <= 1)) {
    next = load + v.incr; why = `+${fmt(v.incr)} kg : haut de fourchette atteint à ≤ 1 RIR`;
  } else if (lowCount >= 2) {
    const prevLow = prev && prev.sets.filter((s) => s.r < mn).length >= 2;
    if (prevLow) { next = roundTo(load * 0.95, v.incr); why = "−5 % : deux séances sous la fourchette"; }
    else why = "même charge : une séance sous la fourchette, on retente";
  } else why = "même charge : viser plus de reps";
  if (week === 7 && base.week !== 7) { next = roundTo(next * 0.85, v.incr); why = "décharge −15 %"; }
  return { load: next, text: loadText(v, next), why };
}
export function loadText(v, l) {
  if (l == null) return "—";
  if ((v.unit || "kg") === "bw") return l > 0 ? `PDC + ${fmt(l)} kg` : "Poids du corps";
  return `${fmt(l)} kg${v.perHand ? " / main" : ""}`;
}
