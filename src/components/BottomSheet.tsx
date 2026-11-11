import React, { memo, useEffect } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  isVisible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

export const BottomSheet = memo(function BottomSheet({
  isVisible,
  title,
  onClose,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(320);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (isVisible) {
      backdropOpacity.value = withTiming(1, { duration: 220 });
      translateY.value = withSpring(0, { damping: 22, stiffness: 210 });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(320, { duration: 180 });
    }
  }, [backdropOpacity, isVisible, translateY]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!isVisible) {
    return null;
  }

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalRoot}
      >
        <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close sheet"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheetContainer,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) },
            sheetAnimatedStyle,
          ]}
        >
          {Platform.OS !== 'web' ? (
            <BlurView intensity={55} tint="light" style={StyleSheet.absoluteFill} />
          ) : null}

          <View style={styles.handleIndicator} />

          <View style={styles.headerRow}>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeButton}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.body}>{children}</View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
  },
  sheetContainer: {
    backgroundColor: colors.glassBackgroundStrong,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    overflow: 'hidden',
  },
  handleIndicator: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.textMuted,
    alignSelf: 'center',
    marginBottom: spacing.sm,
    opacity: 0.45,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  closeButton: {
    width: spacing.touchMin,
    height: spacing.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
  },
  body: {
    gap: spacing.md,
  },
});
