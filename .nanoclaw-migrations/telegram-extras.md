# Telegram Extras on Top of v2's Chat SDK Bridge

v2's `/add-telegram` installs a better architecture than the user's
`telegram/main` merge: Chat SDK bridge, real ownership pairing via
4-digit code, legacy-Markdown sanitizer, retry logic. We adopt v2's
base and port three features from the fork:

1. Reply-context fields (`reply_to_message_id`, `reply_to_message_content`, `reply_to_sender_name`) + DB columns
2. Forum topic/thread support via `message_thread_id`
3. `add-telegram-swarm` skill (multi-bot pool, per-agent identity)

**Highest-risk stage of the migration.** v2's Telegram architecture is
fundamentally different. Each item below includes an adaptation note
explaining how the original v1 change maps onto v2's bridge.

## Feature 1: Reply-context fields + DB columns

### Source commits
- `86a1925 fix: persist reply context to DB and add tests`
- `062ce02 feat: pass Telegram reply/quoted message context to agent`

### What v2 already has
v2's `src/channels/telegram.ts` calls `extractReplyContext()` returning
`{ text, sender }` (two fields, no message ID). v2 pipes this into the
Chat SDK bridge but does NOT persist it. v2's `ReplyContext` type needs
extending.

### How to apply

**A. Extend `NewMessage` type** in `src/types.ts` (or wherever the v2
inbound message shape lives — check with `grep 'reply_to' src/`):

```typescript
reply_to_message_id?: string;
reply_to_message_content?: string;
reply_to_sender_name?: string;
```

**B. Add DB migration.** v2 has a two-DB session split: `inbound.db`
and `outbound.db`. Inbound messages are written by the host (channels)
and read by the container. Reply context lives on inbound. Find the
inbound schema file (likely `src/db/*.ts` or a dedicated migration
file) and add idempotent column adds inside the `createSchema()` or
equivalent:

```typescript
try {
  database.exec(`ALTER TABLE messages ADD COLUMN reply_to_message_id TEXT`);
  database.exec(`ALTER TABLE messages ADD COLUMN reply_to_message_content TEXT`);
  database.exec(`ALTER TABLE messages ADD COLUMN reply_to_sender_name TEXT`);
} catch { /* columns already exist */ }
```

**C. Update INSERT and SELECT statements.** Find `storeMessage` (or v2
equivalent): the INSERT must include the three columns as nullables.
Find `getMessagesSince` / `getNewMessages`: SELECTs must include the
three columns so they reach the formatter.

**D. Extract in `src/channels/telegram.ts`.** v2's version calls
`extractReplyContext()`. Extend it:

```typescript
const replyTo = ctx.message.reply_to_message;
const replyToMessageId = replyTo?.message_id?.toString();
const replyToContent = replyTo?.text || replyTo?.caption;
const replyToSenderName = replyTo
  ? replyTo.from?.first_name || replyTo.from?.username ||
    replyTo.from?.id?.toString() || 'Unknown'
  : undefined;
```
and pass into the `onMessage` / `hostOnInbound` call as
`reply_to_message_id`, `reply_to_message_content`, `reply_to_sender_name`.

**E. Render in `src/router.ts`** (or v2 equivalent `formatMessages`):

```typescript
const replyAttr = m.reply_to_message_id
  ? ` reply_to="${escapeXml(m.reply_to_message_id)}"`
  : '';
const replySnippet =
  m.reply_to_message_content && m.reply_to_sender_name
    ? `\n  <quoted_message from="${escapeXml(m.reply_to_sender_name)}">${escapeXml(m.reply_to_message_content)}</quoted_message>`
    : '';
return `<message sender="..." time="..."${replyAttr}>${replySnippet}${escapeXml(m.content)}</message>`;
```

**F. Adaptation note**: if v2's Chat SDK bridge shape doesn't carry
arbitrary optional fields, they must be added to the bridge type. Look
for the `hostOnInbound(platformId, threadId, message)` call signature
and extend the message shape.

## Feature 2: Forum topic/thread support

### Source commits
- `59c6aa6 fix(telegram): support message_thread_id for topics`
- `08a1ff3 fix(types): add thread_id to NewMessage for Telegram topic support`

### What v2 has
v2's bridge has an SDK-level `threadId` concept (Chat SDK threads) but
sets `supportsThreads: false` on the Telegram adapter — meaning forum
`message_thread_id` is NOT propagated. To make forum topics work, flip
the flag and wire the Telegram `message_thread_id` to the SDK thread ID.

