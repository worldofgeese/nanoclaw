---
name: decapod
description: Governance runtime for agent teams. Use Decapod to track tasks, create isolated workspaces, validate work, record decisions, and coordinate with other agents. Invoke whenever you need structured task management, proof-gated completion, or multi-agent coordination.
allowed-tools: Bash(decapod:*)
---

# Decapod — Governance Runtime

Decapod provides deterministic primitives for task tracking, workspace isolation, validation gates, and multi-agent coordination. It is invoked by agents on demand — it never runs in the background.

## Initialization

Run once per repository before using any other commands:

```bash
decapod init
```

This creates `.decapod/` directory, `AGENTS.md`, and constitution files.

## Session lifecycle

```bash
decapod session acquire           # Start a session (get credentials)
decapod session release           # End session cleanly
```

## Task management

```bash
decapod todo add "description"    # Create a task
decapod todo list                 # List all tasks
decapod todo claim --id <id>      # Claim a task (must claim before working)
decapod todo done --id <id>       # Mark task complete
decapod todo handoff --id <id> --to <agent>  # Hand off to another agent
decapod todo heartbeat            # Signal liveness during long work
```

## Workspaces (branch isolation)

Never work on main/master. Always use workspaces:

```bash
decapod workspace ensure          # Create isolated worktree + branch
decapod workspace publish --title "..." --description "..."  # Package as PR
```

## Validation (proof gates)

Run before claiming any work is done:

```bash
decapod validate                  # Authoritative completion gate (must pass)
```

## Constitution (just-in-time docs)

```bash
decapod docs show core/DECAPOD.md          # Read core router
decapod docs show specs/INTENT.md          # Read binding intent spec
decapod docs show methodology/ARCHITECTURE.md  # Read architecture guide
decapod docs ingest                        # Ingest full constitution
```

## Decisions & knowledge

```bash
decapod decide                             # Architecture decision prompting
decapod data knowledge add "..."           # Add to knowledge base
decapod data knowledge list                # List knowledge entries
decapod data federation add --type decision --content "..." --source "..."  # Durable decision
decapod data federation list               # List federation entries
```

## Health & attestations

```bash
decapod govern health add --claim "..." --proof "..."  # Record attestation
decapod govern health summary              # System health overview
decapod govern health autonomy --id <agent>  # Agent autonomy tier
```

## Policy & safety

```bash
decapod govern policy riskmap verify       # Risk-based approval gate
decapod govern gatekeeper run              # Path blocklist, diff size, secret scan
decapod govern watcher run                 # Integrity watchlist checks
```

## Verification

```bash
decapod qa verify                 # Verify completed work (proof replay + drift)
decapod qa check                  # CI validation checks
decapod govern proof run          # Execute registered proof surfaces
```

## Automation

```bash
decapod auto cron add "..."       # Scheduled tasks
decapod auto reflex add "..."     # Event-driven automation
decapod auto workflow list        # Discover available workflows
```

## Overrides

Project-specific policy overrides go in `.decapod/OVERRIDE.md` (plain English).

## Core workflow

1. `decapod init` (once per repo)
2. `decapod session acquire`
3. `decapod todo list` → `decapod todo claim --id <id>`
4. `decapod workspace ensure`
5. Do the work
6. `decapod validate` (must pass before done)
7. `decapod todo done --id <id>`
8. `decapod workspace publish --title "..." --description "..."`
9. `decapod session release`
