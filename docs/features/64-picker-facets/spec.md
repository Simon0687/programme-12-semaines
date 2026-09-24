# Spec — Le sélecteur d'exercices, trois frictions (#64)

Issue : #64, `feat`, `priority: medium`. Épic *Design & lisibilité*.
Relevée à l'usage par Simon le 2026-09-24, sur les écrans livrés le jour même.

## Niveau : B

Matrice `.claude/WORKFLOW.md`. Q1 non — rien de ce que le sélecteur affiche
n'entre dans le journal ; il rend un id à son appelant, qui décide (en-tête de
`ExercisePicker.jsx`). Q2 non. Q3 non : la règle de filtrage ne change pas,
c'est ce que l'écran **propose** qui se restreint. Q4 **oui** : deux appelants
(la Séance et l'éditeur de programme) lisent le même module, et
`FACET_VALUES` était une constante publique. → **Niveau B**, spec courte.

`exercise-filter.js` n'est pas dans les modules sensibles de l'override
(schema, storage, progression, program, import, default-program).

## Les trois frictions

1. **Le clavier arrive avant la liste.** `autoFocus` sur la recherche : sur un
   téléphone, la moitié de l'écran disparaît avant qu'on ait rien lu.
2. **Seul le mouvement est pré-coché** quand la Séance ouvre le sélecteur sur un
   créneau (#55 Q3 = C). Le muscle du créneau est connu tout aussi précisément.
3. **« Pectoraux » et « Dominante genou » sont cochables ensemble**, et ne
   rendent rien. L'écran affiche alors « Le registre est fermé : si rien ne
   convient, c'est qu'il y manque une entrée » — une phrase sur le registre pour
   un vide que l'écran a produit lui-même.

La troisième est la seule qui demande une décision.

## La question, et la réponse

> Sur quoi les listes déroulantes se restreignent-elles : sur les autres
> facettes seulement, ou aussi sur la recherche en cours ?

**Sur les autres facettes seulement.** La requête se corrige lettre à lettre ;
des options qui se réordonnent pendant la frappe rendraient l'écran instable
pour un gain nul. La recherche par nom porte d'ailleurs sur les 73 entrées,
facettes comprises ou non — c'est ce qui garde atteignables les quatre entrées
sans champs de sélection (#25).

Deux corollaires, qui sont ce que les tests épinglent :

- **La facette qu'on vient de toucher gagne.** Cocher un muscle qui contredit le
  mouvement coché lâche le mouvement. L'inverse — refuser le choix — ferait
  porter à l'utilisateur la correction d'un état que l'écran a laissé exister.
- **Décocher ne peut jamais vider.** On élargit, on ne contraint pas.

Il n'y a pas d'enfermement possible : la valeur cochée reste toujours proposée
par sa propre facette, et l'option vide reste toujours là.

## L'équipement suit la même règle que les deux autres

Envisagé de le laisser indépendant, pour ne pas enchaîner trois listes. Écarté :
le vide resterait atteignable en trois clics, donc le message trompeur aussi, et
l'argument « on ne s'enferme pas » vaut pour les trois facettes de la même
façon.

En revanche, l'équipement **n'est pas pré-coché** à l'ouverture depuis la Séance
(`facetsOf` rend muscle et mouvement, rien d'autre) : on remplace souvent un
exercice parce que la machine est prise, et pré-cocher son matériel masquerait
exactement les remplaçants qu'on cherche.

## Critères d'acceptation

- [x] Le sélecteur s'ouvre sur la liste, sans clavier.
- [x] Ouvert depuis un créneau, il coche muscle **et** mouvement ; décocher l'un
      élargit, décocher les deux rend les 73 entrées.
- [x] Aucun couple de facettes cochable ne rend une liste vide — vérifié par
      balayage de toutes les valeurs proposées, pas sur un exemple.
- [x] Les quatre entrées sans champs de sélection restent atteignables par leur
      nom.
- [x] `npm test` vert (902).