### How to apply

**A. Extend `NewMessage` type** (may already be done in Feature 1 D):
```typescript
thread_id?: string;
```

**B. Flip `supportsThreads` to `true`** in v2's `src/channels/telegram.ts`
(inside the `createTelegramAdapter` options).

**C. Inbound extraction**:
```typescript
const threadId = ctx.message.message_thread_id;
```
Pass as `thread_id: threadId ? threadId.toString() : undefined` to the
bridge's inbound call.

**D. Outbound**: the bridge's send path needs to accept `threadId` and
convert back to Telegram's integer. In v2's adapter send function, add:
```typescript
const options = threadId
  ? { message_thread_id: parseInt(threadId, 10) }
  : {};
```
and pass `options` to every `sendTelegramMessage` call (including the
chunked path).

**E. Adaptation note**: if v2 routes via `@chat-adapter/telegram` (not
raw grammy), check whether that adapter exposes `message_thread_id` at
all. If not, the adapter needs patching or the send path needs to
bypass the adapter for the `message_thread_id` option. Worst case:
accept that forum topics don't work and drop this feature from the
replay — it's not critical for non-forum groups.

## Feature 3: `add-telegram-swarm` skill

### Source
`.claude/skills/add-telegram-swarm/SKILL.md` — ~380 lines, user's fork only.

### What v2 has
Nothing. v2 has no swarm support.

### How to apply

**A. Copy the skill directory verbatim** from the pre-migration tree:

```bash
cp -R "$PROJECT_ROOT/.claude/skills/add-telegram-swarm" .claude/skills/
```

**B. Re-add `grammy` to `package.json`**. v2's `/add-telegram` installs
`@chat-adapter/telegram` only. The swarm skill needs raw Grammy for
direct `Api` instances (pool bots don't poll; they only send):

```bash
pnpm install grammy@^1.39.3
```

**C. Follow the SKILL.md** — it describes the exact changes to:
- `src/config.ts` (add `TELEGRAM_BOT_POOL`)
- `src/channels/telegram.ts` (pool state, `initBotPool`, `sendPoolMessage`)
- IPC routing (handle `sender` field on outbound)
- MCP tool schema (`container/agent-runner/src/ipc-mcp-stdio.ts`): add
  optional `sender` parameter to `send_message`
- `src/index.ts`: call `initBotPool(TELEGRAM_BOT_POOL)` after Telegram init
- `.env`: `TELEGRAM_BOT_POOL=TOKEN1,TOKEN2,...`
- Per-group `CLAUDE.md` instructions for Agent Teams

**D. Adaptation note**: v2's `src/channels/telegram.ts` uses the
`@chat-adapter/telegram` adapter, not grammy directly. The swarm pool
needs its own raw `Api` instances ALONGSIDE the adapter. That's fine
— `Api` instances don't poll, they only send. The integration point
is purely the IPC → send path. If the IPC handler is now inside a
bridge, the `sender` field dispatch needs to happen BEFORE the bridge
dispatches to the adapter. Review v2's outbound flow in
`src/channels/telegram.ts` and `src/router.ts` to find the right hook.

**E. Agent-runner path**: v2 moved the agent runner to Bun (container
side only). The MCP tool file path may have changed. Check:
```bash
git ls-files container/agent-runner/ | grep ipc
```
The SKILL.md assumes a specific filename — adapt to v2's structure.

## Verification

For the full Telegram setup:
- `pnpm run build` succeeds
- `pnpm test` passes (adapt reply-context tests if needed)
- DB has the three `reply_to_*` columns: 
  `sqlite3 <inbound-db> ".schema messages" | grep reply_to`
- Send test: reply to a message in Telegram → agent receives quoted context
- Send test (forum only, if supportsThreads wired): message in a topic →
  reply lands in the same topic
- Send test (swarm only, if configured): set up 2-bot pool, trigger team
  mode, confirm subagent messages come from the second bot with its own
  display name

## Defer / drop options

If any of these features prove too complex to port to v2's architecture
within a reasonable time:
- **Reply context**: worth the effort; most visible UX feature
- **Forum threads**: can be deferred if user doesn't use forum groups
- **Swarm**: can be deferred if user doesn't use Agent Teams

Document any deferral in a TODO comment in the affected file.
