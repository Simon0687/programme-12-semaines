/* =========================================================
   Analyse des imports collé et fichier (#7, #6)

   Le panneau « Données » de l'onglet Plan accepte un journal
   (parseJournalImport) et un programme (parseProgramImport), tous deux sous
   forme de fichier choisi par l'utilisateur — la zone de collage a disparu
   en #15. Chacun rend un verdict typé au lieu de lever :
     { ok: true,  data | definition, migrated? }
     { ok: false, reason, message }

   La raison et la phrase sont deux valeurs séparées : l'appelant
   n'inspecte jamais le texte, et les tests portent sur reason — une
   reformulation ne casse donc pas la suite.

   Depuis #32, le *jugement* de forme n'est plus ici : il vit dans
   src/journal-shape.js, appelé aussi par src/storage.js pour le journal
   déjà stocké. Ce module garde ce qui lui est propre — JSON.parse, la
   reconnaissance du document (« est-ce seulement un journal ? un
   programme ? »), et la normalisation appliquée sur succès.
   ========================================================= */

import { migrate } from "./schema.js";
import { DEFAULT_DEFINITION } from "./definition.js";
import { REJECTIONS, sanitizeJournal, validateDefinition, validateEnvelope, validatePreMigration } from "./journal-shape.js";

/* #38 : le vocabulaire est déclaré là où les raisons sont produites —
   `journal-shape.js` — et réexporté ici sous le nom que l'appli connaît.
   Deux listes, l'une produisant et l'autre déclarant, sont ce qui a laissé
   `unsupported-field` survivre à #25 sans que personne puisse le voir.

   Le nom `IMPORT_MESSAGES` reste : c'est celui qu'`App.jsx` importe, et le
   renommer coûterait un diff sans rien apprendre à personne. */
export { REJECTIONS as IMPORT_MESSAGES };

const reject = (reason, message) => ({ ok: false, reason, message: message || REJECTIONS[reason] });

export function parseJournalImport(text, ctx) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return reject("invalid-json");
  }

  /* Ce garde-fou précède la lecture de .logs : JSON.parse("null") rend null,
     dont l'accès lèverait un TypeError que le catch ci-dessus aurait annoncé
     « JSON invalide » sur un document valide. .logs (v1) ou .programs (v2,
     #6) : un journal exporté après #6 n'a plus de .logs à la racine. */
  if (!parsed || typeof parsed !== "object") return reject("not-a-journal");
  if (!parsed.logs && !parsed.programs) return reject("not-a-journal");

  const ambiguous = validatePreMigration(parsed);
  if (ambiguous) return reject("not-a-journal", ambiguous.message);

  let res;
  try {
    res = migrate(parsed, ctx);
  } catch (e) {
    /* Défensif : migrate() ne lève plus pour un schemaVersion hors bornes
       (#10 en a fait un verdict, cf. res.invalid ci-dessous) ; ce catch ne
       couvre plus qu'un vrai trou dans la chaîne MIGRATIONS. */
    return reject("migration-failed");
  }

  if (res.invalid) return reject("migration-failed");
  if (!res.ok) return reject("too-new");

  /* Les mêmes contrôles que le journal stocké et que le fichier de
     programme (#32). C'est la porte qui comptait le plus : un import collé
     est la sortie de secours documentée d'un stockage bloqué (#12), donc
     la seule qu'on ne peut pas se permettre de laisser ouverte — et avant
     #32 c'était justement la seule sans validateur derrière. Un journal
     porteur d'une définition inepte s'installait, puis l'appli plantait
     au premier rendu. */
  const badEnvelope = validateEnvelope(res.data);
  if (badEnvelope) return reject("not-a-journal", badEnvelope.message);

  const badDefinition = validateDefinition(res.data.programs[res.data.activeProgramId].definition);
  if (badDefinition) return reject(badDefinition.reason, badDefinition.message);

  const { journal, dropped } = sanitizeJournal(res.data);
  return { ok: true, data: journal, migrated: res.migrated, dropped };
}

/* Analyse d'un fichier de programme chargé (#6, durci en #20, program
   accepté depuis #25). Même forme de verdict que parseJournalImport :
     { ok: true, definition } | { ok: false, reason, message }
   Familles de rejet (décisions #20, #25) :
     missing-field      champ requis absent
     invalid-field      champ présent mais du mauvais type / invalide
     invalid-program    program présent mais mal formé (forme, pas ids)
     unknown-exercise   program ou startingLoads référence un id hors du
                        registre fermé (src/registry.js)
     unknown-cardio-rule program.cardio n'est ni "default" ni null
   Sur succès, `name` absent est complété par `id` (décision #20 Q3) : seul
   endroit où le validateur normalise plutôt que juger — et la raison pour
   laquelle cette normalisation est restée ici quand le jugement est parti
   dans journal-shape.js (#32). */
export function parseProgramImport(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return reject("invalid-json");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reject("not-a-program");
  if (parsed.id == null && parsed.startDate == null && parsed.profile == null && parsed.startingLoads == null) {
    return reject("not-a-program");
  }

  const bad = validateDefinition(parsed);
  if (bad) return reject(bad.reason, bad.message);

  return { ok: true, definition: { ...parsed, profile: parsed.profile ?? DEFAULT_DEFINITION.profile, name: parsed.name ?? parsed.id } };
}
