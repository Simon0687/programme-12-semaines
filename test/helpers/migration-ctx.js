import { buildProgram } from "../../src/program.js";
import { DEFAULT_DEFINITION } from "../../src/default-program.js";

/* Contexte injecté dans migrate()/MIGRATIONS[2] (#16) : schema.js ne peut pas
   importer program.js / default-program.js sans créer un cycle (ces modules
   importent déjà schema.js pour DEFAULT_PROGRAM_ID), donc l'appelant (ici les
   tests, en prod App.jsx) fournit buildProgram/defaultDefinition. Le vrai
   programme par défaut est utilisé plutôt qu'un stub : les tests de migration
   exercent la vraie forme de SESSIONS, pas une approximation. */
export function testCtx() {
  return { defaultDefinition: DEFAULT_DEFINITION, buildProgram };
}
