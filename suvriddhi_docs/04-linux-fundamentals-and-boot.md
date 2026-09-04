# Linux Fundamentals & Boot: How SuvriddhiOS Starts Up

This doc is for anyone who hasn't worked with embedded Linux init
systems before. It explains, from first principles, what happens between
power-on and a student seeing the home screen, and how our
`/etc/init.d/S##name` scripts fit into that.

## 1. What runs before our scripts even start

1. **Firmware/bootloader**: the Pi's GPU firmware loads, reads
   `config.txt`/`cmdline.txt` (from `board/raspberrypi3-64/config_3_64bit.txt`
   and `cmdline.txt`, packaged via `BR2_PACKAGE_RPI_FIRMWARE_*`), and
   loads the Linux kernel.
2. **Kernel boot**: the kernel initializes hardware, mounts the root
   filesystem (the ext4 image Buildroot built), and finally executes
   `/sbin/init` (PID 1) — the very first userspace process.
3. **`/sbin/init` (BusyBox init)**: SuvriddhiOS uses BusyBox's `init`
   applet, not systemd. BusyBox `init` reads **`/etc/inittab`** to decide
   what to run. A minimal, common inittab pattern (Buildroot's default,
   which we largely keep) runs a script called **`/etc/init.d/rcS`** as
   part of the `sysinit` step.

## 2. What "`rcS`" means, concretely

"`rcS`" isn't magic — it's just a shell script, conventionally named
`rcS`, whose entire job is: *look in `/etc/init.d/`, find every file
matching `S<number><name>`, and run them in ascending numeric order.*
This is the classic SysV-init convention, and BusyBox's `init`/`rcS`
implementation follows it exactly:

- `S` prefix = "**s**tart this on boot" (there's a matching `K` prefix
  convention for shutdown scripts in full SysV init, though our rootfs
  overlay only ships `S`-prefixed scripts).
- The number (`03`, `55`, `57`, `60`, ...) is purely an **ordering key**
  — lower numbers run first. Gaps between numbers (03 → 55 → 57 → 60) are
  intentional/conventional, leaving room to insert a new script between
  two existing ones later without renumbering everything.
- The name after the number is just a label; it has no functional
  meaning to `init` itself.
- Each script is expected to support at least `start`/`stop` (and often
  `restart`) as its argument, `rcS` invokes it as `S60cage start`.

**This is the single most important mental model for this repo**: adding
a new boot-time behavior means adding a new `/etc/init.d/S<NN><name>`
file to `board/raspberrypi/rootfs-overlay/etc/init.d/`, executable,
implementing a `start`/`stop` case statement, and picking `NN` based on
*what it depends on already being ready*.

## 3. Our boot sequence, script by script

All of these live in
`board/raspberrypi/rootfs-overlay/etc/init.d/` and run in this order on
every boot:

### `S03Resize`

**Problem it solves**: the SD card image is built at a fixed size (4G
per the defconfig), but real SD cards are much larger. If we don't grow
the filesystem, most of the card is wasted.

**How it works**: it's a two-phase, self-rebooting script:
1. If the partition hasn't been resized yet (tracked via
   `/etc/.partition_resized`), it feeds `fdisk` a scripted sequence
   (delete partition 2, recreate it starting at the same sector but
   extending to the end of the disk), writes the flag file, and forces a
   `reboot` — because the kernel needs to re-read the partition table,
   which is unsafe to do live on the running root partition.
2. On the *next* boot, phase 2 runs: `resize2fs` grows the ext4
   filesystem to fill the now-larger partition, and a second flag file
   (`/etc/.filesystem_resized`) prevents this from repeating.

**Why it's first (S03)**: everything else — swap, updates, the app data
— wants the full disk available, and this needs to run before anything
else writes meaningfully to disk.

### `S55git`

Despite the name (a historical leftover — worth renaming if you're ever
touching this file, but note the number is what matters functionally,
not the name), **this script has nothing to do with `git`. It's the OTA
update *apply* step.**

**How it works**: it checks for `/root/www_new`, a staging directory
that `update.sh` (see below, and doc 05) creates when a new release has
been downloaded. If present, it:
1. Backs up the current `/root/www` to `/root/www.old` (this is what
   makes rollback possible).
2. Carries forward the `learn/pdfs` directory (course PDFs are large and
   not part of the OTA payload — they're preserved across updates rather
   than re-downloaded).
3. Moves over an updated `/etc/inittab` and any updated
   `/etc/init.d/*` scripts, if the release included them — **this is how
   the boot scripts themselves can be updated over the air**.
4. Moves over an updated backend binary (`/root/www_new/server` →
   `/root/server`).
5. Renames `/root/www_new` to `/root/www`.

**Why it's here (S55, before swap/cage)**: it must run before
`S60cage` starts serving the *old* `/root/www` — otherwise a device that
downloaded an update would boot back into the old version and only pick
up the new one on the *following* reboot. It runs after `S03Resize`
because... in principle order relative to the resize doesn't matter much,
but it's conservative to make sure disk space work is settled first.

See [05-ota-update-and-rollback.md](./05-ota-update-and-rollback.md) for
the complete update lifecycle (this script is only step 3 of 4).

### `S57swap`

