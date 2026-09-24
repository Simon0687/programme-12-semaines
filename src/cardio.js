/* =========================================================
   Cardio et mobilité — catalogue, courbe, et résolution (#25, #34)

   #34, option 3 : le conditionnement se découpe comme une prescription de
   force, et pas autrement. L'application le faisait déjà en quatre termes
   pour les charges ; il n'y avait pas besoin d'un cinquième modèle, il
   fallait appliquer le même.

     registre d'exercices      -> MODALITIES ici : ce qui existe
     program.SLOTS             -> program.cardio.sessions : quoi, quel jour
     definition.startingLoads  -> definition.cardioBaseline : les nombres de
                                  *cette* personne
     progression.js            -> cardioCurve() ici : comment ça monte

   C'est le troisième terme qui manquait, et c'est lui qui a produit le
   bogue. « ~105–115 W, 130–138 bpm » n'est ni de la méthode ni de la
   structure : c'est une mesure faite sur un corps un jour donné, au même
   titre que 87,5 kg au développé couché. La ranger avec la courbe est une
   erreur de catégorie, et tout programme qui demandait du cardio héritait
   donc des watts de Simon.

   ---------------------------------------------------------
   MODALITIES[m]      catalogue fermé — la même fermeture que #25 sur les
                      exercices, pour la même raison : un programme généré
                      ou importé ne doit pas pouvoir inventer une modalité.
   KIND_LABELS[k]     « Z2 » / « intervalles ».
   BASELINE_TERMS     ordre et rendu des nombres d'une personne.
   DEFAULT_CARDIO     la structure de Simon, telle qu'elle était écrite en
   DEFAULT_BASELINE   dur avant #34. Conservées **uniquement** pour que
                      `cardio: "default"` continue de résoudre exactement ce
                      qu'il résolvait (ARCHITECTURE 2.1) : des journaux
                      stockés portent cette chaîne dans leur définition.
   resolveCardio(spec, baseline)
                      -> { cardioPlan, CARDIO_ITEMS, MOB_DAYS } ou {}.
   AFTER_HINTS / AFTER_KINDS   indices post-séance (#22, #33).
   ---------------------------------------------------------

   Ce module ne nomme jamais un jour. `CARDIO_ITEMS` porte `day` — un
   décalage de 1 à 7 depuis startDate, la convention unique de #39 — et
   c'est `cardioWhen()` (display.js) qui en fait « mercredi, après Haut B ».
   C'est ce qui laisse ce fichier sans import : il porte de la méthode et un
   catalogue, pas de l'interface.
   ========================================================= */

/* Modalités. `terms` dit quels nombres d'une personne ont un sens sur cet
   appareil : un drag factor ne veut rien dire sur un tapis, et une
   prescription qui l'affiche quand même apprend à ne plus la lire.
   `intervalTail` porte ce que la consigne d'intervalles doit ajouter — le
   rameur est le seul à en avoir une, et c'est ce qui laisse les chaînes du
   programme de Simon inchangées au caractère près. */
export const MODALITIES = {
  rameur: {
    label: "Rameur",
    terms: ["power", "hr", "cadence", "drag"],
    intervalTail: { b1: " Cadence 24–28, drag factor modéré.", b2: ", cadence 24–28." },
  },
  velo: { label: "Vélo", terms: ["power", "hr", "cadence"], intervalTail: { b1: "", b2: "." } },
  marche: { label: "Marche inclinée", terms: ["hr"], intervalTail: { b1: "", b2: "." } },
  course: { label: "Course", terms: ["hr"], intervalTail: { b1: "", b2: "." } },
  elliptique: { label: "Elliptique", terms: ["hr", "cadence"], intervalTail: { b1: "", b2: "." } },
};

export const MODALITY_IDS = new Set(Object.keys(MODALITIES));

export const KIND_LABELS = { z2: "Z2", intervals: "intervalles" };
export const CARDIO_KINDS = Object.keys(KIND_LABELS);

/* Les nombres d'une personne, dans l'ordre où la prescription les dit. Une
   borne absente ne laisse pas de trou : le terme disparaît. */
