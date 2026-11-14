import {
  AppState,
  NativeEventEmitter,
  NativeModules,
  Platform,
  TurboModuleRegistry,
} from 'react-native';
import type * as OpenVpnModuleTypes from '@aliakhgar1/react-native-openvpn';
import WireGuardVpn, {
  WireGuardConfig,
  WireGuardStatus,
} from 'react-native-wireguard-vpn-patched';
import { logError } from '@/lib/logger';
import {
  NativeVpnStateEvent,
  VpnProtocol,
  VpnRuntimeSupport,
  VpnServer,
  WireGuardProfileConfig,
} from '../types';

export type TunnelConnectOptions = {
  dnsOverride?: string[];
  ipv4Only?: boolean;
  excludedApps?: string[];
};

type OpenVpnConnectParams = Parameters<typeof OpenVpnModuleTypes.connect>[0];
type OpenVpnStateEventPayload = Parameters<
  Parameters<typeof OpenVpnModuleTypes.addOpenVPNStateChangeListener>[0]
>[0];

type OpenVpnPackage = {
  connect: (params: OpenVpnConnectParams) => Promise<string>;
  prepare: () => Promise<boolean>;
  isPrepared: () => Promise<boolean>;
  disconnect: () => Promise<string>;
  getCurrentState: () => ReturnType<typeof OpenVpnModuleTypes.getCurrentState>;
  AndroidCompatibilityMode: typeof OpenVpnModuleTypes.AndroidCompatibilityMode;
  addOpenVPNStateChangeListener: (
    callback: (state: OpenVpnStateEventPayload) => void
  ) => { remove: () => void };
};

let isWireGuardInitialized = false;

export function hasNativeWireGuardModule(): boolean {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return false;
  }
  return Boolean(NativeModules.WireGuardVpnModule);
}

/**
 * Checks whether the OpenVPN TurboModule is registered BEFORE requiring
 * `@aliakhgar1/react-native-openvpn`, because that package invokes
 * `TurboModuleRegistry.getEnforcing('Openvpn')` at module import time.
 */
export function hasNativeOpenVpnModule(): boolean {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return false;
  }
  try {
    return Boolean(TurboModuleRegistry.get('Openvpn') || NativeModules.Openvpn);
  } catch {
    return Boolean(NativeModules.Openvpn);
  }
}

function loadOpenVpnPackage(): OpenVpnPackage | null {
  if (!hasNativeOpenVpnModule()) {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@aliakhgar1/react-native-openvpn') as OpenVpnPackage;
}

/**
 * Verifies whether the current binary includes native OpenVPN and/or WireGuard
 * system tunnel capabilities. Expo Go and Web do not expose `VpnService` or `NEPacketTunnelProvider`.
 */
export async function getVpnRuntimeSupport(): Promise<VpnRuntimeSupport> {
  if (Platform.OS === 'web') {
    return {
      isAvailable: false,
      wireguardAvailable: false,
      openvpnAvailable: false,
      platform: 'web',
      reason:
        'System VPN routing requires a native Android or iOS Development Build (not available on web).',
    };
  }

  const openvpnAvailable = hasNativeOpenVpnModule();
  let wireguardAvailable = false;

  if (hasNativeWireGuardModule()) {
    try {
      wireguardAvailable = await WireGuardVpn.isSupported();
    } catch (err) {
      logError('vpn-is-supported', err);
      wireguardAvailable = false;
    }
  }

  const isAvailable = openvpnAvailable || wireguardAvailable;

  if (!isAvailable) {
    return {
      isAvailable: false,
      wireguardAvailable: false,
      openvpnAvailable: false,
      platform: Platform.OS,
      reason:
        'Expo Go does not include native VPN entitlements. Build a Development Build (`npx expo run:android` or `eas build --profile development`) to connect real VPN servers.',
    };
  }

  return {
    isAvailable: true,
    wireguardAvailable,
    openvpnAvailable,
    platform: Platform.OS,
    reason: null,
  };
}

function buildNativeWireGuardConfig(
  profile: WireGuardProfileConfig,
  options: TunnelConnectOptions
): WireGuardConfig {
  const rawAllowed = options.ipv4Only
    ? profile.allowedIPs.filter((cidr) => !cidr.includes(':'))
    : profile.allowedIPs;
  const allowedIPs = rawAllowed.length > 0 ? rawAllowed : ['0.0.0.0/0'];

  const dns =
    options.dnsOverride && options.dnsOverride.length > 0
      ? options.dnsOverride
      : profile.dns;

  const excludedApps =
    Platform.OS === 'android' && options.excludedApps?.length
      ? options.excludedApps
      : undefined;

  return {
    privateKey: profile.privateKey,
    publicKey: profile.publicKey,
    serverAddress: profile.serverAddress,
    serverPort: profile.serverPort,
    address:
      profile.addresses.length === 1 ? profile.addresses[0] : profile.addresses,
    allowedIPs,
    dns,
    mtu: profile.mtu ?? 1420,
    presharedKey: profile.presharedKey,
    excludedApps,
  };
}

function extractNativeError(error: unknown): { code: string; message: string } {
  if (typeof error === 'object' && error !== null) {
    const record = error as { code?: unknown; message?: unknown };
    const code = typeof record.code === 'string' ? record.code : '';
    const message =
      typeof record.message === 'string'
        ? record.message
        : 'Unknown native VPN error.';
    return { code, message };
  }
  return {
    code: '',
    message: error instanceof Error ? error.message : String(error),
  };
}

function waitForForegroundReturn(timeoutMs = 60000): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        sub.remove();
        resolve(false);
      }
    }, timeoutMs);

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && !settled) {
        settled = true;
        clearTimeout(timer);
        sub.remove();
        resolve(true);
      }
    });
  });
}

