# Contribution Guidelines

Read this before opening a PR, especially if any part of your change was
written or drafted by an AI coding tool.

## The core fact that shapes everything below

**SuvriddhiOS runs on real hardware, in real classrooms, in front of
real students, today.** A merge to `main` is not the end state of a
change — per [05-ota-update-and-rollback.md](./05-ota-update-and-rollback.md),
every push to `main` triggers a build that becomes the "latest" release,
which devices pull the next time anyone hits "Check for updates" in
Settings. There is currently no staged rollout, no canary devices, and
update payloads aren't signed or checksummed. In practice, that means:

**A bug that reaches `main` can reach a deployed device in the field
within one CI run and one button press, with no built-in safety net
beyond a single-step rollback that a student or teacher has to know to
trigger.**

This isn't meant to make you afraid to contribute — it's meant to
calibrate how much scrutiny a change needs *before* it merges, since
there's comparatively little scrutiny happening *after*.

## Mandatory: human review of AI-generated code

**Every change that was written, completed, or substantially assisted
by an AI tool (Claude, Copilot, ChatGPT, or similar) must be reviewed
line-by-line by a human who understands what it does before it is
merged.** This is not a style preference — it is a hard requirement,
adopted specifically because AI-assisted changes that were not properly
reviewed have already caused failures on production units in the field.

Concretely, this means:

- If you used an AI tool to write or modify code, **say so** in the PR
  description. Don't present AI-authored code as if you wrote and
  independently verified every line by hand when you didn't.
- The reviewer's job is not to skim the diff and trust that "it builds"
  or "it looks reasonable" — AI-generated code in this repo has a track
  record of looking plausible while being subtly wrong in ways that only
  show up on real hardware (timing assumptions, shell-quoting edge
  cases, assumptions about what's already installed/available, silently
  dropped error handling). Reviewers should be *more* suspicious of
  AI-authored code than human-authored code, not less, until this repo's
  track record improves.
- Pay particular attention to anything AI-generated that touches:
  `etc/init.d/*` (boot sequence — see doc 04), `update.sh`/`S55git`/the
  update or rollback handlers (see doc 05), anything that shells out via
  `system()` (see doc 06's notes on shell-injection-shaped risk), and
  `configs/suvriddhi_defconfig`/`package/`/`board/` (affects the base
  image every device runs). A subtle bug in any of these can mean a
  device that won't boot, silently drops network connectivity, or is
  unrecoverable without physical access.
- If you can't fully explain *why* an AI-suggested change works, don't
  merge it — ask, test it, or rewrite it until you can. "The AI said
  this fixes it" is not an acceptable justification in a review.
- This applies to reviewers using AI to help *review* a PR too — an AI
  review summary is a starting point for a human's own judgment, not a
  substitute for it.

## Before opening a PR: ask "what does this actually touch?"

Different parts of the repo carry very different blast radii. Roughly,
from highest to lowest caution required:

1. **Boot scripts (`etc/init.d/*`), kernel/DT config, Buildroot package
   selection** — can leave a device unable to boot or unreachable at
   all. Test on real hardware (or as close to it as you can get) before
   merging, not just "it built."
2. **Backend (`src_cs/backend`)** — no sandboxing around student code
   execution, and it's the only thing with root-level system access (see
   doc 06). A bug here can be a security issue, not just a UX bug.
3. **The update/rollback flow itself** — a bug here can mean a broken
   update leaves devices half-updated, or worse, that rollback stops
   working (the one safety net this system has).
4. **Frontend apps (`src_cs`, `src_phy`, `home/`)** — lower physical
   risk (worst case is usually a broken UI, recoverable by another
   update or rollback), but still directly reaches students' screens;
   broken content or a crashing page has real classroom impact even if
   it's not "the device is bricked" severity.

If your change is in category 1-3, say so explicitly in the PR and
expect (and ask for) closer review, ideally including a real or
close-to-real hardware test, not just CI passing.

## What CI does and doesn't catch

CI (`.github/workflows/`) will catch: backend compile failures
(`cpp_checker.yml`), frontend build failures and known-critical
dependency vulnerabilities (`cs_test.yml`, `phy_test.yml`). It will
**not** catch: boot-time failures, runtime behavior on actual hardware,
Wi-Fi/network edge cases, memory pressure under real usage, or anything
about the update/rollback flow itself. A green CI run is a necessary
floor, not sufficient evidence a change is safe to ship.

## Practical checklist before requesting review

- [ ] Have I stated clearly what I changed and *why*, not just *what*?
- [ ] If AI assisted this change, have I said so, and have I personally
      verified every line does what I believe it does?
- [ ] Have I identified which "blast radius" category (above) this
      change falls into, and reviewed/tested accordingly?
- [ ] If this touches `etc/init.d/*`, `update.sh`, or the rollback path
      — have I traced through doc 04/05 to make sure I haven't broken an
      assumption another script depends on (ordering, file paths, flag
      files)?
- [ ] If this touches the backend — have I thought about untrusted
      input reaching a `system()` call, and about what happens if this
      endpoint is hit with malformed/missing/adversarial input?
- [ ] Does this belong in a normal OTA-shippable change, or does it fall
      into one of the four categories that need a full rebuild + planned
      SD-card swap (see doc 05)? If the latter, flag that explicitly —
      it needs coordination beyond a normal merge.
- [ ] Have I actually run this (dev server / local backend / on-device)
      rather than only reading the diff?

## When in doubt

Ask before merging. A question that slows down a PR by a day is much
cheaper than a broken update reaching devices that are, in some cases,
the only computer a given classroom has.
