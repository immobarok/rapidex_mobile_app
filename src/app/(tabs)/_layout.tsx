import React, { useMemo } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { TabBar } from '@/components/TabBar';
import { useDownloadsStore } from '@/features/downloads/store';
import { useSettingsStore } from '@/features/settings/store';

export default function TabsLayout() {
  const hasCompletedOnboarding = useSettingsStore(
    (s) => s.hasCompletedOnboarding
  );
  const openAddSheet = useDownloadsStore((s) => s.openAddSheet);
  const items = useDownloadsStore((s) => s.items);

  const activeCount = useMemo(
    () =>
      items.filter(
        (i) =>
          i.status === 'downloading' ||
          i.status === 'paused' ||
          i.status === 'queued'
      ).length,
    [items]
  );

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => (
        <TabBar
          {...props}
          onOpenAddSheet={() => openAddSheet()}
          activeCount={activeCount}
        />
      )}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="downloads" options={{ title: 'Downloads' }} />
      <Tabs.Screen name="library" options={{ title: 'Library' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
