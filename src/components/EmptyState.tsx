import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';
import { GlassCard } from './GlassCard';
import { OrangeButton } from './OrangeButton';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export const EmptyState = memo(function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: Props) {
  return (
    <GlassCard style={styles.card} contentStyle={styles.content}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={28} color={colors.accent} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction ? (
        <OrangeButton
          label={actionLabel}
          onPress={onAction}
          style={styles.button}
        />
      ) : null}
    </GlassCard>
  );
});

const styles = StyleSheet.create({
  card: {
    marginVertical: spacing.md,
  },
  content: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.subtitle,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  button: {
    marginTop: spacing.xs,
  },
});
