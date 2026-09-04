# Architecture Overview

## The one-paragraph version

SuvriddhiOS is a Buildroot Linux image that boots to a full-screen
Chromium browser (via the Cage Wayland compositor) pointed at
`http://127.0.0.1:8080`. That page is a static "home screen" served by
BusyBox `httpd`. It links out to two more BusyBox `httpd` instances
(ports 8081 and 8082) which each serve a pre-built Preact/Vite web app —
one teaches coding, the other physics/chemistry/maths — plus a set of
curated external education sites (Khan Academy, PhET, Wikipedia, etc.).
A single C++ backend process, listening on port 8000, provides the API
both apps call for code execution, Wi-Fi, power, and OTA update/rollback.
Everything a student sees is a web page; there is no traditional desktop
environment or window manager beyond Cage running one fullscreen browser.

## System diagram

```
                         ┌─────────────────────────────────────────┐
                         │              Raspberry Pi 3B+            │
                         │        (SuvriddhiOS / Buildroot Linux)   │
                         └─────────────────────────────────────────┘
 Boot:  BusyBox init → /etc/inittab → /etc/init.d/S##name scripts, in order
   S03Resize   → grow SD card partition + filesystem (first boot only)
   S55git      → apply staged OTA update, if any (see doc 05)
   S57swap     → ensure 2GB swapfile is on and active
   S60cage     → bring up Wi-Fi, start backend + web servers, launch kiosk
                         │
                         ▼
        ┌───────────────────────────────────────────────────────┐
        │  /root/server  (C++17 / civetweb, port 8000)           │
        │  /api/compile /api/run  — sandboxed-ish code exec      │
        │  /api/save /api/load /api/list — saved-code storage    │
        │  /api/python             — Python execution             │
        │  /api/wlan               — Wi-Fi join                   │
        │  /api/power              — restart / shutdown           │
        │  /api/updates            — trigger OTA update            │
        │  /api/rollback           — revert to previous release    │
        └───────────────────────────────────────────────────────┘
                         ▲  (fetch calls from the browser)
                         │
        ┌────────────────────────────┬────────────────────────────┐
        │ BusyBox httpd :8080        │ BusyBox httpd :8081/:8082   │
        │ /root/www  (home shell)    │ /root/www/build  (src_cs)   │
        │ static HTML/CSS/JS         │ /root/www/learn  (src_phy)  │
        └────────────────────────────┴────────────────────────────┘
                         │
                         ▼
        ┌───────────────────────────────────────────────────────┐
        │  cage -- chromium-browser --kiosk ... http://127.0.0.1:8080 │
        │  (Wayland compositor + browser, fullscreen, uBlock loaded)  │
        └───────────────────────────────────────────────────────┘
```

## The pieces, in more depth

### 1. Buildroot (the OS itself)

Everything under `package/`, `boot/`, `linux/`, `toolchain/`, `fs/`,
`arch/`, `system/` and the top-level `Makefile`/`Config.in` is stock
Buildroot machinery — it compiles a cross toolchain, the Linux kernel,
and every userspace package (BusyBox, Mesa, Wi-Fi tools, Python, etc.)
into a bootable image. See [03-buildroot-guide.md](./03-buildroot-guide.md).

SuvriddhiOS-specific choices live in **`configs/suvriddhi_defconfig`**
(the release config for the RPi target) and a small number of custom
packages, notably **`package/chromium`** (`BR2_PACKAGE_RPI_CHROMIUM`),
which pulls a prebuilt Chromium from the Raspberry Pi OS repos rather
than building it from source (building Chromium from source on a Pi-class
cross toolchain is impractical).

### 2. The rootfs overlay (SuvriddhiOS-specific OS files)

`board/raspberrypi/rootfs-overlay/` is copied verbatim on top of the
Buildroot-built root filesystem. This is where almost all of our
"OS-level" code lives:

