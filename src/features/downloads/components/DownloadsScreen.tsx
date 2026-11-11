import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BackgroundBlobs } from '@/components/BackgroundBlobs';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonList } from '@/components/Skeleton';
import { useSettingsStore } from '@/features/settings/store';
import { colors, radius, spacing, typography } from '@/theme';
import { DownloadItemRecord } from '@/types';
import { useDownloads } from '../hooks/useDownloads';
import { DownloadsTab } from '../types';
import { DownloadCard } from './DownloadCard';

const TABS: { key: DownloadsTab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed', label: 'Failed' },
];

export function DownloadsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const maxConcurrent = useSettingsStore((s) => s.maxConcurrent);
  const {
    items,
    isHydrated,
    openAddSheet,
    handlePause,
    handleResume,
    handleRetry,
    handleDelete,
    handleShareFile,
  } = useDownloads();

  const [selectedTab, setSelectedTab] = useState<DownloadsTab>('active');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredItems = useMemo(() => {
    if (selectedTab === 'active') {
      return items.filter(
        (i) =>
          i.status === 'downloading' ||
          i.status === 'paused' ||
          i.status === 'queued'
      );
    }
    if (selectedTab === 'completed') {
      return items.filter((i) => i.status === 'completed');
    }
    return items.filter((i) => i.status === 'failed');
  }, [items, selectedTab]);

  const isSelectionMode = selectedIds.length > 0;

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const handleDeleteSelected = useCallback(() => {
    for (const id of selectedIds) {
      handleDelete(id);
    }
    setSelectedIds([]);
  }, [handleDelete, selectedIds]);

  const handleRetryAllFailed = useCallback(() => {
    const failed = items.filter((i) => i.status === 'failed');
    for (const item of failed) {
      handleRetry(item.id);
    }
  }, [handleRetry, items]);

  const handleOpenItem = useCallback(
    (item: DownloadItemRecord) => {
      if (item.category === 'video' || item.category === 'audio') {
        router.push(`/player/${item.id}`);
      } else {
        handleShareFile(item.localUri);
      }
    },
    [handleShareFile, router]
  );

  return (
    <BackgroundBlobs>
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + spacing.md,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Downloads</Text>
            <Text style={styles.subtitle}>
              Queue limit: {maxConcurrent} concurrent transfers
            </Text>
          </View>
          {isSelectionMode ? (
            <View style={styles.selectionToolbar}>
              <Pressable
                onPress={handleDeleteSelected}
                style={styles.deleteSelectedBtn}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${selectedIds.length} selected items`}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={styles.deleteSelectedText}>
                  Delete ({selectedIds.length})
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedIds([])}
                style={styles.cancelSelectBtn}
                accessibilityRole="button"
                accessibilityLabel="Cancel selection"
              >
                <Text style={styles.cancelSelectText}>Done</Text>
              </Pressable>
            </View>
          ) : selectedTab === 'failed' && filteredItems.length > 0 ? (
            <Pressable
              onPress={handleRetryAllFailed}
              style={styles.retryAllBtn}
              accessibilityRole="button"
              accessibilityLabel="Retry all failed downloads"
            >
              <Ionicons name="refresh" size={16} color={colors.accent} />
              <Text style={styles.retryAllText}>Retry All</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.tabsSegment}>
          {TABS.map((tab) => {
            const isActive = selectedTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => {
                  setSelectedTab(tab.key);
                  setSelectedIds([]);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                style={[styles.tabPill, isActive && styles.tabPillActive]}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!isHydrated ? (
          <SkeletonList count={4} />
        ) : (
          <View style={styles.listWrapper}>
            <FlashList
              data={filteredItems}
              keyExtractor={(item) => item.id}
              extraData={selectedIds}
              contentContainerStyle={{
                paddingBottom: insets.bottom + spacing.tabBarHeight + spacing.xxl,
              }}
              ListEmptyComponent={
                <EmptyState
                  icon={
                    selectedTab === 'active'
                      ? 'cloud-download-outline'
                      : selectedTab === 'completed'
                        ? 'checkmark-done-circle-outline'
                        : 'alert-circle-outline'
                  }
                  title={`No ${selectedTab} downloads`}
                  description={
                    selectedTab === 'active'
                      ? 'Long-press any download card to multi-select, or tap + to queue a new file.'
                      : selectedTab === 'completed'
                        ? 'Finished files are ready to play or share right from here.'
                        : 'Any interrupted or failed transfers will show up here for one-tap retry.'
                  }
                  actionLabel={selectedTab === 'active' ? 'Add Direct Link' : undefined}
                  onAction={selectedTab === 'active' ? () => openAddSheet() : undefined}
                />
              }
              renderItem={({ item }) => (
                <DownloadCard
                  item={item}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedIds.includes(item.id)}
                  onToggleSelect={handleToggleSelect}
                  onPause={handlePause}
                  onResume={handleResume}
                  onRetry={handleRetry}
                  onDelete={handleDelete}
                  onShare={handleShareFile}
                  onOpenItem={handleOpenItem}
                />
              )}
            />
          </View>
        )}
      </View>
    </BackgroundBlobs>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.largeTitle,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  selectionToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  deleteSelectedBtn: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSurface,
  },
  deleteSelectedText: {
    ...typography.caption,
    color: colors.danger,
  },
  cancelSelectBtn: {
    minHeight: 40,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelSelectText: {
    ...typography.bodyStrong,
    color: colors.accent,
  },
  retryAllBtn: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSurface,
  },
  retryAllText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
  },
  tabsSegment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.glassBackgroundStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  tabPill: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillActive: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  tabText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.textOnAccent,
    fontWeight: '700',
  },
  listWrapper: {
    flex: 1,
  },
});

