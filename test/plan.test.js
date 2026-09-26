import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildPlan, PHASE_NOTES } from "../src/plan.js";
import { phaseOf } from "../src/progression.js";
/* #26 : le plan se vérifie contre le programme hérité — le bundle par défaut
   ne portera plus ni charges de départ ni valeurs personnelles. */
import { LEGACY_DEFINITION } from "../src/legacy-program.js";
import { DEFAULT_DEFINITION as NEUTRAL } from "../src/default-program.js";
const { profile: PROFILE, startingLoads: STARTING_LOADS } = LEGACY_DEFINITION;
const withDef = (over) => ({ ...LEGACY_DEFINITION, ...over });

/* Garde-fous de forme pour les données de l'onglet Plan (#4, #6). Ne
   teste pas le texte (c'est de l'éditorial, il change), seulement que la
   structure que <PlanContent> / <Block> attend est respectée et que
   PHASE_NOTES reste aligné sur les phases que phaseOf() peut renvoyer. */

const PLAN = buildPlan(LEGACY_DEFINITION);

/* #104, #109, #114 : tout le texte lisible d'une section, quelle que soit la
   forme du bloc qui le porte — récursif pour "fold" (#109), dont les blocs
   repliés portent n'importe laquelle des formes ci-dessus. */
const blockTexts = (blocks) => blocks.flatMap((b) => {
  if (b.t === "p" || b.t === "h" || b.t === "callout" || b.t === "headline") return [b.text];
  if (b.t === "ul" || b.t === "chips") return b.items;
  if (b.t === "iconlist") return b.items.map((it) => it.text);
  if (b.t === "phaseline") return b.steps.map((s2) => s2.text);
  if (b.t === "bars") return b.rows.map((r) => r.label);
  if (b.t === "tiles") return b.items.flatMap((it) => [it.label, it.value]);
  if (b.t === "table" && b.variant === "compare") return b.rows.flatMap(([, a, c]) => [a, c]);
  if (b.t === "table" && b.variant === "ifthen") return b.rows.flatMap(([si, alors]) => [si, alors]);
  if (b.t === "fold") return blockTexts(b.blocks);
  return [];
});
const textsOf = (s) => blockTexts(s.blocks);

describe("PHASE_NOTES", () => {
  test("couvre exactement les id de phase renvoyés par phaseOf()", () => {
    const ids = new Set();
    for (let w = 1; w <= 12; w++) ids.add(phaseOf(w).id);
    assert.deepEqual([...ids].sort(), Object.keys(PHASE_NOTES).sort());
  });

  test("chaque note est une chaîne non vide", () => {
    for (const [id, note] of Object.entries(PHASE_NOTES)) {
      assert.equal(typeof note, "string", id);
      assert.ok(note.trim().length > 0, id);
    }
  });
});

