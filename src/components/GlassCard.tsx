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

const webGlassStyle =
  Platform.OS === 'web'
    ? ({
        backdropFilter: 'blur(24px) saturate(140%)',
        WebkitBackdropFilter: 'blur(24px) saturate(140%)',
      } as unknown as ViewStyle)
    : undefined;

export const GlassCard = memo(function GlassCard({
  children,
  style,
  contentStyle,
  intensity = 45,
  enableBlur = true,
}: Props) {
  return (
    <View style={[styles.outerShadow, style]}>
      <LinearGradient
        colors={[
          'rgba(255, 255, 255, 0.52)',
          'rgba(255, 255, 255, 0.16)',
          'rgba(255, 255, 255, 0.03)',
          'rgba(255, 255, 255, 0.08)',
          'rgba(255, 255, 255, 0.28)',
        ]}
        locations={[0, 0.14, 0.5, 0.86, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.rimGradient}
      >
        <View style={[styles.card, webGlassStyle]}>
          {enableBlur && Platform.OS !== 'web' ? (
            <BlurView
              intensity={intensity}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <LinearGradient
            colors={[
              'rgba(44, 46, 52, 0.52)',
              'rgba(22, 23, 27, 0.62)',
              'rgba(14, 15, 18, 0.68)',
            ]}
            locations={[0, 0.5, 1]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.08)', 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.45 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={[styles.content, contentStyle]}>{children}</View>
        </View>
      </LinearGradient>
    </View>
  );
});

const styles = StyleSheet.create({
  outerShadow: {
    borderRadius: radius.xl,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 6,
  },
  rimGradient: {
    borderRadius: radius.xl,
    padding: 1.25,
  },
  card: {
    borderRadius: radius.xl - 1,
    backgroundColor: 'rgba(20, 21, 24, 0.48)',
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.35)',
    overflow: 'hidden',
  },
  content: {
    padding: spacing.md,
  },
});
