# SuvriddhiOS

This is the new primary suvriddhi OS repo post migration (needed repo settings access).

SuvriddhiOS is a lightweight, custom Linux distribution built to run on
inexpensive Raspberry Pi 3B+ class hardware (roughly $50-80/unit) and put
in front of underprivileged students. It boots straight into a kiosk-mode
browser session showing a curated "desktop" with two built-in learning
apps (coding, and physics/chemistry/maths) plus links to vetted external
educational sites. It is currently deployed on real hardware in schools,
which means changes here have real consequences for real classrooms —
read [suvriddhi_docs/08-contribution-guidelines.md](./suvriddhi_docs/08-contribution-guidelines.md)
before you open a PR.

This repo is a fork of [Buildroot](https://buildroot.org/) (~2.3M lines
total) with SuvriddhiOS-specific additions layered on top. Almost all of
that line count is vendored Buildroot package infrastructure and headers
you will never touch — see
[suvriddhi_docs/09-navigating-the-repo.md](./suvriddhi_docs/09-navigating-the-repo.md)
for what actually matters.

## Documentation

Full architecture, build, and contribution docs live in
[`suvriddhi_docs/`](./suvriddhi_docs/). If you are brand new to the
project, Linux, and/or Buildroot, read in this order:

1. **[01-architecture-overview.md](./suvriddhi_docs/01-architecture-overview.md)**
   — the big picture: what runs where, and how the pieces talk to each
   other. Start here even if you only plan to touch the frontend.
2. **[02-getting-started.md](./suvriddhi_docs/02-getting-started.md)**
   — get a dev environment running and produce your first image / your
   first local build of the apps.
3. **[03-buildroot-guide.md](./suvriddhi_docs/03-buildroot-guide.md)**
   — what Buildroot is, how `suvriddhi_defconfig` works, and how to
   change what ships in the OS image.
4. **[04-linux-fundamentals-and-boot.md](./suvriddhi_docs/04-linux-fundamentals-and-boot.md)**
   — how Linux boots on this device, what an init script (`rcS`-style
   `/etc/init.d/S##name`) actually is, and a walkthrough of every script
   we ship.
5. **[05-ota-update-and-rollback.md](./suvriddhi_docs/05-ota-update-and-rollback.md)**
   — the over-the-air update system in detail: how a build becomes a
   release, how a device pulls it, applies it, and can roll it back.
6. **[06-backend-development.md](./suvriddhi_docs/06-backend-development.md)**
   — the C++ civetweb API service (code execution + device settings).
7. **[07-frontend-development.md](./suvriddhi_docs/07-frontend-development.md)**
   — the two Preact/Vite apps (`src_cs`, `src_phy`) and the static home
   shell.
8. **[08-contribution-guidelines.md](./suvriddhi_docs/08-contribution-guidelines.md)**
   — how to propose changes safely, including the mandatory human review
   of AI-generated code.
9. **[09-navigating-the-repo.md](./suvriddhi_docs/09-navigating-the-repo.md)**
   — tips for finding your way around a large repo, and a map of what's
   "ours" vs. upstream Buildroot.

## Quick facts

| | |
|---|---|
| Base | Buildroot (aarch64 target) |
| Target hardware | Raspberry Pi 3B+ / CM3 (bcm2710/bcm2711 device trees) |
| Display stack | Cage (Wayland kiosk compositor) + Mesa/VC4 + Chromium (kiosk mode) |
| Apps | `src_cs` (coding), `src_phy` (physics/chem/maths), both Preact + Vite |
| Backend | Single C++17 binary (`civetweb`) serving a JSON API on port 8000 |
| Static content ports | 8080 = home shell, 8081 = `src_cs` build, 8082 = `src_phy` build |
| Update mechanism | GitHub Releases zip, staged and applied on next boot |
| Current deployment | Pilot units in field use — see [08](./suvriddhi_docs/08-contribution-guidelines.md) |
