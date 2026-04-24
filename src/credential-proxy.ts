/**
 * Credential proxy for container isolation.
 * Containers connect here instead of directly to the Anthropic API.
 * The proxy injects real credentials so containers never see them.
 *
 * Two auth modes:
 *   API key:  Proxy injects x-api-key on every request.
 *   OAuth:    Container CLI exchanges its placeholder token for a temp
 *             API key via /api/oauth/claude_cli/create_api_key.
 *             Proxy injects real OAuth token on that exchange request;
 *             subsequent requests carry the temp key which is valid as-is.
 */
import { createServer, Server } from 'http';
import { request as httpsRequest } from 'https';
import { request as httpRequest, RequestOptions } from 'http';

import { readEnvFile } from './env.js';
import { log } from './log.js';

export type AuthMode = 'api-key' | 'oauth';

export interface ProxyConfig {
  authMode: AuthMode;
}

export function startCredentialProxy(
  port: number,
  host = '127.0.0.1',
): Promise<Server> {
  const secrets = readEnvFile([
    'ANTHROPIC_API_KEY',
    'CLAUDE_CODE_OAUTH_TOKEN',
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_BASE_URL',
    'CREDENTIAL_PROXY_GATEWAY_MODE',
  ]);

  const authMode: AuthMode = secrets.ANTHROPIC_API_KEY ? 'api-key' : 'oauth';
  const oauthToken =
    secrets.CLAUDE_CODE_OAUTH_TOKEN || secrets.ANTHROPIC_AUTH_TOKEN;

  const upstreamUrl = new URL(
    secrets.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
  );
  const isHttps = upstreamUrl.protocol === 'https:';
  const makeRequest = isHttps ? httpsRequest : httpRequest;
  // Preserve the upstream path prefix (e.g. LEGO's AMMA routes have /claude).
  // Normalize to '' (not '/') so we concatenate cleanly with req.url.
  const upstreamBasePath =
    upstreamUrl.pathname === '/' ? '' : upstreamUrl.pathname.replace(/\/$/, '');

  // Gateway mode: inject Authorization: Bearer on every request, strip any
  // placeholder x-api-key. Needed for gateways like LEGO AMMA that accept a
  // static bearer and have no OAuth exchange endpoint. Explicit opt-in via
  // CREDENTIAL_PROXY_GATEWAY_MODE=true; default is auto-detect by hostname
  // (anything not api.anthropic.com is treated as a gateway).
  const gatewayModeExplicit = (
    process.env.CREDENTIAL_PROXY_GATEWAY_MODE ||
    secrets.CREDENTIAL_PROXY_GATEWAY_MODE ||
    ''
  ).toLowerCase();
  const gatewayMode =
    gatewayModeExplicit === 'true' ||
    gatewayModeExplicit === '1' ||
    (gatewayModeExplicit === '' && upstreamUrl.hostname !== 'api.anthropic.com');

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks);
        const headers: Record<string, string | number | string[] | undefined> =
          {
            ...(req.headers as Record<string, string>),
            host: upstreamUrl.host,
            'content-length': body.length,
          };

        // Strip hop-by-hop headers that must not be forwarded by proxies
        delete headers['connection'];
        delete headers['keep-alive'];
        delete headers['transfer-encoding'];

        if (authMode === 'api-key') {
          delete headers['x-api-key'];
          headers['x-api-key'] = secrets.ANTHROPIC_API_KEY;
        } else if (gatewayMode && oauthToken) {
          // Gateway mode: swap any placeholder auth for Bearer <real token>
          // on every request. No OAuth exchange endpoint upstream.
          delete headers['x-api-key'];
          delete headers['authorization'];
          headers['authorization'] = `Bearer ${oauthToken}`;
        } else if (headers['authorization']) {
          // Anthropic-direct OAuth: only swap when the client sends
          // Authorization (exchange request + auth probes). Post-exchange
          // requests use x-api-key only and pass through unchanged.
          delete headers['authorization'];
          if (oauthToken) {
            headers['authorization'] = `Bearer ${oauthToken}`;
          }
        }

        const upstream = makeRequest(
          {
            hostname: upstreamUrl.hostname,
            port: upstreamUrl.port || (isHttps ? 443 : 80),
            path: `${upstreamBasePath}${req.url}`,
            method: req.method,
            headers,
          } as RequestOptions,
          (upRes) => {
            res.writeHead(upRes.statusCode!, upRes.headers);
            upRes.pipe(res);
          },
        );

        upstream.on('error', (err) => {
          log.error('Credential proxy upstream error', { err, url: req.url });
          if (!res.headersSent) {
            res.writeHead(502);
            res.end('Bad Gateway');
          }
        });

        upstream.write(body);
        upstream.end();
      });
    });

    server.listen(port, host, () => {
      log.info('Credential proxy started', {
        port,
        host,
        authMode,
        gatewayMode,
        upstream: upstreamUrl.origin + upstreamBasePath,
      });
      resolve(server);
    });

    server.on('error', reject);
  });
}

/** Detect which auth mode the host is configured for. */
export function detectAuthMode(): AuthMode {
  const secrets = readEnvFile(['ANTHROPIC_API_KEY']);
  return secrets.ANTHROPIC_API_KEY ? 'api-key' : 'oauth';
}
