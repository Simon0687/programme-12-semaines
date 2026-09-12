# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [2.0.0](https://github.com/Simon0687/programme-12-semaines/compare/v1.0.0...v2.0.0) (2026-09-13)


### ⚠ BREAKING CHANGES

Journals written before this version are migrated on first load, in one pass, to
`schemaVersion` 4. The original is copied untouched to
`prog12_simon_v1_backup_pre<N>` before anything is rewritten, and a failed
migration loads nothing rather than overwriting anything.

* **storage:** the journal becomes a programs map keyed by program id, under the
same storage key — several cycles can coexist.
* **schema:** sessions are identified by their real date instead of their cycle
week, so a second pass through the same program no longer overwrites the first.
* **schema:** each entry carries its own program definition, instead of resolving
it against the bundled program at read time — changing the shipped program no
longer re-interprets past sessions.

### Features

* **app:** hide the cardio affordance on Seance when the bundle has none ([#13](https://github.com/Simon0687/programme-12-semaines/issues/13)) ([24313bc](https://github.com/Simon0687/programme-12-semaines/commit/24313bc91f2b43150155919c789e605ff43c4f72)), closes [#25](https://github.com/Simon0687/programme-12-semaines/issues/25)
* **app:** hide the cardio block on Semaine when the bundle has none ([#13](https://github.com/Simon0687/programme-12-semaines/issues/13)) ([413c65c](https://github.com/Simon0687/programme-12-semaines/commit/413c65c94f037ce2c4bc558ceaed7a2434289725))
* **app:** omit the cardio/mobility line from the bilan when absent ([#13](https://github.com/Simon0687/programme-12-semaines/issues/13)) ([f5daec8](https://github.com/Simon0687/programme-12-semaines/commit/f5daec8d93f6c270981b0298eef755d959be9a7f))
* **app:** render the cardio checklist and mobility block independently ([#13](https://github.com/Simon0687/programme-12-semaines/issues/13)) ([8e473a1](https://github.com/Simon0687/programme-12-semaines/commit/8e473a1d51e3012dd2c8ed4934d491d7bc65a502))
* **import:** accept and validate a data-only program field ([#25](https://github.com/Simon0687/programme-12-semaines/issues/25)) ([cb6565c](https://github.com/Simon0687/programme-12-semaines/commit/cb6565c74e0e97be686b1bfc249ecd381803db06)), closes [#6](https://github.com/Simon0687/programme-12-semaines/issues/6) [#19](https://github.com/Simon0687/programme-12-semaines/issues/19) [#20](https://github.com/Simon0687/programme-12-semaines/issues/20)
* **import:** classify a pasted journal into typed rejection reasons ([#7](https://github.com/Simon0687/programme-12-semaines/issues/7)) ([785f340](https://github.com/Simon0687/programme-12-semaines/commit/785f340efead291d47a519a9a206d0966e44ac07))
* **nav:** afficher le compteur de séances validées sur l'onglet Semaine ([f18e82a](https://github.com/Simon0687/programme-12-semaines/commit/f18e82a3438cd9709c20460d0646e1b2d349f124))
* **plan:** keep a rejected import's reason visible in the panel ([#7](https://github.com/Simon0687/programme-12-semaines/issues/7)) ([e89d210](https://github.com/Simon0687/programme-12-semaines/commit/e89d210797caab80d06d89dec4a5fd44ee7f4ae4))
* **plan:** load a program definition from a file ([#6](https://github.com/Simon0687/programme-12-semaines/issues/6)) ([174f318](https://github.com/Simon0687/programme-12-semaines/commit/174f3183a9a8cd2c7737e27d46021dbe41fbffd4))
* **plan:** show a pre-migration backup for recovery ([#8](https://github.com/Simon0687/programme-12-semaines/issues/8)) ([55fea61](https://github.com/Simon0687/programme-12-semaines/commit/55fea6148931046e4205c90a807a73faba837787))
* **program:** derive cardio/mobility presence and guard the day-notes helper ([#13](https://github.com/Simon0687/programme-12-semaines/issues/13)) ([306607b](https://github.com/Simon0687/programme-12-semaines/commit/306607b77aef267ae19a01b6ee54ea30b5266585)), closes [#25](https://github.com/Simon0687/programme-12-semaines/issues/25)
* **programs:** make the bundled default a neutral Upper/Lower program ([#26](https://github.com/Simon0687/programme-12-semaines/issues/26)) ([08277fc](https://github.com/Simon0687/programme-12-semaines/commit/08277fc3c89346f1b6350fe621092dd549124f9a)), closes [#27](https://github.com/Simon0687/programme-12-semaines/issues/27)
* **schema:** pin the definition into every journal entry ([#26](https://github.com/Simon0687/programme-12-semaines/issues/26)) ([c8956eb](https://github.com/Simon0687/programme-12-semaines/commit/c8956ebd20106b0efaee3e0964999681a135cfad)), closes [#6](https://github.com/Simon0687/programme-12-semaines/issues/6)
* **storage:** multi-program journal ([#6](https://github.com/Simon0687/programme-12-semaines/issues/6)) ([b188576](https://github.com/Simon0687/programme-12-semaines/commit/b18857685f293d66467f84886127e88dd8332a0e))


### Bug Fixes

* **app:** distinguish an unreadable journal from a too-new one, with a persistent message ([#10](https://github.com/Simon0687/programme-12-semaines/issues/10)) ([48be6e7](https://github.com/Simon0687/programme-12-semaines/commit/48be6e7a233bead054349bb7548d468a7ea9316b))
* **app:** import withVersion, missing since the storage extraction ([#21](https://github.com/Simon0687/programme-12-semaines/issues/21)) ([9e047bd](https://github.com/Simon0687/programme-12-semaines/commit/9e047bd70fd80f0913736effb8ead6a90c7c4620))
* **app:** pass date to ExerciseCard's planned()/lastEntry() calls ([#16](https://github.com/Simon0687/programme-12-semaines/issues/16)) ([a8221ae](https://github.com/Simon0687/programme-12-semaines/commit/a8221ae3ae6d4982a0494b961811cd7c86e5b0f7))
* **app:** reword the load error, report dropped rows, disable unusable cycles ([#32](https://github.com/Simon0687/programme-12-semaines/issues/32)) ([49c594b](https://github.com/Simon0687/programme-12-semaines/commit/49c594b86b43a21d8f2a3d80fa61cdde80ea4c9e))
* **app:** surface a program file failure, and pin the never-throws invariant ([#33](https://github.com/Simon0687/programme-12-semaines/issues/33)) ([ceba9a6](https://github.com/Simon0687/programme-12-semaines/commit/ceba9a63584cd82127c899aaed3c14fa4255e2f7))
* corriger le chemin des scripts vers dist/ et le scan Tailwind ([d658494](https://github.com/Simon0687/programme-12-semaines/commit/d658494d4cfee51008fa9f14f7f96ab6c67f89f2))
* **import:** reject program definitions that crash the app or render undefined ([#20](https://github.com/Simon0687/programme-12-semaines/issues/20)) ([c95e434](https://github.com/Simon0687/programme-12-semaines/commit/c95e434b5780ac84d96b1f56488e77b4c5a83897)), closes [#13](https://github.com/Simon0687/programme-12-semaines/issues/13) [#19](https://github.com/Simon0687/programme-12-semaines/issues/19)
* **import:** validate a pasted journal through the same checks ([#32](https://github.com/Simon0687/programme-12-semaines/issues/32)) ([fbbc36a](https://github.com/Simon0687/programme-12-semaines/commit/fbbc36aece373dc0b258cf9c04135c8bbede4823)), closes [#12](https://github.com/Simon0687/programme-12-semaines/issues/12) [#26](https://github.com/Simon0687/programme-12-semaines/issues/26)
* **journal-shape:** guard tuple destructuring before it throws ([#33](https://github.com/Simon0687/programme-12-semaines/issues/33)) ([d87b71c](https://github.com/Simon0687/programme-12-semaines/commit/d87b71c86d46936fc57e1ec67e1ec8ce6af240f9)), closes [#32](https://github.com/Simon0687/programme-12-semaines/issues/32) [#32](https://github.com/Simon0687/programme-12-semaines/issues/32) [#32](https://github.com/Simon0687/programme-12-semaines/issues/32) [#25](https://github.com/Simon0687/programme-12-semaines/issues/25)
* **journal-shape:** reject a session day outside the week ([#33](https://github.com/Simon0687/programme-12-semaines/issues/33)) ([8ae05aa](https://github.com/Simon0687/programme-12-semaines/commit/8ae05aa7caeaccb5265983d57df83cff51eae651)), closes [#16](https://github.com/Simon0687/programme-12-semaines/issues/16)
* **journal-shape:** reject an after value the app cannot render ([#33](https://github.com/Simon0687/programme-12-semaines/issues/33)) ([36a987c](https://github.com/Simon0687/programme-12-semaines/commit/36a987c61cc547127e288eae177a27e3571d21f2))
* **journal-shape:** reject impossible rep ranges, duplicate ids, non-object startingLoads ([#33](https://github.com/Simon0687/programme-12-semaines/issues/33)) ([d160a2b](https://github.com/Simon0687/programme-12-semaines/commit/d160a2b61099005f6f207d05bfddc453fa166cee)), closes [#26](https://github.com/Simon0687/programme-12-semaines/issues/26)
* **program:** resolve a definition without program to the legacy program ([#32](https://github.com/Simon0687/programme-12-semaines/issues/32)) ([79f6826](https://github.com/Simon0687/programme-12-semaines/commit/79f682697c889e901d3f443e3bff25546933c5dc)), closes [#6](https://github.com/Simon0687/programme-12-semaines/issues/6) [#25](https://github.com/Simon0687/programme-12-semaines/issues/25) [#26](https://github.com/Simon0687/programme-12-semaines/issues/26)
* **program:** treat program.cardio: null as disabling cardio, not "default" ([#25](https://github.com/Simon0687/programme-12-semaines/issues/25)) ([1d1ae77](https://github.com/Simon0687/programme-12-semaines/commit/1d1ae7707636340befcef58ca9dd4a38eca288d0)), closes [#13](https://github.com/Simon0687/programme-12-semaines/issues/13) [#13](https://github.com/Simon0687/programme-12-semaines/issues/13)
* **progression:** drop the RIR gate on the calibration branch too ([#28](https://github.com/Simon0687/programme-12-semaines/issues/28)) ([16359c5](https://github.com/Simon0687/programme-12-semaines/commit/16359c5a702081c279b6350213005c692df015b8))
* **progression:** drop the RIR gate on the top-of-range branch ([#28](https://github.com/Simon0687/programme-12-semaines/issues/28)) ([e8ba74a](https://github.com/Simon0687/programme-12-semaines/commit/e8ba74a5c61021dc96b9d862960102f712f2a9ef))
* **progression:** show the last session's real date instead of Sundefined ([#30](https://github.com/Simon0687/programme-12-semaines/issues/30)) ([587e0b6](https://github.com/Simon0687/programme-12-semaines/commit/587e0b6db6dc68cacb99a6b251887b4e84b9c002)), closes [#16](https://github.com/Simon0687/programme-12-semaines/issues/16) [#16](https://github.com/Simon0687/programme-12-semaines/issues/16)
* **schema:** carry the real validation date into updatedAt ([#40](https://github.com/Simon0687/programme-12-semaines/issues/40)) ([7da70f3](https://github.com/Simon0687/programme-12-semaines/commit/7da70f31e13743198428de968354a0c7b7abce8e)), closes [#16](https://github.com/Simon0687/programme-12-semaines/issues/16)
* **schema:** make migrate() return a verdict instead of throwing on invalid schemaVersion ([#10](https://github.com/Simon0687/programme-12-semaines/issues/10)) ([b018fec](https://github.com/Simon0687/programme-12-semaines/commit/b018fec0afc54a01d02555af3d69ebb0fa2c7c42))
* **storage:** a successful import lifts the storageOk block ([#12](https://github.com/Simon0687/programme-12-semaines/issues/12)) ([3d139e2](https://github.com/Simon0687/programme-12-semaines/commit/3d139e2b543e6a17ef6c8bb798be341147e98c24)), closes [#10](https://github.com/Simon0687/programme-12-semaines/issues/10) [#8](https://github.com/Simon0687/programme-12-semaines/issues/8) [#21](https://github.com/Simon0687/programme-12-semaines/issues/21)
* **storage:** drop unreadable log rows and back up the original ([#32](https://github.com/Simon0687/programme-12-semaines/issues/32)) ([dfaec85](https://github.com/Simon0687/programme-12-semaines/commit/dfaec8585f709b9cd743663170630b978a8b3706)), closes [#8](https://github.com/Simon0687/programme-12-semaines/issues/8)
* **storage:** hold the active definition to the file-import bar ([#32](https://github.com/Simon0687/programme-12-semaines/issues/32)) ([4d53685](https://github.com/Simon0687/programme-12-semaines/commit/4d53685304f1c8087a504f3a61608f46c9f191ad)), closes [#26](https://github.com/Simon0687/programme-12-semaines/issues/26)
* **storage:** refuse a journal whose active program is missing ([#21](https://github.com/Simon0687/programme-12-semaines/issues/21)) ([6cc5b87](https://github.com/Simon0687/programme-12-semaines/commit/6cc5b8755ab78f88daf12a4f8b8864c92ebcac36)), closes [#10](https://github.com/Simon0687/programme-12-semaines/issues/10)
* **storage:** refuse to write a journal that would not load back ([#32](https://github.com/Simon0687/programme-12-semaines/issues/32)) ([316d84a](https://github.com/Simon0687/programme-12-semaines/commit/316d84a8ca2d8f7ecbd646ccc54773a06fa0943f))
* **storage:** reject a malformed journal envelope instead of throwing ([#32](https://github.com/Simon0687/programme-12-semaines/issues/32)) ([17f28f1](https://github.com/Simon0687/programme-12-semaines/commit/17f28f11f6839cb1b542c099a6d384a19e92893a)), closes [#21](https://github.com/Simon0687/programme-12-semaines/issues/21) [#26](https://github.com/Simon0687/programme-12-semaines/issues/26)


* Merge branch 'feat/26-neutral-default-program' into dev ([6a72c7f](https://github.com/Simon0687/programme-12-semaines/commit/6a72c7f7b920279b639309697f07316e060e0ace)), closes [#26](https://github.com/Simon0687/programme-12-semaines/issues/26)

## [1.0.0] — 2026-09-06

### Ajouté
- Première version stable du programme 12 semaines
- Interface 4 onglets : Séance, Semaine, Bilan, Plan
- Suivi des exercices avec saisie charge/reps/RIR par série
- Calcul automatique de la double progression (charges prévues)
- Gestion des phases : Calibration (S1), Bloc 1 (S2–S6), Décharge (S7), Bloc 2 (S8–S12)
- Cardio et mobilité : Z2, intervalles, McGill Big 3
- Abdos : 3 blocs rotatifs (flexion + gainage anti-mouvement)
- Bilan hebdomadaire : poids, taille, sommeil, RIR ressenti, douleurs, nutrition
- Stockage local (localStorage), export/import JSON
- PWA : installation sur téléphone, fonctionnement hors ligne
- Compatibilité mobile et desktop
- Service worker pour cache

# Test workflow
