import React, { memo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useVpnStore } from '@/features/vpn/store';
import { triggerHaptic } from '@/lib/haptics';
import { colors, radius, spacing } from '@/theme';

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
  {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    activeIcon: keyof typeof Ionicons.glyphMap;
  }
> = {
  index: { label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  downloads: {
    label: 'Downloads',
    icon: 'cloud-download-outline',
    activeIcon: 'cloud-download',
  },
  vpn: { label: 'VPN', icon: 'shield-outline', activeIcon: 'shield-checkmark' },
  library: {
    label: 'Library',
    icon: 'folder-open-outline',
    activeIcon: 'folder-open',
  },
  settings: {
    label: 'Settings',
    icon: 'settings-outline',
    activeIcon: 'settings',
  },
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
      <View style={styles.pillShell}>
        <View style={styles.barContainer}>
          {Platform.OS !== 'web' ? (
            <BlurView
              intensity={48}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <LinearGradient
            colors={[
              'rgba(255, 255, 255, 0.08)',
              'rgba(255, 255, 255, 0.01)',
              'transparent',
            ]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.7 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <View style={styles.tabsRow}>
            {state.routes.map((route, index) => {
              const config = TAB_CONFIG[route.name];
              if (!config) {
                return null;
              }
              const isFocused = state.index === index;

              if (route.name === 'vpn') {
                return (
                  <Pressable
                    key={route.key}
                    onPress={() => {
                      if (!isFocused) {
                        navigateRoute(route);
                      }
                    }}
                    accessibilityRole="tab"
                    accessibilityLabel="VPN"
                    accessibilityState={{ selected: isFocused }}
                    style={({ pressed }) => [
                      styles.centerActionWrap,
                      pressed && styles.fabPressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.centerCircle,
                        isVpnConnected && styles.centerCircleConnected,
                        isFocused && styles.centerCircleFocused,
                      ]}
                    >
                      <View
                        style={[
                          styles.centerInnerDiamond,
                          isVpnConnected && styles.centerInnerDiamondConnected,
                        ]}
                      >
                        <Ionicons
                          name={isVpnConnected ? 'shield-checkmark' : 'flash'}
                          size={16}
                          color="#FFFFFF"
                          style={styles.centerInnerIcon}
                        />
                      </View>
                    </View>
                  </Pressable>
                );
              }

              return (
                <Pressable
                  key={route.key}
                  onPress={() => {
                    if (!isFocused) {
                      navigateRoute(route);
                    }
                  }}
                  accessibilityRole="tab"
                  accessibilityLabel={config.label}
                  accessibilityState={{ selected: isFocused }}
                  style={styles.tabItem}
                >
                  <View style={styles.iconWrap}>
                    <Ionicons
                      name={isFocused ? config.activeIcon : config.icon}
                      size={22}
                      color={isFocused ? '#FFFFFF' : colors.textSecondary}
                    />
                    {route.name === 'downloads' && activeCount > 0 ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {activeCount > 9 ? '9+' : activeCount}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
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
  pillShell: {
    width: '86%',
    maxWidth: 326,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
  },
  barContainer: {
    width: '100%',
    height: 62,
    borderRadius: radius.pill,
    backgroundColor: colors.glassBackgroundStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  tabsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  tabItem: {
    flex: 1,
    minHeight: spacing.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    position: 'relative',
    padding: 6,
  },
  centerActionWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.xs,
  },
  centerCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  centerCircleConnected: {
    backgroundColor: colors.success,
    shadowColor: colors.success,
  },
  centerCircleFocused: {
    borderWidth: 2,
    borderColor: colors.accentLight,
  },
  centerInnerDiamond: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: '#1E222A',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
  },
  centerInnerDiamondConnected: {
    backgroundColor: '#064E3B',
  },
  centerInnerIcon: {
    transform: [{ rotate: '-45deg' }],
  },
  fabPressed: {
    transform: [{ scale: 0.94 }],
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: -2,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textOnAccent,
  },
});