describe("PLAN", () => {
  test("chaque section a un id, un titre et au moins un bloc", () => {
    const seen = new Set();
    for (const s of PLAN) {
      assert.ok(s.id && !seen.has(s.id), `id unique: ${s.id}`);
      seen.add(s.id);
      assert.ok(s.title && s.title.trim().length > 0, s.id);
      assert.ok(Array.isArray(s.blocks) && s.blocks.length > 0, s.id);
    }
  });

  /* Récursive à cause de "fold" (#109) : ses blocs repliés portent
     n'importe laquelle des formes ci-dessous, jamais un second "fold" dans
     ce contenu-ci mais rien ne l'interdirait au vocabulaire. */
  const checkBlock = (b, sid) => {
    if (b.t === "p" || b.t === "h" || b.t === "callout" || b.t === "headline") {
      assert.equal(typeof b.text, "string", sid);
      assert.ok(b.text.trim().length > 0, sid);
    } else if (b.t === "ul" || b.t === "chips") {
      assert.ok(Array.isArray(b.items) && b.items.length > 0, `${sid}: items`);
      /* Les items servent de clé React dans <Block> : deux items égaux
         dans une même liste seraient un doublon de clé. */
      assert.equal(new Set(b.items).size, b.items.length, `${sid}: items distincts`);
      for (const it of b.items) {
        assert.equal(typeof it, "string", sid);
        assert.ok(it.trim().length > 0, sid);
      }
    } else if (b.t === "iconlist") {
      assert.ok(Array.isArray(b.items) && b.items.length > 0, `${sid}: items`);
      for (const it of b.items) {
        assert.equal(typeof it.icon, "string", sid);
        assert.equal(typeof it.text, "string", sid);
        assert.ok(it.text.trim().length > 0, sid);
      }
    } else if (b.t === "tiles") {
      assert.ok(Array.isArray(b.items) && b.items.length > 0, `${sid}: items`);
      for (const it of b.items) {
        assert.equal(typeof it.label, "string", sid);
        assert.equal(typeof it.value, "string", sid);
      }
    } else if (b.t === "phaseline") {
      assert.ok(Array.isArray(b.steps) && b.steps.length > 0, `${sid}: steps`);
      for (const step of b.steps) {
        assert.equal(typeof step.phase, "string", sid);
        assert.equal(typeof step.label, "string", sid);
        assert.equal(typeof step.text, "string", sid);
        assert.ok(step.text.trim().length > 0, sid);
      }
    } else if (b.t === "bars") {
      assert.ok(Array.isArray(b.rows) && b.rows.length > 0, `${sid}: rows`);
      /* Trié décroissant, la plus grande valeur donnant l'échelle (#108). */
      for (let i = 1; i < b.rows.length; i++) {
        assert.ok(b.rows[i - 1].value >= b.rows[i].value, `${sid}: pas trié décroissant`);
      }
      for (const row of b.rows) {
        assert.equal(typeof row.label, "string", sid);
        assert.equal(typeof row.value, "number", sid);
      }
    } else if (b.t === "fold") {
      assert.ok(b.title && b.title.trim().length > 0, `${sid}: title`);
      assert.ok(Array.isArray(b.blocks) && b.blocks.length > 0, `${sid}: blocks`);
      for (const nested of b.blocks) checkBlock(nested, sid);
    } else if (b.t === "table") {
      assert.ok(["compare", "ifthen"].includes(b.variant), `${sid}: variant`);
      assert.ok(Array.isArray(b.rows) && b.rows.length > 0, `${sid}: rows`);
      const width = b.variant === "compare" ? 3 : 2;
      if (b.variant === "compare") assert.ok(Array.isArray(b.head) && b.head.length === 2, `${sid}: head`);
      for (const row of b.rows) {
        assert.ok(Array.isArray(row) && row.length === width, `${sid}: largeur de ligne`);
      }
    } else {
      assert.fail(`${sid}: type de bloc inconnu ${JSON.stringify(b.t)}`);
    }
  };

  test("chaque bloc est un type connu et bien formé", () => {
    for (const s of PLAN) for (const b of s.blocks) checkBlock(b, s.id);
  });

  /* #109 : le compte d'un "fold" ne peut pas diverger de son contenu — c'est
     tout l'argument de la dérivation ("jamais recopié à la main"). */
  test("le compte d'un fold est celui de son bloc à puces", () => {
    const folds = (blocks) => blocks.flatMap((b) => (b.t === "fold" ? [b, ...folds(b.blocks)] : []));
    for (const s of PLAN) {
      for (const f of folds(s.blocks)) {
        const list = f.blocks.find((b) => b.t === "ul");
        if (list) assert.equal(f.count, list.items.length, `${s.id} › ${f.title}`);
      }
    }
  });

  /* #104 : la mesure du reproche « beaucoup de texte ». 300 caractères, c'est
     environ huit lignes sur un téléphone — au-delà, le paragraphe n'a plus de
     point d'atterrissage. Les sections listées ici n'ont pas encore été
     reprises ; **cette liste doit finir vide**, et c'est le seul état où #104
     est terminée. Retirer un id sans l'avoir repris fait échouer le test. */
  const PENDING_104 = [];

  test("aucun texte de section ne dépasse 300 caractères", () => {
    for (const s of PLAN) {
      if (PENDING_104.includes(s.id)) continue;
      for (const text of textsOf(s)) {
        assert.ok(text.length <= 300, `${s.id}: ${text.length} caractères — « ${text.slice(0, 60)}… »`);
      }
    }
  });

  test("la liste d'attente de #104 ne cite que des sections qui existent", () => {
    const ids = new Set(PLAN.map((s) => s.id));
    for (const id of PENDING_104) assert.ok(ids.has(id), `${id} n'est plus une section : retire-la de PENDING_104`);
  });

  test("exactement une section est dépliée au montage", () => {
    assert.equal(PLAN.filter((s) => s.open).length, 1);
  });
});