async function ensureWireGuardInitialized(): Promise<void> {
  if (isWireGuardInitialized) {
    return;
  }
  await WireGuardVpn.initialize();
  isWireGuardInitialized = true;
}

export async function connectWireGuardTunnel(
  profile: WireGuardProfileConfig,
  options: TunnelConnectOptions
): Promise<void> {
  if (!hasNativeWireGuardModule()) {
    throw new Error(
      'Native WireGuard module is unavailable in Expo Go. Run a Development Build or EAS Build to connect.'
    );
  }

  await ensureWireGuardInitialized();
  const wgConfig = buildNativeWireGuardConfig(profile, options);

  try {
    await WireGuardVpn.connect(wgConfig);
  } catch (err) {
    const parsed = extractNativeError(err);
    if (parsed.code !== 'VPN_PERMISSION_REQUIRED') {
      throw new Error(parsed.message);
    }

    const returnedToApp = await waitForForegroundReturn();
    if (!returnedToApp) {
      throw new Error('Timed out waiting for Android VPN permission.');
    }

    try {
      await WireGuardVpn.connect(wgConfig);
    } catch (retryErr) {
      const retryParsed = extractNativeError(retryErr);
      if (retryParsed.code === 'VPN_PERMISSION_REQUIRED') {
        throw new Error(
          'VPN permission is required to establish an encrypted tunnel.'
        );
      }
      throw new Error(retryParsed.message);
    }
  }
}

export async function connectOpenVpnTunnel(
  server: VpnServer,
  options: TunnelConnectOptions
): Promise<void> {
  const ovpn = loadOpenVpnPackage();
  if (!ovpn) {
    throw new Error(
      'Native OpenVPN module is unavailable in Expo Go. Build a Development Build (`npx expo run:android` or `eas build --profile development`) to connect.'
    );
  }

  if (!server.ovpnConfig?.trim()) {
    throw new Error('Selected OpenVPN server is missing profile data.');
  }

  if (Platform.OS === 'android') {
    const alreadyPrepared = await ovpn.isPrepared().catch(() => false);
    if (!alreadyPrepared) {
      const granted = await ovpn.prepare();
      if (!granted) {
        throw new Error(
          'VPN permission is required to establish an encrypted tunnel.'
        );
      }
    }
  }

  const dnsOverride = options.dnsOverride?.filter(Boolean) ?? [];

  await ovpn.connect({
    address: server.endpointHost,
    username: server.ovpnUsername || 'vpn',
    password: server.ovpnPassword || 'vpn',
    openVPNConfig: server.ovpnConfig,
    androidOptions: {
      Notification: {
        openActivityPackageName: 'com.rapidex.app.MainActivity',
        titleNotification: `Rapidex VPN · ${server.name}`,
        titleConnecting: `Connecting to ${server.name}...`,
        titleConnected: `Connected to ${server.name}`,
        titleDisconnecting: 'Disconnecting...',
        titleDisconnected: 'Disconnected',
        showDisconnectAction: true,
        titleDisconnectButton: 'Disconnect',
        showTimer: true,
      },
      compatibilityMode: ovpn.AndroidCompatibilityMode.OpenVPN_2_4_x,
      useLegacyProvider: true,
      overrideDNS: dnsOverride.length > 0,
      DNS1: dnsOverride[0],
      DNS2: dnsOverride[1],
      useDefaultRoute: true,
      useDefaultRouteV6: !options.ipv4Only,
      allowLocalLAN: true,
      allowedVPNApps:
        Platform.OS === 'android' && options.excludedApps?.length
          ? options.excludedApps
          : undefined,
      allowedVPNAppsAreDisallowed: true,
      connectRetryMax: '3',
      connectRetry: '2',
    },
    iOSOptions: {
      localizedDescription: 'Rapidex VPN',
      networkExtensionBundleIdentifier: 'com.rapidex.app.OpenVPNExtension',
      disconnectOnSleep: false,
      onDemandEnabled: false,
      forceCiphersuitesAESCBC: true,
      connectionTimeout: 25,
    },
  });
}

export async function connectVpnTunnel(
  server: VpnServer,
  options: TunnelConnectOptions
): Promise<void> {
  if (server.protocol === 'OpenVPN') {
    await connectOpenVpnTunnel(server, options);
    return;
  }

  if (!server.wireguardConfig) {
    throw new Error('Selected WireGuard server is missing peer configuration.');
  }
  await connectWireGuardTunnel(server.wireguardConfig, options);
}

