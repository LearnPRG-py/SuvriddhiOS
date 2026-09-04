# OTA Update & Rollback System

This is one of the most operationally important subsystems in the repo —
it's how fixes and features reach devices already deployed in schools
without physically touching them. Understand it fully before changing
any of the four scripts/handlers involved.

## The moving parts, at a glance

| Stage | Where it runs | File |
|---|---|---|
| 1. Build the release payload | GitHub Actions, on every push to `main` | `.github/workflows/ci_builder.yml` |
| 2. Trigger a device to fetch it | Backend, on demand | `src_cs/backend/settings/updates_handler.cpp` |
| 3. Download + stage it | On-device, background process | `board/raspberrypi/rootfs-overlay/etc/init.d/update.sh` |
| 4. Apply the staged update | On-device, next boot | `board/raspberrypi/rootfs-overlay/etc/init.d/S55git` |
| Undo the last update | Backend, on demand | `src_cs/backend/settings/rollback_handler.cpp` |

## Stage 1 — Building the release (`ci_builder.yml`)

On every push to `main`, CI:

1. `npm ci && npm run build` for both `src_phy` and `src_cs`.
2. Copies `home/` in as-is (the static shell).
3. Copies `board/raspberrypi/rootfs-overlay/etc/*` in — **this is how
   init scripts get updated over the air**: whatever is in `etc/init.d/`
   at the tip of `main` becomes part of the next release.
4. `make`s the C++ backend and copies the `server` binary in.
5. Zips the whole `release/` directory into `suvriddhi.zip`.
6. Publishes it as a GitHub Release tagged `build-<run_number>`, via
   `softprops/action-gh-release`.

The resulting release layout (inside the zip) is:

```
suvriddhi.zip
├── build/         ← src_cs dist/
├── learn/         ← src_phy dist/
├── etc/           ← full copy of the rootfs overlay's /etc (init.d, inittab, ...)
├── server         ← compiled backend binary
└── (home/*)       ← home shell HTML/CSS/JS, copied to the release root
```

This directly mirrors the on-device layout under `/root/www/` — see
Stage 4 for how it gets mapped in.

**Note the trigger is "push to `main`"**, not a manual/tagged release
step — every merge to `main` produces and publishes a new "latest"
release that devices will pull on their next OTA check. This is why
[08-contribution-guidelines.md](./08-contribution-guidelines.md) is not
optional reading: merging to `main` is not just "the code is in the
repo," it is one `update.sh` cycle away from running on every deployed
device.

## Stage 2 — A device decides to update

A student/teacher (or an admin) hits the "Check for updates" action in
the Settings UI (`src_cs`'s `Settings.tsx` / `src_phy`'s
`components/settings`), which does:

```js
fetch("http://localhost:8000/api/updates", { method: "POST" })
```

The backend handler:

```cpp
int handle_update(struct mg_connection *conn, void *) {
    system("/etc/init.d/update.sh &");
    // responds immediately with a message telling the user
    // an update has started and to leave the device on
    return 200;
}
```

It fires `update.sh` in the background and returns immediately — the
API is fire-and-forget from the frontend's perspective. There is
currently **no progress reporting or completion callback**: the UI's
message ("...wait until the restart in ~10 minutes...") is the only
feedback the user gets, because the device will simply reboot on its own
once the download+apply is done. Keep this UX contract in mind if you
touch this flow — a silent failure here (e.g. no internet) currently just
leaves the device running as before with no visible error, which is
intentional-but-crude: better than bricking a device, but a legitimate
area for improvement.

## Stage 3 — Downloading and staging (`update.sh`)

```sh
curl --max-time 600 -L -k -o /tmp/suvriddhi.zip \
  https://github.com/LearnPRG-py/SuvriddhiOS/releases/latest/download/suvriddhi.zip
mkdir -p /root/www_new
unzip -o /tmp/suvriddhi.zip -d /root/www_new
/etc/init.d/S60cage stop
sleep 1
reboot
```

- It always pulls **`releases/latest`** — there is no version pinning,
  staged rollout, or channel selection. Every device that checks for
  updates gets whatever the most recent `main` push produced. This is
  simple but means a bad merge to `main` can reach every device that
  happens to check for updates before it's caught.
- `-k` disables TLS certificate verification, and there is **no
  signature or checksum verification of the downloaded zip** — anyone
  who can MITM the connection or compromise the GitHub Release asset can
  push arbitrary code to run as root on every device that updates. This
  is a known, real limitation worth being aware of if you're
  reasoning about the security model — treat it as a standing risk, not
  something to silently "fix" as a side effect of an unrelated change.
- If either the download or unzip fails, it aborts *before* stopping
  cage or rebooting — a failed check-for-update should be a no-op from
  the user's point of view (device keeps running the current version).
- On success, it stops the kiosk (so no processes are holding files open
  under `/root/www` or the old `server` binary) and reboots. **The
  actual "install" doesn't happen here** — it happens in the *next*
  boot's `S55git`.

## Stage 4 — Applying the update on next boot (`S55git`)

```sh
if [ -d /root/www_new ]; then
    rm -rf /root/www.old
    mv /root/www /root/www.old
    mkdir -p /root/www_new/learn/pdfs
    if [ -d /root/www.old/learn/pdfs ]; then
        mv /root/www.old/learn/pdfs /root/www_new/learn/pdfs
    fi
    [ -f /root/www_new/etc/inittab ] && mv /root/www_new/etc/inittab /etc/inittab
    [ -d /root/www_new/etc/init.d ] && mv -f /root/www_new/etc/init.d/* /etc/init.d/
    [ -f /root/www_new/server ] && mv /root/www_new/server /root/server
    mv /root/www_new /root/www
fi
```

