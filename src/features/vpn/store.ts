import { create } from 'zustand';
import { kvStorage } from '@/lib/storage';
import { VpnProtocol, VpnServer, VpnStatus } from './types';

const KEYS = {
  SERVER_ID: 'vpn.serverId',
  PROTOCOL: 'vpn.protocol',
  KILL_SWITCH: 'vpn.killSwitch',
  AUTO_CONNECT: 'vpn.autoConnect',
} as const;

export const VPN_SERVERS: VpnServer[] = [
  {
    id: 'sg-sin',
    country: 'Singapore',
    city: 'Marina Bay',
    code: 'SG',
    latencyMs: 32,
    loadPercent: 24,
    ipMask: '103.214.88.14',
  },
  {
    id: 'jp-tyo',
    country: 'Japan',
    city: 'Tokyo',
    code: 'JP',
    latencyMs: 58,
    loadPercent: 31,
    ipMask: '45.76.192.41',
  },
  {
    id: 'us-nyc',
    country: 'United States',
    city: 'New York',
    code: 'US',
    latencyMs: 118,
    loadPercent: 46,
    ipMask: '198.51.100.72',
  },
  {
    id: 'gb-lon',
    country: 'United Kingdom',
    city: 'London',
    code: 'GB',
    latencyMs: 104,
    loadPercent: 38,
    ipMask: '185.199.110.29',
  },
  {
    id: 'de-fra',
    country: 'Germany',
    city: 'Frankfurt',
    code: 'DE',
    latencyMs: 96,
    loadPercent: 29,
    ipMask: '89.163.224.53',
  },
  {
    id: 'nl-ams',
    country: 'Netherlands',
    city: 'Amsterdam',
    code: 'NL',
    latencyMs: 101,
    loadPercent: 22,
    ipMask: '145.220.41.90',
  },
];

let connectTimer: ReturnType<typeof setTimeout> | null = null;

type VpnState = {
  status: VpnStatus;
  connectedAt: number | null;
  selectedServerId: string;
  protocol: VpnProtocol;
  isKillSwitchEnabled: boolean;
  isAutoConnectEnabled: boolean;
  isHydrated: boolean;

  hydrateVpn: () => void;
  toggleConnection: () => void;
  selectServer: (serverId: string) => void;
  setProtocol: (protocol: VpnProtocol) => void;
  setKillSwitchEnabled: (enabled: boolean) => void;
  setAutoConnectEnabled: (enabled: boolean) => void;
};

export const useVpnStore = create<VpnState>((set, get) => ({
  status: 'disconnected',
  connectedAt: null,
  selectedServerId: VPN_SERVERS[0].id,
  protocol: 'WireGuard',
  isKillSwitchEnabled: true,
  isAutoConnectEnabled: false,
  isHydrated: false,

  hydrateVpn: () => {
    if (get().isHydrated) return;
    const savedServer = kvStorage.getString(KEYS.SERVER_ID);
    const savedProtocol = kvStorage.getString(KEYS.PROTOCOL);
    const killSwitch = kvStorage.getBoolean(KEYS.KILL_SWITCH);
    const autoConnect = kvStorage.getBoolean(KEYS.AUTO_CONNECT);

    const validServer = VPN_SERVERS.some((s) => s.id === savedServer)
      ? savedServer!
      : VPN_SERVERS[0].id;
    const validProtocol: VpnProtocol =
      savedProtocol === 'IKEv2' ? 'IKEv2' : 'WireGuard';

    set({
      selectedServerId: validServer,
      protocol: validProtocol,
      isKillSwitchEnabled: killSwitch ?? true,
      isAutoConnectEnabled: autoConnect ?? false,
      isHydrated: true,
    });
  },

  toggleConnection: () => {
    const { status } = get();
    if (connectTimer) {
      clearTimeout(connectTimer);
      connectTimer = null;
    }

    if (status === 'connected' || status === 'connecting') {
      set({ status: 'disconnected', connectedAt: null });
      return;
    }

    set({ status: 'connecting', connectedAt: null });
    connectTimer = setTimeout(() => {
      connectTimer = null;
      set({ status: 'connected', connectedAt: Date.now() });
    }, 650);
  },

  selectServer: (serverId) => {
    kvStorage.set(KEYS.SERVER_ID, serverId);
    const { status } = get();
    if (status === 'connected') {
      if (connectTimer) clearTimeout(connectTimer);
      set({ selectedServerId: serverId, status: 'connecting', connectedAt: null });
      connectTimer = setTimeout(() => {
        connectTimer = null;
        set({ status: 'connected', connectedAt: Date.now() });
      }, 500);
      return;
    }
    set({ selectedServerId: serverId });
  },

  setProtocol: (protocol) => {
    kvStorage.set(KEYS.PROTOCOL, protocol);
    set({ protocol });
  },

  setKillSwitchEnabled: (enabled) => {
    kvStorage.set(KEYS.KILL_SWITCH, enabled);
    set({ isKillSwitchEnabled: enabled });
  },

  setAutoConnectEnabled: (enabled) => {
    kvStorage.set(KEYS.AUTO_CONNECT, enabled);
    set({ isAutoConnectEnabled: enabled });
  },
}));
