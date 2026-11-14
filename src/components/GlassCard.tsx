import React, { memo } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { radius, spacing } from '@/theme';
import { GlassSurface } from './GlassSurface';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  intensity?: number;
  enableBlur?: boolean;
  borderRadius?: number;
  isInteractive?: boolean;
  isSelected?: boolean;
};

export const GlassCard = memo(function GlassCard({
  children,
  style,
  contentStyle,
  intensity,
  enableBlur = true,
  borderRadius = radius.xl,
  isInteractive = false,
  isSelected = false,
}: Props) {
  return (
    <GlassSurface
      variant="card"
      borderRadius={borderRadius}
      intensity={intensity}
      enableBlur={enableBlur}
      isInteractive={isInteractive}
      isSelected={isSelected}
      style={style}
      contentStyle={[styles.content, contentStyle]}
    >
      {children}
    </GlassSurface>
  );
});

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
  },
});
