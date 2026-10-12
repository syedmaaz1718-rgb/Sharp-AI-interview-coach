# SharpAI Arena build

Base: SharpAI v15 living-icons source backup (Oct 7, 2026). No deployment or Drive write. The v16 Story Studio, Rehearsal Room, Focus Plan and Command Palette files were not recoverable from the current Drive backup. They are not included in this source and must be restored/rebuilt separately. Existing 1v1 remains at /battle.

## Added routes
- /arena: create/join 2-8 player arenas
- /arena/:token: synchronized rounds, live SSE standings, answer feedback, opt-in audience reveal, vote counts, cards, sharing, local camera preview
- /arena-tournament: create a tournament
- /arena-tournament/:token: organizer heats/final and opted-in recruiter leaderboard
- /arena-share/:token: revocable public result

## Runtime
Use Node >=22.5, npm ci, npm run build, npm start. SQLite location uses DB_FILE; production requires a persistent writable disk. SSE requires the proxy to allow streaming (X-Accel-Buffering is disabled in the response). Single-server deployment is assumed; do not horizontally scale without a shared event bus/state solution. No migration erases existing v15 tables.

English uses existing role-specific question bank. Hindi/Hinglish use existing General packs only. Questions are predefined; spoken reading uses browser TTS. Scoring uses the existing deterministic answer-content rubric. It is not generative AI judging or validated candidate assessment. It does not verify technical truth, identity, campus affiliation or prevent cheating. Voice capture reuses SharpAI's browser/server transcription flow and needs working device permissions or configured Groq Whisper. Camera preview stays local and is not scored or broadcast. There is no multi-party video conference.

The host starts/advances rounds. Scores update only after all players submit or the server deadline expires. Missed answers are zero. Rankings average round scores including misses. Ties retain the same rank. Audience votes are separate, one per signed-in spectator per round; multiple-account abuse is not prevented. Signed-in players cannot vote in their own room.

Tournament heats share one fixed question pack. At least two complete, active heat attempts are needed for a final. Qualify up to the room limit; a tie spanning the cutoff blocks automatic selection instead of picking arbitrarily. Signed-in repeated heat participants block final selection. Guests are not identity-verified. Finalist keys appear only to the organizer when generated, stored in the organizer's browser for reload recovery. Send each finalist only their own private link. Organizer/host keys stay private.

Invite links grant joining before start and signed-in spectator visibility. Player keys are hashed on the server, stored locally in the browser and sent in request headers, never in ordinary query URLs. Private finalist keys use URL fragments then are cleared. No default raw-answer disclosure; players can opt in to answer reveal and recruiter result discovery, independently. Organizer can see tournament participant names/results. Public result link is off until the player enables it and is revocable. Room host can delete the room, answers, votes and shares. No automatic messages/posts.

## Verification
69 tests pass (56 inherited + 13 Arena). Build passes with inherited >500kB bundle warning. Two-browser live updates, answer submission, hidden data, spectator vote UI using a local signed-in fixture, final generation, completed-state restart persistence, card PNG and sharing checked. 320/390px overflow checks pass. Real device mic/camera, live Google auth, configured Groq, Safari, load testing and production hosting remain unverified.

Dependency audit: safe in-range npm audit fix removed the two critical findings in concurrently/shell-quote. Four remain: Vite/esbuild and react-router/react-router-dom (1 high, 3 moderate). They require major upgrades and regression checks before production launch. No force/major upgrade applied in this feature pass.

Visuals and review video use explicitly named fictional test players/tournaments and a separate temporary test database. No test data or keys are included in this source archive. Review footage is time-compressed.

## AI judge integration revision
The Arena now uses one Groq chat completion per closed round, with anonymous participant IDs and a shared fixed rubric. Every submitted answer receives relevance, accuracy, reasoning, specificity and clarity feedback, grounded strengths/improvements and a better-answer example. Server totals use fixed dimension weights, not the provider's claimed total. Participant names, email, video and voice metrics are not sent to the judge. Inputs are explicitly untrusted data in the provider prompt. Validating JSON does not eliminate model hallucination or injection risk; feedback remains practice coaching and must not be used as a verified hiring decision.

AI scoring is accepted atomically only when every submitted answer in a round has complete valid output. Missing key, quota exhaustion, timeouts, errors and incomplete output retain the whole round's rubric scores, with a visible reason. No mixture of AI and rubric between players in one round. Missed submissions stay zero. During judging, current round scores and feedback remain hidden. The host cannot advance until evaluation finishes. On a server restart during judging, that round falls back to rubric scoring without repeating a possibly charged provider call. Tournament final qualification blocks heats with different AI/rubric source patterns; visible results disclose source counts.

AI messages may disclose submitted answer text to Groq. This is described on join/create/answer screens. Provider account limits/costs are controlled by the configured account; no provider account or billing setup is included. GROQ_API_KEY goes in a private environment configuration, never a committed file. Model uses GROQ_MODEL or the existing app default. The optional provider path needs a real key and live verification before calling AI judging operational.

Revision verification: 78 tests pass (includes provider JSON normalization, mock HTTP request, entire-round async wait/update, partial response, missing config/quota, provider exceptions, HTTP rejection and delete-during-pending). Actual browser UI was checked with clearly labeled controlled provider responses, not live Groq. Desktop and 390px show feedback, expanded example and source labels. Live provider verification is pending the user's later key setup. No deploy. Earlier v15+Arena Drive backup is a distinct rubric-only revision and was not overwritten by this revision.

## Installable app (PWA) revision
- Root-scoped standalone manifest, SharpAI PNG icons including maskable 512 and Apple 180, home/Practice/Arena entry paths.
- `/install` page: browser install button when available, Android/Safari/desktop steps, website fallback, mic/auth/storage caveats. No forced install prompt.
- Production-only worker caches public offline UI/icons only. API, submissions, auth, reports, live events and answer content are not cached. Navigation uses network first; connectivity failure shows a reconnect screen, not stale practice state. No offline submission queue.
- Versioned public caches; update does not call skipWaiting or clients.claim, so an open interview isn't forcibly reloaded or taken over. Worker/manifest/offline response cache headers revalidate.
- Verified: 82/82 unit/integration tests; production build; local Chromium manifest/installability checks without errors; worker control, cache contents, actual outage/reconnect, 320/390px no overflow, visual desktop/mobile/icon/offline inspection. This is not a native install verification. Chromium media emulation did not simulate standalone display, so that mode, real iOS/Android/desktop installs and deployed HTTPS/origin still need device checks.
- Groq real provider check remains pending key; no deployment performed. Recovered v15 base, not all unrecovered v16 features.
