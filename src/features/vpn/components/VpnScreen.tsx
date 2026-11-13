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
import { LinearGradient } from 'expo-linear-gradient';
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

function getActionLabel(status: VpnStatus): string {
  if (status === 'connected') return 'Tap to Disconnect';
  if (status === 'connecting') return 'Connecting...';
  return 'Tap to Connect';
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
  const [isServerListOpen, setIsServerListOpen] = useState(false);

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

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';

  const { downKbps, upKbps } = useMemo(() => {
    if (!isConnected) return { downKbps: 0, upKbps: 0 };
    const tick = Math.floor(now / 1000);
    return {
      downKbps: 42 + ((tick * 13) % 86),
      upKbps: 118 + ((tick * 17) % 64),
    };
  }, [isConnected, now]);

  const handleToggle = () => {
    triggerHaptic(isConnected ? 'light' : 'medium');
    toggleConnection();
  };

  const handleSelectServer = (server: VpnServer) => {
    triggerHaptic('selection');
    selectServer(server.id);
    setIsServerListOpen(false);
  };

  const handleSelectProtocol = (next: VpnProtocol) => {
    triggerHaptic('selection');
    setProtocol(next);
  };

  return (
    <BackgroundBlobs>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.screenTitle}>VPN</Text>

          <View style={styles.speedRow}>
            <GlassCard style={styles.speedCard} contentStyle={styles.speedContent}>
              <View style={styles.speedIconBox}>
                <Ionicons name="arrow-down" size={18} color={colors.textOnAccent} />
              </View>
              <View style={styles.speedTextCol}>
                <Text style={styles.speedLabel}>Download</Text>
                <Text style={styles.speedValue}>{downKbps} KB/s</Text>
              </View>
            </GlassCard>

            <GlassCard style={styles.speedCard} contentStyle={styles.speedContent}>
              <View style={styles.speedIconBox}>
                <Ionicons name="arrow-up" size={18} color={colors.textOnAccent} />
              </View>
              <View style={styles.speedTextCol}>
                <Text style={styles.speedLabel}>Upload</Text>
                <Text style={styles.speedValue}>{upKbps} KB/s</Text>
              </View>
            </GlassCard>
          </View>

          <View style={styles.ringsWrap}>
            <View
              style={[
                styles.dashedRingOuter,
                isConnected && styles.dashedRingActive,
              ]}
            >
              <View
                style={[
                  styles.dashedRingMiddle,
                  isConnected && styles.dashedRingActive,
                ]}
              >
                <View
                  style={[
                    styles.dashedRingInner,
                    isConnected && styles.dashedRingActive,
                  ]}
                >
                  <Pressable
                    onPress={handleToggle}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isConnected ? 'Disconnect VPN' : 'Connect VPN'
                    }
                    style={({ pressed }) => [
                      styles.boltButton,
                      pressed && styles.boltButtonPressed,
                    ]}
                  >
                    <LinearGradient
                      colors={
                        isConnected
                          ? [colors.success, '#22C55E']
                          : [colors.accent, colors.accentLight]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.boltGradient}
                    >
                      <Ionicons name="flash" size={56} color={colors.textOnAccent} />
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            </View>
            <Text style={styles.tapPrompt}>{getActionLabel(status)}</Text>
          </View>

          <GlassCard enableBlur contentStyle={styles.timerCard}>
            <Text style={styles.timerValue}>
              {formatElapsed(connectedAt, now)}
            </Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  isConnected && styles.statusDotConnected,
                  isConnecting && styles.statusDotConnecting,
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  isConnected && styles.statusTextConnected,
                ]}
              >
                {isConnected
                  ? 'Connected'
                  : isConnecting
                    ? 'Connecting...'
                    : 'Disconnected'}
              </Text>
            </View>
          </GlassCard>

          <GlassCard contentStyle={styles.selectedServerCard}>
            <Pressable
              onPress={() => {
                triggerHaptic('selection');
                setIsServerListOpen((prev) => !prev);
              }}
              accessibilityRole="button"
              accessibilityLabel="Change VPN server location"
              style={styles.selectedServerRow}
            >
              <View style={styles.serverBadge}>
                <Text style={styles.serverCode}>{activeServer.code}</Text>
              </View>
              <View style={styles.serverInfo}>
                <Text style={styles.serverCountry}>{activeServer.country}</Text>
                <Text style={styles.serverCity}>{activeServer.city}</Text>
              </View>
              <View style={styles.serverRight}>
                <Text style={styles.serverPing}>{activeServer.latencyMs}ms</Text>
                <Ionicons
                  name="cellular"
                  size={16}
                  color={colors.success}
                />
                <Ionicons
                  name={isServerListOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textSecondary}
                />
              </View>
            </Pressable>

            {isServerListOpen ? (
              <View style={styles.serverList}>
                {VPN_SERVERS.map((server) => {
                  const isSelected = server.id === activeServer.id;
                  return (
                    <Pressable
                      key={server.id}
                      onPress={() => handleSelectServer(server)}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${server.country} server`}
                      style={[
                        styles.serverRow,
                        isSelected && styles.serverRowActive,
                      ]}
                    >
                      <View style={styles.serverBadgeSmall}>
                        <Text style={styles.serverCode}>{server.code}</Text>
                      </View>
                      <View style={styles.serverInfo}>
                        <Text style={styles.serverCountry}>
                          {server.country}
                        </Text>
                        <Text style={styles.serverCity}>
                          {server.city} • {server.loadPercent}% load
                        </Text>
                      </View>
                      <Text style={styles.serverPing}>{server.latencyMs}ms</Text>
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={isSelected ? colors.accent : colors.textMuted}
                      />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </GlassCard>

          <GlassCard contentStyle={styles.sectionCard}>
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
                      name={
                        item === 'WireGuard'
                          ? 'flash-outline'
                          : 'lock-closed-outline'
                      }
                      size={16}
                      color={
                        isSelected ? colors.textOnAccent : colors.textPrimary
                      }
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

          <View style={styles.noteCard}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={colors.textSecondary}
            />
            <Text style={styles.noteText}>
              VPN profile, server, and kill-switch preferences are saved locally.
              System-wide packet routing requires native NEPacketTunnelProvider
              (iOS) or VpnService (Android) tunnel credentials in a production
              build.
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
  screenTitle: {
    ...typography.title,
    color: colors.accent,
    textAlign: 'center',
  },
  speedRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  speedCard: {
    flex: 1,
  },
  speedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  speedIconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedTextCol: {
    flex: 1,
  },
  speedLabel: {
    ...typography.small,
    color: colors.textSecondary,
  },
  speedValue: {
    ...typography.bodyStrong,
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  ringsWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  dashedRingOuter: {
    width: 244,
    height: 244,
    borderRadius: 122,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedRingMiddle: {
    width: 206,
    height: 206,
    borderRadius: 103,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedRingInner: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedRingActive: {
    borderColor: colors.success,
  },
  boltButton: {
    width: 138,
    height: 138,
    borderRadius: 69,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  boltButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  boltGradient: {
    flex: 1,
    borderRadius: 69,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapPrompt: {
    ...typography.title,
    color: colors.textPrimary,
  },
  timerCard: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  timerValue: {
    ...typography.hero,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.textMuted,
  },
  statusDotConnected: {
    backgroundColor: colors.success,
  },
  statusDotConnecting: {
    backgroundColor: colors.warning,
  },
  statusText: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
  },
  statusTextConnected: {
    color: colors.success,
  },
  selectedServerCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  selectedServerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: spacing.touchMin,
  },
  serverList: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.xs,
    gap: 2,
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  serverRowActive: {
    backgroundColor: colors.accentSurface,
  },
  serverBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSurface,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  serverBadgeSmall: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  serverCode: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.accent,
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
    color: colors.accent,
    fontWeight: '600',
  },
  sectionCard: {
    padding: spacing.md,
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
