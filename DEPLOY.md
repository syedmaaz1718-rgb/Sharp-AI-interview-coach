# SharpAI v15 + Arena + PWA: deploy package

Source: the owner's newest Drive backup, modified 2026-10-11.
This is React + Vite + Express + SQLite. Deploy as a Render Node Web Service,
not a Netlify static site or Docker service.

## Upload the code

1. Extract the ZIP. Open `sharpai-deploy` and confirm `package.json`,
   `package-lock.json`, `src`, `server`, and `public` are directly inside.
2. Create a private GitHub repository for SharpAI. Upload the CONTENTS of
   `sharpai-deploy` into the repository root, not the ZIP or the outer folder.
   If a SharpAI repository already exists, update that repository instead.
3. Render: New > Web Service > connect the repository.
4. Name: sharpai. Runtime/Language: Node. Region: Singapore.
   Branch: the branch containing the uploaded files. Root Directory: blank.
5. Build Command: `npm ci --include=dev && npm run build`
6. Start Command: `npm start`
7. Environment: `NODE_VERSION=22.23.3`, `NODE_ENV=production`.
8. For a temporary preview, the free instance works, but it sleeps when idle
   and loses SQLite users/history/roles/rooms on restart or redeploy.
   It is NOT suitable for collecting durable startup user data.
9. For a real launch, choose a paid web service yourself and attach a persistent
   disk at `/var/data`; add `DB_FILE=/var/data/sharpai.db` BEFORE the first real
   users. Review the hosting charges before confirming anything.
10. Create the Web Service. Once Live, open the generated URL and `/api/config`.
    Check guest practice, a complete typed interview, report/PDF, Arena,
    recruiter mode, Install app page and phone layout.

## Optional integrations

- `GROQ_API_KEY`: optional at startup. Without it, practice uses template
  questions and heuristic scoring, not a real AI coach. Server transcription
  and the AI Arena judge require it. Browser speech recognition may work in
  Chrome/Edge; on Arc use typing without this key.
- `GOOGLE_CLIENT_ID`: optional. Without it, guest mode works but Google login
  is disabled. Configure a Google OAuth Web client with the exact Render
  HTTPS origin as an authorized JavaScript origin, then add the client ID.
- `PASSPORT_SECRET`: use a strong secret stored in Render Environment and keep
  it unchanged so issued passports stay verifiable. The Blueprint generates
  this automatically; a manual Web Service should set it before sharing passports.
- Never commit keys, `.env`, database files or `node_modules` to GitHub.
- With Groq transcription enabled, microphone audio is sent to Groq. Camera
  analysis and local video replay stay in the browser.

## Local verification

Node 22.23.3:
`npm ci --include=dev`
`npm test`
`npm run build`
`npm start`
Open http://localhost:3001. No API key required.

This package contains a prebuilt `dist` preview, but Render rebuilds it from
source. Test databases, API keys and dependencies are not included.

Known dependency audit warnings: the inherited Vite 5 development toolchain
and React Router 6 have advisories. Do not expose the Vite development server
publicly. This deployment starts Express, not Vite. Dependency-major upgrades
are separate work; this package is not a security certification.
