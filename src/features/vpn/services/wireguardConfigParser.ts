import { VpnDnsPreset, WireGuardProfileConfig } from '../types';

export type WireGuardParseResult =
  | {
      ok: true;
      config: WireGuardProfileConfig;
      suggestedName: string;
    }
  | {
      ok: false;
      errorMessage: string;
    };

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function isValidWireGuardKey(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length !== 44 || !trimmed.endsWith('=')) {
    return false;
  }
  for (let i = 0; i < 43; i += 1) {
    if (!BASE64_CHARS.includes(trimmed[i])) {
      return false;
    }
  }
  // 42 base64 chars = 252 bits, 43rd char contributes upper 4 bits -> lower 2 bits must be 0
  const idx43 = BASE64_CHARS.indexOf(trimmed[42]);
  return idx43 >= 0 && idx43 % 4 === 0;
}

function stripConfigComment(line: string): string {
  const hashIdx = line.indexOf('#');
  const semiIdx = line.indexOf(';');
  let cutIndex = -1;
  if (hashIdx >= 0 && semiIdx >= 0) {
    cutIndex = Math.min(hashIdx, semiIdx);
  } else {
    cutIndex = Math.max(hashIdx, semiIdx);
  }
  return (cutIndex >= 0 ? line.slice(0, cutIndex) : line).trim();
}

function splitCommaList(raw: string): string[] {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeInterfaceAddress(rawAddress: string): string {
  if (rawAddress.includes('/')) {
    return rawAddress;
  }
  return rawAddress.includes(':') ? `${rawAddress}/128` : `${rawAddress}/32`;
}

function normalizeAllowedIp(rawIp: string): string {
  if (rawIp === '::0/0') {
    return '::/0';
  }
  if (rawIp.includes('/')) {
    return rawIp;
  }
  return rawIp.includes(':') ? `${rawIp}/128` : `${rawIp}/32`;
}

function parseEndpoint(
  rawEndpoint: string
): { serverAddress: string; serverPort: number } | null {
  const trimmed = rawEndpoint.trim();
  if (!trimmed) {
    return null;
  }

  let serverAddress = '';
  let portText = '';

  if (trimmed.startsWith('[')) {
    const closeBracket = trimmed.indexOf(']');
    if (closeBracket <= 1 || trimmed[closeBracket + 1] !== ':') {
      return null;
    }
    serverAddress = trimmed.slice(1, closeBracket).trim();
    portText = trimmed.slice(closeBracket + 2).trim();
  } else {
    const lastColon = trimmed.lastIndexOf(':');
    if (lastColon <= 0) {
      return null;
    }
    serverAddress = trimmed.slice(0, lastColon).trim();
    portText = trimmed.slice(lastColon + 1).trim();
  }

  const serverPort = Number.parseInt(portText, 10);
  if (
    !serverAddress ||
    !/^\d+$/.test(portText) ||
    serverPort < 1 ||
    serverPort > 65535
  ) {
    return null;
  }

  return { serverAddress, serverPort };
}

/**
 * Parses a standard WireGuard `.conf` INI file (`[Interface]` and `[Peer]` sections).
 */
export function parseWireGuardConfig(
  rawText: string,
  fallbackName?: string
): WireGuardParseResult {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  let activeSection: 'interface' | 'peer' | null = null;

  let privateKey = '';
  const addresses: string[] = [];
  const dns: string[] = [];
  let mtu: number | undefined;

  let publicKey = '';
  let presharedKey: string | undefined;
  let endpointRaw = '';
  const allowedIPs: string[] = [];
  let persistentKeepalive: number | undefined;

  for (const rawLine of lines) {
    const cleaned = stripConfigComment(rawLine);
    if (!cleaned) {
      continue;
    }

    if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
      const section = cleaned.slice(1, -1).trim().toLowerCase();
      if (section === 'interface') {
        activeSection = 'interface';
      } else if (section === 'peer') {
        activeSection = 'peer';
      } else {
        activeSection = null;
      }
      continue;
    }

    const eqIndex = cleaned.indexOf('=');
    if (eqIndex <= 0 || !activeSection) {
      continue;
    }

    const key = cleaned.slice(0, eqIndex).trim().toLowerCase();
    const val = cleaned.slice(eqIndex + 1).trim();

    if (activeSection === 'interface') {
      if (key === 'privatekey') {
        privateKey = val;
      } else if (key === 'address') {
        for (const item of splitCommaList(val)) {
          addresses.push(normalizeInterfaceAddress(item));
        }
      } else if (key === 'dns') {
        for (const item of splitCommaList(val)) {
          dns.push(item);
        }
      } else if (key === 'mtu') {
        const parsedMtu = Number.parseInt(val, 10);
        if (Number.isFinite(parsedMtu) && parsedMtu >= 1280 && parsedMtu <= 65535) {
          mtu = parsedMtu;
        }
      }
      continue;
    }

    if (activeSection === 'peer') {
      if (key === 'publickey') {
        publicKey = val;
      } else if (key === 'presharedkey') {
        if (val) {
          presharedKey = val;
        }
      } else if (key === 'endpoint') {
        endpointRaw = val;
      } else if (key === 'allowedips') {
        for (const item of splitCommaList(val)) {
          allowedIPs.push(normalizeAllowedIp(item));
        }
      } else if (key === 'persistentkeepalive') {
        const parsedKeepalive = Number.parseInt(val, 10);
        if (Number.isFinite(parsedKeepalive) && parsedKeepalive > 0) {
          persistentKeepalive = parsedKeepalive;
        }
      }
    }
  }

  if (!isValidWireGuardKey(privateKey)) {
    return {
      ok: false,
      errorMessage:
        'Missing or invalid [Interface] PrivateKey (expected 44-character WireGuard base64 key).',
    };
  }

  if (!isValidWireGuardKey(publicKey)) {
    return {
      ok: false,
      errorMessage:
        'Missing or invalid [Peer] PublicKey (expected 44-character WireGuard base64 key).',
    };
  }

  if (presharedKey && !isValidWireGuardKey(presharedKey)) {
    return {
      ok: false,
      errorMessage:
        'Invalid [Peer] PresharedKey format (expected 44-character WireGuard base64 key).',
    };
  }

  const endpoint = parseEndpoint(endpointRaw);
  if (!endpoint) {
    return {
      ok: false,
      errorMessage:
        'Missing or invalid [Peer] Endpoint (expected host:port, e.g. vpn.example.com:51820).',
    };
  }

  const filteredAddresses = addresses.filter(
    (addr) => addr !== '0.0.0.0/0' && addr !== '::/0'
  );
  const safeAddresses =
    filteredAddresses.length > 0 ? filteredAddresses : ['10.64.0.2/32'];
  const safeAllowedIPs =
    allowedIPs.length > 0 ? allowedIPs : ['0.0.0.0/0', '::/0'];
  const safeDns = dns.length > 0 ? dns : ['1.1.1.1', '1.0.0.1'];

  const cleanFallback = fallbackName?.trim();
  const suggestedName = cleanFallback || `WireGuard (${endpoint.serverAddress})`;

  return {
    ok: true,
    suggestedName,
    config: {
      privateKey,
      publicKey,
      serverAddress: endpoint.serverAddress,
      serverPort: endpoint.serverPort,
      addresses: safeAddresses,
      allowedIPs: safeAllowedIPs,
      dns: safeDns,
      mtu,
      presharedKey,
      persistentKeepalive,
    },
  };
}