export const BASELINE_TERMS = {
  power: ([a, b]) => `~${a}–${b} W`,
  hr: ([a, b]) => `${a}–${b} bpm`,
  cadence: ([a, b]) => `cadence ${a}–${b}`,
  drag: ([a, b]) => `drag factor ${a}–${b}`,
};

export const BASELINE_KEYS = Object.keys(BASELINE_TERMS);

/* ---------- La courbe : de la méthode, comme progression.js ----------

   Elle ne descend pas dans le format, et c'est une décision
   (decisions-spec.md Q2). Elle lit un numéro de semaine — S7 pour la
   décharge, S1/S7/S12 sans intervalles — exactement comme `phaseOf()` et
   `setsFor()`, et #14 viendra remplacer les trois au même endroit. Porter
   ces seuils en donnée reviendrait à inventer un second vocabulaire de
   périodisation avant que le premier n'existe, donc à garantir deux
   migrations au lieu d'une. */
const z2Minutes = (w) => (w === 7 ? 30 : Math.min(60, 35 + 5 * Math.floor((w - 1) / 2)));

/* Exporté parce que l'onglet Plan dit les mêmes cibles que la check-list, et
   qu'une seconde composition les ferait diverger au premier ajout de terme. */
export const cardioTargets = (modality, baseline) => {
  const m = MODALITIES[modality];
  if (!m || !baseline) return "";
  return m.terms
    .filter((t) => Array.isArray(baseline[t]) && baseline[t].length >= 2)
    .map((t) => BASELINE_TERMS[t](baseline[t]))
    .join(", ");
};

/* La phrase de recalibrage de S1 finit sur « sinon −5 W », qui n'a de sens
   que si une puissance est prescrite. Sans elle, la consigne s'arrête sur la
   dérive de fréquence cardiaque, qui reste vraie partout. */
const calibrationNote = (baseline) =>
  " Recalibrer : allure où tu peux parler, dérive de FC < 5 % sur 30 min à puissance fixe"
  + (baseline && baseline.power ? ", sinon −5 W." : ".");

export function cardioCurve(w, { modality, baseline }) {
  const targets = cardioTargets(modality, baseline);
  const tail = (MODALITIES[modality] || MODALITIES.rameur).intervalTail;
  const intervals =
    w >= 2 && w <= 6 ? `4 × 4 min en Z4 (~150–165 bpm), 3 min récup entre, 5 min échauffement et retour au calme.${tail.b1}`
    : w >= 8 && w <= 11 ? `5 × 4 min en Z4 (~150–165 bpm), 3 min récup${tail.b2}`
    : null;
  return {
    z2: `${z2Minutes(w)} min Z2${targets ? ` : ${targets}` : ""}.${w === 1 ? calibrationNote(baseline) : ""}`,
    intervals,
    mob: "10–15 min : McGill Big 3 en pyramide descendante (curl-up modifié, planche latérale, bird dog ; 6-4-2 tenues de 8–10 s), 90/90 + couch stretch, extension et rotation thoracique, CARs d'épaule + rotation externe.",
  };
}

/* ---------- La structure de Simon, figée ----------

   Elle n'est le défaut de personne : `haut-bas-5j.json` porte désormais la
   sienne en clair. Ces deux constantes n'existent que pour honorer la chaîne
   `"default"`, qui est écrite dans des journaux déjà stockés et doit
   continuer de résoudre exactement la même chose. Un test l'épingle au
   caractère, sur les douze semaines. */
export const DEFAULT_CARDIO = {
  sessions: [
    { id: "z2a", modality: "rameur", kind: "z2", day: 3, anchor: "hautB", note: "ou le soir" },
    { id: "int", modality: "rameur", kind: "intervals", day: 4 },
    { id: "z2b", modality: "rameur", kind: "z2", day: 7 },
  ],
  mobility: { days: [2, 4, 7] },
};

export const DEFAULT_BASELINE = { power: [105, 115], hr: [130, 138], cadence: [18, 20], drag: [110, 120] };

