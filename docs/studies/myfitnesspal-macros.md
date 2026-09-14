# Étude de faisabilité — récupérer les macros depuis MyFitnessPal

Statut : **étude, aucune décision prise, aucun code écrit.**
Date : 2026-09-14. Périmètre volontairement étroit : *lire* les macros
(kcal, protéines, lipides, glucides). Pas d'écriture vers MFP, pas d'aliments,
pas de micronutriments, pas de poids ni d'exercice — MFP les a, l'app les tient
déjà ailleurs.

Question posée : est-ce faisable, à quel prix, et est-ce que ça vaut le prix.

---

## 1. Le point de départ n'est pas vide

L'app *prescrit* déjà de la nutrition et ne *mesure* rien :

| Où | Quoi | Nature |
|---|---|---|
| `profile.maintenanceKcal`, `profile.startKcal` | la cible calorique | prescrit, validé (`journal-shape.js:300`) |
| `profile.macros.{p,f,c}` | les trois macros cibles | prescrit, validé (`journal-shape.js:304-307`) |
| `plan.js:167-175` | la section « Nutrition » du Plan | rendu, jamais comparé au réel |
| `checkin.wN.nutrition` | « Écarts nutrition », texte libre, hebdo | saisi à la main (`App.jsx:837`) |
| `bilan.js:56` | la ligne `Nutrition : …` du bilan | recopiée dans le bilan collé au chat |

Donc l'intégration ne créerait pas une compétence nouvelle : elle **remplacerait
un champ texte libre hebdomadaire par des nombres**. C'est la vraie mesure du
gain, et il faut la garder en tête en lisant les coûts ci-dessous.

