import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BackgroundBlobs } from '@/components/BackgroundBlobs';
import { useSettingsStore } from '@/features/settings/store';
import { triggerHaptic } from '@/lib/haptics';
import { colors, glassBevelStyle, radius, spacing, typography } from '@/theme';
import { useVpnStore } from '../store';
import { ImportWireGuardSheet } from './ImportWireGuardSheet';
import { VpnConnectionHero } from './VpnConnectionHero';
import { VpnOptionsSheet } from './VpnOptionsSheet';
import { VpnServerListCard } from './VpnServerListCard';

export function VpnScreen() {
  const insets = useSafeAreaInsets();
  const vpnApiUrl = useSettingsStore((s) => s.vpnApiUrl);
  const setVpnApiUrl = useSettingsStore((s) => s.setVpnApiUrl);

  const status = useVpnStore((s) => s.status);
  const connectedAt = useVpnStore((s) => s.connectedAt);
  const errorMessage = useVpnStore((s) => s.errorMessage);
  const servers = useVpnStore((s) => s.servers);
  const selectedServerId = useVpnStore((s) => s.selectedServerId);
  const dnsPreset = useVpnStore((s) => s.dnsPreset);
  const isIpv4Only = useVpnStore((s) => s.isIpv4Only);
  const isAutoConnectEnabled = useVpnStore((s) => s.isAutoConnectEnabled);
  const excludedApps = useVpnStore((s) => s.excludedApps);
  const publicIpInfo = useVpnStore((s) => s.publicIpInfo);
  const isCheckingIp = useVpnStore((s) => s.isCheckingIp);
  const isLoadingFreeServers = useVpnStore((s) => s.isLoadingFreeServers);
  const freeServersError = useVpnStore((s) => s.freeServersError);
  const isSyncingServers = useVpnStore((s) => s.isSyncingServers);
  const runtimeSupport = useVpnStore((s) => s.runtimeSupport);

  const toggleConnection = useVpnStore((s) => s.toggleConnection);
  const connectSelectedServer = useVpnStore((s) => s.connectSelectedServer);
  const refreshPublicIp = useVpnStore((s) => s.refreshPublicIp);
  const refreshFreeServers = useVpnStore((s) => s.refreshFreeServers);
  const syncRemoteServers = useVpnStore((s) => s.syncRemoteServers);
  const importWireGuardProfile = useVpnStore((s) => s.importWireGuardProfile);
  const removeImportedServer = useVpnStore((s) => s.removeImportedServer);
  const selectServer = useVpnStore((s) => s.selectServer);
  const setDnsPreset = useVpnStore((s) => s.setDnsPreset);
  const setIpv4Only = useVpnStore((s) => s.setIpv4Only);
  const setAutoConnectEnabled = useVpnStore((s) => s.setAutoConnectEnabled);
  const addExcludedApp = useVpnStore((s) => s.addExcludedApp);
  const removeExcludedApp = useVpnStore((s) => s.removeExcludedApp);
  const clearError = useVpnStore((s) => s.clearError);

  const [isServerListOpen, setIsServerListOpen] = useState(false);
  const [isImportSheetOpen, setIsImportSheetOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);

  const activeServer = useMemo(
    () => servers.find((s) => s.id === selectedServerId) ?? servers[0] ?? null,
    [selectedServerId, servers]
  );

  const isConnected = status === 'connected';

  const handleToggle = async () => {
    triggerHaptic(isConnected ? 'light' : 'medium');
    await toggleConnection();
  };

  const handleSelectAndConnect = async (serverId: string) => {
    setIsServerListOpen(false);
    await selectServer(serverId, true);
  };

  const handleFastestConnect = async () => {
    triggerHaptic('selection');
    setIsServerListOpen(false);

    if (servers.length === 0) {
      await connectSelectedServer();
      return;
    }

    const best = servers.reduce((prev, curr) => {
      const prevPing = prev.latencyMs ?? Number.MAX_SAFE_INTEGER;
      const currPing = curr.latencyMs ?? Number.MAX_SAFE_INTEGER;
      if (currPing !== prevPing) {
        return currPing < prevPing ? curr : prev;
      }
      return (curr.speedMbps ?? 0) > (prev.speedMbps ?? 0) ? curr : prev;
    });
    await selectServer(best.id, true);
  };

  const handleRefreshAllServers = async () => {
    await refreshFreeServers();
    if (vpnApiUrl) {
      await syncRemoteServers();
    }
  };

  const handleImportProfile = (rawConf: string, customName?: string) => {
    const res = importWireGuardProfile(rawConf, customName);
    if (res.ok && runtimeSupport.isAvailable) {
      connectSelectedServer().catch(() => undefined);
    }
    return res;
  };

  const handleSyncApi = async (apiUrl: string) => {
    setVpnApiUrl(apiUrl);
    const res = await syncRemoteServers(apiUrl);
    if (res.ok && runtimeSupport.isAvailable) {
      connectSelectedServer().catch(() => undefined);
    }
    return res;
  };

  return (
    <BackgroundBlobs>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: insets.bottom + spacing.tabBarHeight + spacing.xxl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View
            style={[
              styles.securityPill,
              isConnected && styles.securityPillActive,
            ]}
          >
            <Ionicons
              name={isConnected ? 'lock-closed' : 'lock-open-outline'}
              size={13}
              color={isConnected ? colors.success : colors.textSecondary}
            />
            <Text
              style={[
                styles.securityPillText,
                isConnected && styles.securityPillTextActive,
              ]}
            >
              {isConnected ? 'Encrypted' : 'Standby'}
            </Text>
          </View>

          <Text style={styles.screenTitle}>Rapidex VPN</Text>

          <View style={styles.headerActions}>
            <Pressable
              onPress={handleFastestConnect}
              accessibilityRole="button"
              accessibilityLabel="Connect to fastest server"
              style={styles.fastestBtn}
            >
              <Ionicons name="speedometer-outline" size={14} color={colors.accent} />
              <Text style={styles.fastestBtnText}>Fastest</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                triggerHaptic('selection');
                setIsOptionsOpen(true);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Open VPN options"
              style={styles.optionsBtn}
            >
              <Ionicons name="options-outline" size={18} color={colors.textPrimary} />
            </Pressable>
          </View>
        </View>

        <VpnConnectionHero
          status={status}
          connectedAt={connectedAt}
          activeServer={activeServer}
          errorMessage={errorMessage}
          publicIpInfo={publicIpInfo}
          isCheckingIp={isCheckingIp}
          onToggle={handleToggle}
          onRefreshIp={() => {
            triggerHaptic('selection');
            refreshPublicIp();
          }}
          onClearError={clearError}
        />

        <VpnServerListCard
          servers={servers}
          activeServer={activeServer}
          isExpanded={isServerListOpen}
          isLoadingServers={isLoadingFreeServers || isSyncingServers}
          serverError={freeServersError}
          onToggleExpand={() => setIsServerListOpen((prev) => !prev)}
          onSelectAndConnect={handleSelectAndConnect}
          onRemoveServer={removeImportedServer}
          onOpenAddServer={() => setIsImportSheetOpen(true)}
          onRefreshServers={() => {
            handleRefreshAllServers().catch(() => undefined);
          }}
        />
      </ScrollView>

      <ImportWireGuardSheet
        isVisible={isImportSheetOpen}
        initialApiUrl={vpnApiUrl}
        onClose={() => setIsImportSheetOpen(false)}
        onImportProfile={handleImportProfile}
        onSyncApi={handleSyncApi}
      />

      <VpnOptionsSheet
        isVisible={isOptionsOpen}
        onClose={() => setIsOptionsOpen(false)}
        dnsPreset={dnsPreset}
        isIpv4Only={isIpv4Only}
        isAutoConnectEnabled={isAutoConnectEnabled}
        excludedApps={excludedApps}
        onChangeDns={setDnsPreset}
        onToggleIpv4Only={setIpv4Only}
        onToggleAutoConnect={setAutoConnectEnabled}
        onAddExcludedApp={addExcludedApp}
        onRemoveExcludedApp={removeExcludedApp}
        onOpenAddServer={() => setIsImportSheetOpen(true)}
      />
    </BackgroundBlobs>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  securityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.glassBackgroundStrong,
    ...glassBevelStyle,
  },
  securityPillActive: {
    backgroundColor: colors.successSurface,
    borderColor: colors.success,
  },
  securityPillText: { ...typography.small, color: colors.textSecondary },
  securityPillTextActive: { color: colors.success },
  screenTitle: { ...typography.title, color: colors.textPrimary },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  fastestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSurface,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  fastestBtnText: { ...typography.small, color: colors.accent },
  optionsBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.glassBackgroundStrong,
    ...glassBevelStyle,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
