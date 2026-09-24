/* =========================================================
   Politiques de cycle — la structure devient une donnée (#14)

   Avant cette issue, la forme du cycle était un jeu de numéros de semaine
   compilés en flot de contrôle, à cinq endroits indépendants : `phaseOf`,
   `blockOf`, `setsFor`, quatre tests `week === 7` dans `planned()`, et la
   règle AMRAP de la semaine 12 dans App.jsx. Rien ne le lisait dans la
   donnée, et quelqu'un qui décharge toutes les 4 semaines — ou jamais —
   n'était pas représentable du tout.

   Ce module porte trois politiques et deux fonctions pures. Il n'importe
   rien : c'est une feuille, comme `units.js`, et c'est ce qui permet à
   `progression.js` de le lire sans cesser d'en être une lui-même
   (ARCHITECTURE §1).

   **Deux déclencheurs qui n'ont rien à voir, et qui étaient fusionnés.**
   « Semaine 7 » voulait dire à la fois *coupe le volume* et *change de
   variante*. Le premier répond à la fatigue, le second au plateau ou à
   l'envie. Laissés ensemble, quelqu'un qui décharge toutes les 4 semaines
   changerait aussi d'exercices toutes les 4 semaines — ce que personne n'a
   demandé. `deload` et `rotation` sont donc deux politiques séparées, et
   `DEFAULT_POLICIES` se contente de les faire coïncider, comme aujourd'hui.

   **Recommander, jamais imposer.** `evaluateDeload()` rend un avis et ses
   raisons ; `startDeload()` — le geste — doit exister sans elle, parce
   qu'on décharge aussi pour des vacances ou une grippe. Un déclencheur
   automatique n'est qu'une raison de *proposer*.
   ========================================================= */

/* La forme d'aujourd'hui, écrite comme une donnée pour la première fois.

   `everyNWeeks: 6` produit une décharge en semaine 7 — six semaines de
   travail, puis la coupe — puis en 14, 21… La rotation partage le même
   rythme, ce qui reproduit exactement le cycle livré : bloc 1 de 1 à 6,
   bloc 2 de 7 à 12.

   Les facteurs sont ceux que le code portait en dur : le volume de moitié
   (`Math.ceil(n / 2)` dans `setsFor`) et la charge à 85 % (`roundTo(next *
   0.85)` dans `planned`).

   `signalThreshold: 3` est la valeur de départ de l'issue, à régler à
   l'usage. Elle ne sert qu'à `evaluateDeload()`, jamais au calendrier. */
export const DEFAULT_POLICIES = Object.freeze({
  deload: Object.freeze({ everyNWeeks: 6, loadFactor: 0.85, volumeFactor: 0.5, signalThreshold: 3 }),
  rotation: Object.freeze({ mode: "everyNWeeks", n: 6 }),
  test: Object.freeze({ mode: "manual" }),
});

const isObj = (x) => typeof x === "object" && x !== null && !Array.isArray(x);

/* Les politiques d'un programme, complétées par celles par défaut.

   Un programme d'avant #14 n'a pas de `policies` — et son absence doit se
   lire « la forme livrée », pas « aucune politique », sans quoi tous les
   journaux déjà tenus cesseraient de décharger. C'est le même raisonnement
   que pour `sub` dans #55, pris dans l'autre sens : là l'absence disait
   « rien », ici elle dit « comme avant ».

   La fusion est champ par champ au premier niveau seulement. `deload: null`
   est donc une valeur, pas une absence : elle veut dire « ne décharge
   jamais », et le repli ne doit surtout pas la rattraper. */
export function resolvePolicies(program) {
  const p = isObj(program) && isObj(program.policies) ? program.policies : {};
  return {
    deload: "deload" in p ? (isObj(p.deload) ? { ...DEFAULT_POLICIES.deload, ...p.deload } : null) : DEFAULT_POLICIES.deload,
    rotation: isObj(p.rotation) ? { ...DEFAULT_POLICIES.rotation, ...p.rotation } : DEFAULT_POLICIES.rotation,
    test: isObj(p.test) ? { ...DEFAULT_POLICIES.test, ...p.test } : DEFAULT_POLICIES.test,
  };
}

