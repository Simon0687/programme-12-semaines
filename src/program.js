/* =========================================================
   Données du programme 12 semaines — Simon

   Le catalogue d'exercices (V), les créneaux bloc 1 / bloc 2 (SLOTS),
   la structure des séances (SESSIONS) et les blocs d'abdos (CORE).
   Extrait de App.jsx sans changement de forme (#2), pour que la logique
   de progression soit testable hors navigateur. Le reste de la
   séparation données / vue est le travail de #3.
   ========================================================= */

/* ---------- Variantes (exercices) ---------- */
export const V = {
  dc: { name: "Développé couché barre", incr: 2.5, start: 72.5, cue: "Omoplates serrées et abaissées, pieds ancrés, cambrure naturelle. Barre sur le bas des pecs, descente 2–3 s, poussée explosive, pas de rebond." },
  incl_db: { name: "Développé incliné haltères (banc 30°)", incr: 2, start: 30, perHand: true, cue: "Haltères au niveau des pecs, coudes à ~45°, amplitude confortable pour l'épaule. Montée forte, descente contrôlée." },
  incl_mach: { name: "Presse inclinée machine ou Smith", incr: 5, cue: "Poignées au niveau du haut des pecs, omoplates plaquées. Pousser fort, freiner 2–3 s." },
  lat_db: { name: "Élévations latérales haltères, appuyé sur banc incliné", incr: 2, perHand: true, cue: "Buste contre un banc relevé pour supprimer l'élan. Trajet en diagonale (entre côté et devant), mains et coudes alignés, pas de haussement d'épaules. Descente 2–3 s. À traiter comme un exercice lourd : proche de l'échec." },
  lat_cable: { name: "Élévations latérales à la poulie (hauteur taille)", incr: 2.5, cue: "Poulie à hauteur de taille, bras tendu-souple, corps légèrement penché : tension maximale en bas de course. Même rigueur qu'aux haltères." },
  rpd: { name: "Reverse pec deck", incr: 5, cue: "Poitrine contre le dossier, bras presque tendus, ouvrir vers l'arrière sans hausser les épaules. Contraction 1 s, retour contrôlé." },
  rev_cable: { name: "Écarté inversé à la poulie", incr: 2.5, cue: "Poulies hautes croisées, bras presque tendus, tirer vers l'arrière et l'extérieur. Buste stable." },
  tri_oh: { name: "Extension triceps au-dessus de la tête, unilatérale à la poulie", incr: 2.5, cue: "Dos à la poulie basse, un bras, coude pointé au plafond. Étirement complet en bas, extension complète. 8–12 reps pour ménager le coude." },
  skull: { name: "Skull crusher haltères (descente derrière la tête)", incr: 2, perHand: true, cue: "Descente derrière la tête (moins de stress pour les coudes), coudes fixes. Banc légèrement incliné pour plus d'étirement si confortable." },
  squat: { name: "Squat barre", incr: 5, start: 105, cue: "Bracing avant chaque descente, ceinture optionnelle. Profondeur confortable, genoux dans l'axe des pieds. Au moindre signal lombaire : hack squat ou presse." },
  lc_seat: { name: "Leg curl assis", incr: 5, cue: "Cuisses bloquées sous le coussin, buste légèrement penché en avant (ischios étirés). Contraction complète, retour 2–3 s." },
  lc_lying: { name: "Leg curl allongé", incr: 5, cue: "Hanches plaquées sur le banc, aucune cambrure pour tricher. Contraction complète, retour 2–3 s." },
  calf_stand: { name: "Mollets debout (machine ou Smith)", incr: 5, cue: "Genoux tendus, descente complète avec pause 1 s en bas, pas de rebond, montée sur la pointe." },
  calf_press: { name: "Mollets à la presse", incr: 10, cue: "Pieds en bas de la plateforme, genoux tendus, pause 1 s en bas, extension complète." },
  pullup: { name: "Tractions prise large", incr: 2.5, start: 0, unit: "bw", cue: "Prise large en pronation, coudes vers les côtes, menton au-dessus de la barre. Descente 2–3 s. Sangles autorisées. Lest dès 3 × 8 à ≤ 1 RIR." },
  pd_wide: { name: "Tirage vertical prise large", incr: 5, cue: "Genoux bloqués, léger recul du buste, tirer vers le haut des pecs coudes vers l'extérieur. Partielles contrôlées en fin de série OK." },
  row_supp: { name: "Rowing buste appuyé prise large (T-bar ou machine)", incr: 5, cue: "Poitrine contre le support, prise large, coudes écartés, serrer les omoplates. Zéro charge lombaire. Sangles si la prise limite." },
  row_cable: { name: "Rowing assis à la poulie, prise large", incr: 5, cue: "Buste vertical et stable, coudes écartés, tirer vers le bas des pecs en rétractant les omoplates." },
  curl_cable: { name: "Curl à la poulie, dos à la machine", incr: 2.5, cue: "Dos à la poulie basse, bras légèrement en arrière : charge maximale en bas de course. Coude fixe, contraction complète." },
  curl_db: { name: "Curl haltères assis", incr: 2, perHand: true, cue: "Assis, prise supination, coudes fixes, les deux bras ensemble (pas d'alterné). Descente 2–3 s." },
  ohp_db: { name: "Développé épaules assis haltères (dossier 60–70°)", incr: 2, start: 26, perHand: true, cue: "Dossier à 60–70°, haltères poussés ensemble, coudes légèrement vers l'avant, poignets au-dessus des coudes. Descendre jusqu'à la hauteur confortable, pas plus." },
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
  pd_close: { name: "Tirage vertical prise serrée neutre", incr: 5, start: 90, cue: "Poignée neutre serrée, coudes le long du corps, tirer vers le sternum avec un léger recul. Partielles OK en fin de série." },
  row_uni: { name: "Rowing unilatéral à la poulie, coudes serrés", incr: 2.5, cue: "Un bras, poignée neutre, coude qui frotte les côtes, buste stable, étirement complet devant." },
  calf_seat: { name: "Mollets assis", incr: 5, cue: "Pause 1 s en bas, montée complète, pas de rebond. Cible le soléaire." },
  crunch: { name: "Crunch à la poulie haute, à genoux", incr: 5, cue: "Corde à la poulie haute, enrouler le buste en ramenant les côtes vers le bassin. Les hanches ne bougent pas, lombaires neutres." },
  pallof: { name: "Pallof press à la poulie", incr: 2.5, side: true, cue: "Poulie à hauteur de poitrine, de profil. Tendre les bras devant soi sans laisser le buste tourner, tenir 2 s, revenir. Par côté." },
  hlr: { name: "Relevé de jambes suspendu", incr: 2, unit: "bw", cue: "Bassin en rétroversion, monter les jambes en enroulant le bassin. Genoux fléchis d'abord, jambes tendues ensuite, puis haltère entre les pieds." },
  sideplank: { name: "Planche latérale (McGill)", unit: "time", side: true, cue: "Coude sous l'épaule, corps aligné, hanches hautes. Genoux au sol si besoin. Par côté, jamais jusqu'à la perte d'alignement." },
  abwheel: { name: "Ab wheel à genoux", unit: "reps", cue: "Lombaires neutres et bassin en légère rétroversion pendant tout le mouvement. Amplitude courte d'abord, allonger ensuite. Stop si le dos creuse." },
  carry: { name: "Suitcase carry haltère", incr: 2, unit: "carry", side: true, cue: "Un haltère lourd d'un côté, buste vertical, marcher sans pencher. Anti-flexion latérale. Par côté." },
};