Step by step:

1. The *current* `/root/www` (what's actually serving right now) becomes
   `/root/www.old` — this single backup is what makes rollback possible,
   and it means **only one previous version is ever retained**. There is
   no multi-version history.
2. Course PDFs (`learn/pdfs`) are **not** part of the OTA zip (they're
   large, fetched separately at image-build time) and are explicitly
   carried forward from the old tree into the new one so an update
   doesn't wipe out downloaded course material.
3. `inittab` and everything in `etc/init.d/` are copied from the staged
   release over the live `/etc/` — **the boot scripts documented in doc
   04 can update themselves**. A broken init script shipped in a release
   can therefore break boot on the *next* reboot after it's applied —
   treat any change to `etc/init.d/*` as high-blast-radius (see doc 08).
4. The new `server` binary replaces `/root/server`.
5. `/root/www_new` (now fully populated/patched) is renamed to
   `/root/www` — becoming what `S60cage` will serve on this and every
   future boot until the next update.

`S55git` runs before `S60cage` (55 < 60, see doc 04) specifically so the
device boots straight into the *new* content rather than the old one for
one extra cycle.

## Rollback

Triggered the same way as an update, via Settings → the backend's
`/api/rollback`:

```cpp
int handle_rollback(struct mg_connection *conn, void *) {
    system("mv /root/www.old /root/www_new &");
    system("(/etc/init.d/S60cage stop && sleep 1 && reboot) > /dev/null 2>&1 &");
    return 500; // see note below
}
```

This is deliberately simple: it takes the **one** retained backup
(`/root/www.old`), stages it as `/root/www_new` — i.e. it *reuses the
exact same apply path as a normal update* (`S55git` doesn't know or care
whether `www_new` came from a fresh download or a rollback) — stops the
kiosk, and reboots. On the next boot, `S55git` "applies" the old version
exactly as if it were a new release.

Practical implications:

- **You can only roll back one step.** After a rollback completes,
  `/root/www.old` gets overwritten by whatever *was* current (the thing
  you just rolled back from) the next time any update (including another
  rollback) runs — there's no rollback history beyond one version.
  Rolling back twice in a row does not go back two releases.
- Because rollback reuses the `S55git` apply path, it inherits the same
  `inittab`/`init.d`/`server` replacement — a rollback restores the
  *entire* previous release, not just the frontend bundles.
- The handler's `return 500` is not a bug to "fix" reflexively — the
  comment explains it's intentional: `system()` blocks until the command
  returns, but the command backgrounds itself (`&`) and this function is
  expected to effectively never return control in a way the client can
  observe cleanly, so `500` is a defensive fallback rather than an
  attempt at a real status code. If you touch this handler, preserve
  that reasoning or document why you're changing the contract.

## What CANNOT be shipped this way (and why)

Per current project scope, four categories require a full image
rebuild + a pre-planned SD-card swap (or equivalent physical/manual
intervention) rather than a normal OTA update:

1. **New course material** (beyond what the app bundles already
   reference) — large binary assets like PDFs are fetched at
   *image-build* time (`post-build.sh`) into paths the OTA zip
   deliberately does not touch (see the `learn/pdfs` carve-out above);
   there is currently no path for the OTA flow to add *new* large asset
   categories to a running device.
2. **New Buildroot packages** — the OTA zip only ever contains
   `build/`, `learn/`, `etc/`, and `server`. It cannot install a new
   system library, a new kernel module, or any package that would need
   to be present in the base root filesystem/kernel — that's baked in at
   image-build time (see doc 03).
3. **New home-page wallpaper support** — wallpapers are shipped under
   `home/wallpapers/`, but note `S55git` only moves in `learn/pdfs`,
   `etc/inittab`, `etc/init.d/*`, and `server` from the staged release —
   it does **not** currently move in updated home-shell assets
   (wallpapers included) the way it does for `build/`/`learn/`. Adding
   *new* wallpaper choices via OTA would need this apply logic extended
   deliberately, not assumed to already work.
4. **New Chrome/Chromium extensions** — `uBlock_extn` is loaded via a
   `--load-extension` flag pointing at `/root/uBlock_extn`, which is
   copied in at image-build time by `post-build.sh`
   (`cp -r ${TARGET_DIR}/../../uBlock_extn ...`) and is not part of the
   OTA payload or apply path either.

If you're planning a change that touches any of these four, treat it as
a "next fleet rollout" change, not a routine PR — see
[08-contribution-guidelines.md](./08-contribution-guidelines.md).

## Suggested mental diagram

```
 main branch ──(push)──► CI builds suvriddhi.zip ──► GitHub Release "latest"
                                                            │
Device, on demand (Settings → Check for Updates) ──────────┘
        │
        ▼
   update.sh: curl latest release ──► /root/www_new  ──► reboot
                                                            │
                          ┌─────────────────────────────────┘
                          ▼
        Next boot: S55git applies /root/www_new
          /root/www ──► /root/www.old   (backup, single-slot)
          /root/www_new ──► /root/www   (now live)
                          │
        Settings → Rollback ─── mv /root/www.old → /root/www_new ─► reboot
                                       (re-enters S55git apply path)
```