/* ---------- La forme du cycle, lue dans les politiques ---------- */

/* Une semaine de décharge tombe après chaque bloc de `everyNWeeks` semaines
   de travail : la 7e quand on en fait six, la 5e quand on en fait quatre.
   D'où le modulo sur `n + 1` — la semaine de décharge fait partie du cycle
   qu'elle termine.

   `deload: null` ou `everyNWeeks: null` ne déchargent jamais : c'est le
   critère « un programme avec deload: null ne coupe jamais, jamais ». */
export function isDeloadWeek(week, deload) {
  if (!deload) return false;
  /* #14 : une décharge décidée à la main — vacances, grippe, ou une
     recommandation acceptée — force sa semaine, quel que soit le calendrier.

     C'est **le seul** point où la décision entre dans le système, et c'est
     voulu : `setsForWeek`, `kindForWeek`, `phaseFor` et la coupe de charge de
     `planned()` passent tous par ici. Les brancher un par un aurait laissé
     quatre occasions de se désaccorder — c'est exactement le défaut que cette
     issue corrige, en plus petit.

     Elle s'ajoute au calendrier plutôt que de le remplacer : accepter une
     décharge maintenant ne décale pas les suivantes. `deload: null` reste
     souverain — quelqu'un qui ne décharge jamais n'accepte pas non plus une
     recommandation, puisqu'il n'y en a pas. */
  if (Array.isArray(deload.forcedWeeks) && deload.forcedWeeks.includes(week)) return true;
  const n = deload.everyNWeeks;
  if (!Number.isInteger(n) || n < 1) return false;
  return week % (n + 1) === 0;
}

/* Les politiques, plus les semaines qu'on a décidé de décharger.

   Rend l'objet reçu tel quel quand il n'y a rien à forcer : un objet neuf à
   chaque rendu défait tout `useMemo` qui en dépend (#22, le piège que
   `App.jsx` a déjà payé une fois). */
export function withForcedDeloads(policies, weeks) {
  const pol = policies || DEFAULT_POLICIES;
  if (!pol.deload || !Array.isArray(weeks) || weeks.length === 0) return pol;
  return { ...pol, deload: { ...pol.deload, forcedWeeks: weeks } };
}

/* Le rang du bloc de variantes, à partir de 1. Avec deux variantes par
   créneau (`b1` / `b2`), `variantOf` alterne ; un programme qui en porterait
   trois lirait ce rang directement. */
export function blockIndex(week, rotation) {
  const r = rotation || DEFAULT_POLICIES.rotation;
  if (r.mode !== "everyNWeeks") return 1; // "none", et "onPlateau" tant qu'il n'est pas construit
  const n = Number.isInteger(r.n) && r.n > 0 ? r.n : DEFAULT_POLICIES.rotation.n;
  return Math.floor((week - 1) / n) + 1;
}

/* La variante à exécuter. Deux clés seulement dans le format actuel, donc
   les blocs de rang impair prennent `b1` et les pairs `b2` — un cycle qui
   irait au-delà du second bloc revient sur le premier plutôt que de lire une
   clé qui n'existe pas. */
export const variantOf = (week, rotation) => (blockIndex(week, rotation) % 2 === 1 ? "b1" : "b2");

/* Le nombre de séries d'un créneau pour cette semaine : coupé par
   `volumeFactor` en décharge, intact sinon. `Math.ceil` garde au moins une
   série — une décharge allège, elle ne supprime pas la séance. */
export function setsForWeek(n, week, deload) {
  if (!isDeloadWeek(week, deload)) return n;
  const f = typeof deload.volumeFactor === "number" && deload.volumeFactor > 0 ? deload.volumeFactor : DEFAULT_POLICIES.deload.volumeFactor;
  return Math.ceil(n * f);
}

/* Le genre stocké sur une séance validée. Il pilote le moteur — une séance
   de décharge ou de calibration ne sert pas de base au calcul suivant — donc
   il se dérive de la politique, jamais d'un numéro écrit en dur. */
