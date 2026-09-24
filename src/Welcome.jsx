/* =========================================================
   Écran d'accueil — avant tout cycle (#19)

   Ne s'affiche qu'au premier lancement d'un appareil vierge
   (`onboarding.js`, `reason === "absent"`), et une seule fois : ce n'est
   pas un état stocké, c'est le verdict d'un chargement.

   Pourquoi un écran plutôt qu'une étiquette « démo » sur le programme
   fourni (decisions-spec.md Q1) : afficher le bundle le ferait entrer dans
   `journal.programs` au premier geste, et **l'appli n'a aucun moyen de
   supprimer un cycle**. L'athlète qui génère ensuite le sien garderait à
   vie un cycle qu'il n'a jamais voulu, sans autre recours que de vider le
   stockage — c'est-à-dire de tout perdre. Tant que rien n'est choisi, rien
   n'est écrit.

   La quatrième porte — « Regarder le programme fourni » — est ce qui garde
   l'écran honnête. Une appli dont la valeur est invisible tant qu'aucun
   programme n'existe ne peut pas ouvrir sur trois boutons et du vide. La
   différence avec l'option écartée tient en un mot : c'est un choix, pas un
   défaut.

   Ce fichier n'émet que du balisage ; il ne possède rien et n'écrit rien.
   ========================================================= */

import { Sparkles, PenLine, Upload, Eye } from "lucide-react";
/* #68 : la porte est partagée avec l'onglet Plan, qui pose la même question
   après le premier lancement. Sortie telle quelle, sans rien changer à son
   rendu. */
import Route from "./Route.jsx";

export default function Welcome({ onGenerate, onCompose, onLoadFile, onPreview, error }) {
  return (
    <div className="max-w-md mx-auto px-4 pb-24">
      <div className="pt-10 pb-6">
        {/* #70 : le titre nomme ce que l'appli fait. « Ton programme, pas celui
            d'un autre » défendait une position que personne ne conteste au
            moment d'ouvrir l'appli pour la première fois, et y dépensait le
            plus gros texte de l'écran. */}
        <h1 className="text-2xl font-semibold text-ink">Un programme qui suit tes charges</h1>
        <p className="text-sm text-ink-muted mt-2 leading-relaxed">
          Douze semaines, quatre séances par semaine au plus, et une charge proposée
          à chaque série à partir de ce que tu as réellement soulevé la fois d'avant.
          Rien n'est enregistré tant que tu n'as pas choisi.
        </p>
      </div>

      <div className="grid gap-3">
        {/* En premier, et en accent : c'est la route que l'appli sait faire
            seule depuis #58, et celle qui demande le moins à l'athlète. */}
        <Route primary icon={<Sparkles size={18} />} onClick={onGenerate}
          title="Générer mon programme"
          note="Cinq questions — jours, durée, matériel, niveau, objectif — et l'appli compose." />
        <Route icon={<PenLine size={18} />} onClick={onCompose}
          title="Composer le mien"
          note="Séance par séance, dans le catalogue d'exercices de l'appli." />
        <Route icon={<Upload size={18} />} onClick={onLoadFile}
          title="Charger un fichier"
          note="Un programme déjà écrit, au format de l'appli." />
        <Route icon={<Eye size={18} />} onClick={onPreview}
          title="Regarder le programme fourni"
          note="Un Upper/Lower neutre, pour voir à quoi ça ressemble. Il devient le tien si tu t'en sers." />
      </div>

      {error && <p role="alert" className="text-sm text-alert mt-4">{error}</p>}
    </div>
  );
}