/* ---------- Créneaux : variante bloc 1 / bloc 2 ---------- */
export const SLOTS = {
  dc: { reps: [4, 8], rest: 150, key: true, b1: "dc", b2: "dc" },
  incline: { reps: [6, 10], rest: 120, b1: "incl_db", b2: "incl_mach" },
  latraise: { reps: [8, 12], rest: 90, fail: true, key: true, b1: "lat_db", b2: "lat_cable" },
  reardelt: { reps: [10, 12], rest: 90, fail: true, b1: "rpd", b2: "rev_cable" },
  tristretch: { reps: [8, 12], rest: 90, b1: "tri_oh", b2: "skull" },
  squat: { reps: [4, 8], rest: 180, key: true, b1: "squat", b2: "squat" },
  legcurl: { reps: [8, 12], rest: 90, fail: true, b1: "lc_seat", b2: "lc_lying" },
  calfstand: { reps: [8, 12], rest: 90, fail: true, b1: "calf_stand", b2: "calf_press" },
  pull: { reps: [4, 8], rest: 150, key: true, b1: "pullup", b2: "pd_wide" },
  row: { reps: [6, 10], rest: 120, b1: "row_supp", b2: "row_cable" },
  curl2: { reps: [6, 10], rest: 90, b1: "curl_cable", b2: "curl_db" },
  ohp: { reps: [6, 10], rest: 150, key: true, b1: "ohp_db", b2: "ohp_mach" },
  curl1: { reps: [6, 10], rest: 90, fail: true, b1: "curl_preacher", b2: "curl_cable_seat" },
  pushdown: { reps: [8, 12], rest: 90, fail: true, b1: "pushdown", b2: "pushdown_uni" },
  fly: { reps: [8, 12], rest: 90, fail: true, b1: "pecdeck", b2: "fly_cable" },
  hipthrust: { reps: [6, 10], rest: 150, key: true, b1: "hipthrust", b2: "hipthrust" },
  quad2: { reps: [8, 12], rest: 120, fail: true, b1: "legpress", b2: "hack" },
  pullsag: { reps: [6, 10], rest: 120, b1: "pd_close", b2: "row_uni" },
  calfseat: { reps: [10, 12], rest: 90, fail: true, b1: "calf_seat", b2: "calf_seat" },
  crunch: { reps: [8, 12], rest: 60, fail: true, b1: "crunch", b2: "crunch" },
  pallof: { reps: [8, 12], rest: 60, b1: "pallof", b2: "pallof" },
  hlr: { reps: [8, 12], rest: 60, b1: "hlr", b2: "hlr" },
  sideplank: { reps: [20, 40], rest: 60, b1: "sideplank", b2: "sideplank" },
  abwheel: { reps: [6, 10], rest: 60, b1: "abwheel", b2: "abwheel" },
  carry: { reps: [30, 45], rest: 60, b1: "carry", b2: "carry" },
};

