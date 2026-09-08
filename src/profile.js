/* =========================================================
   Profil utilisateur — Simon (#5)

   Le cycle par défaut de l'appli, sous la forme d'une définition de
   programme (src/definition.js : DEFAULT_DEFINITION). Aucun import,
   aucune logique de programme.
   #6 : un fichier chargé fournit son propre profil/startingLoads, sous
   la même forme — ce module ne porte plus que les valeurs par défaut.

   ---------------------------------------------------------
   START_DATE      lundi de la S1, chaîne ISO "AAAA-MM-JJ". Lue par
                      parseLocalDate() (src/definition.js).
   STARTING_LOADS  charge de travail en S1, en kg, par id de variante.
                      Refold sur V.<id>.start dans src/program.js.
                      pullup: 0 = poids du corps (valeur réelle, pas
                      « absent » : à distinguer d'une variante sans
                      entrée, qui part en « Paliers »).
   PROFILE         valeurs personnelles citées dans l'onglet Plan.
     bodyweightKg / heightCm / birthdate  — non affichés en #5,
                      présents pour #6 et la liste de l'issue.
     maintenanceKcal / startKcal / macros {p,f,c} / targetWeightKg
                      [min, max]  — cibles vives, interpolées dans
                      src/plan.js (section Nutrition).
   ========================================================= */

export const START_DATE = "2026-09-07";

export const STARTING_LOADS = {
  dc: 72.5,
  incl_db: 30,
  squat: 105,
  ohp_db: 26,
  pullup: 0,
  pd_close: 90,
};

export const PROFILE = {
  bodyweightKg: 90,
  heightCm: 193,
  birthdate: "1987-06-18",
  maintenanceKcal: 3150,
  startKcal: 3400,
  macros: { p: 185, f: 85, c: 470 },
  targetWeightKg: [92.5, 93.5],
};
