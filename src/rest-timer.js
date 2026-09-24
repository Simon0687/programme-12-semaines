/* =========================================================
   Le repos entre deux séries, en conditions réelles (#79)

   Jusqu'ici le repos n'était qu'un useState d'App.jsx. Trois défauts, tous
   constatés en salle plutôt que dans le code :

   1. **Il ne survivait pas à la vue web récupérée.** screen-state.js le note
      en tête : sur iOS, changer de morceau entre deux séries suffit à ce que
      la page soit rechargée. L'écran revenait, le repos non.
   2. **L'écran s'éteignait** pendant le repos, et avec lui la page.
   3. **La fin ne se signalait pas sur iPhone** : `navigator.vibrate` n'existe
      pas dans Safari iOS.

   D'où trois pièces indépendantes. Chacune reçoit son objet navigateur en
   argument (ARCHITECTURE §2.7, même règle que le store et screen-state.js),
   aucune ne lève (§2.4) : une API absente ou refusée est un non-événement,
   jamais une erreur à l'écran — le repos à l'écran reste la vérité, les trois
   pièces ne font que l'aider.
   ========================================================= */

/* ---------- 1. Le repos survit au rechargement ----------

   sessionStorage, comme l'écran : il s'agit de survivre à un rechargement,
   jamais de retrouver un repos le lendemain. On stocke l'heure de fin et non
   le temps restant — c'est ce qui rend la reprise exacte, quel que soit le
   temps passé ailleurs. */

export const REST_KEY = "prog12_rest";

/* Au-delà, un repos expiré n'est plus une information : on revient d'avoir
   fait autre chose, pas d'une pause entre deux séries. En deçà, on le rend
   expiré, et l'écran dit « Repos terminé » comme s'il n'avait pas été quitté. */
export const REST_STALE_MS = 60 * 1000;

const isRest = (v) =>
  !!v && typeof v === "object" && Number.isFinite(v.end) && typeof v.label === "string";

export function readRest(storage, now) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(REST_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!isRest(v)) return null;
    if (now - v.end > REST_STALE_MS) return null;
    return { end: v.end, label: v.label };
  } catch (e) {
    return null; // navigation privée, quota, valeur illisible : pas de repos
  }
}

/* Écrit le repos, ou l'efface quand il n'y en a plus. Un seul point d'entrée
   pour les deux, pour que l'appelant n'ait qu'à lui passer son état. */
export function writeRest(storage, rest) {
  if (!storage) return false;
  try {
    if (isRest(rest)) storage.setItem(REST_KEY, JSON.stringify({ end: rest.end, label: rest.label }));
    else storage.removeItem(REST_KEY);
    return true;
  } catch (e) {
    return false;
  }
}

/* ---------- 2. L'écran reste allumé pendant la séance ----------

   Screen Wake Lock. Le bogue qui la cassait dans les PWA installées sur iOS
   est corrigé depuis iOS 18.4 ; ailleurs elle est là depuis longtemps. Le
   navigateur la relâche dès que la page est masquée, donc l'appelant la
   redemande au retour (visibilitychange). Rend le verrou, ou null. */
export async function acquireWakeLock(nav) {
  try {
    if (!nav || !nav.wakeLock || typeof nav.wakeLock.request !== "function") return null;
    return await nav.wakeLock.request("screen");
  } catch (e) {
    return null; // page masquée, batterie faible, permission refusée
  }
}

export function releaseWakeLock(lock) {
  try {
    if (lock && typeof lock.release === "function") {
      const r = lock.release();
      if (r && typeof r.catch === "function") r.catch(() => {});
    }
  } catch (e) {
    /* déjà relâché par le navigateur : rien à faire */
  }
}

/* ---------- 3. Un signal audible ----------

   Web Audio, parce que c'est ce que Safari iOS joue sans fichier ni
   réseau. Il n'accepte de démarrer un AudioContext que dans un geste de
   l'utilisateur : `unlock()` se place donc sur le tap qui lance le repos, et
   `play()`, appelé par la minuterie, trouve un contexte déjà autorisé.

   Limite assumée : sur iPhone, Web Audio suit le bouton silencieux. Téléphone
   en silencieux, pas de son — c'est le comportement que l'utilisateur a
   choisi, pas un défaut à contourner. Se mêle à la musique sans la couper.

   `Ctor` est le constructeur (AudioContext ou webkitAudioContext), injecté. */
export function makeChime(Ctor) {
  let ctx = null;
  const unlock = () => {
    try {
      if (!Ctor) return false;
      if (!ctx) ctx = new Ctor();
      if (ctx.state === "suspended" && typeof ctx.resume === "function") {
        const r = ctx.resume();
        if (r && typeof r.catch === "function") r.catch(() => {});
      }
      return true;
    } catch (e) {
      ctx = null;
      return false;
    }
  };
  /* Deux bips courts, montants : assez pour être entendus par-dessus une
     salle, assez brefs pour ne pas être confondus avec une sonnerie. */
  const play = () => {
    try {
      if (!ctx) return false;
      const t0 = ctx.currentTime;
      [[0, 880], [0.22, 1175]].forEach(([at, freq]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0 + at);
        gain.gain.exponentialRampToValueAtTime(0.35, t0 + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0 + at);
        osc.stop(t0 + at + 0.2);
      });
      return true;
    } catch (e) {
      return false;
    }
  };
  return { unlock, play };
}
