import { create } from 'zustand';
import { useSettingsStore } from '@/features/settings/store';
import { logError } from '@/lib/logger';
import { kvStorage } from '@/lib/storage';
import {
  fetchFreeVpnGateServers,
  fetchPublicIpInfo,
  fetchRemoteVpnServers,
  provisionRemoteServerConfig,
} from './services/vpnApiService';
import {
  connectVpnTunnel,
  disconnectActiveVpnTunnel,
  getVpnRuntimeSupport,
  queryNativeVpnStatus,
  subscribeToNativeVpnState,
} from './services/vpnTunnelService';
import {
  parseWireGuardConfig,
  resolveDnsServers,
} from './services/wireguardConfigParser';
import {
  NativeVpnStateEvent,
  PublicIpInfo,
  VpnDnsPreset,
  VpnProtocol,
  VpnRuntimeSupport,
  VpnServer,
  VpnStatus,
} from './types';

const KEYS = {
  SERVER_ID: 'vpn.serverId',
  IMPORTED_SERVERS: 'vpn.importedServers',
  FREE_SERVERS_CACHE: 'vpn.freeServersCache',
  DNS_PRESET: 'vpn.dnsPreset',
  IPV4_ONLY: 'vpn.ipv4Only',
  AUTO_CONNECT: 'vpn.autoConnect',
  EXCLUDED_APPS: 'vpn.excludedApps',
} as const;

let nativeUnsubscribe: (() => void) | null = null;
let ipRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let freeServersFetchPromise: Promise<{
  ok: boolean;
  count: number;
  errorMessage?: string;
}> | null = null;

