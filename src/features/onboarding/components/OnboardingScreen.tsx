import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/GlassCard';
import { OrangeButton } from '@/components/OrangeButton';
import { useSettingsStore } from '@/features/settings/store';
import { triggerHaptic } from '@/lib/haptics';
import { logError } from '@/lib/logger';
import { colors, radius, spacing, typography } from '@/theme';

const ORB_IMAGE_URL =
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80';

const HERO_ILLUSTRATION_URL =
  'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=900&q=80';

type Props = {
  onFinish: () => void;
};

export function OnboardingScreen({ onFinish }: Props) {
  const insets = useSafeAreaInsets();
  const [showPermissionExplainer, setShowPermissionExplainer] = useState(false);
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);
  const setNotificationsEnabled = useSettingsStore(
    (s) => s.setNotificationsEnabled,
  );

  const handleGetStarted = () => {
    triggerHaptic('medium');
    setShowPermissionExplainer(true);
  };

  const handleRequestNotifications = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotificationsEnabled(status === 'granted');
    } catch (err) {
      logError('onboarding-notifications', err);
    } finally {
      completeOnboarding();
      onFinish();
    }
  };

  const handleSkipNotifications = () => {
    triggerHaptic('selection');
    setNotificationsEnabled(false);
    completeOnboarding();
    onFinish();
  };

  return (
    <LinearGradient
      colors={['#060913', '#0D2448', '#154388', '#1D5BB8']}
      locations={[0, 0.35, 0.72, 1]}
      style={styles.root}
    >
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + spacing.lg,
            paddingBottom: Math.max(insets.bottom, spacing.xl),
          },
        ]}
      >
        {!showPermissionExplainer ? (
          <>
            <View style={styles.heroHeader}>
              <View style={styles.orbShadow}>
                <View style={styles.orbFrame}>
                  <Image
                    source={{ uri: ORB_IMAGE_URL }}
                    style={styles.orbImage}
                    contentFit="cover"
                  />
                </View>
              </View>

              <Text style={styles.headline}>Browse & Save Fast</Text>
              <Text style={styles.subheadline}>
                Explore the web privately with Rapidex, save direct files at
                full speed, and play media offline anywhere.
              </Text>
            </View>

            <View style={styles.visualStage}>
              <View style={styles.illustrationCard}>
                <Image
                  source={{ uri: HERO_ILLUSTRATION_URL }}
                  style={styles.illustrationImage}
                  contentFit="cover"
                  transition={250}
                />
                <LinearGradient
                  colors={['transparent', 'rgba(10, 22, 48, 0.75)']}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.featureBadgesRow}>
                  <View style={styles.miniBadge}>
                    <Ionicons
                      name="shield-checkmark"
                      size={14}
                      color={colors.accentLight}
                    />
                    <Text style={styles.miniBadgeText}>VPN Proxy</Text>
                  </View>
                  <View style={styles.miniBadge}>
                    <Ionicons
                      name="cloud-download"
                      size={14}
                      color={colors.accent}
                    />
                    <Text style={styles.miniBadgeText}>Direct Saver</Text>
                  </View>
                  <View style={styles.miniBadge}>
                    <Ionicons
                      name="play-circle"
                      size={14}
                      color={colors.accentLight}
                    />
                    <Text style={styles.miniBadgeText}>HD Player</Text>
                  </View>
                </View>
              </View>

              <Pressable
                onPress={handleGetStarted}
                accessibilityRole="button"
                accessibilityLabel="Continue to Rapidex"
                style={styles.tiltedPromptWrap}
              >
                <View style={styles.tiltedPrompt}>
                  {Platform.OS !== 'web' ? (
                    <BlurView
                      intensity={45}
                      tint="dark"
                      style={StyleSheet.absoluteFill}
                    />
                  ) : null}
                  <View style={styles.promptOrb}>
                    <Image
                      source={{ uri: ORB_IMAGE_URL }}
                      style={styles.promptOrbImg}
                      contentFit="cover"
                    />
                  </View>
                  <Text style={styles.promptText} numberOfLines={1}>
                    Search web or paste a direct link...
                  </Text>
                  <View style={styles.promptSendBtn}>
                    <Ionicons name="paper-plane" size={16} color="#FFFFFF" />
                  </View>
                </View>
              </Pressable>
            </View>

            <View style={styles.bottomArea}>
              <Pressable
                onPress={handleGetStarted}
                accessibilityRole="button"
                accessibilityLabel="Get Started"
                style={({ pressed }) => [
                  styles.ctaOuter,
                  pressed && styles.ctaPressed,
                ]}
              >
                <LinearGradient
                  colors={['rgba(56, 189, 248, 0.85)', 'rgba(37, 99, 235, 0.92)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.ctaGradient}
                >
                  <Text style={styles.ctaText}>Get Started</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.explainerWrap}>
            <GlassCard enableBlur intensity={48} contentStyle={styles.cardBody}>
              <View style={styles.iconCircle}>
                <Ionicons
                  name="notifications-outline"
                  size={44}
                  color={colors.accent}
                />
              </View>
              <Text style={styles.badge}>OPTIONAL PERMISSION</Text>
              <Text style={styles.slideTitle}>Stay Updated on Downloads</Text>
              <Text style={styles.slideDescription}>
                Rapidex can send a local alert when a background download
                finishes or needs attention. Zero tracking, zero spam.
              </Text>
            </GlassCard>

            <View style={styles.footer}>
              <OrangeButton
                label="Allow Notifications"
                onPress={handleRequestNotifications}
                style={styles.primaryBtn}
              />
              <Pressable
                onPress={handleSkipNotifications}
                accessibilityRole="button"
                accessibilityLabel="Not now"
                style={styles.secondaryLink}
              >
                <Text style={styles.secondaryLinkText}>Not Now</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
  },
  heroHeader: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  orbShadow: {
    width: 78,
    height: 78,
    borderRadius: 39,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 10,
    marginBottom: spacing.xs,
  },
  orbFrame: {
    flex: 1,
    borderRadius: 39,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  orbImage: {
    width: '100%',
    height: '100%',
  },
  headline: {
    ...typography.hero,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subheadline: {
    ...typography.body,
    color: 'rgba(226, 232, 240, 0.88)',
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  visualStage: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  illustrationCard: {
    width: '100%',
    height: 250,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  illustrationImage: {
    ...StyleSheet.absoluteFill,
  },
  featureBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  miniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(10, 14, 24, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  miniBadgeText: {
    ...typography.small,
    color: '#F8FAFC',
  },
  tiltedPromptWrap: {
    width: '100%',
    marginTop: -22,
    transform: [{ rotate: '4deg' }],
  },
  tiltedPrompt: {
    minHeight: 54,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(29, 78, 216, 0.48)',
    borderWidth: 1.5,
    borderColor: 'rgba(191, 219, 254, 0.45)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
    overflow: 'hidden',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  promptOrb: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  promptOrbImg: {
    width: '100%',
    height: '100%',
  },
  promptText: {
    flex: 1,
    ...typography.body,
    color: '#F1F5F9',
  },
  promptSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(56, 189, 248, 0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomArea: {
    paddingBottom: spacing.xs,
  },
  ctaOuter: {
    borderRadius: radius.pill,
    padding: 3,
    backgroundColor: 'rgba(191, 219, 254, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  },
  ctaPressed: {
    transform: [{ scale: 0.98 }],
  },
  ctaGradient: {
    minHeight: 54,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    ...typography.subtitle,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  explainerWrap: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: spacing.xl,
  },
  cardBody: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accentSurface,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  badge: {
    ...typography.small,
    color: colors.accent,
    letterSpacing: 1,
  },
  slideTitle: {
    ...typography.largeTitle,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  slideDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 23,
  },
  footer: {
    gap: spacing.md,
  },
  primaryBtn: {
    width: '100%',
  },
  secondaryLink: {
    minHeight: spacing.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLinkText: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
  },
});