- `etc/init.d/S##name` — boot-time init scripts (see doc 04).
- `etc/init.d/update.sh` — the OTA update puller (see doc 05).
- `root/server` — placeholder for the built backend binary (built and
  copied in at image-build time, see doc 06).
- `root/codes/` — scratch directory backend handlers use.

> Note: `configs/suvriddhi_defconfig` points `BR2_ROOTFS_OVERLAY` at
> `board/raspberrypi3-64/rootfs-overlay`, but `board/raspberrypi3-64` is
> actually a **symlink to `board/raspberrypi`**, so both paths resolve to
> the same overlay tree. Don't be confused if you see both names used —
> there is only one overlay directory.

### 3. The two learning apps

- **`src_cs`** — "SuvriddhiCode". Preact + Vite + Tailwind + Zustand +
  the Ace code editor. Teaches programming: guided lessons ("Learn"),
  timed drills ("Train"), a free-form sandbox, and per-language exercise
  content sourced from JSON under `src_cs/public/data/`.
- **`src_phy`** — the physics/chemistry/maths app. Same stack (Preact +
  Vite + Tailwind + Zustand), plus `react-pdf`/`pdfjs-dist` for textbook
  PDFs, Tiptap for rich text, and `react-unity-webgl` for embedded Unity
  WebGL simulations. It also owns the **Settings** UI used by both apps
  (Wi-Fi, power, updates, rollback).

Both are ordinary Vite SPAs; they are built (`npm run build`) into
static `dist/` output and dropped into `/root/www/build` and
`/root/www/learn` respectively — the backend they talk to is not bundled
with them, it's the shared civetweb process on port 8000. See
[07-frontend-development.md](./07-frontend-development.md).

### 4. The backend

`src_cs/backend` (symlinked into `src_phy/backend` so both apps can
reference "their" backend at the same relative path) is a single C++17
program using [civetweb](https://github.com/civetweb/civetweb) as an
embedded HTTP server. It has two jobs:

1. **Code execution sandboxing-ish**: compile/run student C code and run
   Python snippets, for the "Sandbox"/"Train" features.
2. **Device settings**: Wi-Fi join, power (restart/shutdown), and the
   OTA update/rollback triggers — i.e. it's also the privileged agent
   that's allowed to run `system()` calls the browser sandbox can't.

See [06-backend-development.md](./06-backend-development.md) — including
its current, known security limitations (no sandbox around compiled
student code, `system()`-based Wi-Fi provisioning), which are things a
new contributor should understand rather than "fix" casually.

### 5. The home shell

`home/` is plain HTML/CSS/JS — no framework, no build step. It's copied
directly into `/root/www` and is what the kiosk browser loads first. It
provides the wallpaper picker, clock, search bar, offline banner, the two
app-launcher cards (linking to :8081/:8082), and the dock of external
site links plus a settings shortcut into `src_phy`'s `#/settings` route.

### 6. CI/CD

`.github/workflows/` builds both apps, compiles the backend, and — on
every push to `main` — assembles a `suvriddhi.zip` release artifact via
`ci_builder.yml`. That artifact **is** the OTA update payload. See doc 05
for the full lifecycle from "PR merged" to "device running new code."

## Why this design?

- **Kiosk browser instead of a native desktop**: cheapest way to give
  students a rich, animated UI on underpowered hardware while reusing the
  huge web ecosystem (fonts, layout, PDF rendering, WebGL) instead of
  writing native GTK/Qt apps.
- **Static content over three ports instead of one app server**: keeps
  the privileged backend (which can run shell commands) small,
  auditable, and separate from "just serving files," and lets each
  learning app be built/deployed independently.
- **A single OTA zip instead of full image re-flashing**: SD-card
  re-flashing requires physical access to every unit; a zip-based update
  lets most of the system evolve remotely. The trade-off is that a few
  things (see doc 05) genuinely can't be updated this way and need a
  pre-planned SD-card swap.