function readJsonList<T>(key: string): T[] {
  const raw = kvStorage.getString(key);
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function loadImportedServers(): VpnServer[] {
  return readJsonList<VpnServer>(KEYS.IMPORTED_SERVERS)
    .filter(
      (s) =>
        typeof s?.id === 'string' &&
        s.source === 'imported' &&
        Boolean(s.wireguardConfig?.privateKey && s.wireguardConfig?.publicKey)
    )
    .map((s) => ({
      ...s,
      protocol: s.protocol ?? 'WireGuard',
    }));
}

function saveImportedServers(servers: VpnServer[]): void {
  const onlyImported = servers.filter((s) => s.source === 'imported');
  kvStorage.set(KEYS.IMPORTED_SERVERS, JSON.stringify(onlyImported));
}

function loadCachedFreeServers(): VpnServer[] {
  return readJsonList<VpnServer>(KEYS.FREE_SERVERS_CACHE).filter(
    (s) =>
      typeof s?.id === 'string' &&
      s.source === 'vpngate' &&
      typeof s.ovpnConfig === 'string' &&
      s.ovpnConfig.length > 0
  );
}

function saveCachedFreeServers(servers: VpnServer[]): void {
  const onlyFree = servers.filter((s) => s.source === 'vpngate');
  kvStorage.set(KEYS.FREE_SERVERS_CACHE, JSON.stringify(onlyFree));
}

function composeServerList(
  imported: VpnServer[],
  remote: VpnServer[],
  free: VpnServer[]
): VpnServer[] {
  return [...imported, ...remote, ...free];
}

function readDnsPreset(): VpnDnsPreset {
  const raw = kvStorage.getString(KEYS.DNS_PRESET);
  if (
    raw === 'default' ||
    raw === 'cloudflare' ||
    raw === 'quad9' ||
    raw === 'adguard'
  ) {
    return raw;
  }
  return 'cloudflare';
}

function pickInitialSelectedId(
  savedId: string | undefined,
  servers: VpnServer[]
): string {
  if (servers.length === 0) {
    return '';
  }
  if (savedId && servers.some((s) => s.id === savedId)) {
    return savedId;
  }
  return servers[0].id;
}

function mapNativeStatusToVpnStatus(
  event: Pick<NativeVpnStateEvent, 'isConnected' | 'status'>
): VpnStatus {
  if (event.isConnected || event.status === 'CONNECTED') {
    return 'connected';
  }
  if (event.status === 'CONNECTING') {
    return 'connecting';
  }
  if (event.status === 'DISCONNECTING') {
    return 'disconnecting';
  }
  if (event.status === 'ERROR') {
    return 'error';
  }
  return 'disconnected';
}

function schedulePublicIpRefresh(refreshFn: () => Promise<void>, delayMs: number): void {
  if (ipRefreshTimer) {
    clearTimeout(ipRefreshTimer);
  }
  ipRefreshTimer = setTimeout(() => {
    ipRefreshTimer = null;
    refreshFn().catch(() => undefined);
  }, delayMs);
}

export type ConnectOutcome =
  | { ok: true }
  | {
      ok: false;
      reason: 'missing_config' | 'unavailable_runtime' | 'error';
      message: string;
    };

type VpnState = {
  status: VpnStatus;
  connectedAt: number | null;
  activeProtocol: VpnProtocol | null;
  errorMessage: string | null;
  servers: VpnServer[];
  selectedServerId: string;
  dnsPreset: VpnDnsPreset;
  isIpv4Only: boolean;
  isAutoConnectEnabled: boolean;
  excludedApps: string[];
  publicIpInfo: PublicIpInfo | null;
  isCheckingIp: boolean;
  isLoadingFreeServers: boolean;
  freeServersError: string | null;
  isSyncingServers: boolean;
  runtimeSupport: VpnRuntimeSupport;
  isHydrated: boolean;

  hydrateVpn: () => Promise<void>;
  refreshPublicIp: () => Promise<void>;
  refreshFreeServers: () => Promise<{ ok: boolean; count: number; errorMessage?: string }>;
  syncRemoteServers: (
    apiUrlOverride?: string
  ) => Promise<{ ok: boolean; count: number; errorMessage?: string }>;
  importWireGuardProfile: (
    rawConf: string,
    customName?: string
  ) => { ok: boolean; serverId?: string; errorMessage?: string };
  removeImportedServer: (serverId: string) => Promise<void>;
  selectServer: (
    serverId: string,
    connectImmediately?: boolean
  ) => Promise<ConnectOutcome | undefined>;
  connectSelectedServer: () => Promise<ConnectOutcome>;
  disconnectVpn: () => Promise<void>;
  toggleConnection: () => Promise<ConnectOutcome | undefined>;
  setDnsPreset: (preset: VpnDnsPreset) => void;
  setIpv4Only: (enabled: boolean) => void;
  setAutoConnectEnabled: (enabled: boolean) => void;
  addExcludedApp: (packageName: string) => void;
  removeExcludedApp: (packageName: string) => void;
  clearError: () => void;
};

export const useVpnStore = create<VpnState>((set, get) => ({
  status: 'disconnected',
  connectedAt: null,
  activeProtocol: null,
  errorMessage: null,
  servers: [],
  selectedServerId: '',
  dnsPreset: 'cloudflare',
  isIpv4Only: false,
  isAutoConnectEnabled: false,
  excludedApps: [],
  publicIpInfo: null,
  isCheckingIp: false,
  isLoadingFreeServers: false,
  freeServersError: null,
  isSyncingServers: false,
  runtimeSupport: {
    isAvailable: false,
    wireguardAvailable: false,
    openvpnAvailable: false,
    platform: 'unknown',
    reason: null,
  },
  isHydrated: false,

  hydrateVpn: async () => {
    const imported = loadImportedServers();
    const cachedFree = loadCachedFreeServers();
    const initialServers = composeServerList(imported, [], cachedFree);
    const savedId = kvStorage.getString(KEYS.SERVER_ID);
    const dnsPreset = readDnsPreset();
    const isIpv4Only = kvStorage.getBoolean(KEYS.IPV4_ONLY) ?? false;
    const isAutoConnectEnabled = kvStorage.getBoolean(KEYS.AUTO_CONNECT) ?? false;
    const excludedApps = readJsonList<string>(KEYS.EXCLUDED_APPS).filter(
      (pkg) => typeof pkg === 'string' && pkg.trim().length > 0
    );

    const selectedServerId = pickInitialSelectedId(savedId, initialServers);

    set({
      servers: initialServers,
      selectedServerId,
      dnsPreset,
      isIpv4Only,
      isAutoConnectEnabled,
      excludedApps,
      isHydrated: true,
    });

    if (!nativeUnsubscribe) {
      nativeUnsubscribe = subscribeToNativeVpnState((event) => {
        let shouldRefreshIp = false;
        let nextStatusSnapshot: VpnStatus | null = null;

        set((state) => {
          if (
            state.activeProtocol &&
            event.protocol &&
            event.protocol !== state.activeProtocol &&
            !event.isConnected
          ) {
            return state;
          }

          const mapped = mapNativeStatusToVpnStatus(event);
          if (mapped === 'connected' && state.status !== 'connected') {
            shouldRefreshIp = true;
          } else if (mapped === 'disconnected' && state.status === 'connected') {
            nextStatusSnapshot = 'disconnected';
          }

          return {
            status: mapped,
            activeProtocol:
              mapped === 'disconnected'
                ? null
                : event.protocol ?? state.activeProtocol,
            connectedAt:
              mapped === 'connected'
                ? state.connectedAt ?? Date.now()
                : mapped === 'disconnected'
                  ? null
                  : state.connectedAt,
            errorMessage:
              mapped === 'connected'
                ? null
                : event.error ?? state.errorMessage,
          };
        });

        if (shouldRefreshIp) {
          schedulePublicIpRefresh(get().refreshPublicIp, 900);
        } else if (nextStatusSnapshot === 'disconnected') {
          schedulePublicIpRefresh(get().refreshPublicIp, 600);
        }
      });
    }

    const [runtimeSupport, nativeStatus] = await Promise.all([
      getVpnRuntimeSupport(),
      queryNativeVpnStatus(),
    ]);

    const nextStatus = nativeStatus
      ? mapNativeStatusToVpnStatus(nativeStatus)
      : 'disconnected';

    set({
      runtimeSupport,
      status: nextStatus,
      activeProtocol:
        nextStatus === 'disconnected' ? null : nativeStatus?.protocol ?? null,
      connectedAt: nextStatus === 'connected' ? Date.now() : null,
      errorMessage: nativeStatus?.error ?? null,
    });

    get().refreshPublicIp().catch(() => undefined);
    get().refreshFreeServers().catch(() => undefined);

    const vpnApiUrl = useSettingsStore.getState().vpnApiUrl;
    if (vpnApiUrl) {
      get().syncRemoteServers(vpnApiUrl).catch(() => undefined);
    }
  },

  refreshPublicIp: async () => {
    set({ isCheckingIp: true });
    try {
      const info = await fetchPublicIpInfo();
      set({ publicIpInfo: info, isCheckingIp: false });
    } catch (err) {
      logError('vpn-public-ip', err);
      set({ isCheckingIp: false });
    }
  },

  refreshFreeServers: async () => {
    if (freeServersFetchPromise) {
      return freeServersFetchPromise;
    }

    set({ isLoadingFreeServers: true, freeServersError: null });
    freeServersFetchPromise = (async () => {
      try {
        const freshFree = await fetchFreeVpnGateServers();
        saveCachedFreeServers(freshFree);

        const currentServers = get().servers;
        const imported = currentServers.filter((s) => s.source === 'imported');
        const remote = currentServers.filter((s) => s.source === 'remote');
        const nextServers = composeServerList(imported, remote, freshFree);
        const nextSelectedId = pickInitialSelectedId(
          get().selectedServerId,
          nextServers
        );

        if (nextSelectedId) {
          kvStorage.set(KEYS.SERVER_ID, nextSelectedId);
        }

        set({
          servers: nextServers,
          selectedServerId: nextSelectedId,
          isLoadingFreeServers: false,
          freeServersError: null,
        });
        return { ok: true, count: freshFree.length };
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to load free public VPN relays.';
        logError('vpn-free-servers', err);
        set({ isLoadingFreeServers: false, freeServersError: message });
        return { ok: false, count: 0, errorMessage: message };
      } finally {
        freeServersFetchPromise = null;
      }
    })();

    return freeServersFetchPromise;
  },

  syncRemoteServers: async (apiUrlOverride) => {
    const targetUrl = (
      apiUrlOverride ?? useSettingsStore.getState().vpnApiUrl
    ).trim();
    if (!targetUrl) {
      return {
        ok: false,
        count: 0,
        errorMessage: 'Enter a VPN Provisioning API URL first.',
      };
    }

    set({ isSyncingServers: true, errorMessage: null });
    try {
      const remote = await fetchRemoteVpnServers(targetUrl);
      const current = get().servers;
      const imported = current.filter((s) => s.source === 'imported');
      const free = current.filter((s) => s.source === 'vpngate');
      const nextServers = composeServerList(imported, remote, free);
      const nextSelectedId = pickInitialSelectedId(
        get().selectedServerId,
        nextServers
      );

      if (nextSelectedId) {
        kvStorage.set(KEYS.SERVER_ID, nextSelectedId);
      }
      set({
        servers: nextServers,
        selectedServerId: nextSelectedId,
        isSyncingServers: false,
      });
      return { ok: true, count: remote.length };
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to sync VPN servers.';
      set({ isSyncingServers: false, errorMessage: msg });
      return { ok: false, count: 0, errorMessage: msg };
    }
  },

  importWireGuardProfile: (rawConf, customName) => {
    const parsed = parseWireGuardConfig(rawConf, customName);
    if (!parsed.ok) {
      return { ok: false, errorMessage: parsed.errorMessage };
    }

    const host = parsed.config.serverAddress;
    const newServer: VpnServer = {
      id: `wg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: parsed.suggestedName,
      country: parsed.suggestedName,
      city: `${host}:${parsed.config.serverPort}`,
      code: 'WG',
      protocol: 'WireGuard',
      latencyMs: null,
      loadPercent: null,
      endpointHost: host,
      source: 'imported',
      wireguardConfig: parsed.config,
    };

    const current = get().servers;
    const existingImported = current.filter((s) => s.source === 'imported');
    const existingRemote = current.filter((s) => s.source === 'remote');
    const existingFree = current.filter((s) => s.source === 'vpngate');
    const updatedImported = [newServer, ...existingImported];
    saveImportedServers(updatedImported);

    const nextServers = composeServerList(
      updatedImported,
      existingRemote,
      existingFree
    );
    kvStorage.set(KEYS.SERVER_ID, newServer.id);

    set({
      servers: nextServers,
      selectedServerId: newServer.id,
      errorMessage: null,
    });

    return { ok: true, serverId: newServer.id };
  },

  removeImportedServer: async (serverId) => {
    const state = get();
    if (
      state.selectedServerId === serverId &&
      (state.status === 'connected' || state.status === 'connecting')
    ) {
      await get().disconnectVpn();
    }

    const current = get().servers;
    const updatedImported = current.filter(
      (s) => s.source === 'imported' && s.id !== serverId
    );
    const existingRemote = current.filter((s) => s.source === 'remote');
    const existingFree = current.filter((s) => s.source === 'vpngate');
    saveImportedServers(updatedImported);

    const nextServers = composeServerList(
      updatedImported,
      existingRemote,
      existingFree
    );
    const nextSelectedId = pickInitialSelectedId(
      get().selectedServerId === serverId ? undefined : get().selectedServerId,
      nextServers
    );
    kvStorage.set(KEYS.SERVER_ID, nextSelectedId);

    set({ servers: nextServers, selectedServerId: nextSelectedId });
  },

  selectServer: async (serverId, connectImmediately = true) => {
    const prevServerId = get().selectedServerId;
    const prevStatus = get().status;
    kvStorage.set(KEYS.SERVER_ID, serverId);
    set({ selectedServerId: serverId, errorMessage: null });

    if (!connectImmediately) {
      return undefined;
    }

    if (prevStatus === 'connected' || prevStatus === 'connecting') {
      if (prevServerId === serverId) {
        return { ok: true };
      }
      await get().disconnectVpn();
    }

    return get().connectSelectedServer();
  },

  connectSelectedServer: async () => {
    const state = get();
    if (state.status === 'connecting' || state.status === 'disconnecting') {
      return {
        ok: false,
        reason: 'error',
        message: 'VPN transition already in progress.',
      };
    }

    let activeServer =
      state.servers.find((s) => s.id === state.selectedServerId) ??
      state.servers[0];

    if (!activeServer) {
      const refreshed = await get().refreshFreeServers();
      if (refreshed.ok) {
        const latest = get();
        activeServer =
          latest.servers.find((s) => s.id === latest.selectedServerId) ??
          latest.servers[0];
      }
    }

    if (!activeServer) {
      const message =
        get().freeServersError ??
        'No free VPN relays loaded yet. Tap Retry or import a WireGuard .conf.';
      set({ status: 'disconnected', errorMessage: message });
      return { ok: false, reason: 'missing_config', message };
    }

    let resolvedServer: VpnServer = activeServer;
    const vpnApiUrl = useSettingsStore.getState().vpnApiUrl;

    if (
      resolvedServer.source === 'remote' &&
      !resolvedServer.wireguardConfig &&
      !resolvedServer.ovpnConfig &&
      vpnApiUrl
    ) {
      set({
        status: 'connecting',
        activeProtocol: resolvedServer.protocol,
        errorMessage: null,
      });
      try {
        const wgConfig = await provisionRemoteServerConfig(
          vpnApiUrl,
          resolvedServer
        );
        resolvedServer = {
          ...resolvedServer,
          protocol: 'WireGuard',
          wireguardConfig: wgConfig,
          endpointHost: wgConfig.serverAddress || resolvedServer.endpointHost,
        };
        set((prev) => ({
          servers: prev.servers.map((srv) =>
            srv.id === resolvedServer.id ? resolvedServer : srv
          ),
        }));
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to fetch WireGuard config from server API.';
        set({ status: 'error', activeProtocol: null, errorMessage: message });
        return { ok: false, reason: 'error', message };
      }
    }

    if (
      resolvedServer.protocol === 'WireGuard' &&
      !resolvedServer.wireguardConfig
    ) {
      const message = 'Add a WireGuard .conf file or pick a free OpenVPN relay.';
      set({ status: 'disconnected', activeProtocol: null, errorMessage: message });
      return { ok: false, reason: 'missing_config', message };
    }

    if (resolvedServer.protocol === 'OpenVPN' && !resolvedServer.ovpnConfig) {
      const message = 'Selected OpenVPN relay is missing tunnel config.';
      set({ status: 'disconnected', activeProtocol: null, errorMessage: message });
      return { ok: false, reason: 'missing_config', message };
    }

    let support = state.runtimeSupport;
    if (!support.isAvailable) {
      support = await getVpnRuntimeSupport();
      set({ runtimeSupport: support });
    }

    if (!support.isAvailable) {
      const message =
        support.reason ??
        'Real VPN tunnels require a Development Build (unsupported in Expo Go).';
      set({ status: 'disconnected', activeProtocol: null, errorMessage: message });
      return { ok: false, reason: 'unavailable_runtime', message };
    }

    if (resolvedServer.protocol === 'OpenVPN' && !support.openvpnAvailable) {
      const message =
        'OpenVPN native module is not present in this build. Rebuild the Development Build to connect free OpenVPN relays.';
      set({ status: 'disconnected', activeProtocol: null, errorMessage: message });
      return { ok: false, reason: 'unavailable_runtime', message };
    }

    if (
      resolvedServer.protocol === 'WireGuard' &&
      !support.wireguardAvailable
    ) {
      const message =
        'WireGuard native module is not present in this build. Rebuild the Development Build to connect WireGuard servers.';
      set({ status: 'disconnected', activeProtocol: null, errorMessage: message });
      return { ok: false, reason: 'unavailable_runtime', message };
    }

    set({
      status: 'connecting',
      activeProtocol: resolvedServer.protocol,
      errorMessage: null,
      connectedAt: null,
    });

    try {
      const dnsServers = resolveDnsServers(
        state.dnsPreset,
        resolvedServer.wireguardConfig?.dns ?? []
      );
      await connectVpnTunnel(resolvedServer, {
        dnsOverride: dnsServers,
        ipv4Only: state.isIpv4Only,
        excludedApps: state.excludedApps,
      });

      const live = await queryNativeVpnStatus();
      const mappedLive = live ? mapNativeStatusToVpnStatus(live) : null;

      if (mappedLive === 'connected') {
        set({
          status: 'connected',
          connectedAt: Date.now(),
          errorMessage: null,
        });
        schedulePublicIpRefresh(get().refreshPublicIp, 900);
      } else if (mappedLive === 'error') {
        const message =
          live?.error ?? `Failed to connect ${resolvedServer.protocol} tunnel.`;
        set({
          status: 'error',
          activeProtocol: null,
          connectedAt: null,
          errorMessage: message,
        });
        return { ok: false, reason: 'error', message };
      } else if (resolvedServer.protocol === 'WireGuard') {
        set({
          status: 'connected',
          connectedAt: Date.now(),
          errorMessage: null,
        });
        schedulePublicIpRefresh(get().refreshPublicIp, 900);
      } else {
        set({ status: 'connecting', errorMessage: null });
      }

      return { ok: true };
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : `Failed to connect ${resolvedServer.protocol} tunnel.`;
      set({
        status: 'error',
        activeProtocol: null,
        connectedAt: null,
        errorMessage: message,
      });
      return { ok: false, reason: 'error', message };
    }
  },

  disconnectVpn: async () => {
    const protocol = get().activeProtocol;
    set({ status: 'disconnecting', errorMessage: null });
    try {
      await disconnectActiveVpnTunnel(protocol);
      set({
        status: 'disconnected',
        activeProtocol: null,
        connectedAt: null,
        errorMessage: null,
      });
      schedulePublicIpRefresh(get().refreshPublicIp, 600);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to disconnect VPN.';
      set({ status: 'error', errorMessage: message });
    }
  },

  toggleConnection: async () => {
    const { status } = get();
    if (status === 'connected' || status === 'connecting') {
      await get().disconnectVpn();
      return undefined;
    }
    return get().connectSelectedServer();
  },

  setDnsPreset: (dnsPreset) => {
    kvStorage.set(KEYS.DNS_PRESET, dnsPreset);
    set({ dnsPreset });
  },

  setIpv4Only: (enabled) => {
    kvStorage.set(KEYS.IPV4_ONLY, enabled);
    set({ isIpv4Only: enabled });
  },

  setAutoConnectEnabled: (enabled) => {
    kvStorage.set(KEYS.AUTO_CONNECT, enabled);
    set({ isAutoConnectEnabled: enabled });
  },

  addExcludedApp: (packageName) => {
    const clean = packageName.trim();
    if (!clean) {
      return;
    }
    const existing = get().excludedApps;
    if (existing.includes(clean)) {
      return;
    }
    const updated = [...existing, clean];
    kvStorage.set(KEYS.EXCLUDED_APPS, JSON.stringify(updated));
    set({ excludedApps: updated });
  },

  removeExcludedApp: (packageName) => {
    const updated = get().excludedApps.filter((pkg) => pkg !== packageName);
    kvStorage.set(KEYS.EXCLUDED_APPS, JSON.stringify(updated));
    set({ excludedApps: updated });
  },

  clearError: () => set({ errorMessage: null }),
}));
