# Spec — Gérer plusieurs programmes (#68)

Issue : #68, `feat`, `priority: medium`. Épic *Programme configurable*.
Source : usage de Simon, 2026-09-24 — « ça devient compliqué de gérer plusieurs
programmes, pas très clair charger / composer / partir du / générer, plus la
liste des programmes ».

## Niveau : A

Matrice `.claude/WORKFLOW.md`. Q1 non — aucun cycle conservé ne se relit
autrement. Q2 **oui** : supprimer un cycle retire une entrée de
`journal.programs`. C'est une destruction définitive, pas un changement de
forme, mais elle touche la donnée que tout le reste lit. → **Niveau A**.

Pas de `design.md` : les décisions ci-dessous sont le design, et la règle de
suppression est dans un module pur (`src/program-list.js`) plutôt que dans un
écran.

## Le problème

Depuis #36, #58 et #62, quatre boutons de même dessin ouvraient quatre gestes
différents — charger un fichier, composer, partir de l'actif, générer — suivis
d'une rangée de pastilles qui n'apparaissait qu'à partir de deux cycles et qui
étaient, elles aussi, des boutons de même dessin. « Lequel est actif » tenait à
un style `primary` partagé avec « Charger un programme » juste au-dessus.

Deux intentions s'y mélangeaient : **créer un cycle** et **changer de cycle**.
Rien ne disait ce qu'un cycle contenait, ni depuis quand il dormait.

Et sous la mise en page, une capacité manquait : **l'appli ne savait pas
supprimer un cycle** (le commentaire de `loadProgram` le dit depuis #19, et
c'est la raison pour laquelle l'écran d'accueil n'écrit rien tant que rien n'est
choisi). Tout cycle chargé, généré ou composé restait pour toujours.

## Les décisions

### 1. Un cycle se supprime, mais seulement s'il n'a rien produit

Trois refus, et ils ne disent pas la même chose :

- **Le cycle actif** : il suffit d'en activer un autre d'abord. Ce refus protège
  d'un geste qui laisserait l'appli sans programme.
- **Un cycle qui porte des séances, un cardio ou un check-in** : c'est de
  l'histoire. La fiche exercice (#17) la lit à travers *tous* les cycles, et
  rien dans l'appli ne la reconstruirait. Une saisie commencée mais non validée
  retient le cycle au même titre : personne ne décide à la place de quelqu'un
  d'autre que ce qu'il a tapé ne comptait pas.
- **Le dernier cycle restant**, même vide : un journal sans programme est un
  état qu'aucun écran ne sait rendre.

Écarté : archiver un cycle (le sortir de la liste sans le détruire). Il faudrait
un champ de plus sur chaque programme, donc une migration de schéma, pour un
besoin qui n'a pas été exprimé — c'est le cycle *d'essai* qui encombre, et
celui-là n'a rien à archiver. À rouvrir si des cycles terminés finissent par
saturer la liste.

La règle vit dans `removeProgram()`, pas dans le bouton. Un bouton caché est une
politesse ; un garde-fou est ce qui fait qu'une destruction n'arrive pas par un
chemin qu'on n'avait pas prévu.

### 2. Le gestionnaire reste une page du Plan

Envisagé : en faire un espace à part, voire un épic par espace du Plan. Écarté.
Le Plan a dix pages depuis #62, neuf sont des références qui fonctionnent, et
tout le désordre tenait dans la dixième. Un espace de plus aurait ajouté de la
navigation à un écran dont le défaut était déjà qu'on ne savait pas où regarder.

Ce que la page dit, en revanche, change d'ordre : le programme actif et l'avis
du validateur (#57) d'abord — on sait de quoi on parle —, puis « Mes
programmes », puis la création.

### 3. Une liste, pas des pastilles ; et elle s'affiche même à un seul cycle

Une ligne par cycle : son nom, l'étiquette `actif`, et ce qu'il porte — « 14
séances · dernière le 12 sept. · départ 1 juin », ou « aucune séance
enregistrée ». Un cycle qui n'est pas exécutable par cette version le dit sur sa
propre ligne, au lieu d'une note globale en bas de page qu'il fallait relier
soi-même à la bonne pastille.

`programSummaries()` rend des nombres et des dates ISO et s'interdit toute mise
en forme ; la phrase se compose dans l'écran, une fois. L'ordre est : l'actif,
puis du plus récemment utilisé au plus ancien, puis par nom — et un cycle sans
aucune séance passe après ceux qui en ont, jamais entre deux.

### 4. Une porte, qui demande ensuite comment

« Nouveau programme » ouvre les quatre routes : Générer, Composer, Charger un
fichier, Partir du programme actif. Les trois premières sont **mot pour mot**
celles de l'écran d'accueil (#19), et le composant est maintenant le même
(`src/Route.jsx`, sorti de `Welcome.jsx` sans rien changer à son rendu) :
quelqu'un qui a choisi « Générer » au premier lancement doit reconnaître la
porte six semaines plus tard.

## Critères d'acceptation

- [x] Le cycle actif se distingue sans lire un style de bouton.
- [x] Créer un programme et changer de programme sont deux gestes visiblement
      différents.
- [x] Un cycle non exécutable le dit sur sa ligne.
- [x] Aucun geste autre qu'une suppression explicite ne retire quoi que ce soit
      du journal, et la suppression dit ce qu'elle enlève avant de l'enlever.
- [x] La règle de suppression est vérifiée dans le module, pas seulement à
      l'écran — test à l'appui pour chacun des trois refus.
- [x] `npm test` vert (922).

## Ce qui reste ouvert

Éditer un cycle en place (« Partir du programme actif » compose encore un
nouveau cycle, #36 étape 8), et la question d'archiver plutôt que supprimer si
la liste finit par s'allonger.