/**
 * Serializes a structured WireGuard configuration back into standard `.conf` format.
 */
export function formatWireGuardConfig(config: WireGuardProfileConfig): string {
  const interfaceLines = [
    '[Interface]',
    `PrivateKey = ${config.privateKey}`,
    `Address = ${config.addresses.join(', ')}`,
    `DNS = ${config.dns.join(', ')}`,
  ];
  if (config.mtu) {
    interfaceLines.push(`MTU = ${config.mtu}`);
  }

  const peerLines = [
    '',
    '[Peer]',
    `PublicKey = ${config.publicKey}`,
  ];
  if (config.presharedKey) {
    peerLines.push(`PresharedKey = ${config.presharedKey}`);
  }
  peerLines.push(`AllowedIPs = ${config.allowedIPs.join(', ')}`);
  peerLines.push(`Endpoint = ${config.serverAddress}:${config.serverPort}`);
  if (config.persistentKeepalive) {
    peerLines.push(`PersistentKeepalive = ${config.persistentKeepalive}`);
  }

  return [...interfaceLines, ...peerLines].join('\n');
}

export function resolveDnsServers(
  preset: VpnDnsPreset,
  fallbackDns: string[]
): string[] {
  switch (preset) {
    case 'cloudflare':
      return ['1.1.1.1', '1.0.0.1'];
    case 'quad9':
      return ['9.9.9.9', '149.112.112.112'];
    case 'adguard':
      return ['94.140.14.14', '94.140.15.15'];
    case 'default':
    default:
      return fallbackDns.length > 0 ? fallbackDns : ['1.1.1.1'];
  }
}

