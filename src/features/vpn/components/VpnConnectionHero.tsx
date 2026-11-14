import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { GlassCard } from '@/components/GlassCard';
import { triggerHaptic } from '@/lib/haptics';
import { colors, radius, spacing, typography } from '@/theme';
import { PublicIpInfo, VpnServer, VpnStatus } from '../types';

type Props = {
  status: VpnStatus;
  connectedAt: number | null;
  activeServer: VpnServer | null;
  errorMessage: string | null;
  publicIpInfo: PublicIpInfo | null;
  isCheckingIp: boolean;
  onToggle: () => void;
  onRefreshIp: () => void;
  onClearError: () => void;
};

function formatElapsed(startedAt: number | null, now: number): string {
  if (!startedAt) return '00:00:00';
  const totalSec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return [hrs, mins, secs].map((n) => String(n).padStart(2, '0')).join(':');
}

function getActionLabel(status: VpnStatus, hasServer: boolean): string {
  if (status === 'connected') return 'Tap to Disconnect';
  if (status === 'connecting') return 'Connecting...';
  if (status === 'disconnecting') return 'Disconnecting...';
  if (!hasServer) return 'Tap to Load Free VPN';
  if (status === 'error') return 'Tap to Retry';
  return 'Tap to Connect';
}

export function VpnConnectionHero({
  status,
  connectedAt,
  activeServer,
  errorMessage,
  publicIpInfo,
  isCheckingIp,
  onToggle,
  onRefreshIp,
  onClearError,
}: Props) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);
  const [now, setNow] = useState(() => Date.now());
  const [copiedIp, setCopiedIp] = useState(false);

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting' || status === 'disconnecting';

  useEffect(() => {
    if (!isConnected) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isConnected]);

  useEffect(() => {
    if (reduceMotion || (status !== 'connecting' && status !== 'connected')) {
      pulse.value = withTiming(1, { duration: 220 });
      return;
    }
    const target = status === 'connecting' ? 1.07 : 1.035;
    const duration = status === 'connecting' ? 650 : 1400;
    pulse.value = withRepeat(
      withTiming(target, { duration, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [pulse, reduceMotion, status]);

  const pulseRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const isOpenVpn = activeServer?.protocol === 'OpenVPN';
  const endpointOrTunnelValue = isOpenVpn
    ? activeServer?.endpointHost ?? 'Dynamic'
    : activeServer?.wireguardConfig?.addresses[0] ?? 'Not assigned';
  const endpointOrTunnelLabel = isOpenVpn ? 'Relay IP' : 'Tunnel IP';
  const displayIp = publicIpInfo?.ip ?? 'Checking...';
  const locationLabel = publicIpInfo?.country
    ? [publicIpInfo.city, publicIpInfo.country].filter(Boolean).join(', ')
    : publicIpInfo?.isp || 'Disconnected';

  const handleCopyIp = async () => {
    const value = publicIpInfo?.ip || activeServer?.endpointHost;
    if (!value) return;
    triggerHaptic('selection');
    await Clipboard.setStringAsync(value).catch(() => undefined);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 1500);
  };

  return (
    <View style={styles.container}>
      <View style={styles.metricsRow}>
        <GlassCard style={styles.metricCard} contentStyle={styles.metricContent}>
          <Pressable
            onPress={onRefreshIp}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Refresh public IP address"
            style={[styles.iconBox, isConnected && styles.iconBoxActive]}
          >
            {isCheckingIp ? (
              <ActivityIndicator size="small" color={colors.textOnAccent} />
            ) : (
              <Ionicons name="globe-outline" size={17} color={colors.textOnAccent} />
            )}
          </Pressable>
          <View style={styles.metricTextCol}>
            <Text style={styles.metricLabel}>Public IP</Text>
            <Text style={styles.metricValue} numberOfLines={1}>
              {displayIp}
            </Text>
          </View>
        </GlassCard>

        <GlassCard style={styles.metricCard} contentStyle={styles.metricContent}>
          <View style={[styles.iconBox, isConnected && styles.iconBoxActive]}>
            <Ionicons name="pulse-outline" size={17} color={colors.textOnAccent} />
          </View>
          <View style={styles.metricTextCol}>
            <Text style={styles.metricLabel}>Ping</Text>
            <Text style={styles.metricValue} numberOfLines={1}>
              {publicIpInfo ? `${publicIpInfo.rttMs} ms` : '—'}
            </Text>
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
          <View style={[styles.dashedRingMiddle, isConnected && styles.dashedRingActive]}>
            <View style={[styles.dashedRingInner, isConnected && styles.dashedRingActive]}>
              <Pressable
                onPress={onToggle}
                disabled={isConnecting}
                accessibilityRole="button"
                accessibilityLabel={isConnected ? 'Disconnect VPN' : 'Connect VPN'}
                style={({ pressed }) => [
                  styles.boltButton,
                  isConnected && styles.boltButtonConnected,
                  pressed && styles.boltButtonPressed,
                ]}
              >
                <LinearGradient
                  colors={
                    isConnected
                      ? [colors.success, colors.accentLight]
                      : [colors.accent, colors.accentLight]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.boltGradient}
                >
                  {isConnecting ? (
                    <ActivityIndicator size="large" color={colors.textOnAccent} />
                  ) : (
                    <Ionicons
                      name={isConnected ? 'shield-checkmark' : 'flash'}
                      size={50}
                      color={colors.textOnAccent}
                    />
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </Animated.View>
        <Text style={styles.tapPrompt}>
          {getActionLabel(status, Boolean(activeServer))}
        </Text>
      </View>

      <GlassCard enableBlur contentStyle={styles.timerCard}>
        <Text style={styles.timerValue}>{formatElapsed(connectedAt, now)}</Text>

        {errorMessage ? (
          <Pressable
            onPress={onClearError}
            style={styles.errorRow}
            accessibilityRole="button"
            accessibilityLabel="Dismiss error message"
          >
            <Ionicons name="alert-circle-outline" size={15} color={colors.warning} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </Pressable>
        ) : (
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
              numberOfLines={1}
            >
              {isConnected
                ? `Connected · ${locationLabel}`
                : isConnecting
                  ? `Connecting ${activeServer?.protocol ?? 'VPN'}...`
                  : locationLabel}
            </Text>
          </View>
        )}

        <View style={styles.telemetryGrid}>
          <Pressable
            onPress={handleCopyIp}
            style={styles.telemetryItem}
            accessibilityRole="button"
            accessibilityLabel="Copy server or public IP"
          >
            <Text style={styles.telemetryLabel}>{endpointOrTunnelLabel}</Text>
            <View style={styles.ipRow}>
              <Text style={styles.telemetryValue} numberOfLines={1}>
                {copiedIp ? 'Copied!' : endpointOrTunnelValue}
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
            <Text style={styles.telemetryLabel}>Protocol</Text>
            <Text style={styles.telemetryValue} numberOfLines={1}>
              {activeServer?.protocol ?? 'OpenVPN'}
            </Text>
          </View>
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  metricsRow: { flexDirection: 'row', gap: spacing.sm },
  metricCard: { flex: 1 },
  metricContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxActive: { backgroundColor: colors.success },
  metricTextCol: { flex: 1 },
  metricLabel: { ...typography.small, color: colors.textSecondary },
  metricValue: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  ringsWrap: { alignItems: 'center', paddingVertical: spacing.xs, gap: spacing.md },
  dashedRingOuter: {
    width: 224,
    height: 224,
    borderRadius: 112,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedRingMiddle: {
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedRingInner: {
    width: 156,
    height: 156,
    borderRadius: 78,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedRingActive: { borderColor: colors.success },
  boltButton: {
    width: 126,
    height: 126,
    borderRadius: 63,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  boltButtonConnected: { shadowColor: colors.success },
  boltButtonPressed: { transform: [{ scale: 0.96 }] },
  boltGradient: {
    flex: 1,
    borderRadius: 63,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapPrompt: { ...typography.title, color: colors.textPrimary },
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
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.textMuted,
  },
  statusDotConnected: { backgroundColor: colors.success },
  statusDotConnecting: { backgroundColor: colors.warning },
  statusText: { ...typography.bodyStrong, color: colors.textSecondary, flexShrink: 1 },
  statusTextConnected: { color: colors.success },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  errorText: {
    ...typography.caption,
    color: colors.warning,
    textAlign: 'center',
    flexShrink: 1,
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
  telemetryItem: { flex: 1, alignItems: 'center', gap: 2 },
  telemetryDivider: { width: 1, height: 28, backgroundColor: colors.borderSubtle },
  telemetryLabel: { ...typography.small, color: colors.textSecondary },
  telemetryValue: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  ipRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
