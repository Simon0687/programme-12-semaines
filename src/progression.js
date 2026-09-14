/* =========================================================
   Moteur de progression — charges prévues (#2)

   history() / lastEntry() / planned() / loadText() extraits de App.jsx
   sans changement de comportement, avec les petits helpers purs dont ils
   dépendent (num, fmt, roundTo, blockOf, phaseOf, setsFor). Aucun import
   React : ce module est chargeable par `node --test`.

   phaseOf(w) renvoie { id, label, rir }. Les notes éditoriales par phase
   sont dans src/plan.js (PHASE_NOTES), sorties du moteur en #4.

   Depuis #16, l'historique n'est plus indexé par semaine de cycle mais par
   date réelle (logs[id] = { date, slot, kind, ... }, voir src/schema.js).
   computeKind(week) reproduit la règle que phaseOf() encode déjà (semaine 1
   = calibration, semaine 7 = décharge) : c'est la même règle, stockée une
   fois pour toutes au lieu d'être redérivée de la semaine à chaque lecture.
   La sécurité qui excluait un point de décharge (week === 7) de la base de
   calcul du suivant devient kind === "deload" ; la calibration (base.week
   === 1 || 7) devient kind === "calibration" || "deload".
   ========================================================= */

export const num = (s) => {
  if (s === "" || s == null) return null;
  const n = parseFloat(String(s).replace(",", "."));
  return Number.isNaN(n) ? null : n;
};
export const fmt = (n) => (n == null ? "—" : String(Math.round(n * 100) / 100).replace(".", ","));
export const roundTo = (x, inc) => (inc ? Math.round(x / inc) * inc : x);

/* ---------- La charge de travail d'une séance (#31) ----------

   `planned()` réduisait une séance à un seul nombre — le maximum de ses charges
   — puis jugeait la fourchette de reps sur *toutes* ses séries, quelle que soit
   la charge de chacune. Dès que les charges diffèrent, les deux moitiés du
   verdict ne parlent pas de la même chose : 8 reps à 90 kg pouvaient valider
   105 kg, et 3 reps à 120 devenaient la prescription suivante avec pour consigne
   « viser plus de reps ». Relevé sur le journal réel le 2026-09-12.

   La règle, en deux clauses : la charge de travail est **la plus lourde portant
   au moins une série au haut de la fourchette** — `mn + (mx - mn) / 2` — et, si
   aucune n'y arrive, **la plus légère tentée**.

   Le seuil *est* le correctif, pas un raffinement. Une règle qui se contenterait
   d'écarter les séries sous `mn` adopterait encore un 4 reps à 120 kg en 4–8
   comme charge de travail : une charge touchée une fois, au ras du contrat. Le
   rôle de l'appli à cet endroit n'est pas de suivre celui qui se motive et saute
   de 100 à 120, c'est de le ramener à la progression par incréments — et
   d'adopter la charge plus lourde le jour où elle est tenue au haut de la
   fourchette. Méritée, pas supposée.

   « Au moins une série », jamais « toutes ses séries » : lu comme *toutes*, le
   test épinglé 72,5 × 3/6/6 disqualifierait 72,5 pour sa série à 3, et une
   séance uniforme se retrouverait sans charge de travail.

   Une séance uniforme n'a qu'un groupe, que les deux clauses sélectionnent — le
   repli prenant la plus légère d'une seule charge, c'est-à-dire elle-même. Son
   comportement est donc identique par construction, pas par cas particulier.
   C'est ce qui permet aux 32 tests de progression de passer sans être touchés.

   Détail de la décision : docs/features/31-working-load-not-heaviest-set/. */

const loadOf = (s) => (s.w == null ? 0 : s.w);

/* Haut de la fourchette. Non arrondi : les reps sont entières, donc les 37,5 du
   carry 30–45 valent « 38 ou plus » sans qu'on ait à le dire. */
export const topHalf = (mn, mx) => mn + (mx - mn) / 2;

/* Rend { load, sets, mixed } : la charge retenue, ses séries à elle, et si la
   séance en portait plusieurs (ce que `why` affiche, #31 spec Q4).

   Invariant d'appel : `sets` n'est jamais vide — history() n'émet une séance
   qu'avec au moins une série portant des reps (voir plus bas, filter r != null).
   Le repli `Math.min` sur un groupement vide rendrait Infinity ; aucun appelant
   ne peut l'atteindre. */
export function workingSets(sets, mn, mx) {
  const byLoad = new Map();
  for (const s of sets) {
    const l = loadOf(s);
    if (!byLoad.has(l)) byLoad.set(l, []);
    byLoad.get(l).push(s);
  }
  /* Groupement par le nombre déjà produit par num() à la lecture du journal :
     deux séries saisies pareil se parsent pareil, et les incréments du registre
     (1,25 / 2 / 2,5 / 5 / 10) sont tous exactement représentables. */
  const t = topHalf(mn, mx);
  const reached = [...byLoad].filter(([, ss]) => ss.some((s) => s.r >= t)).map(([l]) => l);
  const load = reached.length ? Math.max(...reached) : Math.min(...byLoad.keys());
  return { load, sets: byLoad.get(load), mixed: byLoad.size > 1 };
}

export const phaseOf = (w) =>
  w === 1 ? { id: "calib", label: "Calibration", rir: "2–3" }
  : w <= 6 ? { id: "b1", label: "Bloc 1", rir: "1" }
  : w === 7 ? { id: "deload", label: "Décharge et calibration du bloc 2", rir: "3–4" }
  : w <= 11 ? { id: "b2", label: "Bloc 2", rir: "1" }
  : { id: "bilan", label: "Bloc 2, semaine bilan", rir: "1" };
