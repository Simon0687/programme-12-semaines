/* =========================================================
   Poids et tour de taille, rendus à qui les saisit (#76)

   Le check-in du dimanche réclame six valeurs. Une seule revenait à l'écran,
   dans une ligne de texte du bilan : « Poids moyen : 82 kg — tour de taille :
   88 cm ». Le chiffre de la semaine, jamais celui d'avant. Or c'est la seule
   valeur du check-in dont le sens est dans la suite et non dans le point :
   82 kg ne dit rien, 82 kg après 86 kg dit tout. Une application qui demande
   une mesure chaque dimanche et ne la rend jamais apprend à ne plus la
   remplir.

   Ce module ne fait que lire. Il ne calcule aucune géométrie — `chartGeometry`
   (display.js) le fait déjà pour la fiche exercice, et deux tracés du même
   dépôt n'ont pas à diverger. Il produit exactement la forme que cette
   fonction attend : des séries de points datés.

   **Le cycle actif seulement.** `checkin` est déjà cloisonné par programme
   dans le journal (schema.js:38), et les semaines sont relues par leur clé
   calculée plutôt que par un parcours des clés présentes : une entrée orpheline
   — une clé laissée par une startDate corrigée — ne doit pas apparaître comme
   une treizième semaine dans un cycle qui en compte douze.

   Une semaine sans pesée n'est pas un zéro : elle est absente. C'est la même
   règle que partout ailleurs ici (bilan.js : une ligne nulle disparaît, elle
   n'est pas rendue vide). Un zéro se lirait comme une mesure, et une mesure de
   zéro kilo écraserait l'axe à elle seule. Le trou reste visible parce que
   l'abscisse est temporelle : deux points séparés de quinze jours sont deux
   fois plus loin que deux points séparés de sept.

   Pur, ne lève pas, n'importe pas React (ARCHITECTURE §2.4, §2.6).
   ========================================================= */

import { num, fmt } from "./progression.js";
import { weekStartKey } from "./schema.js";

/* Les deux champs du check-in qui se lisent en courbe, et eux seuls. Le
   sommeil, l'énergie et le RIR sont des ressentis sur cinq crans ou des
   appréciations libres : une courbe leur donnerait une précision qu'ils n'ont
   pas. Le poids et le tour de taille sont mesurés avec un instrument. */
export const MEASURES = [
  { field: "poids", label: "Poids", unit: "kg" },
  { field: "taille", label: "Tour de taille", unit: "cm" },
];

/* Le cran de l'axe. Le pèse-personne et le mètre ruban se lisent au demi près,
   mais graduer l'axe au demi-kilo ne gradue que le bruit d'une pesée : la
   moyenne de sept pesées bouge de quelques centaines de grammes sans que rien
   n'ait changé. Un cran de 1 donne, via MIN_SPAN_INCR, un empan minimal de 3 —
   trois kilos, trois centimètres : l'ordre de grandeur de ce qu'un cycle
   déplace. */
export const MEASURE_INCR = 1;

/* Une valeur négative ou nulle n'est pas une mesure : c'est un champ à demi
   saisi (« -" », « 0 ») ou une faute de frappe. Elle est écartée comme une
   absence, jamais tracée. */
const isMeasure = (n) => Number.isFinite(n) && n > 0;

/* → [{ week, date, value }], de la semaine 1 à la dernière, trous compris. */
export function measurePoints(checkin, startDate, weeks, field) {
  const out = [];
  const n = Number.isFinite(weeks) ? weeks : 0;
  const c = checkin && typeof checkin === "object" ? checkin : {};
  if (typeof startDate !== "string" || !startDate) return out;
  for (let week = 1; week <= n; week++) {
    const date = weekStartKey(startDate, week);
    const row = c[date];
    if (!row || typeof row !== "object") continue;
    const value = num(row[field]);
    if (!isMeasure(value)) continue;
    out.push({ week, date, value });
  }
  return out;
}

/* → [{ field, label, unit, points, last, delta }], une entrée par mesure.
   `delta` est la variation depuis la première semaine mesurée, et non depuis
   la semaine 1 du cycle : une pesée manquée le premier dimanche ne doit pas
   priver la suite de sa variation. Il vaut null tant qu'il n'y a qu'un point —
   il n'y a alors rien depuis quoi varier, et un « +0 » se lirait comme un
   plateau constaté (display.js, deltaText). */
export function bodyMeasures(checkin, startDate, weeks) {
  return MEASURES.map((m) => {
    const points = measurePoints(checkin, startDate, weeks, m.field);
    const last = points.length ? points[points.length - 1].value : null;
    const delta = points.length > 1 ? last - points[0].value : null;
    return { ...m, points, last, delta };
  });
}

/* Les libellés, ici et non dans le composant : celui-ci n'émet que du
   balisage (ARCHITECTURE §2.6), et une chaîne assemblée en JSX n'est
   vérifiable qu'en cliquant.

   Ils ne passent pas par `valueText`/`deltaText` de display.js : ces deux-là
   lisent l'unité dans la table du registre (`traitsOf`), qui ne connaît que
   les unités d'exercice — un tour de taille en centimètres n'y a pas
   d'entrée, et lui en inventer une ferait apparaître le tour de taille dans
   les listes d'exercices. Le signe, lui, est le même qu'ailleurs : le vrai
   moins typographique, et un zéro écrit plutôt que masqué, parce qu'un
   plateau est un résultat et non une donnée manquante. */
export const measureValueText = (value, unit) => (value == null ? "—" : `${fmt(value)} ${unit}`);

export const measureDeltaText = (delta, unit) =>
  (delta == null ? null : `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${fmt(Math.abs(delta))} ${unit}`);
