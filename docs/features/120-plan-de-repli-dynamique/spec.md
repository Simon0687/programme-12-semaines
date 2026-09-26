# Spec — Plan de repli dynamique (#120)

Issue : #120. Suite à la réflexion du 2026-09-26 sur les trois sections
hardcodées du Plan (repli, cardio, nutrition — #120/#121/#122).

## Niveau : A

Matrice `.claude/WORKFLOW.md`. Override : le changement touche `generator.js`
(format de programme) et introduit une nouvelle compétence du moteur (Q3 oui).

## Contexte

`plan.js` sait déjà afficher un plan de repli (`program.fallback`, tableau de
paragraphes — section omise si absent). Mais `generator.js` n'émet jamais ce
champ : sur un programme généré, la section disparaît purement et simplement.
Le texte existant (4/3/2 séances) est écrit à la main pour le programme
personnel de Simon.

## Scope

- **In** : une fonction qui, pour un programme donné (`SESSIONS`, registre
  d'exercices), calcule un ordre de repli par séance et, pour chaque niveau de
  repli, quels exercices d'une séance fusionnée sont conservés — en
  recomposant une séance composite à partir des exercices prioritaires de
  plusieurs séances d'origine (décision Q4), pas seulement en gardant une
  séance intacte et en supprimant l'autre.
- **In** : une règle de non-répétition portée par le journal (pas par le texte
  du programme) — si la semaine S a été réduite, la semaine S+1 ne réduit pas
  la (les) même(s) séance(s) prioritaire(s) en premier.
- **Out** : génération du texte français lisible (`plan.js` sait déjà le
  faire) — cette issue ne change que la production de la donnée, pas son
  affichage.
- **Out** : réglage manuel de priorité par l'utilisateur (séance ou exercice) —
  tout doit être dérivé de données déjà déclarées (couverture musculaire,
  `type`, `cout_systemique`).

## Comportement côté utilisateur

Onglet Plan, section "Plan de repli" : apparaît désormais sur *tout*
programme généré (elle n'apparaît plus seulement sur un programme écrit à la
main), avec un texte équivalent à ce qui existe pour le programme de Simon
aujourd'hui — un paragraphe par niveau de repli plausible (N-1 séances, N-2
séances, …), et la mention du principe de non-répétition.

## Critères d'acceptation

- [ ] Étant donné un programme généré à N séances/semaine, quand on ouvre la
      section "Plan de repli", alors elle liste N-1 niveaux de repli
      (jusqu'à 1 séance), chacun nommant les séances qui restent.
- [ ] Étant donné deux séances qui couvrent des groupes musculaires
      recouvrants (ex. deux séances "haut du corps"), quand on calcule le
      premier niveau de repli, alors l'une d'elles est coupée avant une
      séance qui est la seule à couvrir un groupe (ex. jambes).
- [ ] Étant donné une séance fusionnée à un niveau de repli, quand on liste
      ses exercices, alors les exercices `type: "isolation"` sont retirés (ou
      réduits en séries) avant les `type: "compose"`, en s'appuyant sur
      `cout_systemique`.
- [ ] Étant donné qu'une semaine S a appliqué un niveau de repli qui a coupé
      la séance X, quand on calcule le repli de la semaine S+1, alors X n'est
      pas la première séance coupée à nouveau.
- [ ] Étant donné un programme à une seule séance/semaine, quand on calcule le
      repli, alors la section se réduit à un seul niveau ("séance ratée =
      semaine sans séance") sans erreur.

## Impact données et stockage

MINOR : nouveau champ optionnel `program.fallback`, calculé et écrit à la
génération (décision Q1 — comme `program.volume`), structuré plutôt que du
texte brut. La règle de non-répétition et le niveau de repli applicable à
une semaine donnée restent calculés dynamiquement depuis le journal (jamais
figés, cette partie ne peut pas l'être). Aucun journal existant relu
autrement si le champ est absent → comportement inchangé (section omise,
comme aujourd'hui).

Si la règle de non-répétition ajoute un champ au journal hebdomadaire
(dernier niveau de repli appliqué), c'est un nouveau champ optionnel — MINOR,
tant qu'un journal sans ce champ continue de se lire comme "jamais réduit".

## Cas limites

- Programme à 1 seule séance/semaine (pas de repli possible au sens propre) —
  pas de plancher artificiel, le dernier niveau descend jusqu'à 1 séance
  (décision Q3).
- Deux séances à couverture musculaire strictement identique : tie-break par
  ordre de déclaration dans `SESSIONS` (décision Q2).
- Un programme chargé depuis un fichier (import), sans passer par le
  générateur : `program.fallback` peut être absent ou hardcodé — la fonction
  de calcul (baked à la génération, décision Q1) ne s'applique pas
  automatiquement à un import ; un programme importé garde son
  `program.fallback` tel quel (ou l'absence de section, comme aujourd'hui).

## Hors scope / suites possibles

- Un module de configuration manuelle des priorités, pour qui voudrait
  s'écarter des règles génériques (pas demandé aujourd'hui).
- Un conseil "vivant" en cours de semaine (lit combien de séances sont déjà
  validées et recommande quoi prioriser pour le reste de la semaine réelle,
  potentiellement dans l'onglet Semaine) — distinct du texte de référence
  générique que produit ce ticket ; candidat pour une issue séparée.

## Questions ouvertes

None — voir `decisions-spec.md` pour le détail des quatre décisions
(Q1 hybride génération/journal, Q2 ordre de déclaration, Q3 pas de plancher,
Q4 recomposition d'exercices entre séances fusionnées).
