/* =========================================================
   Moteur de progression — charges prévues (#2)

   history() / lastEntry() / planned() / loadText() extraits de App.jsx
   sans changement de comportement, avec les petits helpers purs dont ils
   dépendent (num, fmt, roundTo, blockOf, phaseOf, setsFor). Aucun import
   React : ce module est chargeable par `node --test`.

   phaseOf(w) renvoie { id, label, rir }. Les notes éditoriales par phase
   sont dans src/plan.js (PHASE_NOTES), sorties du moteur en #4.

   Depuis #16, l'historique n'est plus indexé par semaine de cycle mais par
   date réelle (logs[id] = { date, slot, kind, ... }, voir src/schema.js).
   computeKind(week) reproduit la règle que phaseOf() encode déjà (semaine 1
   = calibration, semaine 7 = décharge) : c'est la même règle, stockée une
   fois pour toutes au lieu d'être redérivée de la semaine à chaque lecture.
   La sécurité qui excluait un point de décharge (week === 7) de la base de
   calcul du suivant devient kind === "deload" ; la calibration (base.week
   === 1 || 7) devient kind === "calibration" || "deload".
   #23 : le module reste une feuille, mais il en importe une autre —
   `units.js`, qui n'importe rien non plus et porte ce que chaque unité
   implique. C'est le seul import de ce fichier, et le sens de la flèche est
   le bon : le moteur lit une table de traits, aucune table ne lit le moteur.
   ========================================================= */

import { traitsOf } from "./units.js";

export const num = (s) => {
  if (s === "" || s == null) return null;
  const n = parseFloat(String(s).replace(",", "."));
  return Number.isNaN(n) ? null : n;
};
export const fmt = (n) => (n == null ? "—" : String(Math.round(n * 100) / 100).replace(".", ","));
export const roundTo = (x, inc) => (inc ? Math.round(x / inc) * inc : x);

/* ---------- Les séries telles que le moteur les lit (#23) ----------

   Le journal stocke ce que les champs de saisie ont produit : des chaînes,
   « 72,5 » comme « », et une ligne peut être vide parce que la série n'a pas
   été faite. Les ramener à des nombres et écarter celles sans répétitions
   était écrit quatre fois — ici, deux fois dans App.jsx, une dans
   exercise-history.js — dont deux copies sans les gardes des deux autres.

   La règle porte du sens, ce n'est pas de la plomberie : **une série sans
   répétitions n'a pas eu lieu.** C'est elle qui fait qu'une ligne laissée
   vide sur une séance validée ne compte pas. La charge seule ne suffit
   pas : un poids réglé sur la barre puis reposé n'est pas une série.

   Les deux gardes viennent de exercise-history.js, qui lit des journaux que
   personne n'a validés (#32) : elles ne changent rien aux appelants dont la
   donnée est déjà jugée, et évitent que le prochain lecteur brut refasse sa
   propre copie pour les ajouter. */
export const normalizeSets = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .filter((x) => typeof x === "object" && x !== null && !Array.isArray(x))
    .map((x) => ({ w: num(x.w), r: num(x.r), rir: num(x.rir) }))
    .filter((x) => x.r != null);

/* ---------- La charge de travail d'une séance (#31) ----------

   `planned()` réduisait une séance à un seul nombre — le maximum de ses charges
   — puis jugeait la fourchette de reps sur *toutes* ses séries, quelle que soit
   la charge de chacune. Dès que les charges diffèrent, les deux moitiés du
   verdict ne parlent pas de la même chose : 8 reps à 90 kg pouvaient valider
   105 kg, et 3 reps à 120 devenaient la prescription suivante avec pour consigne
   « viser plus de reps ». Relevé sur le journal réel le 2026-09-12.

   La règle, en deux clauses : la charge de travail est **la plus lourde portant
   au moins une série dans la moitié haute de la fourchette** —
   `mn + (mx - mn) / 2`, soit 6 reps sur du 4–8 — et, si aucune n'y arrive, **la
   plus légère tentée**.

   « Moitié haute » et non « haut de la fourchette » : le moteur manie deux
   seuils voisins qu'il ne faut jamais confondre, et ce module est le seul
   endroit où les deux sont écrits côte à côte.

     choisir la charge  ->  some(r >= topHalf)   au moins une série, 6 sur du 4–8
     augmenter          ->  every(r >= mx)       toutes les séries, 8 sur du 4–8

   Les appeler pareil rendrait la règle illisible, à commencer par le texte de
   l'onglet Plan qui est le seul endroit où l'utilisateur la lit.

   Le seuil *est* le correctif, pas un raffinement. Une règle qui se contenterait
   d'écarter les séries sous `mn` adopterait encore un 4 reps à 120 kg en 4–8
   comme charge de travail : une charge touchée une fois, au ras du contrat. Le
   rôle de l'appli à cet endroit n'est pas de suivre celui qui se motive et saute
   de 100 à 120, c'est de le ramener à la progression par incréments — et
   d'adopter la charge plus lourde le jour où elle est tenue dans la moitié
   haute de la fourchette. Méritée, pas supposée.

   « Au moins une série », jamais « toutes ses séries » : lu comme *toutes*, le
   test épinglé 72,5 × 3/6/6 disqualifierait 72,5 pour sa série à 3, et une
   séance uniforme se retrouverait sans charge de travail.

   Une séance uniforme n'a qu'un groupe, que les deux clauses sélectionnent — le
   repli prenant la plus légère d'une seule charge, c'est-à-dire elle-même. Son
   comportement est donc identique par construction, pas par cas particulier.
   C'est ce qui permet aux 32 tests de progression de passer sans être touchés.

   Détail de la décision : docs/features/31-working-load-not-heaviest-set/. */

