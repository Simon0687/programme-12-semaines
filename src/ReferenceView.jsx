/* =========================================================
   Référence — la méthode comme un manuel, sommaire ancré (#114)

   Remplace trois à quatre pages en cul-de-sac (Structure, Progression,
   Décharge, Repos) par une page unique qu'on parcourt en scrollant, avec un
   sommaire qui suit la position de lecture — la réponse à #84 : plus besoin
   de remonter à l'index pour comparer deux sections, elles sont sur la même
   page.

   `sections` est le sous-ensemble « methode » de buildPlan() (App.jsx s'en
   charge) ; ce composant ne fait aucun calcul dessus, il les pose les unes
   sous les autres et ajoute l'ancrage. `children` porte l'anchor Exercices —
   texte simple ici (#114), remplacé par le catalogue de #116 sans que ce
   fichier ait à changer.

   `initialAnchor` (#115) ouvre la page directement à une section — le
   déclencheur de décharge d'une semaine, par exemple — et `backLabel` porte
   l'adresse de retour : le "Programme" par défaut, ou "Retour à la séance"
   quand on vient d'un contexte précis. Ni l'un ni l'autre n'est stocké
   (ARCHITECTURE, même règle que planTopic dans App.jsx) : un rechargement
   rouvre la page en haut, avec l'en-tête normal.
   ========================================================= */

import { useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Block } from "./PlanViews.jsx";

const ANCHOR_ORDER = ["structure", "progression", "deload", "repos", "exercices"];
const ANCHOR_TITLES = { structure: "Structure", progression: "Progression", deload: "Décharge", repos: "Repos", exercices: "Exercices" };

export default function ReferenceView({ sections, backLabel = "Programme", onBack, initialAnchor, children }) {
  const [active, setActive] = useState(ANCHOR_ORDER.includes(initialAnchor) ? initialAnchor : "structure");
  const refs = useRef({});
  const scrolledOnce = useRef(false);

  /* Le saut initial n'a lieu qu'une fois, au montage : un changement de
     `initialAnchor` en cours de vie de l'écran (aucun appelant ne le fait
     aujourd'hui) ne doit pas ramener en haut sous le pouce de quelqu'un. */
  useEffect(() => {
    if (scrolledOnce.current) return;
    scrolledOnce.current = true;
    const el = refs.current[active];
    if (el) el.scrollIntoView({ block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const els = ANCHOR_ORDER.map((id) => refs.current[id]).filter(Boolean);
    if (!els.length) return;
    /* La zone « active » est le haut de l'écran, juste sous l'en-tête collant
       (~140px) : une section y entre bien avant d'occuper tout l'écran, donc
       le sommaire change au moment où on commence à la lire, pas quand on
       l'a déjà quittée. */
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting);
      if (!visible.length) return;
      visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      setActive(visible[0].target.dataset.anchor);
    }, { rootMargin: "-140px 0px -70% 0px", threshold: 0 });
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  const scrollTo = (id) => {
    const el = refs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <div className="sticky top-0 z-10 bg-surface border-b border-rule px-4 pt-1 pb-2">
        <button onClick={onBack} className="h-11 -ml-2 px-2 inline-flex items-center gap-1 text-sm text-ink-soft focus:outline-none focus:ring-2 focus:ring-focus rounded">
          <ChevronLeft size={18} />{backLabel}
        </button>
        <div className="text-xl font-semibold leading-tight">Référence</div>
        <div className="flex gap-2 overflow-x-auto mt-2 -mx-4 px-4">
          {ANCHOR_ORDER.map((id) => (
            <button key={id} onClick={() => scrollTo(id)}
              className={`shrink-0 h-8 px-3 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-focus ${active === id ? "bg-accent text-ink-inverse font-medium" : "bg-surface-raised text-ink-soft border border-rule"}`}>
              {ANCHOR_TITLES[id]}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 pt-3 pb-6 text-sm text-ink-soft leading-relaxed">
        {sections.map((s, i) => (
          <div key={s.id} id={s.id} data-anchor={s.id} ref={(el) => { refs.current[s.id] = el; }}
            className={`scroll-mt-[140px] pb-5 ${i > 0 ? "pt-5 border-t border-rule" : ""}`}>
            <h2 className="text-lg font-semibold text-ink">{s.title}</h2>
            <div className="mt-2 space-y-2">
              {s.blocks.map((b, j) => <Block key={j} block={b} />)}
            </div>
          </div>
        ))}
        <div id="exercices" data-anchor="exercices" ref={(el) => { refs.current.exercices = el; }} className="scroll-mt-[140px] pt-5 border-t border-rule">
          <h2 className="text-lg font-semibold text-ink">Exercices</h2>
          {children}
        </div>
      </div>
    </>
  );
}
