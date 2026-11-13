import React, { memo, useEffect, useState } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
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

type TabConfig = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
};

const TAB_CONFIG: Record<string, TabConfig> = {
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

type AnimatedTabItemProps = {
  routeName: string;
  config: TabConfig;
  isFocused: boolean;
  activeCount: number;
  reduceMotion: boolean;
  onPress: () => void;
};

const AnimatedTabItem = memo(function AnimatedTabItem({
  routeName,
  config,
  isFocused,
  activeCount,
  reduceMotion,
  onPress,
}: AnimatedTabItemProps) {
  const scale = useSharedValue(isFocused ? 1.12 : 1);
  const translateY = useSharedValue(isFocused ? -1.5 : 0);

  useEffect(() => {
    if (reduceMotion) {
      scale.value = isFocused ? 1.06 : 1;
      translateY.value = 0;
      return;
    }

    if (isFocused) {
      scale.value = withSequence(
        withSpring(1.24, { damping: 12, stiffness: 280 }),
        withSpring(1.1, { damping: 14, stiffness: 220 }),
      );
      translateY.value = withSpring(-2, { damping: 14, stiffness: 240 });
    } else {
      scale.value = withSpring(1, { damping: 16, stiffness: 220 });
      translateY.value = withSpring(0, { damping: 16, stiffness: 220 });
    }
  }, [isFocused, reduceMotion, scale, translateY]);

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={config.label}
      accessibilityState={{ selected: isFocused }}
      style={styles.tabItem}
    >
      <Animated.View style={[styles.iconWrap, iconAnimStyle]}>
        <Ionicons
          name={isFocused ? config.activeIcon : config.icon}
          size={22}
          color={isFocused ? colors.accent : colors.textSecondary}
        />
        {routeName === 'downloads' && activeCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {activeCount > 9 ? '9+' : activeCount}
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
});

export const TabBar = memo(function TabBar({
  state,
  navigateToTab,
  navigation,
  activeCount,
}: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = Boolean(useReducedMotion());
  const vpnStatus = useVpnStore((s) => s.status);
  const isVpnConnected = vpnStatus === 'connected';

  const [rowWidth, setRowWidth] = useState(0);
  const indicatorX = useSharedValue(0);
  const indicatorScale = useSharedValue(1);
  const centerScale = useSharedValue(1);

  const visibleRoutes = state.routes.filter((r) => Boolean(TAB_CONFIG[r.name]));
  const totalTabs = visibleRoutes.length || 5;
  const activeRoute = state.routes[state.index];
  const isVpnActive = activeRoute?.name === 'vpn';

  const handleRowLayout = (event: LayoutChangeEvent) => {
    setRowWidth(event.nativeEvent.layout.width);
  };

  useEffect(() => {
    if (rowWidth <= 0) return;
    const innerWidth = rowWidth - spacing.sm * 2;
    const slotWidth = innerWidth / totalTabs;
    const targetX = spacing.sm + state.index * slotWidth + (slotWidth - 44) / 2;

    if (reduceMotion) {
      indicatorX.value = withTiming(targetX, { duration: 120 });
      centerScale.value = isVpnActive ? 1.05 : 1;
      return;
    }

    indicatorX.value = withSpring(targetX, {
      damping: 16,
      stiffness: 210,
      mass: 0.75,
    });
    indicatorScale.value = withSequence(
      withSpring(1.16, { damping: 12, stiffness: 260 }),
      withSpring(1, { damping: 14, stiffness: 200 }),
    );
    centerScale.value = withSpring(isVpnActive ? 1.07 : 1, {
      damping: 13,
      stiffness: 220,
    });
  }, [
    centerScale,
    indicatorScale,
    indicatorX,
    isVpnActive,
    reduceMotion,
    rowWidth,
    state.index,
    totalTabs,
  ]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: rowWidth > 0 && !isVpnActive ? 1 : 0,
    transform: [
      { translateX: indicatorX.value },
      { scale: indicatorScale.value },
    ],
  }));

  const centerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: centerScale.value }],
  }));

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

          <View style={styles.tabsRow} onLayout={handleRowLayout}>
            <Animated.View
              pointerEvents="none"
              style={[styles.slidingGlowPill, indicatorStyle]}
            />

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
                    style={styles.centerActionWrap}
                  >
                    <Animated.View
                      style={[
                        styles.centerCircle,
                        isVpnConnected && styles.centerCircleConnected,
                        isFocused && styles.centerCircleFocused,
                        centerAnimStyle,
                      ]}
                    >
                      <View
                        style={[
                          styles.centerInnerDiamond,
                          isVpnConnected && styles.centerInnerDiamondConnected,
                          isFocused && !isVpnConnected && styles.centerInnerDiamondActive,
                        ]}
                      >
                        <Ionicons
                          name={isVpnConnected ? 'shield-checkmark' : 'flash'}
                          size={16}
                          color="#FFFFFF"
                          style={styles.centerInnerIcon}
                        />
                      </View>
                    </Animated.View>
                  </Pressable>
                );
              }

              return (
                <AnimatedTabItem
                  key={route.key}
                  routeName={route.name}
                  config={config}
                  isFocused={isFocused}
                  activeCount={activeCount}
                  reduceMotion={reduceMotion}
                  onPress={() => {
                    if (!isFocused) {
                      navigateRoute(route);
                    }
                  }}
                />
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
  slidingGlowPill: {
    position: 'absolute',
    left: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentSurface,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    shadowColor: colors.accent,
    shadowOpacity: 0.6,
    shadowRadius: 14,
  },
  centerInnerDiamond: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
  },
  centerInnerDiamondActive: {
    backgroundColor: colors.accent,
  },
  centerInnerDiamondConnected: {
    backgroundColor: '#064E3B',
  },
  centerInnerIcon: {
    transform: [{ rotate: '-45deg' }],
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