/* ---------- Résolution ----------

   Rend la forme que les écrans consomment depuis #13 : `cardioPlan(w)`,
   `CARDIO_ITEMS`, `MOB_DAYS`. Un bundle sans cardio rend `{}`, et les trois
   `has*()` de program.js décident de l'affordance — inchangé.

   `CARDIO_ITEMS[].when` a disparu au profit de `day`, `anchor` et `note`.
   Une chaîne pré-composée ne pouvait pas nommer la séance d'ancrage sans que
   ce module connaisse SESSIONS, et « mercredi, après Haut B » écrit en dur
   est précisément le défaut que #34 corrige.

   Une seule modalité par genre : le validateur l'impose, parce que
   `cardioPlan(w).z2` est une phrase unique et qu'un programme mêlant rameur
   et course en Z2 n'aurait pas de prescription à lui donner. Une contrainte
   vérifiable plutôt qu'une ambiguïté silencieuse. */
/* Un seul endroit résout l'alias hérité et le repli par omission : l'onglet
   Plan et la check-list de Semaine décrivent le même conditionnement, et
   deux résolutions séparées finiraient par ne plus le faire. */
export function normalizeCardio(spec, baseline) {
  const legacy = spec === "default" || spec === undefined;
  const s = legacy ? DEFAULT_CARDIO : spec;
  const b = legacy ? DEFAULT_BASELINE : baseline || null;
  if (!s || typeof s !== "object") return null;
  return {
    sessions: Array.isArray(s.sessions) ? s.sessions : [],
    mobilityDays: Array.isArray(s.mobility && s.mobility.days) ? [...s.mobility.days].sort((x, y) => x - y) : [],
    baseline: b,
    modalityOf(kind) { return (this.sessions.find((x) => x.kind === kind) || {}).modality; },
  };
}

export function resolveCardio(spec, baseline) {
  const n = normalizeCardio(spec, baseline);
  if (!n) return {};
  const { sessions, baseline: b } = n;
  const modalityOf = (kind) => n.modalityOf(kind);

  const CARDIO_ITEMS = sessions.map((x) => ({
    id: x.id,
    kind: x.kind,
    label: `${(MODALITIES[x.modality] || {}).label || x.modality} ${KIND_LABELS[x.kind] || x.kind}`,
    day: x.day,
    anchor: x.anchor || null,
    note: x.note || null,
  }));

  const MOB_DAYS = n.mobilityDays;

  return {
    cardioPlan: (w) => {
      const z2 = cardioCurve(w, { modality: modalityOf("z2"), baseline: b });
      const iv = cardioCurve(w, { modality: modalityOf("intervals"), baseline: b });
      /* `z2Label` ne sert qu'à AFTER_HINTS, qui écrivait « rameur » en dur.
         En minuscules parce qu'il arrive en milieu de phrase. */
      const label = (MODALITIES[modalityOf("z2")] || {}).label;
      return { z2: z2.z2, intervals: iv.intervals, mob: z2.mob, z2Label: label ? label.toLowerCase() : null };
    },
    CARDIO_ITEMS,
    MOB_DAYS,
  };
}

/* Indices post-séance (#22, déplacés ici depuis App.jsx par #33).
   Fonctions pures de cardioPlan(week) : elles n'ont jamais eu besoin de
   React, et elles décrivent la règle cardio — leur place est à côté d'elle.
   Le déplacement sert surtout à supprimer une source de vérité : le
   validateur (src/journal-shape.js) contrôle session.after contre
   AFTER_KINDS, donc le format ne peut plus accepter une valeur que l'appli
   ne sait pas rendre.

   #34 : « rameur » n'est plus écrit en dur — l'indice nomme la modalité du
   programme actif, ou reste générique quand il n'y en a pas. */
export const AFTER_HINTS = {
  z2: (cardio) => `${cardio.z2Label || "cardio"} Z2, ${cardio.z2}`,
  mob: (cardio) => `bloc mobilité, ${cardio.mob}`,
};

export const AFTER_KINDS = Object.keys(AFTER_HINTS);
