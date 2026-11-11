import React, { memo, useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, spacing } from '@/theme';

type Props = {
  height?: number;
  width?: number | `${number}%`;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export const Skeleton = memo(function Skeleton({
  height = 20,
  width = '100%',
  borderRadius = radius.md,
  style,
}: Props) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0.65);

  useEffect(() => {
    if (reducedMotion) {
      opacity.value = 0.75;
      return;
    }
    opacity.value = withRepeat(withTiming(0.35, { duration: 750 }), -1, true);
  }, [opacity, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { height, width, borderRadius },
        animatedStyle,
        style,
      ]}
    />
  );
});

export const SkeletonList = memo(function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={`sk-${index}`} height={84} borderRadius={radius.xl} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.skeletonBase,
  },
  list: {
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
});

