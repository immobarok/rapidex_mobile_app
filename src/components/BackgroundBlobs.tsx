import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '@/theme';

const OBSIDIAN_BG = require('../../assets/images/obsidian-bg.jpg');

type Props = {
  children: React.ReactNode;
};

export const BackgroundBlobs = memo(function BackgroundBlobs({ children }: Props) {
  return (
    <View style={styles.root}>
      <Image
        source={OBSIDIAN_BG}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        pointerEvents="none"
      />
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
