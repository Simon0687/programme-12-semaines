/* =========================================================
   Définition de programme — format de fichier (#6)

   Une définition décrit un cycle : profil, charges de départ, date de
   départ, et optionnellement un catalogue d'exercices custom (program).
   parseProgramImport() (src/import.js) en produit le verdict de lecture ;
   ce module ne porte que la donnée et un helper de date, aucune logique
   de validation.

   DEFINITION_FORMAT_VERSION  version courante du format de fichier.
                        Déclarée ici et nulle part ailleurs (comme
                        SCHEMA_VERSION pour le journal) ; lue par
                        parseProgramImport() pour refuser un fichier plus
                        récent. Indépendante de SCHEMA_VERSION : un bump du
                        schéma du journal n'oblige pas à bumper le format.
   DEFAULT_DEFINITION   le cycle fourni avec l'appli, sous la même forme
                        qu'un fichier chargé — buildProgram()/buildPlan()
                        ne distinguent pas les deux.
   parseLocalDate(iso)  Date locale (minuit local) depuis une chaîne
                        "AAAA-MM-JJ", en construisant depuis les
                        composantes pour éviter le piège UTC de
                        new Date("AAAA-MM-JJ"). Généralise l'ancien
                        startDate() de profile.js (#5) à une date reçue,
                        pas seulement celle du profil par défaut.
   ========================================================= */

import { DEFAULT_PROGRAM_ID } from "./schema.js";
import { START_DATE, STARTING_LOADS, PROFILE } from "./profile.js";

export const DEFINITION_FORMAT_VERSION = 1;

export const DEFAULT_DEFINITION = {
  formatVersion: DEFINITION_FORMAT_VERSION,
  id: DEFAULT_PROGRAM_ID,
  name: "Simon — 12 semaines",
  weeks: 12,
  startDate: START_DATE,
  profile: PROFILE,
  startingLoads: STARTING_LOADS,
};

export function parseLocalDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