**Problem it solves**: the Pi 3B+ has limited RAM (1GB), and Chromium +
Node-built SPAs + GStreamer + the backend can exceed it, especially with
many browser tabs/processes. Without swap, the OOM killer starts killing
things (often Chromium itself) under memory pressure.

**How it works**: on first boot (no `/root/swapfile` yet), it
`fallocate`s a 2GB file, locks its permissions (`chmod 0600` — a
world-readable swapfile is a local information-disclosure risk, since
swap can contain arbitrary process memory), and `mkswap`s it. Every boot,
it `swapon`s that file.

**Why it's after `S55git`**: no strong dependency, but a fresh device or
one that just applied an update should have its final disk layout
settled first; also no reason for it to block ahead of the update-apply
step.

### `S60cage`

The last script — this is what actually gets a student to a usable
screen. It:

1. Sets up XDG runtime dir and a Chromium user-data dir.
2. **Backgrounds** network setup (bring up `wlan0`, and — only if a
   previously-saved `/etc/wpa_supplicant.conf` with an `ssid` exists —
   join Wi-Fi, get a DHCP lease, and sync NTP time). This is
   intentionally backgrounded (`(...) &`) so a device with no saved
   Wi-Fi, or slow/absent internet, doesn't block booting to the kiosk UI
   — a student can start working offline immediately.
3. Starts `/root/server` (the C++ backend, port 8000) and three BusyBox
   `httpd` instances (8080/8081/8082, see doc 01) in the background.
4. Sleeps 5 seconds (crude but effective wait for those servers to be
   listening) then `exec`s `cage`, which takes over the process (via
   `exec`, so `cage`/Chromium become what `init` is tracking as this
   script's "process," which matters for restart/`stop` semantics) — a
   minimal Wayland compositor whose only job is to run one fullscreen
   client: `chromium-browser` in kiosk mode, with a long list of flags
   tuned for a constrained device (`--js-flags="--max-old-space-size=256"`,
   `--renderer-process-limit=2`, `--purge-memory-after-idle`, disabling
   background networking/sync/translate/speech features that have no use
   in a kiosk and only cost RAM/CPU), plus `--load-extension=/root/uBlock_extn`
   to filter content (used, among other things, to block age-inappropriate
   sites the curated dock doesn't already limit access to).
5. `stop()` kills chromium/httpd/cage by name — used by the backend's
   power/update/rollback handlers before a `reboot`/`poweroff`, so those
   processes don't hold the filesystem busy or fight the shutdown.

### `update.sh` (not `S`-prefixed — not run at boot)

This one is *not* part of the boot sequence (no `S` prefix, `rcS` won't
pick it up automatically). It's invoked on demand — currently only by the
backend's `/api/updates` handler (`system("/etc/init.d/update.sh &")`).
See doc 05 for what it does.

## 4. General Linux/embedded concepts worth knowing

- **No systemd here.** If you're used to `systemctl`/unit files from a
  desktop Linux distro, forget that model for this repo. Everything
  service-like is a plain shell script following the `S##name` /
  `start|stop|restart` convention above. There's no dependency graph
  resolver — ordering is 100% "the number in the filename," which is why
  reading the numbers in order (as done above) *is* reading the boot
  design.
- **`system()` calls dominate this codebase.** Both the init scripts and
  the C++ backend lean heavily on shelling out to standard Unix tools
  (`fdisk`, `resize2fs`, `wpa_supplicant`, `curl`, `unzip`, `reboot`)
  rather than using native APIs/libraries. This keeps the code short and
  readable at the cost of being harder to unit test and more sensitive to
  shell-quoting bugs — be careful with any user-controlled input that
  reaches a `system()` call (see doc 06 for a concrete example in the
  Wi-Fi handler).
- **A read-mostly root filesystem mindset, even though ours isn't
  strictly read-only.** Embedded devices that lose power mid-write can
  corrupt state. Notice how `S03Resize` and the update flow use flag
  files and staged directories (`www_new` → swap → rename) rather than
  editing things in place — that pattern (write to a new location, then
  atomically rename) is a deliberate way to reduce the chance of a
  power-loss-during-update leaving a device unbootable. Keep using it if
  you touch this code.
- **Everything after boot is "just a device serving a browser."** Once
  `S60cage` execs into `cage`, from the OS's perspective this is a
  single-purpose appliance. That's worth remembering when debugging: most
  "the OS is broken" reports are actually "the browser/backend/app is
  broken," and you can often debug much faster over SSH/serial by
  killing cage (`/etc/init.d/S60cage stop`) and poking at the backend or
  static files directly rather than reasoning about the whole boot chain.

## 5. Debugging boot issues

- Serial console / HDMI + keyboard access to the device (or a `getty`,
  though note the defconfig explicitly disables
  `BR2_TARGET_GENERIC_GETTY` — re-enable it temporarily on a test image
  if you need an interactive shell during bring-up debugging).
- `dmesg` / kernel log for hardware-level issues (Wi-Fi firmware,
  storage).
- Since our "services" are just scripts, you can always manually re-run
  a step: `sh /etc/init.d/S60cage stop`, edit/test something, `sh
  /etc/init.d/S60cage start` — no service manager to fight with.
- Remember `S03Resize` reboots the device by itself on first boot (by
  design) — don't mistake that for a crash when bringing up a fresh
  image for the first time.
