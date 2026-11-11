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
          colors={[colors.blobSecondary, colors.blobPrimary, colors.background]}
          start={{ x: 0.1, y: 0.1 }}
          end={{ x: 0.9, y: 0.9 }}
          style={styles.topRightBlob}
        />
        <LinearGradient
          colors={[colors.blobPrimary, colors.blobTertiary, colors.background]}
          start={{ x: 0.2, y: 0.2 }}
          end={{ x: 0.8, y: 0.9 }}
          style={styles.midLeftBlob}
        />
        <LinearGradient
          colors={[colors.blobSecondary, colors.blobPrimary, colors.background]}
          start={{ x: 0.5, y: 0.1 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.bottomRightBlob}
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
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  topRightBlob: {
    position: 'absolute',
    top: -90,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.85,
  },
  midLeftBlob: {
    position: 'absolute',
    top: '34%',
    left: -110,
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.75,
  },
  bottomRightBlob: {
    position: 'absolute',
    bottom: -70,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.7,
  },
});
