<p align="center">
  <img src="assets/nanoclaw-logo.png" alt="NanoClaw" width="400">
</p>

<p align="center">
  An AI assistant that runs agents securely in their own containers. Lightweight, built to be easily understood and completely customized for your needs.
</p>

<p align="center">
  <a href="https://nanoclaw.dev">nanoclaw.dev</a>&nbsp; • &nbsp;
  <a href="https://docs.nanoclaw.dev">docs</a>&nbsp; • &nbsp;
  <a href="README_zh.md">中文</a>&nbsp; • &nbsp;
  <a href="README_ja.md">日本語</a>&nbsp; • &nbsp;
  <a href="https://discord.gg/VDdww8qS42"><img src="https://img.shields.io/discord/1470188214710046894?label=Discord&logo=discord&v=2" alt="Discord" valign="middle"></a>&nbsp; • &nbsp;
  <a href="repo-tokens"><img src="repo-tokens/badge.svg" alt="repo tokens" valign="middle"></a>
</p>

---

## Why I Built NanoClaw

[OpenClaw](https://github.com/openclaw/openclaw) is an impressive project, but I wouldn't have been able to sleep if I had given complex software I didn't understand full access to my life. OpenClaw has nearly half a million lines of code, 53 config files, and 70+ dependencies. Its security is at the application level (allowlists, pairing codes) rather than true OS-level isolation. Everything runs in one Node process with shared memory.

NanoClaw provides that same core functionality, but in a codebase small enough to understand: one process and a handful of files. Claude agents run in their own Linux containers with filesystem isolation, not merely behind permission checks.

## About This Fork

This is `worldofgeese/nanoclaw` — a customized fork of [qwibitai/nanoclaw](https://github.com/qwibitai/nanoclaw) v2, tailored for Apple Silicon macOS + LEGO's AMMA gateway. Deviations from upstream trunk:

- **Apple Container runtime** instead of Docker. v2 ships with Docker as default; this fork replaces it with Apple Container for a lighter native runtime. Fixes for Apple Container 0.11 specifics (no file-level bind mounts, `WORKDIR` override, bridge100 gateway detection) are in `src/container-runtime.ts` and `src/container-runner.ts`.
- **Native credential proxy** instead of OneCLI. Agents never see raw API keys — the proxy injects auth at request time. Supports Anthropic's OAuth exchange (direct `api.anthropic.com`) and a **gateway mode** for static bearer auth (LEGO AMMA, custom gateways). Opt-in via `CREDENTIAL_PROXY_GATEWAY_MODE=true` in `.env`; auto-detected when `ANTHROPIC_BASE_URL` hostname isn't `api.anthropic.com`.
- **Decapod container skill** — a Rust-built governance runtime CLI baked into the agent image. Plus `jira` and `microsoft-to-do` container skills.
- **Two stability fixes** applied to v2 core: `processing_ack` zombie claims are now cleared when the host-sweep resets stuck messages, and `sessions.container_status` is reset to `stopped` on startup so a killed-on-restart container doesn't wedge the sweep loop.

For history and replay instructions see [`.nanoclaw-migrations/`](.nanoclaw-migrations/index.md) — captures the v1→v2 port intent so the fork can be replayed onto cleaner upstream bases later.

## Quick Start

```bash
git clone https://github.com/qwibitai/nanoclaw.git nanoclaw-v2
cd nanoclaw-v2
bash nanoclaw.sh
```

`nanoclaw.sh` walks you from a fresh machine to a named agent you can message. It installs Node, pnpm, and Docker if missing, registers your Anthropic credential with OneCLI, builds the agent container, and pairs your first channel (Telegram, Discord, WhatsApp, or a local CLI). If a step fails, Claude Code is invoked automatically to diagnose and resume from where it broke.

## Philosophy

**Small enough to understand.** One process, a few source files and no microservices. If you want to understand the full NanoClaw codebase, just ask Claude Code to walk you through it.

**Secure by isolation.** Agents run in Linux containers and they can only see what's explicitly mounted. Bash access is safe because commands run inside the container, not on your host.

**Built for the individual user.** NanoClaw isn't a monolithic framework; it's software that fits each user's exact needs. Instead of becoming bloatware, NanoClaw is designed to be bespoke. You make your own fork and have Claude Code modify it to match your needs.

**Customization = code changes.** No configuration sprawl. Want different behavior? Modify the code. The codebase is small enough that it's safe to make changes.

**AI-native, hybrid by design.** The install and onboarding flow is an optimized scripted path, fast and deterministic. When a step needs judgment, whether a failed install, a guided decision, or a customization, control hands off to Claude Code seamlessly. Beyond setup there's no monitoring dashboard or debugging UI either: describe the problem in chat and Claude Code handles it.

**Skills over features.** Trunk ships the registry and infrastructure, not specific channel adapters or alternative agent providers. Channels (Discord, Slack, Telegram, WhatsApp, …) live on a long-lived `channels` branch; alternative providers (OpenCode, Ollama) live on `providers`. You run `/add-telegram`, `/add-opencode`, etc. and the skill copies exactly the module(s) you need into your fork. No feature you didn't ask for.

**Best harness, best model.** NanoClaw natively uses Claude Code via Anthropic's official Claude Agent SDK, so you get the latest Claude models and Claude Code's full toolset, including the ability to modify and expand your own NanoClaw fork. Other providers are drop-in options: `/add-codex` for OpenAI's Codex (ChatGPT subscription or API key), `/add-opencode` for OpenRouter, Google, DeepSeek and more via OpenCode, and `/add-ollama-provider` for local open-weight models. Provider is configurable per agent group.

## What It Supports

- **Multi-channel messaging** — WhatsApp, Telegram, Discord, Slack, Microsoft Teams, iMessage, Matrix, Google Chat, Webex, Linear, GitHub, WeChat, and email via Resend. Installed on demand with `/add-<channel>` skills. Run one or many at the same time.
- **Flexible isolation** — connect each channel to its own agent for full privacy, share one agent across many channels for unified memory with separate conversations, or fold multiple channels into a single shared session so one conversation spans many surfaces. Pick per channel via `/manage-channels`. See [docs/isolation-model.md](docs/isolation-model.md).
- **Per-agent workspace** — each agent group has its own `CLAUDE.md`, its own memory, its own container, and only the mounts you allow. Nothing crosses the boundary unless you wire it to.
- **Scheduled tasks** — recurring jobs that run Claude and can message you back
- **Web access** — search and fetch content from the web
- **Container isolation** — agents are sandboxed in [Apple Container](https://github.com/apple/container) (macOS native runtime). Upstream supports Docker across macOS/Linux/WSL2 — this fork locks in Apple Container for the macOS host.
- **Credential security** — agents never hold raw API keys. Outbound requests route through the in-process native credential proxy (`src/credential-proxy.ts`), which reads creds from `.env` and injects them at the request boundary. No external vault needed.

## Usage

Talk to your assistant with the trigger word (default: `@Andy`). Everything below is a chat command — no terminal needed.

### Basic

```
@Andy send an overview of the sales pipeline every weekday morning at 9am
@Andy review the git history for the past week each Friday and report drift
@Andy every Monday at 8am, compile AI news from Hacker News and TechCrunch and brief me
```

From a channel you own or administer:
```
@Andy list all scheduled tasks across groups
@Andy pause the Monday briefing task
```

### Spawn specialized agents

Agents are persistent specialists with their own container, workspace, memory, and session — not ephemeral task runners.

```
@Andy create a "Scout" agent that researches web topics and reports back with sources
@Andy spawn a "Calendar" agent that tracks my recurring tasks and schedules
```

Under the hood this calls the `create_agent` MCP tool. The new agent gets its own folder under `groups/<name>/` and becomes a destination Andy (and you) can message directly.

### Agent-to-agent (A2A) communication

Once multiple agents exist, hand off work between them:

```
@Andy have Scout research what's new in WebGPU in 2026 and summarize in 3 bullets
@Andy ask Calendar to block Thursday 2-3pm for the Scout briefing
```

Andy calls `send_message({ to: "Scout", ... })`. Scout works in the background and replies through the normal delivery path. You can also DM Scout directly — each agent is its own addressable endpoint.

### Install packages / MCP servers from chat

No editing container/Dockerfile. Ask for a capability:

```
@Andy install ffmpeg so you can process audio files
@Andy add the MCP server for long-term memory from modelcontextprotocol/servers
```

An approval card lands in your DM (native inline buttons on Telegram / Discord / Slack). Tap **Approve** → host rebuilds the per-agent-group container image and restarts. Persists across sessions, not just this turn.

### Human-in-the-loop approvals

You don't trigger these — they trigger you. Approval cards arrive in your DM whenever an agent proposes a sensitive action:

- Package/MCP install (above)
- An unknown user messaging your NanoClaw (when `unknown_sender_policy=request_approval`)
- Credentialed actions (gateway-side policy; dormant in this fork since we bypass OneCLI)

Tap a button. That's the whole UX. The agent's turn blocks until you decide.

### Multi-user access

Share your NanoClaw with someone: give them the bot's `@handle`. When they DM, you get an approval card asking whether to grant them access. On approve, they get their own session + memory + context — they never see yours.

Per-messaging-group `unknown_sender_policy`:
- `strict` — drop messages from unknown senders silently
- `request_approval` — DM you an approval card (recommended default)
- `public` — auto-accept

Ask Andy to change it:

```
@Andy set this group's unknown-sender policy to request_approval
```

### Add more channels

From the host's Claude Code:

```
/add-slack      /add-discord    /add-github
/add-matrix     /add-teams      /add-linear
/add-gchat      /add-webex      /add-resend
/add-imessage   /add-wechat     /add-whatsapp
```

Each skill is idempotent: copies the adapter from `upstream/channels`, wires self-registration, pins the dependency, rebuilds. Then `/manage-channels` to pick isolation mode (separate agents per channel, shared agent with independent sessions, or one merged session across channels) and wire it to an existing or new agent group.

### Swap agent providers per-group

Per-agent-group provider config. Default is Claude; install alternatives with `/add-opencode` (OpenRouter / OpenAI / Google / DeepSeek / DeepInfra), `/add-ollama-provider` (local open-weight), or `/add-codex` (OpenAI Codex with your ChatGPT subscription or API key).

```
@Andy switch the Scout agent to opencode with openrouter + gemini-2.5-pro
@Andy have Calendar run on ollama with qwen2.5-coder-32b locally
```

### One-line starter

Paste this into Telegram to exercise `create_agent` + A2A + web research in one go:

> Create a "Scout" agent that researches web topics and reports back with sources. Once it's up, have Scout summarize this week's top news in AI infrastructure.

## Customizing

NanoClaw doesn't use configuration files. To make changes, just tell Claude Code what you want:

- "Change the trigger word to @Bob"
- "Remember in the future to make responses shorter and more direct"
- "Add a custom greeting when I say good morning"
- "Store conversation summaries weekly"

Or run `/customize` for guided changes.

The codebase is small enough that Claude can safely modify it.

## Contributing

**Don't add features. Add skills.**

If you want to add a new channel or agent provider, don't add it to trunk. New channel adapters land on the `channels` branch; new agent providers land on `providers`. Users install them in their own fork with `/add-<name>` skills, which copy the relevant module(s) into the standard paths, wire the registration, and pin dependencies.

This keeps trunk as pure registry and infra, and every fork stays lean — users get the channels and providers they asked for and nothing else.

### RFS (Request for Skills)

Skills we'd like to see:

**Communication Channels**
- `/add-signal` — Add Signal as a channel

## Requirements

- macOS 15+ on Apple Silicon (this fork; Windows/Linux users, use upstream)
- Node.js 20+ and pnpm 10+
- [Apple Container](https://github.com/apple/container/releases) 0.11+
- [Claude Code](https://claude.ai/download) for `/customize`, `/debug`, error recovery during setup, and all `/add-<channel>` skills

## Architecture

```
messaging apps → host process (router) → inbound.db → container (Bun, Claude Agent SDK) → outbound.db → host process (delivery) → messaging apps
```

A single Node host orchestrates per-session agent containers. When a message arrives, the host routes it via the entity model (user → messaging group → agent group → session), writes it to the session's `inbound.db`, and wakes the container. The agent-runner inside the container polls `inbound.db`, runs Claude, and writes responses to `outbound.db`. The host polls `outbound.db` and delivers back through the channel adapter.

Two SQLite files per session, each with exactly one writer — no cross-mount contention, no IPC, no stdin piping. Channels and alternative providers self-register at startup; trunk ships the registry and the Chat SDK bridge, while the adapters themselves are skill-installed per fork.

For the full architecture writeup see [docs/architecture.md](docs/architecture.md); for the three-level isolation model see [docs/isolation-model.md](docs/isolation-model.md).

Key files:
- `src/index.ts` — entry point: DB init, channel adapters, delivery polls, sweep
- `src/router.ts` — inbound routing: messaging group → agent group → session → `inbound.db`
- `src/delivery.ts` — polls `outbound.db`, delivers via adapter, handles system actions
- `src/host-sweep.ts` — 60s sweep: stale detection, due-message wake, recurrence
- `src/session-manager.ts` — resolves sessions, opens `inbound.db` / `outbound.db`
- `src/container-runner.ts` — spawns per-agent-group containers, wires the native credential proxy URL + placeholder auth
- `src/credential-proxy.ts` — HTTP proxy injecting real creds at request time (`.env` → upstream); supports gateway mode for bearer-auth endpoints
- `src/db/` — central DB (users, roles, agent groups, messaging groups, wiring, migrations)
- `src/channels/` — channel adapter infra (adapters installed via `/add-<channel>` skills)
- `src/providers/` — host-side provider config (`claude` baked in; others via skills)
- `container/agent-runner/` — Bun agent-runner: poll loop, MCP tools, provider abstraction
- `groups/<folder>/` — per-agent-group filesystem (`CLAUDE.md`, skills, container config)

## FAQ

**Why Apple Container?**

This fork runs on macOS Apple Silicon and uses Apple Container for a lightweight native runtime — no Docker Desktop, no daemon. Upstream supports Docker/Linux/WSL2; if you need cross-platform, use upstream and its `/convert-to-apple-container` skill only when you want the native path.

**Can I run this on Linux or Windows?**

Not this fork. Use upstream `qwibitai/nanoclaw` for non-macOS hosts.

**Is this secure?**

Agents run in Apple Container VMs (Linux userland inside a macOS-managed VM), not behind application-level permission checks. They can only access explicitly mounted directories. Credentials never enter the container — outbound API requests route through the native credential proxy (`src/credential-proxy.ts`), which reads keys from `.env` on the host and injects the real bearer/`x-api-key` header per request. The container only sees a placeholder. See the [security documentation](https://docs.nanoclaw.dev/concepts/security) for upstream's broader security model.

One call-out unique to Apple Container 0.11: individual file bind-mounts aren't supported, so the RO overlays upstream uses for `container.json` and the composed `CLAUDE.md` become read-write. The files are still regenerated on every spawn from trusted sources, so agent overwrites are clobbered on next wake — but it's a smaller guarantee than Docker's. See the `buildMounts` comment in `src/container-runner.ts`.

**How does authentication work with LEGO AMMA / custom gateways?**

Set `ANTHROPIC_BASE_URL` to the gateway URL and `ANTHROPIC_AUTH_TOKEN` to the static bearer. The proxy auto-detects gateway mode from the hostname (anything not `api.anthropic.com` is treated as a gateway) and injects `Authorization: Bearer <token>` on every request, stripping any placeholder `x-api-key` the client sends. To force gateway behavior explicitly, set `CREDENTIAL_PROXY_GATEWAY_MODE=true`.

**Why no configuration files?**

We don't want configuration sprawl. Every user should customize NanoClaw so that the code does exactly what they want, rather than configuring a generic system. If you prefer having config files, you can tell Claude to add them.

**Can I use third-party or open-source models?**

Yes. The supported path is `/add-opencode` (OpenRouter, OpenAI, Google, DeepSeek, and more via OpenCode config) or `/add-ollama-provider` (local open-weight models via Ollama). Both are configurable per agent group, so different agents can run on different backends in the same install.

For one-off experiments, any Claude API-compatible endpoint also works via `.env`:

```bash
ANTHROPIC_BASE_URL=https://your-api-endpoint.com
ANTHROPIC_AUTH_TOKEN=your-token-here
```

**How do I debug issues?**

Ask Claude Code. "Why isn't the scheduler running?" "What's in the recent logs?" "Why did this message not get a response?" That's the AI-native approach that underlies NanoClaw.

**Why isn't the setup working for me?**

If a step fails, `nanoclaw.sh` hands off to Claude Code to diagnose and resume. If that doesn't resolve it, run `claude`, then `/debug`. If Claude identifies an issue likely to affect other users, open a PR against the relevant setup step or skill.

**What changes will be accepted into the codebase?**

Only security fixes, bug fixes, and clear improvements will be accepted to the base configuration. That's all.

Everything else (new capabilities, OS compatibility, hardware support, enhancements) should be contributed as skills on the `channels` or `providers` branch.

This keeps the base system minimal and lets every user customize their installation without inheriting features they don't want.

## Community

Questions? Ideas? [Join the Discord](https://discord.gg/VDdww8qS42).

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for breaking changes, or the [full release history](https://docs.nanoclaw.dev/changelog) on the documentation site.

## License

MIT
