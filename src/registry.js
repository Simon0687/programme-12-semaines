/* =========================================================
   Registre d'exercices fermé — #25

   EXERCISES[id] est l'unique source des exercices que le moteur sait
   exécuter. Union de l'ancien BASE_V (40 entrées, champs d'exécution) et
   de docs/generation/catalogue-exercices-v1.json (50 entrées, champs de
   sélection) — ni l'un ni l'autre n'est un sur-ensemble de l'autre (#25
   decisions.md Q7/Q8). Les 40 entrées historiques gardent leurs ids
   (slugs courts) : le journal stocké est indexé par id de variante
   (log.ex[vid]), les renommer serait une migration pour un gain
   cosmétique. Les ~23 exercices propres au catalogue reçoivent de
   nouveaux slugs, dans le même style.

   ---------------------------------------------------------
   EXERCISES[id] — catalogue d'exercices, clé = slug court
     Champs d'exécution (ce que l'onglet Séance affiche/enregistre) :
       name     libellé affiché
       incr     pas de charge pour la progression, en kg. Absent => pas
                de charge suivie (sideplank « time », abwheel « reps »).
       start    jamais porté ici : injecté à l'exécution par
                buildProgram() depuis definition.startingLoads.
       perHand  charge par main (haltères) ; l'affichage ajoute « / main ».
       unit     "kg" (implicite, barre/machine/poulie)
                | "bw"    poids du corps, lest éventuel en kg
                | "time"  tenue en secondes, pas de charge
                | "reps"  répétitions au poids du corps, pas de charge
                | "carry" port lesté chronométré (kg + secondes)
       side     exécuté par côté ; l'affichage ajoute « par côté ».
       cue      consigne technique. Absente sur les entrées ajoutées par
                le catalogue et non encore utilisées par un SLOT — pas de
                texte coaching à inventer tant que rien ne les affiche.

     Champs de sélection (#25 Q8, ce qu'un générateur — LLM ou code —
     lit pour choisir un exercice ; jamais lus par le moteur actuel) :
       muscles         { groupe: part }, 11 clés, somme = 1.0. Voir
                        MUSCLE_GROUPS ci-dessous.
       pattern         un des PATTERNS ci-dessous.
       type            "compose" | "isolation".
       equipement      sous-ensemble de EQUIPMENT ci-dessous.
       articulations   sous-ensemble de ["epaule","coude","poignet",
                        "lombaires","hanche","genou"], seulement si
                        l'exercice la met sous contrainte notable.
       stabilite       1 = barre libre lourde · 2 = haltères/poids du
                        corps · 3 = machine/poulie (échec autorisé).
       niveau_min      1 = débutant · 2 = intermédiaire · 3 = avancé.
       cout_systemique 1 = isolation/machine · 2 = composé chargé ·
                        3 = composé axial lourd.
       alias           id kebab-case du catalogue de génération, quand
                        l'entrée en vient — traçabilité, jamais lu par
                        le moteur.

     Exception documentée, pas un oubli : pallof, sideplank, abwheel et
     carry n'ont pas de champs de sélection. Le catalogue de génération
     modélise tout le travail anti-mouvement/portés comme un unique
     pattern "abdominaux" et n'a pas les sémantiques time/reps/carry/side
     dont ces quatre exercices dépendent (#25 spec.md, amendement
     2026-09-10) — leur assigner un pattern inventerait une taxonomie que
     #25 n'a pas tranchée. Elles restent référençables par SLOTS/CORE
     (champs d'exécution complets) ; seule la sélection par un générateur
     en est privée pour l'instant.

   incr vs increment_kg : le catalogue de génération porte sa propre valeur
   générique par classe de matériel (`increment_kg`, conventions §). Pour
   les 27 entrées historiques reliées à une entrée du catalogue, `incr`
   est resté celui de BASE_V (déjà testé en salle) sans jamais être
   réécrit — la spec #25 exige un comportement byte-identique. Cinq
   entrées ont un `incr` qui diverge délibérément du `increment_kg` du
   catalogue, plaque/machine réelle plutôt que la valeur générique :
   pullup (2.5 vs 1.25), pushdown (5 vs 2.5), legpress (10 vs 5), crunch
   (5 vs 2.5), hlr (2 vs 1.25). Seul `incr` est exposé ; `increment_kg` ne
   ship jamais comme champ séparé (decisions.md Q8).

   EXERCISE_IDS   Set des clés de EXERCISES, pour une validation O(1)
                  (src/import.js).
   REGISTRY_VERSION   entier, non encore appliqué (réservé, #25 OQ1).
   MUSCLE_GROUPS / PATTERNS / EQUIPMENT   vocabulaires fermés, alignés sur
                  docs/generation/catalogue-exercices-v1.json §conventions
                  — à ne plus jamais diverger (mémo du 2026-09-10).
   ========================================================= */