const loadOf = (s) => (s.w == null ? 0 : s.w);

/* ---------- Les séances dont on ne repart pas (#43) ----------

   La décharge y était déjà : une semaine 7 coupe les charges de 15 % par
   construction, donc la semaine 8 doit repartir de la semaine 6, sans quoi le
   programme se saborde tous les sept jours. « Allégée » est exactement la même
   idée, décidée par l'utilisateur au lieu du calendrier — après une blessure ou
   une envie de lever le pied.

   Sans ce mécanisme, une séance à 80 kg là où le contrat disait 102,5 devenait
   la nouvelle référence sur-le-champ : neuf séances à +2,5 kg pour revenir.
   Constaté sur le moteur réel le 2026-09-14.

   La branche calibration teste toujours `calibration` ou `deload`, donc une base
   `allege` — le cas où TOUTES les séances sont allégées et où il n'y a rien
   d'autre sur quoi se rabattre — emprunte la branche normale. C'est le bon
   verdict : elle ne porte aucune coupe programmée à expliquer. */
const SKIPPED_AS_BASE = new Set(["deload", "allege"]);

/* Haut de la fourchette. Non arrondi : les reps sont entières, donc les 37,5 du
   carry 30–45 valent « 38 ou plus » sans qu'on ait à le dire. */
export const topHalf = (mn, mx) => mn + (mx - mn) / 2;

/* Rend { load, sets, mixed } : la charge retenue, ses séries à elle, et si la
   séance en portait plusieurs (ce que `why` affiche, #31 spec Q4).

   Invariant d'appel : `sets` n'est jamais vide — history() n'émet une séance
   qu'avec au moins une série portant des reps (voir plus bas, filter r != null).
   Le repli `Math.min` sur un groupement vide rendrait Infinity ; aucun appelant
   ne peut l'atteindre. */
export function workingSets(sets, mn, mx) {
  const byLoad = new Map();
  for (const s of sets) {
    const l = loadOf(s);
    if (!byLoad.has(l)) byLoad.set(l, []);
    byLoad.get(l).push(s);
  }
  /* Groupement par le nombre déjà produit par num() à la lecture du journal :
     deux séries saisies pareil se parsent pareil, et les incréments du registre
     (1,25 / 2 / 2,5 / 5 / 10) sont tous exactement représentables. */
  const t = topHalf(mn, mx);
  const reached = [...byLoad].filter(([, ss]) => ss.some((s) => s.r >= t)).map(([l]) => l);
  const load = reached.length ? Math.max(...reached) : Math.min(...byLoad.keys());
  return { load, sets: byLoad.get(load), mixed: byLoad.size > 1 };
}

/* ---------- Les exercices sur lesquels la séance est descendue (#43) ----------

   Entrée : un descripteur par exercice de la séance, `{ vid, name, load,
   baseLoad, incr }`. `load` est la charge de travail des séries **telles qu'elles
   seront enregistrées** — App.jsx remplit d'abord les poids vides depuis
   `planned()` —, `baseLoad` celle de la base que le moteur a lue.

   Comparé à la **référence**, pas à la séance précédente. Avec la séance
   précédente, une deuxième séance légère à la même charge n'afficherait aucune
   baisse, ne serait jamais proposée à la question, et deviendrait la nouvelle
   référence en silence — défaisant l'allégement de la première.

   « De plus d'un incrément » : en dessous c'est un arrondi — 102,5 devenus 100
   faute de disques de 1,25 — et ça remonte tout seul à la séance suivante, un
   8/8/8 à 100 redonnant 102,5. Une question rare ne vaut que si elle est lue ;
   la déclencher sur un arrondi apprendrait à la balayer. L'incrément vient du
   registre, exercice par exercice : ce n'est pas un pourcentage inventé. */
