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
                        1 -> 2 avec #25 : un fichier peut désormais porter
                        un `program` data-only (registre fermé) ; un
                        fichier à la version 1 ou sans version continue de
                        charger (le champ est optionnel).
   DEFAULT_DEFINITION   le cycle fourni avec l'appli, sous la même forme
                        qu'un fichier chargé — buildProgram()/buildPlan()
                        ne distinguent pas les deux. Vit dans
                        src/default-program.js depuis #25 (re-exporté ici
                        pour une version) ; formatVersion y est codé en
                        dur à 2 pour éviter un cycle d'import avec ce
                        module — les deux doivent rester synchronisés.
   parseLocalDate(iso)  Date locale (minuit local) depuis une chaîne
                        "AAAA-MM-JJ", en construisant depuis les
                        composantes pour éviter le piège UTC de
                        new Date("AAAA-MM-JJ"). Généralise l'ancien
                        startDate() de profile.js (#5) à une date reçue,
                        pas seulement celle du profil par défaut.
   ========================================================= */

export const DEFINITION_FORMAT_VERSION = 2;

export { DEFAULT_DEFINITION } from "./default-program.js";

export function parseLocalDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
