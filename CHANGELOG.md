# Changelog

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
