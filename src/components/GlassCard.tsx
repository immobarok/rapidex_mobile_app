import React, { memo } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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
  intensity = 54,
  enableBlur = false,
}: Props) {
  return (
    <View style={[styles.outerShadow, style]}>
      <View style={styles.card}>
        {enableBlur && Platform.OS !== 'web' ? (
          <BlurView
            intensity={intensity}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.07)', 'rgba(255, 255, 255, 0.01)', 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.65 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.topSpecular} pointerEvents="none" />
        <View style={[styles.content, contentStyle]}>{children}</View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  outerShadow: {
    borderRadius: radius.xl,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
    elevation: 5,
  },
  card: {
    borderRadius: radius.xl,
    backgroundColor: colors.glassBackground,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  topSpecular: {
    position: 'absolute',
    top: 0,
    left: spacing.md,
    right: spacing.md,
    height: 1,
    backgroundColor: colors.glassHighlight,
    opacity: 0.65,
  },
  content: {
    padding: spacing.md,
  },
});
