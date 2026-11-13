import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme';

type Props = {
  children: React.ReactNode;
};

export const BackgroundBlobs = memo(function BackgroundBlobs({ children }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.blobContainer} pointerEvents="none">
        <LinearGradient
          colors={['#1E2024', '#0A0B0D', '#030304']}
          locations={[0, 0.42, 1]}
          start={{ x: 0.45, y: 0 }}
          end={{ x: 0.55, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[colors.blobSecondary, colors.blobPrimary, 'transparent']}
          start={{ x: 0.35, y: 0 }}
          end={{ x: 0.85, y: 0.75 }}
          style={styles.topSweep}
        />
        <LinearGradient
          colors={[colors.blobTertiary, 'rgba(60, 64, 70, 0.08)', 'transparent']}
          start={{ x: 0, y: 0.6 }}
          end={{ x: 0.85, y: 0.2 }}
          style={styles.bottomLeftMist}
        />
        <LinearGradient
          colors={['rgba(195, 200, 210, 0.20)', 'rgba(90, 94, 102, 0.08)', 'transparent']}
          start={{ x: 0.9, y: 0.95 }}
          end={{ x: 0.2, y: 0.2 }}
          style={styles.bottomRightSweep}
        />
      </View>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  blobContainer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  topSweep: {
    position: 'absolute',
    top: -120,
    left: '8%',
    width: 340,
    height: 360,
    borderRadius: 180,
    transform: [{ rotate: '-22deg' }, { scaleX: 1.25 }],
  },
  bottomLeftMist: {
    position: 'absolute',
    bottom: -100,
    left: -130,
    width: 320,
    height: 380,
    borderRadius: 190,
  },
  bottomRightSweep: {
    position: 'absolute',
    bottom: -110,
    right: -110,
    width: 340,
    height: 380,
    borderRadius: 190,
    transform: [{ rotate: '-28deg' }],
  },
});
