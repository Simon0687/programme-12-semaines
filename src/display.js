/* =========================================================
   Affichage — libellés français et géométrie de la courbe (#17)

   Ce module porte ce que le registre refuse de porter. `registry.js` est
   une feuille de *clés* (`deltoide_ant`, `barre_ez`, `poussee_horizontale`)
   et n'a aucun texte d'interface : y mettre des libellés en ferait un
   module d'affichage, et la fiche exercice en a besoin pour rendre son
   bloc « Détails ». Les tables vivent donc ici (#17 spec, Décision 1).

   Il accueille aussi `setSummary()`, sorti de `App.jsx` où il était pur,
   affiché à trois endroits et non testé — c'est la part de #23 que #17
   prend d'avance, pour que la fiche et la liste Semaine partagent un seul
   formateur au lieu d'en faire naître un second. Déplacé au caractère
   près : les tests l'épinglent sur les cinq unités.

   `loadText()` reste dans `progression.js` : `planned()` l'appelle, et
   faire importer un module de vue par une feuille du moteur coûterait
   l'invariant d'ARCHITECTURE §1.

   Non-objectifs : ce module ne lit jamais le journal (c'est
   `exercise-history.js`) et n'importe jamais React (§2.6). Tout y est pur,
   donc chargeable sous `node --test`, `chartGeometry()` comprise — c'est
   ce qui permet de tester la courbe sans DOM ni moteur de rendu.
   ========================================================= */

import { fmt } from "./progression.js";

/* ---------- Résumé des séries (déplacé depuis App.jsx, #23) ---------- */

export function setSummary(sets, v) {
  if (!sets || !sets.length) return "—";
  const unit = v.unit || "kg";
  const kg = Math.max(...sets.map((s) => (s.w == null ? 0 : s.w)));
  const reps = sets.map((s) => (s.r == null ? "?" : s.r)).join("/");
  const rir = [...new Set(sets.map((s) => (s.rir == null ? "?" : s.rir)))].join("-");
  const kgTxt = unit === "time" || unit === "reps" ? "" : unit === "bw" ? (kg > 0 ? `+${fmt(kg)} kg ` : "PDC ") : `${fmt(kg)} kg `;
  return `${kgTxt}${reps}${unit === "time" || unit === "carry" ? " s" : ""} @ ${rir} RIR`;
}

/* ---------- Dates ---------- */

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/* Numéro de jour absolu depuis une chaîne ISO, sans passer par le fuseau
   local : la courbe n'a besoin que d'écarts, et parseLocalDate()
   (definition.js) ferait entrer une dépendance pour rien. */
export function dayNumber(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}
export function dateShort(iso) {
  const [, m, d] = String(iso).split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}
export function monthShort(iso) {
  return MONTHS[Number(String(iso).split("-")[1]) - 1];
}
/* « mars – juin 2026 », ou les deux années quand le cycle les traverse.
   Sert d’en-tête au séparateur de cycle dans l’historique. */
export function periodLabel(fromIso, toIso) {
  const y1 = String(fromIso).slice(0, 4), y2 = String(toIso).slice(0, 4);
  const a = monthShort(fromIso), b = monthShort(toIso);
  if (y1 !== y2) return `${a} ${y1} – ${b} ${y2}`;
  return a === b ? `${a} ${y2}` : `${a} – ${b} ${y2}`;
}

/* Les deux seuls kind qui se disent à l’écran : un « normal » n’a rien à
   annoncer, et une pastille sur chaque ligne ne dirait plus rien. */
export const KIND_LABELS = { calibration: "calibration", deload: "décharge" };

function isoOfDay(n) {
  return new Date(n * 86400000).toISOString().slice(0, 10);
}

/* ---------- Libellés du registre ---------- */

export const MUSCLE_LABELS = {
  pectoraux: "Pectoraux",
  triceps: "Triceps",
  deltoide_ant: "Deltoïde antérieur",
  deltoide_lat: "Deltoïde latéral",
  deltoide_post: "Deltoïde postérieur",
  dos: "Dos",
  biceps: "Biceps",
  quadriceps: "Quadriceps",
  ischios_fessiers: "Ischios et fessiers",
  mollets: "Mollets",
  abdominaux: "Abdominaux",
};

export const EQUIPMENT_LABELS = {
  barre: "barre", barre_ez: "barre EZ", halteres: "haltères", kettlebell: "kettlebell",
  banc: "banc", banc_incline: "banc incliné", banc_lombaire: "banc lombaire", rack: "rack",
  barre_traction: "barre de traction", barres_paralleles: "barres parallèles",
  poulie: "poulie", machine: "machine", poids_du_corps: "poids du corps",
};

