/* =========================================================
   Roue de charge — la géométrie du geste (#46)

   Corriger une charge, c'est presque toujours un cran d'écart : les plaques et
   les broches ne donnent rien d'autre. Le pavé numérique fait payer quatre
   frappes ce que le registre sait déjà (`v.incr`) et que le moteur a déjà
   calculé (`planned()`). Ce module tient la partie calculable du geste — l'ancre,
   les crans, la conversion d'un déplacement en nombre de crans — et laisse au
   composant les seuls Pointer Events.

   Aucun import React, donc chargeable par `node --test` : c'est la règle du
   dépôt pour tout ce qui décide quelque chose.

   Rien n'est stocké. La roue écrit dans le champ existant via `fmt()`, donc la
   même chaîne que le clavier aurait produite, relue par `num()` comme avant.
   ========================================================= */

/* Le seuil qui arbitre entre défiler et régler. Les champs `w` font 44 px de
   haut sur toute la largeur et couvrent l'écran de séance : un champ qui
   capterait le geste vertical sans délai rendrait la page impossible à faire
   défiler. Le doigt doit donc prouver qu'il reste en place — 180 ms sans
   bouger de plus de 10 px — avant que la roue ne s'ouvre. */
export const LONG_PRESS_MS = 180;
export const MOVE_CANCEL_PX = 10;

/* Hauteur d'un cran, en pixels de déplacement. 36 px : assez pour ne pas sauter
   deux crans sur un tremblement, assez peu pour atteindre ±3 crans sans
   relever le doigt. */
export const PX_PER_NOTCH = 36;

/* Nombre de crans dessinés de part et d'autre de la valeur retenue. */
export const NOTCH_RADIUS = 3;

/* L'ancre, dans l'ordre de l'issue :
   1. la valeur déjà saisie — un 73,75 tapé pour une plaque bâtarde doit rester
      atteignable, et ancrer sur le plan l'écraserait en silence ;
   2. sinon la charge prévue ;
   3. sinon rien : pas d'historique, pas de plan, la roue ne s'ouvre pas et le
      champ se comporte comme aujourd'hui. */
export function anchorFor(current, plan) {
  if (typeof current === "number" && Number.isFinite(current)) return current;
  if (typeof plan === "number" && Number.isFinite(plan)) return plan;
  return null;
}

/* Un déplacement vertical en nombre de crans. Vers le haut = plus lourd, comme
   une pile de disques : dy est négatif quand le doigt monte. */
export function stepsFromDelta(dy, pxPerNotch = PX_PER_NOTCH) {
  if (!pxPerNotch) return 0;
  /* `|| 0` ramène le -0 que rend Math.round sur un petit dy positif : il se
     comporte comme 0 partout sauf sous Object.is, et n'a rien à faire dans un
     compteur de crans. */
  return Math.round(-dy / pxPerNotch) || 0;
}

/* La valeur d'un cran. Pas d'arrondi : les incréments du registre (1,25 / 2 /
   2,5 / 5 / 10) sont tous exactement représentables en binaire, donc
   `72,5 + 2,5` vaut exactement 75 — c'est déjà noté dans progression.js. Le
   plancher est 0 : une charge négative n'existe pas, et 0 est une valeur
   légitime pour un `bw` (poids du corps sans lest). */
export function notchValue(anchor, incr, steps) {
  if (!incr) return anchor;
  return Math.max(0, anchor + steps * incr);
}

/* Les crans à dessiner, du plus lourd au plus léger — l'ordre de l'écran.
   `offset` est la distance en crans à la valeur retenue, ce dont le composant a
   besoin pour estomper les bords sans recalculer quoi que ce soit.

   Un cran écrêté par le plancher est marqué `clamped` : il porte la même valeur
   que son voisin et ne doit pas être dessiné deux fois comme un choix distinct. */
export function notches(anchor, incr, steps, radius = NOTCH_RADIUS) {
  const selected = notchValue(anchor, incr, steps);
  const out = [];
  for (let k = radius; k >= -radius; k--) {
    const value = notchValue(anchor, incr, steps + k);
    out.push({ value, offset: k, selected: k === 0, clamped: k !== 0 && value === selected });
  }
  return out;
}
