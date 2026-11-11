import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, typography } from '@/theme';

type Props = {
  progress: number; // 0..1
  size?: number;
  strokeWidth?: number;
  isActive?: boolean;
  showPercentage?: boolean;
};

export const ProgressRing = memo(function ProgressRing({
  progress,
  size = 52,
  strokeWidth = 5,
  isActive = true,
  showPercentage = true,
}: Props) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const center = size / 2;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference * (1 - clamped);
  const percentText = `${Math.round(clamped * 100)}%`;

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size },
        isActive && styles.activeGlow,
      ]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={colors.accentSurface}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={isActive ? colors.accent : colors.textSecondary}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          rotation="-90"
          origin={`${center}, ${center}`}
        />
      </Svg>
      {showPercentage ? (
        <View style={styles.labelWrapper}>
          <Text style={styles.percentText}>{percentText}</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeGlow: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  labelWrapper: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentText: {
    ...typography.small,
    color: colors.textPrimary,
  },
});