Second point, plus important : **la boucle d'ajustement de l'app n'est pas
pilotée par l'apport.** La règle de `plan.js:172` déclenche sur le *poids* et le
*tour de taille* (« gain > 0,4 kg/sem sur 2 semaines → −150 à −200 kcal »).
L'apport loggé n'y entre nulle part. Des macros importées ne changeraient donc
aucun calcul existant — elles serviraient au diagnostic (« l'ajustement ne prend
pas : est-ce que j'ai réellement mangé les 2 900 kcal ? »), pas à la décision.

---

## 2. Les cinq routes, et leur verdict

### Route A — API officielle MyFitnessPal

**Verdict : fermée. Non faisable.**

L'API publique a été dépréciée en 2019 sans annonce. Ce qui subsiste est une API
partenaire privée (REST v2 : lecture/écriture du journal alimentaire, mesures,
profil, webhooks ; 25 000 req/jour, 60 req/s), et **le programme développeur est
fermé aux nouveaux candidats**. La seule porte est un mail à `API@myfitnesspal.com`
avec le nom de la société et l'usage prévu — un projet personnel mono-utilisateur
n'est pas le profil visé, et même la documentation n'est pas publique.

Coût : indéterminé, délai indéterminé, probabilité d'acceptation faible.

### Route B — Agrégateur santé (Terra, Validic, Rook, Spike)

**Verdict : techniquement la meilleure, économiquement absurde ici.**

Terra expose MFP via un widget web OAuth, sans app mobile, avec polling toutes
les 5–10 min et livraison par webhook. Le JSON rendu contient exactement ce qu'on
veut : `meals`, `summary`, kcal et macros par repas.

Deux obstacles :

1. **Prix : 399 $/mois** (engagement annuel) ou 499 $/mois, pas de palier gratuit.
   Pour un utilisateur unique sur 12 semaines, c'est ~1 200 $ pour remplacer une
   phrase par semaine.
2. **Ça exige un serveur**, malgré ce que la page « web app » laisse entendre.
   Terra dit « pas besoin d'app mobile » — pas « pas besoin de backend ». Il faut
   un endpoint pour recevoir le webhook et un endroit pour la clé API, qui ne peut
   pas vivre dans le bundle esbuild. Concrètement : Netlify Functions + un store.

### Route C — Scraping non officiel (`python-myfitnesspal` & co.)

**Verdict : interdit par les CGU, fragile, et incompatible avec l'app.**

- Les CGU MFP interdisent explicitement la récupération de contenu « par des
  moyens automatisés, y compris robots, spiders, crawlers, scrapers », et
  interdisent de contourner CAPTCHA, blocage IP ou mécanismes d'authentification.
- La bibliothèque de référence (873 ★) est vivante mais passe son temps à
  réparer : dernier commit `Fix: 403 Forbidden on authentication` (28/09/2025),
  précédé de `fix: removes cloudscraper causing 403` (13/07/2025), 25 issues
  ouvertes. C'est une dépendance qui casse quand Cloudflare bouge, c'est-à-dire
  sans préavis.
- C'est du Python : il faut un runtime serveur, un cron, et le mot de passe MFP
  stocké quelque part. L'app n'a rien de tout ça.

### Route D — Export fichier (CSV / « Download My Data »)

**Verdict : la seule route faisable en l'état. Manuelle.**

Deux variantes :

| | Export CSV | Download My Data (RGPD) |
|---|---|---|
| Coût | Premium / Premium+ | **gratuit, tout compte** |
| Contenu | 3 CSV : Progress, Exercise, **Nutrition** (détail par repas) | journal alimentaire complet depuis le jour 1, aliments perso, recettes, poids, exercice |
| Plage | date range au choix | tout l'historique |
| Livraison | lien par mail | ZIP par mail, sous 24 h |
| Accès | navigateur desktop ou mobile uniquement, pas depuis l'app | idem, Réglages → Compte |

Le gratuit (RGPD) contient le journal alimentaire ; le payant donne la même chose
en plus propre et sur une plage choisie. Dans les deux cas c'est **un fichier
que Simon déclenche, attend, télécharge et dépose dans l'app.**

Et ça, l'app sait déjà le faire : `readFile()` (`file-io.js`) et le panneau
« Données » acceptent un fichier choisi par l'utilisateur, et chaque porte rend
un verdict typé (`{ ok: false, reason }`, ARCHITECTURE §2.4). Une troisième porte
`parseNutritionImport` se poserait sur la même mécanique, sans rien inventer.

Coût réel : le parsing CSV (aucune dépendance de ce type dans le repo — trois
dépendances runtime en tout aujourd'hui), plus la décision de stockage (§4
ci-dessous), plus une manip manuelle et ~24 h de latence à chaque fois qu'on veut
des données fraîches.

### Route E — Apple Health / Google Fit

**Verdict : impossible depuis un navigateur.**

MFP écrit bien ses macros dans HealthKit (kcal, glucides, protéines, lipides,
fibres, sucres, sodium, eau ; sens MFP → Santé). Mais Apple n'expose **aucune API
cloud** : HealthKit ne se lit que depuis l'appareil, par une app native. Une PWA
servie par Netlify n'y a pas accès, et Terra le confirme noir sur blanc à ses
propres clients web.

Il existe un contournement : un raccourci iOS (Shortcuts) qui lit les échantillons
Santé et écrit un JSON, déposé ensuite dans l'app comme n'importe quel fichier.
Ça marche, ça évite MFP entièrement — mais ça déplace la manip, ça ne la supprime
pas, et ça ajoute un artefact hors dépôt que personne ne teste.

---

## 3. Le blocage structurel, commun à A, B et C

Les trois routes automatiques exigent un serveur. `ARCHITECTURE.md` §3 :

> **No backend, no account, no sync.** Data lives in the browser, on one device.
> Recorded in #18, with the argument that matters: *durability is not multi-user*.
> […] A backend becomes a question only for multi-device or multi-athlete, and
> not before.

Une intégration MFP automatique serait donc le premier serveur du projet, introduit
pour un motif que #18 a précisément écarté — et il faudrait y stocker un secret
(clé API ou identifiants MFP), ce qui rouvre en prime la question du compte.

S'ajoute §2.7 : `storage.js` et `backup.js` reçoivent leur store en paramètre,
jamais lu depuis `window`. C'est ce qui rend les chemins de chargement testables
sous `node --test` sans DOM. Un appel réseau vers un tiers, lui, n'est pas
injectable de la même façon sans construire un faux client — surcoût de test
permanent, pour une donnée qui arrive une fois par semaine.

---

## 4. Ce qu'il faudrait décider avant d'écrire une ligne

Indépendamment de la route choisie, **stocker un apport quotidien est un
changement de niveau A** (`.claude/WORKFLOW.md`, Q2 : la donnée change de forme
et de persistance ; override module sensible : `schema.js`, `storage.js` et
`import.js` sont tous sur le chemin). Donc `SCHEMA_VERSION` bumpé, migration,
validateur dans `journal-shape.js`, backup pré-migration (#8).

Trois questions ouvertes, dans cet ordre :

1. **Quelle granularité ?** Un total par jour (`{ date, kcal, p, f, c }`) ou le
   détail par repas ? Le détail par repas ne sert aucune règle existante et
   multiplie le volume par quatre. Recommandation : total quotidien.
2. **Où ?** À côté de `logs` / `cardio` / `checkin` dans le cycle — ces trois-là
   sont énumérés en dur à quatre endroits (`journal-shape.js:58`,
   `export-state.js:88`, `schema.js:38`, `schema.js:115`). Un quatrième champ
   `nutrition` les touche tous.
3. **§2.1 s'applique-t-il ?** Oui. Une ligne d'apport n'a de sens que face à la
   cible en vigueur ce jour-là. Si on stocke l'apport sans épingler la cible, le
   jour où `profile.startKcal` change, tout l'historique se relit contre une cible
   qu'il n'a jamais connue — exactement l'incident `definition: null` de #26,
   rejoué sur la nutrition. Il faut donc épingler la cible avec l'apport, ou dater
   les cibles.

Cette question 3 est la vraie dépense de l'affaire, et **elle est indépendante de
MFP**. Elle se paie qu'on importe un CSV ou qu'on tape deux nombres à la main.

---

## 5. Recommandation

**Découpler les deux problèmes, et ne traiter que le premier.**

*Problème 1 — l'app ne garde aucune trace de ce qui a été mangé.* Réel, utile,
entièrement sous notre contrôle. Coût : un niveau A honnête (§4).

*Problème 2 — sortir ces nombres de MFP automatiquement.* Fermé (A), à 399 $/mois
(B), interdit et fragile (C), ou manuel avec 24 h de latence (D). Aucune option
n'est bonne aujourd'hui.

La suite qui en découle : ajouter au check-in hebdomadaire **deux champs
numériques** — kcal moyen et protéines moyennes sur la semaine — à côté de
« Écarts nutrition ». MFP les affiche gratuitement dans son Weekly Digest (les
deux derniers rapports restent accessibles sans Premium, ce qui couvre exactement
une cadence hebdomadaire). Coût de saisie : dix secondes le dimanche, au moment
où Simon remplit déjà poids, taille, sommeil, énergie et RIR.

L'argument qui tient même si les contraintes tombent : cette forme stockée est
**celle que n'importe quelle route d'import produirait de toute façon**. Si MFP
rouvrait son API demain, ou si le CSV valait soudain la manip, l'import
n'écrirait rien d'autre — il remplacerait la *saisie*, pas le *format*. On paie
donc maintenant la seule dépense inévitable (§4, questions 1 à 3), et on n'achète
aucune dépendance externe pour la découvrir.

À l'inverse, commencer par l'intégration reviendrait à concevoir le format de
stockage *sous la contrainte du CSV de MFP* — c'est-à-dire à laisser un tiers
dessiner un champ du journal, qui est le contrat de compatibilité du projet
(`CONTRIBUTING.md`).

**Ce qui rouvrirait le dossier :** MFP rouvre son programme développeur ; ou le
projet acquiert un backend pour un autre motif (multi-appareil, #18) et
l'intégration devient un ajout au lieu d'une fondation ; ou l'app se dote d'un
wrapper natif iOS, auquel cas HealthKit (route E) devient la bonne porte, sans
MFP du tout.

---

## Sources

- [MyFitnessPal Developer Portal](https://www.myfitnesspal.com/apps/api/version) — API privée, programme fermé
- [MyFitnessPal Terms of Service](https://www.myfitnesspal.com/terms-of-service) — interdiction des moyens automatisés
- [Terra — intégration MyFitnessPal](https://tryterra.co/integrations/myfitnesspal) et [tarifs](https://tryterra.co/pricing)
- [Terra — MFP et Apple Health pour applications web](https://tryterra.co/community/clarification-on-myfitnesspal-and-apple-health-integration-for-web-applications)
- [Validic — MyFitnessPal API Integration for Developers](https://help.validic.com/space/VCS/4698636289/MyFitnessPal+API+Integration+for+Developers) — limites 25 000/j, 60/s
- [`coddingtonbear/python-myfitnesspal`](https://github.com/coddingtonbear/python-myfitnesspal) — historique des correctifs 403 / Cloudflare
- [MyFitnessPal — Data Export FAQs](https://support.myfitnesspal.com/hc/en-us/articles/360032273352-Data-Export-FAQs) et [Weekly Digest](https://support.myfitnesspal.com/hc/en-us/articles/360032622591-Weekly-Digest)
- [Export gratuit via « Download My Data »](https://forkmate.ai/blog/export-myfitnesspal-data-free/)
