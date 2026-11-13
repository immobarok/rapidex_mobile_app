import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { BookmarksHistorySheet } from '@/features/browser/components/BookmarksHistorySheet';
import { useBrowserStore } from '@/features/browser/store';
import { AddLinkSheet } from '@/features/downloads/components/AddLinkSheet';
import { hydrateDownloadsAndRecoverQueue } from '@/features/downloads/services/downloadService';
import { useSettingsStore } from '@/features/settings/store';
import { useVpnStore } from '@/features/vpn/store';
import { colors } from '@/theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const hydrateSettings = useSettingsStore((s) => s.hydrateSettings);
  const hydrateBrowser = useBrowserStore((s) => s.hydrateBrowser);
  const hydrateVpn = useVpnStore((s) => s.hydrateVpn);

  useEffect(() => {
    hydrateSettings();
    hydrateBrowser();
    hydrateVpn();
    hydrateDownloadsAndRecoverQueue();
  }, [hydrateBrowser, hydrateSettings, hydrateVpn]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="onboarding"
              options={{ headerShown: false, animation: 'fade' }}
            />
            <Stack.Screen
              name="browser"
              options={{
                headerShown: false,
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="player/[id]"
              options={{
                headerShown: false,
                presentation: 'fullScreenModal',
                animation: 'slide_from_bottom',
              }}
            />
          </Stack>
          <AddLinkSheet />
          <BookmarksHistorySheet />
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
