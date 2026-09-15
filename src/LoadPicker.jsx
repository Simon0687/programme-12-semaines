import { useState, useRef, useEffect } from "react";
import { fmt } from "./progression.js";
import { anchorFor, stepsFromDelta, notchValue, notches, LONG_PRESS_MS, MOVE_CANCEL_PX, PX_PER_NOTCH, NOTCH_RADIUS } from "./load-picker.js";

/* Roue de charge (#46) — la partie qui touche au DOM.

   Toute la géométrie est dans src/load-picker.js, testée sous `node --test`.
   Ici il ne reste que les Pointer Events et le dessin : useLoadPicker() rend les
   handlers à poser sur un champ `w`, et <LoadPickerOverlay> dessine la roue
   ouverte.

   Pointer Events plutôt que Touch Events : la souris marche sans un deuxième
   jeu de handlers, ce qui rend le geste essayable au clavier-souris avant
   d'aller en salle. */

export function useLoadPicker({ incr, onCommit }) {
  const [picker, setPicker] = useState(null); // { anchor, steps, x, y, key } | null
  /* Un ref en parallèle du state : les handlers de pointermove sont appelés
     bien plus vite que React ne re-rend, et un déplacement doit être lu contre
     l'état réel du geste, pas contre le rendu précédent. */
  const g = useRef(null); // geste en cours, ouvert ou non
  const timer = useRef(null);
  const swallowClick = useRef(false);

  useEffect(() => () => clearTimeout(timer.current), []);

  const cancelPending = () => {
    clearTimeout(timer.current);
    timer.current = null;
  };

  const end = () => {
    cancelPending();
    const cur = g.current;
    g.current = null;
    if (!cur || !cur.open) return;
    swallowClick.current = true;
    setPicker(null);
    onCommit(cur.id, cur.field, fmt(notchValue(cur.anchor, incr, cur.steps)));
  };

  const handlers = (id, field, current, plan) => {
    const anchor = anchorFor(current, plan);
    /* Cas 3 de l'issue : ni saisie ni plan. Pas de handlers du tout — le champ
       redevient exactement le champ d'avant, clavier compris. */
    if (anchor == null || !incr) return {};
    return {
      onPointerDown: (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        const el = e.currentTarget;
        g.current = { id, field, anchor, steps: 0, x: e.clientX, y: e.clientY, open: false, el, pointerId: e.pointerId };
        timer.current = setTimeout(() => {
          const cur = g.current;
          if (!cur) return;
          cur.open = true;
          /* Le champ garde le pointeur une fois la roue ouverte : le doigt sort
             de sa boîte dès le premier cran, et sans capture les pointermove
             partiraient à l'élément survolé. */
          try { cur.el.setPointerCapture(cur.pointerId); } catch (err) { /* pointeur déjà relâché */ }
          /* Le clavier ne doit pas monter par-dessus la roue. On ne peut plus
             preventDefault l'appui d'origine (il est consommé depuis 180 ms),
             donc on retire le focus ici et on avale le click qui suivra le
             relâchement — c'est lui qui ouvrirait le clavier. */
          cur.el.blur();
          setPicker({ anchor: cur.anchor, steps: 0, x: cur.x, y: cur.y });
        }, LONG_PRESS_MS);
      },
      onPointerMove: (e) => {
        const cur = g.current;
        if (!cur) return;
        const dy = e.clientY - cur.y;
        if (!cur.open) {
          /* Le geste n'a pas encore choisi : un déplacement franc avant la fin
             du délai est un défilement, et la roue ne s'ouvrira pas. */
          if (Math.abs(dy) > MOVE_CANCEL_PX || Math.abs(e.clientX - cur.x) > MOVE_CANCEL_PX) {
            cancelPending();
            g.current = null;
          }
          return;
        }
        const steps = stepsFromDelta(dy);
        if (steps === cur.steps) return;
        cur.steps = steps;
        setPicker((p) => (p ? { ...p, steps } : p));
      },
      onPointerUp: end,
      onPointerCancel: end,
      onClick: (e) => {
        if (!swallowClick.current) return; // tap court : le clavier s'ouvre comme avant
        swallowClick.current = false;
        e.preventDefault();
      },
    };
  };

  /* Tant que la roue est ouverte, le navigateur ne doit rien faire du geste.
     Rendu à part des handlers et non fusionné dedans : le champ porte déjà son
     propre `style`, qui est écrit après l'étalement des handlers et gagnerait
     donc sur lui. Jamais posé en permanence non plus — `touch-action: none` à
     demeure tuerait le défilement que le délai sert justement à préserver. */
  const fieldStyle = picker ? { touchAction: "none" } : null;

  return { handlers, picker, fieldStyle };
}

export function LoadPickerOverlay({ picker, incr, unit = "kg" }) {
  if (!picker) return null;
  const rows = notches(picker.anchor, incr, picker.steps, NOTCH_RADIUS);
  /* La roue est posée au-dessus du doigt, décalée d'un demi-cran de plus que
     son propre rayon : la valeur retenue reste lisible pendant tout le geste,
     ce qui est la seule chose que le doigt ne doit pas cacher. */
  const top = picker.y - (NOTCH_RADIUS + 1.5) * PX_PER_NOTCH;
  return (
    <div className="fixed inset-0 z-50" style={{ touchAction: "none" }} aria-hidden="true">
      <div className="absolute rounded-lg bg-slate-900 border border-amber-400 shadow-xl overflow-hidden"
        style={{ left: Math.max(8, Math.min(picker.x - 56, (typeof window !== "undefined" ? window.innerWidth : 360) - 120)), top: Math.max(8, top), width: 112 }}>
        {rows.map((r) => (
          <div key={r.offset}
            className={`flex items-center justify-center ${r.selected ? "bg-amber-400 text-slate-900 font-semibold" : "text-slate-300"}`}
            style={{ height: PX_PER_NOTCH, opacity: r.clamped ? 0.25 : 1 - Math.abs(r.offset) * 0.18, fontVariantNumeric: "tabular-nums" }}>
            {fmt(r.value)}{r.selected ? ` ${unit}` : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
