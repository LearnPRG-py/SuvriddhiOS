# Frontend Development

SuvriddhiOS ships three separate frontend surfaces. They are not one
monorepo app — each is built and served independently, and they only
share the backend API (port 8000, see doc 06) and a rough visual
language.

| | Framework | Build tool | Served from | Purpose |
|---|---|---|---|---|
| `home/` | Plain HTML/CSS/JS | none | `/root/www` (port 8080) | Kiosk "desktop" / launcher |
| `src_cs` | Preact + TS | Vite | `/root/www/build` (port 8081) | Coding lessons/drills/sandbox |
| `src_phy` | Preact + TS | Vite | `/root/www/learn` (port 8082) | Physics/chem/maths lessons |

## `home/` — the kiosk shell

No build step, no framework, no `node_modules` — just
`index.html`/`style.css`/`script.js` and a `wallpapers/` directory. It's
what Chromium loads first (`S60cage` points it at
`http://127.0.0.1:8080`). It's copied as-is into `/root/www` by
`post-build.sh`, and it's also copied as-is into the OTA payload by CI —
**but note from doc 05 that `S55git`'s apply step does not currently
carry over updated home-shell files** the way it does `build/`/`learn/`,
so changes here reach devices via a normal `/root/www` OTA update path
that overwrites the whole directory (the same `mv` swap covers it, since
`home/`'s files land inside `/root/www`'s root, not a subdirectory) —
just be aware wallpapers are one of the four things flagged as
OTA-limited in doc 05 (existing wallpaper files update fine as part of
`/root/www`; the constraint is about the mechanism, worth re-verifying
against `S55git` if you're relying on it for a wallpaper change).

What it contains: a wallpaper picker (persisted to `localStorage`, no
backend involved), a live clock (`Asia/Kolkata` timezone, hardcoded —
these devices are deployed in India), a Google search bar, an
online/offline banner (`navigator.onLine`), two app-launcher cards
(hardcoded links to `http://127.0.0.1:8081` and `:8082`), a dock of
external, curated educational sites (opened via normal `<a>` tags), and
a settings link into `src_phy`'s `#/settings` route.

Because there's no build step, editing this is just editing HTML/CSS/JS
directly — open `home/index.html` in a browser to preview roughly (the
two app-launcher links and anything behind Wi-Fi/backend calls won't
work standalone, obviously).

## `src_cs` and `src_phy` — the two Vite apps

Both follow the same stack and structure, which makes moving between
them straightforward once you know one:

- **Preact** (React-compatible API, much smaller runtime — chosen for
  the low-power target hardware) with the `@preact/preset-vite` alias so
  `react`/`react-dom` imports resolve to Preact under the hood in
  `src_cs`. `src_phy` additionally depends on real `react`/`react-dom`
  directly for a couple of libraries (`react-pdf`, `react-unity-webgl`,
  `@tiptap/react`) that aren't Preact-compatible — worth knowing if you
  hit a "two versions of React" style bug, that's a real possibility
  here, not a red herring.
- **Vite** for dev server + build (`npm run dev` / `npm run build`).
- **Tailwind CSS v4** via `@tailwindcss/vite` — utility classes directly
  in JSX, plus `src/styles/index.css` for anything global and
  `fonts.css` for the bundled OpenSans font (loaded locally, not from a
  CDN — these devices may be offline).
- **Zustand** (`src/store/useStore.ts`) for client state: current
  language selection, last-visited lesson/drill, per-item completion
  tracking, and code drafts (so a student's in-progress code survives
  navigating away) — persisted to `localStorage`, not the backend, so
  progress is currently per-device/per-browser-profile, not synced
  anywhere.
- **`react-ace`** (Ace editor) for the code-writing surfaces in both
  apps.
- Routing: `preact-router` in `src_cs`, `react-router` (v7) in `src_phy`
  — a naming inconsistency worth being aware of, not a bug.

### `src_cs` structure

```
src_cs/
├── src/
│   ├── pages/          Home.tsx, Learn.tsx, Train.tsx, Sandbox.tsx, Settings.tsx
│   ├── components/      home/ learn/ train/ common/ settings/
│   ├── store/useStore.ts
│   ├── types/           drills.ts, language.ts, learningitems.ts
│   └── utils/           getTopicProgress.ts, errordict.json
├── public/data/
│   ├── learn/            topics.json, topics_py.json, exercises.json,
│   │                     challenges.json, topics_py/ topics/ (per-topic content)
│   └── train/drills.json
├── scripts/              generate_exercises.cjs, generate_challenges.cjs
└── backend -> (symlink; see doc 06)
```

Course content (lessons, exercises, challenges, drills) is **data, not
code** — JSON under `public/data/`. If you're adding new lesson content,
you very likely want to edit/generate JSON here rather than write new
components. The `npm run generate:exercises` / `generate:challenges`
scripts (see `package.json`) regenerate derived JSON
(`topics_py.json` etc.) from source content + a topics list — read
`scripts/generate_*.cjs` before hand-editing generated-looking JSON
files, or you'll fight the generator on the next run.

### `src_phy` structure

```
src_phy/
├── src/
│   ├── pages/          Home.tsx, Study.tsx, Learn.tsx, Data.tsx, Train.tsx, Settings.tsx
│   ├── components/      home/ learn/ study_zone/ data_table/ common/ settings/
│   ├── store/useStore.ts
│   ├── types/           language.ts, subject.ts, learningitems.ts
│   └── utils/getTopicProgress.ts
├── public/pdfs/          course PDFs (fetched at image-build time, see docs 02/03)
└── backend -> ../src_cs/backend
```

`Study.tsx`/`study_zone/` + `pdfjs-dist`/`react-pdf` render textbook PDF
content in-app; `Data.tsx`/`data_table/` likely backs data-driven
science content (check current source for specifics — this area evolves
independently of docs, verify against the code). Unity WebGL content
(`react-unity-webgl`) is used for interactive simulations — if you're
adding one, check how existing usages load their Unity build output
before assuming a pattern.

### Calling the backend

Both apps call the shared backend directly with `fetch`, hardcoded to
`http://localhost:8000` (see `src_cs/src/pages/Settings.tsx` for the
canonical example: `/api/power`, `/api/updates`, `/api/rollback`; Wi-Fi
lives similarly in `src_phy`'s `components/settings/wifi.tsx`). There is
no shared API client/wrapper between the two apps (they're separate
projects) — if you fix a bug in how one app calls the backend, check
whether the same bug exists in the other app's equivalent call.

### Building and where output goes

```sh
npm install
npm run build     # → dist/
```

`post-build.sh` (full image build) does exactly this, then moves
`dist/*` into `/root/www/build` (`src_cs`) or `/root/www/learn`
(`src_phy`). `ci_builder.yml` (the OTA release builder) does the same
build and packages the `dist/` output directly into the release zip
under `build/`/`learn/`. **These two build paths (image build vs. OTA
release build) run independently** — if your change only shows up
correctly in one of them, that's a sign something environment-specific
(a hardcoded path, an env var) differs between the two; check both
`post-build.sh` and `ci_builder.yml` when debugging a "works locally,
broken on device" report.

### Linting, testing, vulnerability checks

`npm run lint` (ESLint, config in `eslint.config.js`) and
`npm audit --audit-level=critical` both run in CI (`cs_test.yml`/
`phy_test.yml`) on every PR, alongside a build check. There are
currently no unit/component tests configured (the workflows have a
commented-out placeholder for adding them later) — manual testing in the
dev server, and ideally on real hardware or at least a similarly
constrained environment, is expected for anything non-trivial.

### Performance mindset

This is 1GB-RAM, Pi-3-class hardware running a full Chromium plus a
backend plus two other httpd servers, with `--js-flags="--max-old-space-size=256"`
constraining each renderer to 256MB (see `S60cage` in doc 04). Heavy
client-side work (large in-memory datasets, unbounded list rendering,
big synchronous JSON parses) will hurt more here than on typical
development hardware — test perceived performance with CPU/memory
throttling in devtools at minimum, and prefer it on real hardware before
merging anything content- or interaction-heavy.
