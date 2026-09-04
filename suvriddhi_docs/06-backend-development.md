# Backend Development

## What it is

A single C++17 executable, built from `src_cs/backend/` (symlinked as
`src_phy/backend`, so both frontend apps share the same backend at the
same relative path). It embeds [civetweb](https://github.com/civetweb/civetweb)
as an HTTP server and listens on **port 8000**. It is the only part of
SuvriddhiOS allowed to run privileged/system-level commands on behalf of
the browser UI — everything the browser can't do itself (compile/run
native code, join Wi-Fi, reboot, trigger an OS update) goes through it.

Both learning apps talk to it directly from the browser via
`fetch("http://localhost:8000/api/...")`.

## Project layout

```
src_cs/backend/
├── main.cpp              # starts civetweb, registers all routes
├── code/                 # student code execution
│   ├── compile_handler.*   /api/compile   (C)
│   ├── run_handler.*       /api/run       (run a compiled C binary against tests)
│   ├── python_handler.*    /api/python    (run Python)
│   ├── code_handler.*      /api/save /api/load /api/list
│   └── test_handler.h      # shared test-running logic used by run_handler
├── settings/              # device-level operations
│   ├── wlan_handler.*      /api/wlan      (join Wi-Fi)
│   ├── power_handler.*     /api/power     (restart/shutdown)
│   ├── updates_handler.*   /api/updates   (trigger OTA, see doc 05)
│   └── rollback_handler.*  /api/rollback  (revert last OTA, see doc 05)
├── helpers/
│   ├── common.h            # shared includes + kSaveDir constant
│   └── utils.*              # GetJsonReq/SendResponse/WriteFile/ReadFile/etc. helpers
├── libs/json.hpp           # nlohmann::json (vendored single header)
└── Makefile
```

`main.cpp` is the map of the whole API surface — when in doubt about
what endpoints exist, start there:

```cpp
mg_set_request_handler(ctx, "/api/compile", HandleCompile, nullptr);
mg_set_request_handler(ctx, "/api/run", HandleRun, nullptr);
mg_set_request_handler(ctx, "/api/save", HandleSave, nullptr);
mg_set_request_handler(ctx, "/api/load", HandleLoad, nullptr);
mg_set_request_handler(ctx, "/api/list", HandleList, nullptr);
mg_set_request_handler(ctx, "/api/python", HandlePython, nullptr);
mg_set_request_handler(ctx, "/api/wlan", handle_wlan, nullptr);
mg_set_request_handler(ctx, "/api/power", handle_power, nullptr);
mg_set_request_handler(ctx, "/api/updates", handle_update, nullptr);
mg_set_request_handler(ctx, "/api/rollback", handle_rollback, nullptr);
```

`main()` also refuses to start if `kSaveDir` (`/root/codes`,
`helpers/common.h`) doesn't exist on disk — that's where saved
student code lives (`/api/save`/`/api/load`/`/api/list`).

## The two families of handlers

### `code/` — student code execution

This is the "compile and run untrusted student code" pipeline behind the
Sandbox/Train features. Pattern (see `compile_handler.cpp`,
`run_handler.cpp`):

1. `/api/compile` writes the submitted source to `/tmp/<random-token>.c`
   and shells out to `gcc` to compile it to `/tmp/<token>`, capturing
   stderr to a `.log` file. Returns the token (or the compile error) to
   the client.
2. `/api/run` takes that token, verifies the compiled binary exists,
   and runs it against a set of test cases (`test_handler.h`'s
   `RunTests`), returning pass/fail + actual vs. expected output.
3. `/api/python` (see `python_handler.cpp`) does the analogous thing for
   Python, without a separate compile step.

