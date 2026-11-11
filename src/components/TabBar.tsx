import React, { memo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
  library: { label: 'Library', icon: 'folder-open-outline', activeIcon: 'folder-open' },
  settings: { label: 'Settings', icon: 'settings-outline', activeIcon: 'settings' },
};

export const TabBar = memo(function TabBar({
  state,
  navigateToTab,
  navigation,
  onOpenAddSheet,
  activeCount,
}: Props) {
  const insets = useSafeAreaInsets();

  const handlePressFab = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    onOpenAddSheet();
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
          <BlurView intensity={45} tint="light" style={StyleSheet.absoluteFill} />
        ) : null}

        <View style={styles.tabsRow}>
          {state.routes.map((route, index) => {
            const config = TAB_CONFIG[route.name];
            if (!config) {
              return null;
            }
            const isFocused = state.index === index;

            const handleTabPress = () => {
              Haptics.selectionAsync().catch(() => undefined);
              if (!isFocused) {
                if (navigateToTab) {
                  navigateToTab(route.key);
                } else {
                  navigation?.navigate(route.name);
                }
              }
            };

            return (
              <React.Fragment key={route.key}>
                {index === 2 ? <View style={styles.fabSpacer} /> : null}
                <Pressable
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
              </React.Fragment>
            );
          })}
        </View>
      </View>

      <Pressable
        onPress={handlePressFab}
        accessibilityRole="button"
        accessibilityLabel="Add new download link"
        style={({ pressed }) => [styles.fabButton, pressed && styles.fabPressed]}
      >
        <LinearGradient
          colors={[colors.accent, colors.accentLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={30} color={colors.textOnAccent} />
        </LinearGradient>
      </Pressable>
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
    borderRadius: radius.xl,
    backgroundColor: colors.glassBackgroundStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
    shadowColor: colors.shadowWarm,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 8,
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
    width: spacing.fabSize + spacing.xs,
  },
  fabButton: {
    position: 'absolute',
    top: -16,
    width: spacing.fabSize,
    height: spacing.fabSize,
    borderRadius: spacing.fabSize / 2,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 10,
  },
  fabGradient: {
    flex: 1,
    borderRadius: spacing.fabSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
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
