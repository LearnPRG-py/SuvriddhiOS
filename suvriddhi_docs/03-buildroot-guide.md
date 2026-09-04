# Buildroot Usage Guide

This repo *is* a fork of [Buildroot](https://buildroot.org/), with
SuvriddhiOS's own configuration and overlay layered on top. If you've
never used Buildroot before, read this before touching `configs/`,
`package/`, `board/`, `boot/`, or `linux/`.

## What Buildroot actually does

Buildroot is a tool for generating a complete, minimal embedded Linux
system: it builds a cross-compilation toolchain, the Linux kernel, a
bootloader, and every userspace package you select, then assembles all
of it into a root filesystem image you can put on an SD card. There's no
package manager on the target device at runtime by design — everything
is decided and baked in at build time on your development machine (or
CI).

The key building blocks:

- **`Config.in`** (repo root) + **`package/*/Config.in`** — a Kconfig
  tree (the same system the Linux kernel itself uses) describing every
  option and package Buildroot knows how to build. `make menuconfig`
  (or `xconfig`/`nconfig`) gives you an interactive UI over this tree.
- **A `.config` file** — the *result* of picking options in that tree.
  You normally don't hand-edit this directly for anything but the
  smallest tweaks; you generate it from a defconfig, edit interactively,
  then save it back out.
- **A defconfig** — a minimal, human-curated subset of `.config`
  (only the options that differ from Buildroot's defaults) checked into
  version control. **`configs/suvriddhi_defconfig`** is ours — it's the
  actual source of truth for "what is SuvriddhiOS, package-wise."
- **`package/<name>/`** — one directory per buildable package, each with
  a `Config.in` (the menu entry) and a `<name>.mk` (the build recipe:
  where to fetch source, how to configure/build/install it). The vast
  majority of `package/` (~3,000 directories) is stock upstream
  Buildroot — you will only ever touch a handful of these.
- **`board/<name>/`** — board-specific files: kernel/DT config, a
  post-build script, a post-image script, patches, and the rootfs
  overlay. Ours is `board/raspberrypi/` (aliased as
  `board/raspberrypi3-64`).

## The SuvriddhiOS defconfig, annotated

`configs/suvriddhi_defconfig` is short (~115 lines) because Buildroot
defaults handle everything else. Reading it top to bottom tells you
almost everything about what's in the image:

- **Target/toolchain**: `BR2_aarch64`, external Bootlin AArch64 glibc
  toolchain — we don't build our own cross-GCC, we use a prebuilt one.
- **Kernel**: a specific Raspberry Pi kernel fork/commit
  (`BR2_LINUX_KERNEL_CUSTOM_TARBALL_LOCATION`, pinned to a commit hash),
  `bcm2711` defconfig, with in-tree device trees for the Pi 3B/3B+/CM3.
- **Rootfs overlay + post-build/post-image scripts**: wire in
  `board/raspberrypi/rootfs-overlay`, `post-build.sh`, `post-image.sh`.
- **Display/graphics**: Mesa3D with the VC4 Gallium driver (the Pi's
  GPU), OpenGL ES, Cage (kiosk Wayland compositor), `psplash` (boot splash,
  using `src_cs/public/logo.jpg` as the splash image).
- **Browser**: `BR2_PACKAGE_RPI_CHROMIUM` — our own package
  (`package/chromium/`) pulling a prebuilt Chromium from Raspberry Pi OS's
  own repos rather than building it from source under Buildroot (building
  Chromium under a cross toolchain for an SBC is impractical time- and
  resource-wise).
- **Networking**: `wpa_supplicant`, `iw`, `brcmfmac` SDIO firmware for
  the Pi 3's onboard Wi-Fi chip, `wireless-regdb`/`crda` (regulatory
  domain), NTP.
- **Python + libraries**: `python3`, `flask`, `numpy`, `matplotlib`,
  `requests`, `pytest`, etc. — supports the "learn Python" features in
  `src_cs` (student code actually executes on-device).
- **Media**: GStreamer with a curated set of plugins (playback,
  videoconvert, audioresample, isomp4, videofilter, videoparsers) — used
  for the video-based course content and, indirectly, Chromium's own
  media pipeline.
- **Filesystem**: ext2/ext4-family rootfs, sized 4G (grown further at
  first boot by `S03Resize`, see doc 04), plus `resize2fs` and
  `e2fsprogs` on-target to make that possible.
- **Misc userspace**: `nano`, `sqlite`, `dbus`, `libdrm`, `civetweb`
  (the backend's HTTP library), BusyBox `httpd` (serves the static app
  bundles), `haveged` (entropy for a headless SBC without a good hardware
  RNG source), `nss`/`libopenssl` (needed for HTTPS: updates, Wi-Fi test
  pings, PDF/course downloads at build time).

## Common tasks

### Changing what's installed on the device

```sh
make menuconfig            # interactively browse/toggle options
# ... make your change(s) ...
make savedefconfig BR2_DEFCONFIG=configs/suvriddhi_defconfig
```

`savedefconfig` is important: it writes back only the minimal diff
against Buildroot defaults, so the defconfig stays small and readable.
**Never hand-append raw `.config` output to the defconfig** — it'll be
full of noise and make future diffs unreadable.

### Adding a brand-new package

If you need a library/tool that isn't already in Buildroot's package
tree, you add a new `package/<name>/Config.in` +
`package/<name>/<name>.mk`, following the pattern of an existing simple
package (`package/chromium/` is a good, short example of a "prebuilt
binary" style package). Then enable it via `menuconfig` and
`savedefconfig` as above.

> **This is one of the four things that can't ship as an OTA update** —
> see [05-ota-update-and-rollback.md](./05-ota-update-and-rollback.md).
> A new Buildroot package changes the base image, not just
> `/root/www`/`/root/server`, so it requires a full rebuild + re-flash
> (or a pre-planned SD-card swap) across the fleet.

### Changing kernel config or device tree

Kernel options live under `BR2_LINUX_KERNEL_*` in the defconfig plus a
`bcm2711`-based defconfig fragment; device-tree overlays/config for the
board live in `board/raspberrypi/` and `board/raspberrypi3-64/config_*`.
Treat kernel/DT changes with extra care — they affect boot reliability on
every device in the field.

### Patching an upstream package or the kernel

`BR2_GLOBAL_PATCH_DIR="board/raspberrypi/patches"` — Buildroot
auto-applies any patch found here (organized by package name) during
that package's build. This is the sanctioned way to carry a small
downstream fix without forking the whole package.

### Rebuilding just one package

```sh
make <pkgname>-rebuild
```

(useful during iteration — a full `make` re-checks everything but only
rebuilds what changed, this forces one package regardless).

### Cleaning

```sh
make clean       # removes build output, keeps downloaded sources + config
make distclean    # nukes everything including .config — start fresh
```

## Where post-build/post-image fit in

`board/raspberrypi3-64/post-build.sh` runs after all Buildroot packages
are built but before the image is finalized — this is where
SuvriddhiOS-specific, non-Buildroot-native steps happen: fetching Wi-Fi
firmware, fetching course PDFs, `npm run build`-ing `src_cs`/`src_phy`,
and cross-compiling the backend. It has network access and is **not**
sandboxed the way normal package builds are, so it's also the easiest
place to accidentally introduce a non-reproducible build (pinned URLs
with no hash-check, for instance) — be deliberate about anything you add
here.

`post-image.sh` (referenced by defconfig, `BR2_ROOTFS_POST_IMAGE_SCRIPT`)
runs after the final image file is generated — typically used for
partition-table/`genimage` style assembly for the SD card image.

## Learning more about Buildroot itself

The upstream [Buildroot manual](https://buildroot.org/downloads/manual/manual.html)
is the canonical reference for anything not specific to SuvriddhiOS —
package `.mk` syntax, `BR2_*` option semantics, cross-compilation
concepts, etc. This doc only covers what's specific to how *we* use it.
