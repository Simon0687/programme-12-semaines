/* =========================================================
   Sauvegarde d'avant-migration (#8)

   Avant que le chargement ne réécrive le journal sous sa forme migrée, une
   copie verbatim de l'original est déposée sous une clé distincte
   (prog12_simon_v1_backup_pre<N>, N = schemaVersion d'origine). Écrite une
   seule fois, jamais relue automatiquement — c'est une assurance, pas une
   fonctionnalité.

   store est injecté (jamais d'accès module-level au storage) : c'est ce qui
   rend backupOnce()/listBackups() testables avec un faux store en mémoire.
   ========================================================= */

export const backupKey = (key, from) => `${key}_backup_pre${from}`;

/* true si l'original est protégé (copie qui vient d'être écrite, ou copie
   déjà existante pour cette version) ; false seulement si l'écriture a
   échoué. rawValue doit être la chaîne brute lue du stockage, jamais un
   objet re-sérialisé, sous peine de casser le critère « à l'octet près ». */
export async function backupOnce(store, key, from, rawValue) {
  if (!store) return false;
  const k = backupKey(key, from);
  try {
    const existing = await store.get(k, false);
    if (existing && existing.value) return true; // ne jamais écraser
  } catch (e) { /* absente : le shim lève sur une clé manquante — chemin normal */ }
  try {
    await store.set(k, rawValue, false);
    return true;
  } catch (e) {
    return false;
  }
}

/* Sonde backupKey(key, n) pour n de 1 à currentVersion - 1 : l'adaptateur de
   stockage n'expose que get/set, sans énumération, donc pas d'index à tenir
   à jour. Borné par un petit entier (currentVersion), pas de coût réel tant
   que le schéma ne compte pas des dizaines de versions. */
export async function listBackups(store, key, currentVersion) {
  if (!store) return [];
  const out = [];
  for (let n = 1; n < currentVersion; n++) {
    try {
      const r = await store.get(backupKey(key, n), false);
      if (r && r.value) out.push({ from: n, value: r.value });
    } catch (e) { /* pas de sauvegarde pour cette version */ }
  }
  return out;
}
