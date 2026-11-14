export type VpnStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

export type VpnProtocol = 'OpenVPN' | 'WireGuard';

export type VpnDnsPreset = 'default' | 'cloudflare' | 'quad9' | 'adguard';

export type VpnServerSource = 'vpngate' | 'imported' | 'remote';

export type WireGuardProfileConfig = {
  privateKey: string;
  publicKey: string;
  serverAddress: string;
  serverPort: number;
  addresses: string[];
  allowedIPs: string[];
  dns: string[];
  mtu?: number;
  presharedKey?: string;
  persistentKeepalive?: number;
};

export type VpnServer = {
  id: string;
  name: string;
  country: string;
  city: string;
  code: string;
  protocol: VpnProtocol;
  latencyMs: number | null;
  speedMbps?: number | null;
  loadPercent: number | null;
  endpointHost: string;
  source: VpnServerSource;
  wireguardConfig?: WireGuardProfileConfig;
  ovpnConfig?: string;
  ovpnUsername?: string;
  ovpnPassword?: string;
  provisionPath?: string;
};

export type PublicIpInfo = {
  ip: string;
  country?: string;
  city?: string;
  isp?: string;
  rttMs: number;
  fetchedAt: number;
};

export type VpnRuntimeSupport = {
  isAvailable: boolean;
  wireguardAvailable: boolean;
  openvpnAvailable: boolean;
  platform: string;
  reason: string | null;
};

export type NativeVpnStateEvent = {
  protocol?: VpnProtocol;
  isConnected: boolean;
  tunnelState:
    | 'ACTIVE'
    | 'INACTIVE'
    | 'CONNECTING'
    | 'DISCONNECTING'
    | 'ERROR'
    | 'UNKNOWN';
  status:
    | 'CONNECTED'
    | 'DISCONNECTED'
    | 'CONNECTING'
    | 'DISCONNECTING'
    | 'ERROR'
    | 'UNKNOWN';
  error?: string;
};
