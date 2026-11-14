import React, { memo, useCallback, useId, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { colors } from '@/theme';

type Props = {
  borderRadius: number;
  strokeWidth?: number;
  isSelected?: boolean;
  isTopOnly?: boolean;
};

type WebMaskStyle = ViewStyle & {
  backgroundImage: string;
  mask: string;
  maskComposite: string;
  WebkitMask: string;
  WebkitMaskComposite: string;
};

function buildTopArchPath(
  width: number,
  height: number,
  radius: number,
  strokeWidth: number
): string {
  const half = strokeWidth / 2;
  const w = width - strokeWidth;
  const r = Math.min(radius, w / 2, Math.max(0, height - half));
  return [
    `M ${half} ${height}`,
    `L ${half} ${half + r}`,
    `A ${r} ${r} 0 0 1 ${half + r} ${half}`,
    `L ${half + w - r} ${half}`,
    `A ${r} ${r} 0 0 1 ${half + w} ${half + r}`,
    `L ${half + w} ${height}`,
  ].join(' ');
}

export const GlassRimOverlay = memo(function GlassRimOverlay({
  borderRadius,
  strokeWidth = 1.15,
  isSelected = false,
  isTopOnly = false,
}: Props) {
  const rawId = useId();
  const gradientId = `rim_${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextW = Math.round(event.nativeEvent.layout.width);
    const nextH = Math.round(event.nativeEvent.layout.height);
    setSize((prev) =>
      prev.width === nextW && prev.height === nextH
        ? prev
        : { width: nextW, height: nextH }
    );
  }, []);

  if (Platform.OS === 'web') {
    const cornerRadiusStyle: ViewStyle = isTopOnly
      ? {
          borderTopLeftRadius: borderRadius,
          borderTopRightRadius: borderRadius,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          paddingTop: strokeWidth,
          paddingLeft: strokeWidth,
          paddingRight: strokeWidth,
          paddingBottom: 0,
        }
      : {
          borderRadius,
          padding: strokeWidth,
        };

    const backgroundImage = isSelected
      ? `linear-gradient(155deg, ${colors.accent} 0%, ${colors.accentLight} 100%)`
      : isTopOnly
        ? `linear-gradient(180deg, ${colors.glassRimTop} 0%, ${colors.glassRimUpper} 30%, transparent 100%)`
        : `linear-gradient(155deg, ${colors.glassRimTop} 0%, ${colors.glassRimUpper} 18%, ${colors.glassRimMid} 50%, ${colors.glassRimLower} 84%, ${colors.glassRimBottom} 100%)`;

    const webMaskStyle: WebMaskStyle = {
      ...StyleSheet.absoluteFill,
      ...cornerRadiusStyle,
      backgroundImage,
      mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
      maskComposite: 'exclude',
      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
      WebkitMaskComposite: 'xor',
    };

    return <View pointerEvents="none" style={webMaskStyle as ViewStyle} />;
  }

  const fallbackCornerStyle: ViewStyle = isTopOnly
    ? {
        borderTopLeftRadius: borderRadius,
        borderTopRightRadius: borderRadius,
        borderBottomWidth: 0,
      }
    : { borderRadius };

  const halfStroke = strokeWidth / 2;
  const hasSize = size.width > strokeWidth * 2 && size.height > strokeWidth * 2;
  const clampedRadius = hasSize
    ? Math.min(borderRadius, size.width / 2, size.height / 2)
    : borderRadius;
  const strokeRef = isSelected ? colors.accent : `url(#${gradientId})`;

  return (
    <View
      pointerEvents="none"
      onLayout={handleLayout}
      style={StyleSheet.absoluteFill}
    >
      {!hasSize ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            fallbackCornerStyle,
            styles.fallbackBorder,
            Platform.OS === 'ios' && styles.continuousCurve,
            { borderColor: isSelected ? colors.accent : colors.glassRimFallback },
          ]}
        />
      ) : (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <LinearGradient
              id={gradientId}
              x1="0.18"
              y1="0"
              x2="0.82"
              y2="1"
            >
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.56} />
              <Stop offset="18%" stopColor="#FFFFFF" stopOpacity={0.16} />
              <Stop
                offset="50%"
                stopColor="#FFFFFF"
                stopOpacity={isTopOnly ? 0.04 : 0.03}
              />
              <Stop
                offset="84%"
                stopColor="#FFFFFF"
                stopOpacity={isTopOnly ? 0.01 : 0.09}
              />
              <Stop
                offset="100%"
                stopColor="#FFFFFF"
                stopOpacity={isTopOnly ? 0 : 0.28}
              />
            </LinearGradient>
          </Defs>
          {isTopOnly ? (
            <Path
              d={buildTopArchPath(size.width, size.height, clampedRadius, strokeWidth)}
              fill="none"
              stroke={strokeRef}
              strokeWidth={strokeWidth}
            />
          ) : (
            <Rect
              x={halfStroke}
              y={halfStroke}
              width={size.width - strokeWidth}
              height={size.height - strokeWidth}
              rx={clampedRadius}
              ry={clampedRadius}
              fill="none"
              stroke={strokeRef}
              strokeWidth={strokeWidth}
            />
          )}
        </Svg>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  fallbackBorder: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  continuousCurve: {
    borderCurve: 'continuous',
  },
});

