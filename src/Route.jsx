/* =========================================================
   Une porte d'entrée — icône, titre, une phrase (#19, partagé en #68)

   Rien à voir avec du routage d'écran : c'est le bouton pleine largeur par
   lequel on choisit *comment* un programme entre dans l'appli. Générer,
   composer, charger un fichier, regarder celui qui est fourni.

   Écrit pour l'accueil (#19), sorti de `Welcome.jsx` quand l'onglet Plan a eu
   besoin des mêmes portes (#68). Les deux écrans posent la même question à deux
   moments — premier lancement, puis chaque fois qu'on veut un cycle de plus —
   et une question identique doit se présenter à l'identique : quelqu'un qui a
   choisi « Générer » au premier lancement doit reconnaître la porte six
   semaines plus tard.

   Ne possède rien, n'écrit rien, n'émet que du balisage (ARCHITECTURE §2.6).
   ========================================================= */

export default function Route({ icon, title, note, onClick, primary }) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border flex items-start gap-3 focus:outline-none focus:ring-2 focus:ring-focus ${primary ? "bg-surface-raised border-accent" : "bg-surface-raised border-rule"}`}>
      <span className={`shrink-0 mt-0.5 ${primary ? "text-accent" : "text-ink-muted"}`}>{icon}</span>
      <span>
        <span className={`block font-medium ${primary ? "text-accent" : "text-ink"}`}>{title}</span>
        <span className="block text-sm text-ink-muted mt-0.5">{note}</span>
      </span>
    </button>
  );
}
