/* =========================================================
   ESLint — la règle que le code désactivait déjà (#89)

   `App.jsx` portait un `// eslint-disable-next-line
   react-hooks/exhaustive-deps` alors qu'aucun ESLint n'existait dans le
   dépôt : le commentaire ne désactivait rien. Dans un composant qui compte
   trente-cinq `useState`, dix-sept `useMemo` et six `useEffect`,
   `exhaustive-deps` attrape une classe de défauts que la suite ne peut pas
   voir — aucun test ne monte React.

   **Ce que cette configuration n'est pas.** Elle n'est pas un style guide.
   L'issue posait une condition : un linter installé puis noyé sous deux cents
   `disable` est pire que pas de linter. La première passe a rendu 221
   signalements, dont **trois** venaient de `react-hooks` ; les 218 autres
   étaient des défauts de configuration — des globaux de navigateur non
   déclarés, un `catch (e)` délibérément muet, une destructuration `...rest`.
   Le remède est la configuration ci-dessous, pas un `disable` par ligne.

   Les environnements sont déclarés par dossier parce qu'ils diffèrent
   réellement : `src/` tourne dans un navigateur, `test/` sous node, le
   service worker dans son propre contexte. Un seul bloc « tous les globaux
   partout » ferait passer un `document` dans un test, qui échouerait à
   l'exécution sans que rien ne l'ait signalé.
   ========================================================= */

import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";
import globals from "globals";

/* `caughtErrors: "none"` et `ignoreRestSiblings: true` ne sont pas des
   indulgences : les deux formes sont employées ici *pour* ignorer une valeur.
   `catch (e) { /* stockage indisponible *\/ }` dit que l'erreur n'a pas à être
   lue, et `const { intent, ...reste } = def` retire un champ en le nommant.
   Les signaler apprendrait à passer outre les signalements. */
const unused = ["error", { caughtErrors: "none", ignoreRestSiblings: true, argsIgnorePattern: "^_" }];

export default [
  {
    ignores: [
      "public/dist/**",
      /* Artefacts d'une revue de design importée, pas du code de ce dépôt. */
      "design/**",
    ],
  },
  js.configs.recommended,
  {
    /* `latest` et non 2023 : `import ... with { type: "json" }` est la forme
       que default-program.js emploie pour charger le programme livré. */
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    rules: { "no-unused-vars": unused },
  },
  {
    files: ["src/**/*.js", "src/**/*.jsx"],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks, react },
    rules: {
      /* Une erreur : un hook appelé sous condition est un défaut, pas un avis. */
      "react-hooks/rules-of-hooks": "error",
      /* Un avertissement : la règle a des faux positifs connus, et la seule
         réponse honnête à l'un d'eux est un `disable` commenté, cas par cas. */
      "react-hooks/exhaustive-deps": "warn",
      /* La seule règle prise à eslint-plugin-react, et pas son jeu complet :
         sans elle, `no-unused-vars` ne voit pas qu'un composant importé est
         employé dans du JSX et signale chaque import de `lucide-react`. Ce
         n'est pas un style guide qui entre ici, c'est ce qui rend
         `no-unused-vars` utilisable sur un fichier .jsx. */
      "react/jsx-uses-vars": "error",
    },
  },
  {
    files: ["test/**/*.js", "scripts/**/*.mjs", "eslint.config.js"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["public/sw.js"],
    languageOptions: { globals: { ...globals.serviceworker, ...globals.browser } },
  },
  {
    files: ["tailwind.config.js"],
    languageOptions: { sourceType: "commonjs", globals: globals.node },
  },
];
