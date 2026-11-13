import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/features/settings/store';

export function triggerHaptic(
  style: 'light' | 'medium' | 'selection' | 'success' = 'light'
): void {
  if (!useSettingsStore.getState().hapticsEnabled) {
    return;
  }
  if (style === 'selection') {
    Haptics.selectionAsync().catch(() => undefined);
    return;
  }
  if (style === 'success') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined
    );
    return;
  }
  const impactStyle =
    style === 'medium'
      ? Haptics.ImpactFeedbackStyle.Medium
      : Haptics.ImpactFeedbackStyle.Light;
  Haptics.impactAsync(impactStyle).catch(() => undefined);
}

