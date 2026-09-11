/* =========================================================
   Registre d'exercices fermé — #25

   EXERCISES[id] est l'unique source des exercices que le moteur sait
   exécuter. Extrait de BASE_V (src/program.js) sans changement de forme
   ni de contenu (#2 pour l'origine de ces données). L'enrichissement avec
   les champs de sélection (muscles, pattern, équipement...) arrive dans un
   commit séparé (#25, étape suivante) — un concern par commit.

   ---------------------------------------------------------
   EXERCISES[id] — catalogue d'exercices, clé = slug court (#25 Q7 :
   les ids restent les slugs existants, jamais renommés — le journal
   stocké est indexé par id de variante, log.ex[vid], renommer serait
   une migration).
     name     libellé affiché
     incr     pas de charge pour la progression, en kg. Absent => pas de
              charge suivie (sideplank « time », abwheel « reps »).
     start    jamais porté ici : injecté à l'exécution par buildProgram()
              depuis definition.startingLoads (src/program.js).
     perHand  charge par main (haltères) ; l'affichage ajoute « / main ».
     unit     "kg" (implicite, barre/machine/poulie)
              | "bw"    poids du corps, lest éventuel en kg
              | "time"  tenue en secondes, pas de charge
              | "reps"  répétitions au poids du corps, pas de charge
              | "carry" port lesté chronométré (kg + secondes)
     side     exécuté par côté ; l'affichage ajoute « par côté ».
     cue      consigne technique.

   EXERCISE_IDS   Set des clés de EXERCISES, pour une validation O(1)
                  (src/import.js).
   REGISTRY_VERSION   entier, non encore appliqué (réservé, #25 OQ1).
   ========================================================= */

export const REGISTRY_VERSION = 1;

