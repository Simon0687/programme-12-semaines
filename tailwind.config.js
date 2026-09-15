/* =========================================================
   Vocabulaire de design (#51)

   Avant ce fichier, `theme.extend` était vide et les 220 couleurs de
   l'app étaient des littéraux Tailwind écrits dans le JSX. Le coût
   n'était pas de changer une couleur : c'était qu'aucune *intention*
   n'avait de nom. `text-amber-400` voulait dire onze choses — la charge
   prévue, la série en cours, une erreur `role="alert"`, l'onglet actif,
   « à remplir »… — donc sortir les alertes de l'accent supposait un
   chercher-remplacer qui touchait les dix autres.

   Les tokens portent donc une intention, jamais une apparence :
   `alert`, pas `warning-amber`. Un token qui décrit sa couleur
   reconstruit le problème un étage plus haut.

   Le jour de leur introduction, TOUS les tokens valent exactement le
   littéral qu'ils remplacent — `accent` et `alert` pointent l'un comme
   l'autre vers `amber-400`. Aucun pixel ne bouge : c'est ce qui rend le
   diff mécanique et relisible, et ce qui rend #49 bon marché ensuite
   (séparer deux sens devient l'édition d'une ligne ici).

   Les valeurs sont lues dans la palette Tailwind plutôt que recopiées en
   hexadécimal : un token doit être identique au littéral, pas
   approximativement identique.
   ========================================================= */

const colors = require("tailwindcss/colors");

module.exports = {
  content: ["./src/**/*.{jsx,js}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        /* ---- Accent : ce qui est vivant ---- */
        accent: colors.amber[400],            // charge prévue, série en cours, onglet actif, bouton primaire, toast
        focus: colors.amber[400],             // anneau de focus — séparé pour qu'il puisse garder son contraste si l'accent change
        badge: colors.amber[400],             // mentions de la prescription : échec OK, AMRAP
        done: colors.emerald[400],            // validé : série, séance, semaine. Jamais un succès générique.

        /* ---- Ce qui interpelle ---- */
        alert: colors.amber[400],             // erreurs de saisie et d'import, avec role="alert"
        notice: colors.amber[400],            // stockage indisponible, note de cycle, « à remplir »

        /* ---- Surfaces et traits ---- */
        surface: colors.slate[900],           // fond de page, en-têtes collants, barre d'onglets
        "surface-raised": colors.slate[800],  // champs, cartes, pastilles
        rule: colors.slate[700],              // bordures, séparateurs, filets d'un pixel
        "rule-strong": colors.slate[600],     // pastille de séance non validée
        "rule-faint": colors.slate[800],      // bordure d'un champ déjà validé, sur `surface`

        /* ---- Texte ---- */
        ink: colors.slate[100],               // texte courant
        "ink-soft": colors.slate[300],
        "ink-muted": colors.slate[400],       // libellés, unités, dates
        "ink-faint": colors.slate[500],       // notes de bas de bloc, légendes
        "ink-dim": colors.slate[600],         // série à venir : présente, en retrait
        "ink-inverse": colors.slate[900],     // sur `accent` et `done`

        /* ---- Marques de données (courbe, barres, parts) ---- */
        "data-mark": colors.amber[400],       // courbe, points, muscle dominant
        "data-mark-muted": colors.slate[600], // muscle secondaire
        "data-bar": colors.slate[700],        // barres de charge sous la courbe
        "data-dim": colors.slate[500],        // estimation hors fenêtre de crédibilité
        "data-grid": colors.slate[800],       // lignes de grille
      },
    },
  },
  plugins: [],
};
