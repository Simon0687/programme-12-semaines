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

   ---------------------------------------------------------------------

   2026-09-26 : bascule vers la palette de « Programme — écrans.dc.html »,
   la maquette Claude Design validée telle quelle le 2026-09-25 (épic #119).
   Elle est dessinée sur le design-system Nocturne (projet Claude Design
   31046579) : fond bleu-nuit #161826, accent lavande #9184d9, une seule
   famille neutre + accent plutôt que la palette Tailwind générique.

   Les noms de tokens ne changent pas — c'est ce que #51 rend bon marché :
   seules les valeurs bougent, ici en hexadécimal plutôt qu'en palette
   Tailwind puisque la source est la feuille de style de la maquette, pas
   `tailwindcss/colors`. `phase-*` reprend telle quelle l'échelle du script
   de la maquette (neutre → accent, jamais une teinte par phase) : c'est la
   réponse directe au retour « couleurs flashy et non coordonnées ».
   ========================================================= */

const colors = require("tailwindcss/colors");

module.exports = {
  content: ["./src/**/*.{jsx,js}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        /* ---- Accent : ce qui est vivant ---- */
        accent: "#9184d9",                    // charge prévue, série en cours, onglet actif, bouton primaire, toast
        "accent-ink": "#d2cefd",              // l'accent posé en texte ou en picto sur une surface : option choisie, tendance, trophée (accent-300 de la maquette)
        focus: "#d2cefd",                     // anneau de focus — séparé pour qu'il puisse garder son contraste si l'accent change
        badge: "#b5abfc",                     // mentions de la prescription : échec OK, AMRAP
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
        surface: "#161826",                   // fond de page, en-têtes collants, barre d'onglets
        "surface-raised": "#232532",          // champs, cartes, pastilles
        chip: "#3f424d",                      // pastille neutre et case de picto posées sur une carte (tag-neutral de la maquette)
        rule: "rgba(233, 233, 237, 0.16)",    // bordures, séparateurs, filets d'un pixel — le filet qui s'estompe de la maquette
        "rule-strong": "#75798c",             // pastille de séance non validée
        "rule-faint": "#3f424d",              // bordure d'un champ déjà validé, sur `surface`

        /* ---- Texte ---- */
        ink: "#e9e9ed",                       // texte courant
        "ink-soft": "#cfd3e5",
        "ink-muted": "#b2b6ca",               // libellés, unités, dates
        "ink-faint": "#9397ab",               // notes de bas de bloc, légendes
        "ink-dim": "#75798c",                 // série à venir : présente, en retrait
        "ink-inverse": "#161826",             // sur `accent` et `done`

        /* ---- Marques de données (courbe, barres, parts) ---- */
        "data-mark": "#9184d9",               // courbe, points, et l'aplat qui la prolonge — aligné sur `accent`
        "data-bar": "#595d6c",                // barres de charge sous la courbe
        "data-dim": "#9397ab",                // estimation hors fenêtre de crédibilité
        "data-grid": "#3f424d",               // lignes de grille

        /* ---- Parts de muscle : une échelle, pas quatre couleurs ----
           Les segments de la barre empilée, du dominant au plus discret (#49).
           L'ordre porte le sens : c'est un rang, donc les tokens se lisent
           comme un rang. Le dominant se repère à sa largeur et à sa clarté,
           sans légende.

           2026-09-26 : la maquette « Fiche exercice » (#119) pose le dominant
           et le second dans l'accent (accent-400, accent-700), le reste en
           neutre. #49 les tenait hors de l'accent parce que l'accent était un
           ambre qui voulait dire « alerte » ailleurs ; la lavande de Nocturne
           ne porte plus ce sens, et c'est la maquette validée qui tranche. */
        "share-1": "#b5abfc",
        "share-2": "#5d5294",
        "share-3": "#595d6c",
        "share-4": "#3f424d",                 // et tous les suivants

        /* ---- Phases du cycle (#107, #114) ----
           Un repère de lecture sur douze semaines, pas un accent ni un
           statut : cinq tons distincts, définis une fois et repris tels
           quels par la timeline de l'index Programme et par la frise de
           Référence. Repris de la maquette : neutre → accent, jamais une
           teinte par phase — c'est ce qui les rend coordonnés plutôt que
           « jaune bleu violet vert ». */
        "phase-calib": "#9397ab",
        "phase-b1": "#796cbf",
        "phase-deload": "#595d6c",
        "phase-b2": "#b5abfc",
        "phase-bilan": "#e7e5fe",
      },
    },
  },
  plugins: [],
};
