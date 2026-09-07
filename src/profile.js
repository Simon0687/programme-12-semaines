/* =========================================================
   Profil utilisateur — Simon (#5)

   Foyer unique de tout ce qui change d'un cycle à l'autre. Aucun
   import, aucune logique de programme. Consommé par :
     - src/program.js : STARTING_LOADS refold sur V au chargement ;
     - src/App.jsx    : startDate() pour le calendrier ;
     - src/plan.js    : PROFILE / STARTING_LOADS pour composer les
                        chiffres cités dans l'onglet Plan.
   #6 alimentera ce module depuis un fichier JSON.

   ---------------------------------------------------------
   START_DATE      lundi de la S1, chaîne ISO "AAAA-MM-JJ".
   startDate()     -> Date locale (minuit local), construite depuis
                      les composantes pour éviter le piège UTC de
                      new Date("AAAA-MM-JJ").
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

export const startDate = () => {
  const [y, m, d] = START_DATE.split("-").map(Number);
  return new Date(y, m - 1, d);
};

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
