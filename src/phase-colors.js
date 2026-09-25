/* =========================================================
   Couleurs de phase — définies une fois, réutilisées partout (#107, #114)

   phaseOf() (progression.js) rend un id parmi calib | b1 | deload | b2 |
   bilan. La timeline de l'index Programme (#107) et la frise de Référence
   (#114) doivent lire le même cycle de la même couleur — sans ce fichier,
   chacune aurait inventé la sienne, et la promesse « mêmes couleurs de
   phase » (épique #119, cross-cutting) serait fausse au premier retouché.

   Les classes sont écrites en toutes lettres, jamais composées par
   template literal (`bg-${x}`) : le balayage de contenu de Tailwind est un
   grep sur le texte source, pas une évaluation JS — une classe assemblée à
   l'exécution n'existe nulle part dans le texte et ne serait jamais
   générée. Les jetons eux-mêmes vivent dans tailwind.config.js, à côté des
   autres : une phase n'est ni un accent (ce qui est vivant) ni un statut
   (validé, erreur) — c'est un repère de lecture sur douze semaines, qui
   mérite son propre nom plutôt que d'emprunter le sens d'un autre jeton.
   ========================================================= */

export const PHASE_BG = {
  calib: "bg-phase-calib",
  b1: "bg-phase-b1",
  deload: "bg-phase-deload",
  b2: "bg-phase-b2",
  bilan: "bg-phase-bilan",
};

export const PHASE_TEXT = {
  calib: "text-phase-calib",
  b1: "text-phase-b1",
  deload: "text-phase-deload",
  b2: "text-phase-b2",
  bilan: "text-phase-bilan",
};

export const PHASE_BORDER = {
  calib: "border-phase-calib",
  b1: "border-phase-b1",
  deload: "border-phase-deload",
  b2: "border-phase-b2",
  bilan: "border-phase-bilan",
};

/* Le libellé court de la légende — distinct de phase.label (progression.js),
   qui porte le numéro de bloc réel ("Bloc 2") et la phrase complète pour un
   déclencheur de décharge donné. Une frise de douze cases n'a la place que
   pour cinq mots. */
export const PHASE_SHORT_LABELS = {
  calib: "Calib.",
  b1: "Bloc 1",
  deload: "Décharge",
  b2: "Bloc 2",
  bilan: "Bilan",
};

/* Ordre de légende stable : celui où les phases se rencontrent dans un
   cycle qui va au bout, décharge comprise — pas l'ordre d'insertion d'un
   objet, qui ne garantit rien ici. */
export const PHASE_ORDER = ["calib", "b1", "deload", "b2", "bilan"];
