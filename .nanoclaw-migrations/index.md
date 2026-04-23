# NanoClaw v1 → v2 Migration Guide

Generated: 2026-04-23
Base (merge-base): `a81e165` (upstream/main before v2)
HEAD at generation: `fea658f`
Upstream target: `d8b1f52` (upstream/main, v2.0.0+)

This fork diverged by 42 commits / 27 files before v2 (349 upstream commits
ahead at the jump). Rather than cherry-pick across the v1→v2 rewrite, this
guide replays the user's intent on a clean v2 base.

## Migration Plan

### Stage 1 — Worktree setup
Create a worktree on `upstream/main` to stage the upgrade without touching
the live tree.

### Stage 2 — Apply v2 skills (merge/copy from upstream)
1. `/convert-to-apple-container`  — merges `upstream/skill/apple-container`
2. `/use-native-credential-proxy` — merges `upstream/skill/native-credential-proxy`
   (this also rewrites `groups/main/CLAUDE.md` Authentication section)
3. `/add-telegram`                 — copies from `upstream/channels` + `@chat-adapter/telegram@4.26.0`

### Stage 3 — Replay credential-proxy fixes
See [`credential-proxy-fixes.md`](credential-proxy-fixes.md).

### Stage 4 — Replay Decapod
See [`decapod.md`](decapod.md).

### Stage 5 — Telegram extras on top of v2's Chat SDK bridge
See [`telegram-extras.md`](telegram-extras.md).

### Stage 6 — Build, test, swap
- `pnpm install` (v2 uses pnpm, not npm)
- `pnpm run build`
- `pnpm test`
- Live test: stop service, symlink data, `pnpm run dev` from worktree, send
  a test message from phone, confirm, stop dev server, clean up symlinks
- Swap worktree → main

## User decisions locked in

- **`.env` shadowing**: adopt v2's default (mount --bind + setpriv in the
  Dockerfile entrypoint; main-group containers start as root then drop).
  The user's v1 behavior (no shadowing, from commit `c977c99`) is NOT
  preserved — v2's approach solves the original "Apple Container doesn't
  mount /dev/null" problem differently.
- **npm → pnpm**: accept. `package-lock.json` becomes `pnpm-lock.yaml`.

## Applied Skills

These are reapplied on the clean v2 base via the skills above. They map
1:1 onto upstream artifacts — no manual re-merging of user commits needed
except for the deltas captured in the `credential-proxy-fixes.md` doc.

| Skill on v2 | What it produces |
|---|---|
| `/convert-to-apple-container` | Apple Container runtime + `detectHostGateway` + `.env` shadowing |
| `/use-native-credential-proxy` | Native credential proxy, removes OneCLI, updates `groups/main/CLAUDE.md` |
| `/add-telegram` | v2 Telegram via Chat SDK bridge (pairing + sanitizer + retry) |

**Custom skill (no v2 equivalent)**: `.claude/skills/add-telegram-swarm/` —
copy verbatim from the current tree.

## Skill Interactions

**`/convert-to-apple-container` vs `/use-native-credential-proxy` ordering**:
Apply `/convert-to-apple-container` first. The apple-container skill
merge sets `PROXY_BIND_HOST` handling and writes code that the
credential-proxy skill's merge is compatible with. The reverse order
can produce a conflict in `src/container-runtime.ts`.

**`/use-native-credential-proxy` + `groups/main/CLAUDE.md`**: the skill
already writes the exact replacement the user had. Do NOT manually edit
this file after the skill runs.

**Apple Container skill + Decapod Dockerfile stage**: fully orthogonal
layers. Apple Container changes the entrypoint; Decapod prepends a Rust
build stage + COPY line. No conflict, but verify the final Dockerfile
has both after replay.

## Modifications to Applied Skills

None. The user's fix commits on top of `skill/native-credential-proxy`
and the Apple Container work are replayed explicitly in
`credential-proxy-fixes.md` (not as fixes to the skill, but as source
edits after the skill is applied).

## Customizations

See per-area files:
- [`credential-proxy-fixes.md`](credential-proxy-fixes.md) — 3 fix commits, ~30 lines of code
- [`decapod.md`](decapod.md) — Dockerfile stage + 3 container skills + 1 settings entry
- [`telegram-extras.md`](telegram-extras.md) — reply context + thread support + swarm skill

## Dropped

- Uncommitted `src/config.ts` cosmetic reformat (discarded pre-migration)
- 4 README docs commits (`fea658f`, `b9a9e2d`, `c1f8336`, `a24e55a`) —
  user may cherry-pick specific paragraphs post-migration if desired.

## Not touched by migration (but safe)

- `.claude/settings.local.json` (untracked)
- `projects/` directory (untracked)
- `value-case-ai-daily-assistant.md` (untracked)
- `.env`, `groups/`, `store/`, `data/` (data dirs, never touched)

## Rollback

If the migration goes wrong, restore from the safety branch:
```
git reset --hard backup/pre-v2-migration
```

The Phase 2 upgrade will also create a timestamped tag before the swap.