export const kindForWeek = (week, policies) =>
  week === 1 ? "calibration" : isDeloadWeek(week, (policies || DEFAULT_POLICIES).deload) ? "deload" : "normal";

/* Phase affichée : identifiant, libellé, RIR cible.

   `weeks` sert à la seule semaine bilan — la dernière du programme. Elle
   était écrite « <= 11 puis sinon », ce qui fixait douze semaines dans une
   fonction qui n'en savait rien.

   Les cinq identifiants rendus sont **exactement** ceux que `PHASE_NOTES`
   (plan.js) indexe : calib, b1, deload, b2, bilan. Un test de `plan.test.js`
   tient cette bijection, et c'est lui qui a rattrapé la première version de
   cette fonction — elle rendait `b2` pour la dernière semaine, ce qui faisait
   disparaître la note de la semaine bilan de l'écran sans rien casser
   d'autre.

   `b1`/`b2` y désignent la *note éditoriale* du bloc, pas la clé de
   variante : un cycle à trois blocs retombe sur la note du bloc 2, ce qui
   reste juste — « on est installé dans le cycle » — là où un identifiant
   inconnu ferait un trou. */
export function phaseFor(week, policies, weeks) {
  const pol = policies || DEFAULT_POLICIES;
  if (week === 1) return { id: "calib", label: "Calibration", rir: "2–3" };
  const bloc = blockIndex(week, pol.rotation);
  if (isDeloadWeek(week, pol.deload)) {
    return { id: "deload", label: `Décharge et calibration du bloc ${bloc}`, rir: "3–4" };
  }
  if (weeks != null && week >= weeks) return { id: "bilan", label: `Bloc ${bloc}, semaine bilan`, rir: "1" };
  return { id: bloc <= 1 ? "b1" : "b2", label: `Bloc ${bloc}`, rir: "1" };
}

/* ---------- L'évaluation macro : faut-il décharger ? ---------- */

const SKIPPED = new Set(["deload", "calibration", "allege", "test"]);

/* Score additif, pas un moteur de règles (choix explicite de l'issue). Trois
   signaux, trois poids, un seuil — et l'avis nomme ses raisons, parce qu'une
   recommandation qu'on ne peut pas contester n'est pas discutable, elle est
   subie.

   Entrées, toutes dérivables de ce que l'appli calcule déjà :

     keyLifts   [{ name, history: [{ date, kind, load, sets }] }]
                l'historique d'un exercice clé, le plus ancien d'abord, tel
                que `history()` le rend — `load` étant la charge de travail
                de `workingSets()`, celle sur laquelle le moteur se prononce.
     checkins   [{ date, sleep }] — sommeil sur 5. Seul signal qui demande
                une saisie : deux questions au début d'une séance, dix
                secondes, sinon personne ne les remplit.
     lastDeload date ISO de la dernière décharge, ou null.

   La douleur n'entre pas dans le score, et c'est délibéré (l'issue le dit) :
   elle appelle une action locale sur l'exercice fautif — alléger ou
   substituer, ce que #55 permet désormais — pas une coupe générale.

   Pure : aucune lecture du journal, aucune date implicite. `today` est reçu.

   Rend { recommended, score, reasons[] }, `reasons` étant du texte destiné à
   être lu tel quel. */
