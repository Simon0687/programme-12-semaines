import { useState, useRef, useEffect } from "react";
import { fmt } from "./progression.js";
import { anchorFor, stepsFromDelta, notchValue, notches, LONG_PRESS_MS, MOVE_CANCEL_PX, PX_PER_NOTCH, NOTCH_RADIUS } from "./load-picker.js";

/* Roue de saisie (#46) — la partie qui touche au DOM.

   Née sur la charge, étendue aux reps et au RIR une fois le geste validé en
   salle. Ce qui change d'un champ à l'autre — le pas, l'ancre de repli,
   l'unité — est décidé par `fieldSetup()` et transporté par le geste ; ici,
   rien ne sait de quelle colonne il s'agit.

   Toute la géométrie est dans src/load-picker.js, testée sous `node --test`.
   Ici il ne reste que les Pointer Events et le dessin.

   ---------------------------------------------------------------------------
   Pourquoi le champ ne rend jamais le geste au navigateur

   La première version posait `touch-action: none` au moment où la roue
   s'ouvrait. Ça ne peut pas marcher, et l'essai en salle l'a montré : le
   navigateur décide du sort d'un geste tactile **au tout début de la séquence**,
   quand le doigt se pose. Une valeur de `touch-action` écrite 180 ms plus tard
   ne concerne que le geste suivant. Le doigt bougeait donc, la page défilait,
   le navigateur reprenait le pointeur et envoyait `pointercancel` : la roue
   disparaissait au lieu de tourner.

   Il n'y a pas de demi-mesure possible ici. Soit le champ laisse le geste au
   navigateur et la roue ne peut pas exister, soit il le prend entièrement, dès
   la pose du doigt — et c'est alors à nous de faire défiler la page quand le
   geste s'avère être un défilement. C'est ce que fait `scrollBy` plus bas.

   Ce que ça coûte, et il faut le savoir : un défilement **parti d'un champ de
   saisie** suit le doigt au pixel mais n'a pas d'inertie, puisque c'est nous
   qui le déplaçons. Partout ailleurs sur l'écran, le défilement reste natif.
   Depuis l'extension aux reps et au RIR, la grille entière est concernée.
   ---------------------------------------------------------------------------

   Pointer Events plutôt que Touch Events : la souris marche sans un deuxième
   jeu de handlers, ce qui rend le geste essayable au clavier-souris. */

/* Posé en permanence sur les champs de la grille, pas à l'ouverture de la roue —
   voir ci-dessus. `WebkitTouchCallout` coupe la loupe et le menu de sélection
   qu'un appui long déclenche sur un champ de saisie : c'est l'autre chose qui
   interrompait le geste. `user-select` est délibérément laissé tranquille — sur
   iOS, le mettre à `none` sur un input peut le rendre non éditable, et le tap
   court doit rester un tap court. */
export const PICKER_FIELD_STYLE = { touchAction: "none", WebkitTouchCallout: "none" };

