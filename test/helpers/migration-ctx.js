import { buildProgram } from "../../src/program.js";
import { LEGACY_DEFINITION } from "../../src/legacy-program.js";

/* Contexte injecté dans migrate()/MIGRATIONS[2] (#16) : schema.js ne peut pas
   importer program.js / legacy-program.js sans créer un cycle (ces modules
   importent déjà schema.js), donc l'appelant (ici les tests, en prod App.jsx)
   fournit buildProgram/legacyDefinition. Le vrai programme hérité est utilisé
   plutôt qu'un stub : les tests de migration exercent la vraie forme de
   SESSIONS, pas une approximation.

   #26 : c'est bien le programme *hérité* qui est injecté, pas le bundle
   courant. Un journal migré a été tenu contre celui-là, et les deux vont
   diverger. */
export function testCtx() {
  return { legacyDefinition: LEGACY_DEFINITION, buildProgram };
}
