/* =========================================================
   Substitution d'un créneau, pour une séance et une seule (#55)

   « La machine de press est prise, je passe au bench, mais la séance
   prochaine je veux reprendre la machine. » Ce n'est pas une modification
   de programme — l'éditeur (#36) changerait toutes les semaines restantes —
   et ce n'est pas non plus déductible après coup.

   Avant cette issue, `vid = prog.SLOTS[slotId][blockOf(week)]` était écrit
   six fois dans l'appli, et chacune répondait « quel exercice ce créneau
   porte-t-il ? » en ne regardant que le programme. Ce module est la seule
   réponse désormais : le journal a parfois la sienne, et c'est `log.sub`.

   Forme du champ : `log.sub = { [slotId]: exerciseId }`, **absent** quand il
   n'y a pas eu de substitution (decisions-spec.md Q1 = B). Son absence se lit
   « aucune substitution », ce qui est exactement ce qui s'est passé dans tout
   journal écrit avant #55 — d'où l'absence de migration et de bump de
   SCHEMA_VERSION. `deletedAt` et `schemaVersion` sont déjà décrits comme
   pouvant manquer sans que rien ne casse ; c'est la même classe de champ.

   Le module importe `blockOf` de progression.js et se range donc au-dessus
   du moteur, comme display.js et exercise-history.js — jamais l'inverse
   (ARCHITECTURE §1). `sub` est une donnée de journal, pas une règle de
   progression : le moteur doit continuer à répondre « quelle charge pour cet
   exercice » sans rien savoir des créneaux.

   Non-objectif : ce module ne choisit pas de remplaçant et n'en propose
   aucun. Suggérer est une décision de moteur (spec, hors périmètre).
   ========================================================= */

import { blockOf } from "./progression.js";

const isObj = (x) => typeof x === "object" && x !== null && !Array.isArray(x);

/* Ce que le programme demande pour ce créneau, cette semaine. Rend
   `undefined` pour un créneau inconnu du bundle plutôt que de lever : un
   programme rechargé entre deux visites peut ne plus porter le créneau, et
   un jeté pendant le rendu ne laisse pas un écran en erreur, il démonte
   l'appli entière (même prudence qu'App.jsx sur `s.ex[0]?.[0]`). */
export const prescribedVid = (prog, slotId, week) => prog?.SLOTS?.[slotId]?.[blockOf(week, prog?.POLICIES)];

/* La substitution posée sur ce créneau, ou null. Ne juge que la forme. */
export const subVid = (log, slotId) => {
  const sub = log && log.sub;
  if (!isObj(sub)) return null;
  const vid = sub[slotId];
  return typeof vid === "string" && vid !== "" ? vid : null;
};

/* L'exercice que ce créneau porte **réellement** pour cette séance : celui
   du journal s'il y en a un, celui du programme sinon.

   Tolérante par construction. Un `sub` qui désigne un exercice absent du
   bundle — programme édité entre deux visites, cas limite de la spec —
   retombe sur le prescrit au lieu de rendre un id que `prog.V[vid]` ne sait
   pas résoudre. La substitution est perdue, la séance reste lisible ; le
   contraire n'est pas un compromis acceptable. */
export const vidFor = (prog, log, slotId, week) => {
  const prescribed = prescribedVid(prog, slotId, week);
  const sub = subVid(log, slotId);
  if (sub && prog?.V?.[sub]) return sub;
  return prescribed;
};

/* Vrai quand ce créneau est effectivement dévié — c'est-à-dire quand la
   marque doit s'afficher. Un `sub` qui pointe sur le prescrit n'en est pas
   une (voir withSub), un `sub` irrésolu non plus. */
export const isSubstituted = (prog, log, slotId, week) => {
  const prescribed = prescribedVid(prog, slotId, week);
  const actual = vidFor(prog, log, slotId, week);
  return actual != null && prescribed != null && actual !== prescribed;
};

/* Le prochain `sub` de la ligne, après avoir posé `vid` sur `slotId`.
   Rend un patch prêt pour writeLog : `{ sub }` ou `{ sub: undefined }`.

   Choisir l'exercice prescrit **efface** l'entrée au lieu de l'écrire. Ça
   donne l'annulation sans affordance de plus — on rouvre le sélecteur et on
   reprend l'exercice du programme — mais la vraie raison est ailleurs : une
   marque « substitué » posée sur l'exercice prescrit serait fausse, et
   l'état du journal doit rester en bijection avec ce qui s'est passé, sinon
   la relecture à six semaines ment.

   La dernière entrée retirée retire `sub` : l'absence du champ reste la
   forme canonique de « aucune substitution », et un `{}` résiduel ferait
   diverger deux journaux qui disent la même chose. */
export const withSub = (log, slotId, vid, prescribed) => {
  const cur = isObj(log && log.sub) ? log.sub : {};
  const next = { ...cur };
  if (vid == null || vid === prescribed) delete next[slotId];
  else next[slotId] = vid;
  return { sub: Object.keys(next).length ? next : undefined };
};

/* Les exercices que les **autres** créneaux de cette séance tiennent déjà,
   substitutions comprises.

   `ex` est indexé par exercice, jamais par créneau : si le créneau A passe
   sur l'exercice du créneau B, `ex[B]` porte les séries des deux et la fiche
   exercice compte une séance de dix séries. Rien ne les redémêle après coup,
   donc le sélecteur refuse ces entrées (design.md décision 4).

   Compte les créneaux **résolus** et non les prescrits : deux substitutions
   en chaîne ne doivent pas rouvrir le trou qu'elles ferment. */
export const takenVids = (prog, log, slotIds, week, exceptSlotId) => {
  const out = new Set();
  for (const id of slotIds || []) {
    if (id === exceptSlotId) continue;
    const vid = vidFor(prog, log, id, week);
    if (vid != null) out.add(vid);
  }
  return out;
};

/* Tous les créneaux d'une séance, exercices principaux puis gainage — le
   même aplatissement que sessionSets() et que le rendu de Séance. Vit ici
   pour que `takenVids` ait un appelant qui ne réécrive pas la liste. */
export const slotIdsOf = (prog, session) => [
  ...(session?.ex || []),
  ...((prog?.CORE?.[session?.core]?.ex) || []),
].map(([slotId]) => slotId);
