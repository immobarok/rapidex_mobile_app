import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BackgroundBlobs } from '@/components/BackgroundBlobs';
import { GlassCard } from '@/components/GlassCard';
import { triggerHaptic } from '@/lib/haptics';
import { colors, radius, spacing, typography } from '@/theme';
import { useVpnStore, VPN_SERVERS } from '../store';
import { VpnProtocol, VpnServer, VpnStatus } from '../types';

function formatElapsed(startedAt: number | null, now: number): string {
  if (!startedAt) return '00:00:00';
  const totalSec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return [hrs, mins, secs].map((n) => String(n).padStart(2, '0')).join(':');
}

function getStatusLabel(status: VpnStatus): string {
  if (status === 'connected') return 'Protected & Encrypted';
  if (status === 'connecting') return 'Establishing Tunnel...';
  return 'Not Connected';
}

export function VpnScreen() {
  const status = useVpnStore((s) => s.status);
  const connectedAt = useVpnStore((s) => s.connectedAt);
  const selectedServerId = useVpnStore((s) => s.selectedServerId);
  const protocol = useVpnStore((s) => s.protocol);
  const isKillSwitchEnabled = useVpnStore((s) => s.isKillSwitchEnabled);
  const isAutoConnectEnabled = useVpnStore((s) => s.isAutoConnectEnabled);

  const toggleConnection = useVpnStore((s) => s.toggleConnection);
  const selectServer = useVpnStore((s) => s.selectServer);
  const setProtocol = useVpnStore((s) => s.setProtocol);
  const setKillSwitchEnabled = useVpnStore((s) => s.setKillSwitchEnabled);
  const setAutoConnectEnabled = useVpnStore((s) => s.setAutoConnectEnabled);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== 'connected') return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status]);

  const activeServer = useMemo(
    () => VPN_SERVERS.find((s) => s.id === selectedServerId) ?? VPN_SERVERS[0],
    [selectedServerId],
  );

  const handleToggle = () => {
    triggerHaptic(status === 'connected' ? 'light' : 'medium');
    toggleConnection();
  };

  const handleSelectServer = (server: VpnServer) => {
    triggerHaptic('selection');
    selectServer(server.id);
  };

  const handleSelectProtocol = (next: VpnProtocol) => {
    triggerHaptic('selection');
    setProtocol(next);
  };

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';

  return (
    <BackgroundBlobs>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Rapidex VPN</Text>
            <View
              style={[
                styles.statusBadge,
                isConnected && styles.statusBadgeConnected,
                isConnecting && styles.statusBadgeConnecting,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  isConnected && styles.statusDotConnected,
                  isConnecting && styles.statusDotConnecting,
                ]}
              />
              <Text
                style={[
                  styles.statusBadgeText,
                  isConnected && styles.statusBadgeTextConnected,
                ]}
              >
                {status === 'connected'
                  ? 'VPN Active'
                  : status === 'connecting'
                    ? 'Connecting'
                    : 'Standby'}
              </Text>
            </View>
          </View>

          <GlassCard enableBlur style={styles.heroCard}>
            <View style={styles.heroCenter}>
              <Pressable
                onPress={handleToggle}
                accessibilityRole="button"
                accessibilityLabel={
                  isConnected ? 'Disconnect VPN' : 'Connect VPN'
                }
                style={({ pressed }) => [
                  styles.powerRing,
                  isConnected && styles.powerRingConnected,
                  isConnecting && styles.powerRingConnecting,
                  pressed && styles.powerRingPressed,
                ]}
              >
                <View
                  style={[
                    styles.powerCore,
                    isConnected && styles.powerCoreConnected,
                  ]}
                >
                  <Ionicons
                    name={isConnected ? 'shield-checkmark' : 'power'}
                    size={38}
                    color={
                      isConnected ? colors.textOnAccent : colors.accent
                    }
                  />
                </View>
              </Pressable>

              <Text style={styles.heroStatusText}>{getStatusLabel(status)}</Text>
              <Text style={styles.heroSubText}>
                {isConnected
                  ? `${activeServer.country} • ${activeServer.ipMask} • ${formatElapsed(connectedAt, now)}`
                  : `Selected: ${activeServer.country} (${activeServer.city})`}
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Protocol</Text>
                <Text style={styles.statValue}>{protocol}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Latency</Text>
                <Text style={styles.statValue}>{activeServer.latencyMs} ms</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Load</Text>
                <Text style={styles.statValue}>{activeServer.loadPercent}%</Text>
              </View>
            </View>
          </GlassCard>

          <GlassCard style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Tunnel Protocol</Text>
            <View style={styles.protocolRow}>
              {(['WireGuard', 'IKEv2'] as const).map((item) => {
                const isSelected = protocol === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => handleSelectProtocol(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${item} protocol`}
                    style={[
                      styles.protocolChip,
                      isSelected && styles.protocolChipActive,
                    ]}
                  >
                    <Ionicons
                      name={item === 'WireGuard' ? 'flash-outline' : 'lock-closed-outline'}
                      size={16}
                      color={isSelected ? colors.textOnAccent : colors.textPrimary}
                    />
                    <Text
                      style={[
                        styles.protocolText,
                        isSelected && styles.protocolTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleTextGroup}>
                <Text style={styles.toggleTitle}>Kill Switch</Text>
                <Text style={styles.toggleSub}>
                  Block unencrypted traffic if tunnel drops
                </Text>
              </View>
              <Switch
                value={isKillSwitchEnabled}
                onValueChange={(val) => {
                  triggerHaptic('selection');
                  setKillSwitchEnabled(val);
                }}
                trackColor={{ false: colors.borderSubtle, true: colors.accent }}
                thumbColor={colors.textOnAccent}
              />
            </View>

            <View style={[styles.toggleRow, styles.toggleRowLast]}>
              <View style={styles.toggleTextGroup}>
                <Text style={styles.toggleTitle}>Auto-Connect</Text>
                <Text style={styles.toggleSub}>
                  Connect automatically on untrusted Wi-Fi
                </Text>
              </View>
              <Switch
                value={isAutoConnectEnabled}
                onValueChange={(val) => {
                  triggerHaptic('selection');
                  setAutoConnectEnabled(val);
                }}
                trackColor={{ false: colors.borderSubtle, true: colors.accent }}
                thumbColor={colors.textOnAccent}
              />
            </View>
          </GlassCard>

          <GlassCard style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Server Locations</Text>
            {VPN_SERVERS.map((server, idx) => {
              const isSelected = server.id === activeServer.id;
              const isLast = idx === VPN_SERVERS.length - 1;
              return (
                <Pressable
                  key={server.id}
                  onPress={() => handleSelectServer(server)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${server.country} server`}
                  style={[
                    styles.serverRow,
                    isSelected && styles.serverRowActive,
                    isLast && styles.serverRowLast,
                  ]}
                >
                  <View style={styles.serverBadge}>
                    <Text style={styles.serverCode}>{server.code}</Text>
                  </View>
                  <View style={styles.serverInfo}>
                    <Text style={styles.serverCountry}>{server.country}</Text>
                    <Text style={styles.serverCity}>
                      {server.city} • {server.loadPercent}% load
                    </Text>
                  </View>
                  <View style={styles.serverRight}>
                    <Text style={styles.serverPing}>{server.latencyMs} ms</Text>
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={isSelected ? colors.accent : colors.textMuted}
                    />
                  </View>
                </Pressable>
              );
            })}
          </GlassCard>

          <View style={styles.noteCard}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={colors.textSecondary}
            />
            <Text style={styles.noteText}>
              VPN profile, server, and kill-switch preferences are saved locally.
              System-wide packet routing requires native NEPacketTunnelProvider
              (iOS) or VpnService (Android) tunnel credentials in a production build.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </BackgroundBlobs>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.huge + spacing.xxl,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.largeTitle,
    color: colors.textPrimary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.glassBackgroundStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  statusBadgeConnected: {
    backgroundColor: colors.successSurface,
    borderColor: colors.success,
  },
  statusBadgeConnecting: {
    backgroundColor: colors.warningSurface,
    borderColor: colors.warning,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.textMuted,
  },
  statusDotConnected: {
    backgroundColor: colors.success,
  },
  statusDotConnecting: {
    backgroundColor: colors.warning,
  },
  statusBadgeText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  statusBadgeTextConnected: {
    color: colors.success,
  },
  heroCard: {
    paddingVertical: spacing.xs,
  },
  heroCenter: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  powerRing: {
    width: 112,
    height: 112,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSurface,
    borderWidth: 2,
    borderColor: colors.accentBorder,
    marginBottom: spacing.md,
  },
  powerRingConnected: {
    backgroundColor: colors.accentGlow,
    borderColor: colors.accent,
  },
  powerRingConnecting: {
    borderColor: colors.warning,
  },
  powerRingPressed: {
    transform: [{ scale: 0.96 }],
  },
  powerCore: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassBackgroundStrong,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  powerCoreConnected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  heroStatusText: {
    ...typography.title,
    color: colors.textPrimary,
  },
  heroSubText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.borderSubtle,
  },
  statLabel: {
    ...typography.small,
    color: colors.textSecondary,
  },
  statValue: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    marginTop: 2,
  },
  sectionCard: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  protocolRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  protocolChip: {
    flex: 1,
    minHeight: spacing.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  protocolChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  protocolText: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  protocolTextActive: {
    color: colors.textOnAccent,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  toggleRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  toggleTextGroup: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  toggleTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  toggleSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  serverRowActive: {
    backgroundColor: colors.accentSurface,
    borderBottomColor: 'transparent',
  },
  serverRowLast: {
    borderBottomWidth: 0,
  },
  serverBadge: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  serverCode: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  serverInfo: {
    flex: 1,
  },
  serverCountry: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  serverCity: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  serverRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  serverPing: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  noteText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
});