export function loadDrops(entries) {
  return (entries || []).filter(
    (e) => e && e.baseLoad != null && e.load != null && e.incr > 0 && e.baseLoad - e.load > e.incr
  );
}

export const phaseOf = (w) =>
  w === 1 ? { id: "calib", label: "Calibration", rir: "2–3" }
  : w <= 6 ? { id: "b1", label: "Bloc 1", rir: "1" }
  : w === 7 ? { id: "deload", label: "Décharge et calibration du bloc 2", rir: "3–4" }
  : w <= 11 ? { id: "b2", label: "Bloc 2", rir: "1" }
  : { id: "bilan", label: "Bloc 2, semaine bilan", rir: "1" };
export const blockOf = (w) => (w <= 6 ? "b1" : "b2");
export const setsFor = (n, w) => (w === 7 ? Math.ceil(n / 2) : n);
export const computeKind = (week) => (week === 1 ? "calibration" : week === 7 ? "deload" : "normal");

export function history(prog, state, vid) {
  const out = [];
  for (const rec of Object.values(state.logs)) {
    if (!rec.done) continue;
    const si = prog.SESSIONS.findIndex((s) => s.id === rec.slot);
    if (si < 0) continue; // slot d'un autre programme (custom chargé puis remplacé, #6) : hors du prog courant
    const sets = normalizeSets(rec.ex && rec.ex[vid]);
    if (sets.length) out.push({ date: rec.date, si, kind: rec.kind, session: prog.SESSIONS[si].name, sets });
  }
  out.sort((a, b) => (a.date === b.date ? a.si - b.si : a.date < b.date ? -1 : 1));
  return out;
}
/* ---------- « Ce qui précède ce créneau » (#23) ----------

   Depuis #16 un créneau s'identifie par (date, rang de la séance dans la
   journée) et non par un numéro de semaine. « Avant » se dit donc en deux
   clauses, et `si` n'est pas un détail : deux séances du même jour se
   classent entre elles, ce qu'une comparaison de dates seule ne fait pas.

   `lastEntry()` (la ligne « Dernière fois » de la carte) et `planned()` (le
   moteur) filtraient chacun de leur côté, à la clause près. Les laisser
   séparés, c'était accepter que l'écran finisse par citer une séance que le
   calcul a ignorée. */
export const historyBefore = (prog, state, vid, date, si) =>
  history(prog, state, vid).filter((e) => e.date < date || (e.date === date && e.si < si));

export function lastEntry(prog, state, vid, date, si) {
  const h = historyBefore(prog, state, vid, date, si);
  return h[h.length - 1] || null;
}
/* `vid` est optionnel et vaut, par défaut, l'exercice que le créneau prescrit :
   les appels d'avant #55 ne le passent pas et obtiennent exactement ce qu'ils
   obtenaient. Le passer ne sert qu'à un cas — une substitution de séance
   (session-sub.js), où le créneau garde sa fourchette, son RIR et son repos
   (c'est le programme qui prescrit) pendant que la charge prévue se lit dans
   l'historique du remplaçant.

   Le moteur ne connaît toujours pas `sub`, et ne doit pas : on lui dit sur quel
   exercice se prononcer, il ne va pas le chercher dans le journal. C'est ce qui
   le garde utilisable par la fiche exercice comme par la séance. */
