/* =========================================================
   La carte d'un exercice de séance — extraite d'App.jsx (#87)

   Déplacement pur : le corps du composant est celui d'App.jsx, ligne pour
   ligne, imports mis à part. Aucun état n'a changé de main, aucune valeur
   n'a changé de chemin.

   Ce que l'extraction rend vérifiable, et qui ne l'était pas : la liste
   ci-dessous. Dans App.jsx, `prog`, `state`, `week` et le journal entier
   étaient lexicalement à portée, et rien n'empêchait cette carte d'aller y
   lire « juste un petit détail » — c'est l'argument qui a sorti la fiche
   exercice en #17, appliqué au second gros composant du fichier. Les vingt
   props sont une contrainte qu'on relit d'un coup d'œil.

   Le composant ne calcule pas : `progression.js` décide des charges,
   `display.js` des libellés, `session-sub.js` des substitutions. Il émet du
   balisage (ARCHITECTURE §2.6).
   ========================================================= */

import { useState, useMemo } from "react";
import { Check, ChevronDown, ChevronRight, Timer, Zap, Repeat, Plus } from "lucide-react";
import { num, fmt, setsFor, lastEntry, lastEntryLabel, historyBefore, planned, normalizeSets, phaseOf } from "./progression.js";
import { setSummary, unitColumns, rowIsDone, completedSets } from "./display.js";
import { traitsOf } from "./units.js";
import { prescribedVid } from "./session-sub.js";
import { isDeloadWeek } from "./policies.js";
import { useLoadPicker, LoadPickerOverlay, PICKER_FIELD_STYLE } from "./LoadPicker.jsx";
import { fieldSetup } from "./load-picker.js";