export function evaluateDeload(signals, deload, today) {
  const pol = deload || DEFAULT_POLICIES.deload;
  const threshold = Number.isFinite(pol.signalThreshold) ? pol.signalThreshold : DEFAULT_POLICIES.deload.signalThreshold;
  /* `?? []` et non un défaut de déstructuration : celui-ci ne se déclenche que
     sur `undefined`, et un appelant qui passe `keyLifts: null` — ce que fait
     App.jsx quand aucun créneau clé n'est encore résolu — ferait lever. Une
     fonction d'avis ne lève jamais (ARCHITECTURE §2.4). */
  const s = signals || {};
  const keyLifts = Array.isArray(s.keyLifts) ? s.keyLifts : [];
  const checkins = Array.isArray(s.checkins) ? s.checkins : [];
  const lastDeload = s.lastDeload ?? null;
  const reasons = [];
  let score = 0;

  /* Hystérésis. Sans elle, l'avis ping-pongue : une décharge améliore les
     signaux la semaine suivante, puis ils se dégradent à nouveau, et la
     proposition revient avant que la première ait produit son effet. Trois
     semaines est la valeur de départ de l'issue. */
  const since = daysBetween(lastDeload, today);
  if (since != null && since < HYSTERESIS_DAYS) {
    return { recommended: false, score: 0, reasons: [`Décharge il y a ${since} jour${since > 1 ? "s" : ""} : trop tôt pour en proposer une autre.`] };
  }

  /* Signal 1 — régression sur au moins deux exercices clés, sur les deux
     dernières séances comparables. Le plus lourd des trois : c'est le seul
     qui soit entièrement objectif, et il mesure ce que le programme est censé
     produire. */
  const regressed = keyLifts.filter((l) => hasRegressed(l));
  if (regressed.length >= 2) {
    score += 2;
    reasons.push(`Charge en baisse sur ${regressed.length} exercices clés : ${regressed.map((l) => l.name).join(", ")}.`);
  }

  /* Signal 2 — sommeil moyen sous 3/5 sur les sept derniers jours. */
  const recent = checkins.filter((c) => c && Number.isFinite(c.sleep) && withinDays(c.date, today, 7));
  if (recent.length) {
    const mean = recent.reduce((a, c) => a + c.sleep, 0) / recent.length;
    if (mean < 3) {
      score += 1;
      reasons.push(`Sommeil moyen à ${mean.toFixed(1)}/5 sur sept jours.`);
    }
  }

  /* Signal 3 — la réserve déclarée dérive vers le haut à charge égale : on
     fournit le même travail en le trouvant plus dur. */
  const drifting = keyLifts.filter((l) => hasRirDrift(l));
  if (drifting.length) {
    score += 1;
    reasons.push(`Effort perçu en hausse à charge égale : ${drifting.map((l) => l.name).join(", ")}.`);
  }

  return { recommended: score >= threshold, score, reasons };
}

export const HYSTERESIS_DAYS = 21;

/* Les deux dernières séances qui comptent : une décharge, une calibration,
   une séance allégée (#43) ou un test ne sont pas des points de comparaison
   — c'est la même liste que `SKIPPED_AS_BASE` du moteur micro, et pour la
   même raison. */
const comparable = (history) => (history || []).filter((e) => e && !SKIPPED.has(e.kind) && e.load != null);

function hasRegressed(lift) {
  const h = comparable(lift && lift.history);
  if (h.length < 2) return false;
  return h[h.length - 1].load < h[h.length - 2].load;
}

/* Même charge, même exercice, et un RIR moyen qui monte d'au moins un point.
   « Charge égale » est exigé : un RIR qui monte parce qu'on a allégé ne dit
   rien de la fatigue. */
function hasRirDrift(lift) {
  const h = comparable(lift && lift.history);
  if (h.length < 2) return false;
  const a = h[h.length - 2], b = h[h.length - 1];
  if (a.load !== b.load) return false;
  const ra = meanRir(a.sets), rb = meanRir(b.sets);
  return ra != null && rb != null && rb - ra >= 1;
}

function meanRir(sets) {
  const xs = (sets || []).map((s) => s && s.rir).filter((x) => Number.isFinite(x));
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/* Dates ISO seules, comparées en UTC — même prudence que `slotForDate`
   (schema.js) : une soustraction de dates locales traverse deux changements
   d'heure par an et décale le compte d'un jour pendant sept mois. */
function daysBetween(fromIso, toIso) {
  const utc = (iso) => {
    if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const a = utc(fromIso), b = utc(toIso);
  if (a == null || b == null) return null;
  return Math.round((b - a) / 86400000);
}

const withinDays = (dateIso, todayIso, n) => {
  const d = daysBetween(dateIso, todayIso);
  return d != null && d >= 0 && d < n;
};
