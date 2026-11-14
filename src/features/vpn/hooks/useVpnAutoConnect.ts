import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Network from 'expo-network';
import { logError } from '@/lib/logger';
import { useVpnStore } from '../store';

/**
 * Automatically connects the configured WireGuard tunnel when the device connects
 * to Wi-Fi and `isAutoConnectEnabled` is turned on.
 */
export function useVpnAutoConnect(): void {
  const isAutoConnectEnabled = useVpnStore((s) => s.isAutoConnectEnabled);
  const wasWifiConnectedRef = useRef(false);

  useEffect(() => {
    if (!isAutoConnectEnabled || Platform.OS === 'web') {
      wasWifiConnectedRef.current = false;
      return;
    }

    const maybeAutoConnect = (state: Network.NetworkState) => {
      const isWifiOnline =
        state.type === Network.NetworkStateType.WIFI &&
        Boolean(state.isConnected) &&
        state.isInternetReachable !== false;

      if (!isWifiOnline) {
        wasWifiConnectedRef.current = false;
        return;
      }

      if (wasWifiConnectedRef.current) {
        return;
      }
      wasWifiConnectedRef.current = true;

      const store = useVpnStore.getState();
      const activeServer = store.servers.find(
        (srv) => srv.id === store.selectedServerId
      );
      if (
        store.status === 'disconnected' &&
        store.runtimeSupport.isAvailable &&
        Boolean(activeServer?.wireguardConfig || activeServer?.ovpnConfig)
      ) {
        store.connectSelectedServer().catch((err) => logError('vpn-autoconnect', err));
      }
    };

    Network.getNetworkStateAsync()
      .then(maybeAutoConnect)
      .catch((err) => logError('vpn-network-check', err));

    const subscription = Network.addNetworkStateListener(maybeAutoConnect);
    return () => {
      subscription.remove();
    };
  }, [isAutoConnectEnabled]);
}

