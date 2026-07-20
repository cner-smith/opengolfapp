# Changelog

## [1.3.0](https://github.com/cner-smith/opengolfapp/compare/v1.2.0...v1.3.0) (2026-07-12)


### Bug Fixes

* **core:** proximity stat falls back to following putt distance when no pin ([#575](https://github.com/cner-smith/opengolfapp/issues/575)) ([#790](https://github.com/cner-smith/opengolfapp/issues/790)) ([9af123b](https://github.com/cner-smith/opengolfapp/commit/9af123bbc3c40d1636543d034419268cc7f4c312))
* **learn:** add missing 'Last reviewed' footer to Strokes Gained + Benchmarks (web + mobile) ([#807](https://github.com/cner-smith/opengolfapp/issues/807)) ([141cc17](https://github.com/cner-smith/opengolfapp/commit/141cc17fddb338dbf7e8bb3b768489d4c5aa8abd))
* **mobile:** cap accessibility font scaling at 1.3x ([#808](https://github.com/cner-smith/opengolfapp/issues/808)) ([#809](https://github.com/cner-smith/opengolfapp/issues/809)) ([c035f55](https://github.com/cner-smith/opengolfapp/commit/c035f556b01f4037a28fe379355f09cac7ebc7fe))


### Chores

* **mobile:** bump version 1.0.1 → 1.1.0 for the feature release ([#812](https://github.com/cner-smith/opengolfapp/issues/812)) ([061a223](https://github.com/cner-smith/opengolfapp/commit/061a2238f25dc70830b6afe3c976c6a7709f2d2b))
* strip crawler WIP that leaked into dev via [#795](https://github.com/cner-smith/opengolfapp/issues/795) ([#799](https://github.com/cner-smith/opengolfapp/issues/799)) ([701ba4e](https://github.com/cner-smith/opengolfapp/commit/701ba4ec8adcedee6ea86551d9b471bf381991e8))

## [1.2.0](https://github.com/cner-smith/opengolfapp/compare/v1.1.1...v1.2.0) (2026-07-10)


### Features

* **mobile:** surface the web companion (Profile copy + Stats rider) ([#743](https://github.com/cner-smith/opengolfapp/issues/743)) ([6ab943a](https://github.com/cner-smith/opengolfapp/commit/6ab943a0a2e5471a950c970a7e5d335200835ae2))


### Bug Fixes

* **core:** formatSG rounds before picking sign — no more signed zero ([#672](https://github.com/cner-smith/opengolfapp/issues/672)) ([#739](https://github.com/cner-smith/opengolfapp/issues/739)) ([8dbd45a](https://github.com/cner-smith/opengolfapp/commit/8dbd45a11bf21449a291b880813fccdfbf88066b))
* **learn:** drop misleading swing-plane figure; correct retention-curve endpoint ([#780](https://github.com/cner-smith/opengolfapp/issues/780)) ([3542d46](https://github.com/cner-smith/opengolfapp/commit/3542d46efce06c31683b76b4aad3a42ca462b16f))
* **learn:** equipment + coaching article corrections ([#776](https://github.com/cner-smith/opengolfapp/issues/776)) ([8436585](https://github.com/cner-smith/opengolfapp/commit/843658516596cdf9f100c16c0a9e0c8882ad40e5))
* **learn:** glossary audit fixes — burn-mark grain read, spinner entries, general-audience lede ([#750](https://github.com/cner-smith/opengolfapp/issues/750), [#758](https://github.com/cner-smith/opengolfapp/issues/758)) ([#771](https://github.com/cner-smith/opengolfapp/issues/771)) ([f84e8b2](https://github.com/cner-smith/opengolfapp/commit/f84e8b20a32668047b2ad17bfea7606a445d761b))
* **learn:** on-course corrections — 1992 US Open claim, Rotella source, conditional SG copy, mirrors + registry desc ([#762](https://github.com/cner-smith/opengolfapp/issues/762)) ([#774](https://github.com/cner-smith/opengolfapp/issues/774)) ([1b3b973](https://github.com/cner-smith/opengolfapp/commit/1b3b9731a9711c07a35417d850a361d1e895f06b))
* **learn:** practice-article corrections + docs mirrors resync ([#773](https://github.com/cner-smith/opengolfapp/issues/773)) ([6bac8c2](https://github.com/cner-smith/opengolfapp/commit/6bac8c2cf4afaee894382a477dfaf2743b78f094))
* **learn:** stats articles — bracket-true SG example, corrected benchmarks + Sources, handicap-true You dot ([#751](https://github.com/cner-smith/opengolfapp/issues/751), [#752](https://github.com/cner-smith/opengolfapp/issues/752), [#757](https://github.com/cner-smith/opengolfapp/issues/757), [#761](https://github.com/cner-smith/opengolfapp/issues/761)) ([#775](https://github.com/cner-smith/opengolfapp/issues/775)) ([fe824e2](https://github.com/cner-smith/opengolfapp/commit/fe824e29a3efcb9243549c99cef1e0fd6b33bf5c))
* **learn:** swing + Op36 corrections — real Op36 ladder, lie-angle swap, face-dominance, plane figure parity ([#753](https://github.com/cner-smith/opengolfapp/issues/753), [#754](https://github.com/cner-smith/opengolfapp/issues/754), [#760](https://github.com/cner-smith/opengolfapp/issues/760), [#763](https://github.com/cner-smith/opengolfapp/issues/763), [#765](https://github.com/cner-smith/opengolfapp/issues/765)) ([#772](https://github.com/cner-smith/opengolfapp/issues/772)) ([6379af9](https://github.com/cner-smith/opengolfapp/commit/6379af976373c88098c5016923afdf761ab12cf7))
* **mobile:** chip rows wrap instead of scrolling horizontally ([#740](https://github.com/cner-smith/opengolfapp/issues/740)) ([#741](https://github.com/cner-smith/opengolfapp/issues/741)) ([387d2bc](https://github.com/cner-smith/opengolfapp/commit/387d2bcac5b06289cab0f98fc8bf47b33f2e035b))
* **mobile:** convert two dropped function-styles to PressableTouch ([#655](https://github.com/cner-smith/opengolfapp/issues/655)) ([#745](https://github.com/cner-smith/opengolfapp/issues/745)) ([29c9f62](https://github.com/cner-smith/opengolfapp/commit/29c9f6216ff8900d0e5c2dc8584a0d110d88d9d5))
* **mobile:** Shot Patterns lie-slope filter is two-axis multi-select ([#746](https://github.com/cner-smith/opengolfapp/issues/746)) ([#748](https://github.com/cner-smith/opengolfapp/issues/748)) ([6b9a774](https://github.com/cner-smith/opengolfapp/commit/6b9a774e17ae84a263132de7d4f17bf0e767042d))
* **mobile:** shot-pattern slope filter falls back to legacy lie_slope ([#779](https://github.com/cner-smith/opengolfapp/issues/779)) ([4708d9b](https://github.com/cner-smith/opengolfapp/commit/4708d9bdba7774c5f5451d058bac435492836fb0))
* **mobile:** ShotLogger re-seeds lie from initial on open ([#654](https://github.com/cner-smith/opengolfapp/issues/654)) ([#744](https://github.com/cner-smith/opengolfapp/issues/744)) ([642032b](https://github.com/cner-smith/opengolfapp/commit/642032ba3c91b33d7d81edd286b0492d27910ab3))
* **mobile:** surface web-dashboard CTA on Android profile + expand/raise stats rider ([#781](https://github.com/cner-smith/opengolfapp/issues/781)) ([645f2a0](https://github.com/cner-smith/opengolfapp/commit/645f2a0b35fb0c5206d9ea1c270e249dda059014))
* **web:** infer hole count from hole_scores when no course_tees row ([#727](https://github.com/cner-smith/opengolfapp/issues/727)) ([#783](https://github.com/cner-smith/opengolfapp/issues/783)) ([7f5a68f](https://github.com/cner-smith/opengolfapp/commit/7f5a68feffa0d2fef284088da58dec814ca5fafb))
* **web:** putt-entry data integrity — clear putt columns on non-putt save; snapshot putt distance on open ([#782](https://github.com/cner-smith/opengolfapp/issues/782)) ([c06864e](https://github.com/cner-smith/opengolfapp/commit/c06864e669314ed90986085a97d74b99278be6e8))
* **web:** revert [#727](https://github.com/cner-smith/opengolfapp/issues/727) hole-count inference — it collapsed 18-hole rounds to 9 ([#786](https://github.com/cner-smith/opengolfapp/issues/786)) ([3844dc5](https://github.com/cner-smith/opengolfapp/commit/3844dc58859c05ffce56c550780185f6449ab708))
* **web:** scroll to top on navigation ([#787](https://github.com/cner-smith/opengolfapp/issues/787)) ([fec85f8](https://github.com/cner-smith/opengolfapp/commit/fec85f89d30ccc891a755a8356b3637b6bc93e0d))


### Chores

* **learn:** drop inaccurate 'Made famous by' lines for Stinger + DOD ([#749](https://github.com/cner-smith/opengolfapp/issues/749)) ([acd4325](https://github.com/cner-smith/opengolfapp/commit/acd43252b39f2adf813d4d67ba3f5c496c6786b3))
* **mobile:** remove dead ScorecardPreview component ([#742](https://github.com/cner-smith/opengolfapp/issues/742)) ([a8cf2ef](https://github.com/cner-smith/opengolfapp/commit/a8cf2efb1e90c5298553f7c13cf008f5419c1a52))
* **web:** hide Planner from nav until redesign ([#785](https://github.com/cner-smith/opengolfapp/issues/785)) ([175c313](https://github.com/cner-smith/opengolfapp/commit/175c313c344b4a0972ad3df078486b6f27219939))

## [1.1.1](https://github.com/cner-smith/opengolfapp/compare/v1.1.0...v1.1.1) (2026-07-08)


### Bug Fixes

* **mobile:** bump version to 1.0.1 for App Store resubmission ([e6639a1](https://github.com/cner-smith/opengolfapp/commit/e6639a190974b66b54379d49c416b8c3540b4f4c))
* **mobile:** bump version to 1.0.1 for App Store resubmission ([1763f1f](https://github.com/cner-smith/opengolfapp/commit/1763f1fe4a8315213ef14baacd4413a7b5ee79f0))
* **mobile:** round-detail delete no longer wedges on 'Deleting…' ([#702](https://github.com/cner-smith/opengolfapp/issues/702)) ([517df3a](https://github.com/cner-smith/opengolfapp/commit/517df3ae18e58a19850ae342e888a6fbefe0bfcb)), closes [#701](https://github.com/cner-smith/opengolfapp/issues/701)
* **mobile:** use appVersion runtimeVersion policy, not fingerprint ([#695](https://github.com/cner-smith/opengolfapp/issues/695)) ([daf8d2f](https://github.com/cner-smith/opengolfapp/commit/daf8d2f54e79ccea7de66c849e37117a4d723a0c))


### Chores

* sync main→dev (v1.0.1 version bump) ([e7e46d6](https://github.com/cner-smith/opengolfapp/commit/e7e46d67510669202489388da4cde2e46c0850fc))

## [1.1.0](https://github.com/cner-smith/opengolfapp/compare/v1.0.2...v1.1.0) (2026-07-07)


### Features

* **mobile:** Learn access point in the Practice header ([#524](https://github.com/cner-smith/opengolfapp/issues/524)) ([#688](https://github.com/cner-smith/opengolfapp/issues/688)) ([367a21b](https://github.com/cner-smith/opengolfapp/commit/367a21bb611c2e58839ea394d6d8da1e46aa314a))
* **mobile:** swipe-down-to-dismiss for live-round bottom sheets ([#646](https://github.com/cner-smith/opengolfapp/issues/646)) ([60c3160](https://github.com/cner-smith/opengolfapp/commit/60c316095eb58714dd38e6aba99a54c95e19bdb7))


### Bug Fixes

* **core:** stats correctness — SG inflation, GIR inference, mobile handicap baseline ([#668](https://github.com/cner-smith/opengolfapp/issues/668), [#669](https://github.com/cner-smith/opengolfapp/issues/669), [#673](https://github.com/cner-smith/opengolfapp/issues/673)) ([#680](https://github.com/cner-smith/opengolfapp/issues/680)) ([130f3d0](https://github.com/cner-smith/opengolfapp/commit/130f3d037414b611b63d036f1d650249c87f2d28))
* **mobile:** harden shot sync queue + completeRound sync race ([#651](https://github.com/cner-smith/opengolfapp/issues/651), [#652](https://github.com/cner-smith/opengolfapp/issues/652)) ([#681](https://github.com/cner-smith/opengolfapp/issues/681)) ([62f54c5](https://github.com/cner-smith/opengolfapp/commit/62f54c56814f53f0befd83008b292cad6624b3b9))
* **mobile:** live-round camera — past-round up-the-hole orientation + greenside PLACE_BALL zoom ([#686](https://github.com/cner-smith/opengolfapp/issues/686)) ([e342ea3](https://github.com/cner-smith/opengolfapp/commit/e342ea3226560a97d7a31a78150fc082dd641fa0))
* **mobile:** live-round data-loss traps — 9-hole phantom resume + load-error delete ([#650](https://github.com/cner-smith/opengolfapp/issues/650), [#653](https://github.com/cner-smith/opengolfapp/issues/653)) ([#682](https://github.com/cner-smith/opengolfapp/issues/682)) ([793b3aa](https://github.com/cner-smith/opengolfapp/commit/793b3aad8e08248e604a310a5c66962801793bb0))
* **mobile:** review polish — Learn chip hitSlop + PastRoundMap OKC guard ([#693](https://github.com/cner-smith/opengolfapp/issues/693)) ([e89e3fe](https://github.com/cner-smith/opengolfapp/commit/e89e3fe99ad37f366a025606f7cd9a8fe10e6a10))
* **mobile:** swipe-dismissed sheets reopen off-screen ([#644](https://github.com/cner-smith/opengolfapp/issues/644) residual) ([#687](https://github.com/cner-smith/opengolfapp/issues/687)) ([3e836d8](https://github.com/cner-smith/opengolfapp/commit/3e836d819783a04ab4a66b9ce9c043c65533041d))
* **web:** bump shot_number guard only after a successful insert ([#690](https://github.com/cner-smith/opengolfapp/issues/690)) ([1716d3e](https://github.com/cner-smith/opengolfapp/commit/1716d3e7a5efa39028b7e9ba2a16efa02594e3bf))
* **web:** save-path data-integrity cluster ([#660](https://github.com/cner-smith/opengolfapp/issues/660), [#662](https://github.com/cner-smith/opengolfapp/issues/662), [#664](https://github.com/cner-smith/opengolfapp/issues/664), [#661](https://github.com/cner-smith/opengolfapp/issues/661)) ([#683](https://github.com/cner-smith/opengolfapp/issues/683)) ([9f619bc](https://github.com/cner-smith/opengolfapp/commit/9f619bc584031dbc824a010ddb75efebc3850ac1))


### Chores

* CI web-build job + audit doc/hygiene corrections ([#674](https://github.com/cner-smith/opengolfapp/issues/674), [#675](https://github.com/cner-smith/opengolfapp/issues/675), [#676](https://github.com/cner-smith/opengolfapp/issues/676)) ([#684](https://github.com/cner-smith/opengolfapp/issues/684)) ([8cc8c97](https://github.com/cner-smith/opengolfapp/commit/8cc8c97101d1f9cb175a95f8936efae644b5a656))
* **mobile:** set up EAS Update (OTA) for review-free JS shipping ([#689](https://github.com/cner-smith/opengolfapp/issues/689)) ([fc180f8](https://github.com/cner-smith/opengolfapp/commit/fc180f8ff26632fad2e78c420af8b40d8d3ee23c))

## [1.0.2](https://github.com/cner-smith/opengolfapp/compare/v1.0.1...v1.0.2) (2026-07-02)


### Bug Fixes

* **mobile:** remove iOS donation CTAs (App Review 3.1.1) ([#634](https://github.com/cner-smith/opengolfapp/issues/634)) ([2d418f9](https://github.com/cner-smith/opengolfapp/commit/2d418f9e911de93d132ebffba2b317e86a519b1d))

## [1.0.1](https://github.com/cner-smith/opengolfapp/compare/v1.0.0...v1.0.1) (2026-06-29)


### Bug Fixes

* **web:** add no-app account-deletion path for Play deletion URL ([#625](https://github.com/cner-smith/opengolfapp/issues/625)) ([7c2d9cb](https://github.com/cner-smith/opengolfapp/commit/7c2d9cb9d1ea92610b8b2c355836626ffa17d302))
* **web:** sanitize Turnstile site key in captcha WebView page ([#630](https://github.com/cner-smith/opengolfapp/issues/630)) ([c000807](https://github.com/cner-smith/opengolfapp/commit/c0008071c21ee79107e1aba37069622987e66444))


### Chores

* **eas:** pin Xcode 26 image for iOS production builds ([#628](https://github.com/cner-smith/opengolfapp/issues/628)) ([b25bbe8](https://github.com/cner-smith/opengolfapp/commit/b25bbe8064f06c2b7aa1dc3eda726c7448dfae93))
* sync main → dev (v1.0.0 release commits) ([995b9c3](https://github.com/cner-smith/opengolfapp/commit/995b9c31dbeb99ba86f72bb36ce23236a171b1c5))

## [1.0.0](https://github.com/cner-smith/opengolfapp/compare/v0.9.0...v1.0.0) (2026-06-28)


### Features

* **mobile:** FIR/GIR check marks on the past-round scorecard ([#591](https://github.com/cner-smith/opengolfapp/issues/591)) ([#595](https://github.com/cner-smith/opengolfapp/issues/595)) ([ff9a05b](https://github.com/cner-smith/opengolfapp/commit/ff9a05b2bf82ed9ae3f2ed1faca3e723045ef045))
* **mobile:** past-round map → review stepper + edit-this-shot ([#593](https://github.com/cner-smith/opengolfapp/issues/593)) ([#596](https://github.com/cner-smith/opengolfapp/issues/596)) ([fcca295](https://github.com/cner-smith/opengolfapp/commit/fcca295eb04dff03aede9a7ea2e8796d5266d585))
* **mobile:** per-club distance stats (max/min/avg total) on Stats + Patterns ([#604](https://github.com/cner-smith/opengolfapp/issues/604)) ([e9fe720](https://github.com/cner-smith/opengolfapp/commit/e9fe720b2029e32cd449493ad933d5578e67ced5))
* **practice:** sort, paginate, and grid the drill library ([#571](https://github.com/cner-smith/opengolfapp/issues/571)) ([b9759fb](https://github.com/cner-smith/opengolfapp/commit/b9759fb9b43757096a74f6870d1060e23f1ec230))
* **share:** show played-tee yardage + rating/slope on scorecard cards ([#568](https://github.com/cner-smith/opengolfapp/issues/568)) ([3875bb0](https://github.com/cner-smith/opengolfapp/commit/3875bb040ebc4c5e4c7bc783b1959c31823a53a7)), closes [#562](https://github.com/cner-smith/opengolfapp/issues/562)
* **web:** club distances section on Stats (parity with mobile) ([#616](https://github.com/cner-smith/opengolfapp/issues/616)) ([71df4ee](https://github.com/cner-smith/opengolfapp/commit/71df4ee0722dec70d400f0becc64b2febdf8e3b2))
* **web:** two-axis putt break with line derived from aim ([#402](https://github.com/cner-smith/opengolfapp/issues/402) + parity) ([#585](https://github.com/cner-smith/opengolfapp/issues/585)) ([4c21fae](https://github.com/cner-smith/opengolfapp/commit/4c21fae2401959d7407c8b5ac97331c3c500964d))


### Bug Fixes

* **attribution:** credit GolfCourseAPI + OpenStreetMap (ODbL) alongside OpenGolfAPI ([#605](https://github.com/cner-smith/opengolfapp/issues/605)) ([c2558e8](https://github.com/cner-smith/opengolfapp/commit/c2558e8702a27ded62d691fe7cbfebdee43d74e2))
* **backfill-ratings:** pace under rate limit + resume cursor + quota breaker ([#588](https://github.com/cner-smith/opengolfapp/issues/588)) ([111b391](https://github.com/cner-smith/opengolfapp/commit/111b391dabc941080ac6bd0e73ceca6aaf5e6240))
* **home:** capitalize the bright-spot category in the round insight ([#580](https://github.com/cner-smith/opengolfapp/issues/580)) ([fb2e4da](https://github.com/cner-smith/opengolfapp/commit/fb2e4daa046d8d2a455044a3b364f22adbdceb42)), closes [#578](https://github.com/cner-smith/opengolfapp/issues/578)
* **learn:** center the Learn content column ([#557](https://github.com/cner-smith/opengolfapp/issues/557)) ([7f8346f](https://github.com/cner-smith/opengolfapp/commit/7f8346f28d6d1b2d36dba05b65546651888a9ac0))
* **learn:** redraw swing-plane figure with believable angles ([#569](https://github.com/cner-smith/opengolfapp/issues/569)) ([d4cbbe0](https://github.com/cner-smith/opengolfapp/commit/d4cbbe07f764de70d4c39245731b8ca28f100327)), closes [#558](https://github.com/cner-smith/opengolfapp/issues/558)
* **live-round:** free the aim handle near the green by hiding overlapping distance labels ([#587](https://github.com/cner-smith/opengolfapp/issues/587)) ([8980f81](https://github.com/cner-smith/opengolfapp/commit/8980f819e1652e69809978a90913a34c1f8f38be)), closes [#473](https://github.com/cner-smith/opengolfapp/issues/473)
* **live-round:** make it clear the place-ball CTA marks the ball at your GPS ([#586](https://github.com/cner-smith/opengolfapp/issues/586)) ([c02b3e9](https://github.com/cner-smith/opengolfapp/commit/c02b3e91c47e62994d7512480bf964b52083de6c)), closes [#483](https://github.com/cner-smith/opengolfapp/issues/483)
* **mobile:** completed_at is the round lifecycle flag (review follow-up to [#589](https://github.com/cner-smith/opengolfapp/issues/589)) ([#590](https://github.com/cner-smith/opengolfapp/issues/590)) ([0d85282](https://github.com/cner-smith/opengolfapp/commit/0d852820410d15fa013aea919b08f9cd507fdc4d))
* **mobile:** deleting an active round no longer bricks round viewing ([#608](https://github.com/cner-smith/opengolfapp/issues/608)) ([fbbae9f](https://github.com/cner-smith/opengolfapp/commit/fbbae9fd3bab46589034e2c56b3b42b376e696e0))
* **mobile:** device-QA batch — past-round routing, live tee, home tile ([#589](https://github.com/cner-smith/opengolfapp/issues/589)) ([14684fb](https://github.com/cner-smith/opengolfapp/commit/14684fb0dc2ab97134b1c325cb145e4b58f083be))
* **mobile:** link Today's-Focus drill chips to Practice + label them ([#592](https://github.com/cner-smith/opengolfapp/issues/592)) ([#594](https://github.com/cner-smith/opengolfapp/issues/594)) ([f18fe32](https://github.com/cner-smith/opengolfapp/commit/f18fe3252fec8b4bad224f93fb7eff976e46d8b2))
* **mobile:** live-round revisited holes show shot breadcrumb + explicit 'Add a shot' ([#484](https://github.com/cner-smith/opengolfapp/issues/484)) ([#610](https://github.com/cner-smith/opengolfapp/issues/610)) ([69c9016](https://github.com/cner-smith/opengolfapp/commit/69c9016d0cac16871477ccfa4fdff1974163c1b1))
* **mobile:** on-map tee box always derives from the first shot, not stored coords ([#609](https://github.com/cner-smith/opengolfapp/issues/609)) ([b316ec5](https://github.com/cner-smith/opengolfapp/commit/b316ec536cbb3757a9a83ba36105afee638926a0))
* **mobile:** prompt for a pin on synthetic-course holes ([#614](https://github.com/cner-smith/opengolfapp/issues/614)) ([611064d](https://github.com/cner-smith/opengolfapp/commit/611064dbb7bdf75f53be45545c3e8b9c47b33453))
* **mobile:** resolve Fraunces italic on Android app-wide ([#615](https://github.com/cner-smith/opengolfapp/issues/615)) ([a3e133e](https://github.com/cner-smith/opengolfapp/commit/a3e133e41beaaf6559f14952af0819588009ad81))
* **mobile:** unbreak Android entrance animations + SG-trend Y-axis labels ([#603](https://github.com/cner-smith/opengolfapp/issues/603)) ([a769e0f](https://github.com/cner-smith/opengolfapp/commit/a769e0f0b41fb1d3e0ef229e88edf259dfb6d3cc))
* **mobile:** widen scorecard FIR/GIR columns + fix splash brand font ([#607](https://github.com/cner-smith/opengolfapp/issues/607)) ([3ee8921](https://github.com/cner-smith/opengolfapp/commit/3ee892193455c3f04a04c67becda9b7b7ff848a1))
* **patterns:** drop putter from the Shot Patterns club picker ([#583](https://github.com/cner-smith/opengolfapp/issues/583)) ([cb74bce](https://github.com/cner-smith/opengolfapp/commit/cb74bcef08428e2a5c2bd025021bc4f0cc430618))
* **practice-plan:** frame focus areas by SG sign, not always 'weakness' ([#581](https://github.com/cner-smith/opengolfapp/issues/581)) ([460d419](https://github.com/cner-smith/opengolfapp/commit/460d419676c950452c776b94d6f042d4742f6e89)), closes [#573](https://github.com/cner-smith/opengolfapp/issues/573)
* **practice-plan:** reword repair guidance 'weaknesses' -&gt; 'focus areas' ([#584](https://github.com/cner-smith/opengolfapp/issues/584)) ([4ab5502](https://github.com/cner-smith/opengolfapp/commit/4ab5502256fa12278ec745b699c9f84584d7e142)), closes [#573](https://github.com/cner-smith/opengolfapp/issues/573)
* **putt:** derive break direction from aim, drop the Break (line) chips ([#582](https://github.com/cner-smith/opengolfapp/issues/582)) ([68dd8f9](https://github.com/cner-smith/opengolfapp/commit/68dd8f9120236cfbbb27cf3195bb1a9f98b5734f)), closes [#576](https://github.com/cner-smith/opengolfapp/issues/576)
* **round-map:** mirror mobile tee box on web (two dots from first shot) ([#567](https://github.com/cner-smith/opengolfapp/issues/567)) ([fefcb5c](https://github.com/cner-smith/opengolfapp/commit/fefcb5c40db77fc453aaf7a4d509106b4a630a45))
* **round:** relabel post-round practice CTA to a Practice pointer ([#566](https://github.com/cner-smith/opengolfapp/issues/566)) ([1155def](https://github.com/cner-smith/opengolfapp/commit/1155def36a320765ea87c5370cb21d6cf6e96624))
* **share:** correct wordmark + URL on share cards ([#556](https://github.com/cner-smith/opengolfapp/issues/556)) ([a30830e](https://github.com/cner-smith/opengolfapp/commit/a30830eca95e51de9a53ae4e5cad90d23cea379d))
* **stats:** exclude putts from club accuracy ([#579](https://github.com/cner-smith/opengolfapp/issues/579)) ([f055e58](https://github.com/cner-smith/opengolfapp/commit/f055e58bc06eaaf2ce29306047300f08162ca81b)), closes [#574](https://github.com/cner-smith/opengolfapp/issues/574)
* **web:** sidebar uses the oga. brandmark, not uppercase OGA ([#617](https://github.com/cner-smith/opengolfapp/issues/617)) ([863a40e](https://github.com/cner-smith/opengolfapp/commit/863a40ed70803964d071594cd2dbc5e57e208cc7))


### Performance

* **mobile:** render-side + query-payload optimizations (safe pass) ([#602](https://github.com/cner-smith/opengolfapp/issues/602)) ([0cdb251](https://github.com/cner-smith/opengolfapp/commit/0cdb25131bbbdba5cae6089f4f71c593ce87b9e2))


### Chores

* **db:** prune 24 legacy pre-v2 drills (source NULL) ([#570](https://github.com/cner-smith/opengolfapp/issues/570)) ([9362fe6](https://github.com/cner-smith/opengolfapp/commit/9362fe6788984b0851b47ac68c20da96ea602a64))
* release v1.0.0 ([6f8ed7b](https://github.com/cner-smith/opengolfapp/commit/6f8ed7bde363dd4c35204905a89598010e77a337))
* release v1.0.0 ([389a25c](https://github.com/cner-smith/opengolfapp/commit/389a25c75a48a7f8fa4dcf21b1ec2d8fc07cbcd1))

## [0.9.0](https://github.com/cner-smith/opengolfapp/compare/v0.8.0...v0.9.0) (2026-06-11)


### Features

* call out the standout SG category on stats pages ([#522](https://github.com/cner-smith/opengolfapp/issues/522)) ([#537](https://github.com/cner-smith/opengolfapp/issues/537)) ([860d8d3](https://github.com/cner-smith/opengolfapp/commit/860d8d30c14c0c43ac3703a46259eab5ce9ca8e2))
* label handicap provenance — calculated vs entered ([#521](https://github.com/cner-smith/opengolfapp/issues/521)) ([#536](https://github.com/cner-smith/opengolfapp/issues/536)) ([b55f044](https://github.com/cner-smith/opengolfapp/commit/b55f04473a649aef2b73aef9a4cfc46790bfd3a0))
* **mobile:** editable scorecard-first past-round logger ([#514](https://github.com/cner-smith/opengolfapp/issues/514)) ([#517](https://github.com/cner-smith/opengolfapp/issues/517)) ([888b621](https://github.com/cner-smith/opengolfapp/commit/888b621abf2fd8f4ea8663601dfeb0233f630f93))
* **mobile:** handicap differential + index recompute (rated tees) ([#538](https://github.com/cner-smith/opengolfapp/issues/538)) ([41a654d](https://github.com/cner-smith/opengolfapp/commit/41a654d16183867ed265a679da5863346554bf9f))
* **mobile:** Practice tab — plan generator + view ([#511](https://github.com/cner-smith/opengolfapp/issues/511)) [WIP] ([#519](https://github.com/cner-smith/opengolfapp/issues/519)) ([42be229](https://github.com/cner-smith/opengolfapp/commit/42be229b5988a2869bfb33586e9325ad4701d7e6))
* **mobile:** signal Learn is a browsable library ([#524](https://github.com/cner-smith/opengolfapp/issues/524)) ([#535](https://github.com/cner-smith/opengolfapp/issues/535)) ([74a677c](https://github.com/cner-smith/opengolfapp/commit/74a677c1a3de295003a27501e257118527c93629))
* **mobile:** tee selection at round creation ([#542](https://github.com/cner-smith/opengolfapp/issues/542)) ([#543](https://github.com/cner-smith/opengolfapp/issues/543)) ([96c641a](https://github.com/cner-smith/opengolfapp/commit/96c641a1f491276c9844f9ed976d39aa4af1f073))
* **web:** landing v2 — editorial sections, live-mode hero, realish seed ([#529](https://github.com/cner-smith/opengolfapp/issues/529)) ([61b5a6c](https://github.com/cner-smith/opengolfapp/commit/61b5a6cfa10e3d4f70ae332f41f8f5bd9c71f9b5))


### Bug Fixes

* **db:** targeted course dedup migration ([#470](https://github.com/cner-smith/opengolfapp/issues/470)) ([#527](https://github.com/cner-smith/opengolfapp/issues/527)) ([1dc5258](https://github.com/cner-smith/opengolfapp/commit/1dc52581d797b9f4141dd98e8c2a7495c17540b3))
* **db:** tighten course_tees INSERT policy + add created_by ([#222](https://github.com/cner-smith/opengolfapp/issues/222)) ([#518](https://github.com/cner-smith/opengolfapp/issues/518)) ([0d8a4a9](https://github.com/cner-smith/opengolfapp/commit/0d8a4a9b83a774046ecf56b98eb611753ddb0be2))
* **mobile:** allow about:blank/about:srcdoc so iOS Turnstile loads ([#405](https://github.com/cner-smith/opengolfapp/issues/405)) ([#512](https://github.com/cner-smith/opengolfapp/issues/512)) ([b114e77](https://github.com/cner-smith/opengolfapp/commit/b114e770674a2e7cc84cfe5e70f8c6688521a4e2))
* **mobile:** bound My Bag list height so footer is reachable ([#528](https://github.com/cner-smith/opengolfapp/issues/528)) ([#541](https://github.com/cner-smith/opengolfapp/issues/541)) ([1d45bce](https://github.com/cner-smith/opengolfapp/commit/1d45bcea041b12238cb2fde18280d195327e89bb))
* **mobile:** deep-link email confirmation back into the app ([#510](https://github.com/cner-smith/opengolfapp/issues/510)) ([f6e6941](https://github.com/cner-smith/opengolfapp/commit/f6e6941a0ba8a118e59ee4afd45820d75769ea69))
* **mobile:** My Bag respects bottom safe-area inset ([#528](https://github.com/cner-smith/opengolfapp/issues/528)) ([#534](https://github.com/cner-smith/opengolfapp/issues/534)) ([5351d9e](https://github.com/cner-smith/opengolfapp/commit/5351d9eae1f3950d6f017fdbeed6e4fa6ec27ffe))
* **mobile:** on-device Android QA batch — practice, stats, splash, course search ([#544](https://github.com/cner-smith/opengolfapp/issues/544)) ([e572c2a](https://github.com/cner-smith/opengolfapp/commit/e572c2aaa5a3ad65d54df7f486dd76c4a147ab3d))
* **mobile:** partial-course holes can't log shots ([#525](https://github.com/cner-smith/opengolfapp/issues/525)) ([#533](https://github.com/cner-smith/opengolfapp/issues/533)) ([765d814](https://github.com/cner-smith/opengolfapp/commit/765d814d1d7bdb3f978270a2331bc89f26a28fbd))
* **mobile:** show in-progress rounds in Home + All Rounds lists ([#515](https://github.com/cner-smith/opengolfapp/issues/515)) ([d0afe6f](https://github.com/cner-smith/opengolfapp/commit/d0afe6f592158ee8212f8763856c9580e155cb2e))


### Chores

* **mobile:** Expo SDK 52 migration (RN 0.76 / React 18.3) ([#516](https://github.com/cner-smith/opengolfapp/issues/516)) ([6a376d0](https://github.com/cner-smith/opengolfapp/commit/6a376d063b228b27b20a49f97978ac43b16ec9ef))
* **mobile:** Expo SDK 52→53 — Android 16 KB compliance ([#467](https://github.com/cner-smith/opengolfapp/issues/467) Phase 2) ([#530](https://github.com/cner-smith/opengolfapp/issues/530)) ([9d5bd84](https://github.com/cner-smith/opengolfapp/commit/9d5bd845e27836190e7f588089b0f336822e542f))
* **mobile:** lock to iPhone-only for v1 (supportsTablet: false) ([#532](https://github.com/cner-smith/opengolfapp/issues/532)) ([efee418](https://github.com/cner-smith/opengolfapp/commit/efee4180acac74f32ffb8a67afa1def5e320ace1))
* **release:** bump version to 0.9.0 ([#551](https://github.com/cner-smith/opengolfapp/issues/551)) ([224a6ae](https://github.com/cner-smith/opengolfapp/commit/224a6ae6032c98f47e06a7e2ca6b107cd6a38b03))
* **scripts:** course rating/slope backfill from GolfCourseAPI ([#539](https://github.com/cner-smith/opengolfapp/issues/539)) ([4b6a546](https://github.com/cner-smith/opengolfapp/commit/4b6a5467c9c1fa7722292a1332de362ae583ba9d))
* **scripts:** seed demo account on real courses ([#549](https://github.com/cner-smith/opengolfapp/issues/549)) ([b154850](https://github.com/cner-smith/opengolfapp/commit/b1548507eb9791006f8e83c00ca1dfcd28ef96af))
* **seed:** realistic per-club dispersion for demo data ([#531](https://github.com/cner-smith/opengolfapp/issues/531)) ([50416ed](https://github.com/cner-smith/opengolfapp/commit/50416ed3d5d26ca4c75273511af2a86e5e00c321))

## [0.8.0](https://github.com/cner-smith/opengolfapp/compare/v0.7.0...v0.8.0) (2026-06-03)


### Features

* **brand:** app icon, adaptive icon, splash + web favicon (Direction A "o.") ([148eabb](https://github.com/cner-smith/opengolfapp/commit/148eabb666d2a4d2f4386582ea9ed83ea6772496))
* **brand:** app icon, adaptive icon, splash + web favicon (Direction A "o.") ([3fa4b5b](https://github.com/cner-smith/opengolfapp/commit/3fa4b5b9a40bc4898d0ad7f4c4600535670a057f))
* **core:** aim-relative dispersion + arc geo for shot-pattern map ([af4f29b](https://github.com/cner-smith/opengolfapp/commit/af4f29b5f307bee454440a312c5a7ade74483380))
* **crawler:** --max-courses budget for enrich + daily cron wrapper ([c254267](https://github.com/cner-smith/opengolfapp/commit/c25426713466276b7e4c6a897216519499f96604))
* **crawler:** extract OSM hole/tee/green geometry into holes ([0ab2c43](https://github.com/cner-smith/opengolfapp/commit/0ab2c43fffa4e121908c9efab2b0ec6fed5702aa))
* **crawler:** OSM hole-geometry extraction + enrich daily-budget cron ([428fcce](https://github.com/cner-smith/opengolfapp/commit/428fcce3bc8b2eb307ff6adc1a7277c16dad3369))
* **mobile:** 'From the yardage book' preview on Home ([8c453bc](https://github.com/cner-smith/opengolfapp/commit/8c453bc894f215cae22f07fa3b5e14ed0b781906))
* **mobile:** 'From the yardage book' preview on Home ([467d57d](https://github.com/cner-smith/opengolfapp/commit/467d57d190af02c91e4749b7bee304dcf9d9232d))
* **mobile:** aim-line dotted reference = aim direction to infinity ([0f6c00e](https://github.com/cner-smith/opengolfapp/commit/0f6c00e7cc70bd5b04670baef3ad39e9b6ce73bc))
* **mobile:** in-app account deletion ([#306](https://github.com/cner-smith/opengolfapp/issues/306), [#314](https://github.com/cner-smith/opengolfapp/issues/314)) ([5d918d1](https://github.com/cner-smith/opengolfapp/commit/5d918d103d60ee7b7045e28fe7451e074a3e0a2b))
* **mobile:** in-app account deletion ([#306](https://github.com/cner-smith/opengolfapp/issues/306), [#314](https://github.com/cner-smith/opengolfapp/issues/314)) ([0eb2152](https://github.com/cner-smith/opengolfapp/commit/0eb21527e8e9a4229b4231febc7ffaa31c7220d2))
* **mobile:** Learn parity — port all 20 articles to native ([418f92d](https://github.com/cner-smith/opengolfapp/commit/418f92d02f67241ff3f780e6a0c3c0c18f62f1a7))
* **mobile:** live-round aim-line UX — auto-spawn, bend, crosshair, remaining ([011c852](https://github.com/cner-smith/opengolfapp/commit/011c8523b5969b862823732d93e30929504de108))
* **mobile:** live-round dispersion arc overlay ([de14c97](https://github.com/cner-smith/opengolfapp/commit/de14c9766fdcc4ad429f7bec3dbe51444c4d902b))
* **mobile:** live-round HUD + best-case live SG + pin-first ([8276f6d](https://github.com/cner-smith/opengolfapp/commit/8276f6dbae23b64915656771e6c33817f4fc1715))
* **mobile:** port remaining 13 Learn articles to native ([575d256](https://github.com/cner-smith/opengolfapp/commit/575d25651b1277cb42e1004fcacce3e059269736))
* **mobile:** shot-pattern overlay — left toolbar, Tee/Appr rail, fixed-geometry arc/circle/dots, floating chrome ([7915818](https://github.com/cner-smith/opengolfapp/commit/7915818b2f5dd23079c39168a85de38676f9d8b9))
* **mobile:** two-phase type-to-confirm for account deletion ([034ab77](https://github.com/cner-smith/opengolfapp/commit/034ab772e57d4a8d1269487c7d4aaccd21cc11bc))
* **mobile:** Warm Editorial fonts app-wide + Learn article extraction ([c15106d](https://github.com/cner-smith/opengolfapp/commit/c15106d5bf77b82568cc6f9227946de3b7420dea))
* **mobile:** wire Learn article primitives to Warm Editorial fonts ([d474532](https://github.com/cner-smith/opengolfapp/commit/d4745323a80c1d0a61fb6272ac706c6b89e74d4c))
* Shot-pattern live-round map — mobile redesign + web parity ([#471](https://github.com/cner-smith/opengolfapp/issues/471)) ([71c6e25](https://github.com/cner-smith/opengolfapp/commit/71c6e2532b5ccf0758ba3c59bdcc6263d98ced22))
* **supabase:** getShotsForUser query for the live-map overlay ([175de45](https://github.com/cner-smith/opengolfapp/commit/175de4550353a893c1aeab96ea21908a795197ab))
* **web:** shot-pattern aim-line parity — live auto-spawn + draggable aim + upgraded visuals ([#471](https://github.com/cner-smith/opengolfapp/issues/471)) ([6013d6e](https://github.com/cner-smith/opengolfapp/commit/6013d6eecd7e28b9f53a611f43f9d85b43dcfb98))
* **web:** shot-pattern Phase B — Tee/Appr overlay + distance rail ([#471](https://github.com/cner-smith/opengolfapp/issues/471)) ([b570454](https://github.com/cner-smith/opengolfapp/commit/b5704542c234e78a62a30d14687a309572fb2462))
* **web:** shot-pattern Phase C — dispersion-dots overlay ([#471](https://github.com/cner-smith/opengolfapp/issues/471)) ([6a63a62](https://github.com/cner-smith/opengolfapp/commit/6a63a6214f67d5c7fba00bd58b3e4a8b5bfd0179))
* **web:** shot-pattern Phase D — live expected-strokes + best-case SG HUD ([#471](https://github.com/cner-smith/opengolfapp/issues/471)) ([224f13e](https://github.com/cner-smith/opengolfapp/commit/224f13edbdd56ca990db92b9269632956863bc06))
* **web:** support page at /support ([#311](https://github.com/cner-smith/opengolfapp/issues/311)) ([a0a5d37](https://github.com/cner-smith/opengolfapp/commit/a0a5d37cf8bc9fc841ab146543110b5fb6c30cfd))
* **web:** support page at /support ([#311](https://github.com/cner-smith/opengolfapp/issues/311)) ([f31c542](https://github.com/cner-smith/opengolfapp/commit/f31c542c5b03f85927c662db984ef6e573f67b83))


### Bug Fixes

* **core:** frame Patterns dispersion aim-relative, not compass N/E ([#464](https://github.com/cner-smith/opengolfapp/issues/464)) ([da7cb83](https://github.com/cner-smith/opengolfapp/commit/da7cb833e3d541174dbdd77a631622b4600b892a))
* **core:** frame Patterns dispersion aim-relative, not compass N/E ([#464](https://github.com/cner-smith/opengolfapp/issues/464)) ([dc87ca1](https://github.com/cner-smith/opengolfapp/commit/dc87ca1afbb1d8b22670dd8049d0aa202c2bba1f))
* **db:** quote targets array in 0035 inserts ([c6e7e7a](https://github.com/cner-smith/opengolfapp/commit/c6e7e7a40c17a8946a7cbd490ccbfc42c110f90d))
* **db:** quote targets array in 0035 inserts ([e3c75e3](https://github.com/cner-smith/opengolfapp/commit/e3c75e3fb99c4f066603b23c76482b0af591670a))
* **mobile:** Confirm aim persists the aim (even unadjusted) ([7f8e703](https://github.com/cner-smith/opengolfapp/commit/7f8e70383dcb9a7257051b7ddb5b2fa24c497a5a))
* **mobile:** dial back shot-pattern toolbar/rail size to 52dp (64dp was oversized) ([3cab551](https://github.com/cner-smith/opengolfapp/commit/3cab5518a778cb7f1f94b285737b251843e3a838))
* **mobile:** disable Mapbox scale bar on the live-round map ([61bf629](https://github.com/cner-smith/opengolfapp/commit/61bf62902fda8e25166a175f2809ac99b2ee0d68))
* **mobile:** enlarge aim/ball drag hit target with a translucent grab disc ([b39122f](https://github.com/cner-smith/opengolfapp/commit/b39122f002ce6b7cae2a3c592c6d77cdab91f51e))
* **mobile:** faithfully port strokes-gained + benchmarks, restore mental-game ([589c082](https://github.com/cner-smith/opengolfapp/commit/589c082646d4a93a926f58c9cc89f23b9ea223bc))
* **mobile:** font co-located Text + SVG labels in older Learn articles ([34f2dd6](https://github.com/cner-smith/opengolfapp/commit/34f2dd6fbd425fdc852322f06c14b92f947d88b2))
* **mobile:** font the Learn DraftBanner body text ([b213057](https://github.com/cner-smith/opengolfapp/commit/b213057d664b539a43418d5aa6b248ee011c1784))
* **mobile:** forward hardware-back into the app from the splash ([34d27c0](https://github.com/cner-smith/opengolfapp/commit/34d27c07aa469821513562a4749cf1d5ef4ef7be))
* **mobile:** iOS press feedback via PressableTouch ([#303](https://github.com/cner-smith/opengolfapp/issues/303)) ([a519843](https://github.com/cner-smith/opengolfapp/commit/a519843a2d54718e37c5d33bac258fa41205792f))
* **mobile:** iOS press feedback via PressableTouch ([#303](https://github.com/cner-smith/opengolfapp/issues/303)) ([3d166fd](https://github.com/cner-smith/opengolfapp/commit/3d166fdf019eebcc47f325951c146261bf28cbd6))
* **mobile:** iOS safe-area insets, collapse double modal, gesture root ([fa4b48e](https://github.com/cner-smith/opengolfapp/commit/fa4b48ef0f3448229154caf2a4e7a09e009b4b24))
* **mobile:** iOS safe-area insets, collapse double modal, gesture root ([#494](https://github.com/cner-smith/opengolfapp/issues/494), [#495](https://github.com/cner-smith/opengolfapp/issues/495), [#496](https://github.com/cner-smith/opengolfapp/issues/496)) ([da048cd](https://github.com/cner-smith/opengolfapp/commit/da048cd652fb6a20292e476dd6c89c5a20e75ec6))
* **mobile:** Learn back button returns to the list, not Home ([c3ae59d](https://github.com/cner-smith/opengolfapp/commit/c3ae59d349e1a7c89539033cf96237eb9f93dc9d))
* **mobile:** Learn back button returns to the list, not Home ([f623efd](https://github.com/cner-smith/opengolfapp/commit/f623efd1d34192e38e3e3397f483b50639b60d08))
* **mobile:** live-round aim UX — drag/long-press conflict, no aim prompt, header ⋮ menu ([d3f3cd7](https://github.com/cner-smith/opengolfapp/commit/d3f3cd7200bb909accd67fd2a4fa7713c23301fa))
* **mobile:** live-round map fixes — AimGhosts, first-ball, drag hit target ([9c77c65](https://github.com/cner-smith/opengolfapp/commit/9c77c65667a2e35f0448deaf6488fe120aedaacd))
* **mobile:** live-round state machine — reset per-hole state on switch + keep aim/ball draggable across pin placement ([d83abb5](https://github.com/cner-smith/opengolfapp/commit/d83abb58ef5ae0528a3293bae8e15d7896546440))
* **mobile:** materialize round holes via insert_synthetic_hole RPC ([56145dc](https://github.com/cner-smith/opengolfapp/commit/56145dca163b3fa2c2308611ca8138b1391303c5))
* **mobile:** play the brand splash on every login ([#500](https://github.com/cner-smith/opengolfapp/issues/500)) ([ac5ca28](https://github.com/cner-smith/opengolfapp/commit/ac5ca28f9e65c5d85f5119a92d55fabf34996c96))
* **mobile:** play the brand splash on every login, not just the next cold start ([#500](https://github.com/cner-smith/opengolfapp/issues/500)) ([05170d4](https://github.com/cner-smith/opengolfapp/commit/05170d429bea37d9c154b08a6c806a05ac37465f))
* **mobile:** Re-place ball no longer leaves a duplicate aim point ([4670661](https://github.com/cner-smith/opengolfapp/commit/4670661316a25d2dc7aa38c910b5e2613f393b37))
* **mobile:** release delete modal if signOut errors after account delete ([d44181c](https://github.com/cner-smith/opengolfapp/commit/d44181c3bc8c01047540ab3927b66441b08b5dfb))
* **mobile:** restore AimGhosts on committed shots + seed first ball on tee ([1b51b4c](https://github.com/cner-smith/opengolfapp/commit/1b51b4cda6c021993943b79ff64423a355d5a572))
* **mobile:** shot-pattern live-round QA pass — drag stability, chrome, overlay corrections ([edc34c4](https://github.com/cner-smith/opengolfapp/commit/edc34c4989d6fbcff269d61071d128202783c15a))
* **mobile:** shot-pattern QA round 3 — drag stability, bigger/lower toolbars, pills above line, CTA contrast ([ce3e9b4](https://github.com/cner-smith/opengolfapp/commit/ce3e9b4517b6cde877947d70f7b7f32b125dc700))
* **mobile:** static styles for live-round chrome Pressables ([11373d2](https://github.com/cner-smith/opengolfapp/commit/11373d25dc5c586ba7633f2da8a26b8e04d7f4f9))
* **web,mobile:** always offer 'Add new course' on a non-empty query ([#472](https://github.com/cner-smith/opengolfapp/issues/472)) ([d39795b](https://github.com/cner-smith/opengolfapp/commit/d39795ba4cbb74b2de600011f3a140cb32ee303f))
* **web,mobile:** auto-spawned aim is a visual suggestion — persist only if touched ([7a08a2c](https://github.com/cner-smith/opengolfapp/commit/7a08a2c643c30cb8afadfaa2802aa2879a27cab3))


### Performance

* **mobile:** throttle aim-drag updates to ~25Hz ([cbd1ba4](https://github.com/cner-smith/opengolfapp/commit/cbd1ba44e28f2f1b77a174c206d6d84125fafa80))


### Refactors

* **mobile:** drop unused pressedOpacity prop from PressableTouch ([dee3d07](https://github.com/cner-smith/opengolfapp/commit/dee3d074b392d43912c22673683d47a4f9837915))
* **mobile:** white aim lines + remove the data-driven dispersion arc ([a70d902](https://github.com/cner-smith/opengolfapp/commit/a70d90289709753e3b6edb95a25668f18b993062))
* **web:** stable module-level default for RoundMap selectClub prop ([3776c0a](https://github.com/cner-smith/opengolfapp/commit/3776c0a317d4ac7f27dcb69aa6a405dd860be288))


### Chores

* **crawler:** address review nits ([c04ddc8](https://github.com/cner-smith/opengolfapp/commit/c04ddc86163b5280ee7285b2893c94f4e482cb4f))
* **design:** sync root design tokens to Epilogue/Inconsolata ([0e3d53e](https://github.com/cner-smith/opengolfapp/commit/0e3d53e88f8f1488092c7117a07a3230f8826ded))
* **design:** Warm Editorial type system — Epilogue body + Inconsolata mono ([0778571](https://github.com/cner-smith/opengolfapp/commit/0778571d92355781f36f326aa4909e90d2e56148))
* **design:** Warm Editorial type system — Epilogue body, Inconsolata mono ([cc6063e](https://github.com/cner-smith/opengolfapp/commit/cc6063e5a3230d428f1842c22e10d5d18bcc3cd4))
* **ios:** declare App Privacy Manifest ([#299](https://github.com/cner-smith/opengolfapp/issues/299)) ([ab5c8e6](https://github.com/cner-smith/opengolfapp/commit/ab5c8e675740ac6b4d9b567d4e26c62b91800f97))
* **ios:** declare App Privacy Manifest ([#299](https://github.com/cner-smith/opengolfapp/issues/299)) ([39c15ce](https://github.com/cner-smith/opengolfapp/commit/39c15ce781ed9702aa40690000757eb770f42a5f))
* **ios:** remove unused Always location permission + refine usage string ([#301](https://github.com/cner-smith/opengolfapp/issues/301)) ([55c47cb](https://github.com/cner-smith/opengolfapp/commit/55c47cbc5e767734bdeca78ca66d63698e798d8e))
* **ios:** remove unused Always location permission + refine usage string ([#301](https://github.com/cner-smith/opengolfapp/issues/301)) ([9e71eed](https://github.com/cner-smith/opengolfapp/commit/9e71eed69aca471b5d44d1187364e362ed5e2af6))
* **ios:** trim mechanistic narration from privacy-manifest comment ([c29380f](https://github.com/cner-smith/opengolfapp/commit/c29380f0145ba039c35c321839aad0c8c2d64ad1))
* **mobile:** trim duplicated AimGhost interface comment ([de48f45](https://github.com/cner-smith/opengolfapp/commit/de48f45c5cab0310076bf29168ed83676c243a41))
* **web:** explain the no-console eslint-disable in useClubDispersion ([28d5ec8](https://github.com/cner-smith/opengolfapp/commit/28d5ec8bd42a6958f83ab688eb257b1ee9978f38))
* **web:** regenerate favicon at 256² for crisp high-DPI tabs ([cce8f73](https://github.com/cner-smith/opengolfapp/commit/cce8f732e152608a4f564c13b671cb5e6b360970))

## [0.7.0](https://github.com/cner-smith/opengolfapp/compare/v0.6.0...v0.7.0) (2026-05-29)


### Features

* AI practice plan engine — Phase B (generate-practice-plan Edge Function) ([b864d56](https://github.com/cner-smith/opengolfapp/commit/b864d561358e991bc592d276b58df38a493997e6))
* **core:** add buildRoundSummary email content builder ([#317](https://github.com/cner-smith/opengolfapp/issues/317)) ([7782d5a](https://github.com/cner-smith/opengolfapp/commit/7782d5ae24a43e81a750a8afd32523276ed7dbb0))
* **core:** AI practice-plan engine helpers (Phase A, [#18](https://github.com/cner-smith/opengolfapp/issues/18)) ([721cfdd](https://github.com/cner-smith/opengolfapp/commit/721cfdda1fbb1c6807a62dff0b77c4fcf32f226e))
* **core:** buildPlanPrompt + plan tool schema ([547407f](https://github.com/cner-smith/opengolfapp/commit/547407f74a53500e48a2c897cc97b78749b36c71))
* **core:** buildPlayerDigest — averages, ranked weaknesses, trend, self-consistency ([b97af49](https://github.com/cner-smith/opengolfapp/commit/b97af49676283905e154ea63abb73bbaf7cdd189))
* **core:** dispersionVerdict — shared share-card verdict helper ([#374](https://github.com/cner-smith/opengolfapp/issues/374)) ([66e5418](https://github.com/cner-smith/opengolfapp/commit/66e5418e9760ff648faf2c24fb7c098bd292d413))
* **core:** dispersionVerdict — shared share-card verdict helper ([#374](https://github.com/cner-smith/opengolfapp/issues/374)) ([17b5557](https://github.com/cner-smith/opengolfapp/commit/17b5557c6e4ba314600bc42e25b3c922af43062a))
* **core:** export practice-plan engine helpers ([9177509](https://github.com/cner-smith/opengolfapp/commit/91775098984812555e76e43a499b3020eb3a9259))
* **core:** export round-nudge ([#18](https://github.com/cner-smith/opengolfapp/issues/18)) ([3793743](https://github.com/cner-smith/opengolfapp/commit/3793743566ee203f8dd186b075ffa2313dbe30bb))
* **core:** pickRoundFocus — worst SG category for the round nudge ([#18](https://github.com/cner-smith/opengolfapp/issues/18)) ([09969f2](https://github.com/cner-smith/opengolfapp/commit/09969f2519607417f4b60858a9ec46d51360ac01))
* **core:** playFrequencyPlan — sessions/week + 7-day window ([fd3288f](https://github.com/cner-smith/opengolfapp/commit/fd3288fe61774137c7784127c5bc850cd1a93cb6))
* **core:** practice-plan engine → mode taxonomy + close-on-green ([de51c0d](https://github.com/cner-smith/opengolfapp/commit/de51c0d88d7d191dacafcbdd0c7e97ccbe980811))
* **core:** practice-plan engine speaks the mode taxonomy + closes on the green ([e8a519a](https://github.com/cner-smith/opengolfapp/commit/e8a519ad03b540f9c786423b5deec57738dafc9b))
* **core:** practice-plan engine types ([aa76a94](https://github.com/cner-smith/opengolfapp/commit/aa76a94044ee4c12152c09e0f8a104f4c19a1185))
* **core:** resolvePlanForStorage + article_ref validation ([c67c741](https://github.com/cner-smith/opengolfapp/commit/c67c7410b67c967a2bb25aa5465c16d5a683ec6a))
* **core:** resolveTarget — deterministic target numbers ([5992972](https://github.com/cner-smith/opengolfapp/commit/5992972fa56d39483985cfcbbe0e2c6c11f04df4))
* **core:** roundFocusHeadline for the round nudge ([#18](https://github.com/cner-smith/opengolfapp/issues/18)) ([c998223](https://github.com/cner-smith/opengolfapp/commit/c998223a439622f8fdb983576dd3dc179ecc6a85))
* **core:** sanitizeFeedback — cap + strip untrusted plan feedback ([eabb2f0](https://github.com/cner-smith/opengolfapp/commit/eabb2f0c5eadb6784374662216e40d2216b2efb7))
* **core:** selectBaselinePlan + baseline data shape (seed) ([b87abb0](https://github.com/cner-smith/opengolfapp/commit/b87abb0a3b1140a2f15532ae9934db2098ff961e))
* **core:** selectNudgeDrills — facility filter + cap ([#18](https://github.com/cner-smith/opengolfapp/issues/18)) ([71fb6c9](https://github.com/cner-smith/opengolfapp/commit/71fb6c9a5c976bbdc1d9e473750100a86b9c2cf0))
* **core:** validatePlanDraft — §9 plan-draft validation gate ([5522489](https://github.com/cner-smith/opengolfapp/commit/5522489ced0d106f7fc9c3456384d9596802b328))
* **db:** 0030 drill corpus schema — enrich drills + practice_plans ([#18](https://github.com/cner-smith/opengolfapp/issues/18)) ([b8b465f](https://github.com/cner-smith/opengolfapp/commit/b8b465f2213bb23e42b9714937640144bdd874da))
* **db:** 0031 cadence unique index (TOCTOU guard) ([87e25a2](https://github.com/cner-smith/opengolfapp/commit/87e25a20ee02382ee63882874bb0dfaf0f0331ce))
* **db:** 0032 global plan-count fn (SECURITY DEFINER) ([2f847a2](https://github.com/cner-smith/opengolfapp/commit/2f847a27a1b5a1923bbcaf55035e92efe1de2fc7))
* **db:** add round completion + email-summary columns ([#317](https://github.com/cner-smith/opengolfapp/issues/317)) ([616fd70](https://github.com/cner-smith/opengolfapp/commit/616fd7095c7be9d4fb810ad15b945488392f7a71))
* **db:** drill corpus schema — 0030 ([#18](https://github.com/cner-smith/opengolfapp/issues/18)) ([4d29600](https://github.com/cner-smith/opengolfapp/commit/4d2960063b1fa5515acb6264ef3d93e27f0750f2))
* **db:** drill_type → practice-mode taxonomy (foundation) ([dba13be](https://github.com/cner-smith/opengolfapp/commit/dba13be4a4a323a108adaf6de65d3fc93731d93a))
* **db:** drill_type → practice-mode taxonomy (migration 0033 + seed re-tag) ([c05cdaa](https://github.com/cner-smith/opengolfapp/commit/c05cdaa2f4754de745bbb8b6f568cf123c205ff8))
* **db:** migration 0034 — v2 drill corpus data (85 inserts, 40 → 125) ([aa28451](https://github.com/cner-smith/opengolfapp/commit/aa284514c6e740e2853bea219a0d4e394423505b))
* **db:** migration 0034 — v2 drill corpus data (85 inserts, 40 → 125) ([4ba0904](https://github.com/cner-smith/opengolfapp/commit/4ba0904b2b0c68d6b6c5a79dc476973bbea94532))
* **db:** seed drill corpus v1 — 41 sourced drills ([#18](https://github.com/cner-smith/opengolfapp/issues/18)) ([436bda7](https://github.com/cner-smith/opengolfapp/commit/436bda7f78b9f34c95db4947cfa47da8a5f3ef33))
* **db:** seed drill corpus v1 — 41 sourced drills ([#18](https://github.com/cner-smith/opengolfapp/issues/18)) ([20f20f4](https://github.com/cner-smith/opengolfapp/commit/20f20f43f41d48b47080c2b33a6df22eb7bae539))
* **db:** v2 corpus fill across all 6 practice modes (40 → 125 drills) ([75f4a7e](https://github.com/cner-smith/opengolfapp/commit/75f4a7e93640fc5e59af43299008b5529695cd89))
* **db:** v2 corpus fill across all 6 practice modes (40 → 125 drills) ([f5eef15](https://github.com/cner-smith/opengolfapp/commit/f5eef15e31fa7826e8df22ab2dc012e65e104702))
* **edge:** candidate retrieval + published-article set ([b5f6b03](https://github.com/cner-smith/opengolfapp/commit/b5f6b0312a0197bbc8b22ef97ba194827113732e))
* **edge:** AI tool-use call for plan generation ([e3271a2](https://github.com/cner-smith/opengolfapp/commit/e3271a284c23d0534c08b046df23f031a6c72b5c))
* **edge:** generate-practice-plan orchestrator ([498727a](https://github.com/cner-smith/opengolfapp/commit/498727a60ca4a7b6c3e44f7f4a794cadde469638))
* email scaffold — prove the pipe ([#317](https://github.com/cner-smith/opengolfapp/issues/317)) ([9ae7dd1](https://github.com/cner-smith/opengolfapp/commit/9ae7dd1eea49b66073cdf14b115ea73cbad57558))
* **functions:** round-summary-email Edge Function, manual-invoke ([#317](https://github.com/cner-smith/opengolfapp/issues/317)) ([8826014](https://github.com/cner-smith/opengolfapp/commit/882601439924b594b84c815e4dc5127cf1198e0a))
* **mobile:** email round-summaries opt-in toggle in Profile ([#317](https://github.com/cner-smith/opengolfapp/issues/317)) ([ba510a7](https://github.com/cner-smith/opengolfapp/commit/ba510a7985e226834915664bec5e4004b63c39ec))
* **mobile:** round-summary "Today's focus" nudge (parity with web [#430](https://github.com/cner-smith/opengolfapp/issues/430)) ([e6b03ae](https://github.com/cner-smith/opengolfapp/commit/e6b03ae37d3d6b83cd6419a39111856f17741a03))
* **mobile:** round-summary nudge — parity with web ([#430](https://github.com/cner-smith/opengolfapp/issues/430) follow-up) ([dac62b1](https://github.com/cner-smith/opengolfapp/commit/dac62b1c90917c5e2660b0fd8ece9f0925b1684c))
* **mobile:** Shot Patterns share card + native share ([#374](https://github.com/cner-smith/opengolfapp/issues/374)) ([a523d63](https://github.com/cner-smith/opengolfapp/commit/a523d63e63ecb41379beada945c76a3ab4ed0df4))
* **mobile:** Shot Patterns share card + native share ([#374](https://github.com/cner-smith/opengolfapp/issues/374)) ([e565769](https://github.com/cner-smith/opengolfapp/commit/e565769184674d0f5db632cd55d2c1bc3bf3a7f6))
* per-round strokes-gained nudge in round summary ([#18](https://github.com/cner-smith/opengolfapp/issues/18)) ([b6622f5](https://github.com/cner-smith/opengolfapp/commit/b6622f5e1ea041a9f0fae824621013d941967cd8))
* **plan:** resolve baseline drill_id by corpus name ([#18](https://github.com/cner-smith/opengolfapp/issues/18) Track D) ([db14844](https://github.com/cner-smith/opengolfapp/commit/db1484442bb9f79e7bf854910c0965f98db7152d))
* **plan:** resolve baseline drill_id by corpus name ([#18](https://github.com/cner-smith/opengolfapp/issues/18) Track D) ([0e0584e](https://github.com/cner-smith/opengolfapp/commit/0e0584e904401ea8ef542f063653b868dcaf89a2))
* **rounds:** stamp completed_at when a round is finalized ([#317](https://github.com/cner-smith/opengolfapp/issues/317)) ([9fd4d37](https://github.com/cner-smith/opengolfapp/commit/9fd4d3739ab5051d0fdcb4d38bd085fd1b179074))
* **web:** drill inline-expand (instructions) + defensive coach_note category normalization ([8abbcb8](https://github.com/cner-smith/opengolfapp/commit/8abbcb897cb8e836856452d89781fecbab59b3aa))
* **web:** email round-summaries opt-in toggle in Settings ([#317](https://github.com/cner-smith/opengolfapp/issues/317)) ([fecd77a](https://github.com/cner-smith/opengolfapp/commit/fecd77a26042dcf034c418c95c9b10a21eb95709))
* **web:** generation progress bar + fix(engine): treat APIConnectionError as transient ([9b411ff](https://github.com/cner-smith/opengolfapp/commit/9b411ff2e36d086e67821a11da2e815675f777fd))
* **web:** generation progress bar + fix(engine): treat APIConnectionError as transient ([ba47027](https://github.com/cner-smith/opengolfapp/commit/ba470270f0ca91e27fff0b9db95536d8be5e0a7f))
* **web:** per-block completion + plan feedback box (Track 3, final piece) ([10f1ccd](https://github.com/cner-smith/opengolfapp/commit/10f1ccd1fba7b258e59f2a367fa1bb7f9856a890))
* **web:** per-block completion toggles + plan feedback box (Track 3) ([e4eaf37](https://github.com/cner-smith/opengolfapp/commit/e4eaf37cbc3c5349de5d272a959f3dd3f4312227))
* **web:** per-round SG nudge in round summary ([#18](https://github.com/cner-smith/opengolfapp/issues/18)) ([ba9c5a0](https://github.com/cner-smith/opengolfapp/commit/ba9c5a0aea79c89ae712af78baac639ce79b678f))
* **web:** plan completion + feedback data layer (updatePlanProgress hook, saveFeedback) ([3c80758](https://github.com/cner-smith/opengolfapp/commit/3c8075829bce4baeb3fb3e9fd1dc80524b57e6d6))
* **web:** Practice plan page — render generated plan + generate button (Track 3) ([4ee4d1a](https://github.com/cner-smith/opengolfapp/commit/4ee4d1a8a30d3eac42dbcec924bd4b504260fb41))
* **web:** Practice plan page — render generated plan + Generate button (Track 3) ([010c2e0](https://github.com/cner-smith/opengolfapp/commit/010c2e05d775c74e39db053877f84187ed2ea49b))
* **web:** practice-plan data layer — getDrillsByIds, useGeneratePlan, useDrillsByIds ([00c874b](https://github.com/cner-smith/opengolfapp/commit/00c874bc54306b88f0d6ba3c002f4e7eb193923e))
* **web:** scorecard share via Web Share API, download fallback ([#201](https://github.com/cner-smith/opengolfapp/issues/201)) ([be108dc](https://github.com/cner-smith/opengolfapp/commit/be108dc0e5e7ef6126c86b795bde600ff2153ccd))
* **web:** scorecard share via Web Share API, download fallback ([#201](https://github.com/cner-smith/opengolfapp/issues/201)) ([bfc6645](https://github.com/cner-smith/opengolfapp/commit/bfc66455b18bcde0501792ecd5359602be5faceb))
* **web:** Shot Patterns 1200×630 share card with native share ([#374](https://github.com/cner-smith/opengolfapp/issues/374)) ([b961ef9](https://github.com/cner-smith/opengolfapp/commit/b961ef903c09ec40ab9311bd99f7c7c6fed34253))
* **web:** Shot Patterns 1200×630 share card with native share ([#374](https://github.com/cner-smith/opengolfapp/issues/374)) ([b0cfadf](https://github.com/cner-smith/opengolfapp/commit/b0cfadff88e5b58e94b0813b30526bc30c6dd805))


### Bug Fixes

* **core:** derive session total_minutes server-side; drop ±20% model check ([1be856a](https://github.com/cner-smith/opengolfapp/commit/1be856a317031ffd6eca7cf838a82ee69eaa4106))
* **core:** derive session total_minutes server-side; drop ±20% model check ([781500a](https://github.com/cner-smith/opengolfapp/commit/781500abda8ce7dbf41c79c2a5dad85beeed688f))
* **core:** drop unsupported JSON-schema keywords from PLAN_TOOL (plan-tool schema rejected) ([9d65561](https://github.com/cner-smith/opengolfapp/commit/9d6556143ab7807dc03a402d5112617d64d23cef))
* **core:** drop unsupported JSON-schema keywords from PLAN_TOOL (plan-tool schema rejected) ([5760c2f](https://github.com/cner-smith/opengolfapp/commit/5760c2f6e4bfdeb069c4efe488e21f65884a7fe3))
* **core:** resolvePlanForStorage throws on unresolved drill_ref; based_on_rounds from digest ([d0697cf](https://github.com/cner-smith/opengolfapp/commit/d0697cf9a53df3dad14d54a5110789e8438ca87a))
* **core:** restore array-schema descriptions ([#437](https://github.com/cner-smith/opengolfapp/issues/437)) + zero-block session guard ([#438](https://github.com/cner-smith/opengolfapp/issues/438)) ([198d750](https://github.com/cner-smith/opengolfapp/commit/198d750bb1383c4bbc7d44d5548e3c700e3efc5a))
* **core:** round digest SG to 2dp; readable category names in plan prompt ([d527e4e](https://github.com/cner-smith/opengolfapp/commit/d527e4eab8a5b712410f8e56a5d5447fce06a6c8))
* **core:** validatePlanDraft rejects non-positive total_minutes + negative block minutes ([a6f92cc](https://github.com/cner-smith/opengolfapp/commit/a6f92cc56ff5cd92eed6a056df7903b05ea02adb))
* **db:** cap feedback length + http(s)-only source_url in 0030 ([#18](https://github.com/cner-smith/opengolfapp/issues/18)) ([7a0e1e0](https://github.com/cner-smith/opengolfapp/commit/7a0e1e0055d8e783ab3e61a20b6a77b97e8e718a))
* **edge:** add .ts extensions to vendored imports (Deno deploy fix) ([1de1c9d](https://github.com/cner-smith/opengolfapp/commit/1de1c9da1c968cc2adef94ff479907ef82c8f5b3))
* **edge:** add .ts extensions to vendored imports so the Deno bundler resolves them ([1d83084](https://github.com/cner-smith/opengolfapp/commit/1d83084fae861ca294ae69ddfbf8e155d3048bcc))
* **edge:** add CORS support to generate-practice-plan (browser invoke was preflight-blocked) ([20e3df0](https://github.com/cner-smith/opengolfapp/commit/20e3df0724cf612524887f134bc06fd178af426e))
* **edge:** add CORS to generate-practice-plan (browser invoke was preflight-blocked) ([42db92f](https://github.com/cner-smith/opengolfapp/commit/42db92f347bca0b583dc0ae99138a094e5f94337))
* **edge:** address PR review — retrieval→baseline fallback, explicit verify_jwt, UTC month boundary, pool-size doc ([1d00b4a](https://github.com/cner-smith/opengolfapp/commit/1d00b4adc5c4d79a6e7c394eadbf5df9fb823955))
* **functions:** require service-role auth, check stamp write, guard null total_score ([#317](https://github.com/cner-smith/opengolfapp/issues/317)) ([733c22e](https://github.com/cner-smith/opengolfapp/commit/733c22e1eea79aebd566d84b24a019d6f5bebceb))
* **functions:** surface-neutral unsubscribe copy in email footer ([#317](https://github.com/cner-smith/opengolfapp/issues/317)) ([4226265](https://github.com/cner-smith/opengolfapp/commit/422626511d8726a9238a9727e3a0854d954f6d10))
* **functions:** verify service_role claim for auth + pad email SG bars ([#317](https://github.com/cner-smith/opengolfapp/issues/317)) ([fd40610](https://github.com/cner-smith/opengolfapp/commit/fd40610d2dc431d5a5741bb11c55590dc7c8b739))
* **web:** constrain Shot Patterns plot frame to the SVG footprint ([690403d](https://github.com/cner-smith/opengolfapp/commit/690403d1df919cfbeb3053ea4d7b160d9767b436))
* **web:** constrain Shot Patterns plot frame to the SVG footprint ([ebf034a](https://github.com/cner-smith/opengolfapp/commit/ebf034ab770a900b03ca870e9d116daadf451200))
* **web:** correct drill-instructions tokenizer (section paragraphs + emphasis) ([5c55c46](https://github.com/cner-smith/opengolfapp/commit/5c55c465575f2ec510bd1b4306c35d133d8c097c))
* **web:** gate round-nudge drills fetch on profile; hoist focus, intent comment ([#18](https://github.com/cner-smith/opengolfapp/issues/18)) ([1821fb0](https://github.com/cner-smith/opengolfapp/commit/1821fb0e20849af33bfbc59747a27bbc4f5ee22d))
* **web:** keep patterns share card within 630px — footer was clipped ([#374](https://github.com/cner-smith/opengolfapp/issues/374)) ([d08c5ee](https://github.com/cner-smith/opengolfapp/commit/d08c5eecc80bf1986af403c30274b8321bcb0cca))
* **web:** keep Shot Patterns plot inside the cream box on mobile-web ([4e055aa](https://github.com/cner-smith/opengolfapp/commit/4e055aa2883a723624ee05d76f89469a0a33a549))
* **web:** keep Shot Patterns plot inside the cream box on mobile-web ([fcf86d2](https://github.com/cner-smith/opengolfapp/commit/fcf86d2e2762387d7f0ab01048a40781d8a7a168))
* **web:** no idle-state 8px shift on PlanHeader; tighten progress bar JSDoc ([84a1a97](https://github.com/cner-smith/opengolfapp/commit/84a1a973f60bc97ce9fdd9085405492d71c8ef30))
* **web:** pre-mount share card on export-button intent to protect iOS share token ([#374](https://github.com/cner-smith/opengolfapp/issues/374)) ([aabe2fc](https://github.com/cner-smith/opengolfapp/commit/aabe2fc7cb03804cf2ee0e2db0fc32c3506b6a5e))
* **web:** readable drill instructions — section paragraphs, italic emphasis, aria-controls ([24d74ac](https://github.com/cner-smith/opengolfapp/commit/24d74ac7206c020c50e349735d35b6eb8ed39297))
* **web:** surface scorecard capture failure instead of silent no-op ([#201](https://github.com/cner-smith/opengolfapp/issues/201)) ([0a463c8](https://github.com/cner-smith/opengolfapp/commit/0a463c8ce85679d4d7f1c4d0c29a9d83c877a9d1))


### Refactors

* **core:** as const satisfies on digest CATEGORIES + docstring wording ([14dc156](https://github.com/cner-smith/opengolfapp/commit/14dc15666b264d7bf76cc93a6784e21524828667))
* **core:** consolidate round-nudge test imports ([#18](https://github.com/cner-smith/opengolfapp/issues/18)) ([718082d](https://github.com/cner-smith/opengolfapp/commit/718082d9f37370342c4af6809f9bffdb9d25eac2))
* **core:** defer target dispersion-scaling to Phase B; reject 0-min blocks; annotate eslint-disables ([cf93c2e](https://github.com/cner-smith/opengolfapp/commit/cf93c2e49802753e5524c44b99c3d63fadfd797e))
* **core:** drop unused sg.total from RoundSummaryInput ([#317](https://github.com/cner-smith/opengolfapp/issues/317)) ([3cb8aee](https://github.com/cner-smith/opengolfapp/commit/3cb8aee5c5280d7b07d838b2074061873d8042c8))
* **core:** tighten playFrequency fallback, scales_with guard, exact target assertions ([8b28721](https://github.com/cner-smith/opengolfapp/commit/8b28721be3f4bb2cf18abc8b230056b246490eb3))
* **core:** type-level NudgeCategory guard + -0.5 boundary test ([#18](https://github.com/cner-smith/opengolfapp/issues/18)) ([33b7b69](https://github.com/cner-smith/opengolfapp/commit/33b7b69b5cf6d58c28daf736963b40e4b47a05a3))
* **functions:** apply review fixes — drop vestigial select col, log failures ([#317](https://github.com/cner-smith/opengolfapp/issues/317)) ([8ca5f20](https://github.com/cner-smith/opengolfapp/commit/8ca5f20dd1b01956bd7f59c52b2a2d99279b4048))
* **mobile:** trim nudge comment + raw apostrophe (review [#433](https://github.com/cner-smith/opengolfapp/issues/433)) ([0ec7e52](https://github.com/cner-smith/opengolfapp/commit/0ec7e527c2fdd72059fd8b2dabfc7b9d22d7a8d9))
* **mobile:** use core dispersionVerdict; annotate eslint-disable lines ([#374](https://github.com/cner-smith/opengolfapp/issues/374)) ([5f772d1](https://github.com/cner-smith/opengolfapp/commit/5f772d11053819c2b5a53c276f562e84b252e939))
* **web:** use @oga/core plan types in PracticePlanPage; polish target; drop dead const ([bfcc693](https://github.com/cner-smith/opengolfapp/commit/bfcc6939950f24711f2cce12295328b657ec56ce))
* **web:** use core dispersionVerdict; lazy-mount share card; fix detached-anchor download ([#374](https://github.com/cner-smith/opengolfapp/issues/374)) ([7f5246f](https://github.com/cner-smith/opengolfapp/commit/7f5246f0abaa006eacac2b0815de93d99d9dd731))


### Chores

* back-merge release 0.6.0 into dev ([7480205](https://github.com/cner-smith/opengolfapp/commit/7480205f075ab373666ca9419e561dc480143ee6))
* **edge:** explicit verify_jwt = true for round-summary-email ([c8fb6da](https://github.com/cner-smith/opengolfapp/commit/c8fb6dad17c87e658be2936649f309a71558e32f))
* **edge:** explicit verify_jwt = true for round-summary-email ([#450](https://github.com/cner-smith/opengolfapp/issues/450) review) ([7a22744](https://github.com/cner-smith/opengolfapp/commit/7a22744f031d4a126828fcfa68f8d5b180773018))
* **edge:** vendor drift-check for _shared/practice-plan ([24681cd](https://github.com/cner-smith/opengolfapp/commit/24681cd61168e5fae2cc58ef6394ffc62640e71a))
* **edge:** vendor feedback + prompt helpers ([30ab545](https://github.com/cner-smith/opengolfapp/commit/30ab5459a909bc09f6ce18cc98f24ee91f06f30c))
* **edge:** vendor Phase-A practice-plan helpers into _shared ([dfaa8b5](https://github.com/cner-smith/opengolfapp/commit/dfaa8b56caefc44b034c4604e62e8e9f3fca4900))
* **edge:** vendor storage helper + export new helpers ([3a435ec](https://github.com/cner-smith/opengolfapp/commit/3a435ecec53492733ff0511869f421a02e68515d))
* **scripts:** use static readdirSync import in vendor script (PR review nit) ([74117f9](https://github.com/cner-smith/opengolfapp/commit/74117f9075e7b1637e1e95f25d6562b16b911e3c))

## [0.6.0](https://github.com/cner-smith/opengolfapp/compare/v0.5.0...v0.6.0) (2026-05-25)


### Features

* **core:** break_direction axes split — data + types ([#340](https://github.com/cner-smith/opengolfapp/issues/340) PR 1/2) ([3599acc](https://github.com/cner-smith/opengolfapp/commit/3599accc2a1147802f69e68f8331c5d74d021567))
* **core:** split break_direction into vertical + horizontal axes ([#340](https://github.com/cner-smith/opengolfapp/issues/340)) ([91176b1](https://github.com/cner-smith/opengolfapp/commit/91176b11b58c7240a0256152019d50640deaba15))
* **learn:** add diagnostic flowchart + cited sources to self-diagnosis ([#131](https://github.com/cner-smith/opengolfapp/issues/131)) ([5433dc4](https://github.com/cner-smith/opengolfapp/commit/5433dc470f1cb6c3d0d65578f8f229010651758a))
* **learn:** add Trahan, Leadbetter A Swing, de la Torre schools ([#142](https://github.com/cner-smith/opengolfapp/issues/142)) ([49553b5](https://github.com/cner-smith/opengolfapp/commit/49553b5f17932fef9bad32e6ffd84693e11416c9))
* **learn:** block, random, and pressure practice article ([41c3ac6](https://github.com/cner-smith/opengolfapp/commit/41c3ac60284fe1b465e8a840e2fceb22254780d5))
* **learn:** block, random, and pressure practice article ([d04541e](https://github.com/cner-smith/opengolfapp/commit/d04541e0389e4eea340515a0fb6bf7a05183d37b))
* **learn:** building your bag article ([27bb55b](https://github.com/cner-smith/opengolfapp/commit/27bb55ba1cb1edbcbf0c978a8e58b9aa654501e7))
* **learn:** building your bag article ([9a9d342](https://github.com/cner-smith/opengolfapp/commit/9a9d342513bb640d90d6c1f12a8ce39c62358073))
* **learn:** creating measurable practice goals article ([1833846](https://github.com/cner-smith/opengolfapp/commit/1833846e4d007e71be30f49621828275acd7f8f4))
* **learn:** creating measurable practice goals article ([e50504d](https://github.com/cner-smith/opengolfapp/commit/e50504dc2170c6811da797a4bb86727ded802225))
* **learn:** deepen fittings article — fitter Q&A + decoding their data ([#129](https://github.com/cner-smith/opengolfapp/issues/129)) ([7bc6456](https://github.com/cner-smith/opengolfapp/commit/7bc64566f489151f696a700890b24121535ec6a8))
* **learn:** deepen Operation 36 article — what par means, paid value, OGA journey ([#135](https://github.com/cner-smith/opengolfapp/issues/135)) ([531fc7c](https://github.com/cner-smith/opengolfapp/commit/531fc7c44774e7c62a1c84c8302e6c79b946b502))
* **learn:** expand practice-vs-scoring-round with tour prep + more examples ([59738c1](https://github.com/cner-smith/opengolfapp/commit/59738c18254766b26bb1f1aa1d6057ca12dbf240))
* **learn:** final two articles — practice vs scoring round + fittings with a coach ([01dadac](https://github.com/cner-smith/opengolfapp/commit/01dadac6775a5e29d666ac01902abae43b44cedd))
* **learn:** final two articles — practice vs scoring round + fittings with a coach ([d447311](https://github.com/cner-smith/opengolfapp/commit/d447311c8b0a2dfb033a24307ef94f45f80a1e3b))
* **learn:** guide to golf fittings article ([#129](https://github.com/cner-smith/opengolfapp/issues/129)) ([013a2a0](https://github.com/cner-smith/opengolfapp/commit/013a2a0510c2f7444267592b410b693f7716b425))
* **learn:** guide to golf fittings article ([#129](https://github.com/cner-smith/opengolfapp/issues/129)) ([49de1bb](https://github.com/cner-smith/opengolfapp/commit/49de1bba417ef22a6e794ec6bc1e842d73fc54ae))
* **learn:** guide to lessons and coaching article ([#130](https://github.com/cner-smith/opengolfapp/issues/130)) ([ed743e5](https://github.com/cner-smith/opengolfapp/commit/ed743e5936b8f939bd8f49a1f86135d6adf06cc0))
* **learn:** guide to lessons and coaching article ([#130](https://github.com/cner-smith/opengolfapp/issues/130)) ([d9771e2](https://github.com/cner-smith/opengolfapp/commit/d9771e29f50b430b18e341146febeafec048c785))
* **learn:** Operation 36 teaching philosophy article ([#135](https://github.com/cner-smith/opengolfapp/issues/135)) ([b3cfb0a](https://github.com/cner-smith/opengolfapp/commit/b3cfb0a68d03082c66a8313dd1930bb84854012e))
* **learn:** Operation 36 teaching philosophy article ([#135](https://github.com/cner-smith/opengolfapp/issues/135)) ([9353b7c](https://github.com/cner-smith/opengolfapp/commit/9353b7c9c9903e2ddfad764ae8d5a2f9d4218396))
* **learn:** questions to ask your coach article ([111db3f](https://github.com/cner-smith/opengolfapp/commit/111db3fb18fc7fc816124b19809169b7832ed923))
* **learn:** questions to ask your coach article ([8fad3bb](https://github.com/cner-smith/opengolfapp/commit/8fad3bb20e3cc4d3051c2434dc1939d284904a36))
* **learn:** self-diagnosis article ([#131](https://github.com/cner-smith/opengolfapp/issues/131)) ([57cff97](https://github.com/cner-smith/opengolfapp/commit/57cff97bb09a354594991bb2fbe90dddb5a6821c))
* **learn:** self-diagnosis article ([#131](https://github.com/cner-smith/opengolfapp/issues/131)) ([254a091](https://github.com/cner-smith/opengolfapp/commit/254a0914b507c0e62f1a9c436c480fa13947189e))
* **learn:** swing variations for different body types ([#142](https://github.com/cner-smith/opengolfapp/issues/142)) ([e13dd9d](https://github.com/cner-smith/opengolfapp/commit/e13dd9d8de0c7ad9efd70a91985dcb66ffd6c1fa))
* **learn:** swing variations for different body types article ([#142](https://github.com/cner-smith/opengolfapp/issues/142)) ([78836a5](https://github.com/cner-smith/opengolfapp/commit/78836a5d9737ea00ddd7b10db50269cee7de7961))
* **learn:** training aids guide article ([#128](https://github.com/cner-smith/opengolfapp/issues/128)) ([d78fc79](https://github.com/cner-smith/opengolfapp/commit/d78fc79bed595a2b5f8f90be99edb17c8c21ca92))
* **learn:** training aids guide article ([#128](https://github.com/cner-smith/opengolfapp/issues/128)) ([c23c4c3](https://github.com/cner-smith/opengolfapp/commit/c23c4c308ee5275714c03e69b73bd1ad994ea32b))
* **learn:** understanding your own swing article ([dd8d09b](https://github.com/cner-smith/opengolfapp/commit/dd8d09bfeefff452532c3a36596c3236f19f165c))
* **learn:** understanding your own swing article ([728bf89](https://github.com/cner-smith/opengolfapp/commit/728bf8991f6ac7c5b6696144c9d1867a910113b5))
* **mobile:** PuttingSheet break — split into slope + line axes ([#340](https://github.com/cner-smith/opengolfapp/issues/340) PR 2/2) ([24aafc4](https://github.com/cner-smith/opengolfapp/commit/24aafc43dc024c02f8741eed9353d404b98be685))
* **mobile:** split PuttingSheet break into 2 axes — UI + write-path ([#340](https://github.com/cner-smith/opengolfapp/issues/340)) ([dde88b1](https://github.com/cner-smith/opengolfapp/commit/dde88b1eba00373ec3e690b8c310579a564aad58))
* **patterns:** standalone ball-flight chart on Shot Patterns ([#243](https://github.com/cner-smith/opengolfapp/issues/243)) ([db981c5](https://github.com/cner-smith/opengolfapp/commit/db981c572c693748beaeb62e7e3c3e62520111ec))
* **patterns:** standalone ball-flight chart on Shot Patterns ([#243](https://github.com/cner-smith/opengolfapp/issues/243)) ([534196c](https://github.com/cner-smith/opengolfapp/commit/534196c6bf80ce3c9be64dc5648281b40d7f51d1))


### Bug Fixes

* **core:** dispersion ellipses use 2D containment radii, not 1-D σ ([121604a](https://github.com/cner-smith/opengolfapp/commit/121604a72817affc9e0e82e978f93d8535706322))
* **core:** dispersion ellipses use 2D containment radii, not 1-D σ ([880bb3f](https://github.com/cner-smith/opengolfapp/commit/880bb3f27ce664988089d65680310b8749de4f94))
* **learn:** make the self-diagnosis flowchart read as a flow ([#131](https://github.com/cner-smith/opengolfapp/issues/131)) ([0c74c32](https://github.com/cner-smith/opengolfapp/commit/0c74c32ebd2bfed4e385ab8adb80b41c3e169424))
* **mobile/ios:** address [#389](https://github.com/cner-smith/opengolfapp/issues/389) cross-review findings ([4cf608b](https://github.com/cner-smith/opengolfapp/commit/4cf608b3f3e0166a563d735f2667d4cb9e7d9448))
* **mobile/ios:** address [#389](https://github.com/cner-smith/opengolfapp/issues/389) cross-review findings (StatusBar, plist dedupe, tab bar) ([9f3a550](https://github.com/cner-smith/opengolfapp/commit/9f3a55024dc142f60d7f349bdda717860152bbeb))
* **mobile/ios:** declarative StatusBar in dark views ([#393](https://github.com/cner-smith/opengolfapp/issues/393) auto-review blocker) ([4e91ec3](https://github.com/cner-smith/opengolfapp/commit/4e91ec3d27cb5fceab6a42006676ade64612251d))
* **mobile:** allow about: scheme in auth WebView so iOS Turnstile completes ([#405](https://github.com/cner-smith/opengolfapp/issues/405)) ([93ddf89](https://github.com/cner-smith/opengolfapp/commit/93ddf89c843e8e098f20bdc7730b494abde64fe5))
* **mobile:** allow about: scheme in auth WebView so iOS Turnstile completes ([#405](https://github.com/cner-smith/opengolfapp/issues/405)) ([4c6955a](https://github.com/cner-smith/opengolfapp/commit/4c6955ab83eb027f1c2d881eed68414ef17eca28))
* **patterns:** tracer curve direction + cluster-centered view; pin barrel exports ([b22ac02](https://github.com/cner-smith/opengolfapp/commit/b22ac02e88d97ece1e8f57dfe8869cc38a9041aa))
* **patterns:** tracer curve direction + cluster-centered view; pin two barrel exports ([75d6c7f](https://github.com/cner-smith/opengolfapp/commit/75d6c7f2604536a262b5510371f3097008daafea))


### Refactors

* **core:** move formatBandLabel to @oga/core ([#207](https://github.com/cner-smith/opengolfapp/issues/207)) ([4fafa3a](https://github.com/cner-smith/opengolfapp/commit/4fafa3a06cfe6b75eae3b161167d5ce7c153e5f1))
* **core:** move formatBandLabel to @oga/core ([#207](https://github.com/cner-smith/opengolfapp/issues/207)) ([2fea0d5](https://github.com/cner-smith/opengolfapp/commit/2fea0d586fd87cd29fb76d46121676ad9bdeba8c))
* **core:** move SGBreakdown averaging math to @oga/core ([#195](https://github.com/cner-smith/opengolfapp/issues/195)) ([ff61ff0](https://github.com/cner-smith/opengolfapp/commit/ff61ff0c18e829429235f30c54e4f7c261ed5627))
* **core:** move SGBreakdown averaging to @oga/core ([#195](https://github.com/cner-smith/opengolfapp/issues/195)) ([05f76ea](https://github.com/cner-smith/opengolfapp/commit/05f76ea996749fe0916c1f8d5b6c7b0e7dfb59e1))
* **core:** move shotRowToDraft + mapBreakDirection to @oga/core ([#205](https://github.com/cner-smith/opengolfapp/issues/205)) ([ac810e6](https://github.com/cner-smith/opengolfapp/commit/ac810e6f500f0a85ce6b25769f43d749aac324f3))
* **core:** move shotRowToDraft + mapBreakDirection to @oga/core ([#205](https://github.com/cner-smith/opengolfapp/issues/205)) ([ce8b881](https://github.com/cner-smith/opengolfapp/commit/ce8b8813892d382e5678df0f47514c90e19096dc))


### Chores

* **core:** @oga/core polish sweep — [#394](https://github.com/cner-smith/opengolfapp/issues/394) [#395](https://github.com/cner-smith/opengolfapp/issues/395) [#397](https://github.com/cner-smith/opengolfapp/issues/397) [#398](https://github.com/cner-smith/opengolfapp/issues/398) ([8ad5423](https://github.com/cner-smith/opengolfapp/commit/8ad54238f0e3da0c1341a9026880deab22dd6703))
* **core:** polish sweep — types, scale split, tests, barrel ([30acc1b](https://github.com/cner-smith/opengolfapp/commit/30acc1b79316dd1ec8df8e333663287c2b8defc2))
* **core:** promote categorizeShot to @oga/core ([#206](https://github.com/cner-smith/opengolfapp/issues/206)) ([77699c8](https://github.com/cner-smith/opengolfapp/commit/77699c8773aff9303d6c75de0ad533645b7d8d1c))
* **core:** promote categorizeShot to @oga/core as getShotMarkerCategory ([#206](https://github.com/cner-smith/opengolfapp/issues/206)) ([5ded837](https://github.com/cner-smith/opengolfapp/commit/5ded837bc3fc13a8f0a70ae9bb5bfa0cb97907f2))
* **mobile/ios:** app config micro-fixes — usage strings, StatusBar, tab bar height ([d2985ca](https://github.com/cner-smith/opengolfapp/commit/d2985ca58b0dfd7be5b282d471cad1adced4f671))
* **mobile/ios:** app config micro-fixes ([#300](https://github.com/cner-smith/opengolfapp/issues/300) [#302](https://github.com/cner-smith/opengolfapp/issues/302) [#305](https://github.com/cner-smith/opengolfapp/issues/305)) ([69885c7](https://github.com/cner-smith/opengolfapp/commit/69885c72c95bab9b3b71c521d734c08adc4c45db))
* sync dev with main (post v0.5.0 release backmerge) ([00570b3](https://github.com/cner-smith/opengolfapp/commit/00570b3fc4552328b0d79956b86ab157da0da3d3))

## [0.5.0](https://github.com/cner-smith/opengolfapp/compare/v0.4.0...v0.5.0) (2026-05-22)


### Features

* **mobile:** iOS build prep — eas.json profiles, dynamic config, bundle ID ([#376](https://github.com/cner-smith/opengolfapp/issues/376)) ([948c8d3](https://github.com/cner-smith/opengolfapp/commit/948c8d3958feedff8e0d3c1d5e222309feb4f155))


### Bug Fixes

* **mobile:** bump react-native-draggable-flatlist 4.0.1 → 4.0.3 ([1e46943](https://github.com/cner-smith/opengolfapp/commit/1e46943f136b7e782dcf15cb888fa4448b71803c))
* **mobile:** bump react-native-draggable-flatlist 4.0.1 → 4.0.3 ([59496b7](https://github.com/cner-smith/opengolfapp/commit/59496b7257b9433431fdc64dc111e99ab450a4ae))
* **mobile:** collapse 6 dialog flags into one ActiveDialog union ([#293](https://github.com/cner-smith/opengolfapp/issues/293)) ([35a4794](https://github.com/cner-smith/opengolfapp/commit/35a4794834dcd8c6ad9b457b2cbe73ba943cc819))
* **mobile:** collapse 6 dialog flags into one ActiveDialog union ([#293](https://github.com/cner-smith/opengolfapp/issues/293)) ([f7067c2](https://github.com/cner-smith/opengolfapp/commit/f7067c20d9d9574fd57c87a53fb2febeb389efa9))
* **mobile:** gate LocationPuck mount during modal-covered phases ([#330](https://github.com/cner-smith/opengolfapp/issues/330)) ([0644e70](https://github.com/cner-smith/opengolfapp/commit/0644e70fa66440e3395628964b2ce1be59c13ee9))
* **mobile:** gate LocationPuck mount during modal-covered phases ([#330](https://github.com/cner-smith/opengolfapp/issues/330)) ([d5aa029](https://github.com/cner-smith/opengolfapp/commit/d5aa029e6863189acf3c156f669a14602d42dbc8))
* **mobile:** pass AbortSignal to course search so fetches actually cancel ([#291](https://github.com/cner-smith/opengolfapp/issues/291)) ([c714aa6](https://github.com/cner-smith/opengolfapp/commit/c714aa617b84483021ce2adfd2f9e9a478cd631d))
* **mobile:** pass AbortSignal to course search so fetches actually cancel ([#291](https://github.com/cner-smith/opengolfapp/issues/291)) ([f70568a](https://github.com/cner-smith/opengolfapp/commit/f70568a9ca02180f91815fd541e236dddbd376fd))
* **mobile:** rounds list — add accessibility actions for delete ([#286](https://github.com/cner-smith/opengolfapp/issues/286)) ([b841a8d](https://github.com/cner-smith/opengolfapp/commit/b841a8ddf59e44b930ace6100234a169de075d9b))
* **mobile:** rounds list — add accessibility actions for delete ([#286](https://github.com/cner-smith/opengolfapp/issues/286)) ([1a69be0](https://github.com/cner-smith/opengolfapp/commit/1a69be089118b7706bed4adc013865fa7d4bf9a7))
* **mobile:** rounds list a11y — screen-reader-accessible delete ([#286](https://github.com/cner-smith/opengolfapp/issues/286)) ([73a331c](https://github.com/cner-smith/opengolfapp/commit/73a331c326644984817710b0b8ccde4a99e1ecfc))
* **mobile:** SecureStore chunked write — sentinel-last commit order ([#345](https://github.com/cner-smith/opengolfapp/issues/345)) ([a271346](https://github.com/cner-smith/opengolfapp/commit/a271346a553b5255fd1d2d7bd058482354a310c9))
* **mobile:** SecureStore chunked write — sentinel-last commit order ([#345](https://github.com/cner-smith/opengolfapp/issues/345)) ([9a42844](https://github.com/cner-smith/opengolfapp/commit/9a428449a0231dd61d349851db42499942c1b1d9))


### Chores

* **issues:** add structured GitHub issue templates ([1be5bb2](https://github.com/cner-smith/opengolfapp/commit/1be5bb2b30d4b5da940800f7b125060a3e7f46be))

## [0.4.0](https://github.com/cner-smith/opengolfapp/compare/v0.3.1...v0.4.0) (2026-05-21)


### Features

* **web:** auth-aware Learn shell so signed-in users see app sidebar ([5ed864d](https://github.com/cner-smith/opengolfapp/commit/5ed864dec992a0ff537d23ab7ef9ad3d71482ab5))
* **web:** auth-aware Learn shell so signed-in users see app sidebar ([ccc972c](https://github.com/cner-smith/opengolfapp/commit/ccc972cbecefa69199b9ae3edc15de76a3293013)), closes [#237](https://github.com/cner-smith/opengolfapp/issues/237)


### Bug Fixes

* **mobile:** grow PuttingSheet 'Not a putt?' link to &gt;=44px hit target ([#245](https://github.com/cner-smith/opengolfapp/issues/245)) ([91d1548](https://github.com/cner-smith/opengolfapp/commit/91d1548668d961100bc85993bc985ca6840f6d2d))
* **mobile:** PuttingSheet 'Not a putt?' link &gt;=44px hit target ([#245](https://github.com/cner-smith/opengolfapp/issues/245)) ([7288c3b](https://github.com/cner-smith/opengolfapp/commit/7288c3bc8fc2cd9421c258deeb78c33a91869e80))
* **mobile:** silence expected WAL lock log + use safe-area insets ([4166558](https://github.com/cner-smith/opengolfapp/commit/41665586f423aeebccc429002cba51b3e618ec1e))
* **mobile:** silence expected WAL lock log + use safe-area insets ([77618a5](https://github.com/cner-smith/opengolfapp/commit/77618a571c85062bafbda7de632d8cb71b2628c6))
* **mobile:** URL-encode Turnstile site key + globalThis-guard WAL listener ([ca21417](https://github.com/cner-smith/opengolfapp/commit/ca21417275e113878d4b6ce22747ec562ed6e3b3))
* **mobile:** URL-encode Turnstile site key + globalThis-guard WAL listener ([66bd1bf](https://github.com/cner-smith/opengolfapp/commit/66bd1bf0d9354284bdb5baf8fe8c30811966408c))
* **web,mobile:** SG chart line color + pattern differentiation ([#240](https://github.com/cner-smith/opengolfapp/issues/240)) ([9f4458b](https://github.com/cner-smith/opengolfapp/commit/9f4458be394c5595e8f977e032699bf2f2d195ed))
* **web,mobile:** SG chart line color + pattern differentiation ([#240](https://github.com/cner-smith/opengolfapp/issues/240)) ([2389a13](https://github.com/cner-smith/opengolfapp/commit/2389a13415e2c79c92dc20a2cb0d63fd0af31b8f))
* **web,mobile:** swap PuttingSheet Holed/Missed button order ([#202](https://github.com/cner-smith/opengolfapp/issues/202)) ([9e51319](https://github.com/cner-smith/opengolfapp/commit/9e51319f0f7b7132fcc9ead8731ba98db4899407))
* **web,mobile:** swap PuttingSheet primary/secondary action order ([#202](https://github.com/cner-smith/opengolfapp/issues/202)) ([085295f](https://github.com/cner-smith/opengolfapp/commit/085295fca2decf43cb5d42e46b8f7067a2c2f958))


### Chores

* **e2e:** Phase 3 — settings form validation specs ([43a9fc7](https://github.com/cner-smith/opengolfapp/commit/43a9fc74a24d8cd66b43083b01f6d7d0bd269a91))
* **e2e:** Phase 3 — settings form validation specs (2 tests) ([380c9a1](https://github.com/cner-smith/opengolfapp/commit/380c9a1a2dec7916d1811ed4d97c0dd29b8c2828))
* **e2e:** playwright + auth fixture + e2e seed script ([11a3758](https://github.com/cner-smith/opengolfapp/commit/11a3758634124ad2240211aa23d06206f53c1cb2))
* **e2e:** playwright + auth fixture + e2e seed script ([ab20dbf](https://github.com/cner-smith/opengolfapp/commit/ab20dbf09e467b5611b1ed81765efc0f0da33698))
* **e2e:** smoke layer + critical mutating flow specs ([eee62f1](https://github.com/cner-smith/opengolfapp/commit/eee62f107553a613bcab08574c0dc44ab6538b5f))
* **e2e:** smoke layer + critical user flows ([5cd3b42](https://github.com/cner-smith/opengolfapp/commit/5cd3b42eb4d35eec9ffd8e4e99f175dc30c20300))
* **mobile:** globalThis sync guard + typed Href for 2 router calls ([6f1df82](https://github.com/cner-smith/opengolfapp/commit/6f1df8297536ed83762861477340d7ad72e0d247))
* **mobile:** globalThis sync guard + typed Href for 2 router calls ([ec0496f](https://github.com/cner-smith/opengolfapp/commit/ec0496fbc519605b47368ab0eaa79941a1f260ee))
* **seed:** seed + wipe user_clubs in seed-demo.ts ([69fba2f](https://github.com/cner-smith/opengolfapp/commit/69fba2fbefae05a5fbe602459a554623ad22a447))
* **seed:** seed + wipe user_clubs in seed-demo.ts ([b3074be](https://github.com/cner-smith/opengolfapp/commit/b3074bee7c153633cfa6a2ba1cf528c919189a52))

## [0.3.1](https://github.com/cner-smith/opengolfapp/compare/v0.3.0...v0.3.1) (2026-05-21)


### Bug Fixes

* **db:** rate-limit user-submitted courses to block spam ([#221](https://github.com/cner-smith/opengolfapp/issues/221)) ([e795f8f](https://github.com/cner-smith/opengolfapp/commit/e795f8f892aaba9f3a9af00ef18d3ef019172595))
* **db:** rate-limit user-submitted courses to block spam ([#221](https://github.com/cner-smith/opengolfapp/issues/221)) ([2588887](https://github.com/cner-smith/opengolfapp/commit/2588887e854ff02b90b0e3b00a1649ed725ab030))
* **web:** set emailRedirectTo from window.location.origin on signup ([#347](https://github.com/cner-smith/opengolfapp/issues/347)) ([90fb00c](https://github.com/cner-smith/opengolfapp/commit/90fb00cea720c164e444f44964aa7c710eb0579b))
* **web:** set emailRedirectTo on signup so confirm email stays on origin ([#347](https://github.com/cner-smith/opengolfapp/issues/347)) ([1154dbb](https://github.com/cner-smith/opengolfapp/commit/1154dbbab123548075cc23f6480787a270796275))