export default function ExerciseCard({ idx, slotId, nSets, week, weeks, si, date, prog, policies, state, rows, vid, substituted, isTest, open, onToggle, onSet, onTimer, onOpen, onSubstitute }) {
  const slot = prog.SLOTS[slotId];
  const v = prog.V[vid];
  const unit = v.unit || "kg";
  /* #55 : deux comptes, et les confondre est le bug. `prescribed` est ce que
     le programme demande — c'est lui que la ligne de prescription annonce, et
     il ne bouge pas parce qu'on a ajouté une série. `sets` est ce que la
     grille rend.

     Le `rows.length` du max n'est pas une précaution : sans lui, une série
     ajoutée existerait dans le journal (`onSet` fait croître le tableau
     jusqu'à l'index reçu) et **disparaîtrait de l'écran** à la réouverture de
     la séance — le pire des deux mondes. Il porte aussi, seul, la réouverture :
     `extra` est un état d'écran et ne survit pas au démontage, ce qui est
     voulu — une ligne ajoutée puis laissée vide n'a rien été.

     Rien de tout cela ne se stocke. Le bouton ne crée pas de ligne : il agrandit
     la grille, et la ligne naît au premier caractère tapé, comme les autres. */
  const prescribed = setsFor(nSets, week, policies);
  const [extra, setExtra] = useState(0);
  const sets = Math.max(prescribed + extra, rows.length);
  /* #55 : `vid` entre dans les dépendances, et c'est tout l'objet du septième
     paramètre de planned(). Substitué, le créneau garde sa fourchette, son RIR
     et son repos — c'est le programme qui prescrit — et la charge prévue se lit
     dans l'historique du remplaçant, qui peut n'en avoir aucun : « Paliers » et
     la charge de départ sont déjà le bon comportement pour ça. */
  const plan = useMemo(() => planned(prog, state, slotId, week, si, date, vid, policies), [prog, state, slotId, week, si, date, vid, policies]);
  const last = useMemo(() => lastEntry(prog, state, vid, date, si), [prog, state, vid, date, si]);
  /* #14 : « par rapport au dernier test ». Une séance test est un repère, pas
     une prescription : le moteur l'écarte de son calcul (SKIPPED_AS_BASE), donc
     la seule chose qu'elle produise est cette comparaison-là. Sans elle, prendre
     un repère ne servirait à rien — et un repère qui ne se compare à rien n'en
     est pas un. */
  const lastTest = useMemo(
    () => (isTest ? historyBefore(prog, state, vid, date, si).filter((e) => e.kind === "test").pop() || null : null),
    [isTest, prog, state, vid, date, si],
  );
  /* #66 : le repli de la consigne technique, distinct du repli de la carte
     elle-même, qui est tenu par le parent (une seule carte ouverte). */
  const [cueOpen, setCueOpen] = useState(false);
  const phase = phaseOf(week, policies, weeks);
  /* #14 : « pas en décharge » se lit dans la politique, plus dans un numéro de
     semaine écrit en dur. Un programme qui décharge en S5 autorisait encore
     l'échec cette semaine-là, et l'interdisait en S7 où il ne déchargeait pas. */
  const failOk = slot.fail && week >= 3 && !isDeloadWeek(week, policies.deload);
  /* #14 : l'AMRAP automatique de la dernière semaine est retiré. C'était un
     compte à rebours de calendrier — précisément ce que cette issue supprime —
     et il annonçait un repère que personne n'avait décidé de prendre. Il revient
     quand la séance est déclarée comme un test, ce qui est un geste. */
  const amrap = isTest && slot.key;
  /* #23 : trois ternaires indépendants sur la même unité, dont deux
     n'énuméraient pas les mêmes cas. Les en-têtes viennent de display.js
     (des mots), les deux autres de units.js (du sens) : une colonne de charge
     n'existe que si l'unité en porte une, et la colonne du milieu se nomme
     comme la mesure. */
  const u = traitsOf(v.unit);
  const cols = unitColumns(unit);
  const fields = u.hasLoad ? ["w", "r", "rir"] : ["r", "rir"];
  const repLabel = `${slot.reps[0]}–${slot.reps[1]} ${u.repUnit}`;

  /* #42 : « faite » est dérivé, pas stocké. Une série compte quand elle porte
     ses valeurs — c'est déjà la règle du moteur, planned() ne retient une
     série que si r != null (progression.js). Stocker un drapeau par série
     serait un champ neuf dans le journal, donc une migration, pour le seul
     confort de pouvoir décocher.

     RIR exclu du critère pour la même raison : planned() ne le lit jamais. Il
     est informatif, donc pré-rempli quand la phase donne un chiffre unique et
     laissé vide en calibration et en décharge, où la cible est une fourchette. */
  const filled = (row, f) => String((row && row[f]) ?? "").trim() !== "";
  /* #66 : la règle est sortie dans display.js, parce que la carte repliée la
     lit aussi — « 2 séries sur 3 » et la coche de la troisième ne peuvent pas
     répondre à deux définitions différentes. */
  const rowDone = (i) => rowIsDone(rows[i], unit);
  const nextIdx = Array.from({ length: sets }).findIndex((_, i) => !rowDone(i));
  const rirTarget = /^\d+$/.test(String(phase.rir)) ? String(phase.rir) : null;

  /* #46 : appui long sur un champ, glisser, relâcher. Corriger une valeur, c'est
     un cran d'écart — `v.incr` le connaît pour la charge, reps et RIR se comptent
     un par un — et le pavé numérique fait payer plusieurs frappes ce détour. Le
     tap court garde le clavier : la roue est le chemin rapide, pas une cage.

     D'abord livrée sur la seule charge, puis étendue aux trois colonnes une fois
     le geste essayé en salle. `fieldSetup()` porte ce qui les sépare. */
  const picker = useLoadPicker({ onCommit: (i, f, value) => onSet(vid, i, f, value) });
  const setupOf = (f) => fieldSetup(f, { unit, incr: v.incr, planLoad: plan.load, repTop: slot.reps[1], rirTarget: num(rirTarget) });

  /* Remplit ce qui manque, n'écrase jamais ce qui est là, et lance le repos.
     Sur une série déjà complète, relance simplement le repos : un bouton vert
     qui ne fait rien serait une fausse affordance, et effacer une saisie
     derrière un tap serait pire. */
  const validateRow = (i) => {
    const row = rows[i] || {};
    if (!rowDone(i)) {
      if (fields.includes("w") && !filled(row, "w") && plan.load != null) onSet(vid, i, "w", fmt(plan.load));
      if (!filled(row, "r")) onSet(vid, i, "r", String(slot.reps[1]));
      if (rirTarget && !filled(row, "rir")) onSet(vid, i, "rir", rirTarget);
    }
    onTimer(slot.rest, v.name);
  };

  /* #66 : ce que la carte repliée dit d'elle-même. Une carte faite porte son
     résultat, une carte à venir sa prescription — jamais rien qui demande
     d'ouvrir pour savoir si on l'a faite. Le compte passe par `completedSets`,
     la même règle que la coche de chaque rangée. */
  const doneCount = completedSets(rows, unit);
  const allDone = doneCount >= prescribed;
  const summary = normalizeSets(rows).length ? setSummary(normalizeSets(rows), v) : null;

  return (
    <div className="py-4 border-b border-rule">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* #17 : le nom ouvre la fiche de l'exercice. La cible existait déjà —
              c'est la première chose qu'on lit — et le chevron la signale.

              #66 : seulement sur la carte ouverte. Repliée, la ligne entière
              ouvre l'exercice : c'est le geste qu'on attend d'un accordéon, et
              un nom qui partirait vers une autre page sous le pouce de
              quelqu'un qui voulait juste déplier serait le piège classique de
              deux cibles empilées. */}
          {open ? (
            <button onClick={() => onOpen(vid)} className="text-left focus:outline-none focus:ring-2 focus:ring-focus rounded">
              <span className="font-medium text-ink leading-snug">{idx}. {v.name}</span>
              <ChevronRight size={15} className="inline text-ink-faint ml-1 mb-0.5" />
            </button>
          ) : (
            <button onClick={onToggle} aria-expanded={false} className="w-full text-left focus:outline-none focus:ring-2 focus:ring-focus rounded">
              <span className={`font-medium leading-snug ${allDone ? "text-ink-muted" : "text-ink"}`}>{idx}. {v.name}</span>
              <span className="block text-sm mt-0.5 truncate">
                {allDone ? (
                  <span className="text-ink-soft inline-flex items-center gap-1"><Check size={14} className="text-done shrink-0" />{summary}</span>
                ) : doneCount > 0 ? (
                  <span className="text-ink-soft">{doneCount}/{prescribed} séries · {summary}</span>
                ) : (
                  <span className="text-ink-muted">Prévu : <span className="text-accent font-medium">{plan.text}</span></span>
                )}
              </span>
            </button>
          )}
          {/* #55 : on doit *voir* qu'on a dévié, pas le déduire. Une déviation
              qu'on ne voit pas est une déviation qu'on oublie, puis qu'on met en
              doute en relisant son historique six semaines plus tard. La ligne
              nomme l'exercice remplacé, seule information que la carte ne porte
              plus nulle part ailleurs une fois le nom du remplaçant en titre. */}
          {substituted && (
            <div className="text-sm text-notice mt-0.5 inline-flex items-center gap-1">
              <Repeat size={13} />Remplace {prog.V[prescribedVid(prog, slotId, week)]?.name || "l'exercice prévu"}
            </div>
          )}
          {open && (
            <div className="text-sm text-ink-muted mt-0.5">
              {prescribed} × {repLabel}{v.side ? " par côté" : ""}, RIR {phase.rir}
              {failOk && <span className="ml-2 inline-flex items-center gap-1 text-badge"><Zap size={13} />dernière série à l'échec OK</span>}
              {amrap && <span className="ml-2 text-badge">Séance test : dernière série AMRAP</span>}
            </div>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {/* #66 : substitution et minuteur appartiennent à l'exercice qu'on est
              en train de faire. Sur une carte repliée, ils remplissaient la
              ligne de deux cibles pour un geste qu'on ne fait pas là. */}
          {open && (
            <>
              {/* Présent aussi sur une carte déjà substituée : c'est par lui qu'on
                  revient au prescrit, en le rechoisissant dans le sélecteur
                  (design.md décision 5). */}
              <button onClick={() => onSubstitute(slotId)} aria-label={`Remplacer ${v.name} pour cette séance`}
                className="h-9 px-2 rounded-md bg-surface-raised border border-rule text-ink-soft inline-flex items-center gap-1 text-sm focus:outline-none focus:ring-2 focus:ring-focus">
                <Repeat size={15} />
              </button>
              <button onClick={() => onTimer(slot.rest, v.name)} aria-label="Lancer le repos" className="h-9 px-2 rounded-md bg-surface-raised border border-rule text-ink-soft inline-flex items-center gap-1 text-sm focus:outline-none focus:ring-2 focus:ring-focus">
                <Timer size={15} />{Math.floor(slot.rest / 60)}:{String(slot.rest % 60).padStart(2, "0")}
              </button>
            </>
          )}
          <button onClick={onToggle} aria-expanded={open} aria-label={`${open ? "Replier" : "Ouvrir"} ${v.name}`}
            className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-md text-ink-faint focus:outline-none focus:ring-2 focus:ring-focus">
            <ChevronDown size={18} className={open ? "rotate-180" : ""} />
          </button>
        </div>
      </div>

      {open && (
        <>
          {/* #66 : entre deux séries, ce qui se lit est un nombre. Il était écrit
              à la taille de la phrase qui l'explique, au milieu de trois lignes
              de prose. Le « pourquoi » reste sous le chiffre, en gris : il ne
              disparaît pas, il cesse de lui disputer la place. */}
          <div className="mt-2 flex items-baseline gap-2 flex-wrap">
            <span className="text-[26px] leading-none font-semibold text-accent">{plan.text}</span>
            <span className="text-xs uppercase tracking-wider text-ink-muted">prévu</span>
          </div>
          {plan.why && <div className="text-sm text-ink-muted mt-1">{plan.why}</div>}
          {last && <div className="text-sm text-ink-muted mt-0.5">Dernière fois ({lastEntryLabel(last)}) : {setSummary(last.sets, v)}</div>}
          {lastTest && <div className="text-sm text-badge">Dernier test ({lastEntryLabel(lastTest)}) : {setSummary(lastTest.sets, v)}</div>}

          <button onClick={() => setCueOpen(!cueOpen)} className="mt-1 text-sm text-ink-muted inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-focus rounded">
            Technique <ChevronDown size={14} className={cueOpen ? "rotate-180" : ""} />
          </button>
          {cueOpen && <p className="text-sm text-ink-soft leading-relaxed mt-1">{v.cue}</p>}

          <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: fields.length === 3 ? "2rem 1fr 1fr 1fr 2.75rem" : "2rem 1fr 1fr 2.75rem" }}>
        <div />
        {cols.map((c) => <div key={c} className="text-xs text-ink-muted text-center">{c}</div>)}
        <div />
        {Array.from({ length: sets }).map((_, i) => {
          const row = rows[i] || {};
          const done = rowDone(i);
          const isNext = i === nextIdx;
          return [
            <div key={`n${i}`} className={`text-sm self-center ${done ? "text-done" : isNext ? "text-ink" : "text-ink-muted"}`}>S{i + 1}</div>,
            ...fields.map((f) => (
              <input key={`${i}${f}`} inputMode="decimal" aria-label={`Série ${i + 1} ${f}`}
                value={row[f] == null ? "" : row[f]}
                placeholder={f === "w" && plan.load != null ? fmt(plan.load) : ""}
                {...picker.handlers(i, f, num(row[f]), setupOf(f))}
                onChange={(e) => onSet(vid, i, f, e.target.value)}
                className={`h-11 w-full text-center rounded-md focus:outline-none focus:ring-2 focus:ring-focus ${done ? "bg-surface border border-rule-faint text-ink-muted" : isNext ? "bg-surface-raised border border-rule-strong text-ink" : "bg-surface-raised border border-rule text-ink"}`} style={{ fontVariantNumeric: "tabular-nums", ...PICKER_FIELD_STYLE }} />
            )),
            /* #42 : remplit depuis « Prévu », marque la série et lance le repos.
               Les champs restent modifiables : corriger, c'est taper par-dessus. */
            <button key={`v${i}`} onClick={() => validateRow(i)}
              aria-label={done ? `Relancer le repos après la série ${i + 1}` : `Valider la série ${i + 1}`}
              className={`h-11 w-11 rounded-md inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-focus ${done ? "bg-done border border-done text-ink-inverse" : isNext ? "bg-surface-raised border border-accent text-accent" : "bg-surface-raised border border-rule text-ink-dim"}`}>
              <Check size={20} strokeWidth={2.5} />
            </button>,
          ];
        })}
        {/* #55 : « un jour je suis chaud, je veux ajouter une série ». Retirer une
            série marchait déjà — une ligne sans répétitions n'a pas eu lieu
            (normalizeSets, #23) — seul l'ajout manquait.

            Visible seulement quand tout le prescrit est rempli (`nextIdx === -1`,
            la logique de #42). On décide d'ajouter une série **après** avoir fait
            les autres, jamais avant : plus tôt, le bouton ne pourrait produire
            qu'une rangée de champs vides de plus. Il se limite ainsi tout seul,
            sans plafond arbitraire — la troisième s'ajoute, il faut juste avoir
            rempli la deuxième.

            #65 : dans la grille, à la place qu'occuperait S{n+1}. La position
            dit ce qu'il ajoute, et il porte le gris des séries à venir — le
            même que la coche inerte au bout de la rangée. Un libellé
            n'apprenait rien de plus et posait une phrase au milieu d'une
            grille de chiffres. */}
        {nextIdx === -1 && (
          <button onClick={() => setExtra((n) => n + 1)} aria-label="Ajouter une série"
            className="h-11 w-8 self-center inline-flex items-center justify-center rounded-md bg-surface-raised border border-rule text-ink-dim focus:outline-none focus:ring-2 focus:ring-focus">
            <Plus size={16} strokeWidth={2.5} />
          </button>
        )}
          </div>
          <LoadPickerOverlay picker={picker.picker} />
        </>
      )}
    </div>
  );
}
