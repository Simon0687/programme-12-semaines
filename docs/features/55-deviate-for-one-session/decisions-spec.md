# Decisions — Deviate from the program for one session (#55)

Source : [`spec.md`](spec.md)
Portée : **choix produit uniquement**. Les frontières de modules, la mécanique
d'écran et la forme des tests appartiennent à `design.md`.
Statut : **tranché par Simon le 2026-09-24** — voir la décision en fin de document.

Q1 à Q4 sont les questions ouvertes de l'issue, dans son ordre. **Q5 n'y était
pas** : elle sort de la lecture du rendu, et elle change ce qui se stocke, donc
elle ne peut pas attendre le tour de design.

---

## Q1 — Comment une séance rouverte sait-elle qu'elle a été substituée ?

**La question.** `ex` est indexé par identifiant d'exercice, jamais par créneau.
Après substitution, `ex[remplaçant]` porte les séries et `ex[prescrit]` est vide.
À la réouverture, la carte du créneau lit `slot[blockOf(week)]` et ne trouve rien.

### Option A — Déduire de `log.ex`

Toute entrée sous un identifiant qui n'est prescrit par aucun créneau de la
séance est un remplaçant.

- **Pour.** Zéro champ, zéro migration, zéro validateur à toucher.
- **Contre, et c'est dirimant.** La déduction **ne sait pas à quel créneau
  rattacher** ce qu'elle trouve. Deux machines prises le même jour donnent deux
  entrées orphelines et deux créneaux vides, sans rien pour les apparier : la
  séance se rouvre avec les bonnes séries en face des mauvais créneaux, ou en
  face d'aucun. Et l'ambiguïté que l'issue signalait — un programme dont la
  variante a changé entre les deux visites (#36) — s'ajoute par-dessus.
- Surtout : le critère 7 demande de **marquer** un exercice substitué. Une marque
  posée sur une déduction qui peut se tromper marque parfois le mauvais
  exercice, ce qui est pire que de ne rien marquer.

### Option B — Une marque explicite sur la ligne de séance

`log.sub = { [slotId]: exerciseId }`, absent quand il n'y a pas eu de
substitution.

- **Pour.** Univoque, quel que soit le nombre de substitutions et quoi qu'il
  arrive au programme entre deux visites. L'appariement est stocké, pas deviné.
- **Et le point qui rend l'option bon marché :** **aucune migration, et aucun
  bump de `SCHEMA_VERSION`.** Un journal écrit avant cette issue ne porte pas le
  champ, et « absent » s'y lit « aucune substitution » — ce qui est exactement
  ce qui s'est passé, puisque l'application ne savait pas en faire. La condition
  de Q1 de la matrice (« un journal déjà enregistré se lira-t-il autrement ? »)
  est donc négative, et démontrablement : il n'existe aucun journal dont la
  lecture change. `deletedAt` et `schemaVersion` sont déjà décrits comme pouvant
  manquer sans que rien ne casse (`journal-shape.js`) ; c'est la même classe de
  champ.
- **Contre.** Un champ de plus à valider, à exporter et à documenter dans
  `data-model.html`.

**Recommandation : B.**

L'argument qui survit même si tout le reste tombe : **l'appariement créneau →
exercice est une information que la séance possède au moment où elle est faite,
et que rien ne peut reconstituer après coup.** Ce n'est pas un raccourci de mise
en œuvre, c'est une donnée. La déduire est une perte d'information volontaire, et
elle se paie au moment précis — la relecture d'un historique — où l'on a le moins
de moyens de la rattraper.

Le coût invoqué contre B est une migration, et il n'y en a pas. Le critère
d'acceptation de l'issue (« aucun nouveau champ de premier niveau dans le journal
ou dans la définition ») reste tenu : `sub` vit sur une ligne de séance, à côté de
`notes` et de `kind`, pas sur l'enveloppe.

## Q2 — Le bilan nomme-t-il le remplaçant ?

**La question.** `keyLines` (`App.jsx`) cherche les séries sous l'identifiant
prescrit du créneau clé. Substitué, il n'en a aucune, et la ligne rend `null` :
**elle disparaît entièrement du bilan**, elle n'affiche même pas « — ».

- **A — Nommer le remplaçant.** « Développé couché barre → Développé couché
  haltères : 30 → 32,5 kg 8/8/8 ».
- **B — Laisser la ligne tomber.** Le bilan ne parle que du programme.

**Recommandation : A.** Le bilan est un contrat de sortie — c'est ce qu'on colle
dans le chat pour la revue hebdomadaire (#35, `src/bilan.js`). Une ligne absente
y **se lit « pas fait »**, et c'est faux : l'exercice a été fait, autrement. La
seule chose qui rend la déviation supportable est qu'elle soit traçable ; un
bilan qui l'efface reproduit exactement le doute que le critère 7 cherche à
supprimer sur l'écran Séance.

Le coût est une flèche par substitution, dans un texte où les substitutions sont
rares par nature. Et la flèche existe déjà dans le vocabulaire de l'application
depuis #50, avec le même sens : « voilà d'où ça vient, voilà où ça va ».

## Q3 — Le remplaçant est-il filtré ou libre ?

- **A — Libre.** Les 63 entrées du registre.
- **B — Filtré** sur le `pattern` ou les `muscles` du créneau.
- **C — Libre, avec la facette du créneau pré-sélectionnée.**

**Recommandation : C**, et elle ne coûte rien à construire. #36 a livré
`filterExercises()` et `FACET_VALUES` (`src/exercise-filter.js`), plus un
sélecteur à facettes déjà testé. Ouvrir ce sélecteur avec la facette `pattern` du
créneau déjà cochée met « une autre poussée horizontale » à zéro tap, et décocher
rend le registre entier.

B se défend par l'équilibre du programme, mais c'est un argument qui ne
s'applique pas ici : les six assertions (#37, #57) jugent le **programme**, pas le
journal. Une séance où une poussée est devenue un tirage ne corrompt rien — elle
est enregistrée telle qu'elle a eu lieu. Interdire, ce serait faire porter au
geste de salle une règle écrite pour la conception d'un cycle.

A seul laisse cependant chercher dans 63 entrées ce que le créneau sait décrire
en un mot : C est A, avec la question déjà posée.

## Q4 — Une série supplémentaire change-t-elle la suggestion ?

**Recommandation : oui, elle compte, et rien n'est à faire.** `workingSets()` lit
les séries qui sont là. C'est le même principe que la série retirée, qui compte
déjà pour zéro : **le moteur lit ce qui a eu lieu.** Plafonner le calcul au
nombre prescrit reviendrait à ignorer un travail réellement fourni, c'est-à-dire
à rendre un verdict qui parle d'autre chose que de ce qu'il annonce — le défaut
exact que #31 a corrigé.

**Un effet à énoncer avant qu'il ne soit découvert.** `allTop` teste
`every(s => s.r >= mx)`. La série ajoutée est, par nature, celle où l'on est le
plus fatigué : en pratique, **une série de plus empêchera plus souvent une
augmentation qu'elle ne la provoquera.** C'est le bon verdict — on a ajouté une
série en se croyant frais, et si cette série tombe sous la fourchette, on ne
l'était pas — mais c'est contre-intuitif, et ça doit être écrit quelque part
avant d'être vécu comme un bug.

## Q5 — Combien de séries en plus, et quand le bouton apparaît-il ?

**Pas dans l'issue.** Le rendu est `Array.from({ length: setsFor(n, week) })` : il
ne plafonne pas seulement l'ajout, il **masquerait des séries déjà stockées**. Une
séance rouverte après ajout doit donc rendre `Math.max(setsFor(n, week),
rows.length)`, sinon la série ajoutée existe dans le journal et disparaît de
l'écran — le pire des deux mondes.

- **A — Un bouton « + une série », toujours visible en bas de la carte.**
- **B — Le même bouton, visible seulement quand toutes les séries prescrites sont
  remplies** (`nextIdx === -1`, la logique de #42).
- **C — Un nombre de séries réglable sur la carte.**

**Recommandation : B.** Ajouter une série est une décision qu'on prend **après**
avoir fait les autres, jamais avant : le bouton n'a rien à faire à l'écran tant
qu'il reste une case vide, où il ne pourrait produire qu'une rangée de champs
vides de plus. Il se limite tout seul, sans plafond arbitraire — on peut en
ajouter une troisième, il faut juste avoir rempli la deuxième.

C transforme un geste en réglage, et fait ressembler la déviation à une
modification de programme : exactement la confusion que l'issue existe pour
supprimer.

---

## Ce qui se décide ici, en une ligne chacune

| | Question | Recommandation |
|---|---|---|
| Q1 | Marque ou déduction ? | **B — `log.sub`**, sans migration ni bump : l'absence du champ dit la vérité |
| Q2 | Le bilan nomme-t-il le remplaçant ? | **A — oui** ; une ligne absente se lit « pas fait » |
| Q3 | Remplaçant filtré ou libre ? | **C — libre, facette du créneau pré-cochée** (réemploi de #36) |
| Q4 | La série en plus compte-t-elle ? | **Oui, inchangé** — et le dire : elle freinera plus souvent qu'elle n'accélérera |
| Q5 | Combien, et quand ? | **B — un bouton, une fois les séries prescrites remplies** ; le rendu lit `max(prescrit, stocké)` |

**Ce qui se livre sans attendre la réponse.** Q4 et Q5 ne touchent ni la
définition ni la forme du journal : la série supplémentaire est entièrement dans
le rendu, et `onSet()` sait déjà la stocker. Elle peut partir seule, avant la
substitution, et elle vaut seule — c'est la moitié du besoin du 2026-09-15.

**Décision de Simon.** _2026-09-24_ — **les cinq recommandations sont retenues
telles quelles** : Q1 = B (`log.sub`, sans migration ni bump), Q2 = A (le bilan
nomme le remplaçant), Q3 = C (registre libre, facette `pattern` du créneau
pré-cochée), Q4 et Q5 déjà livrées le 2026-09-17. La suite est dans
[`design.md`](design.md).
