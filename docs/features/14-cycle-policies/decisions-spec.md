# Decisions — Cycle policies (#14)

Source : [`spec.md`](spec.md)
Statut : **tranché par Claude le 2026-09-24**, sur mandat d'autonomie. Trois
questions que l'issue laissait ouvertes, et une quatrième que la mise en œuvre
a fait apparaître.

---

## Q1 — Où la décision d'une décharge entre-t-elle dans le système ?

Une décharge décidée à la main — vacances, grippe, recommandation acceptée —
doit couper le volume, couper les charges, changer la phase affichée et marquer
les séances validées. Quatre lecteurs.

- **A — Brancher les quatre**, chacun sur la décision.
- **B — Un seul point d'entrée**, que les quatre traversent déjà.

**Décision : B.** `isDeloadWeek()` est la seule fonction que `setsForWeek`,
`kindForWeek`, `phaseFor` et la coupe de `planned()` consultent. Une décharge
décidée y ajoute sa semaine (`deload.forcedWeeks`), et les quatre suivent.

L'argument n'est pas l'économie de lignes : **brancher les quatre laisserait
quatre occasions de se désaccorder**, ce qui est exactement le défaut que cette
issue corrige, en plus petit. Un lecteur oublié produirait une semaine qui coupe
le volume sans couper les charges — un état que rien n'annonce et que seul
l'usage révèle.

**Elle s'ajoute au calendrier plutôt que de le remplacer.** Accepter une
décharge maintenant ne décale pas les suivantes : les deux déclencheurs sont
indépendants, comme la décharge et la rotation le sont devenues.

## Q2 — Où s'enregistre la réponse à une recommandation ?

- **A — Un champ de premier niveau** sur le journal.
- **B — Sur le check-in de la semaine concernée.**

**Décision : B**, `checkin[date].deload = { choice, at, score }`.

Le check-in est déjà un sac de valeurs libres indexé par semaine, et une réponse
à une recommandation *est* une donnée de semaine. Aucun champ de premier niveau,
donc **aucune migration et aucun bump** — même classe de champ que `sub` (#55) :
son absence se lit « aucune décision prise », ce qui est vrai de toutes les
semaines déjà enregistrées.

`score` est stocké avec le choix, et c'est le point : une recommandation
systématiquement déclinée à un score de 3 dit que le seuil est trop bas. **C'est
la donnée qui permettra de régler les seuils au lieu de les deviner**, et elle
n'existe que si on l'écrit au moment du choix.

**« Reporté » compte autant qu'« accepté »**, et c'est même le plus informatif
des deux.

## Q3 — Quand déclare-t-on une séance test ?

L'issue dit « started manually », mais `kind` ne s'écrit qu'à la validation.

- **A — À la validation**, comme « allégée » (#43).
- **B — Au début, sur la séance ouverte.**

**Décision : B**, et la différence n'est pas technique.

« Allégée » **se constate après coup** — on regarde ce qu'on a fait et on
répond. Un test **se décide avant** : on ne pousse une dernière série à l'échec
que si on l'a voulu, et il faut donc le savoir *pendant* la séance, au moment où
la carte doit afficher le repère AMRAP.

Le genre est écrit tout de suite (`toggleTest`), et `validate()` le conserve au
lieu de le recalculer. Annuler remet le genre que la politique donne à cette
semaine.

## Q4 — Où se saisit la qualité du sommeil ?

Question née de la mise en œuvre : `evaluateDeload` lit un sommeil sur 5, et le
check-in existant porte un sommeil **en heures**.

L'issue proposait « deux questions au début d'une séance, dix secondes, sinon
personne ne les remplit ».

**Décision : un champ de plus sur le check-in hebdomadaire existant**, et non un
écran de début de séance. Trois raisons :

1. Le check-in **existe déjà**, il est déjà rempli chaque semaine, et il est
   déjà dans le flux du bilan. Un nouvel écran est un nouveau flux à adopter.
2. Durée et qualité ne disent pas la même chose — sept heures hachées ne valent
   pas sept heures pleines — donc le champ existant ne pouvait pas être
   réinterprété. Il fallait bien en ajouter un.
3. **L'avis fonctionne sans lui.** Régression (2) plus dérive du RIR (1)
   atteignent le seuil de 3 à eux seuls, sans rien demander à personne. Le
   sommeil est un signal d'appoint, pas une dépendance.

**Ce qui ferait changer d'avis, et il faut le mesurer :** que le champ ne soit
pas rempli. C'est l'argument exact de l'issue, et il se vérifie à l'usage plutôt
qu'à l'avance. La capture au début de séance reste la suite naturelle.

## La douleur, et pourquoi elle n'est pas dans le score

L'issue le pose et la mise en œuvre le confirme : la douleur appelle une **action
locale sur l'exercice fautif** — alléger ou substituer — pas une coupe générale.
Et depuis #55, substituer pour une séance est précisément le geste qui existe.
Elle n'entre donc pas dans `evaluateDeload`, et ce n'est pas un report : c'est
le bon endroit qui est ailleurs.

---

| | Question | Réponse |
|---|---|---|
| Q1 | Où entre la décision ? | **Un seul point**, `isDeloadWeek` — quatre branchements, ce serait quatre occasions de se désaccorder |
| Q2 | Où s'enregistre la réponse ? | **Sur le check-in de la semaine**, avec le score. Aucun champ de premier niveau |
| Q3 | Quand se déclare un test ? | **Au début.** « Allégée » se constate, un test se décide |
| Q4 | Où se saisit le sommeil ? | **Sur le check-in existant.** L'avis fonctionne sans lui ; à mesurer à l'usage |