export const JOINT_LABELS = {
  epaule: "épaule", coude: "coude", poignet: "poignet",
  lombaires: "lombaires", hanche: "hanche", genou: "genou",
};

export const TYPE_LABELS = { compose: "Composé", isolation: "Isolation" };

const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const joinLabels = (keys, table) =>
  (Array.isArray(keys) ? keys : []).map((k) => table[k] || k).join(", ");

export function muscleRows(ex) {
  const m = (ex && ex.muscles) || {};
  return Object.entries(m)
    .filter(([, v]) => typeof v === "number" && v > 0)
    .map(([key, v]) => ({ key, label: MUSCLE_LABELS[key] || key, pct: Math.round(v * 100) }))
    .sort((a, b) => b.pct - a.pct)
    .map((r, i) => ({ ...r, dominant: i === 0 }));
}

/* Rend `null` quand l'exercice n'a pas de champs de sélection — les quatre
   ids de UNSELECTABLE_IDS (pallof, sideplank, abwheel, carry, #25). La
   condition porte sur la donnée présente et non sur la liste d'ids : c'est
   le même verdict, sans faire importer le registre à ce module, et ça reste
   juste si une entrée future arrive incomplète. Une section absente, jamais
   une section vide. */
export function detailRows(ex) {
  if (!ex || !ex.muscles) return null;
  return {
    muscles: muscleRows(ex),
    equipement: capitalize(joinLabels(ex.equipement, EQUIPMENT_LABELS)),
    articulations: capitalize(joinLabels(ex.articulations, JOINT_LABELS)),
    type: TYPE_LABELS[ex.type] || "",
  };
}

/* ---------- Géométrie de la courbe ----------

   Entrée : le découpage par cycle que rend seriesByCycle()
   (exercise-history.js). Sortie : des nombres, aucun balisage — le
   composant ne fait qu'émettre du <svg> à partir de ça, ce qui rend la
   courbe testable sans DOM.

   Une polyligne par cycle, jamais une seule qui traverserait la coupure :
   relier deux cycles inventerait une continuité qui n'a pas eu lieu. */

function niceStep(raw) {
  if (!(raw > 0)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const mult = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return mult * mag;
}

function niceScale(lo, hi) {
  if (hi === lo) { lo -= 1; hi += 1; }
  const step = niceStep((hi - lo) / 3);
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = min; v <= max + step / 1000; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { min, max, ticks };
}

export function chartGeometry(series, box) {
  const all = (series || []).flatMap((s) => s.points || []);
  if (!all.length) return null;

  const { w = 358, h = 162, padL = 34, padT = 8, padB = 30 } = box || {};
  const x0 = padL, x1 = w, y0 = padT, y1 = h - padB;

  const days = all.map((p) => dayNumber(p.date));
  const d0 = Math.min(...days), d1 = Math.max(...days);
  const vals = all.map((p) => p.value);
  const scale = niceScale(Math.min(...vals), Math.max(...vals));

  const X = (iso) => (d1 === d0 ? (x0 + x1) / 2 : x0 + ((dayNumber(iso) - d0) / (d1 - d0)) * (x1 - x0));
  const Y = (v) => (scale.max === scale.min ? (y0 + y1) / 2 : y1 - ((v - scale.min) / (scale.max - scale.min)) * (y1 - y0));
  const r2 = (n) => Math.round(n * 10) / 10;

  const polylines = [], dots = [];
  for (const s of series) {
    const pts = (s.points || []).map((p) => ({ ...p, x: r2(X(p.date)), y: r2(Y(p.value)) }));
    if (!pts.length) continue;
    polylines.push({ programId: s.programId, points: pts.map((p) => `${p.x},${p.y}`).join(" ") });
    for (const p of pts) {
      dots.push({ x: p.x, y: p.y, date: p.date, value: p.value, hollow: p.kind === "calibration" || p.kind === "deload" });
    }
  }

  /* Quatre repères de temps au maximum, pris sur la durée réelle et non sur
     le nombre de séances : trois mois d'arrêt doivent se voir. */
  const xLabels = [];
  for (const f of [0, 1 / 3, 2 / 3, 1]) {
    const iso = isoOfDay(Math.round(d0 + (d1 - d0) * f));
    const label = monthShort(iso);
    if (xLabels.length && xLabels[xLabels.length - 1].label === label) continue;
    xLabels.push({ x: r2(X(iso)), label, anchor: f === 1 ? "end" : "start" });
  }

  return {
    plot: { x0, x1, y0: r2(y0), y1: r2(y1) },
    grid: scale.ticks.map((v) => ({ y: r2(Y(v)), value: v })),
    xLabels,
    polylines,
    dots,
  };
}
