import React, { memo } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, radius, spacing } from '@/theme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  intensity?: number;
  enableBlur?: boolean;
};

export const GlassCard = memo(function GlassCard({
  children,
  style,
  contentStyle,
  intensity = 38,
  enableBlur = false,
}: Props) {
  return (
    <View style={[styles.outerShadow, style]}>
      <View style={styles.card}>
        {enableBlur && Platform.OS !== 'web' ? (
          <BlurView
            intensity={intensity}
            tint="light"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={[styles.content, contentStyle]}>{children}</View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  outerShadow: {
    borderRadius: radius.xl,
    shadowColor: colors.shadowWarm,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 3,
  },
  card: {
    borderRadius: radius.xl,
    backgroundColor: colors.glassBackground,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  content: {
    padding: spacing.md,
  },
});
