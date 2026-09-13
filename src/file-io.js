/* =========================================================
   Sortie et entrée de fichier (#15)

   saveFile() et readFile() rendent un verdict typé au lieu de lever
   (ARCHITECTURE §2.4, même convention que storage.js et import.js) :

     saveFile : { ok: true,  via: "share" }          navigator.share a résolu
                { ok: true,  via: "download" }       chemin ancre <a download>
                { ok: false, reason: "cancelled" }   partage annulé
                { ok: false, reason: "unsupported" } aucun chemin disponible
     readFile : { ok: true,  text }
                { ok: false, reason: "unreadable" | "unsupported" }

   env est injecté ({ nav, doc, url }), jamais lu depuis window au niveau
   module (ARCHITECTURE §2.7) : c'est ce qui rend les cinq branches de
   saveFile testables sous `node --test`, sans DOM ni navigateur.

   « via: download » est un succès sans preuve : une ancre ne rapporte rien,
   ni réussite ni refus. C'est assumé (decisions-spec.md Q2) — l'appelant
   affiche la date qu'il enregistre, pour qu'une valeur optimiste reste
   vérifiable à l'œil plutôt que seulement crue.

   Le File est construit avant tout await, et rien n'est attendu avant
   share() : Safari abandonne le partage si l'appel n'est pas atteint de
   façon synchrone depuis le geste de l'utilisateur. Ne jamais insérer
   d'await avant share(), même « juste pour lire une valeur ».

   Non-objectifs : ce module ne sait rien du journal, ne sérialise rien et
   ne valide rien. Il transporte une chaîne, dans un sens ou dans l'autre.
   ========================================================= */

export async function saveFile(env, { name, content, type }) {
  const nav = (env && env.nav) || null;
  const doc = (env && env.doc) || null;
  const url = (env && env.url) || null;

  if (nav && typeof nav.share === "function") {
    const file = makeFile(content, name, type);
    /* canShare absent : on tente quand même. Le seul verdict qui compte est
       celui de share(), et un refus nous renvoie sur l'ancre. */
    const shareable = file && (typeof nav.canShare !== "function" || nav.canShare({ files: [file] }));
    if (shareable) {
      try {
        await nav.share({ files: [file] });
        return { ok: true, via: "share" };
      } catch (e) {
        if (e && e.name === "AbortError") return { ok: false, reason: "cancelled" };
        /* Tout autre refus (permission, type non partageable, contexte non
           sécurisé) retombe sur l'ancre : l'utilisateur a demandé un
           fichier, pas un chemin de livraison particulier. */
      }
    }
  }

  return downloadFile(doc, url, { name, content, type });
}

function makeFile(content, name, type) {
  try {
    return new File([content], name, { type });
  } catch (e) {
    return null; // File absent (contexte non sécurisé, runtime ancien)
  }
}

function downloadFile(doc, url, { name, content, type }) {
  if (!doc || !url || typeof url.createObjectURL !== "function") return { ok: false, reason: "unsupported" };
  try {
    const href = url.createObjectURL(new Blob([content], { type }));
    const a = doc.createElement("a");
    a.href = href;
    a.download = name;
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    /* Révocation différée : Safari lit encore l'URL après le retour de
       click(). unref() n'existe que côté Node — sans lui, ce minuteur
       tiendrait le runner de tests éveillé une seconde par appel. */
    const t = setTimeout(() => url.revokeObjectURL(href), 1000);
    if (t && typeof t.unref === "function") t.unref();
    return { ok: true, via: "download" };
  } catch (e) {
    return { ok: false, reason: "unsupported" };
  }
}

/* Lecture d'un fichier choisi par l'utilisateur. Le constructeur est
   injectable pour la même raison que env : FileReader n'existe pas sous
   node --test. */
export function readFile(file, FileReaderCtor) {
  const R = FileReaderCtor || (typeof FileReader === "function" ? FileReader : null);
  if (!R) return Promise.resolve({ ok: false, reason: "unsupported" });
  return new Promise((resolve) => {
    let reader;
    try {
      reader = new R();
    } catch (e) {
      resolve({ ok: false, reason: "unsupported" });
      return;
    }
    reader.onload = () => resolve({ ok: true, text: String(reader.result) });
    reader.onerror = () => resolve({ ok: false, reason: "unreadable" });
    try {
      reader.readAsText(file);
    } catch (e) {
      resolve({ ok: false, reason: "unreadable" });
    }
  });
}
