/* =========================================================
   Groupes musculaires, tels que la page Exercices de Référence les
   présente (#116)

   Six jetons plutôt que les onze groupes de MUSCLE_GROUPS (registry.js) :
   ceux-là sont la granularité qu'un générateur ou un éditeur doit
   distinguer pour répartir un volume ou équilibrer une séance ; celle-ci
   est la granularité à laquelle on cherche un exercice au repos — personne
   ne filtre « deltoïde postérieur » sans déjà savoir quel exercice il
   cherche. Un vocabulaire séparé de exercise-filter.js, pas un doublon : les
   deux lisent le même registre pour deux questions différentes.

   Un exercice sans muscle dominant dans un jeton (les quatre entrées sans
   champs de sélection, exercise-filter.js note d'en-tête) ne rentre dans
   aucun bucket : il reste trouvable par la recherche, exactement comme
   aujourd'hui dans le sélecteur d'exercices.
   ========================================================= */

export const MUSCLE_BUCKETS = [
  ["pecs", "Pecs", ["pectoraux"]],
  ["dos", "Dos", ["dos"]],
  ["jambes", "Jambes", ["quadriceps", "ischios_fessiers", "mollets"]],
  ["epaules", "Épaules", ["deltoide_ant", "deltoide_lat", "deltoide_post"]],
  ["bras", "Bras", ["biceps", "triceps"]],
  ["gainage", "Gainage", ["abdominaux"]],
];

export function matchesBucket(entry, bucketKey) {
  if (!bucketKey) return true;
  const bucket = MUSCLE_BUCKETS.find(([key]) => key === bucketKey);
  if (!bucket) return true;
  const groups = bucket[2];
  return groups.some((g) => (entry.muscles?.[g] ?? 0) > 0);
}
