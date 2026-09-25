/* =========================================================
   La consigne technique en points à picto (#119, maquette E2)

   Un seul rendu pour les deux écrans qui montrent la technique : l'onglet
   Technique de la fiche exercice et le dépli « Technique » de la carte de
   Séance. Deux rendus finiraient par dire la même consigne de deux façons.

   Les points viennent de `cuePoints()` (display.js), qui lit le registre :
   ce fichier ne choisit qu'un tracé par famille. Les tracés sont ceux de
   lucide-react, déjà embarqué — l'appli reste hors ligne, sans la police
   d'icônes de la maquette. Une famille par clé de CUE_KINDS (registry.js),
   et `test/registry.test.js` garantit qu'aucun point n'en porte une autre.
   ========================================================= */

import {
  SlidersHorizontal, PersonStanding, Footprints, Hand, Route, MoveVertical, Timer, Zap, Target, TrendingUp, ShieldAlert, Dot,
} from "lucide-react";

const ICONS = {
  reglage: SlidersHorizontal, posture: PersonStanding, appuis: Footprints, prise: Hand, trajet: Route,
  amplitude: MoveVertical, tempo: Timer, intention: Zap, cible: Target, progression: TrendingUp, securite: ShieldAlert,
};

export default function TechniqueList({ points }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {points.map((p) => {
        const Icon = ICONS[p.kind] || Dot;
        return (
          <li key={p.text} className="flex items-start gap-2.5 text-[13px] text-ink">
            <span title={p.label} className="w-7 h-7 shrink-0 rounded-md bg-chip text-accent-ink flex items-center justify-center">
              <Icon size={15} aria-hidden="true" />
            </span>
            <span className="pt-1 leading-snug"><span className="sr-only">{p.label} : </span>{p.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
