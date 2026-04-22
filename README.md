<p align="center">
  <img src="assets/nanoclaw-logo.png" alt="NanoClaw" width="400">
</p>

<p align="center">
  An AI assistant that runs Claude Code in isolated containers and reaches you in the messaging apps you already use. Small enough to read end-to-end, customizable by editing code rather than configuration files.
</p>

<p align="center">
  <a href="https://nanoclaw.dev">nanoclaw.dev</a>&nbsp; • &nbsp;
  <a href="https://docs.nanoclaw.dev">docs</a>&nbsp; • &nbsp;
  <a href="README_zh.md">中文</a>&nbsp; • &nbsp;
  <a href="README_ja.md">日本語</a>&nbsp; • &nbsp;
  <a href="https://discord.gg/VDdww8qS42"><img src="https://img.shields.io/discord/1470188214710046894?label=Discord&logo=discord&v=2" alt="Discord" valign="middle"></a>&nbsp; • &nbsp;
  <a href="repo-tokens"><img src="repo-tokens/badge.svg" alt="34.9k tokens, 17% of context window" valign="middle"></a>
</p>

---

> **🔥 New Version Preview: Chat SDK + Approval Dialogs**
>
> A preview of NanoClaw v2 is available, featuring Vercel Chat SDK integration (15 messaging platforms from one codebase) and one-tap approval dialogs for sensitive agent actions. [Read the announcement →](https://venturebeat.com/orchestration/should-my-enterprise-ai-agent-do-that-nanoclaw-and-vercel-launch-easier-agentic-policy-setting-and-approval-dialogs-across-15-messaging-apps)
>
> <details>
> <summary>Try the preview</summary>
>
> ```bash
> gh repo fork qwibitai/nanoclaw --clone && cd nanoclaw
> git checkout v2
> claude
> ```
> Then run `/setup`. Feedback welcome on [Discord](https://discord.gg/VDdww8qS42). Expect breaking changes before merge to main.
>
> </details>

## Why NanoClaw if you already use Claude Code

Claude Code gives you a capable coding agent in your terminal. NanoClaw gives you the same agent as a **persistent assistant reachable from the apps you already live in**:

- **Messaging-app front-ends.** @-mention the assistant in WhatsApp, Telegram, Slack, Discord, or Gmail and the message becomes a Claude Code invocation. Replies come back in the same thread. You never open a terminal.
- **Always-on background service.** Runs under `launchd` (macOS) or `systemd` (Linux) so the assistant is reachable 24/7 from your phone, not only while your terminal is open.
- **Per-group isolation.** Each chat or group gets its own container, filesystem (`groups/{name}/`), and `CLAUDE.md` memory. Your work chat and your family chat cannot see each other's state.
- **Container sandboxing.** Every invocation runs in a fresh Linux container (Apple Container on macOS, Docker elsewhere), not on your host. Agent mistakes stay inside the sandbox.
- **Scheduled tasks.** Cron-style triggers that fire Claude Code with a prompt on a schedule — "every morning at 8, summarize new pull requests in Slack." Claude Code has no scheduler; NanoClaw adds one.
- **Credential brokering.** API keys never enter the container. A local proxy injects them at request time, so a compromised agent cannot exfiltrate raw secrets.

If none of those matter to you, stay in the terminal with Claude Code. NanoClaw earns its keep specifically when you want Claude Code reachable from a phone and the apps around it.

## How you interact: two paths

NanoClaw runs alongside Claude Code without replacing it. Knowing which path you're on clarifies what the agent can and cannot see.

**Direct (terminal):**

```
you → `claude` in the repo → host environment
```

Full access to your `~/.claude/plugins/`, user skills, `.mcp.json`, and filesystem. Use this for development, setup, and editing the repo. No container, no sandbox.

**Chat-driven (NanoClaw):**

```
WhatsApp / Telegram / etc. → NanoClaw → fresh container → `claude` inside → reply
```

Sandboxed: the container mounts only the group's workspace and a curated skill slate. No host plugins, no host keys, no host filesystem. Ephemeral — the container idles 30 minutes, then dies; the next message spawns a fresh one.

The NanoClaw background service (`launchctl list | grep nanoclaw` on macOS; `systemctl --user status nanoclaw` on Linux) sits idle waiting for chat messages and only then spawns a container. Your direct `claude` sessions are unaffected.

> **Opt-in exception:** the `/claw` skill installs a `claw` CLI that fires a NanoClaw-sandboxed run from your terminal. If you did not run `/claw`, your terminal sessions take the direct path.

## Prerequisites

Before installing, make sure you have:

- **macOS 15+**, **Linux**, or **Windows (via WSL2)**
- **Node.js 22+** — [install guide](https://nodejs.org/en/download)
- **Claude Code** — [download](https://claude.com/product/claude-code)
- **A container runtime** — [Apple Container](https://github.com/apple/container) on macOS or [Docker](https://docker.com/products/docker-desktop) on Linux/Windows
- **An Anthropic-compatible endpoint** — either an API key from [console.anthropic.com](https://console.anthropic.com) or a compatible gateway URL and token

**Success indicator:** `node --version` prints `v22.x.x` or newer, and `claude --version` prints a version string.

## Install

1. Fork [qwibitai/nanoclaw](https://github.com/qwibitai/nanoclaw) on GitHub, then clone your fork:

   ```bash
   gh repo fork qwibitai/nanoclaw --clone
   cd nanoclaw
   ```

   <details>
   <summary>Without GitHub CLI</summary>

   1. Fork [qwibitai/nanoclaw](https://github.com/qwibitai/nanoclaw) on GitHub.
   2. Clone your fork: `git clone https://github.com/<your-username>/nanoclaw.git`
   3. `cd nanoclaw`

   </details>

2. Launch Claude Code from the repo root:

   ```bash
   claude
   ```

3. Run the setup skill:

   ```
   /setup
   ```

   The `/setup` skill installs dependencies, authenticates a messaging channel, registers your main chat, and configures the background service.

**Success indicator:** after `/setup` completes, your main channel receives a greeting from the assistant.

> **Note:** Commands prefixed with `/` (like `/setup`, `/add-whatsapp`) are [Claude Code skills](https://code.claude.com/docs/en/skills). Type them at the `claude` prompt, not in a shell.

## Usage

Talk to the assistant with your trigger word (default: `@Andy`):

```
@Andy send an overview of the sales pipeline every weekday morning at 9am
@Andy review the git history each Friday and update the README if it has drifted
@Andy every Monday at 8am, compile AI news from Hacker News and TechCrunch and message me a briefing
```

Manage groups and tasks from your main channel (self-chat):

```
@Andy list all scheduled tasks across groups
@Andy pause the Monday briefing task
@Andy join the Family Chat group
```

## Add a messaging channel

Run the matching skill from Claude Code inside the repo:

| Channel  | Skill                | Notes                                              |
| -------- | -------------------- | -------------------------------------------------- |
| WhatsApp | `/add-whatsapp`      | QR or pairing code; Baileys client                 |
| Telegram | `/add-telegram`      | Bot token from @BotFather                          |
| Slack    | `/add-slack`         | Socket Mode — no public URL needed                 |
| Discord  | `/add-discord`       | Bot token                                          |
| Gmail    | `/add-gmail`         | GCP OAuth; can be tool-only or a full channel      |
| X        | `/x-integration`     | Post, like, reply, retweet, quote                  |
| Emacs    | `/add-emacs`         | Local HTTP bridge — no token                       |

Run more than one at a time; channels self-register at startup.

## Customize

NanoClaw has no configuration file. To change behavior, edit code. Ask Claude Code:

- "Change the trigger word to @Bob."
- "Make responses shorter and more direct from now on."
- "Add a custom greeting when I say good morning."

Or run `/customize` for a guided walkthrough. The codebase is small enough that Claude can safely modify it on your behalf.

## How it works

```
Messaging channel → SQLite → Polling loop → Container (Claude Agent SDK) → Reply
```

A single Node.js process watches registered chats, enqueues new messages per group, and spawns a short-lived Linux container for each agent turn. Containers mount only the group's workspace and a few shared paths; everything else is invisible to the agent.

Read the full architecture at [docs.nanoclaw.dev/concepts/architecture](https://docs.nanoclaw.dev/concepts/architecture).

**Key files:**

| File                         | Purpose                                                         |
| ---------------------------- | --------------------------------------------------------------- |
| `src/index.ts`               | Orchestrator: state, message loop, agent invocation             |
| `src/channels/registry.ts`   | Channel registry (channels self-register at startup)            |
| `src/ipc.ts`                 | IPC watcher and task processing                                 |
| `src/router.ts`              | Message formatting and outbound routing                         |
| `src/group-queue.ts`         | Per-group queue with global concurrency limit                   |
| `src/container-runner.ts`    | Spawns streaming agent containers                               |
| `src/container-runtime.ts`   | Runtime abstraction (Docker / Apple Container)                  |
| `src/credential-proxy.ts`    | Local proxy that injects credentials into outbound API requests |
| `src/task-scheduler.ts`      | Runs scheduled tasks                                            |
| `src/db.ts`                  | SQLite operations — messages, groups, sessions, state           |
| `groups/{name}/CLAUDE.md`    | Per-group memory (isolated)                                     |

## Skills and plugins inside containers

Container agents do **not** inherit your host Claude Code environment. They see only what's mounted. This is intentional — each group gets a curated, isolated slate.

| Source                                                          | Visible to container? | Scope                         |
| --------------------------------------------------------------- | --------------------- | ----------------------------- |
| `~/.claude/plugins/` (host user plugins)                        | No                    | Host-only                     |
| `~/.claude/skills/` (host user skills)                          | No                    | Host-only                     |
| `.claude/skills/` in the repo (`/setup`, `/add-telegram`, etc.) | Yes                   | Main group only               |
| `.mcp.json` in the repo                                         | Yes                   | Main group only               |
| `container/skills/` (e.g. `agent-browser`, `slack-formatting`)  | Yes                   | Every group — synced at spawn |
| `groups/{name}/CLAUDE.md`                                       | Yes                   | That group only               |

### Make a host plugin available to containers

1. Locate the skill directory inside your host plugin, for example:

   ```
   ~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/skills/<skill-name>
   ```

2. Copy it into `container/skills/`:

   ```bash
   cp -R ~/.claude/plugins/cache/.../<skill-name> container/skills/
   ```

3. Rebuild the container image:

   ```bash
   ./container/build.sh
   ```

4. Restart the service — macOS: `launchctl kickstart -k gui/$(id -u)/com.nanoclaw`; Linux: `systemctl --user restart nanoclaw`.

**Success indicator:** the skill appears under `/home/node/.claude/skills/` inside the next spawned container. Confirm with `container logs <container-name>` (Apple Container) or `docker logs <container-name>`.

**Do not mount `~/.claude/plugins/` directly.** That bypasses the isolation model — every group would gain access to anything your user account can do in Claude Code.

## Replicate our setup — macOS 26 + Apple Container + custom Anthropic endpoint

<details>
<summary>Expand for the exact recipe we used</summary>

This fork runs on macOS 26 (Darwin 25) using Apple Container as the runtime and a LEGO-managed Anthropic-compatible gateway as the model endpoint. If your environment matches, these are the steps that work end-to-end.

**1. Clone outside `~/Documents/`.**

macOS TCC blocks `launchd`-spawned processes from running scripts or resolving `getcwd()` inside `~/Documents/`. Use `~/nanoclaw/` or similar.

```bash
git clone <your-fork> ~/nanoclaw
cd ~/nanoclaw
```

**Success indicator:** `pwd` returns a path outside `~/Documents/`.

**2. Install and start Apple Container.**

See the [Apple Container release notes](https://github.com/apple/container/releases) for install. Then:

```bash
container system start
container system status     # should print "status: running"
```

**3. Enable container networking (macOS 26 only).**

Apple Container's bridge network needs host IP forwarding and NAT to reach the internet from inside containers. Run with `sudo`:

```bash
sudo sysctl -w net.inet.ip.forwarding=1
echo "nat on en0 from 192.168.64.0/24 to any -> (en0)" | sudo pfctl -ef -
```

For persistence across reboots, see [docs/APPLE-CONTAINER-NETWORKING.md](docs/APPLE-CONTAINER-NETWORKING.md). Replace `en0` with your active interface if different — check with `route get 8.8.8.8 | grep interface`.

**4. Switch the runtime to Apple Container.**

From `claude` at the repo root:

```
/convert-to-apple-container
```

This changes `CONTAINER_RUNTIME_BIN` in `src/container-runtime.ts` from `docker` to `container` and updates the mount and CLI syntax.

**5. Use the native credential proxy instead of OneCLI.**

```
/use-native-credential-proxy
```

Then add your credentials to `.env`:

```bash
ANTHROPIC_BASE_URL=https://your-gateway.example.com/claude
ANTHROPIC_AUTH_TOKEN=<your-token>
CREDENTIAL_PROXY_HOST=0.0.0.0
```

`CREDENTIAL_PROXY_HOST=0.0.0.0` is required because Apple Container's bridge interface (`bridge100`) does not exist until a container runs — the proxy must bind to all interfaces so containers can reach it via the bridge gateway IP (`192.168.64.1`).

**6. If your gateway exposes namespaced model IDs, set them in `.env`.**

Example for a LEGO AMMA-backed endpoint:

```bash
ANTHROPIC_MODEL="anthropic.claude-opus-4-7"
ANTHROPIC_DEFAULT_OPUS_MODEL="anthropic.claude-opus-4-7"
ANTHROPIC_DEFAULT_SONNET_MODEL="anthropic.claude-sonnet-4-6"
ANTHROPIC_DEFAULT_HAIKU_MODEL="anthropic.claude-haiku-4-5-20251001-v1:0"
```

These are forwarded into the container at spawn time, so Claude Code resolves the right model IDs on the gateway.

**7. Build, register, and start.**

```bash
./container/build.sh      # build the agent image
npm install && npm run build
```

Configure `launchctl` via the `/setup` skill or point a plist at `node /path/to/repo/dist/index.js` with `WorkingDirectory` set to the repo root.

**Success indicator:** send a message to your registered chat. You should receive a reply within 5-10 seconds on a cold start.

**Troubleshooting:**

| Symptom                                                    | Likely cause                                     | Fix                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| `Error: path '/dev/null' is not a directory`               | `.env` shadow mount incompatible with Apple Container | Already handled in this fork's `container-runner.ts`                   |
| Agent replies "Not logged in / Please run /login"          | Container cannot reach credential proxy          | Set `CREDENTIAL_PROXY_HOST=0.0.0.0`; ensure `192.168.64.1:3001` is reachable from a test container |
| Agent replies "model may not exist or you may not have access" | Model IDs not forwarded / wrong for the gateway | Set `ANTHROPIC_MODEL` + `ANTHROPIC_DEFAULT_*_MODEL` in `.env`          |
| `launchd` exits with code 78 and no logs                   | macOS TCC denies `getcwd` in `~/Documents/`       | Move the repo out of `~/Documents/`                                    |
| `curl: (28) Connection timed out` from inside a container  | IP forwarding disabled                           | `sudo sysctl -w net.inet.ip.forwarding=1` + NAT rule (step 3)          |

</details>

## Troubleshooting

Ask Claude Code. *"Why isn't the scheduler running?"* *"What's in the recent logs?"* *"Why did this message not get a response?"* The AI-native approach is part of NanoClaw's design.

For container and authentication issues specifically, run `/debug` inside `claude`.

## Contributing

**Do not add features. Add skills.**

If you want Telegram support, do not submit a PR that adds Telegram to the core codebase. Fork, build it on a branch, and open a PR. We publish accepted branches as `skill/telegram` (etc.) for other users to merge into their own forks.

Users then run `/add-telegram` on their fork and get clean code that does exactly what they need — no bloat for things they don't use.

**Skills we'd like to see:**

- `/add-signal` — Signal as a channel

**What gets accepted into the base codebase:** security fixes, bug fixes, and clear improvements. Nothing else. Everything else is a skill.

## FAQ

**Can I run this on Linux or Windows?** Yes. Docker is the default runtime and works on macOS, Linux, and Windows (via WSL2). Run `/setup`.

**Is this secure?** Agents run in containers, not behind application-level permission checks. They can only access explicitly mounted directories. Credentials never enter the container — a local credential proxy (native `/use-native-credential-proxy`, or [OneCLI's Agent Vault](https://github.com/onecli/onecli) for org-managed deployments) injects auth on the way out. Review the full model at [docs.nanoclaw.dev/concepts/security](https://docs.nanoclaw.dev/concepts/security).

**Why no configuration files?** To avoid configuration sprawl. Customize by editing code — NanoClaw is small enough that this is safe.

**Can I use third-party or open-source models?** Yes. Any Claude API-compatible endpoint works. Set `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` (or `ANTHROPIC_API_KEY`) in `.env`. Works with local [Ollama](https://ollama.ai) via a proxy, hosted endpoints like [Together AI](https://together.ai) or [Fireworks](https://fireworks.ai), and custom deployments.

**What about `/customize`?** Run it inside `claude` for a guided walkthrough of common customizations — channel changes, trigger words, custom behavior, integrations.

## Origin

NanoClaw was built by [@qwibitai](https://github.com/qwibitai) as a lightweight alternative to [OpenClaw](https://github.com/openclaw/openclaw) (~500k lines, 53 config files) with true OS-level container isolation instead of application-level permission checks. This fork tracks upstream and adds the `replicate our setup` recipe above for macOS 26 + Apple Container + custom-gateway environments.

## Community

Questions, ideas, or skills to share? [Join the Discord](https://discord.gg/VDdww8qS42).

## Changelog

See [CHANGELOG.md](CHANGELOG.md), or the [full release history](https://docs.nanoclaw.dev/changelog) on the documentation site.

## License

MIT
