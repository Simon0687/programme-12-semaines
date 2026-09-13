/* =========================================================
   Écran ouvert, mémorisé le temps d'une session de navigation (#41)

   Depuis #41, on n'atterrit plus sur Séance : on choisit une séance depuis
   Semaine. Le revers, c'est qu'un rechargement en pleine séance renverrait
   sur Semaine et obligerait à re-taper la même ligne — et sur iOS la vue web
   est récupérée dès que l'appli passe en arrière-plan, c'est-à-dire à chaque
   fois qu'on change de morceau entre deux séries.

   D'où sessionStorage, et pas localStorage : il s'agit de survivre à un
   rechargement, jamais de rouvrir une séance trois jours plus tard.

   Le stockage est injecté (ARCHITECTURE §2.7, même règle que le store du
   journal et que file-io.js) : sessionStorage n'existe pas sous `node --test`,
   un objet { getItem, setItem } de quelques lignes suffit à tester les deux
   branches. Aucune fonction ne lève — verdict ou valeur de repli, jamais une
   exception (§2.4) : en navigation privée, Safari fait lever l'accès lui-même.

   Non-objectifs : ce module ne sait pas ce qu'est une séance ni un programme.
   Il conserve deux chaînes et vérifie, à la relecture, que celle qui désigne
   une séance figure toujours parmi celles qu'on lui présente.
   ========================================================= */

export const SCREEN_KEY = "prog12_screen";

const SCREENS = ["semaine", "seance", "plan"];
const HOME = { screen: "semaine", sessionId: null };

export function readScreen(storage) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SCREEN_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object") return null;
    if (!SCREENS.includes(v.screen)) return null;
    return { screen: v.screen, sessionId: typeof v.sessionId === "string" ? v.sessionId : null };
  } catch (e) {
    return null; // navigation privée, quota, ou valeur illisible : on repart de zéro
  }
}

export function writeScreen(storage, state) {
  if (!storage || !state || !SCREENS.includes(state.screen)) return false;
  try {
    storage.setItem(SCREEN_KEY, JSON.stringify({
      screen: state.screen,
      sessionId: typeof state.sessionId === "string" ? state.sessionId : null,
    }));
    return true;
  } catch (e) {
    return false;
  }
}

/* La pièce qui compte. Une séance mémorisée peut appartenir à un cycle qui
   n'est plus actif — changer de programme est un tap dans l'onglet Plan — et
   rouvrir Séance sur un identifiant que prog.SESSIONS ne connaît pas rendrait
   `session` undefined, ce que tout l'écran lit sans repli. On retombe alors
   sur Semaine, qui est de toute façon l'endroit d'où l'on choisit.

   C'est aussi ce qui remplace le travail de l'effet supprimé (App.jsx) :
   garantir que sessionId ne pointe jamais vers rien. */
export function resolveScreen(saved, sessionIds) {
  if (!saved || !SCREENS.includes(saved.screen)) return HOME;
  if (saved.screen !== "seance") return { screen: saved.screen, sessionId: null };
  const known = Array.isArray(sessionIds) && sessionIds.includes(saved.sessionId);
  return known ? { screen: "seance", sessionId: saved.sessionId } : HOME;
}
