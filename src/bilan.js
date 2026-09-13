/* =========================================================
   Texte du bilan hebdomadaire (#41, extrait de App.jsx)

   Le bilan est ce qu'on colle dans le chat : c'est un contrat de sortie, pas
   un détail d'affichage. Tant qu'il vivait en closure dans App.jsx, aucune
   de ses règles n'était vérifiable autrement qu'en cliquant.

   buildBilan ne reçoit que des valeurs déjà dérivées — jamais `prog` ni
   `state`. C'est délibéré : aller les chercher lui-même rendrait ce module
   solidaire du format de programme, et il faudrait construire un programme
   entier pour le tester. App.jsx est déjà l'endroit qui connaît tout ; c'est
   sa fonction. Même raison qui fait que dateForSlot() refait son propre
   parsing de date plutôt que d'importer definition.js (schema.js:73).

   Ce module n'importe donc rien et reste une feuille du graphe.

   Une ligne à null disparaît de la numérotation — elle n'est pas rendue
   vide. C'est la règle posée en #13 pour le cardio : un programme peut n'en
   avoir pas, et le bilan ne doit pas annoncer « Cardio : aucun » à quelqu'un
   dont le programme n'en comporte simplement pas.

   Non-objectif : ce module ne calcule ni les exos clés, ni les séries, ni la
   plage de dates. Il assemble.
   ========================================================= */

export function buildBilan({
  week,
  range,
  phaseLabel,
  checkin = {},
  doneCount = 0,
  sessionCount = 0,
  missing = [],
  cardioLine = null,
  keyLines = [],
  notes = [],
}) {
  const c = checkin || {};
  /* #41 : la douleur n'est plus un champ hebdomadaire à ressaisir, elle
     remonte des notes de séance — là où elle est écrite au moment où elle est
     ressentie. Calculée à chaque génération, jamais stockée : une synthèse
     posée dans checkin périmerait dès qu'on rouvre une séance pour corriger
     une note, et rien ne permettrait d'arbitrer (decisions-spec.md Q1). */
  const written = (notes || []).filter((n) => n && n.text);
  const noteLine = written.length
    ? `Notes de séance : ${written.map((n) => `${n.session} — ${n.text}`).join(" ; ")}`
    : null;

  const lines = [
    `Poids moyen : ${c.poids || "?"} kg — tour de taille : ${c.taille || "?"} cm`,
    `Sommeil moyen : ${c.sommeil || "?"} h`,
    `Séances : ${doneCount}/${sessionCount}${missing.length ? ` — manquées : ${missing.join(", ")}` : ""}`,
    cardioLine,
    `Exos clés : ${keyLines.length ? keyLines.join(" ; ") : "aucune séance validée"}`,
    `RIR ressenti global : ${c.rir || "?"} / énergie : ${c.energie || "?"}/5`,
    `Nutrition : ${c.nutrition || "RAS"}`,
    `Remarques : ${c.remarques || "—"}`,
    noteLine,
  ].filter(Boolean);

  return [
    `Bilan S${week} (${range}) — ${phaseLabel}`,
    ...lines.map((l, i) => `${i + 1}. ${l}`),
  ].join("\n");
}
