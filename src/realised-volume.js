/* =========================================================
   Le volume réellement fait, par groupe musculaire (#73)

   `assertions.js` sait compter le volume hebdomadaire par muscle depuis #19 :
   la table `VOLUME` (onze fourchettes), la règle de comptage indirect
   (`contribution`) et l'addition (`weeklyVolume`). Ces trois-là n'ont jamais
   tourné que sur le **programme** — sur ce qui est prévu. Rien ne les faisait
   tourner sur le **journal** — sur ce qui a été fait. L'application jugeait
   son plan et ne regardait jamais le résultat.

   Ce module est l'adaptateur qui manquait, et rien d'autre. Il ne compte pas :
   il met les séries validées dans la forme que `weeklyVolume()` lit déjà,
   `{ sessions: [{ rows: [{ sets, entry }] }] }`. La règle de comptage reste
   `contribution()` elle-même — une seconde implémentation, même fidèle,
   dériverait, et le prévu et le réalisé cesseraient d'être comparables au
   moment précis où on les compare.

   **Les séries sont lues sous l'identifiant qui les porte**, jamais sous
   celui que le créneau prescrivait. C'est ce qui rend la substitution (#55)
   gratuite ici : une presse remplacée par un hack squat a écrit ses séries
   sous `hack`, et c'est le hack squat qui doit compter pour les quadriceps.
   Un adaptateur qui repasserait par `SLOTS[slotId][block]` compterait
   l'exercice qui n'a pas été fait.

   **Ce qui compte comme une série est ce qui compte partout ailleurs** :
   `completedSets()` (display.js), c'est-à-dire une ligne dont les reps — et
   la charge quand l'exercice en porte une — sont saisies. Une séance ouverte
   et à moitié remplie apporte donc ses séries faites, et une séance non
   validée n'apporte rien : tant qu'on n'a pas dit « terminé », ce qui est
   dans les champs est une intention.

   Pur, ne lève pas, n'importe pas React (ARCHITECTURE §2.4, §2.6).
   ========================================================= */

import { VOLUME, weeklyVolume } from "./assertions.js";
import { EXERCISES } from "./registry.js";
import { completedSets, MUSCLE_LABELS } from "./display.js";
import { setsOf, fmt } from "./progression.js";

const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

/* Les logs validés d'une semaine, mis dans la forme de `resolveWeek()`.
   Prend ce qu'on lui donne — un tableau, un objet de logs, ou rien — parce
   que l'appelant assemble la semaine autrement selon l'écran, et qu'un
   adaptateur qui impose sa collection oblige chaque appelant à s'adapter à
   lui. */
export function realisedWeek(logs) {
  const list = Array.isArray(logs) ? logs : isObj(logs) ? Object.values(logs) : [];
  const sessions = [];
  for (const log of list) {
    /* Une séance en cours est exclue, pas ses lignes vides : c'est la
       validation qui fait d'une saisie un fait. */
    if (!isObj(log) || !log.done || log.deletedAt) continue;
    const rows = [];
    for (const vid of Object.keys(isObj(log.ex) ? log.ex : {})) {
      const entry = EXERCISES[vid];
      /* Un identifiant que le registre ne connaît pas — un journal importé,
         un exercice retiré du catalogue — n'a pas de muscles à répartir. Il
         est écarté ici plutôt que compté pour zéro : `contribution()` rendrait
         bien 0, mais la ligne existerait, et une ligne à zéro dans la forme
         dit « fait, sans effet » là où la vérité est « inconnu ». */
      if (!entry) continue;
      const sets = completedSets(setsOf(log, vid), entry.unit || "kg");
      if (sets > 0) rows.push({ vid, sets, entry });
    }
    if (rows.length) sessions.push({ id: log.slot || null, date: log.date || null, rows });
  }
  return { sessions };
}

/* → [{ muscle, label, sets, min, max }] dans l'ordre de la table, les onze
   groupes toujours présents.

   Aucun verdict n'est posé sur l'écart, et c'est délibéré : un mardi, toute
   fourchette est sous son minimum, et colorer en rouge onze groupes parce
   que la semaine n'est pas finie apprendrait à ne plus regarder cet écran.
   Le chiffre à côté de sa fourchette dit ce qu'il y a à dire ; le validateur
   (#19) reste le seul endroit qui juge, et il juge le programme, où la
   question a un sens. */
export function realisedRows(logs) {
  const volume = weeklyVolume(realisedWeek(logs));
  return Object.keys(VOLUME).map((muscle) => ({
    muscle,
    label: MUSCLE_LABELS[muscle] || muscle,
    sets: volume[muscle],
    min: VOLUME[muscle].min,
    max: VOLUME[muscle].max,
  }));
}

/* Une semaine sans aucune série validée n'a pas un volume de zéro : elle n'a
   pas de volume. Les deux se ressemblent dans les chiffres et ne se disent
   pas pareil à l'écran — d'où cette question posée une fois ici plutôt que
   onze fois dans le balisage. */
export const hasRealised = (rows) => (rows || []).some((r) => r.sets > 0);

/* « 7,5 / 6–10 » — le libellé, ici plutôt qu'en JSX pour la raison
   habituelle : une chaîne assemblée dans le balisage n'est vérifiable qu'en
   cliquant. Les séries pondérées tombent sur des demis (un composé apporte
   0,5 au petit groupe), et `fmt` écrit la virgule française comme partout
   ailleurs. Le tiret de la fourchette est un demi-cadratin, celui que le
   validateur emploie déjà pour ses fourchettes. */
export const volumeText = (row) => `${fmt(row.sets)} / ${row.min}–${row.max}`;
