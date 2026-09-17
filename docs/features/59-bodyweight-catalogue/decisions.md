# Decisions - A bodyweight catalogue, and the third preset (#59)

Source: the issue. No `spec.md`: the issue carries the problem statement, the
measurement that produced it (#58 `decisions-spec.md` Q1) and the acceptance
criteria. **Level B** under `.claude/WORKFLOW.md` - Q1 no (no stored journal
changes meaning: existing `vid`s keep theirs, and nothing already recorded is
re-read), Q2 no, Q3 no, Q4 yes (registry + generator + the home gym's advice).
What follows is the content round, which a commit body cannot hold: thirteen
catalogue entries are thirteen judgement calls, and they are the part Simon
should be able to contest one by one.

Status: **decided while building, 2026-09-17.** Measured over the 180
combinations of the collection screen.

---

## D1 - The entries take the muscle split of their loaded equivalent

**The call.** `squat_bw` carries the split of `squat`, `lunge_bw` that of
`lunge_db`, `rdl_uni_bw` that of `rdl_db`, `pike_pushup` that of `ohp_db`,
`rear_delt_row` that of `facepull`. Nothing was re-estimated from scratch.

**Why.** The split describes a movement pattern, not a load: a squat is a squat
at 100 kg or at bodyweight, and the six assertions read these numbers as counts
of working sets, never as intensities. Re-estimating them by hand would have put
thirteen new opinions into a table whose other sixty-three entries were derived
once, from `catalogue-exercices-v1.json`, and never touched since.

What *does* change without load: `stabilite` is 2 everywhere (neither a heavy
free bar nor a machine) and `cout_systemique` is never 3 - nothing here taxes
the spine like a barbell squat.

## D2 - `barre_traction` stands for a bar whose height is adjustable

**The call.** Four entries - `row_inv_bar`, `curl_bw`, `rear_delt_row`,
`tri_ext_bw` - declare `barre_traction` and are performed *under* the bar, at
hip height.

**Why not a new equipment term.** `EQUIPMENT` is a closed vocabulary aligned on
`catalogue-exercices-v1.json`, and the 2026-09-10 memo says the two must never
diverge again. Adding « barre basse » for a mounting nuance would break that for
no gain in what the engine can select.

**What it costs.** Someone with a doorway bar cannot do those four. The
collection screen now says so before the choice is made, rather than after the
program is generated: « Poids du corps » suppose une barre de traction.

## D3 - Four of them are `niveau_min` 1, not 2

**The call.** `row_inv_bar`, `curl_bw`, `rear_delt_row` and `tri_ext_bw` are
open to a beginner.

**Why.** Measured, not assumed: with all four at 2, a beginner's bodyweight pool
held eight entries and **five muscles had no primary exercise** - both arms and
all three deltoids. The cause was the level filter, not the catalogue. And the
reason they belong at 1 is the same one that makes them work at all: under a
bar, difficulty is set by the angle of the body, not by a weight to lift. That
is already why `row_inv` sits at 1.

At `niveau_min` 1 a beginner's pool holds eleven entries and only the lateral
deltoid is unserved.

## D4 - The lateral deltoid stays unserved, and the report says so

**The call.** No entry gives `deltoide_lat` a share of 0,5 or more, so every
bodyweight program generated announces « Rien ne couvre : delt latéraux ».

**Why not invent one.** `deltoide_lat` counts **direct only** (`VOLUME`): a
press contributes zero to it by the indirect-counting rule, so covering it takes
an exercise that is *about* it. No movement without external resistance is. The
options were to ship a fifty-fifty entry that would quietly inflate shoulder
volume - the exact FitAI failure the method document exists to prevent - or to
declare the gap. The engine already has a vocabulary for declaring gaps.

**Precedent.** This is the shape of the home gym's calves before this issue: a
known hole, announced by `report.uncovered`, and a program that is honest about
it rather than one that pretends.

## D5 - The home gym gets its calves back for free

Not a decision so much as a consequence worth recording: `calf_step` (mollets
debout sur une marche) declares `poids_du_corps` only, so the home gym preset -
whose gear already includes it - now has a primary calf exercise without its
`gear` changing by a single term. Its report goes from « Rien ne couvre :
mollets » to empty.

## D6 - Block 2 mostly repeats block 1, and that is the catalogue's width

Measured over 99 slots (3, 4 and 5 sessions x 60 and 75 min, intermediate):

| preset | slots where b1 differs from b2 |
|---|---|
| salle complète | 62 % |
| home gym | 38 % |
| poids du corps | **10 %** |

Rule B.2 asks for one variant per pattern per block, rotated at the next block.
The engine still applies it; there is simply nothing to rotate to. Bodyweight
holds three knee-dominant entries but a single hip-hinge, a single calf, a
single biceps and a single triceps exercise, so those slots name the same
exercise in both blocks.

Not fixed here, and deliberately: closing it means a second wave of entries
(decline and diamond push-ups, jump squats, two-leg hip thrust, archer rows),
which is a catalogue issue of its own and not what the third preset was waiting
on. Worth knowing before using the preset for twelve weeks: the second block
will look like the first.

---

---

## What Simon should check, in order of how wrong I could be

1. **`niveau_min` on `nordic_curl` (3).** It is the one entry a beginner truly
   cannot do, and I rated it like `dl_conv`. If it should be 2, a beginner's
   hamstrings gain a second option.
2. **`rdl_uni_bw` at `niveau_min` 2.** Single-leg balance is the limiting
   factor, not strength. Arguably 1.
3. **The 0,7 / 0,3 of `rear_delt_row`.** Copied from `facepull`. A wide-grip
   inverted row with high elbows arguably trains more back than a face pull
   does.
4. **`tri_ext_bw` under a bar rather than on parallel bars.** Shipped under the
   bar because the angle is adjustable, which is what let it sit at level 1.

None of the four changes a stored journal or the shape of anything: they are
numbers in a data table, and the acceptance matrix re-runs over 180 combinations
on every change.
