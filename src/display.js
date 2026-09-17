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

/* La forme compacte — « 72,5 kg 8/8/10 » — prenait la charge **maximale** et
   concaténait **toutes** les reps. Elle fabriquait donc des séries qui
   n'existent pas : 8 à 90, 8 à 85 puis 10 à 70 se lisait « 90 kg 8/8/10 », et
   on croyait avoir fait 10 reps à 90 (constaté à l'usage le 2026-09-14).

   La règle est maintenant : **compact tant que la charge ne bouge pas, explicite
   dès qu'elle bouge.** Quand les trois séries partagent la même charge, la forme
   compacte est exacte au caractère près et reste la plus lisible — c'est le cas
   courant, `planned()` ne prescrivant qu'une seule charge de travail. Dès que
   deux séries diffèrent, chaque série porte la sienne : « 8@90/8@85/10@70 kg ».
   Une ligne qui change de forme est d'ailleurs elle-même l'information : elle
   signale une séance où la charge a dû descendre.

   Le RIR passe de « @ » à « · » parce que « @ » désigne désormais la charge
   d'une série, et « 8@90 @ 1 RIR » ne se lit pas. Un RIR non saisi ne s'écrit
   plus « @ ? RIR » : on n'affiche rien. */
export function setSummary(sets, v) {
  if (!sets || !sets.length) return "—";
  const unit = v.unit || "kg";
  const secs = unit === "time" || unit === "carry";
  const loaded = unit !== "time" && unit !== "reps";

  const reps = (s) => (s.r == null ? "?" : fmt(s.r));
  /* Au poids du corps, « PDC+10 » plutôt que « +10 kg » : la mention porte son
     unité, donc la liste n'a pas à traîner un « kg » final qui suivrait un
     « PDC » nu. */
  const load = (w) => (unit === "bw" ? (w > 0 ? `PDC+${fmt(w)}` : "PDC") : fmt(w));

  const loads = sets.map((s) => (s.w == null ? 0 : s.w));
  const varies = loaded && new Set(loads).size > 1;

  let body;
  if (varies) {
    body = sets.map((s, i) => `${reps(s)}${secs ? " s" : ""}@${load(loads[i])}`).join("/");
    if (unit !== "bw") body += " kg";
  } else {
    const head = !loaded ? "" : unit === "bw" ? (loads[0] > 0 ? `+${fmt(loads[0])} kg ` : "PDC ") : `${fmt(loads[0])} kg `;
    body = `${head}${sets.map(reps).join("/")}${secs ? " s" : ""}`;
  }

  const rir = [...new Set(sets.map((s) => s.rir).filter((x) => x != null))];
  return rir.length ? `${body} · ${rir.join("-")} RIR` : body;
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

/* Les trois kind qui se disent à l’écran : un « normal » n’a rien à annoncer, et
   une pastille sur chaque ligne ne dirait plus rien. « allégée » (#43) rejoint
   les deux autres pour la même raison qu’elles y sont — sans la pastille et le
   point creux, la courbe montrerait un creux inexpliqué et l’historique une
   régression qui n’en est pas une. */
export const KIND_LABELS = { calibration: "calibration", deload: "décharge", allege: "allégée" };

/* ---------- La ligne de tête de l'avis (#57) ----------

   Le bloc d'avis de Plan > Programme s'ouvre sur un compte, et rien d'autre.
   La phrase vit ici et non dans App.jsx pour la raison d'ARCHITECTURE §2.6 :
   un texte composé dans un .jsx n'est atteignable par aucun test, et
   celui-ci porte un accord en nombre — dont la règle française, pluriel à
   partir de deux, ne se relit pas, elle s'épingle.

   Elle ne dit ni « problèmes » ni « erreurs » : assess() conseille et ne
   bloque jamais (decisions-moteur.md Q3), et le compte inclut la ligne
   « non vérifié » que le module ajoute faute d'intention déclarée — la vue,
   elle, ne lit jamais `code`. « Points à regarder » est ce qui reste vrai
   des deux. */
export const adviceSummary = (n) => `${n} point${n > 1 ? "s" : ""} à regarder sur ce programme`;

function isoOfDay(n) {
  return new Date(n * 86400000).toISOString().slice(0, 10);
}

/* Graduation de l’axe des ordonnées. L’unité reçue est celle de l’**axe**
   (`chartMode().line`), pas celle de l’exercice : au poids du corps la courbe
   trace des répétitions, et l’ancien cas « zéro se dit PDC » n’a plus de sens
   — il portait une charge, la courbe n’en porte plus. Les kilos restent nus,
   le libellé au-dessus du cadre les nomme et la gouttière de gauche ne fait
   que 34 px. */
export function axisLabel(value, unit) {
  if (unit === "time") return `${fmt(value)} s`;
  return fmt(value);
}

/* Le chiffre de tête porte son unité, là où l'axe la laisse nue : au-dessus du
   cadre il n'y a plus de titre de section pour la nommer (#49). */
export function valueText(value, unit) {
  if (unit === "time") return `${fmt(value)} s`;
  if (unit === "reps") return `${fmt(value)} reps`;
  return `${fmt(value)} kg`;
}

/* Le signe est toujours écrit, y compris le zéro : une variation nulle est un
   plateau, et le masquer la ferait lire comme une donnée manquante. Le moins est
   le vrai signe typographique, celui qu'affichent déjà les « −5 % » du moteur. */
export function deltaText(delta, unit) {
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  return `${sign}${valueText(Math.abs(delta), unit)}`;
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

/* Les seize patterns du registre, pour les facettes du sélecteur
   d'exercices (#36). Même raison d'être que MUSCLE_LABELS juste au-dessus :
   `registry.js` est une feuille de clés, et « charniere_hanche » n'est pas
   un texte d'interface. */
export const PATTERN_LABELS = {
  poussee_horizontale: "Poussée horizontale",
  poussee_verticale: "Poussée verticale",
  tirage_vertical: "Tirage vertical",
  tirage_horizontal: "Tirage horizontal",
  dominante_genou: "Dominante genou",
  charniere_hanche: "Charnière de hanche",
  extension_hanche: "Extension de hanche",
  mollets: "Mollets",
  abdominaux: "Abdominaux",
  iso_pectoraux: "Isolation pectoraux",
  iso_deltoide_lateral: "Isolation deltoïde latéral",
  iso_deltoide_posterieur: "Isolation deltoïde postérieur",
  iso_biceps: "Isolation biceps",
  iso_triceps: "Isolation triceps",
  iso_quadriceps: "Isolation quadriceps",
  iso_ischios: "Isolation ischios",
};

/* ---------- Jour d'une séance ----------
   `session.day` est un décalage de 1 à 7 depuis startDate (dateForSlot,
   src/schema.js:76), et startDate est un lundi : 1 se lit donc lundi, et 7
   dimanche. La liste commence à lundi et `dayName` fait le −1, plutôt
   qu'un tableau troué en tête : c'est ce qui empêche de la confondre avec
   Date#getDay() (0 = dimanche), la confusion que #33 a laissée ouverte et
   qui affichait « undefined » sur une séance du dimanche — jusqu'ici
   inatteignable, puisque aucun écran ne demandait de jour (#36). */
export const DAY_NAMES = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

export const dayName = (day) => DAY_NAMES[day - 1] || "";

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

/* ---------- Plancher de l'axe des valeurs (#49) ----------

   `niceScale(min(vals), max(vals))` seul cadre l'axe sur la donnée, donc la
   donnée remplit toujours le cadre : 69 → 72 dessinait la même fusée que 20 kg
   de progrès. Le pire cas n'est pas celui-là, c'est le plateau — six mois tenus
   à 70 kg à ±1 kg près se recadraient sur 69–71 et dessinaient une montée là où
   il ne s'était rien passé. Ça ne se résout pas avec plus de données : un cycle
   de maintien resserre l'axe à l'identique.

   D'où un empan minimal. Deux propriétés, et les constantes ne sont que le
   réglage :

   - **un pourcentage de la médiane**, pas un multiple d'`incr`. `incr` va de 2
     (élévations latérales) à 10 (presse à mollets) : le même multiple donnerait
     8 kg d'empan sur l'un et 40 sur l'autre.
   - **quelques incréments en plancher sous le plancher**, pour qu'un exercice à
     petits pas n'obtienne jamais un empan plus fin que sa propre granularité —
     une graduation sous l'incrément ne gradue que du bruit.

   L'élargissement est **symétrique autour de la donnée** : ancré sur un bas
   fixe, il décentrerait la courbe, ce qui est une autre façon de mentir. Un
   empan déjà plus large que le plancher ressort inchangé — `framed` rend alors
   exactement ce que rendait `niceScale`. */
const MIN_SPAN_RATIO = 0.15;
const MIN_SPAN_INCR = 3;

function median(vals) {
  const s = [...vals].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/* `incr` est le pas de l'**axe**, pas celui de l'exercice : en régime `dual` la
   courbe trace des reps ou des secondes alors qu'`incr` est en kilos, et
   l'appelant passe alors `null`. Une médiane nulle ou absente annule simplement
   le pourcentage — il n'y a rien à diviser, et le comportement retombe sur
   celui d'avant. */
export function framed(vals, incr) {
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const med = median(vals);
  const floor = Math.max(med > 0 ? med * MIN_SPAN_RATIO : 0, incr > 0 ? incr * MIN_SPAN_INCR : 0);
  const pad = (floor - (hi - lo)) / 2;
  return pad > 0 ? niceScale(lo - pad, hi + pad) : niceScale(lo, hi);
}

/* Part de la hauteur du cadre laissée aux barres de charge. Les barres vivent
   en bas, sous la courbe, comme les volumes sous un cours : à pleine hauteur
   elles passeraient derrière la polyligne et les deux progressions
   deviendraient illisibles ensemble — or les lire ensemble est tout l'objet du
   régime `dual`. L'échelle reste honnête : `barTop` annonce à quoi correspond
   le haut de la zone. */
const BAR_ZONE = 0.55;

export function chartGeometry(series, box, axisIncr) {
  const all = (series || []).flatMap((s) => s.points || []);
  if (!all.length) return null;

  /* Les barres n'existent qu'en régime `dual`, et seulement si une charge a
     réellement été portée : des tractions toujours au poids du corps donnent
     une rangée de zéros, qui ne mérite ni axe ni légende. La courbe dégénère
     alors proprement en tracé simple. */
  const barVals = all.map((p) => (typeof p.bar === "number" ? p.bar : 0));
  const hasBars = barVals.some((b) => b > 0);

  const { w = 358, h = 162, padL = 34, padT = 8, padB = 30 } = box || {};
  const padR = box && box.padR != null ? box.padR : hasBars ? 30 : 0;
  const x0 = padL, x1 = w - padR, y0 = padT, y1 = h - padB;

  const days = all.map((p) => dayNumber(p.date));
  const d0 = Math.min(...days), d1 = Math.max(...days);
  const vals = all.map((p) => p.value);
  const scale = framed(vals, axisIncr);

  const X = (iso) => (d1 === d0 ? (x0 + x1) / 2 : x0 + ((dayNumber(iso) - d0) / (d1 - d0)) * (x1 - x0));
  const Y = (v) => (scale.max === scale.min ? (y0 + y1) / 2 : y1 - ((v - scale.min) / (scale.max - scale.min)) * (y1 - y0));
  const r2 = (n) => Math.round(n * 10) / 10;

  const barScale = hasBars ? niceScale(0, Math.max(...barVals)) : null;
  const YB = (v) => y1 - (v / barScale.max) * (y1 - y0) * BAR_ZONE;
  /* Assez fine pour que deux séances rapprochées ne se recouvrent pas, assez
     large pour rester visible quand l'historique est court. */
  const barW = hasBars ? r2(Math.max(2, Math.min(12, (x1 - x0) / all.length / 1.6))) : 0;

  const polylines = [], dots = [], bars = [];
  for (const s of series) {
    const pts = (s.points || []).map((p) => ({ ...p, x: r2(X(p.date)), y: r2(Y(p.value)) }));
    if (!pts.length) continue;
    /* `area` referme la polyligne sur le bas du cadre, pour l'aplat dégradé.
       Il ne vient qu'**après** le plancher d'axe, jamais avant : la base n'est
       pas zéro, donc une surface pleine se lit comme une quantité là où elle ne
       représente que « au-dessus de 69 ». Sur une polyligne nue cette
       distorsion est discrète ; en aplat, c'est la fusée en plus grand. */
    const line = pts.map((p) => `${p.x},${p.y}`).join(" ");
    polylines.push({
      programId: s.programId,
      points: line,
      area: `${pts[0].x},${r2(y1)} ${line} ${pts[pts.length - 1].x},${r2(y1)}`,
    });
    for (const p of pts) {
      dots.push({
        x: p.x, y: p.y, date: p.date, value: p.value,
        hollow: p.kind === "calibration" || p.kind === "deload" || p.kind === "allege",
        /* Estimation hors fenêtre de crédibilité : tracée, mais grisée. */
        dim: p.dim === true,
      });
      if (hasBars && p.bar > 0) {
        const top = r2(YB(p.bar));
        bars.push({ x: r2(p.x - barW / 2), y: top, w: barW, h: r2(y1 - top), value: p.bar, date: p.date });
      }
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
    bars,
    /* Un seul repère à droite, le haut de l'échelle des barres. Une graduation
       complète ferait flotter des nombres sans ligne en face d'eux, puisque les
       lignes du cadre appartiennent à l'échelle de gauche — et l'historique
       juste en dessous porte de toute façon chaque valeur exacte. */
    barTop: hasBars ? { y: r2(YB(barScale.max)), value: barScale.max } : null,
  };
}
