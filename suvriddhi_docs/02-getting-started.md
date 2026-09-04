# Getting Started

There are three separate things you can "run" in this repo, and they
need very different amounts of setup. Figure out which one you actually
need before you start:

| I want to... | What to do | Needs a Pi? |
|---|---|---|
| Change the coding or physics app's UI | Run `src_cs`/`src_phy` with `npm run dev` | No |
| Change backend API behavior | Build `src_cs/backend` and run it locally | No |
| Change boot scripts, packages, kernel config, or anything OS-level | Build a full Buildroot image | Yes, to test on real hardware (QEMU can get you partway) |

Most day-to-day frontend/backend work never requires building the full
OS image. Save the full Buildroot build for when you're actually
touching `configs/`, `board/`, `package/`, or the kernel.

## Prerequisites

- **Node.js 22** (matches CI in `.github/workflows/`) and `npm`, for
  `src_cs` and `src_phy`.
- **A C++17 compiler** (`g++`) and **libcivetweb-dev** for the backend
  (`sudo apt-get install build-essential libcivetweb-dev` on Debian/
  Ubuntu — see `cpp_checker.yml` for the exact CI package list).
- **`clang-format`** if you want to run `make format` in the backend.
- **A Linux host** (or a Linux VM/container) is strongly recommended for
  anything touching Buildroot itself — cross-compiling a full OS from
  macOS is possible but not what CI does, and not what's documented here.
- **Plenty of disk space and time** for a full Buildroot build (expect
  tens of GB and an hour+ on first build — it builds a whole toolchain,
  kernel, and root filesystem from source).

## 1. Running the frontend apps locally

```sh
cd src_cs        # or src_phy
npm install
npm run dev       # starts a Vite dev server, hot reload, no Pi needed
```

This gives you the app in your regular browser at whatever localhost
port Vite prints. API calls to `http://localhost:8000/api/...` will fail
unless you also run the backend locally (see below) — the Settings page
(Wi-Fi/power/updates/rollback) in particular needs the backend, and some
of those actions (`system()` calls to `wpa_supplicant`, `reboot`, etc.)
only make sense on the real device — expect them to fail harmlessly on
your dev machine.

To produce the static build the OS actually ships (what CI does):

```sh
npm run build      # outputs to dist/
```

## 2. Running the backend locally

```sh
cd src_cs/backend
make               # builds ./server
./server           # listens on :8000
```

Notes:

- The backend expects `/root/codes` to exist (`kSaveDir` in
  `helpers/common.h`) or it exits immediately with "kSaveDir doesn't
  exist" — `mkdir -p /root/codes` (or wherever you've pointed it, if you
  change the constant for local testing) before running it, or run it as
  a user that can create `/root`-owned paths (typically means running as
  root, matching the device, or patching the path locally — don't commit
  a path change meant only for local testing).
- Endpoints that shell out to device-specific binaries
  (`wpa_supplicant`, `/etc/init.d/S60cage`, `reboot`, `poweroff`,
  `/etc/init.d/update.sh`) will fail or do nothing useful off-device.
  That's expected — test those against real hardware or a VM that
  mirrors the rootfs overlay.
- `make format` runs `clang-format` over the backend using the repo's
  `.clang-format`.
- `make clean` removes `build/` and the `server` binary.

## 3. Building the full OS image

This is what you'd do to produce a flashable SD card locally.

```sh
# from repo root
make suvriddhi_defconfig     # loads configs/suvriddhi_defconfig
make                          # builds toolchain, kernel, all packages, and the image
```

This is a standard Buildroot build — see
[03-buildroot-guide.md](./03-buildroot-guide.md) for what's happening
under the hood, how to change what's included, and how long to expect it
to take. The output image goes to `output/images/` (standard Buildroot
layout) and can be flashed to an SD card, or booted in QEMU for aarch64
if you want to sanity-check boot behavior without hardware.

Two things happen automatically during this build that are easy to miss:

- `board/raspberrypi3-64/post-build.sh` runs **after** Buildroot finishes
  building packages but **before** the final image is assembled. It
  downloads Wi-Fi firmware and course PDFs from the internet, builds both
  frontend apps (`npm install && npm run build`), copies their output
  into the rootfs, and cross-compiles the backend against the Buildroot
  sysroot. **This means a full image build requires internet access**
  and will fail offline.
- The rootfs overlay (`board/raspberrypi/rootfs-overlay`) is applied on
  top of whatever `post-build.sh` produced, per `BR2_ROOTFS_OVERLAY`.

## 4. Producing/testing an OTA update payload

If you want to test the update mechanism itself (not just build an
image), see [05-ota-update-and-rollback.md](./05-ota-update-and-rollback.md)
— the payload is exactly what `ci_builder.yml` zips up, and you can
reproduce it locally by running the same build steps that workflow runs.

## Where to go next

- New to Buildroot? Read [03-buildroot-guide.md](./03-buildroot-guide.md).
- New to how Linux boots / what an init script is? Read
  [04-linux-fundamentals-and-boot.md](./04-linux-fundamentals-and-boot.md).
- Just want to ship a frontend or backend change? You can likely skip
  straight to [06-backend-development.md](./06-backend-development.md) or
  [07-frontend-development.md](./07-frontend-development.md), but skim
  [01-architecture-overview.md](./01-architecture-overview.md) first so
  you know what you're plugging into.
