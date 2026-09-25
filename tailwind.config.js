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

   Ce jour est arrivé en #67 : `alert` vaut désormais `red-400`, et le
   diff est bien la ligne annoncée. Les cinq autres ambres restent
   groupés — aucun ne dit un refus, seul `alert` le dit.

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
        /* #67 : le premier token qui quitte la famille ambre, et la raison
           d'être de #51 (« separating two meanings becomes the edit of one
           line here »). Une erreur écrite de la couleur d'une valeur n'alerte
           pas : « Prévu : 28 kg » et « Charge invalide » se lisaient dans le
           même ambre, à quelques centimètres l'un de l'autre.

           Le rouge n'élargit pas le vocabulaire pour le plaisir : c'est la
           seule couleur dont personne n'a à apprendre le sens, et elle ne
           désigne ici qu'une chose — ce que l'appli refuse. Les trois autres
           tokens ambre restent groupés, comme #51 l'avait tranché : aucun ne
           dit un refus. */
        alert: colors.red[400],               // erreurs de saisie et d'import, avec role="alert"
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
        "data-mark": colors.amber[400],       // courbe, points, et l'aplat qui la prolonge
        "data-bar": colors.slate[700],        // barres de charge sous la courbe
        "data-dim": colors.slate[500],        // estimation hors fenêtre de crédibilité
        "data-grid": colors.slate[800],       // lignes de grille

        /* ---- Parts de muscle : une échelle, pas quatre couleurs ----
           Les segments de la barre empilée, du dominant au plus discret (#49).
           L'ordre porte le sens : c'est un rang, donc les tokens se lisent
           comme un rang. Volontairement hors de l'accent — une part de muscle
           est une donnée de référence, pas quelque chose de vivant. Le
           dominant se repère à sa largeur et à sa clarté, sans légende. */
        "share-1": colors.slate[300],
        "share-2": colors.slate[500],
        "share-3": colors.slate[600],
        "share-4": colors.slate[700],         // et tous les suivants

        /* ---- Phases du cycle (#107, #114) ----
           Un repère de lecture sur douze semaines, pas un accent ni un
           statut : cinq couleurs distinctes, définies une fois et reprises
           telles quelles par la timeline de l'index Programme et par la
           frise de Référence. */
        "phase-calib": colors.slate[400],
        "phase-b1": colors.sky[400],
        "phase-deload": colors.amber[400],
        "phase-b2": colors.indigo[400],
        "phase-bilan": colors.emerald[400],
      },
    },
  },
  plugins: [],
};
