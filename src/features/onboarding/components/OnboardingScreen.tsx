import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { BackgroundBlobs } from '@/components/BackgroundBlobs';
import { GlassCard } from '@/components/GlassCard';
import { OrangeButton } from '@/components/OrangeButton';
import { useSettingsStore } from '@/features/settings/store';
import { logError } from '@/lib/logger';
import { colors, radius, spacing, typography } from '@/theme';
import { OnboardingSlide } from '../types';

const SLIDES: OnboardingSlide[] = [
  {
    id: 'direct',
    icon: 'flash-outline',
    badge: 'FAST & RELIABLE',
    title: 'Direct Link Downloads',
    description:
      'Save your own cloud files, Creative Commons media, and direct links with pause, resume, and automatic queue recovery.',
  },
  {
    id: 'library',
    icon: 'folder-open-outline',
    badge: 'ORGANIZED LIBRARY',
    title: 'Clean Local File Manager',
    description:
      'Browse videos, audio, and documents by folder. Search, filter, rename, or share files offline anytime.',
  },
  {
    id: 'player',
    icon: 'play-circle-outline',
    badge: 'BUILT-IN MEDIA PLAYER',
    title: 'Smooth Video & Audio',
    description:
      'Watch in Picture-in-Picture, listen in the background, control playback speed, and pick up right where you left off.',
  },
];

type Props = {
  onFinish: () => void;
};

export function OnboardingScreen({ onFinish }: Props) {
  const insets = useSafeAreaInsets();
  const [stepIndex, setStepIndex] = useState(0);
  const [showPermissionExplainer, setShowPermissionExplainer] = useState(false);
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);
  const setNotificationsEnabled = useSettingsStore((s) => s.setNotificationsEnabled);

  const handleSkipToExplainer = () => {
    Haptics.selectionAsync().catch(() => undefined);
    setShowPermissionExplainer(true);
  };

  const handleNextSlide = () => {
    if (stepIndex < SLIDES.length - 1) {
      setStepIndex((prev) => prev + 1);
    } else {
      setShowPermissionExplainer(true);
    }
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
    setNotificationsEnabled(false);
    completeOnboarding();
    onFinish();
  };

  const currentSlide = SLIDES[stepIndex] ?? SLIDES[0];

  return (
    <BackgroundBlobs>
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: Math.max(insets.bottom, spacing.xl),
          },
        ]}
      >
        <View style={styles.topRow}>
          <Text style={styles.brand}>rapidex</Text>
          {!showPermissionExplainer ? (
            <Pressable
              onPress={handleSkipToExplainer}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Skip onboarding slides"
              style={styles.skipButton}
            >
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          ) : null}
        </View>

        {!showPermissionExplainer && currentSlide ? (
          <View style={styles.centerWrap}>
            <GlassCard enableBlur intensity={42} contentStyle={styles.slideCard}>
              <View style={styles.iconCircle}>
                <Ionicons name={currentSlide.icon} size={38} color={colors.accent} />
              </View>
              <View style={styles.badgePill}>
                <Text style={styles.badgeText}>{currentSlide.badge}</Text>
              </View>
              <Text style={styles.slideTitle}>{currentSlide.title}</Text>
              <Text style={styles.slideDescription}>{currentSlide.description}</Text>
            </GlassCard>

            <View style={styles.dotsRow}>
              {SLIDES.map((slide, idx) => (
                <View
                  key={slide.id}
                  style={[styles.dot, idx === stepIndex && styles.dotActive]}
                />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.centerWrap}>
            <GlassCard enableBlur intensity={42} contentStyle={styles.slideCard}>
              <View style={styles.iconCircle}>
                <Ionicons
                  name="notifications-outline"
                  size={38}
                  color={colors.accent}
                />
              </View>
              <View style={styles.badgePill}>
                <Text style={styles.badgeText}>STAY UPDATED</Text>
              </View>
              <Text style={styles.slideTitle}>Download Completion Alerts</Text>
              <Text style={styles.slideDescription}>
                Rapidex can send a quiet local alert when a large file finishes downloading in the background. We never send marketing messages.
              </Text>
            </GlassCard>
          </View>
        )}

        <View style={styles.footer}>
          {!showPermissionExplainer ? (
            <OrangeButton
              label={stepIndex === SLIDES.length - 1 ? 'Continue' : 'Next'}
              onPress={handleNextSlide}
            />
          ) : (
            <View style={styles.permissionButtons}>
              <OrangeButton
                label="Allow Download Alerts"
                onPress={handleRequestNotifications}
              />
              <OrangeButton
                label="Not Now"
                variant="secondary"
                onPress={handleSkipNotifications}
              />
            </View>
          )}
        </View>
      </View>
    </BackgroundBlobs>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: spacing.touchMin,
  },
  brand: {
    ...typography.title,
    color: colors.accent,
    letterSpacing: -0.5,
  },
  skipButton: {
    minHeight: spacing.touchMin,
    minWidth: spacing.touchMin,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  skipText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  centerWrap: {
    gap: spacing.lg,
  },
  slideCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accentSurface,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  badgePill: {
    backgroundColor: colors.accentSurface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  badgeText: {
    ...typography.small,
    color: colors.accent,
  },
  slideTitle: {
    ...typography.largeTitle,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  slideDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.glassBorder,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.accent,
  },
  footer: {
    gap: spacing.sm,
  },
  permissionButtons: {
    gap: spacing.sm,
  },
});