export const REGISTRY_VERSION = 1;

export const MUSCLE_GROUPS = [
  "pectoraux", "triceps", "deltoide_ant", "deltoide_lat", "deltoide_post",
  "dos", "biceps", "quadriceps", "ischios_fessiers", "mollets", "abdominaux",
];

export const PATTERNS = [
  "poussee_horizontale", "poussee_verticale", "tirage_vertical", "tirage_horizontal",
  "dominante_genou", "charniere_hanche", "extension_hanche", "mollets", "abdominaux",
  "iso_pectoraux", "iso_deltoide_lateral", "iso_deltoide_posterieur",
  "iso_biceps", "iso_triceps", "iso_quadriceps", "iso_ischios",
];

export const EQUIPMENT = [
  "barre", "barre_ez", "halteres", "kettlebell", "banc", "banc_incline",
  "banc_lombaire", "rack", "barre_traction", "barres_paralleles", "poulie",
  "machine", "poids_du_corps",
];

export const EXERCISES = {
  // ---- les 40 entrées historiques (BASE_V), enrichies (#25) --------
  dc: { name: "Développé couché barre", incr: 2.5, cue: "Omoplates serrées et abaissées, pieds ancrés, cambrure naturelle. Barre sur le bas des pecs, descente 2–3 s, poussée explosive, pas de rebond.", muscles: { pectoraux: 0.6, triceps: 0.2, deltoide_ant: 0.2 }, pattern: "poussee_horizontale", type: "compose", equipement: ["barre", "banc", "rack"], articulations: ["epaule", "poignet"], stabilite: 1, niveau_min: 1, cout_systemique: 2, alias: "developpe-couche-barre" },
  incl_db: { name: "Développé incliné haltères (banc 30°)", incr: 2, perHand: true, cue: "Haltères au niveau des pecs, coudes à ~45°, amplitude confortable pour l'épaule. Montée forte, descente contrôlée.", muscles: { pectoraux: 0.55, deltoide_ant: 0.3, triceps: 0.15 }, pattern: "poussee_horizontale", type: "compose", equipement: ["halteres", "banc_incline"], articulations: ["epaule"], stabilite: 2, niveau_min: 1, cout_systemique: 2, alias: "developpe-incline-halteres" },
  incl_mach: { name: "Presse inclinée machine ou Smith", incr: 5, cue: "Poignées au niveau du haut des pecs, omoplates plaquées. Pousser fort, freiner 2–3 s.", muscles: { pectoraux: 0.55, deltoide_ant: 0.3, triceps: 0.15 }, pattern: "poussee_horizontale", type: "compose", equipement: ["machine"], articulations: ["epaule"], stabilite: 3, niveau_min: 1, cout_systemique: 1 },
  lat_db: { name: "Élévations latérales haltères, appuyé sur banc incliné", incr: 2, perHand: true, cue: "Buste contre un banc relevé pour supprimer l'élan. Trajet en diagonale (entre côté et devant), mains et coudes alignés, pas de haussement d'épaules. Descente 2–3 s. À traiter comme un exercice lourd : proche de l'échec.", muscles: { deltoide_lat: 1.0 }, pattern: "iso_deltoide_lateral", type: "isolation", equipement: ["halteres"], articulations: ["epaule"], stabilite: 2, niveau_min: 1, cout_systemique: 1, alias: "elevations-laterales-halteres" },
  lat_cable: { name: "Élévations latérales à la poulie (hauteur taille)", incr: 2.5, cue: "Poulie à hauteur de taille, bras tendu-souple, corps légèrement penché : tension maximale en bas de course. Même rigueur qu'aux haltères.", muscles: { deltoide_lat: 1.0 }, pattern: "iso_deltoide_lateral", type: "isolation", equipement: ["poulie"], articulations: ["epaule"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "elevations-laterales-poulie" },
  rpd: { name: "Reverse pec deck", incr: 5, cue: "Poitrine contre le dossier, bras presque tendus, ouvrir vers l'arrière sans hausser les épaules. Contraction 1 s, retour contrôlé.", muscles: { deltoide_post: 0.85, dos: 0.15 }, pattern: "iso_deltoide_posterieur", type: "isolation", equipement: ["machine"], articulations: [], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "reverse-pec-deck" },
  rev_cable: { name: "Écarté inversé à la poulie", incr: 2.5, cue: "Poulies hautes croisées, bras presque tendus, tirer vers l'arrière et l'extérieur. Buste stable.", muscles: { deltoide_post: 0.85, dos: 0.15 }, pattern: "iso_deltoide_posterieur", type: "isolation", equipement: ["poulie"], articulations: [], stabilite: 3, niveau_min: 1, cout_systemique: 1 },
  tri_oh: { name: "Extension triceps au-dessus de la tête, unilatérale à la poulie", incr: 2.5, cue: "Dos à la poulie basse, un bras, coude pointé au plafond. Étirement complet en bas, extension complète. 8–12 reps pour ménager le coude.", muscles: { triceps: 1.0 }, pattern: "iso_triceps", type: "isolation", equipement: ["poulie"], articulations: ["coude", "epaule"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "extension-triceps-corde-au-dessus-tete" },
  skull: { name: "Skull crusher haltères (descente derrière la tête)", incr: 2, perHand: true, cue: "Descente derrière la tête (moins de stress pour les coudes), coudes fixes. Banc légèrement incliné pour plus d'étirement si confortable.", muscles: { triceps: 1.0 }, pattern: "iso_triceps", type: "isolation", equipement: ["halteres", "banc"], articulations: ["coude"], stabilite: 2, niveau_min: 2, cout_systemique: 1 },
  squat: { name: "Squat barre", incr: 5, cue: "Bracing avant chaque descente, ceinture optionnelle. Profondeur confortable, genoux dans l'axe des pieds. Au moindre signal lombaire : hack squat ou presse.", muscles: { quadriceps: 0.6, ischios_fessiers: 0.3, abdominaux: 0.1 }, pattern: "dominante_genou", type: "compose", equipement: ["barre", "rack"], articulations: ["genou", "hanche", "lombaires"], stabilite: 1, niveau_min: 2, cout_systemique: 3, alias: "squat-barre-nuque" },
  lc_seat: { name: "Leg curl assis", incr: 5, cue: "Cuisses bloquées sous le coussin, buste légèrement penché en avant (ischios étirés). Contraction complète, retour 2–3 s.", muscles: { ischios_fessiers: 1.0 }, pattern: "iso_ischios", type: "isolation", equipement: ["machine"], articulations: ["genou"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "leg-curl-assis" },
  lc_lying: { name: "Leg curl allongé", incr: 5, cue: "Hanches plaquées sur le banc, aucune cambrure pour tricher. Contraction complète, retour 2–3 s.", muscles: { ischios_fessiers: 1.0 }, pattern: "iso_ischios", type: "isolation", equipement: ["machine"], articulations: ["genou"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "leg-curl-allonge" },
  calf_stand: { name: "Mollets debout (machine ou Smith)", incr: 5, cue: "Genoux tendus, descente complète avec pause 1 s en bas, pas de rebond, montée sur la pointe.", muscles: { mollets: 1.0 }, pattern: "mollets", type: "isolation", equipement: ["machine"], articulations: [], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "mollets-debout-machine" },
  calf_press: { name: "Mollets à la presse", incr: 10, cue: "Pieds en bas de la plateforme, genoux tendus, pause 1 s en bas, extension complète.", muscles: { mollets: 1.0 }, pattern: "mollets", type: "isolation", equipement: ["machine"], articulations: [], stabilite: 3, niveau_min: 1, cout_systemique: 1 },
  pullup: { name: "Tractions prise large", incr: 2.5, unit: "bw", cue: "Prise large en pronation, coudes vers les côtes, menton au-dessus de la barre. Descente 2–3 s. Sangles autorisées. Lest dès 3 × 8 à ≤ 1 RIR.", muscles: { dos: 0.7, biceps: 0.2, deltoide_post: 0.1 }, pattern: "tirage_vertical", type: "compose", equipement: ["barre_traction"], articulations: ["epaule", "coude"], stabilite: 2, niveau_min: 2, cout_systemique: 2, alias: "tractions-pronation" },
  pd_wide: { name: "Tirage vertical prise large", incr: 5, cue: "Genoux bloqués, léger recul du buste, tirer vers le haut des pecs coudes vers l'extérieur. Partielles contrôlées en fin de série OK.", muscles: { dos: 0.7, biceps: 0.2, deltoide_post: 0.1 }, pattern: "tirage_vertical", type: "compose", equipement: ["machine"], articulations: ["epaule"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "tirage-vertical-prise-large" },
  row_supp: { name: "Rowing buste appuyé prise large (T-bar ou machine)", incr: 5, cue: "Poitrine contre le support, prise large, coudes écartés, serrer les omoplates. Zéro charge lombaire. Sangles si la prise limite.", muscles: { dos: 0.65, biceps: 0.2, deltoide_post: 0.15 }, pattern: "tirage_horizontal", type: "compose", equipement: ["machine"], articulations: [], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "rowing-machine-appui-pectoral" },
  row_cable: { name: "Rowing assis à la poulie, prise large", incr: 5, cue: "Buste vertical et stable, coudes écartés, tirer vers le bas des pecs en rétractant les omoplates.", muscles: { dos: 0.65, biceps: 0.2, deltoide_post: 0.15 }, pattern: "tirage_horizontal", type: "compose", equipement: ["poulie"], articulations: ["lombaires"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "tirage-horizontal-poulie-basse" },
  curl_cable: { name: "Curl à la poulie, dos à la machine", incr: 2.5, cue: "Dos à la poulie basse, bras légèrement en arrière : charge maximale en bas de course. Coude fixe, contraction complète.", muscles: { biceps: 1.0 }, pattern: "iso_biceps", type: "isolation", equipement: ["poulie"], articulations: ["coude"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "curl-poulie-basse" },
  curl_db: { name: "Curl haltères assis", incr: 2, perHand: true, cue: "Assis, prise supination, coudes fixes, les deux bras ensemble (pas d'alterné). Descente 2–3 s.", muscles: { biceps: 1.0 }, pattern: "iso_biceps", type: "isolation", equipement: ["halteres"], articulations: ["coude"], stabilite: 2, niveau_min: 1, cout_systemique: 1, alias: "curl-halteres" },
  ohp_db: { name: "Développé épaules assis haltères (dossier 60–70°)", incr: 2, perHand: true, cue: "Dossier à 60–70°, haltères poussés ensemble, coudes légèrement vers l'avant, poignets au-dessus des coudes. Descendre jusqu'à la hauteur confortable, pas plus.", muscles: { deltoide_ant: 0.55, triceps: 0.25, deltoide_lat: 0.2 }, pattern: "poussee_verticale", type: "compose", equipement: ["halteres", "banc_incline"], articulations: ["epaule"], stabilite: 2, niveau_min: 1, cout_systemique: 2, alias: "developpe-halteres-assis" },
  ohp_mach: { name: "Développé épaules machine", incr: 5, cue: "Assise réglée pour partir à hauteur d'épaules. Pousser fort, freiner 2–3 s.", muscles: { deltoide_ant: 0.55, triceps: 0.25, deltoide_lat: 0.2 }, pattern: "poussee_verticale", type: "compose", equipement: ["machine"], articulations: ["epaule"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "developpe-epaules-machine" },
  curl_preacher: { name: "Curl pupitre barre EZ", incr: 2.5, cue: "Bras plaqués, coudes enfoncés dans le coussin, descente complète contrôlée, pas d'extension brutale en bas.", muscles: { biceps: 1.0 }, pattern: "iso_biceps", type: "isolation", equipement: ["barre_ez", "banc"], articulations: ["coude"], stabilite: 2, niveau_min: 1, cout_systemique: 1 },
  curl_cable_seat: { name: "Curl à la poulie dos à la machine, assis", incr: 2.5, cue: "Assis dos à la poulie pour ne plus être tiré par la pile. Même exécution que debout.", muscles: { biceps: 1.0 }, pattern: "iso_biceps", type: "isolation", equipement: ["poulie"], articulations: ["coude"], stabilite: 3, niveau_min: 1, cout_systemique: 1 },
  pushdown: { name: "Pushdown à la poulie (barre ou corde)", incr: 5, cue: "Coudes près du corps, buste légèrement penché, extension complète. Ceinture ou unilatéral si la pile te soulève.", muscles: { triceps: 1.0 }, pattern: "iso_triceps", type: "isolation", equipement: ["poulie"], articulations: ["coude"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "extension-triceps-poulie-haute" },
  pushdown_uni: { name: "Pushdown unilatéral cross-body", incr: 2.5, cue: "Un bras, poulie haute du côté opposé, extension vers la hanche opposée. Stable et confortable pour le coude.", muscles: { triceps: 1.0 }, pattern: "iso_triceps", type: "isolation", equipement: ["poulie"], articulations: ["coude"], stabilite: 3, niveau_min: 1, cout_systemique: 1 },
  pecdeck: { name: "Pec deck", incr: 5, cue: "Coudes légèrement fléchis, ouverture jusqu'à l'étirement confortable, fermeture complète 1 s.", muscles: { pectoraux: 0.9, deltoide_ant: 0.1 }, pattern: "iso_pectoraux", type: "isolation", equipement: ["machine"], articulations: ["epaule"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "pec-deck" },
  fly_cable: { name: "Écarté à la poulie", incr: 2.5, cue: "Poulies à hauteur d'épaules, léger pas en avant, bras arrondis, contraction 1 s, retour contrôlé.", muscles: { pectoraux: 0.85, deltoide_ant: 0.15 }, pattern: "iso_pectoraux", type: "isolation", equipement: ["poulie"], articulations: ["epaule"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "ecarte-poulie-vis-a-vis" },
  hipthrust: { name: "Hip thrust barre", incr: 5, cue: "Épaules sur le banc, côtes basses, menton rentré, tibias verticaux en haut. Verrouillage des fessiers sans hyperextension lombaire. Paliers depuis 60 kg en S1.", muscles: { ischios_fessiers: 1.0 }, pattern: "extension_hanche", type: "isolation", equipement: ["barre", "banc"], articulations: ["hanche"], stabilite: 2, niveau_min: 1, cout_systemique: 2, alias: "hip-thrust-barre" },
  legpress: { name: "Presse à cuisses", incr: 10, cue: "Pieds à mi-hauteur, largeur épaules. Descendre jusqu'au point où le bassin commence à décoller, pas plus.", muscles: { quadriceps: 0.65, ischios_fessiers: 0.35 }, pattern: "dominante_genou", type: "compose", equipement: ["machine"], articulations: ["genou"], stabilite: 3, niveau_min: 1, cout_systemique: 2, alias: "presse-a-cuisses" },
  hack: { name: "Hack squat", incr: 5, cue: "Dos plaqué, pieds légèrement avancés, descente profonde confortable, pas de verrouillage brutal.", muscles: { quadriceps: 0.65, ischios_fessiers: 0.35 }, pattern: "dominante_genou", type: "compose", equipement: ["machine"], articulations: ["genou"], stabilite: 3, niveau_min: 1, cout_systemique: 2 },
  pd_close: { name: "Tirage vertical prise serrée neutre", incr: 5, cue: "Poignée neutre serrée, coudes le long du corps, tirer vers le sternum avec un léger recul. Partielles OK en fin de série.", muscles: { dos: 0.65, biceps: 0.25, deltoide_post: 0.1 }, pattern: "tirage_vertical", type: "compose", equipement: ["machine"], articulations: [], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "tirage-vertical-prise-neutre" },
  row_uni: { name: "Rowing unilatéral à la poulie, coudes serrés", incr: 2.5, cue: "Un bras, poignée neutre, coude qui frotte les côtes, buste stable, étirement complet devant.", muscles: { dos: 0.65, biceps: 0.2, deltoide_post: 0.15 }, pattern: "tirage_horizontal", type: "compose", equipement: ["poulie"], articulations: [], stabilite: 3, niveau_min: 1, cout_systemique: 1 },
  calf_seat: { name: "Mollets assis", incr: 5, cue: "Pause 1 s en bas, montée complète, pas de rebond. Cible le soléaire.", muscles: { mollets: 1.0 }, pattern: "mollets", type: "isolation", equipement: ["machine"], articulations: [], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "mollets-assis-machine" },
  crunch: { name: "Crunch à la poulie haute, à genoux", incr: 5, cue: "Corde à la poulie haute, enrouler le buste en ramenant les côtes vers le bassin. Les hanches ne bougent pas, lombaires neutres.", muscles: { abdominaux: 1.0 }, pattern: "abdominaux", type: "isolation", equipement: ["poulie"], articulations: ["lombaires"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "crunch-poulie-haute" },
  pallof: { name: "Pallof press à la poulie", incr: 2.5, side: true, cue: "Poulie à hauteur de poitrine, de profil. Tendre les bras devant soi sans laisser le buste tourner, tenir 2 s, revenir. Par côté." }, // pas de champs de sélection : voir la note d'en-tête
  hlr: { name: "Relevé de jambes suspendu", incr: 2, unit: "bw", cue: "Bassin en rétroversion, monter les jambes en enroulant le bassin. Genoux fléchis d'abord, jambes tendues ensuite, puis haltère entre les pieds.", muscles: { abdominaux: 1.0 }, pattern: "abdominaux", type: "isolation", equipement: ["barre_traction"], articulations: ["lombaires"], stabilite: 2, niveau_min: 2, cout_systemique: 1, alias: "releve-de-jambes-suspendu" },
  sideplank: { name: "Planche latérale (McGill)", unit: "time", side: true, cue: "Coude sous l'épaule, corps aligné, hanches hautes. Genoux au sol si besoin. Par côté, jamais jusqu'à la perte d'alignement." }, // pas de champs de sélection : voir la note d'en-tête
  abwheel: { name: "Ab wheel à genoux", unit: "reps", cue: "Lombaires neutres et bassin en légère rétroversion pendant tout le mouvement. Amplitude courte d'abord, allonger ensuite. Stop si le dos creuse." }, // pas de champs de sélection : voir la note d'en-tête
  carry: { name: "Suitcase carry haltère", incr: 2, unit: "carry", side: true, cue: "Un haltère lourd d'un côté, buste vertical, marcher sans pencher. Anti-flexion latérale. Par côté." }, // pas de champs de sélection : voir la note d'en-tête

  // ---- exercices propres au catalogue de génération (#25 Q8) --------
  // Pas encore rattachés à un SLOT du programme par défaut : pas de cue,
  // rien ne l'affiche pour l'instant. Nouveaux slugs, même style que les
  // 40 ci-dessus.
  dc_db: { name: "Développé couché haltères", incr: 2, perHand: true, muscles: { pectoraux: 0.6, triceps: 0.2, deltoide_ant: 0.2 }, pattern: "poussee_horizontale", type: "compose", equipement: ["halteres", "banc"], articulations: ["epaule"], stabilite: 2, niveau_min: 1, cout_systemique: 2, alias: "developpe-couche-halteres" },
  dc_mach: { name: "Développé couché machine convergente", incr: 5, muscles: { pectoraux: 0.6, triceps: 0.2, deltoide_ant: 0.2 }, pattern: "poussee_horizontale", type: "compose", equipement: ["machine"], articulations: [], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "developpe-couche-machine-convergente" },
  dips: { name: "Dips buste penché", incr: 1.25, unit: "bw", muscles: { pectoraux: 0.5, triceps: 0.3, deltoide_ant: 0.2 }, pattern: "poussee_horizontale", type: "compose", equipement: ["barres_paralleles"], articulations: ["epaule"], stabilite: 2, niveau_min: 2, cout_systemique: 2, alias: "dips-pectoraux" },
  pushup: { name: "Pompes", incr: 1.25, unit: "bw", muscles: { pectoraux: 0.6, triceps: 0.2, deltoide_ant: 0.2 }, pattern: "poussee_horizontale", type: "compose", equipement: ["poids_du_corps"], articulations: ["poignet"], stabilite: 2, niveau_min: 1, cout_systemique: 1, alias: "pompes" },
  ohp_bb: { name: "Développé militaire barre debout", incr: 2.5, muscles: { deltoide_ant: 0.55, triceps: 0.25, deltoide_lat: 0.2 }, pattern: "poussee_verticale", type: "compose", equipement: ["barre", "rack"], articulations: ["epaule", "poignet", "lombaires"], stabilite: 1, niveau_min: 2, cout_systemique: 2, alias: "developpe-militaire-barre-debout" },
  row_bb: { name: "Rowing barre buste penché", incr: 2.5, muscles: { dos: 0.65, biceps: 0.2, deltoide_post: 0.15 }, pattern: "tirage_horizontal", type: "compose", equipement: ["barre"], articulations: ["lombaires"], stabilite: 1, niveau_min: 2, cout_systemique: 2, alias: "rowing-barre" },
  row_db_uni: { name: "Rowing haltère un bras", incr: 2, perHand: true, muscles: { dos: 0.65, biceps: 0.2, deltoide_post: 0.15 }, pattern: "tirage_horizontal", type: "compose", equipement: ["halteres", "banc"], articulations: [], stabilite: 2, niveau_min: 1, cout_systemique: 1, alias: "rowing-halteres-un-bras" },
  row_inv: { name: "Rowing inversé sous barre", incr: 1.25, unit: "bw", muscles: { dos: 0.65, biceps: 0.2, deltoide_post: 0.15 }, pattern: "tirage_horizontal", type: "compose", equipement: ["barre", "rack"], articulations: ["poignet"], stabilite: 2, niveau_min: 1, cout_systemique: 1, alias: "rowing-inverse-barre" },
  goblet_squat: { name: "Squat gobelet", incr: 2, muscles: { quadriceps: 0.6, ischios_fessiers: 0.3, abdominaux: 0.1 }, pattern: "dominante_genou", type: "compose", equipement: ["halteres"], articulations: ["genou", "hanche"], stabilite: 2, niveau_min: 1, cout_systemique: 2, alias: "squat-gobelet" },
  lunge_db: { name: "Fentes marchées haltères", incr: 2, muscles: { quadriceps: 0.5, ischios_fessiers: 0.45, mollets: 0.05 }, pattern: "dominante_genou", type: "compose", equipement: ["halteres"], articulations: ["genou"], stabilite: 2, niveau_min: 2, cout_systemique: 2, alias: "fentes-marchees-halteres" },
  bulg_split: { name: "Split squat bulgare haltères", incr: 2, muscles: { quadriceps: 0.55, ischios_fessiers: 0.4, mollets: 0.05 }, pattern: "dominante_genou", type: "compose", equipement: ["halteres", "banc"], articulations: ["genou", "hanche"], stabilite: 2, niveau_min: 2, cout_systemique: 2, alias: "split-squat-bulgare-halteres" },
  leg_ext: { name: "Leg extension", incr: 5, muscles: { quadriceps: 1.0 }, pattern: "iso_quadriceps", type: "isolation", equipement: ["machine"], articulations: ["genou"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "leg-extension" },
  dl_conv: { name: "Soulevé de terre conventionnel", incr: 5, muscles: { ischios_fessiers: 0.55, dos: 0.3, quadriceps: 0.15 }, pattern: "charniere_hanche", type: "compose", equipement: ["barre"], articulations: ["lombaires", "hanche"], stabilite: 1, niveau_min: 3, cout_systemique: 3, alias: "souleve-de-terre-conventionnel" },
  rdl_bb: { name: "Soulevé de terre roumain barre", incr: 5, muscles: { ischios_fessiers: 0.7, dos: 0.3 }, pattern: "charniere_hanche", type: "compose", equipement: ["barre"], articulations: ["lombaires", "hanche"], stabilite: 1, niveau_min: 2, cout_systemique: 3, alias: "souleve-de-terre-roumain-barre" },
  rdl_db: { name: "Soulevé de terre roumain haltères", incr: 2, muscles: { ischios_fessiers: 0.7, dos: 0.3 }, pattern: "charniere_hanche", type: "compose", equipement: ["halteres"], articulations: ["lombaires", "hanche"], stabilite: 2, niveau_min: 1, cout_systemique: 2, alias: "souleve-de-terre-roumain-halteres" },
  back_ext: { name: "Extension lombaire au banc", incr: 1.25, muscles: { ischios_fessiers: 0.6, dos: 0.4 }, pattern: "charniere_hanche", type: "isolation", equipement: ["banc_lombaire"], articulations: ["lombaires"], stabilite: 2, niveau_min: 1, cout_systemique: 1, alias: "extension-lombaire-banc" },
  cable_pullthrough: { name: "Tirage entre les jambes à la poulie", incr: 2.5, muscles: { ischios_fessiers: 0.85, dos: 0.15 }, pattern: "extension_hanche", type: "isolation", equipement: ["poulie"], articulations: ["hanche"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "tirage-entre-jambes-poulie" },
  lat_mach: { name: "Élévations latérales machine", incr: 5, muscles: { deltoide_lat: 1.0 }, pattern: "iso_deltoide_lateral", type: "isolation", equipement: ["machine"], articulations: ["epaule"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "elevations-laterales-machine" },
  reardelt_db: { name: "Oiseau haltères au banc incliné", incr: 2, perHand: true, muscles: { deltoide_post: 0.85, dos: 0.15 }, pattern: "iso_deltoide_posterieur", type: "isolation", equipement: ["halteres", "banc_incline"], articulations: [], stabilite: 2, niveau_min: 1, cout_systemique: 1, alias: "oiseau-halteres-banc-incline" },
  facepull: { name: "Face pull à la poulie", incr: 2.5, muscles: { deltoide_post: 0.7, dos: 0.3 }, pattern: "iso_deltoide_posterieur", type: "isolation", equipement: ["poulie"], articulations: [], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "face-pull-poulie" },
  curl_ez: { name: "Curl barre EZ", incr: 2.5, muscles: { biceps: 1.0 }, pattern: "iso_biceps", type: "isolation", equipement: ["barre_ez"], articulations: ["coude", "poignet"], stabilite: 2, niveau_min: 1, cout_systemique: 1, alias: "curl-barre-ez" },
  skull_ez: { name: "Barre au front (barre EZ)", incr: 2.5, muscles: { triceps: 1.0 }, pattern: "iso_triceps", type: "isolation", equipement: ["barre_ez", "banc"], articulations: ["coude"], stabilite: 2, niveau_min: 2, cout_systemique: 1, alias: "barre-au-front-barre-ez" },
  plank_weighted: { name: "Gainage planche lesté", incr: 1.25, unit: "bw", muscles: { abdominaux: 1.0 }, pattern: "abdominaux", type: "isolation", equipement: ["poids_du_corps"], articulations: [], stabilite: 2, niveau_min: 1, cout_systemique: 1, alias: "gainage-planche-leste" },
};

export const EXERCISE_IDS = new Set(Object.keys(EXERCISES));

/* Entrées volontairement sans champs de sélection (voir la note
   d'en-tête) — exposé pour que test/registry.test.js sache les exclure
   des vérifications d'intégrité sans deviner pourquoi à chaque fois. */
export const UNSELECTABLE_IDS = new Set(["pallof", "sideplank", "abwheel", "carry"]);