export function useLoadPicker({ onCommit }) {
  const [picker, setPicker] = useState(null); // { anchor, steps, incr, unit, x, y } | null
  /* Un ref en parallèle du state : pointermove est appelé bien plus vite que
     React ne re-rend, et un déplacement doit être lu contre l'état réel du
     geste, pas contre le rendu précédent. */
  const g = useRef(null);
  const timer = useRef(null);
  const swallowClick = useRef(false);

  useEffect(() => () => clearTimeout(timer.current), []);

  const end = () => {
    clearTimeout(timer.current);
    timer.current = null;
    const cur = g.current;
    g.current = null;
    if (!cur || cur.mode === "pending") return; // tap court : le clavier s'ouvre comme avant
    /* Après un défilement comme après un réglage, le click qui suit le
       relâchement ne doit pas faire monter le clavier. */
    swallowClick.current = true;
    if (cur.mode !== "wheel") return;
    setPicker(null);
    onCommit(cur.id, cur.field, fmt(notchValue(cur.anchor, cur.incr, cur.steps)));
  };

  const handlers = (id, field, current, setup) => {
    const { incr, fallback, unit } = setup;
    const anchor = anchorFor(current, fallback);
    /* Cas 3 de l'issue : ni saisie ni plan, la roue ne s'ouvrira pas. Les
       handlers restent posés quand même — le champ porte `touch-action: none`
       en permanence, donc il doit savoir faire défiler la page dans tous les
       cas, sans quoi une ligne sans ancre serait un trou mort dans l'écran. */
    const canOpen = anchor != null && !!incr;
    return {
      onPointerDown: (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        const el = e.currentTarget;
        g.current = { id, field, anchor, incr, unit, steps: 0, x: e.clientX, y: e.clientY, lastY: e.clientY, mode: "pending" };
        /* Capture dès la pose : en mode roue le doigt sort de la boîte du champ
           au premier cran, et en mode défilement il la quitte encore plus vite. */
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* pointeur déjà relâché */ }
        if (!canOpen) return;
        timer.current = setTimeout(() => {
          const cur = g.current;
          if (!cur || cur.mode !== "pending") return;
          cur.mode = "wheel";
          /* Le clavier ne doit pas monter par-dessus la roue. On ne peut plus
             preventDefault l'appui d'origine (il est consommé depuis 180 ms),
             donc on retire le focus ici et `end()` avale le click qui suivra. */
          el.blur();
          setPicker({ anchor: cur.anchor, incr: cur.incr, unit: cur.unit, steps: 0, x: cur.x, y: cur.y });
        }, LONG_PRESS_MS);
      },

      onPointerMove: (e) => {
        const cur = g.current;
        if (!cur) return;

        if (cur.mode === "pending") {
          /* Le geste n'a pas encore choisi. Un déplacement franc avant la fin du
             délai est un défilement, et la roue ne s'ouvrira plus. */
          if (Math.abs(e.clientY - cur.y) <= MOVE_CANCEL_PX && Math.abs(e.clientX - cur.x) <= MOVE_CANCEL_PX) return;
          clearTimeout(timer.current);
          timer.current = null;
          cur.mode = "scroll";
        }

        if (cur.mode === "scroll") {
          /* Le doigt monte (clientY diminue) => le contenu monte, donc on
             descend dans la page. Suivi au pixel, image par image. */
          if (typeof window !== "undefined") window.scrollBy(0, cur.lastY - e.clientY);
          cur.lastY = e.clientY;
          return;
        }

        const steps = stepsFromDelta(e.clientY - cur.y);
        if (steps === cur.steps) return;
        cur.steps = steps;
        setPicker((p) => (p ? { ...p, steps } : p));
      },

      onPointerUp: end,
      /* `pointercancel` valide comme un relâchement plutôt que de tout perdre :
         si l'OS reprend le pointeur en cours de réglage (une notification, un
         appel), le cran affiché est ce que l'utilisateur a choisi et vu. */
      onPointerCancel: end,

      onClick: (e) => {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        e.preventDefault();
      },
    };
  };

  return { handlers, picker };
}

export function LoadPickerOverlay({ picker }) {
  if (!picker) return null;
  const rows = notches(picker.anchor, picker.incr, picker.steps, NOTCH_RADIUS);
  /* La roue est posée au-dessus du doigt, décalée d'un demi-cran de plus que
     son propre rayon : la valeur retenue reste lisible pendant tout le geste,
     ce qui est la seule chose que le doigt ne doit pas cacher. */
  const top = picker.y - (NOTCH_RADIUS + 1.5) * PX_PER_NOTCH;
  const vw = typeof window !== "undefined" ? window.innerWidth : 360;
  return (
    <div className="fixed inset-0 z-50" style={{ touchAction: "none" }} aria-hidden="true">
      <div className="absolute rounded-lg bg-slate-900 border border-amber-400 shadow-xl overflow-hidden"
        style={{ left: Math.max(8, Math.min(picker.x - 56, vw - 120)), top: Math.max(8, top), width: 112 }}>
        {rows.map((r) => (
          <div key={r.offset}
            className={`flex items-center justify-center ${r.selected ? "bg-amber-400 text-slate-900 font-semibold" : "text-slate-300"}`}
            style={{ height: PX_PER_NOTCH, opacity: r.clamped ? 0.25 : 1 - Math.abs(r.offset) * 0.18, fontVariantNumeric: "tabular-nums" }}>
            {fmt(r.value)}{r.selected ? ` ${picker.unit}` : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
