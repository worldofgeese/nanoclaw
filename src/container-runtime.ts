/**
 * Container runtime abstraction for NanoClaw.
 * All runtime-specific logic lives here so swapping runtimes means changing one file.
 *
 * This build targets Apple Container (macOS). The binary is `container`,
 * mount syntax differs from Docker, and startup/orphan-cleanup use the
 * Apple Container CLI semantics.
 */
import { execSync } from 'child_process';
import os from 'os';

import { CONTAINER_INSTALL_LABEL } from './config.js';
import { readEnvFile } from './env.js';
import { log } from './log.js';

/** The container runtime binary name. */
export const CONTAINER_RUNTIME_BIN = 'container';

/**
 * IP address containers use to reach the host machine.
 * Apple Container on macOS: host.docker.internal does NOT resolve inside
 * containers (as of 0.11), so we use the bridge100 gateway IP directly.
 * Detected from the bridge100/bridge0 interface, falling back to 192.168.64.1.
 */
export const CONTAINER_HOST_GATEWAY = detectHostGateway();

function detectHostGateway(): string {
  const ifaces = os.networkInterfaces();
  const bridge = ifaces['bridge100'] || ifaces['bridge0'];
  if (bridge) {
    const ipv4 = bridge.find((a) => a.family === 'IPv4');
    if (ipv4) return ipv4.address;
  }
  return '192.168.64.1';
}

/**
 * Address the credential proxy binds to.
 * Apple Container's bridge100 only exists while containers run, but the
 * proxy must start before any container. Fallback chain:
 *   1. process.env.CREDENTIAL_PROXY_HOST (launchd / dev override)
 *   2. .env file (where the user typically sets 0.0.0.0)
 *   3. detectProxyBindHost() — 0.0.0.0 on macOS; 127.0.0.1 elsewhere
 */
export const PROXY_BIND_HOST =
  process.env.CREDENTIAL_PROXY_HOST ||
  readEnvFile(['CREDENTIAL_PROXY_HOST']).CREDENTIAL_PROXY_HOST ||
  detectProxyBindHost();

function detectProxyBindHost(): string {
  // On macOS (Apple Container), bridge100 is only up while containers run,
  // so we bind to 0.0.0.0. On other platforms fall back to loopback.
  return os.platform() === 'darwin' ? '0.0.0.0' : '127.0.0.1';
}

/** CLI args needed for the container to resolve the host gateway. */
export function hostGatewayArgs(): string[] {
  // Apple Container on macOS uses the bridge IP directly (no --add-host needed).
  // On Linux with Docker-compat runtimes, host.docker.internal isn't built-in.
  if (os.platform() === 'linux') {
    return ['--add-host=host.docker.internal:host-gateway'];
  }
  return [];
}

/** Returns CLI args for a readonly bind mount (Apple Container syntax). */
export function readonlyMountArgs(
  hostPath: string,
  containerPath: string,
): string[] {
  return [
    '--mount',
    `type=bind,source=${hostPath},target=${containerPath},readonly`,
  ];
}

/** Stop a container by name. Uses execSync with shell metachar guard. */
export function stopContainer(name: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name)) {
    throw new Error(`Invalid container name: ${name}`);
  }
  execSync(`${CONTAINER_RUNTIME_BIN} stop ${name}`, { stdio: 'pipe' });
}

/** Ensure the container runtime is running, starting it if needed. */
export function ensureContainerRuntimeRunning(): void {
  try {
    execSync(`${CONTAINER_RUNTIME_BIN} system status`, {
      stdio: 'pipe',
      timeout: 10000,
    });
    log.debug('Container runtime already running');
    return;
  } catch {
    // System isn't running yet — fall through to start.
  }
  log.info('Starting container runtime...');
  try {
    execSync(`${CONTAINER_RUNTIME_BIN} system start`, {
      stdio: 'pipe',
      timeout: 30000,
    });
    log.info('Container runtime started');
  } catch (err) {
    log.error('Failed to start container runtime', { err });
    console.error(
      '\n╔════════════════════════════════════════════════════════════════╗',
    );
    console.error(
      '║  FATAL: Container runtime failed to start                      ║',
    );
    console.error(
      '║                                                                ║',
    );
    console.error(
      '║  Agents cannot run without a container runtime. To fix:        ║',
    );
    console.error(
      '║  1. Ensure Apple Container is installed                        ║',
    );
    console.error(
      '║  2. Run: container system start                                ║',
    );
    console.error(
      '║  3. Restart NanoClaw                                           ║',
    );
    console.error(
      '╚════════════════════════════════════════════════════════════════╝\n',
    );
    throw new Error('Container runtime is required but failed to start', {
      cause: err,
    });
  }
}

/**
 * Kill orphaned NanoClaw containers from THIS install's previous runs.
 *
 * Scoped by label `nanoclaw-install=<slug>` so a crash-looping peer install
 * cannot reap our containers, and we cannot reap theirs. The label is
 * stamped onto every container at spawn time — see container-runner.ts.
 *
 * Apple Container's `ls --format json` output shape:
 *   [{ "status": "running", "configuration": { "id": "name", "labels": {...} } }, ...]
 * Labels are only filterable in-process, so we filter by name prefix +
 * label presence after JSON-decoding.
 */
export function cleanupOrphans(): void {
  try {
    const output = execSync(`${CONTAINER_RUNTIME_BIN} ls --format json`, {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });
    type ACContainer = {
      status: string;
      configuration: {
        id: string;
        labels?: Record<string, string>;
      };
    };
    const containers: ACContainer[] = JSON.parse(output || '[]');
    const orphans = containers
      .filter((c) => {
        if (c.status !== 'running') return false;
        const id = c.configuration?.id || '';
        const labels = c.configuration?.labels || {};
        const hasInstallLabel = Object.entries(labels).some(
          ([k, v]) => `${k}=${v}` === CONTAINER_INSTALL_LABEL,
        );
        // Accept either: our install label is set, or name matches our prefix.
        return hasInstallLabel || id.startsWith('nanoclaw-');
      })
      .map((c) => c.configuration.id);

    for (const name of orphans) {
      try {
        stopContainer(name);
      } catch {
        /* already stopped */
      }
    }
    if (orphans.length > 0) {
      log.info('Stopped orphaned containers', {
        count: orphans.length,
        names: orphans,
      });
    }
  } catch (err) {
    log.warn('Failed to clean up orphaned containers', { err });
  }
}
