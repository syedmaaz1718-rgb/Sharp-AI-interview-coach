# SharpAI v15 + Arena + PWA

Deployable backup of the owner's mock interview app. React 18 + Vite,
Express 5, Node 22.23.3 built-in SQLite and browser MediaPipe face analysis.
See [DEPLOY.md](DEPLOY.md) for exact Render commands and data-persistence setup.

## Included features

- Candidate and interviewer modes; Google login when configured, guest mode otherwise.
- Role, company-style, resume and job-description practice with English/Hinglish/Hindi options.
- Voice/video interview UI, face/voice measurements, answer scoring, report/PDF and history.
- Recruiter interview kits, async screening, candidate scorecards and live copilot.
- Interview replay, peer battle, Skill Passport and practice dashboard.
- Multiplayer Arena, tournaments and optional AI judge.
- Living animated icons, page transitions and installable PWA/offline screen.

## Run

Node 22.23.3:

```sh
npm ci --include=dev
npm test
npm run build
npm start
```

Open http://localhost:3001. For local development: `npm run dev`.
Production serves the built React app and API together with Express.

## Honest limits

Groq is optional. Without `GROQ_API_KEY`, questions and scoring use templates
and heuristics, not a true AI coach. Server transcription and Arena AI judging
need the key. Chrome/Edge browser speech recognition can be used as a fallback;
Arc users can type without the key. Google login needs `GOOGLE_CLIENT_ID`.

The database holds users, interview history and recruiter/Arena records.
There is no owner-wide signup/admin dashboard in this backup. Guest identity is
browser-local; session data is held by the server. Render free disk is ephemeral
and loses that data on restart/redeploy. Use a paid persistent disk and DB_FILE
for real user collection. No paid service has been created by this package.

Face and voice measurements are estimates, not hiring decisions or validated
psychometric tests. Company-style questions are not official company content.
Camera analysis and local video replay run in the browser. With Groq enabled,
answer text and microphone audio for transcription are sent to Groq.

A PWA is not a native store app. Interviews, login, AI and Arena need the server;
the offline screen does not provide an offline interview. Microphone/camera need
HTTPS and permissions. Real Groq calls, Google login, camera/mic and device PWA
installation must be verified on the deployed URL.

The inherited dependencies have audit advisories documented in DEPLOY.md.
This package is tested deployment prep, not a security-hardening review.

## License

See LICENSE. MediaPipe model and runtime assets retain their upstream licensing.