export function planned(prog, state, slotId, week, si, date, vid = prog.SLOTS[slotId][blockOf(week)]) {
  const slot = prog.SLOTS[slotId];
  const v = prog.V[vid];
  const u = traitsOf(v.unit);
  const [mn, mx] = slot.reps;
  const kind = computeKind(week);
  const hist = historyBefore(prog, state, vid, date, si);
  let base = hist[hist.length - 1], prev = hist[hist.length - 2];
  if (base && SKIPPED_AS_BASE.has(base.kind) && hist.some((e) => !SKIPPED_AS_BASE.has(e.kind))) {
    const nd = hist.filter((e) => !SKIPPED_AS_BASE.has(e.kind));
    base = nd[nd.length - 1]; prev = nd[nd.length - 2];
  }
  const label = `${mn}–${mx} ${u.repUnit}`;

  if (!base) {
    if (!u.hasLoad) return { load: null, text: `Cible ${label} à ${phaseOf(week).rir} RIR`, why: "", baseLoad: null };
    if (v.start == null) return { load: null, text: "Paliers", why: "50 → 75 → 100 % de la charge devinée ; la première série dans la fourchette au bon RIR devient la charge de travail", baseLoad: null };
    const l = kind === "deload" ? roundTo(v.start * 0.85, v.incr) : v.start;
    return { load: l, text: loadText(v, l), why: kind === "deload" ? "charge de départ −15 % (décharge)" : "charge de départ", baseLoad: null };
  }
  /* Sans charge, il n'y a rien à regrouper : ce retour passe avant workingSets()
     plutôt qu'après, ce qui confine la règle de #31 aux unités chargées par
     construction au lieu d'une garde. Le verdict y reste calculé sur toutes les
     séries, comme il l'a toujours été. */
  if (!u.hasLoad) {
    const top = base.sets.every((s) => s.r >= mx);
    const t = top ? `progresser : ${u.repUnit === "s" ? "+5 s" : "+1 rep ou amplitude"}` : `viser le haut de la fourchette (${label})`;
    return { load: null, text: `Cible ${label}`, why: `dernière fois ${base.sets.map((s) => s.r).join("/")} — ${t}`, baseLoad: null };
  }

  /* La charge sur laquelle le verdict se prononce, et ses séries à elle (#31).
     Avant, c'était Math.max des charges de la séance et la fourchette jugée sur
     toutes ses séries, d'où un verdict qui parlait d'autre chose que la charge
     qu'il annonçait. */
  const work = workingSets(base.sets, mn, mx);
  const load = work.load;
  const allTop = work.sets.every((s) => s.r >= mx);
  const lowCount = work.sets.filter((s) => s.r < mn).length;
  let next = load, why = "même charge";

  if (base.kind === "calibration" || base.kind === "deload") {
    if (allTop) { next = roundTo(load * 1.05, v.incr); why = "calibration : +5 %"; }
    else if (lowCount >= 1) { next = roundTo(load * 0.95, v.incr); why = "calibration : −5 %"; }
    else why = "charge validée en calibration";
  } else if (allTop) {
    next = load + v.incr; why = `+${fmt(v.incr)} kg : haut de fourchette atteint`;
  } else if (lowCount >= 2) {
    /* La séance d'avant se lit par la même règle (#31, design décision 1) : elle
       comptait ses séries basses sur toute la séance, donc elle portait le défaut
       à l'identique. Laisser une des deux lectures sur l'ancienne règle aurait
       replanté le bug là où personne ne serait allé le rechercher. */
    const prevLow = prev && workingSets(prev.sets, mn, mx).sets.filter((s) => s.r < mn).length >= 2;
    if (prevLow) { next = roundTo(load * 0.95, v.incr); why = "−5 % : deux séances sous la fourchette"; }
    else why = "même charge : une séance sous la fourchette, on retente";
  } else why = "même charge : viser plus de reps";
  if (kind === "deload" && base.kind !== "deload") { next = roundTo(next * 0.85, v.incr); why = "décharge −15 %"; }
  /* Quand la séance portait plusieurs charges, le moteur tire sa réponse d'un
     *sous-ensemble* de ce que l'utilisateur voit écrit dans son historique. Sans
     cette mention, la carte annonce « Prévu : 110 kg » après une séance où il a
     touché 120 et rien à l'écran n'explique pourquoi 120 a été écarté — c'est
     exactement ce qui rend un moteur suspect. Après la coupe de décharge, pour
     qu'elle survive à la réécriture de `why`. Sur une séance uniforme, rien n'est
     ajouté : la chaîne reste identique au caractère près (#31 spec, Q4). */
  if (work.mixed) why = `${why} (jugé sur ${loadText(v, load)})`;
  return { load: next, text: loadText(v, next), why, baseLoad: load };
}
/* Libellé de la dernière séance où l'exercice a été fait (#30).

   Avant #16 un log portait son numéro de semaine de cycle et App.jsx affichait
   « Dernière fois (S3, Haut B) ». La timeline datée a retiré `week` de ce que
   renvoie history(), sans que l'affichage suive : la ligne rendait
   « Dernière fois (Sundefined, Haut B) » dès la deuxième séance.

   La date est aussi la bonne information à cet endroit, pas seulement celle
   qui est disponible : deux passages du même programme ont chacun une « S3 »,
   une date non — et « il y a combien de temps » est ce que le lecteur cherche.

   Formaté depuis la chaîne ISO plutôt qu'en passant par parseLocalDate()
   (src/definition.js) : progression.js n'importe rien, et cela doit le rester
   (docs/ARCHITECTURE.md §1). */
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export function lastEntryLabel(last) {
  const [, m, d] = last.date.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]}, ${last.session}`;
}

export function loadText(v, l) {
  if (l == null) return "—";
  /* `bodyweight` et non `unit === "bw"` : ce qui décide de la forme est que
     la charge s'ajoute au corps au lieu d'être le total soulevé, et c'est ce
     que la table nomme. */
  if (traitsOf(v.unit).bodyweight) return l > 0 ? `PDC + ${fmt(l)} kg` : "Poids du corps";
  return `${fmt(l)} kg${v.perHand ? " / main" : ""}`;
}
