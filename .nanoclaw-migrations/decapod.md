# Decapod Replay

Source commit: `5a544fc` — 10 files, 1939 insertions, 0 deletions.

Adds a Rust build stage to the agent container that produces the
`decapod` governance CLI, three container skills that depend on it, and
enables the Obsidian Claude Code plugin in `.claude/settings.json`.

All additions — no conflicts expected.

## 1. Dockerfile Rust build stage

**File**: `container/Dockerfile`

**Context**: v2 uses a Node + Bun runtime. The Decapod stage is a
separate Rust build that produces a static binary we COPY into the
final image. This is orthogonal to the v2 runtime split.

**How to apply**:

1. At the very top of `container/Dockerfile`, BEFORE the existing
   `FROM node:22-slim` line (or `# syntax` directive after), prepend:

   ```dockerfile
   # Stage 1: Build Decapod from source (requires Rust 1.87+ for let-chains)
   FROM rust:latest AS decapod-builder
   RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
   RUN cargo install decapod --locked
   # Binary lands at /usr/local/cargo/bin/decapod
   ```

   The `# syntax=docker/dockerfile:1.7` directive (if present) must
   remain at line 1. Insert the stage below it.

2. Somewhere in the runtime stage, after Bun is installed and before
   any USER drop, add:
   ```dockerfile
   # Copy Decapod binary from builder stage
   COPY --from=decapod-builder /usr/local/cargo/bin/decapod /usr/local/bin/decapod
   ```

   A good placement is right after the `install -m 0755 /root/.bun/bin/bun`
   line — keeps global binaries together.

## 2. Container skills

Three new skill directories under `container/skills/`. Copy each from the
pre-migration tree verbatim — nothing to rewrite.

| Directory | Files | Notes |
|---|---|---|
| `container/skills/decapod/` | `SKILL.md` (121 lines) | Governance runtime skill — task tracking, workspaces, validation gates, `decapod` CLI |
| `container/skills/jira/` | `README.md`, `SKILL.md`, `references/commands.md`, `references/mcp.md` (~1250 lines total) | Natural language Jira via CLI + Atlassian MCP |
| `container/skills/microsoft-to-do/` | `LICENSE.txt`, `SKILL.md` (526 lines), `_meta.json` | MS To Do via Maton API gateway; needs `MATON_API_KEY` |

**How to apply** (from the worktree, with the current tree at `$PROJECT_ROOT`):

```bash
mkdir -p container/skills
cp -R "$PROJECT_ROOT/container/skills/decapod" container/skills/
cp -R "$PROJECT_ROOT/container/skills/jira" container/skills/
cp -R "$PROJECT_ROOT/container/skills/microsoft-to-do" container/skills/
```

## 3. .claude/settings.json — Obsidian plugin

**File**: `.claude/settings.json`

**How to apply**: Add `"enabledPlugins"` as a top-level key. If v2's
settings.json has other top-level keys (like `permissions`), add
`enabledPlugins` alongside — don't replace.

Target state (merge with existing keys):
```json
{
  "enabledPlugins": {
    "obsidian@obsidian-skills": true
  }
}
```

## Verification

- `docker buildx build container/` or `container build container/`
  succeeds (depending on runtime). Watch for stage 1 completing before
  stage 2.
- `container/skills/decapod/SKILL.md` exists in the built image
- `grep enabledPlugins .claude/settings.json` shows the entry
