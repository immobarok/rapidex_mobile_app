import {
  PublicIpInfo,
  VpnProtocol,
  VpnServer,
  WireGuardProfileConfig,
} from '../types';
import { parseWireGuardConfig } from './wireguardConfigParser';

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64Utf8(input: string): string {
  const clean = input.replace(/[^A-Za-z0-9+/=]/g, '');
  if (!clean) {
    return '';
  }

  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const byteLength = Math.floor((clean.length * 3) / 4) - padding;
  if (byteLength <= 0) {
    return '';
  }

  const bytes = new Uint8Array(byteLength);
  let byteIdx = 0;

  for (let i = 0; i < clean.length; i += 4) {
    const c1 = BASE64_CHARS.indexOf(clean[i]);
    const c2 = BASE64_CHARS.indexOf(clean[i + 1]);
    const c3 = clean[i + 2] === '=' ? 0 : BASE64_CHARS.indexOf(clean[i + 2]);
    const c4 = clean[i + 3] === '=' ? 0 : BASE64_CHARS.indexOf(clean[i + 3]);

    if (c1 < 0 || c2 < 0 || c3 < 0 || c4 < 0) {
      return '';
    }

    const triple = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4;
    if (byteIdx < byteLength) bytes[byteIdx++] = (triple >> 16) & 0xff;
    if (byteIdx < byteLength) bytes[byteIdx++] = (triple >> 8) & 0xff;
    if (byteIdx < byteLength) bytes[byteIdx++] = triple & 0xff;
  }

  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(bytes);
  }

  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  fields.push(current);
  return fields;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
  }
  return '';
}

function readNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'number' && Number.isFinite(val)) {
      return val;
    }
    if (typeof val === 'string' && /^\d+(\.\d+)?$/.test(val.trim())) {
      return Number(val.trim());
    }
  }
  return null;
}

function readStringList(obj: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const val = obj[key];
    if (Array.isArray(val)) {
      const clean = val
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
      if (clean.length > 0) {
        return clean;
      }
    }
    if (typeof val === 'string' && val.trim().length > 0) {
      const split = val
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      if (split.length > 0) {
        return split;
      }
    }
  }
  return [];
}

