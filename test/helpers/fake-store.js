/* Faux store en mémoire, miroir de l'adaptateur réel (src/storage.js) : get()
   lève sur une clé absente, set() peut être forcé à lever pour simuler un
   échec d'écriture. Partagé entre test/backup.test.js et test/storage.test.js
   (#21) — auparavant dupliqué dans le premier. */
export function fakeStore({ failSet = false } = {}) {
  const data = new Map();
  return {
    data,
    async get(k) {
      if (!data.has(k)) throw new Error("missing");
      return { key: k, value: data.get(k) };
    },
    async set(k, v) {
      if (failSet) throw new Error("quota");
      data.set(k, v);
      return { key: k, value: v };
    },
  };
}
