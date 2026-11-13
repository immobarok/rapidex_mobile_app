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
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
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
  if (status === 'connecting') return 'Securing Tunnel...';
  return 'Tap to Connect';
}

function getPingColor(latencyMs: number): string {
  if (latencyMs <= 65) return colors.success;
  if (latencyMs <= 105) return colors.warning;
  return colors.accent;
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

  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);

  const [now, setNow] = useState(() => Date.now());
  const [isServerListOpen, setIsServerListOpen] = useState(false);
  const [copiedIp, setCopiedIp] = useState(false);

  useEffect(() => {
    if (status !== 'connected') return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (reduceMotion || status === 'disconnected') {
      pulse.value = withTiming(1, { duration: 220 });
      return;
    }
    const target = status === 'connecting' ? 1.07 : 1.035;
    const duration = status === 'connecting' ? 650 : 1400;
    pulse.value = withRepeat(
      withTiming(target, { duration, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse, reduceMotion, status]);

  const pulseRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const activeServer = useMemo(
    () => VPN_SERVERS.find((s) => s.id === selectedServerId) ?? VPN_SERVERS[0],
    [selectedServerId],
  );

  const fastestServer = useMemo(
    () =>
      VPN_SERVERS.reduce((best, item) =>
        item.latencyMs < best.latencyMs ? item : best,
      ),
    [],
  );

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';

  const { downKbps, upKbps, sessionMb } = useMemo(() => {
    if (!isConnected || !connectedAt) {
      return { downKbps: 0, upKbps: 0, sessionMb: '0.0' };
    }
    const elapsedSec = Math.max(1, Math.floor((now - connectedAt) / 1000));
    const down = 48 + ((elapsedSec * 13) % 94);
    const up = 122 + ((elapsedSec * 17) % 68);
    const totalMb = ((elapsedSec * 165) / 1024).toFixed(1);
    return { downKbps: down, upKbps: up, sessionMb: totalMb };
  }, [connectedAt, isConnected, now]);

  const handleToggle = () => {
    triggerHaptic(isConnected ? 'light' : 'medium');
    toggleConnection();
  };

  const handleSelectServer = (server: VpnServer) => {
    triggerHaptic('selection');
    selectServer(server.id);
    setIsServerListOpen(false);
  };

  const handleSelectFastest = () => {
    triggerHaptic('selection');
    selectServer(fastestServer.id);
    setIsServerListOpen(false);
  };

  const handleSelectProtocol = (next: VpnProtocol) => {
    triggerHaptic('selection');
    setProtocol(next);
  };

  const handleCopyIp = async () => {
    triggerHaptic('selection');
    await Clipboard.setStringAsync(activeServer.ipMask).catch(() => undefined);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 1600);
  };

  const cipherLabel =
    protocol === 'WireGuard' ? 'ChaCha20-Poly1305' : 'AES-256-GCM';

  return (
    <BackgroundBlobs>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
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

            <Pressable
              onPress={handleSelectFastest}
              accessibilityRole="button"
              accessibilityLabel="Select fastest VPN server"
              style={styles.fastestBtn}
            >
              <Ionicons name="speedometer-outline" size={14} color={colors.accent} />
              <Text style={styles.fastestBtnText}>Fastest</Text>
            </Pressable>
          </View>

          <View style={styles.speedRow}>
            <GlassCard style={styles.speedCard} contentStyle={styles.speedContent}>
              <View
                style={[
                  styles.speedIconBox,
                  isConnected && styles.speedIconBoxActive,
                ]}
              >
                <Ionicons name="arrow-down" size={17} color={colors.textOnAccent} />
              </View>
              <View style={styles.speedTextCol}>
                <Text style={styles.speedLabel}>Download</Text>
                <Text style={styles.speedValue}>{downKbps} KB/s</Text>
              </View>
            </GlassCard>

            <GlassCard style={styles.speedCard} contentStyle={styles.speedContent}>
              <View
                style={[
                  styles.speedIconBox,
                  isConnected && styles.speedIconBoxActive,
                ]}
              >
                <Ionicons name="arrow-up" size={17} color={colors.textOnAccent} />
              </View>
              <View style={styles.speedTextCol}>
                <Text style={styles.speedLabel}>Upload</Text>
                <Text style={styles.speedValue}>{upKbps} KB/s</Text>
              </View>
            </GlassCard>
          </View>

          <View style={styles.ringsWrap}>
            <Animated.View
              style={[
                styles.dashedRingOuter,
                isConnected && styles.dashedRingActive,
                pulseRingStyle,
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
                      isConnected && styles.boltButtonConnected,
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
                      <Ionicons
                        name={isConnected ? 'shield-checkmark' : 'flash'}
                        size={52}
                        color={colors.textOnAccent}
                      />
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            </Animated.View>
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
                  ? `Connected • ${sessionMb} MB routed`
                  : isConnecting
                    ? 'Negotiating handshake...'
                    : 'Disconnected'}
              </Text>
            </View>

            <View style={styles.telemetryGrid}>
              <Pressable
                onPress={handleCopyIp}
                style={styles.telemetryItem}
                accessibilityRole="button"
                accessibilityLabel="Copy virtual IP address"
              >
                <Text style={styles.telemetryLabel}>Virtual IP</Text>
                <View style={styles.ipRow}>
                  <Text style={styles.telemetryValue}>
                    {copiedIp ? 'Copied!' : activeServer.ipMask}
                  </Text>
                  <Ionicons
                    name={copiedIp ? 'checkmark' : 'copy-outline'}
                    size={13}
                    color={colors.accent}
                  />
                </View>
              </Pressable>

              <View style={styles.telemetryDivider} />

              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryLabel}>Cipher</Text>
                <Text style={styles.telemetryValue} numberOfLines={1}>
                  {cipherLabel}
                </Text>
              </View>
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
                <Text style={styles.serverCity}>
                  {activeServer.city} • {activeServer.loadPercent}% load
                </Text>
              </View>
              <View style={styles.serverRight}>
                <Text
                  style={[
                    styles.serverPing,
                    { color: getPingColor(activeServer.latencyMs) },
                  ]}
                >
                  {activeServer.latencyMs}ms
                </Text>
                <Ionicons
                  name="cellular"
                  size={16}
                  color={getPingColor(activeServer.latencyMs)}
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
                  const pingColor = getPingColor(server.latencyMs);
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
                      <Text style={[styles.serverPing, { color: pingColor }]}>
                        {server.latencyMs}ms
                      </Text>
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
            <Text style={styles.sectionTitle}>Tunnel & Protection</Text>
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
    paddingTop: spacing.xs,
    paddingBottom: spacing.huge + spacing.xxl,
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
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  securityPillActive: {
    backgroundColor: colors.successSurface,
    borderColor: colors.success,
  },
  securityPillText: {
    ...typography.small,
    color: colors.textSecondary,
  },
  securityPillTextActive: {
    color: colors.success,
  },
  screenTitle: {
    ...typography.title,
    color: colors.textPrimary,
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
  fastestBtnText: {
    ...typography.small,
    color: colors.accent,
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
  speedIconBoxActive: {
    backgroundColor: colors.success,
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
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  ringsWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  dashedRingOuter: {
    width: 236,
    height: 236,
    borderRadius: 118,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedRingMiddle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedRingInner: {
    width: 164,
    height: 164,
    borderRadius: 82,
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
    width: 132,
    height: 132,
    borderRadius: 66,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  boltButtonConnected: {
    shadowColor: colors.success,
  },
  boltButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  boltGradient: {
    flex: 1,
    borderRadius: 66,
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
    paddingHorizontal: spacing.md,
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
  telemetryGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  telemetryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  telemetryDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.borderSubtle,
  },
  telemetryLabel: {
    ...typography.small,
    color: colors.textSecondary,
  },
  telemetryValue: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  ipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
