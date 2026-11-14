import React, { memo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, glassBevelStyle, iosContinuousCurve, radius, spacing, typography } from '@/theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  isDisabled?: boolean;
  isLoading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export const OrangeButton = memo(function OrangeButton({
  label,
  onPress,
  variant = 'primary',
  isDisabled = false,
  isLoading = false,
  icon,
  style,
  accessibilityLabel,
}: Props) {
  const handlePress = () => {
    if (isDisabled || isLoading) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onPress();
  };

  if (variant === 'secondary') {
    return (
      <Pressable
        onPress={handlePress}
        disabled={isDisabled || isLoading}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: isDisabled || isLoading }}
        style={({ pressed }) => [
          styles.secondaryButton,
          pressed && styles.pressed,
          (isDisabled || isLoading) && styles.disabled,
          style,
        ]}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <View style={styles.row}>
            {icon}
            <Text style={styles.secondaryLabel}>{label}</Text>
          </View>
        )}
      </Pressable>
    );
  }

  if (variant === 'danger') {
    return (
      <Pressable
        onPress={handlePress}
        disabled={isDisabled || isLoading}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: isDisabled || isLoading }}
        style={({ pressed }) => [
          styles.dangerButton,
          pressed && styles.pressed,
          (isDisabled || isLoading) && styles.disabled,
          style,
        ]}
      >
        <View style={styles.row}>
          {icon}
          <Text style={styles.dangerLabel}>{label}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled || isLoading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled || isLoading }}
      style={({ pressed }) => [
        styles.primaryShadow,
        pressed && styles.pressed,
        (isDisabled || isLoading) && styles.disabled,
        style,
      ]}
    >
      <LinearGradient
        colors={[colors.accent, colors.accentLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryGradient}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.textOnAccent} />
        ) : (
          <View style={styles.row}>
            {icon}
            <Text style={styles.primaryLabel}>{label}</Text>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  primaryShadow: {
    minHeight: spacing.touchMin,
    borderRadius: radius.md,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 5,
  },
  primaryGradient: {
    minHeight: spacing.touchMin,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    ...iosContinuousCurve,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    minHeight: spacing.touchMin,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.glassBackgroundStrong,
    ...glassBevelStyle,
    borderColor: colors.accentBorder,
    borderTopColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButton: {
    minHeight: spacing.touchMin,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  primaryLabel: {
    ...typography.bodyStrong,
    color: colors.textOnAccent,
  },
  secondaryLabel: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  dangerLabel: {
    ...typography.bodyStrong,
    color: colors.danger,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
});