function extractWireGuardConfigFromJson(
  record: Record<string, unknown>,
  fallbackName?: string
): WireGuardProfileConfig | undefined {
  const rawConf = readString(record, ['wgConf', 'configText', 'wireguardConfig']);
  if (rawConf) {
    const parsed = parseWireGuardConfig(rawConf, fallbackName);
    if (parsed.ok) {
      return parsed.config;
    }
  }

  const nestedRaw = record.wireguard ?? record.peer ?? record.tunnel;
  const target = isRecord(nestedRaw) ? nestedRaw : record;

  const privateKey = readString(target, ['privateKey', 'private_key']);
  const publicKey = readString(target, ['publicKey', 'public_key']);
  let serverAddress = readString(target, [
    'serverAddress',
    'server_address',
    'host',
    'ip',
  ]);
  let serverPort = readNumber(target, ['serverPort', 'server_port', 'port']);

  const endpoint = readString(target, ['endpoint']);
  if (endpoint && (!serverAddress || !serverPort)) {
    const lastColon = endpoint.lastIndexOf(':');
    if (lastColon > 0) {
      serverAddress = endpoint.slice(0, lastColon).replace(/^\[|\]$/g, '');
      const parsedPort = Number.parseInt(endpoint.slice(lastColon + 1), 10);
      if (Number.isFinite(parsedPort)) {
        serverPort = parsedPort;
      }
    }
  }

  if (!privateKey || !publicKey || !serverAddress || !serverPort) {
    return undefined;
  }

  const rawAddresses = readStringList(target, ['address', 'addresses', 'tunnelIp']);
  const rawAllowed = readStringList(target, ['allowedIPs', 'allowed_ips']);
  const rawDns = readStringList(target, ['dns']);
  const mtu = readNumber(target, ['mtu']) ?? undefined;
  const presharedKey = readString(target, ['presharedKey', 'preshared_key']) || undefined;

  return {
    privateKey,
    publicKey,
    serverAddress,
    serverPort,
    addresses: rawAddresses.length > 0 ? rawAddresses : ['10.64.0.2/32'],
    allowedIPs: rawAllowed.length > 0 ? rawAllowed : ['0.0.0.0/0', '::/0'],
    dns: rawDns.length > 0 ? rawDns : ['1.1.1.1', '1.0.0.1'],
    mtu,
    presharedKey,
  };
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 7000,
  externalSignal?: AbortSignal
): Promise<{ ok: boolean; status: number; text: string; rttMs: number }> {
  const controller = new AbortController();
  let didTimeout = false;

  if (externalSignal?.aborted) {
    controller.abort();
  }

  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onAbort);

  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      text,
      rttMs: Math.max(1, Date.now() - startedAt),
    };
  } catch (err) {
    if (didTimeout) {
      throw new Error(
        `Request timed out after ${Math.round(timeoutMs / 1000)}s.`
      );
    }
    if (
      err instanceof Error &&
      err.message.toLowerCase().includes('aborted') &&
      !externalSignal?.aborted
    ) {
      throw new Error('Network request was interrupted. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Fetches live public IP and ISP/country metadata via HTTPS so users can verify
 * whether traffic is routed directly or through their WireGuard exit IP.
 */
export async function fetchPublicIpInfo(
  signal?: AbortSignal
): Promise<PublicIpInfo> {
  try {
    const primary = await fetchJsonWithTimeout(
      'https://ipwho.is/',
      { headers: { Accept: 'application/json' } },
      5000,
      signal
    );
    if (primary.ok) {
      const parsed: unknown = JSON.parse(primary.text);
      if (isRecord(parsed) && parsed.success !== false) {
        const ip = readString(parsed, ['ip']);
        if (ip) {
          const connection = isRecord(parsed.connection)
            ? parsed.connection
            : undefined;
          return {
            ip,
            country: readString(parsed, ['country']) || undefined,
            city: readString(parsed, ['city']) || undefined,
            isp: connection
              ? readString(connection, ['isp', 'org']) || undefined
              : undefined,
            rttMs: primary.rttMs,
            fetchedAt: Date.now(),
          };
        }
      }
    }
  } catch {
    // Fall through to minimalist IP lookup endpoint
  }

  const fallback = await fetchJsonWithTimeout(
    'https://api.ipify.org?format=json',
    { headers: { Accept: 'application/json' } },
    5000,
    signal
  );
  if (!fallback.ok) {
    throw new Error(`Public IP lookup failed (HTTP ${fallback.status}).`);
  }
  const parsed: unknown = JSON.parse(fallback.text);
  if (!isRecord(parsed)) {
    throw new Error('Unexpected response from public IP lookup.');
  }
  const ip = readString(parsed, ['ip']);
  if (!ip) {
    throw new Error('Public IP address missing in lookup response.');
  }
  return {
    ip,
    rttMs: fallback.rttMs,
    fetchedAt: Date.now(),
  };
}

/**
 * Fetches available VPN server nodes (with optional inline or on-demand WireGuard configs)
 * from a configured provisioning backend.
 */
export async function fetchRemoteVpnServers(
  apiUrl: string,
  signal?: AbortSignal
): Promise<VpnServer[]> {
  const trimmed = apiUrl.trim();
  if (!trimmed) {
    throw new Error('Configure a VPN Provisioning Server URL in Settings first.');
  }

  const res = await fetchJsonWithTimeout(
    trimmed,
    { method: 'GET', headers: { Accept: 'application/json' } },
    8000,
    signal
  );
  if (!res.ok) {
    throw new Error(`VPN server list request failed (HTTP ${res.status}).`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(res.text);
  } catch {
    throw new Error('VPN server API returned invalid JSON.');
  }

  const rawList: unknown[] = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.servers)
      ? payload.servers
      : isRecord(payload) && Array.isArray(payload.nodes)
        ? payload.nodes
        : [];

  const servers: VpnServer[] = [];
  for (let i = 0; i < rawList.length; i += 1) {
    const item = rawList[i];
    if (!isRecord(item)) {
      continue;
    }

    const country =
      readString(item, ['country', 'name', 'location']) || `Node ${i + 1}`;
    const city = readString(item, ['city', 'region']) || 'Edge';
    const code =
      readString(item, ['code', 'countryCode', 'country_code']).toUpperCase() ||
      country.slice(0, 2).toUpperCase();
    const id =
      readString(item, ['id', 'slug', 'nodeId']) ||
      `remote-${code.toLowerCase()}-${i + 1}`;
    const wgConfig = extractWireGuardConfigFromJson(item, country);
    const ovpnConfig =
      readString(item, ['ovpnConfig', 'openVPNConfig', 'ovpn']) || undefined;
    const rawProto = readString(item, ['protocol']).toLowerCase();
    const protocol: VpnProtocol =
      rawProto === 'openvpn' || (ovpnConfig && !wgConfig) ? 'OpenVPN' : 'WireGuard';

    const endpointHost =
      wgConfig?.serverAddress ||
      readString(item, ['serverAddress', 'host', 'endpointHost', 'ip']) ||
      'Provisioned';
    const provisionPath =
      readString(item, ['provisionUrl', 'provisionPath', 'connectUrl']) ||
      undefined;

    const latencyMs = readNumber(item, ['latencyMs', 'pingMs', 'rttMs']);
    const loadPercent = readNumber(item, ['loadPercent', 'load']);

    servers.push({
      id,
      name: readString(item, ['name']) || `${country} · ${city}`,
      country,
      city,
      code: code.slice(0, 3),
      protocol,
      latencyMs: latencyMs ?? res.rttMs,
      loadPercent: loadPercent !== null ? Math.min(100, Math.max(0, loadPercent)) : null,
      endpointHost,
      source: 'remote',
      wireguardConfig: wgConfig,
      ovpnConfig,
      provisionPath,
    });
  }

  if (servers.length === 0) {
    throw new Error('VPN server API returned 0 server nodes.');
  }

  return servers;
}

function resolveProvisionUrl(baseApiUrl: string, server: VpnServer): string {
  if (server.provisionPath) {
    return new URL(server.provisionPath, baseApiUrl).toString();
  }
  const normalizedBase = baseApiUrl.replace(/\/+$/, '');
  return `${normalizedBase}/provision`;
}

/**
 * Provisions a peer WireGuard configuration on-demand from the configured VPN API.
 */
export async function provisionRemoteServerConfig(
  apiUrl: string,
  server: VpnServer,
  signal?: AbortSignal
): Promise<WireGuardProfileConfig> {
  if (server.wireguardConfig) {
    return server.wireguardConfig;
  }
  const targetUrl = resolveProvisionUrl(apiUrl.trim(), server);

  let res = await fetchJsonWithTimeout(
    targetUrl,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/plain',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ serverId: server.id, code: server.code }),
    },
    8000,
    signal
  );

  if (res.status === 405) {
    const sep = targetUrl.includes('?') ? '&' : '?';
    res = await fetchJsonWithTimeout(
      `${targetUrl}${sep}serverId=${encodeURIComponent(server.id)}`,
      { method: 'GET', headers: { Accept: 'application/json, text/plain' } },
      8000,
      signal
    );
  }

  if (!res.ok) {
    throw new Error(`Failed to provision WireGuard peer (HTTP ${res.status}).`);
  }

  const trimmed = res.text.trim();
  if (trimmed.startsWith('[')) {
    const parsedConf = parseWireGuardConfig(trimmed, server.country);
    if (!parsedConf.ok) {
      throw new Error(parsedConf.errorMessage);
    }
    return parsedConf.config;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(trimmed);
  } catch {
    throw new Error('VPN provisioning API returned neither valid JSON nor .conf.');
  }

  if (!isRecord(parsedJson)) {
    throw new Error('Unexpected provisioning payload.');
  }

  const config = extractWireGuardConfigFromJson(parsedJson, server.country);
  if (!config) {
    throw new Error(
      'Provisioning response is missing WireGuard keys/endpoint fields.'
    );
  }
  return config;
}

const VPNGATE_FEED_SOURCES = [
  'https://raw.githubusercontent.com/GeorgeXie2333/vpngate-list-mirror/main/data/vpngate.csv',
  'https://cdn.jsdelivr.net/gh/GeorgeXie2333/vpngate-list-mirror@main/data/vpngate.csv',
  'https://www.vpngate.net/api/iphone/',
] as const;

const COUNTRY_LABEL_ALIASES: Record<string, string> = {
  'Korea Republic of': 'South Korea',
  'Russian Federation': 'Russia',
  'Viet Nam': 'Vietnam',
  'United States of America': 'United States',
};

function normalizeCountryLabel(raw: string): string {
  const clean = raw.trim();
  return COUNTRY_LABEL_ALIASES[clean] ?? clean;
}

type ParsedGateCandidate = {
  score: number;
  server: VpnServer;
};

/**
 * Parses the public VPN Gate `/api/iphone/` CSV feed into ready-to-connect
 * OpenVPN server entries ranked by relay health score and balanced across countries.
 */
export function parseVpnGateCsv(csvText: string): VpnServer[] {
  const lines = csvText.split(/\r?\n/);
  let colMap: Record<string, number> = {
    HostName: 0,
    IP: 1,
    Score: 2,
    Ping: 3,
    Speed: 4,
    CountryLong: 5,
    CountryShort: 6,
    NumVpnSessions: 7,
    OpenVPN_ConfigData_Base64: 14,
  };

  const candidates: ParsedGateCandidate[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line === '*' || line.startsWith('*vpn_servers')) {
      continue;
    }

    if (line.startsWith('#')) {
      const headers = splitCsvLine(line.slice(1));
      const dynamicMap: Record<string, number> = {};
      headers.forEach((h, idx) => {
        const key = h.trim();
        if (key) {
          dynamicMap[key] = idx;
        }
      });
      if ('IP' in dynamicMap && 'OpenVPN_ConfigData_Base64' in dynamicMap) {
        colMap = dynamicMap;
      }
      continue;
    }

    const fields = splitCsvLine(line);
    const ip = (fields[colMap.IP] ?? '').trim();
    const base64Config = (fields[colMap.OpenVPN_ConfigData_Base64] ?? '').trim();
    if (!ip || !base64Config) {
      continue;
    }

    const ovpnConfig = decodeBase64Utf8(base64Config).replace(/\r\n/g, '\n').trim();
    if (!ovpnConfig || !/\bremote\s+\S+/i.test(ovpnConfig)) {
      continue;
    }

    const scoreRaw = Number.parseFloat(fields[colMap.Score] ?? '0');
    const score = Number.isFinite(scoreRaw) ? scoreRaw : 0;

    const pingRaw = Number.parseInt(fields[colMap.Ping] ?? '', 10);
    const latencyMs =
      Number.isFinite(pingRaw) && pingRaw > 0 && pingRaw < 5000 ? pingRaw : null;

    const speedBps = Number.parseFloat(fields[colMap.Speed] ?? '0');
    const speedMbps =
      Number.isFinite(speedBps) && speedBps > 0
        ? Math.max(0.1, Number((speedBps / 1_000_000).toFixed(1)))
        : null;

    const rawCountry = fields[colMap.CountryLong] ?? '';
    const country = normalizeCountryLabel(rawCountry) || 'Public Relay';
    const rawCode = (fields[colMap.CountryShort] ?? '').trim().toUpperCase();
    const code = (rawCode || country.slice(0, 2)).toUpperCase().slice(0, 3);
    const hostName = (fields[colMap.HostName] ?? '').trim();

    const cityLabel = speedMbps
      ? `${speedMbps} Mbps · Free OpenVPN`
      : 'Free OpenVPN';

    candidates.push({
      score,
      server: {
        id: `vpngate-${hostName || code.toLowerCase()}-${ip}`,
        name: country,
        country,
        city: cityLabel,
        code,
        protocol: 'OpenVPN',
        latencyMs,
        speedMbps,
        loadPercent: null,
        endpointHost: ip,
        source: 'vpngate',
        ovpnConfig,
        ovpnUsername: 'vpn',
        ovpnPassword: 'vpn',
      },
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const selected: VpnServer[] = [];
  const perCountryCount = new Map<string, number>();

  for (const candidate of candidates) {
    const codeKey = candidate.server.code || candidate.server.country;
    const count = perCountryCount.get(codeKey) ?? 0;
    if (count >= 3) {
      continue;
    }
    const nextCount = count + 1;
    perCountryCount.set(codeKey, nextCount);

    selected.push({
      ...candidate.server,
      name:
        nextCount === 1
          ? candidate.server.country
          : `${candidate.server.country} #${nextCount}`,
    });

    if (selected.length >= 30) {
      break;
    }
  }

  return selected;
}

/**
 * Automatically fetches live public OpenVPN relays via fast compressed CDN
 * mirrors first, falling back to the upstream VPN Gate feed with a generous
 * timeout so users can connect in 1 tap without configuring servers.
 */
export async function fetchFreeVpnGateServers(
  signal?: AbortSignal
): Promise<VpnServer[]> {
  let lastError: Error | null = null;

  for (const feedUrl of VPNGATE_FEED_SOURCES) {
    if (signal?.aborted) {
      throw new Error('Cancelled loading free VPN servers.');
    }

    const timeoutMs = feedUrl.includes('vpngate.net') ? 45000 : 12000;
    try {
      const res = await fetchJsonWithTimeout(
        feedUrl,
        {
          method: 'GET',
          headers: { Accept: 'text/plain, text/csv, */*' },
        },
        timeoutMs,
        signal
      );

      if (!res.ok) {
        lastError = new Error(
          `Free VPN server directory unavailable (HTTP ${res.status}).`
        );
        continue;
      }

      const servers = parseVpnGateCsv(res.text);
      if (servers.length === 0) {
        lastError = new Error('No live OpenVPN relays returned right now.');
        continue;
      }

      return servers;
    } catch (err) {
      if (signal?.aborted) {
        throw err instanceof Error
          ? err
          : new Error('Cancelled loading free VPN servers.');
      }
      lastError =
        err instanceof Error
          ? err
          : new Error('Unable to reach free VPN server list.');
    }
  }

  throw (
    lastError ?? new Error('Unable to load free VPN servers. Tap Retry.')
  );
}

