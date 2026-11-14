import React, { memo } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurTint, BlurView } from 'expo-blur';
import {
  GlassStyle,
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '@/theme';
import { GlassRimOverlay } from './GlassRimOverlay';

export type GlassVariant = 'card' | 'bar' | 'sheet' | 'hud' | 'pill';

export const HAS_LIQUID_GLASS =
  Platform.OS === 'ios' &&
  isLiquidGlassAvailable() &&
  isGlassEffectAPIAvailable();

type GlassPreset = {
  blurTint: BlurTint;
  defaultIntensity: number;
  webFilter: string;
  nativeTint: string;
  glassStyle: GlassStyle;
  surfaceColors: readonly [string, string];
  sheenEndY: number;
  defaultRadius: number;
};

const GLASS_PRESETS: Record<GlassVariant, GlassPreset> = {
  card: {
    blurTint: 'systemThinMaterialDark',
    defaultIntensity: 68,
    webFilter: 'blur(22px) saturate(185%) brightness(1.05)',
    nativeTint: colors.glassNativeTint,
    glassStyle: 'regular',
    surfaceColors: [colors.glassSurfaceTop, colors.glassSurfaceBottom],
    sheenEndY: 0.34,
    defaultRadius: radius.xl,
  },
  bar: {
    blurTint: 'systemChromeMaterialDark',
    defaultIntensity: 80,
    webFilter: 'blur(28px) saturate(195%) brightness(1.08)',
    nativeTint: colors.glassNativeBarTint,
    glassStyle: 'regular',
    surfaceColors: [colors.glassBarSurfaceTop, colors.glassBarSurfaceBottom],
    sheenEndY: 0.42,
    defaultRadius: radius.pill,
  },
  sheet: {
    blurTint: 'systemChromeMaterialDark',
    defaultIntensity: 84,
    webFilter: 'blur(30px) saturate(190%) brightness(1.06)',
    nativeTint: colors.glassNativeBarTint,
    glassStyle: 'regular',
    surfaceColors: [colors.glassBarSurfaceTop, colors.glassBarSurfaceBottom],
    sheenEndY: 0.22,
    defaultRadius: radius.xl,
  },
  hud: {
    blurTint: 'systemChromeMaterialDark',
    defaultIntensity: 78,
    webFilter: 'blur(26px) saturate(190%) brightness(1.07)',
    nativeTint: colors.glassNativeHudTint,
    glassStyle: 'regular',
    surfaceColors: [colors.glassBarSurfaceTop, colors.glassBarSurfaceBottom],
    sheenEndY: 0.38,
    defaultRadius: radius.xl,
  },
  pill: {
    blurTint: 'systemThinMaterialDark',
    defaultIntensity: 62,
    webFilter: 'blur(18px) saturate(180%) brightness(1.05)',
    nativeTint: colors.glassNativeTint,
    glassStyle: 'regular',
    surfaceColors: [colors.glassSurfaceTop, colors.glassSurfaceBottom],
    sheenEndY: 0.45,
    defaultRadius: radius.pill,
  },
};

type WebBackdropStyle = ViewStyle & {
  backdropFilter: string;
  WebkitBackdropFilter: string;
  boxShadow: string;
};

type Props = {
  children: React.ReactNode;
  variant?: GlassVariant;
  borderRadius?: number;
  intensity?: number;
  enableBlur?: boolean;
  isInteractive?: boolean;
  isSelected?: boolean;
  isTopOnly?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

const WEB_FRESNEL_SHADOW =
  'inset 0 1px 0 0 rgba(255, 255, 255, 0.20), inset 0 -0.5px 0 0 rgba(255, 255, 255, 0.11), inset 0 12px 24px -12px rgba(255, 255, 255, 0.05), 0 16px 38px -8px rgba(0, 0, 0, 0.56), 0 0 0 0.5px rgba(0, 0, 0, 0.42)';

function getCornerStyle(cornerRadius: number, isTopOnly: boolean): ViewStyle {
  if (isTopOnly) {
    return {
      borderTopLeftRadius: cornerRadius,
      borderTopRightRadius: cornerRadius,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
    };
  }
  return {
    borderRadius: cornerRadius,
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
  };
}

export const GlassSurface = memo(function GlassSurface({
  children,
  variant = 'card',
  borderRadius,
  intensity,
  enableBlur = true,
  isInteractive = false,
  isSelected = false,
  isTopOnly = false,
  style,
  contentStyle,
}: Props) {
  const preset = GLASS_PRESETS[variant];
  const resolvedRadius = borderRadius ?? preset.defaultRadius;
  const resolvedIntensity = intensity ?? preset.defaultIntensity;
  const cornerStyle = getCornerStyle(resolvedRadius, isTopOnly);
  const flatOuter = StyleSheet.flatten(style);
  const shouldFillHeight = flatOuter?.height != null;

  if (HAS_LIQUID_GLASS && enableBlur) {
    return (
      <View style={[styles.iosShadow, cornerStyle, style]}>
        <GlassView
          glassEffectStyle={preset.glassStyle}
          tintColor={preset.nativeTint}
          colorScheme="dark"
          isInteractive={isInteractive}
          style={[
            cornerStyle,
            styles.nativeLiquidGlass,
            shouldFillHeight && styles.fillHeight,
          ]}
        >
          {isSelected ? (
            <View
              pointerEvents="none"
              style={[cornerStyle, styles.selectedRing]}
            />
          ) : null}
          <View style={[styles.content, contentStyle]}>{children}</View>
        </GlassView>
      </View>
    );
  }

  const webGlassStyle: ViewStyle | undefined =
    Platform.OS === 'web'
      ? ({
          backdropFilter: enableBlur ? preset.webFilter : 'none',
          WebkitBackdropFilter: enableBlur ? preset.webFilter : 'none',
          boxShadow: WEB_FRESNEL_SHADOW,
        } satisfies WebBackdropStyle as ViewStyle)
      : undefined;

  return (
    <View
      style={[
        Platform.OS === 'ios' && styles.iosShadow,
        cornerStyle,
        style,
      ]}
    >
      <View
        style={[
          styles.fallbackSurface,
          cornerStyle,
          webGlassStyle,
          shouldFillHeight && styles.fillHeight,
        ]}
      >
        {enableBlur && Platform.OS === 'ios' ? (
          <BlurView
            intensity={resolvedIntensity}
            tint={preset.blurTint}
            style={StyleSheet.absoluteFill}
          />
        ) : null}

        <LinearGradient
          colors={[preset.surfaceColors[0], preset.surfaceColors[1]]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <LinearGradient
          colors={[colors.glassSheenTop, 'rgba(255, 255, 255, 0.02)', 'transparent']}
          locations={[0, 0.35, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: preset.sheenEndY }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={[styles.content, contentStyle]}>{children}</View>

        <GlassRimOverlay
          borderRadius={resolvedRadius}
          isSelected={isSelected}
          isTopOnly={isTopOnly}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  iosShadow: {
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
  },
  nativeLiquidGlass: {
    backgroundColor: 'transparent',
  },
  fallbackSurface: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  fillHeight: {
    flex: 1,
  },
  content: {
    zIndex: 1,
  },
  selectedRing: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1.5,
    borderColor: colors.accent,
    zIndex: 2,
  },
});