describe("buildPlan : reflète le profil reçu (#6)", () => {
  test("un profil différent change le texte nutrition et charges de départ", () => {
    const other = buildPlan(withDef({
      profile: { ...PROFILE, maintenanceKcal: 2000, startKcal: 2200, macros: { p: 150, f: 60, c: 300 }, targetWeightKg: [70, 71] },
      startingLoads: { ...STARTING_LOADS, dc: 40, squat: 60 },
    }));

    /* #104 : la section entière, et plus son premier bloc. Ces deux pages sont
       maintenant faites d'intertitres et de listes — lire `blocks[0].text`
       n'interrogeait plus que le titre « Cibles », qui ne porte aucun chiffre
       et aurait laissé passer un profil ignoré. */
    const nutritionText = textsOf(other.find((s) => s.id === "nutrition")).join(" ");
    assert.match(nutritionText, /2 200 kcal/);
    assert.doesNotMatch(nutritionText, new RegExp(String(PROFILE.startKcal)));

    const loadsText = textsOf(other.find((s) => s.id === "startloads")).join(" ");
    assert.match(loadsText, /40 kg/);
    assert.match(loadsText, /60 kg/);
  });

  test("le reste du contenu ne dépend pas du profil : deux profils, même structure", () => {
    const a = buildPlan(LEGACY_DEFINITION);
    const b = buildPlan(withDef({ profile: { ...PROFILE, maintenanceKcal: 1 }, startingLoads: { ...STARTING_LOADS, dc: 1 } }));
    const invariant = (p) => p.filter((s) => s.id !== "nutrition" && s.id !== "startloads");
    assert.deepEqual(invariant(a), invariant(b));
  });
});

/* #26 : l'onglet Plan décrivait le programme de Simon en dur — squat, rameur,
   cinq séances nommées — quel que soit le programme actif. Chaque section qui
   parle d'un programme précis tire désormais son contenu de la définition, et
   disparaît quand cette donnée est absente. */
describe("buildPlan : sections pilotées par la définition (#26)", () => {
  /* Slots neutres : la phrase sur les ancres étant dérivée du programme, la
     réutilisation de ceux de Simon y ferait légitimement apparaître le squat. */
  const bare = {
    weeks: 12,
    program: {
      ...LEGACY_DEFINITION.program,
      SLOTS: { press: { reps: [5, 10], rest: 150, key: true, b1: "dc_db", b2: "dc_db" } },
      cardio: null,
      volume: undefined,
      fallback: undefined,
    },
  };

  test("sans profil, sans charges, sans cardio : ces sections disparaissent", () => {
    const ids = buildPlan(bare).map((s) => s.id);
    assert.deepEqual(ids, ["structure", "progression", "deload", "repos"]);
  });

  test("les sections restantes sont de la méthode, pas du programme", () => {
    for (const s of buildPlan(bare)) {
      /* #104 : le garde-fou lit maintenant les listes aussi. Écrit pour les
         seuls paragraphes, il aurait cessé de couvrir une phrase le jour où
         elle devient un item — c'est-à-dire exactement ce que #104 fait. */
      for (const text of textsOf(s)) {
        assert.doesNotMatch(text, /squat|rameur|hip thrust|Haut [ABC]|Bas [AB]/i, `${s.id} cite un exercice ou une séance`);
      }
    }
  });

  test("une seule section reste dépliée même quand les autres disparaissent", () => {
    assert.equal(buildPlan(bare).filter((s) => s.open).length, 1);
  });

  test("les ancres sont dérivées des slots key dont b1 et b2 sont identiques", () => {
    const anchored = buildPlan(withDef({
      program: { ...LEGACY_DEFINITION.program, SLOTS: { a: { reps: [4, 8], rest: 150, key: true, b1: "dc", b2: "dc" }, b: { reps: [8, 12], rest: 90, b1: "lat_db", b2: "lat_cable" } } },
    }));
    /* #104 : les ancres sont passées du deuxième bloc à une liste ; ce qui se
       vérifie reste le même — le nom dérivé du slot est là, l'autre pas. */
    const text = textsOf(anchored.find((s) => s.id === "structure")).join(" ");
    assert.match(text, /développé couché barre/i);
    assert.doesNotMatch(text, /élévations latérales/i); // ni clé, ni fixe
  });
});

