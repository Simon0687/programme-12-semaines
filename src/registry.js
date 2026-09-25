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
     Champs d'exécution (ce que l'écran Séance affiche/enregistre) :
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
       cue      consigne technique, en points : [[famille, texte], …].
                Deux à cinq points, une idée chacun, sans point final. La
                famille est une clé de CUE_KINDS ci-dessous ; elle choisit
                le picto du point à l'écran (Séance, fiche exercice).
                Présente sur **toutes** les entrées.

                Pourquoi des points et pas un paragraphe (#119, 2026-09-26) :
                la fiche exercice présente la technique en points à picto
                (maquette « Fiche exercice », E2). Un paragraphe obligeait
                l'écran à le couper à la phrase et à deviner le picto par
                mots-clés — « Barre sur le bas des pecs, descente 2–3 s,
                poussée explosive » recevait celui de la prise. Découper
                à la source dit l'intention au lieu de la deviner.

                Pourquoi sur toutes les entrées : l'ancienne règle (« pas de
                texte à inventer tant que rien ne les affiche ») ne tient
                plus. Le générateur (#58, #59) pose ces exercices dans des
                programmes, et la fiche et la Séance les affichent. Les
                consignes des 40 entrées historiques sont celles de Simon,
                redécoupées sans rien retirer. Celles des 36 autres ont été
                rédigées le 2026-09-26 et restent à relire.

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
   CUE_KINDS      vocabulaire fermé des familles de consigne. Propre à
                  l'appli, hors du catalogue de génération : c'est un
                  choix d'affichage, qu'aucun générateur ne lit.
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

/* Les familles d'une consigne, dans l'ordre où un coach les donnerait :
   s'installer, se placer, saisir, bouger, et ce qui encadre le mouvement. */
export const CUE_KINDS = [
  "reglage",      // installation : machine, banc, poulie, charge en main
  "posture",      // buste, omoplates, gainage, coudes fixes
  "appuis",       // pieds, genoux, hanches au contact
  "prise",        // mains, poignée, sangles
  "trajet",       // chemin de la charge ou des coudes
  "amplitude",    // jusqu'où descendre ou monter
  "tempo",        // durées, pauses, contrôle
  "intention",    // ce qu'on cherche à faire : explosivité, contraction, effort
  "cible",        // ce que l'exercice travaille en particulier
  "progression",  // comment le rendre plus dur, ou plus facile
  "securite",     // la limite à ne pas franchir
];

export const EXERCISES = {
  // ---- les 40 entrées historiques (BASE_V), enrichies (#25) --------
  dc: { name: "Développé couché barre", incr: 2.5, cue: [["posture", "Omoplates serrées et abaissées"], ["appuis", "Pieds ancrés, cambrure naturelle"], ["tempo", "Descente 2–3 s jusqu'au bas des pecs"], ["intention", "Poussée explosive, pas de rebond"]], muscles: { pectoraux: 0.6, triceps: 0.2, deltoide_ant: 0.2 }, pattern: "poussee_horizontale", type: "compose", equipement: ["barre", "banc", "rack"], articulations: ["epaule", "poignet"], stabilite: 1, niveau_min: 1, cout_systemique: 2, alias: "developpe-couche-barre" },
  incl_db: { name: "Développé incliné haltères (banc 30°)", incr: 2, perHand: true, cue: [["trajet", "Haltères au niveau des pecs, coudes à ~45°"], ["amplitude", "Amplitude confortable pour l'épaule"], ["tempo", "Montée forte, descente contrôlée"]], muscles: { pectoraux: 0.55, deltoide_ant: 0.3, triceps: 0.15 }, pattern: "poussee_horizontale", type: "compose", equipement: ["halteres", "banc_incline"], articulations: ["epaule"], stabilite: 2, niveau_min: 1, cout_systemique: 2, alias: "developpe-incline-halteres" },
  incl_mach: { name: "Presse inclinée machine ou Smith", incr: 5, cue: [["reglage", "Poignées au niveau du haut des pecs"], ["posture", "Omoplates plaquées"], ["tempo", "Pousser fort, freiner 2–3 s"]], muscles: { pectoraux: 0.55, deltoide_ant: 0.3, triceps: 0.15 }, pattern: "poussee_horizontale", type: "compose", equipement: ["machine"], articulations: ["epaule"], stabilite: 3, niveau_min: 1, cout_systemique: 1 },
  lat_db: { name: "Élévations latérales haltères, appuyé sur banc incliné", incr: 2, perHand: true, cue: [["reglage", "Buste contre un banc relevé : pas d'élan"], ["trajet", "Trajet en diagonale, entre côté et devant"], ["posture", "Mains et coudes alignés, sans hausser les épaules"], ["tempo", "Descente 2–3 s"], ["intention", "Comme un exercice lourd : proche de l'échec"]], muscles: { deltoide_lat: 1.0 }, pattern: "iso_deltoide_lateral", type: "isolation", equipement: ["halteres"], articulations: ["epaule"], stabilite: 2, niveau_min: 1, cout_systemique: 1, alias: "elevations-laterales-halteres" },
  lat_cable: { name: "Élévations latérales à la poulie (hauteur taille)", incr: 2.5, cue: [["reglage", "Poulie à hauteur de taille"], ["posture", "Bras tendu-souple, corps légèrement penché"], ["amplitude", "Tension maximale en bas de course"], ["intention", "Même rigueur qu'aux haltères"]], muscles: { deltoide_lat: 1.0 }, pattern: "iso_deltoide_lateral", type: "isolation", equipement: ["poulie"], articulations: ["epaule"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "elevations-laterales-poulie" },
  rpd: { name: "Reverse pec deck", incr: 5, cue: [["posture", "Poitrine contre le dossier"], ["trajet", "Bras presque tendus, ouvrir vers l'arrière"], ["posture", "Sans hausser les épaules"], ["tempo", "Contraction 1 s, retour contrôlé"]], muscles: { deltoide_post: 0.85, dos: 0.15 }, pattern: "iso_deltoide_posterieur", type: "isolation", equipement: ["machine"], articulations: [], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "reverse-pec-deck" },
  rev_cable: { name: "Écarté inversé à la poulie", incr: 2.5, cue: [["reglage", "Poulies hautes, câbles croisés"], ["trajet", "Bras presque tendus, tirer vers l'arrière et l'extérieur"], ["posture", "Buste stable"]], muscles: { deltoide_post: 0.85, dos: 0.15 }, pattern: "iso_deltoide_posterieur", type: "isolation", equipement: ["poulie"], articulations: [], stabilite: 3, niveau_min: 1, cout_systemique: 1 },
  tri_oh: { name: "Extension triceps au-dessus de la tête, unilatérale à la poulie", incr: 2.5, cue: [["reglage", "Dos à la poulie basse, un bras"], ["posture", "Coude pointé au plafond"], ["amplitude", "Étirement complet en bas, extension complète"], ["securite", "8–12 reps pour ménager le coude"]], muscles: { triceps: 1.0 }, pattern: "iso_triceps", type: "isolation", equipement: ["poulie"], articulations: ["coude", "epaule"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "extension-triceps-corde-au-dessus-tete" },
  skull: { name: "Skull crusher haltères (descente derrière la tête)", incr: 2, perHand: true, cue: [["trajet", "Descente derrière la tête : moins de stress pour les coudes"], ["posture", "Coudes fixes"], ["reglage", "Banc légèrement incliné pour plus d'étirement, si confortable"]], muscles: { triceps: 1.0 }, pattern: "iso_triceps", type: "isolation", equipement: ["halteres", "banc"], articulations: ["coude"], stabilite: 2, niveau_min: 2, cout_systemique: 1 },
  squat: { name: "Squat barre", incr: 5, cue: [["posture", "Bracing avant chaque descente, ceinture optionnelle"], ["amplitude", "Profondeur confortable"], ["appuis", "Genoux dans l'axe des pieds"], ["securite", "Au moindre signal lombaire : hack squat ou presse"]], muscles: { quadriceps: 0.6, ischios_fessiers: 0.3, abdominaux: 0.1 }, pattern: "dominante_genou", type: "compose", equipement: ["barre", "rack"], articulations: ["genou", "hanche", "lombaires"], stabilite: 1, niveau_min: 2, cout_systemique: 3, alias: "squat-barre-nuque" },
  lc_seat: { name: "Leg curl assis", incr: 5, cue: [["reglage", "Cuisses bloquées sous le coussin"], ["posture", "Buste légèrement penché en avant : ischios étirés"], ["tempo", "Contraction complète, retour 2–3 s"]], muscles: { ischios_fessiers: 1.0 }, pattern: "iso_ischios", type: "isolation", equipement: ["machine"], articulations: ["genou"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "leg-curl-assis" },
  lc_lying: { name: "Leg curl allongé", incr: 5, cue: [["appuis", "Hanches plaquées sur le banc"], ["posture", "Aucune cambrure pour tricher"], ["tempo", "Contraction complète, retour 2–3 s"]], muscles: { ischios_fessiers: 1.0 }, pattern: "iso_ischios", type: "isolation", equipement: ["machine"], articulations: ["genou"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "leg-curl-allonge" },
  calf_stand: { name: "Mollets debout (machine ou Smith)", incr: 5, cue: [["appuis", "Genoux tendus"], ["tempo", "Descente complète, pause 1 s en bas, pas de rebond"], ["amplitude", "Montée jusque sur la pointe"]], muscles: { mollets: 1.0 }, pattern: "mollets", type: "isolation", equipement: ["machine"], articulations: [], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "mollets-debout-machine" },
  calf_press: { name: "Mollets à la presse", incr: 10, cue: [["appuis", "Pieds en bas de la plateforme, genoux tendus"], ["tempo", "Pause 1 s en bas"], ["amplitude", "Extension complète"]], muscles: { mollets: 1.0 }, pattern: "mollets", type: "isolation", equipement: ["machine"], articulations: [], stabilite: 3, niveau_min: 1, cout_systemique: 1 },
  pullup: { name: "Tractions prise large", incr: 2.5, unit: "bw", cue: [["prise", "Prise large en pronation, sangles autorisées"], ["trajet", "Coudes vers les côtes, menton au-dessus de la barre"], ["tempo", "Descente 2–3 s"], ["progression", "Lest dès 3 × 8 à ≤ 1 RIR"]], muscles: { dos: 0.7, biceps: 0.2, deltoide_post: 0.1 }, pattern: "tirage_vertical", type: "compose", equipement: ["barre_traction"], articulations: ["epaule", "coude"], stabilite: 2, niveau_min: 2, cout_systemique: 2, alias: "tractions-pronation" },
  pd_wide: { name: "Tirage vertical prise large", incr: 5, cue: [["appuis", "Genoux bloqués"], ["posture", "Léger recul du buste"], ["trajet", "Tirer vers le haut des pecs, coudes vers l'extérieur"], ["intention", "Partielles contrôlées en fin de série : OK"]], muscles: { dos: 0.7, biceps: 0.2, deltoide_post: 0.1 }, pattern: "tirage_vertical", type: "compose", equipement: ["machine"], articulations: ["epaule"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "tirage-vertical-prise-large" },
  row_supp: { name: "Rowing buste appuyé prise large (T-bar ou machine)", incr: 5, cue: [["posture", "Poitrine contre le support : zéro charge lombaire"], ["prise", "Prise large, sangles si la prise limite"], ["trajet", "Coudes écartés, serrer les omoplates"]], muscles: { dos: 0.65, biceps: 0.2, deltoide_post: 0.15 }, pattern: "tirage_horizontal", type: "compose", equipement: ["machine"], articulations: [], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "rowing-machine-appui-pectoral" },
  row_cable: { name: "Rowing assis à la poulie, prise large", incr: 5, cue: [["posture", "Buste vertical et stable"], ["trajet", "Coudes écartés, tirer vers le bas des pecs"], ["intention", "Rétracter les omoplates en tirant"]], muscles: { dos: 0.65, biceps: 0.2, deltoide_post: 0.15 }, pattern: "tirage_horizontal", type: "compose", equipement: ["poulie"], articulations: ["lombaires"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "tirage-horizontal-poulie-basse" },
  curl_cable: { name: "Curl à la poulie, dos à la machine", incr: 2.5, cue: [["reglage", "Dos à la poulie basse, bras légèrement en arrière"], ["amplitude", "Charge maximale en bas de course"], ["posture", "Coude fixe, contraction complète"]], muscles: { biceps: 1.0 }, pattern: "iso_biceps", type: "isolation", equipement: ["poulie"], articulations: ["coude"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "curl-poulie-basse" },
  curl_db: { name: "Curl haltères assis", incr: 2, perHand: true, cue: [["prise", "Assis, prise en supination"], ["posture", "Coudes fixes"], ["trajet", "Les deux bras ensemble, pas d'alterné"], ["tempo", "Descente 2–3 s"]], muscles: { biceps: 1.0 }, pattern: "iso_biceps", type: "isolation", equipement: ["halteres"], articulations: ["coude"], stabilite: 2, niveau_min: 1, cout_systemique: 1, alias: "curl-halteres" },
  ohp_db: { name: "Développé épaules assis haltères (dossier 60–70°)", incr: 2, perHand: true, cue: [["reglage", "Dossier à 60–70°"], ["trajet", "Haltères poussés ensemble, coudes légèrement vers l'avant"], ["prise", "Poignets au-dessus des coudes"], ["amplitude", "Descendre jusqu'à la hauteur confortable, pas plus"]], muscles: { deltoide_ant: 0.55, triceps: 0.25, deltoide_lat: 0.2 }, pattern: "poussee_verticale", type: "compose", equipement: ["halteres", "banc_incline"], articulations: ["epaule"], stabilite: 2, niveau_min: 1, cout_systemique: 2, alias: "developpe-halteres-assis" },
  ohp_mach: { name: "Développé épaules machine", incr: 5, cue: [["reglage", "Assise réglée pour partir à hauteur d'épaules"], ["tempo", "Pousser fort, freiner 2–3 s"]], muscles: { deltoide_ant: 0.55, triceps: 0.25, deltoide_lat: 0.2 }, pattern: "poussee_verticale", type: "compose", equipement: ["machine"], articulations: ["epaule"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "developpe-epaules-machine" },
  curl_preacher: { name: "Curl pupitre barre EZ", incr: 2.5, cue: [["posture", "Bras plaqués, coudes enfoncés dans le coussin"], ["tempo", "Descente complète et contrôlée"], ["securite", "Pas d'extension brutale en bas"]], muscles: { biceps: 1.0 }, pattern: "iso_biceps", type: "isolation", equipement: ["barre_ez", "banc"], articulations: ["coude"], stabilite: 2, niveau_min: 1, cout_systemique: 1 },
  curl_cable_seat: { name: "Curl à la poulie dos à la machine, assis", incr: 2.5, cue: [["reglage", "Assis dos à la poulie : la pile ne tire plus"], ["amplitude", "Charge maximale en bas de course"], ["posture", "Coude fixe, contraction complète"]], muscles: { biceps: 1.0 }, pattern: "iso_biceps", type: "isolation", equipement: ["poulie"], articulations: ["coude"], stabilite: 3, niveau_min: 1, cout_systemique: 1 },
  pushdown: { name: "Pushdown à la poulie (barre ou corde)", incr: 5, cue: [["posture", "Coudes près du corps, buste légèrement penché"], ["amplitude", "Extension complète"], ["reglage", "Ceinture ou unilatéral si la pile te soulève"]], muscles: { triceps: 1.0 }, pattern: "iso_triceps", type: "isolation", equipement: ["poulie"], articulations: ["coude"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "extension-triceps-poulie-haute" },
  pushdown_uni: { name: "Pushdown unilatéral cross-body", incr: 2.5, cue: [["reglage", "Un bras, poulie haute du côté opposé"], ["trajet", "Extension vers la hanche opposée"], ["securite", "Stable et confortable pour le coude"]], muscles: { triceps: 1.0 }, pattern: "iso_triceps", type: "isolation", equipement: ["poulie"], articulations: ["coude"], stabilite: 3, niveau_min: 1, cout_systemique: 1 },
  pecdeck: { name: "Pec deck", incr: 5, cue: [["posture", "Coudes légèrement fléchis"], ["amplitude", "Ouverture jusqu'à l'étirement confortable"], ["tempo", "Fermeture complète, tenue 1 s"]], muscles: { pectoraux: 0.9, deltoide_ant: 0.1 }, pattern: "iso_pectoraux", type: "isolation", equipement: ["machine"], articulations: ["epaule"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "pec-deck" },
  fly_cable: { name: "Écarté à la poulie", incr: 2.5, cue: [["reglage", "Poulies à hauteur d'épaules, léger pas en avant"], ["posture", "Bras arrondis"], ["tempo", "Contraction 1 s, retour contrôlé"]], muscles: { pectoraux: 0.85, deltoide_ant: 0.15 }, pattern: "iso_pectoraux", type: "isolation", equipement: ["poulie"], articulations: ["epaule"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "ecarte-poulie-vis-a-vis" },
  hipthrust: { name: "Hip thrust barre", incr: 5, cue: [["reglage", "Épaules sur le banc"], ["posture", "Côtes basses, menton rentré"], ["appuis", "Tibias verticaux en haut"], ["securite", "Verrouiller les fessiers sans hyperextension lombaire"], ["progression", "Paliers depuis 60 kg en S1"]], muscles: { ischios_fessiers: 1.0 }, pattern: "extension_hanche", type: "isolation", equipement: ["barre", "banc"], articulations: ["hanche"], stabilite: 2, niveau_min: 1, cout_systemique: 2, alias: "hip-thrust-barre" },
  legpress: { name: "Presse à cuisses", incr: 10, cue: [["appuis", "Pieds à mi-hauteur, largeur épaules"], ["amplitude", "Descendre jusqu'à ce que le bassin commence à décoller, pas plus"]], muscles: { quadriceps: 0.65, ischios_fessiers: 0.35 }, pattern: "dominante_genou", type: "compose", equipement: ["machine"], articulations: ["genou"], stabilite: 3, niveau_min: 1, cout_systemique: 2, alias: "presse-a-cuisses" },
  hack: { name: "Hack squat", incr: 5, cue: [["posture", "Dos plaqué"], ["appuis", "Pieds légèrement avancés"], ["amplitude", "Descente profonde, tant qu'elle reste confortable"], ["securite", "Pas de verrouillage brutal"]], muscles: { quadriceps: 0.65, ischios_fessiers: 0.35 }, pattern: "dominante_genou", type: "compose", equipement: ["machine"], articulations: ["genou"], stabilite: 3, niveau_min: 1, cout_systemique: 2 },
  pd_close: { name: "Tirage vertical prise serrée neutre", incr: 5, cue: [["prise", "Poignée neutre serrée"], ["trajet", "Coudes le long du corps, tirer vers le sternum"], ["posture", "Léger recul du buste"], ["intention", "Partielles en fin de série : OK"]], muscles: { dos: 0.65, biceps: 0.25, deltoide_post: 0.1 }, pattern: "tirage_vertical", type: "compose", equipement: ["machine"], articulations: [], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "tirage-vertical-prise-neutre" },
  row_uni: { name: "Rowing unilatéral à la poulie, coudes serrés", incr: 2.5, cue: [["prise", "Un bras, poignée neutre"], ["trajet", "Coude qui frotte les côtes"], ["posture", "Buste stable"], ["amplitude", "Étirement complet devant"]], muscles: { dos: 0.65, biceps: 0.2, deltoide_post: 0.15 }, pattern: "tirage_horizontal", type: "compose", equipement: ["poulie"], articulations: [], stabilite: 3, niveau_min: 1, cout_systemique: 1 },
  calf_seat: { name: "Mollets assis", incr: 5, cue: [["tempo", "Pause 1 s en bas, pas de rebond"], ["amplitude", "Montée complète"], ["cible", "Cible le soléaire"]], muscles: { mollets: 1.0 }, pattern: "mollets", type: "isolation", equipement: ["machine"], articulations: [], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "mollets-assis-machine" },
  crunch: { name: "Crunch à la poulie haute, à genoux", incr: 5, cue: [["reglage", "Corde à la poulie haute, à genoux"], ["trajet", "Enrouler le buste, côtes vers le bassin"], ["posture", "Hanches immobiles, lombaires neutres"]], muscles: { abdominaux: 1.0 }, pattern: "abdominaux", type: "isolation", equipement: ["poulie"], articulations: ["lombaires"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "crunch-poulie-haute" },
  pallof: { name: "Pallof press à la poulie", incr: 2.5, side: true, cue: [["reglage", "Poulie à hauteur de poitrine, de profil, un côté puis l'autre"], ["posture", "Tendre les bras sans laisser le buste tourner"], ["tempo", "Tenir 2 s, revenir"]] }, // pas de champs de sélection : voir la note d'en-tête
  hlr: { name: "Relevé de jambes suspendu", incr: 2, unit: "bw", cue: [["posture", "Bassin en rétroversion"], ["trajet", "Monter les jambes en enroulant le bassin"], ["progression", "Genoux fléchis, puis jambes tendues, puis haltère entre les pieds"]], muscles: { abdominaux: 1.0 }, pattern: "abdominaux", type: "isolation", equipement: ["barre_traction"], articulations: ["lombaires"], stabilite: 2, niveau_min: 2, cout_systemique: 1, alias: "releve-de-jambes-suspendu" },
  sideplank: { name: "Planche latérale (McGill)", unit: "time", side: true, cue: [["appuis", "Coude sous l'épaule"], ["posture", "Corps aligné, hanches hautes"], ["progression", "Genoux au sol si besoin"], ["securite", "Par côté, jamais jusqu'à la perte d'alignement"]] }, // pas de champs de sélection : voir la note d'en-tête
  abwheel: { name: "Ab wheel à genoux", unit: "reps", cue: [["posture", "Lombaires neutres, bassin en légère rétroversion"], ["progression", "Amplitude courte d'abord, allonger ensuite"], ["securite", "Stop si le dos creuse"]] }, // pas de champs de sélection : voir la note d'en-tête
  carry: { name: "Suitcase carry haltère", incr: 2, unit: "carry", side: true, cue: [["reglage", "Un haltère lourd d'un côté, puis de l'autre"], ["posture", "Buste vertical, marcher sans pencher"], ["cible", "Travail anti-flexion latérale"]] }, // pas de champs de sélection : voir la note d'en-tête

  // ---- exercices propres au catalogue de génération (#25 Q8) --------
  // Pas rattachés à un SLOT du programme par défaut, mais le générateur les
  // pose : consignes rédigées le 2026-09-26 (voir `cue` en en-tête).
  // Nouveaux slugs, même style que les 40 ci-dessus.
  dc_db: { name: "Développé couché haltères", incr: 2, perHand: true, cue: [["posture", "Omoplates serrées et abaissées, pieds ancrés"], ["trajet", "Haltères au niveau des pecs, coudes à ~45°"], ["tempo", "Descente 2–3 s, étirement confortable en bas"], ["intention", "Poussée forte, haltères qui se rapprochent en haut"]], muscles: { pectoraux: 0.6, triceps: 0.2, deltoide_ant: 0.2 }, pattern: "poussee_horizontale", type: "compose", equipement: ["halteres", "banc"], articulations: ["epaule"], stabilite: 2, niveau_min: 1, cout_systemique: 2, alias: "developpe-couche-halteres" },
  dc_mach: { name: "Développé couché machine convergente", incr: 5, cue: [["reglage", "Assise réglée : poignées au niveau du milieu des pecs"], ["posture", "Omoplates plaquées au dossier"], ["tempo", "Pousser fort, freiner 2–3 s"]], muscles: { pectoraux: 0.6, triceps: 0.2, deltoide_ant: 0.2 }, pattern: "poussee_horizontale", type: "compose", equipement: ["machine"], articulations: [], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "developpe-couche-machine-convergente" },
  dips: { name: "Dips buste penché", incr: 1.25, unit: "bw", cue: [["posture", "Buste penché en avant, coudes légèrement ouverts"], ["amplitude", "Descendre jusqu'à l'étirement des pecs, pas plus"], ["securite", "Épaules basses, jamais enroulées vers l'avant"], ["progression", "Lest dès 3 × 8 à ≤ 1 RIR"]], muscles: { pectoraux: 0.5, triceps: 0.3, deltoide_ant: 0.2 }, pattern: "poussee_horizontale", type: "compose", equipement: ["barres_paralleles"], articulations: ["epaule"], stabilite: 2, niveau_min: 2, cout_systemique: 2, alias: "dips-pectoraux" },
  pushup: { name: "Pompes", incr: 1.25, unit: "bw", cue: [["appuis", "Mains sous les épaules, un peu plus larges"], ["posture", "Corps gainé de la tête aux talons"], ["trajet", "Coudes à ~45°, poitrine jusqu'au sol"], ["progression", "Genoux au sol d'abord, pieds surélevés ou lest ensuite"]], muscles: { pectoraux: 0.6, triceps: 0.2, deltoide_ant: 0.2 }, pattern: "poussee_horizontale", type: "compose", equipement: ["poids_du_corps"], articulations: ["poignet"], stabilite: 2, niveau_min: 1, cout_systemique: 1, alias: "pompes" },
  ohp_bb: { name: "Développé militaire barre debout", incr: 2.5, cue: [["appuis", "Pieds largeur de hanches, fessiers et abdos serrés"], ["prise", "Prise juste plus large que les épaules, poignets droits"], ["trajet", "Barre au ras du visage, la tête passe dessous en haut"], ["securite", "Pas de cambrure pour finir la répétition"]], muscles: { deltoide_ant: 0.55, triceps: 0.25, deltoide_lat: 0.2 }, pattern: "poussee_verticale", type: "compose", equipement: ["barre", "rack"], articulations: ["epaule", "poignet", "lombaires"], stabilite: 1, niveau_min: 2, cout_systemique: 2, alias: "developpe-militaire-barre-debout" },
  row_bb: { name: "Rowing barre buste penché", incr: 2.5, cue: [["posture", "Buste penché à ~45°, dos neutre, genoux fléchis"], ["trajet", "Tirer la barre vers le nombril, coudes le long du corps"], ["tempo", "Descente contrôlée, sans élan du buste"], ["securite", "Au moindre signal lombaire : rowing buste appuyé"]], muscles: { dos: 0.65, biceps: 0.2, deltoide_post: 0.15 }, pattern: "tirage_horizontal", type: "compose", equipement: ["barre"], articulations: ["lombaires"], stabilite: 1, niveau_min: 2, cout_systemique: 2, alias: "rowing-barre" },
  row_db_uni: { name: "Rowing haltère un bras", incr: 2, perHand: true, cue: [["appuis", "Main et genou sur le banc, dos plat"], ["trajet", "Tirer l'haltère vers la hanche, coude près du corps"], ["amplitude", "Étirement complet en bas"], ["posture", "Buste immobile, sans rotation"]], muscles: { dos: 0.65, biceps: 0.2, deltoide_post: 0.15 }, pattern: "tirage_horizontal", type: "compose", equipement: ["halteres", "banc"], articulations: [], stabilite: 2, niveau_min: 1, cout_systemique: 1, alias: "rowing-halteres-un-bras" },
  row_inv: { name: "Rowing inversé sous barre", incr: 1.25, unit: "bw", cue: [["reglage", "Barre du rack à hauteur de hanches"], ["progression", "Plus le corps est horizontal, plus c'est dur"], ["posture", "Corps gainé et droit, talons au sol"], ["trajet", "Tirer la poitrine vers la barre, omoplates serrées"], ["tempo", "Descente contrôlée, bras tendus en bas"]], muscles: { dos: 0.65, biceps: 0.2, deltoide_post: 0.15 }, pattern: "tirage_horizontal", type: "compose", equipement: ["barre", "rack"], articulations: ["poignet"], stabilite: 2, niveau_min: 1, cout_systemique: 1, alias: "rowing-inverse-barre" },
  goblet_squat: { name: "Squat gobelet", incr: 2, cue: [["prise", "Haltère contre la poitrine, coudes sous l'haltère"], ["posture", "Buste droit et gainé"], ["appuis", "Genoux dans l'axe des pieds"], ["amplitude", "Profondeur confortable, talons au sol"]], muscles: { quadriceps: 0.6, ischios_fessiers: 0.3, abdominaux: 0.1 }, pattern: "dominante_genou", type: "compose", equipement: ["halteres"], articulations: ["genou", "hanche"], stabilite: 2, niveau_min: 1, cout_systemique: 2, alias: "squat-gobelet" },
  lunge_db: { name: "Fentes marchées haltères", incr: 2, cue: [["appuis", "Grand pas, genou avant dans l'axe du pied"], ["amplitude", "Genou arrière qui frôle le sol"], ["posture", "Buste droit, haltères le long du corps"], ["intention", "Pousser sur le talon avant pour avancer"]], muscles: { quadriceps: 0.5, ischios_fessiers: 0.45, mollets: 0.05 }, pattern: "dominante_genou", type: "compose", equipement: ["halteres"], articulations: ["genou"], stabilite: 2, niveau_min: 2, cout_systemique: 2, alias: "fentes-marchees-halteres" },
  bulg_split: { name: "Split squat bulgare haltères", incr: 2, cue: [["reglage", "Pied arrière sur le banc, pied avant assez loin"], ["appuis", "Genou avant dans l'axe du pied"], ["amplitude", "Descendre jusqu'à l'étirement de la hanche arrière"], ["posture", "Buste légèrement penché, gainé"]], muscles: { quadriceps: 0.55, ischios_fessiers: 0.4, mollets: 0.05 }, pattern: "dominante_genou", type: "compose", equipement: ["halteres", "banc"], articulations: ["genou", "hanche"], stabilite: 2, niveau_min: 2, cout_systemique: 2, alias: "split-squat-bulgare-halteres" },
  leg_ext: { name: "Leg extension", incr: 5, cue: [["reglage", "Axe de la machine aligné sur le genou"], ["posture", "Bassin plaqué, poignées tenues"], ["tempo", "Contraction 1 s en haut, retour 2–3 s"]], muscles: { quadriceps: 1.0 }, pattern: "iso_quadriceps", type: "isolation", equipement: ["machine"], articulations: ["genou"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "leg-extension" },
  dl_conv: { name: "Soulevé de terre conventionnel", incr: 5, cue: [["appuis", "Barre au-dessus du milieu du pied"], ["posture", "Dos neutre, bracing avant chaque répétition"], ["trajet", "Barre collée aux jambes, pousser le sol"], ["securite", "Au moindre arrondi du dos, la série s'arrête"]], muscles: { ischios_fessiers: 0.55, dos: 0.3, quadriceps: 0.15 }, pattern: "charniere_hanche", type: "compose", equipement: ["barre"], articulations: ["lombaires", "hanche"], stabilite: 1, niveau_min: 3, cout_systemique: 3, alias: "souleve-de-terre-conventionnel" },
  rdl_bb: { name: "Soulevé de terre roumain barre", incr: 5, cue: [["appuis", "Genoux légèrement fléchis, fixes"], ["trajet", "Hanches vers l'arrière, barre collée aux cuisses"], ["amplitude", "Descendre jusqu'à l'étirement des ischios"], ["securite", "Dos neutre : l'amplitude s'arrête avant qu'il s'arrondisse"]], muscles: { ischios_fessiers: 0.7, dos: 0.3 }, pattern: "charniere_hanche", type: "compose", equipement: ["barre"], articulations: ["lombaires", "hanche"], stabilite: 1, niveau_min: 2, cout_systemique: 3, alias: "souleve-de-terre-roumain-barre" },
  rdl_db: { name: "Soulevé de terre roumain haltères", incr: 2, cue: [["appuis", "Genoux légèrement fléchis, fixes"], ["trajet", "Hanches vers l'arrière, haltères le long des cuisses"], ["amplitude", "Descendre jusqu'à l'étirement des ischios"], ["securite", "Dos neutre : l'amplitude s'arrête avant qu'il s'arrondisse"]], muscles: { ischios_fessiers: 0.7, dos: 0.3 }, pattern: "charniere_hanche", type: "compose", equipement: ["halteres"], articulations: ["lombaires", "hanche"], stabilite: 2, niveau_min: 1, cout_systemique: 2, alias: "souleve-de-terre-roumain-halteres" },
  back_ext: { name: "Extension lombaire au banc", incr: 1.25, cue: [["reglage", "Coussin sous les hanches, pas sous le ventre"], ["trajet", "Descendre en enroulant, remonter par les fessiers"], ["securite", "S'arrêter à l'alignement, pas d'hyperextension"], ["progression", "Disque contre la poitrine quand ça devient facile"]], muscles: { ischios_fessiers: 0.6, dos: 0.4 }, pattern: "charniere_hanche", type: "isolation", equipement: ["banc_lombaire"], articulations: ["lombaires"], stabilite: 2, niveau_min: 1, cout_systemique: 1, alias: "extension-lombaire-banc" },
  cable_pullthrough: { name: "Tirage entre les jambes à la poulie", incr: 2.5, cue: [["reglage", "Dos à la poulie basse, corde entre les jambes"], ["trajet", "Hanches vers l'arrière, genoux souples"], ["intention", "Remonter en serrant les fessiers"], ["securite", "Dos neutre, pas d'hyperextension en haut"]], muscles: { ischios_fessiers: 0.85, dos: 0.15 }, pattern: "extension_hanche", type: "isolation", equipement: ["poulie"], articulations: ["hanche"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "tirage-entre-jambes-poulie" },
  lat_mach: { name: "Élévations latérales machine", incr: 5, cue: [["reglage", "Épaule alignée sur l'axe de la machine"], ["posture", "Épaules basses, sans les hausser"], ["tempo", "Montée jusqu'à l'horizontale, descente 2–3 s"]], muscles: { deltoide_lat: 1.0 }, pattern: "iso_deltoide_lateral", type: "isolation", equipement: ["machine"], articulations: ["epaule"], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "elevations-laterales-machine" },
  reardelt_db: { name: "Oiseau haltères au banc incliné", incr: 2, perHand: true, cue: [["reglage", "Poitrine contre un banc incliné"], ["trajet", "Bras presque tendus, ouvrir vers l'extérieur"], ["posture", "Sans hausser les épaules"], ["tempo", "Contraction 1 s, retour contrôlé"]], muscles: { deltoide_post: 0.85, dos: 0.15 }, pattern: "iso_deltoide_posterieur", type: "isolation", equipement: ["halteres", "banc_incline"], articulations: [], stabilite: 2, niveau_min: 1, cout_systemique: 1, alias: "oiseau-halteres-banc-incline" },
  facepull: { name: "Face pull à la poulie", incr: 2.5, cue: [["reglage", "Poulie à hauteur du visage, corde"], ["trajet", "Tirer vers le front, coudes hauts, mains qui s'écartent"], ["posture", "Buste stable, pas d'élan"], ["tempo", "Contraction 1 s, retour contrôlé"]], muscles: { deltoide_post: 0.7, dos: 0.3 }, pattern: "iso_deltoide_posterieur", type: "isolation", equipement: ["poulie"], articulations: [], stabilite: 3, niveau_min: 1, cout_systemique: 1, alias: "face-pull-poulie" },
  curl_ez: { name: "Curl barre EZ", incr: 2.5, cue: [["prise", "Mains sur les parties inclinées de la barre"], ["posture", "Coudes fixes le long du corps, pas d'élan du buste"], ["tempo", "Descente 2–3 s, extension complète"]], muscles: { biceps: 1.0 }, pattern: "iso_biceps", type: "isolation", equipement: ["barre_ez"], articulations: ["coude", "poignet"], stabilite: 2, niveau_min: 1, cout_systemique: 1, alias: "curl-barre-ez" },
  skull_ez: { name: "Barre au front (barre EZ)", incr: 2.5, cue: [["reglage", "Allongé sur le banc, bras légèrement inclinés vers l'arrière"], ["trajet", "Descente vers le front ou juste derrière"], ["posture", "Coudes fixes, sans les ouvrir"], ["tempo", "Descente 2–3 s, extension complète"]], muscles: { triceps: 1.0 }, pattern: "iso_triceps", type: "isolation", equipement: ["barre_ez", "banc"], articulations: ["coude"], stabilite: 2, niveau_min: 2, cout_systemique: 1, alias: "barre-au-front-barre-ez" },
  plank_weighted: { name: "Gainage planche lesté", incr: 1.25, unit: "bw", cue: [["appuis", "Avant-bras au sol, coudes sous les épaules"], ["posture", "Corps aligné, fessiers et abdos serrés"], ["progression", "Disque sur le dos quand la tenue devient facile"], ["securite", "Arrêter dès que le bassin s'affaisse"]], muscles: { abdominaux: 1.0 }, pattern: "abdominaux", type: "isolation", equipement: ["poids_du_corps"], articulations: [], stabilite: 2, niveau_min: 1, cout_systemique: 1, alias: "gainage-planche-leste" },

  // ---- poids du corps (#59) ----------------------------------------
  // Le registre a été écrit pour une salle (#25), et ça se voyait : avec le
  // seul matériel du corps, il offrait cinq entrées et huit des onze muscles
  // n'avaient aucun exercice primaire, tout le bas du corps compris.
  //
  // Les répartitions `muscles` ne sont pas réestimées : chaque entrée reprend
  // celles de son équivalent chargé (squat_bw = squat, lunge_bw = lunge_db,
  // rdl_uni_bw = rdl_db, pike_pushup = ohp_db, rear_delt_row = facepull), au
  // motif que c'est le même schéma moteur sous une charge différente. Ce qui
  // change au poids du corps, c'est `stabilite` (2 partout : ni barre libre
  // lourde, ni machine) et `cout_systemique`, jamais 3 : rien ici ne charge
  // la colonne comme un squat barre.
  //
  // `barre_traction` vaut ici pour une barre dont la hauteur se règle : les
  // quatre entrées qui la portent en position basse (row_inv_bar, curl_bw,
  // rear_delt_row, tri_ext_bw) le supposent — et c'est aussi ce qui les rend
  // accessibles à un débutant : sous une barre, la difficulté se règle par
  // l'angle du corps, pas par une charge à soulever, ce qui leur vaut le même
  // niveau_min 1 que row_inv. Le vocabulaire EQUIPMENT est fermé et aligné
  // sur le catalogue de génération ; lui ajouter « barre basse » le ferait
  // diverger pour une nuance de montage.
  //
  // Ce que ces entrées ne réparent pas : le deltoïde latéral reste sans
  // exercice primaire au poids du corps. Il se compte en direct seul (voir
  // VOLUME), et aucun mouvement sans charge externe ne lui donne 0,5 de part.
  // C'est une contrainte physique, pas un trou du registre, et le rapport du
  // générateur le déclare (#59 decisions.md).
  squat_bw: { name: "Squat au poids du corps", incr: 1.25, unit: "bw", cue: [["appuis", "Pieds largeur d'épaules, genoux dans l'axe des pieds"], ["amplitude", "Aussi bas que confortable, talons au sol"], ["posture", "Buste gainé, regard devant"], ["progression", "Tempo lent, puis gilet lesté, quand ça devient facile"]], muscles: { quadriceps: 0.6, ischios_fessiers: 0.3, abdominaux: 0.1 }, pattern: "dominante_genou", type: "compose", equipement: ["poids_du_corps"], articulations: ["genou", "hanche"], stabilite: 2, niveau_min: 1, cout_systemique: 1 },
  split_squat_bw: { name: "Split squat, pied arrière au sol", incr: 1.25, unit: "bw", cue: [["appuis", "Pieds décalés, pied arrière sur la pointe"], ["amplitude", "Genou arrière qui frôle le sol"], ["posture", "Buste droit, genou avant dans l'axe du pied"], ["progression", "Pied arrière surélevé quand ça devient facile"]], muscles: { quadriceps: 0.55, ischios_fessiers: 0.4, mollets: 0.05 }, pattern: "dominante_genou", type: "compose", equipement: ["poids_du_corps"], articulations: ["genou", "hanche"], stabilite: 2, niveau_min: 1, cout_systemique: 1 },
  lunge_bw: { name: "Fentes marchées au poids du corps", incr: 1.25, unit: "bw", cue: [["appuis", "Grand pas, genou avant dans l'axe du pied"], ["amplitude", "Genou arrière qui frôle le sol"], ["posture", "Buste droit et gainé"], ["intention", "Pousser sur le talon avant pour avancer"]], muscles: { quadriceps: 0.5, ischios_fessiers: 0.45, mollets: 0.05 }, pattern: "dominante_genou", type: "compose", equipement: ["poids_du_corps"], articulations: ["genou"], stabilite: 2, niveau_min: 1, cout_systemique: 1 },
  glute_bridge: { name: "Pont fessier au sol, une jambe", incr: 1.25, unit: "bw", cue: [["appuis", "Dos au sol, un pied à plat près des fessiers, l'autre jambe levée"], ["intention", "Monter en poussant sur le talon, fessiers serrés en haut"], ["tempo", "Tenue 1 s en haut, descente contrôlée"], ["securite", "Côtes basses : l'extension vient de la hanche, pas du dos"]], muscles: { ischios_fessiers: 1.0 }, pattern: "extension_hanche", type: "isolation", equipement: ["poids_du_corps"], articulations: ["hanche"], stabilite: 2, niveau_min: 1, cout_systemique: 1 },
  rdl_uni_bw: { name: "Soulevé de terre roumain unilatéral au poids du corps", incr: 1.25, unit: "bw", cue: [["appuis", "Genou d'appui légèrement fléchi"], ["trajet", "Hanche vers l'arrière, jambe libre alignée avec le buste"], ["posture", "Bassin face au sol, sans rotation"], ["amplitude", "Descendre jusqu'à l'étirement de l'ischio, dos neutre"]], muscles: { ischios_fessiers: 0.7, dos: 0.3 }, pattern: "charniere_hanche", type: "compose", equipement: ["poids_du_corps"], articulations: ["lombaires", "hanche"], stabilite: 2, niveau_min: 2, cout_systemique: 1 },
  nordic_curl: { name: "Leg curl nordique", incr: 1.25, unit: "bw", cue: [["reglage", "Chevilles bloquées sous un appui solide, genoux sur un coussin"], ["posture", "Corps aligné des genoux aux épaules"], ["tempo", "Descente la plus lente possible, freiner jusqu'au bout"], ["progression", "Réception sur les mains, remonter en s'aidant"]], muscles: { ischios_fessiers: 1.0 }, pattern: "iso_ischios", type: "isolation", equipement: ["poids_du_corps"], articulations: ["genou"], stabilite: 2, niveau_min: 3, cout_systemique: 2 },
  calf_step: { name: "Mollets debout sur une marche", incr: 1.25, unit: "bw", cue: [["appuis", "Avant du pied sur la marche, une main en appui"], ["amplitude", "Talon sous la marche en bas, sur la pointe en haut"], ["tempo", "Pause 1 s en bas, pas de rebond"], ["progression", "Une jambe, puis lest, quand ça devient facile"]], muscles: { mollets: 1.0 }, pattern: "mollets", type: "isolation", equipement: ["poids_du_corps"], articulations: [], stabilite: 2, niveau_min: 1, cout_systemique: 1 },
  pike_pushup: { name: "Pompes piquées", incr: 1.25, unit: "bw", cue: [["posture", "Hanches hautes, corps en V inversé"], ["trajet", "La tête descend devant les mains, coudes vers l'arrière"], ["amplitude", "Front qui frôle le sol"], ["progression", "Pieds surélevés quand ça devient facile"]], muscles: { deltoide_ant: 0.55, triceps: 0.25, deltoide_lat: 0.2 }, pattern: "poussee_verticale", type: "compose", equipement: ["poids_du_corps"], articulations: ["epaule", "poignet"], stabilite: 2, niveau_min: 2, cout_systemique: 1 },
  chinup: { name: "Tractions supination", incr: 2.5, unit: "bw", cue: [["prise", "Prise en supination, largeur d'épaules"], ["trajet", "Coudes vers les côtes, menton au-dessus de la barre"], ["tempo", "Descente 2–3 s, bras tendus en bas"], ["progression", "Lest dès 3 × 8 à ≤ 1 RIR"]], muscles: { dos: 0.6, biceps: 0.3, deltoide_post: 0.1 }, pattern: "tirage_vertical", type: "compose", equipement: ["barre_traction"], articulations: ["epaule", "coude"], stabilite: 2, niveau_min: 2, cout_systemique: 2 },
  row_inv_bar: { name: "Rowing inversé sous barre basse", incr: 1.25, unit: "bw", cue: [["reglage", "Barre à hauteur de hanches"], ["progression", "Plus le corps est horizontal, plus c'est dur"], ["posture", "Corps gainé et droit, talons au sol"], ["trajet", "Tirer la poitrine vers la barre, omoplates serrées"], ["tempo", "Descente contrôlée, bras tendus en bas"]], muscles: { dos: 0.65, biceps: 0.2, deltoide_post: 0.15 }, pattern: "tirage_horizontal", type: "compose", equipement: ["barre_traction"], articulations: ["poignet"], stabilite: 2, niveau_min: 1, cout_systemique: 1 },
  rear_delt_row: { name: "Rowing inversé prise large, coudes hauts", incr: 1.25, unit: "bw", cue: [["prise", "Prise large en pronation"], ["trajet", "Coudes hauts et écartés, vers le haut de la poitrine"], ["posture", "Corps gainé et droit"], ["tempo", "Contraction 1 s, descente contrôlée"]], muscles: { deltoide_post: 0.7, dos: 0.3 }, pattern: "iso_deltoide_posterieur", type: "isolation", equipement: ["barre_traction"], articulations: [], stabilite: 2, niveau_min: 1, cout_systemique: 1 },
  curl_bw: { name: "Curl sous barre basse", incr: 1.25, unit: "bw", cue: [["prise", "Prise en supination, largeur d'épaules"], ["posture", "Corps gainé, coudes fixes"], ["trajet", "Amener le front vers la barre en pliant les coudes"], ["progression", "Plus les pieds avancent sous la barre, plus c'est dur"]], muscles: { biceps: 1.0 }, pattern: "iso_biceps", type: "isolation", equipement: ["barre_traction"], articulations: ["coude"], stabilite: 2, niveau_min: 1, cout_systemique: 1 },
  tri_ext_bw: { name: "Extension triceps sous barre basse", incr: 1.25, unit: "bw", cue: [["reglage", "Barre à hauteur de taille, pieds reculés"], ["posture", "Corps gainé et droit"], ["trajet", "Le front descend sous la barre, coudes fixes"], ["intention", "Pousser jusqu'à l'extension complète"]], muscles: { triceps: 1.0 }, pattern: "iso_triceps", type: "isolation", equipement: ["barre_traction"], articulations: ["coude", "epaule"], stabilite: 2, niveau_min: 1, cout_systemique: 1 },
};

export const EXERCISE_IDS = new Set(Object.keys(EXERCISES));

/* Entrées volontairement sans champs de sélection (voir la note
   d'en-tête) — exposé pour que test/registry.test.js sache les exclure
   des vérifications d'intégrité sans deviner pourquoi à chaque fois. */
export const UNSELECTABLE_IDS = new Set(["pallof", "sideplank", "abwheel", "carry"]);
