/* =========================================================
   Analyse d'un import collé (#7)

   Le panneau « Données » de l'onglet Plan accepte un journal collé dans
   une zone de texte. Quatre choses distinctes peuvent y échouer, et
   src/App.jsx les confondait toutes en « JSON invalide » — y compris sur
   des documents parfaitement valides.

   parseJournalImport() rend un verdict typé au lieu de lever :
     { ok: true,  data, migrated }
     { ok: false, reason, message }

   La raison et la phrase sont deux valeurs séparées : l'appelant
   n'inspecte jamais le texte, et les tests portent sur reason — une
   reformulation ne casse donc pas la suite.

   #6 y ajoutera parseProgramImport(), même forme de verdict.
   ========================================================= */

import { migrate } from "./schema.js";

export const IMPORT_MESSAGES = {
  "invalid-json": "Le texte collé n'est pas du JSON valide.",
  "not-a-journal": "Ce JSON ne contient pas de journal (clé « logs » absente).",
  "too-new": "Ce fichier a été créé par une version plus récente de l'appli. Mets l'appli à jour, puis réimporte.",
  "migration-failed": "Ce journal n'a pas pu être mis à jour vers le format actuel.",
};

const reject = (reason) => ({ ok: false, reason, message: IMPORT_MESSAGES[reason] });

export function parseJournalImport(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return reject("invalid-json");
  }

  /* Ce garde-fou précède la lecture de .logs : JSON.parse("null") rend null,
     dont l'accès lèverait un TypeError que le catch ci-dessus aurait annoncé
     « JSON invalide » sur un document valide. */
  if (!parsed || typeof parsed !== "object") return reject("not-a-journal");
  if (!parsed.logs) return reject("not-a-journal");

  let res;
  try {
    res = migrate(parsed);
  } catch (e) {
    /* versionOf() accepte 0 et les entiers négatifs : la chaîne démarre alors
       sous la v1 et applyChain ne trouve aucune étape. Même défaut au
       chargement, où il détruit le journal stocké — voir #10. */
    return reject("migration-failed");
  }

  if (!res.ok) return reject("too-new");
  return { ok: true, data: res.data, migrated: res.migrated };
}