/* ---------- La section fallback, deux formats (#120) ---------- */
describe("buildPlan : plan de repli, deux formes valides (#120)", () => {
  test("le tableau de strings hérité (programme de Simon) reste rendu tel quel", () => {
    const s = buildPlan(LEGACY_DEFINITION).find((sec) => sec.id === "fallback");
    assert.ok(s, "section fallback absente");
    assert.equal(s.blocks.length, LEGACY_DEFINITION.program.fallback.length);
    assert.equal(s.blocks[0].text, LEGACY_DEFINITION.program.fallback[0]);
  });

  test("l'objet structuré { levels } produit un paragraphe par niveau, plus la règle de non-répétition", () => {
    const structured = {
      levels: [
        { keep: ["hautA", "hautC"], merge: { from: ["jambes", "hautB"], into: { id: "j1", ex: [["s_squat", 3]] } } },
      ],
    };
    const def = withDef({
      program: {
        ...LEGACY_DEFINITION.program,
        fallback: structured,
        SLOTS: { ...LEGACY_DEFINITION.program.SLOTS, s_squat: { reps: [5, 8], rest: 150, b1: "squat", b2: "squat" } },
        SESSIONS: [
          { id: "hautA", name: "Haut A", day: 1, warm: "haut", core: "gainage", ex: [["s_squat", 1]] },
          { id: "hautB", name: "Haut B", day: 2, warm: "haut", core: "gainage", ex: [["s_squat", 1]] },
          { id: "hautC", name: "Haut C", day: 3, warm: "haut", core: "gainage", ex: [["s_squat", 1]] },
          { id: "jambes", name: "Jambes", day: 4, warm: "bas", core: "gainage", ex: [["s_squat", 1]] },
        ],
      },
    });
    const s = buildPlan(def).find((sec) => sec.id === "fallback");
    assert.equal(s.meta, "1 cas de figure");
    const text = s.blocks[0].text;
    assert.match(text, /À 3 séances/);
    assert.match(text, /Haut A/);
    assert.match(text, /Haut C/);
    assert.match(text, /Jambes \+/);
    assert.match(text, /Squat barre 3/i);
    assert.match(s.blocks[s.blocks.length - 1].text, /pas deux semaines de suite/);
  });

  test("absent (fallback: undefined) : la section reste omise, comme avant #120", () => {
    const def = withDef({ program: { ...LEGACY_DEFINITION.program, fallback: undefined } });
    assert.equal(buildPlan(def).find((s) => s.id === "fallback"), undefined);
  });
});

/* ---------- La section cardio, dérivée (#34) ----------

   Trois paragraphes écrits en dur décrivaient le rameur de Simon sous tout
   programme qui demandait du cardio. Le premier test est l'invariant : sa
   section ne bouge pas d'un caractère. Les suivants montrent qu'elle bouge
   pour les autres. */