export const EXERCISES = {
  dc: { name: "Développé couché barre", incr: 2.5, cue: "Omoplates serrées et abaissées, pieds ancrés, cambrure naturelle. Barre sur le bas des pecs, descente 2–3 s, poussée explosive, pas de rebond." },
  incl_db: { name: "Développé incliné haltères (banc 30°)", incr: 2, perHand: true, cue: "Haltères au niveau des pecs, coudes à ~45°, amplitude confortable pour l'épaule. Montée forte, descente contrôlée." },
  incl_mach: { name: "Presse inclinée machine ou Smith", incr: 5, cue: "Poignées au niveau du haut des pecs, omoplates plaquées. Pousser fort, freiner 2–3 s." },
  lat_db: { name: "Élévations latérales haltères, appuyé sur banc incliné", incr: 2, perHand: true, cue: "Buste contre un banc relevé pour supprimer l'élan. Trajet en diagonale (entre côté et devant), mains et coudes alignés, pas de haussement d'épaules. Descente 2–3 s. À traiter comme un exercice lourd : proche de l'échec." },
  lat_cable: { name: "Élévations latérales à la poulie (hauteur taille)", incr: 2.5, cue: "Poulie à hauteur de taille, bras tendu-souple, corps légèrement penché : tension maximale en bas de course. Même rigueur qu'aux haltères." },
  rpd: { name: "Reverse pec deck", incr: 5, cue: "Poitrine contre le dossier, bras presque tendus, ouvrir vers l'arrière sans hausser les épaules. Contraction 1 s, retour contrôlé." },
  rev_cable: { name: "Écarté inversé à la poulie", incr: 2.5, cue: "Poulies hautes croisées, bras presque tendus, tirer vers l'arrière et l'extérieur. Buste stable." },
  tri_oh: { name: "Extension triceps au-dessus de la tête, unilatérale à la poulie", incr: 2.5, cue: "Dos à la poulie basse, un bras, coude pointé au plafond. Étirement complet en bas, extension complète. 8–12 reps pour ménager le coude." },
  skull: { name: "Skull crusher haltères (descente derrière la tête)", incr: 2, perHand: true, cue: "Descente derrière la tête (moins de stress pour les coudes), coudes fixes. Banc légèrement incliné pour plus d'étirement si confortable." },
  squat: { name: "Squat barre", incr: 5, cue: "Bracing avant chaque descente, ceinture optionnelle. Profondeur confortable, genoux dans l'axe des pieds. Au moindre signal lombaire : hack squat ou presse." },
  lc_seat: { name: "Leg curl assis", incr: 5, cue: "Cuisses bloquées sous le coussin, buste légèrement penché en avant (ischios étirés). Contraction complète, retour 2–3 s." },
  lc_lying: { name: "Leg curl allongé", incr: 5, cue: "Hanches plaquées sur le banc, aucune cambrure pour tricher. Contraction complète, retour 2–3 s." },
  calf_stand: { name: "Mollets debout (machine ou Smith)", incr: 5, cue: "Genoux tendus, descente complète avec pause 1 s en bas, pas de rebond, montée sur la pointe." },
  calf_press: { name: "Mollets à la presse", incr: 10, cue: "Pieds en bas de la plateforme, genoux tendus, pause 1 s en bas, extension complète." },
  pullup: { name: "Tractions prise large", incr: 2.5, unit: "bw", cue: "Prise large en pronation, coudes vers les côtes, menton au-dessus de la barre. Descente 2–3 s. Sangles autorisées. Lest dès 3 × 8 à ≤ 1 RIR." },
  pd_wide: { name: "Tirage vertical prise large", incr: 5, cue: "Genoux bloqués, léger recul du buste, tirer vers le haut des pecs coudes vers l'extérieur. Partielles contrôlées en fin de série OK." },
  row_supp: { name: "Rowing buste appuyé prise large (T-bar ou machine)", incr: 5, cue: "Poitrine contre le support, prise large, coudes écartés, serrer les omoplates. Zéro charge lombaire. Sangles si la prise limite." },
  row_cable: { name: "Rowing assis à la poulie, prise large", incr: 5, cue: "Buste vertical et stable, coudes écartés, tirer vers le bas des pecs en rétractant les omoplates." },
  curl_cable: { name: "Curl à la poulie, dos à la machine", incr: 2.5, cue: "Dos à la poulie basse, bras légèrement en arrière : charge maximale en bas de course. Coude fixe, contraction complète." },
  curl_db: { name: "Curl haltères assis", incr: 2, perHand: true, cue: "Assis, prise supination, coudes fixes, les deux bras ensemble (pas d'alterné). Descente 2–3 s." },
  ohp_db: { name: "Développé épaules assis haltères (dossier 60–70°)", incr: 2, perHand: true, cue: "Dossier à 60–70°, haltères poussés ensemble, coudes légèrement vers l'avant, poignets au-dessus des coudes. Descendre jusqu'à la hauteur confortable, pas plus." },
  ohp_mach: { name: "Développé épaules machine", incr: 5, cue: "Assise réglée pour partir à hauteur d'épaules. Pousser fort, freiner 2–3 s." },
  curl_preacher: { name: "Curl pupitre barre EZ", incr: 2.5, cue: "Bras plaqués, coudes enfoncés dans le coussin, descente complète contrôlée, pas d'extension brutale en bas." },
  curl_cable_seat: { name: "Curl à la poulie dos à la machine, assis", incr: 2.5, cue: "Assis dos à la poulie pour ne plus être tiré par la pile. Même exécution que debout." },
  pushdown: { name: "Pushdown à la poulie (barre ou corde)", incr: 5, cue: "Coudes près du corps, buste légèrement penché, extension complète. Ceinture ou unilatéral si la pile te soulève." },
  pushdown_uni: { name: "Pushdown unilatéral cross-body", incr: 2.5, cue: "Un bras, poulie haute du côté opposé, extension vers la hanche opposée. Stable et confortable pour le coude." },
  pecdeck: { name: "Pec deck", incr: 5, cue: "Coudes légèrement fléchis, ouverture jusqu'à l'étirement confortable, fermeture complète 1 s." },
  fly_cable: { name: "Écarté à la poulie", incr: 2.5, cue: "Poulies à hauteur d'épaules, léger pas en avant, bras arrondis, contraction 1 s, retour contrôlé." },
  hipthrust: { name: "Hip thrust barre", incr: 5, cue: "Épaules sur le banc, côtes basses, menton rentré, tibias verticaux en haut. Verrouillage des fessiers sans hyperextension lombaire. Paliers depuis 60 kg en S1." },
  legpress: { name: "Presse à cuisses", incr: 10, cue: "Pieds à mi-hauteur, largeur épaules. Descendre jusqu'au point où le bassin commence à décoller, pas plus." },
  hack: { name: "Hack squat", incr: 5, cue: "Dos plaqué, pieds légèrement avancés, descente profonde confortable, pas de verrouillage brutal." },
  pd_close: { name: "Tirage vertical prise serrée neutre", incr: 5, cue: "Poignée neutre serrée, coudes le long du corps, tirer vers le sternum avec un léger recul. Partielles OK en fin de série." },
  row_uni: { name: "Rowing unilatéral à la poulie, coudes serrés", incr: 2.5, cue: "Un bras, poignée neutre, coude qui frotte les côtes, buste stable, étirement complet devant." },
  calf_seat: { name: "Mollets assis", incr: 5, cue: "Pause 1 s en bas, montée complète, pas de rebond. Cible le soléaire." },
  crunch: { name: "Crunch à la poulie haute, à genoux", incr: 5, cue: "Corde à la poulie haute, enrouler le buste en ramenant les côtes vers le bassin. Les hanches ne bougent pas, lombaires neutres." },
  pallof: { name: "Pallof press à la poulie", incr: 2.5, side: true, cue: "Poulie à hauteur de poitrine, de profil. Tendre les bras devant soi sans laisser le buste tourner, tenir 2 s, revenir. Par côté." },
  hlr: { name: "Relevé de jambes suspendu", incr: 2, unit: "bw", cue: "Bassin en rétroversion, monter les jambes en enroulant le bassin. Genoux fléchis d'abord, jambes tendues ensuite, puis haltère entre les pieds." },
  sideplank: { name: "Planche latérale (McGill)", unit: "time", side: true, cue: "Coude sous l'épaule, corps aligné, hanches hautes. Genoux au sol si besoin. Par côté, jamais jusqu'à la perte d'alignement." },
  abwheel: { name: "Ab wheel à genoux", unit: "reps", cue: "Lombaires neutres et bassin en légère rétroversion pendant tout le mouvement. Amplitude courte d'abord, allonger ensuite. Stop si le dos creuse." },
  carry: { name: "Suitcase carry haltère", incr: 2, unit: "carry", side: true, cue: "Un haltère lourd d'un côté, buste vertical, marcher sans pencher. Anti-flexion latérale. Par côté." },
};

export const EXERCISE_IDS = new Set(Object.keys(EXERCISES));
