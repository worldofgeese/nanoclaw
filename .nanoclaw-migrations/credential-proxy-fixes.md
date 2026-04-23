# Credential Proxy Fixes

Three fix commits (`ed51043`, `847295a`, `54d2387`) layered on top of
`skill/native-credential-proxy`. All are dated 2026-04-22; none have been
upstreamed. All three must be replayed on v2 AFTER `/convert-to-apple-container`
and `/use-native-credential-proxy` have been applied.

## Fix 1 — `.env` fallback for `CREDENTIAL_PROXY_HOST`

**Intent**: Under macOS launchd, `process.env.CREDENTIAL_PROXY_HOST` is empty.
v2's `detectProxyBindHost()` returns `127.0.0.1` on macOS, which Apple Container
(bridge100 networking) cannot reach from inside containers — it needs `0.0.0.0`.
The `.env` fallback lets the user set `CREDENTIAL_PROXY_HOST=0.0.0.0` in `.env`.

**File**: `src/container-runtime.ts`

**How to apply**:

1. Add the import alongside the other imports at the top:
   ```typescript
   import { readEnvFile } from './env.js';
   ```
   (If `env.js` is already imported for other reasons, skip.)

2. Find the `PROXY_BIND_HOST` export. In v2 after the skill, it looks like:
   ```typescript
   export const PROXY_BIND_HOST =
     process.env.CREDENTIAL_PROXY_HOST || detectProxyBindHost();
   ```
   Replace with:
   ```typescript
   export const PROXY_BIND_HOST =
     process.env.CREDENTIAL_PROXY_HOST ||
     readEnvFile(['CREDENTIAL_PROXY_HOST']).CREDENTIAL_PROXY_HOST ||
     detectProxyBindHost();
   ```

## Fix 2 — Model env forwarding

**Intent**: Custom model IDs (e.g. LEGO AMMA namespaced IDs passed via
`ANTHROPIC_MODEL` / `ANTHROPIC_DEFAULT_*`) must reach the container so
gateways that expose custom model IDs resolve correctly.

**Note**: the companion change in this commit (`detectHostGateway()` in
`container-runtime.ts`) is already in v2's `/convert-to-apple-container`.
Only the model-env block below needs replaying.

**File**: `src/container-runner.ts`

**How to apply**:

1. Ensure `readEnvFile` is imported at the top:
   ```typescript
   import { readEnvFile } from './env.js';
   ```

2. Inside `buildContainerArgs`, locate the block where auth-mode env vars
   are pushed (the section that handles `CLAUDE_CODE_OAUTH_TOKEN` and
   related). Just before the `hostGatewayArgs()` call (or before the
   final args are returned), insert:

   ```typescript
   // Forward claude-code model overrides from .env so gateways that expose
   // custom model IDs (e.g. LEGO via AMMA) resolve correctly inside the container.
   const modelEnv = readEnvFile([
     'ANTHROPIC_MODEL',
     'ANTHROPIC_DEFAULT_OPUS_MODEL',
     'ANTHROPIC_DEFAULT_SONNET_MODEL',
     'ANTHROPIC_DEFAULT_HAIKU_MODEL',
   ]);
   for (const [key, value] of Object.entries(modelEnv)) {
     if (value) args.push('-e', `${key}=${value}`);
   }
   ```

3. v2's `container-runner.ts` has been substantially restructured. If
   `buildContainerArgs` no longer exists as a single function, the
   equivalent location is wherever `-e` flags are accumulated for the
   `container run` command. Match the insertion point to the same logical
   position (after auth env, before mount/network args).

## Fix 3 — Upstream path prefix

**Intent**: `ANTHROPIC_BASE_URL` can carry a path component (e.g.
`https://models.assistant.legogroup.io/claude`). v2's proxy forwards
`req.url` directly, stripping the `/claude` prefix and hitting the wrong
upstream route. Preserve the path component.

**File**: `src/credential-proxy.ts`

**How to apply**:

1. Find the line that computes `makeRequest`:
   ```typescript
   const makeRequest = isHttps ? httpsRequest : httpRequest;
   ```
   Immediately after it, insert:
   ```typescript
   // Preserve the upstream path prefix (e.g. LEGO's AMMA routes have /claude).
   // Normalize to '' (not '/') so we concatenate cleanly with req.url.
   const upstreamBasePath =
     upstreamUrl.pathname === '/' ? '' : upstreamUrl.pathname.replace(/\/$/, '');
   ```

2. Find the `makeRequest` call options object. Change:
   ```typescript
   path: req.url,
   ```
   to:
   ```typescript
   path: `${upstreamBasePath}${req.url}`,
   ```

## Verification after all three fixes

- `pnpm run build` succeeds
- Grep `src/container-runtime.ts` for `readEnvFile.*CREDENTIAL_PROXY_HOST` — match present
- Grep `src/container-runner.ts` for `ANTHROPIC_DEFAULT_OPUS_MODEL` — match present
- Grep `src/credential-proxy.ts` for `upstreamBasePath` — match present