export const SESSIONS = [
  { id: "hautA", name: "Haut A", sub: "Pecs, épaules, triceps", day: 1, warm: "upper", ex: [["dc", 3], ["incline", 3], ["latraise", 2], ["reardelt", 2], ["tristretch", 2]], core: "coreA" },
  { id: "basA", name: "Bas A", sub: "Squat, ischios, mollets", day: 2, warm: "lower", ex: [["squat", 3], ["legcurl", 3], ["calfstand", 3]], core: "coreB" },
  { id: "hautB", name: "Haut B", sub: "Dos, delt postérieurs, biceps", day: 3, warm: "upper", ex: [["pull", 3], ["row", 2], ["reardelt", 2], ["curl2", 2]], core: "coreC" },
  { id: "hautC", name: "Haut C", sub: "Épaules et bras", day: 5, warm: "upper", ex: [["latraise", 3], ["ohp", 3], ["curl1", 3], ["pushdown", 3], ["fly", 2]], core: "coreA" },
  { id: "basB", name: "Bas B", sub: "Hip thrust, presse, dos sagittal, mollets", day: 6, warm: "lower", ex: [["hipthrust", 3], ["quad2", 2], ["pullsag", 2], ["calfseat", 3]], core: "coreB" },
];
export const CORE = {
  coreA: { label: "Abdos A — flexion chargée + anti-rotation", ex: [["crunch", 2], ["pallof", 2]] },
  coreB: { label: "Abdos B — relevé de jambes + anti-flexion latérale", ex: [["hlr", 2], ["sideplank", 2]] },
  coreC: { label: "Abdos C — anti-extension + portés", ex: [["abwheel", 2], ["carry", 2]] },
};
