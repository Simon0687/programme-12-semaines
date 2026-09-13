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

const SCREENS = ["semaine", "seance", "plan", "exercice"];
const HOME = { screen: "semaine", sessionId: null };

/* EXERCISE_IDS est un Set, prog.SESSIONS une liste : le module ne sait ce
   qu’est ni l’un ni l’autre et se contente d’interroger ce qu’on lui
   présente (§2.7, même règle que le store injecté). */
const knows = (ids, v) =>
  typeof v === "string" && v !== "" && !!ids &&
  (typeof ids.has === "function" ? ids.has(v) : Array.isArray(ids) && ids.includes(v));

export function readScreen(storage) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SCREEN_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object") return null;
    if (!SCREENS.includes(v.screen)) return null;
    const out = { screen: v.screen, sessionId: typeof v.sessionId === "string" ? v.sessionId : null };
    /* exerciseId ne voyage que sur l’écran qui s’en sert : les trois autres
       gardent la forme à deux champs qu’ils avaient avant #17. */
    if (v.screen === "exercice") out.exerciseId = typeof v.exerciseId === "string" ? v.exerciseId : null;
    return out;
  } catch (e) {
    return null; // navigation privée, quota, ou valeur illisible : on repart de zéro
  }
}

export function writeScreen(storage, state) {
  if (!storage || !state || !SCREENS.includes(state.screen)) return false;
  try {
    const payload = {
      screen: state.screen,
      sessionId: typeof state.sessionId === "string" ? state.sessionId : null,
    };
    if (state.screen === "exercice") payload.exerciseId = typeof state.exerciseId === "string" ? state.exerciseId : null;
    storage.setItem(SCREEN_KEY, JSON.stringify(payload));
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
export function resolveScreen(saved, sessionIds, exerciseIds) {
  if (!saved || !SCREENS.includes(saved.screen)) return HOME;

  /* #17 : la fiche exercice ne tient qu’à son exercice. Le sessionId n’y est
     que l’adresse de retour — s’il désigne une séance d’un autre cycle, on le
     laisse tomber sans fermer la fiche, et le retour ramène sur Semaine.
     C’est déjà le comportement dont un futur onglet « Exercices » aura besoin :
     il ouvrira la fiche sans aucune séance. */
  if (saved.screen === "exercice") {
    if (!knows(exerciseIds, saved.exerciseId)) return HOME;
    return {
      screen: "exercice",
      sessionId: knows(sessionIds, saved.sessionId) ? saved.sessionId : null,
      exerciseId: saved.exerciseId,
    };
  }

  if (saved.screen !== "seance") return { screen: saved.screen, sessionId: null };
  return knows(sessionIds, saved.sessionId) ? { screen: "seance", sessionId: saved.sessionId } : HOME;
}
