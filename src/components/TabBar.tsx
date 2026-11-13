import React, { memo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useVpnStore } from '@/features/vpn/store';
import { triggerHaptic } from '@/lib/haptics';
import { colors, radius, spacing, typography } from '@/theme';

type TabRoute = {
  key: string;
  name: string;
};

type Props = {
  state: {
    index: number;
    routes: TabRoute[];
  };
  navigateToTab?: (routeKey: string) => void;
  navigation?: {
    navigate: (name: string) => void;
  };
  onOpenAddSheet: () => void;
  activeCount: number;
};

const TAB_CONFIG: Record<
  string,
  { label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }
> = {
  index: { label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  downloads: {
    label: 'Downloads',
    icon: 'cloud-download-outline',
    activeIcon: 'cloud-download',
  },
  vpn: { label: 'VPN', icon: 'shield-outline', activeIcon: 'shield-checkmark' },
  library: { label: 'Library', icon: 'folder-open-outline', activeIcon: 'folder-open' },
  settings: { label: 'Settings', icon: 'settings-outline', activeIcon: 'settings' },
};

export const TabBar = memo(function TabBar({
  state,
  navigateToTab,
  navigation,
  activeCount,
}: Props) {
  const insets = useSafeAreaInsets();
  const vpnStatus = useVpnStore((s) => s.status);
  const isVpnConnected = vpnStatus === 'connected';

  const navigateRoute = (route: TabRoute) => {
    triggerHaptic('selection');
    if (navigateToTab) {
      navigateToTab(route.key);
    } else {
      navigation?.navigate(route.name);
    }
  };

  return (
    <View
      style={[
        styles.wrapper,
        { paddingBottom: Math.max(insets.bottom, spacing.sm) },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.barContainer}>
        {Platform.OS !== 'web' ? (
          <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill} />
        ) : null}

        <View style={styles.tabsRow}>
          {state.routes.map((route, index) => {
            const config = TAB_CONFIG[route.name];
            if (!config) {
              return null;
            }
            const isFocused = state.index === index;

            if (route.name === 'vpn') {
              return <View key={route.key} style={styles.fabSpacer} />;
            }

            const handleTabPress = () => {
              if (!isFocused) {
                navigateRoute(route);
              }
            };

            return (
              <Pressable
                key={route.key}
                onPress={handleTabPress}
                accessibilityRole="tab"
                accessibilityLabel={config.label}
                accessibilityState={{ selected: isFocused }}
                style={styles.tabItem}
              >
                <View style={[styles.iconWrap, isFocused && styles.activeIconGlow]}>
                  <Ionicons
                    name={isFocused ? config.activeIcon : config.icon}
                    size={22}
                    color={isFocused ? colors.accent : colors.textSecondary}
                  />
                  {route.name === 'downloads' && activeCount > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {activeCount > 9 ? '9+' : activeCount}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.tabLabel,
                    isFocused ? styles.tabLabelActive : styles.tabLabelInactive,
                  ]}
                >
                  {config.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {(() => {
        const vpnRoute = state.routes.find((r) => r.name === 'vpn');
        if (!vpnRoute) return null;
        const vpnIndex = state.routes.indexOf(vpnRoute);
        const isVpnFocused = state.index === vpnIndex;

        return (
          <Pressable
            onPress={() => navigateRoute(vpnRoute)}
            accessibilityRole="tab"
            accessibilityLabel="VPN"
            accessibilityState={{ selected: isVpnFocused }}
            style={({ pressed }) => [styles.fabButton, pressed && styles.fabPressed]}
          >
            <View
              style={[
                styles.fabHalo,
                isVpnConnected && styles.fabHaloConnected,
                isVpnFocused && styles.fabHaloFocused,
              ]}
            >
              <View style={styles.fabCircle}>
                <LinearGradient
                  colors={
                    isVpnConnected
                      ? [colors.success, '#22C55E']
                      : [colors.accent, colors.accentLight]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.fabGradient}
                >
                  <Ionicons
                    name={isVpnConnected ? 'shield-checkmark' : 'flash'}
                    size={24}
                    color={colors.textOnAccent}
                  />
                </LinearGradient>
              </View>
            </View>
            <Text
              style={[
                styles.centerLabel,
                isVpnFocused ? styles.tabLabelActive : styles.tabLabelInactive,
              ]}
            >
              VPN
            </Text>
          </Pressable>
        );
      })()}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 0,
    alignItems: 'center',
  },
  barContainer: {
    width: '100%',
    height: spacing.tabBarHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.glassBackgroundStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 10,
  },
  tabsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.xs,
  },
  tabItem: {
    flex: 1,
    minHeight: spacing.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconWrap: {
    position: 'relative',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  activeIconGlow: {
    backgroundColor: colors.accentSurface,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  tabLabel: {
    ...typography.small,
  },
  tabLabelActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  tabLabelInactive: {
    color: colors.textSecondary,
  },
  fabSpacer: {
    width: spacing.fabSize + spacing.sm,
  },
  fabButton: {
    position: 'absolute',
    top: -20,
    alignItems: 'center',
  },
  fabHalo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    padding: 3,
    backgroundColor: colors.background,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 10,
  },
  fabHaloConnected: {
    shadowColor: colors.success,
  },
  fabHaloFocused: {
    borderWidth: 1.5,
    borderColor: colors.accentBorder,
  },
  fabCircle: {
    flex: 1,
    borderRadius: 27,
    overflow: 'hidden',
  },
  centerLabel: {
    ...typography.small,
    marginTop: 2,
  },
  fabGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabPressed: {
    transform: [{ scale: 0.94 }],
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textOnAccent,
  },
});