export async function disconnectWireGuardTunnel(): Promise<void> {
  if (!hasNativeWireGuardModule()) {
    return;
  }
  try {
    await WireGuardVpn.disconnect();
  } catch (err) {
    const parsed = extractNativeError(err);
    if (parsed.message.toLowerCase().includes('not initialized')) {
      return;
    }
    throw new Error(parsed.message);
  }
}

export async function disconnectOpenVpnTunnel(): Promise<void> {
  const ovpn = loadOpenVpnPackage();
  if (!ovpn) {
    return;
  }
  try {
    await ovpn.disconnect();
  } catch (err) {
    const parsed = extractNativeError(err);
    if (
      parsed.message.toLowerCase().includes('not connected') ||
      parsed.message.toLowerCase().includes('not initialized')
    ) {
      return;
    }
    throw new Error(parsed.message);
  }
}

export async function disconnectActiveVpnTunnel(
  preferredProtocol?: VpnProtocol | null
): Promise<void> {
  if (preferredProtocol === 'OpenVPN') {
    await disconnectOpenVpnTunnel();
    return;
  }
  if (preferredProtocol === 'WireGuard') {
    await disconnectWireGuardTunnel();
    return;
  }
  await Promise.allSettled([
    disconnectOpenVpnTunnel(),
    disconnectWireGuardTunnel(),
  ]);
}

function mapOpenVpnStateCode(rawState: unknown): NativeVpnStateEvent {
  const code = String(rawState ?? '');
  if (code === '3') {
    return {
      protocol: 'OpenVPN',
      isConnected: true,
      tunnelState: 'ACTIVE',
      status: 'CONNECTED',
    };
  }
  if (code === '2') {
    return {
      protocol: 'OpenVPN',
      isConnected: false,
      tunnelState: 'CONNECTING',
      status: 'CONNECTING',
    };
  }
  if (code === '1') {
    return {
      protocol: 'OpenVPN',
      isConnected: false,
      tunnelState: 'DISCONNECTING',
      status: 'DISCONNECTING',
    };
  }
  if (code === '-1' || code === '-2') {
    return {
      protocol: 'OpenVPN',
      isConnected: false,
      tunnelState: 'ERROR',
      status: 'ERROR',
      error: 'OpenVPN tunnel failed to connect. Try another free relay.',
    };
  }
  return {
    protocol: 'OpenVPN',
    isConnected: false,
    tunnelState: 'INACTIVE',
    status: 'DISCONNECTED',
  };
}

export async function queryNativeVpnStatus(): Promise<NativeVpnStateEvent | null> {
  const ovpn = loadOpenVpnPackage();
  if (ovpn) {
    try {
      const ovpnState = await ovpn.getCurrentState();
      const mapped = mapOpenVpnStateCode(ovpnState);
      if (mapped.status !== 'DISCONNECTED') {
        return mapped;
      }
    } catch (err) {
      logError('vpn-openvpn-query-status', err);
    }
  }

  if (hasNativeWireGuardModule()) {
    try {
      const wgStatus: WireGuardStatus = await WireGuardVpn.getStatus();
      return {
        protocol: 'WireGuard',
        isConnected: Boolean(wgStatus.isConnected),
        tunnelState: wgStatus.tunnelState,
        status: wgStatus.status,
        error: wgStatus.error,
      };
    } catch (err) {
      logError('vpn-wireguard-query-status', err);
    }
  }

  return null;
}

export function subscribeToNativeVpnState(
  listener: (event: NativeVpnStateEvent) => void
): () => void {
  const cleanups: (() => void)[] = [];

  if (hasNativeWireGuardModule()) {
    const emitter = new NativeEventEmitter(
      NativeModules.WireGuardVpnModule as ConstructorParameters<
        typeof NativeEventEmitter
      >[0]
    );
    const sub = emitter.addListener('vpnStateChanged', (payload: unknown) => {
      if (typeof payload !== 'object' || payload === null) {
        return;
      }
      const raw = payload as Record<string, unknown>;
      if (typeof raw.status !== 'string' || typeof raw.tunnelState !== 'string') {
        return;
      }
      listener({
        protocol: 'WireGuard',
        isConnected: Boolean(raw.isConnected),
        tunnelState: raw.tunnelState as NativeVpnStateEvent['tunnelState'],
        status: raw.status as NativeVpnStateEvent['status'],
        error: typeof raw.error === 'string' ? raw.error : undefined,
      });
    });
    cleanups.push(() => sub.remove());
  }

  const ovpn = loadOpenVpnPackage();
  if (ovpn) {
    const sub = ovpn.addOpenVPNStateChangeListener((payload) => {
      listener(mapOpenVpnStateCode(payload?.state));
    });
    cleanups.push(() => sub.remove());
  }

  return () => {
    cleanups.forEach((fn) => fn());
  };
}