describe("buildPlan : cardio (#34)", () => {
  const sectionOf = (def) => buildPlan(def).filter(Boolean).find((s) => s.id === "cardio");

  test("le programme de Simon rend exactement les trois paragraphes d'avant #34", () => {
    assert.deepEqual(sectionOf(LEGACY_DEFINITION).blocks.map((b) => b.text), [
      "Rameur Z2 deux fois par semaine : 35 min en S1–S2, +5 min toutes les deux semaines jusqu'à 60 min en S12, 30 min faciles en S7. Cibles ~105–115 W, 130–138 bpm, cadence 18–20, drag factor 110–120. La durée progresse d'abord, la puissance ensuite.",
      "Intervalles (optionnel, S2–S6 et S8–S11) : 4 × 4 min en Z4 puis 5 × 4 min en bloc 2, 3 min de récupération, cadence 24–28 pour limiter la charge lombaire. Toujours à 48 h d'une séance jambes. C'est la première chose qu'on retire si un déclencheur de décharge s'allume.",
      "Mobilité 10–15 min, 3 fois par semaine : McGill Big 3 en pyramide descendante, 90/90 et couch stretch, thoracique, épaules. Échauffement spécifique avant chaque séance (voir la séance).",
    ]);
  });

  test("cardio: null — la section reste absente", () => {
    assert.equal(sectionOf({ ...LEGACY_DEFINITION, program: { ...LEGACY_DEFINITION.program, cardio: null } }), undefined);
  });

  test("un autre programme décrit son conditionnement, pas celui de Simon", () => {
    const def = {
      ...LEGACY_DEFINITION,
      cardioBaseline: { hr: [125, 135] },
      program: {
        ...LEGACY_DEFINITION.program,
        cardio: { sessions: [{ id: "m", modality: "marche", kind: "z2", day: 2 }], mobility: { days: [5, 7] } },
      },
    };
    const texts = sectionOf(def).blocks.map((b) => b.text);
    assert.equal(texts.length, 2, "pas d'intervalles déclarés, pas de paragraphe d'intervalles");
    assert.match(texts[0], /^Marche inclinée Z2 une fois par semaine/);
    assert.match(texts[0], /Cibles 125–135 bpm\./);
    /* Le point qui motivait l'issue : plus un mot du rameur, des watts ni des
       jours de Simon. */
    for (const t of texts) {
      assert.doesNotMatch(t, /[Rr]ameur/);
      assert.doesNotMatch(t, /105/);
    }
    assert.match(texts[1], /2 fois par semaine/);
  });

  test("sans cibles, la phrase s'arrête au lieu de promettre une puissance", () => {
    const def = {
      ...LEGACY_DEFINITION,
      cardioBaseline: undefined,
      program: { ...LEGACY_DEFINITION.program, cardio: { sessions: [{ id: "z", modality: "course", kind: "z2", day: 2 }] } },
    };
    const text = sectionOf(def).blocks[0].text;
    assert.doesNotMatch(text, /Cibles/);
    assert.match(text, /La durée progresse d'abord\.$/);
  });
});

/* ---------- Groupes et comptes (revue Claude Design, 1c) ----------

   L'idée porteuse de 1c n'est pas la navigation : c'est que chaque ligne de
   l'index **mesure** le programme actif. Un compte ne peut pas être vague là
   où un paragraphe le pouvait, et c'est pour ça qu'il ne pouvait pas arriver
   avant #34 — sous « default », la ligne Cardio aurait compté les séances de
   Simon sous n'importe quel programme. */
describe("buildPlan : groupes et comptes", () => {
  const byId = (def) => Object.fromEntries(buildPlan(def).map((s) => [s.id, s]));

  test("chaque section déclare un groupe connu et un compte non vide", () => {
    for (const def of [LEGACY_DEFINITION, NEUTRAL]) {
      for (const s of buildPlan(def)) {
        assert.ok(["methode", "programme", "appareil"].includes(s.group), `${s.id} : groupe « ${s.group} »`);
        assert.equal(typeof s.meta, "string", `${s.id} : meta`);
        assert.ok(s.meta.length > 0, `${s.id} : meta vide`);
      }
    }
  });

  test("le groupe est la ligne que #25 et #26 ont tracée, pas un choix de mise en page", () => {
    /* Méthode = ce qui vaut pour tout le monde et ne disparaît jamais.
       Programme = ce qui vient de la donnée, et qui disparaît avec elle. */
    const L = byId(LEGACY_DEFINITION);
    for (const id of ["structure", "progression", "deload", "repos"]) assert.equal(L[id].group, "methode", id);
    for (const id of ["volume", "fallback", "cardio", "nutrition", "startloads"]) assert.equal(L[id].group, "programme", id);
  });

  test("les comptes du programme mesurent ce programme-là", () => {
    const L = byId(LEGACY_DEFINITION), N = byId(NEUTRAL);
    assert.equal(N.volume.meta, "11 groupes · 7 séries max");
    assert.equal(L.volume.meta, "12 groupes · 10 séries max");
    assert.equal(L.cardio.meta, "3 séances · mercredi, jeudi, dimanche");
    assert.equal(L.startloads.meta, "6 exercices renseignés");
  });

  test("les comptes de la méthode sont les mêmes des deux côtés, et c'est normal", () => {
    /* Une référence a le droit de ne pas bouger. Ce qui compte est que ça se
       voie : trois lignes constantes sur huit est une information, pas un
       défaut à cacher. */
    const L = byId(LEGACY_DEFINITION), N = byId(NEUTRAL);
    for (const id of ["structure", "progression", "deload", "repos"]) {
      assert.equal(L[id].meta, N[id].meta, id);
    }
  });
});