export const blockOf = (w) => (w <= 6 ? "b1" : "b2");
export const setsFor = (n, w) => (w === 7 ? Math.ceil(n / 2) : n);
export const computeKind = (week) => (week === 1 ? "calibration" : week === 7 ? "deload" : "normal");

export function history(prog, state, vid) {
  const out = [];
  for (const rec of Object.values(state.logs)) {
    if (!rec.done) continue;
    const si = prog.SESSIONS.findIndex((s) => s.id === rec.slot);
    if (si < 0) continue; // slot d'un autre programme (custom chargé puis remplacé, #6) : hors du prog courant
    const sets = ((rec.ex && rec.ex[vid]) || []).map((x) => ({ w: num(x.w), r: num(x.r), rir: num(x.rir) })).filter((x) => x.r != null);
    if (sets.length) out.push({ date: rec.date, si, kind: rec.kind, session: prog.SESSIONS[si].name, sets });
  }
  out.sort((a, b) => (a.date === b.date ? a.si - b.si : a.date < b.date ? -1 : 1));
  return out;
}
export function lastEntry(prog, state, vid, date, si) {
  const h = history(prog, state, vid).filter((e) => e.date < date || (e.date === date && e.si < si));
  return h[h.length - 1] || null;
}
export function planned(prog, state, slotId, week, si, date) {
  const slot = prog.SLOTS[slotId];
  const vid = slot[blockOf(week)];
  const v = prog.V[vid];
  const unit = v.unit || "kg";
  const [mn, mx] = slot.reps;
  const kind = computeKind(week);
  const hist = history(prog, state, vid).filter((e) => e.date < date || (e.date === date && e.si < si));
  let base = hist[hist.length - 1], prev = hist[hist.length - 2];
  if (base && base.kind === "deload" && hist.some((e) => e.kind !== "deload")) {
    const nd = hist.filter((e) => e.kind !== "deload");
    base = nd[nd.length - 1]; prev = nd[nd.length - 2];
  }
  const label = unit === "time" ? `${mn}–${mx} s` : unit === "carry" ? `${mn}–${mx} s` : `${mn}–${mx} reps`;

  if (!base) {
    if (unit === "time" || unit === "reps") return { load: null, text: `Cible ${label} à ${phaseOf(week).rir} RIR`, why: "" };
    if (v.start == null) return { load: null, text: "Paliers", why: "50 → 75 → 100 % de la charge devinée ; la première série dans la fourchette au bon RIR devient la charge de travail" };
    const l = kind === "deload" ? roundTo(v.start * 0.85, v.incr) : v.start;
    return { load: l, text: loadText(v, l), why: kind === "deload" ? "charge de départ −15 % (décharge)" : "charge de départ" };
  }
  const load = Math.max(...base.sets.map((s) => (s.w == null ? 0 : s.w)));
  const allTop = base.sets.every((s) => s.r >= mx);
  const lowCount = base.sets.filter((s) => s.r < mn).length;
  let next = load, why = "même charge";

  if (unit === "time" || unit === "reps") {
    const t = allTop ? `progresser : ${unit === "time" ? "+5 s" : "+1 rep ou amplitude"}` : `viser le haut de la fourchette (${label})`;
    return { load: null, text: `Cible ${label}`, why: `dernière fois ${base.sets.map((s) => s.r).join("/")} — ${t}` };
  }
  if (base.kind === "calibration" || base.kind === "deload") {
    if (allTop) { next = roundTo(load * 1.05, v.incr); why = "calibration : +5 %"; }
    else if (lowCount >= 1) { next = roundTo(load * 0.95, v.incr); why = "calibration : −5 %"; }
    else why = "charge validée en calibration";
  } else if (allTop) {
    next = load + v.incr; why = `+${fmt(v.incr)} kg : haut de fourchette atteint`;
  } else if (lowCount >= 2) {
    const prevLow = prev && prev.sets.filter((s) => s.r < mn).length >= 2;
    if (prevLow) { next = roundTo(load * 0.95, v.incr); why = "−5 % : deux séances sous la fourchette"; }
    else why = "même charge : une séance sous la fourchette, on retente";
  } else why = "même charge : viser plus de reps";
  if (kind === "deload" && base.kind !== "deload") { next = roundTo(next * 0.85, v.incr); why = "décharge −15 %"; }
  return { load: next, text: loadText(v, next), why };
}
/* Libellé de la dernière séance où l'exercice a été fait (#30).

   Avant #16 un log portait son numéro de semaine de cycle et App.jsx affichait
   « Dernière fois (S3, Haut B) ». La timeline datée a retiré `week` de ce que
   renvoie history(), sans que l'affichage suive : la ligne rendait
   « Dernière fois (Sundefined, Haut B) » dès la deuxième séance.

   La date est aussi la bonne information à cet endroit, pas seulement celle
   qui est disponible : deux passages du même programme ont chacun une « S3 »,
   une date non — et « il y a combien de temps » est ce que le lecteur cherche.

   Formaté depuis la chaîne ISO plutôt qu'en passant par parseLocalDate()
   (src/definition.js) : progression.js n'importe rien, et cela doit le rester
   (docs/ARCHITECTURE.md §1). */
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export function lastEntryLabel(last) {
  const [, m, d] = last.date.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]}, ${last.session}`;
}

export function loadText(v, l) {
  if (l == null) return "—";
  if ((v.unit || "kg") === "bw") return l > 0 ? `PDC + ${fmt(l)} kg` : "Poids du corps";
  return `${fmt(l)} kg${v.perHand ? " / main" : ""}`;
}