**Important, and not something to "fix" without a deliberate design
discussion**: compiled/interpreted student code currently runs directly
on the host with the backend's own privileges, with no seccomp/namespace/
chroot/resource-limit sandboxing around it in this handler code. On a
single-purpose kiosk device this is a real but bounded risk (there's not
much *else* on the box to attack, and the OS itself isn't multi-tenant),
but it does mean student-submitted code can, in principle, do anything
the `server` process can do (read `/root/codes` of other saved programs,
consume unbounded CPU/memory/disk, etc.). If you're adding a new language
runner or touching this path, at minimum think about: execution
timeouts, resource limits (`ulimit`/cgroups), and not trusting file
paths built from user input. Don't silently assume "it's already handled
somewhere."

### `settings/` — device operations

These endpoints exist so the frontend Settings page can perform actions
that require root/system access, which a browser can never do directly:

- **`wlan_handler.cpp`** (`/api/wlan`) — takes `{ssid, pass}` JSON,
  and runs a sequence of shell commands (`ip link set wlan0 up`,
  `wpa_passphrase` to generate a config, `wpa_supplicant -B`, `udhcpc`,
  a connectivity ping to `8.8.8.8`, then `ntpd`) to join and validate a
  network, appending the working config to `/etc/wpa_supplicant.conf`
  only after connectivity is confirmed (so a bad password/network
  doesn't silently overwrite the last-known-good saved config). **Note**:
  `ssid`/`passphrase` are interpolated directly into shell command
  strings (`"wpa_passphrase '" + ssid + "' '" + passphrase + "' > ..."`)
  — the single-quoting gives some protection, but this is still building
  shell commands from user input, so if you touch this handler be
  careful about characters that can break out of single quotes (a
  literal `'` in the input, for instance). Treat this as fragile, not
  hardened.
- **`power_handler.cpp`** (`/api/power`) — `{cmd: "restart"|"shutdown"}`
  stops the kiosk cleanly (`S60cage stop`) before `reboot`/`poweroff`.
  `"sleep"` is a recognized-but-unimplemented `TODO`.
- **`updates_handler.cpp`** / **`rollback_handler.cpp`** — see
  [05-ota-update-and-rollback.md](./05-ota-update-and-rollback.md) for
  the full picture; these handlers are thin triggers, the real logic
  lives in the shell scripts they invoke.

## Helpers you'll reuse

`helpers/utils.h`/`.cpp` (check them before reinventing something):
typical contents are JSON request parsing off an `mg_connection`
(`GetJsonReq`), a uniform JSON response writer (`SendResponse`),
file read/write helpers (`ReadFile`/`WriteFile`/`FileExists`), and a
random token generator (`GenerateToken`) used to namespace temp files
per-request so concurrent compiles/runs don't collide. `libs/json.hpp` is
vendored [nlohmann/json](https://github.com/nlohmann/json) — don't
"upgrade" it casually without checking it still matches what CI expects
to link against (`libcivetweb-dev` version pinning matters too).

## Build system

`Makefile` is a plain, non-Buildroot GNU Make build (`g++ -std=c++17`),
used both for local dev builds and (with cross-compile flags injected)
by `post-build.sh` during a full OS image build:

```sh
make            # build ./server
make run        # build + run
make format     # clang-format everything, per .clang-format
make clean       # remove build/ and the binary
```

CI (`cpp_checker.yml`) runs `make clean && make all` on every PR — a
backend change that doesn't compile will be caught there, but note there
are **no automated backend tests** currently (contrast with the frontend
apps, which at least get a build+audit check) — manual testing of any
handler you touch is on you. See doc 08 for why this matters more here
than it might elsewhere.

## Adding a new endpoint — checklist

1. Add a `.h`/`.cpp` pair under `code/` or `settings/` (whichever family
   it belongs to conceptually), following the existing handler signature:
   `int MyHandler(struct mg_connection *conn, void *)`.
2. Parse input with `GetJsonReq`, validate it's the shape you expect
   before touching fields (see how `compile_handler.cpp` checks
   `req.is_object() && req.contains("code") && req["code"].is_string()`
   before using it — don't skip this, an unchecked `req["x"]` throws on
   a malformed request).
3. Respond with `SendResponse(conn, json{...}.dump())` and a sensible
   HTTP status.
4. Register the route in `main.cpp`.
5. If it shells out to anything, ask: does this need a timeout? Could
   user input reach the command string? Does it need to work when
   offline (most of the device's life, potentially)?
6. Update the corresponding frontend Settings/Sandbox UI, and mention
   the new endpoint in this doc if it's a new capability class (not just
   a variant of an existing one).
