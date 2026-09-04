# Navigating a ~8.4Million Line Repo

The repo is large, but almost none of that size is SuvriddhiOS-specific
code. This doc tells you what to actually pay attention to, and gives
some general tips for growing your understanding of the codebase over
time.

## The story behind the lines of code

Running `wc -l` over every git-tracked file in the repo gives **8.3M**
lines. That number is real, but it's almost meaningless as a measure of
"how much code is here" — `wc -l` doesn't know binary from text, so it
happily counts `0x0A` bytes inside compiled binaries, WASM blobs, and
video files as if they were lines of source. Here's where it actually
comes from:

| Layer | Raw "lines" | What it really is |
|---|---|---|
| Upstream Buildroot (`package/`, `boot/`, `linux/`, `toolchain/`, `fs/`, `arch/`, `system/`, `support/`, `utils/`, legacy configs) | ≈972K | Vendored, ~3,000-package upstream tree — see the section below |
| `src_phy`'s Unity WebGL simulation content | ≈857K | 41 physics/chem/maths simulations, each shipping its own copy of Unity's compiled engine (`Build/*.wasm`, `*.data`, `*.framework.js`) plus course videos (`Vids/*.mp4`) — **binary and generated output, not source** |
| `src_cs/backend/libs/json.hpp` | 25.5K | Vendored [nlohmann/json](https://github.com/nlohmann/json) single-header library — one file, not written for this project |
| Everything else (`configs/`, `board/raspberrypi/`, `src_cs/`, `src_phy/` app code, `suvriddhi_docs/`) | **≈95K** | **The actual SuvriddhiOS-authored codebase** |

That last row — **~95,000 lines** — is the number that matters if
you're asking "how much is there for a contributor to actually
understand." It splits roughly as:

| Directory | Lines | Files |
|---|---|---|
| `configs/` | 410 | 4 |
| `board/raspberrypi/` | ~1K | 30 |
| `src_cs/` (app + backend, excluding vendored `json.hpp`/binaries) | ~48K | 245 |
| `src_phy/` (app, excluding Unity/video blobs) | ~44K | 192 |
| `suvriddhi_docs/` | ~1.5K | 9 |

## What's "ours" vs. upstream Buildroot

| Directory | What it is | How often you'll touch it |
|---|---|---|
| `configs/suvriddhi_defconfig` | Our release config | Occasionally — when changing what packages ship |
| `board/raspberrypi/` (+ `raspberrypi3-64` symlink) | Our rootfs overlay, patches, post-build/post-image scripts | Occasionally — boot behavior, OS-level changes |
| `home/` | Static kiosk shell | Occasionally |
| `src_cs/`, `src_phy/` | The two learning apps | Often — most day-to-day work happens here |
| `src_cs/backend/` (shared with `src_phy`) | The C++ API service | Often, but more carefully |
| `.github/workflows/` | CI/CD, including the OTA release builder | Rarely, but high-impact when you do |
| `uBlock_extn/` | Vendored browser extension | Rarely — treat as third-party |
| `Config.in`, `Config.in.legacy`, `Makefile`, `Makefile.legacy`, `package/`, `boot/`, `linux/`, `toolchain/`, `fs/`, `arch/`, `system/`, `support/`, `utils/` | **Stock upstream Buildroot** | Essentially never directly — you interact with these *through* `menuconfig`/defconfig, not by hand-editing |

`package/` alone is ~3,000 directories and is almost entirely upstream
Buildroot package definitions for software SuvriddhiOS doesn't even use
— it's there because Buildroot ships its whole package catalog, not just
the subset we've enabled. **Don't `grep` your way through `package/`
looking for SuvriddhiOS logic** — you won't find any there except in the
handful of packages we actually added ourselves (`package/chromium/` is
the one to know).

Similarly, if you ever see a huge, generic-looking tree of system
headers or libraries checked in somewhere unexpected (e.g. deep under a
rootfs-overlay `usr/include` or `usr/lib`), that's very likely build
output or a vendored sysroot snapshot, not something meant to be
hand-edited — if you're unsure whether something is generated/vendored
vs. hand-authored, check whether it's referenced by a `.mk`/build script
before assuming it's source you should modify.

## The "real" SuvriddhiOS codebase, roughly by line count

If you strip out upstream Buildroot infrastructure, the project is
actually fairly small and fits the mental map in
[01-architecture-overview.md](./01-architecture-overview.md):

- Two Vite/Preact SPAs (`src_cs`, `src_phy`) — TypeScript/TSX
  components + JSON content data.
- One small C++ HTTP service (`src_cs/backend`) — a couple thousand
  lines across a dozen-ish files.
- A handful of POSIX shell scripts (`board/raspberrypi/rootfs-overlay/etc/init.d/`,
  `post-build.sh`, `post-image.sh`).
- A small static HTML/CSS/JS shell (`home/`).
- One defconfig and a handful of CI YAML files.

That's genuinely most of what you need to hold in your head to make
architectural decisions here — the rest of the repo's size is Buildroot
being Buildroot.

## How to find things quickly

- **"What does this endpoint do?"** → start at `src_cs/backend/main.cpp`
  (the full route table), then follow into `code/` or `settings/`.
- **"What happens at boot?"** → `board/raspberrypi/rootfs-overlay/etc/init.d/`,
  read files in `S`-number order (see doc 04).
- **"Where does this piece of UI live?"** → `src_cs/src/pages/` or
  `src_phy/src/pages/` first (routes), then `components/<feature>/`.
- **"Where does this lesson/exercise content come from?"** → `public/data/`
  in `src_cs` (mostly JSON) or `public/pdfs/` in `src_phy`; it's data,
  not code — see doc 07.
- **"What ships in the OS image?"** → `configs/suvriddhi_defconfig`,
  read top to bottom (it's short); see doc 03.
- **"How does a code change reach a device?"** → doc 05, start from
  `.github/workflows/ci_builder.yml`.
- **Full-text search**: prefer scoping your search to
  `src_cs/src`, `src_phy/src`, `src_cs/backend`, `home/`,
  `board/raspberrypi/rootfs-overlay`, `.github/workflows`, and
  `configs/` rather than the whole repo — searching all of `package/`
  will bury you in unrelated upstream Buildroot matches.

## Growing your understanding over time

- **Read this whole `suvriddhi_docs/` folder once, fully, before your
  first non-trivial change** — it's designed to be readable start to
  finish in under an hour and front-loads the context that would
  otherwise take weeks of tribal knowledge to pick up.
- **Trace one full user action end-to-end at least once.** For example:
  student clicks "Check for updates" in Settings → `fetch` call →
  `handle_update` in the backend → `update.sh` → next boot's `S55git`.
  Doing this once for the update flow (doc 05) and once for a normal
  page load/API call (docs 01, 06, 07) will teach you more about how the
  pieces fit together than reading any single file in isolation.
- **When you don't understand why something is the way it is, look for
  a comment, then look at git history (`git log -p <file>`), before
  assuming it's arbitrary.** Several things that look odd at first
  glance (the `S55git` name, the `system()`-heavy style, the single-slot
  rollback) have real reasons documented here or discoverable in history.
- **Treat `configs/suvriddhi_defconfig` and the `etc/init.d/` scripts as
  the two files most worth being able to read fluently**, even if you
  mostly work on frontend/backend code — they're short, they explain a
  disproportionate amount of "why does the OS behave this way," and
  they're the highest-blast-radius things in the repo (see doc 08).
- **When you're ready to make an architectural decision** (adding a new
  service, changing how the update system works, restructuring how
  content is delivered), re-read doc 01 and doc 05 first — most
  "obvious" changes to this kind of system have a non-obvious interaction
  with the OTA/rollback model or the boot sequence, and it's much
  cheaper to catch that on paper than after it's deployed to devices in
  a school.
- **Ask early.** This is a small, tight system by design — a five-minute
  question to someone who's touched the update flow or backend before
  can save hours of re-deriving context that isn't fully written down
  anywhere (including here — this doc reflects the repo as read on one
  pass, not as a promise it never drifts).
