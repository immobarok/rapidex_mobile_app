import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/GlassCard';
import { triggerHaptic } from '@/lib/haptics';
import { colors, radius, spacing, typography } from '@/theme';
import { VpnServer } from '../types';

type Props = {
  servers: VpnServer[];
  activeServer: VpnServer | null;
  isExpanded: boolean;
  isLoadingServers: boolean;
  serverError: string | null;
  onToggleExpand: () => void;
  onSelectAndConnect: (serverId: string) => void;
  onRemoveServer: (serverId: string) => void;
  onOpenAddServer: () => void;
  onRefreshServers: () => void;
};

export function VpnServerListCard({
  servers,
  activeServer,
  isExpanded,
  isLoadingServers,
  serverError,
  onToggleExpand,
  onSelectAndConnect,
  onRemoveServer,
  onOpenAddServer,
  onRefreshServers,
}: Props) {
  if (!activeServer || servers.length === 0) {
    return (
      <GlassCard contentStyle={styles.card}>
        <Pressable
          onPress={() => {
            triggerHaptic('selection');
            onRefreshServers();
          }}
          disabled={isLoadingServers}
          accessibilityRole="button"
          accessibilityLabel="Load free VPN servers"
          style={styles.selectedRow}
        >
          <View style={styles.badgeCircle}>
            {isLoadingServers ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons name="refresh" size={18} color={colors.accent} />
            )}
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.serverName}>
              {isLoadingServers
                ? 'Loading Free VPN Servers...'
                : 'Load Free VPN Servers'}
            </Text>
            <Text style={styles.serverSub} numberOfLines={2}>
              {isLoadingServers
                ? 'Fetching live public OpenVPN relays'
                : serverError ?? 'Tap to fetch free servers automatically'}
            </Text>
          </View>
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              triggerHaptic('selection');
              onOpenAddServer();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Add custom WireGuard or API server"
            style={styles.addIconBtn}
          >
            <Ionicons name="add" size={18} color={colors.accent} />
          </Pressable>
        </Pressable>
      </GlassCard>
    );
  }

  return (
    <GlassCard contentStyle={styles.card}>
      <Pressable
        onPress={() => {
          triggerHaptic('selection');
          onToggleExpand();
        }}
        accessibilityRole="button"
        accessibilityLabel="Choose VPN server to connect"
        style={styles.selectedRow}
      >
        <View style={styles.badgeCircle}>
          <Text style={styles.badgeCode}>{activeServer.code}</Text>
        </View>
        <View style={styles.infoCol}>
          <Text style={styles.serverName} numberOfLines={1}>
            {activeServer.name}
          </Text>
          <Text style={styles.serverSub} numberOfLines={1}>
            {activeServer.city}
            {activeServer.latencyMs !== null ? ` · ${activeServer.latencyMs}ms` : ''}
          </Text>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>

      {isExpanded ? (
        <View style={styles.list}>
          {servers.map((server) => {
            const isSelected = server.id === activeServer.id;
            return (
              <Pressable
                key={server.id}
                onPress={() => {
                  triggerHaptic('selection');
                  onSelectAndConnect(server.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Connect to ${server.name}`}
                style={[styles.serverRow, isSelected && styles.serverRowActive]}
              >
                <View style={styles.badgeSmall}>
                  <Text style={styles.badgeCode}>{server.code}</Text>
                </View>
                <View style={styles.infoCol}>
                  <Text style={styles.serverName} numberOfLines={1}>
                    {server.name}
                  </Text>
                  <Text style={styles.serverSub} numberOfLines={1}>
                    {server.city} · {server.endpointHost}
                  </Text>
                </View>

                {server.latencyMs !== null ? (
                  <Text style={styles.pingText}>{server.latencyMs}ms</Text>
                ) : null}

                {server.source === 'imported' ? (
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      triggerHaptic('light');
                      onRemoveServer(server.id);
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${server.name}`}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={17}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                ) : null}

                <Ionicons
                  name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={isSelected ? colors.accent : colors.textMuted}
                />
              </Pressable>
            );
          })}

          <View style={styles.footerActions}>
            <Pressable
              onPress={() => {
                triggerHaptic('selection');
                onRefreshServers();
              }}
              disabled={isLoadingServers}
              accessibilityRole="button"
              accessibilityLabel="Refresh free VPN server list"
              style={styles.pillBtn}
            >
              {isLoadingServers ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Ionicons name="refresh-outline" size={15} color={colors.accent} />
              )}
              <Text style={styles.pillBtnText}>Refresh Free</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                triggerHaptic('selection');
                onOpenAddServer();
              }}
              accessibilityRole="button"
              accessibilityLabel="Import custom WireGuard or API server"
              style={styles.pillBtnSecondary}
            >
              <Ionicons
                name="add-circle-outline"
                size={15}
                color={colors.textSecondary}
              />
              <Text style={styles.pillBtnSecondaryText}>Custom .conf</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, gap: spacing.xs },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: spacing.touchMin,
  },
  badgeCircle: {
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
  badgeSmall: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  badgeCode: { ...typography.caption, fontWeight: '700', color: colors.accent },
  infoCol: { flex: 1, paddingRight: spacing.xs },
  serverName: { ...typography.bodyStrong, color: colors.textPrimary },
  serverSub: { ...typography.caption, color: colors.textSecondary },
  addIconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSurface,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.xs,
    gap: 4,
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
  serverRowActive: { backgroundColor: colors.accentSurface },
  pingText: { ...typography.small, color: colors.success, fontWeight: '600' },
  footerActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  pillBtn: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSurface,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  pillBtnText: { ...typography.caption, color: colors.accent, fontWeight: '600' },
  pillBtnSecondary: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  pillBtnSecondaryText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
