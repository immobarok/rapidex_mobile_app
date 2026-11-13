import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '@/components/BottomSheet';
import { EmptyState } from '@/components/EmptyState';
import { triggerHaptic } from '@/lib/haptics';
import { colors, radius, spacing, typography } from '@/theme';
import { useBrowserStore } from '../store';
import { BrowserSheetTab } from '../types';

export function BookmarksHistorySheet() {
  const router = useRouter();
  const isVisible = useBrowserStore((s) => s.isSheetOpen);
  const initialTab = useBrowserStore((s) => s.sheetTab);
  const bookmarks = useBrowserStore((s) => s.bookmarks);
  const history = useBrowserStore((s) => s.history);
  const closeSheet = useBrowserStore((s) => s.closeBrowserSheet);
  const removeBookmark = useBrowserStore((s) => s.removeBookmark);
  const removeHistoryEntry = useBrowserStore((s) => s.removeHistoryEntry);
  const clearHistory = useBrowserStore((s) => s.clearHistory);

  const [activeTab, setActiveTab] = useState<BrowserSheetTab>(initialTab);

  useEffect(() => {
    if (isVisible) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isVisible]);

  const handleOpenUrl = (url: string) => {
    triggerHaptic('selection');
    closeSheet();
    router.push({ pathname: '/browser', params: { url } });
  };

  return (
    <BottomSheet
      isVisible={isVisible}
      title={activeTab === 'bookmarks' ? 'Bookmarks' : 'Browsing History'}
      onClose={closeSheet}
    >
      <View style={styles.segment}>
        {(['bookmarks', 'history'] as BrowserSheetTab[]).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => {
                triggerHaptic('selection');
                setActiveTab(tab);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              style={[styles.segmentPill, isActive && styles.segmentPillActive]}
            >
              <Text
                style={[
                  styles.segmentText,
                  isActive && styles.segmentTextActive,
                ]}
              >
                {tab === 'bookmarks'
                  ? `Bookmarks (${bookmarks.length})`
                  : `History (${history.length})`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === 'history' && history.length > 0 ? (
        <Pressable
          onPress={() => {
            triggerHaptic('medium');
            clearHistory();
          }}
          style={styles.clearAllBtn}
          accessibilityRole="button"
          accessibilityLabel="Clear all browsing history"
        >
          <Ionicons name="trash-outline" size={15} color={colors.danger} />
          <Text style={styles.clearAllText}>Clear History</Text>
        </Pressable>
      ) : null}

      <View style={styles.listContainer}>
        {activeTab === 'bookmarks' ? (
          <FlatList
            data={bookmarks}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <EmptyState
                icon="bookmark-outline"
                title="No Bookmarks Yet"
                description="Tap the star icon in the browser bar to save your favorite sites."
              />
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleOpenUrl(item.url)}
                style={styles.row}
                accessibilityRole="button"
                accessibilityLabel={`Open bookmark ${item.title}`}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="bookmark" size={16} color={colors.accent} />
                </View>
                <View style={styles.textCol}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.itemUrl} numberOfLines={1}>
                    {item.url}
                  </Text>
                </View>
                <Pressable
                  onPress={() => removeBookmark(item.id)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Remove bookmark"
                  style={styles.deleteBtn}
                >
                  <Ionicons name="close" size={18} color={colors.textSecondary} />
                </Pressable>
              </Pressable>
            )}
          />
        ) : (
          <FlatList
            data={history}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <EmptyState
                icon="time-outline"
                title="No History Yet"
                description="Pages you visit in the built-in browser will appear here."
              />
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleOpenUrl(item.url)}
                style={styles.row}
                accessibilityRole="button"
                accessibilityLabel={`Open history ${item.title}`}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="globe-outline" size={16} color={colors.accent} />
                </View>
                <View style={styles.textCol}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.itemUrl} numberOfLines={1}>
                    {item.url}
                  </Text>
                </View>
                <Pressable
                  onPress={() => removeHistoryEntry(item.id)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Remove history entry"
                  style={styles.deleteBtn}
                >
                  <Ionicons name="close" size={18} color={colors.textSecondary} />
                </Pressable>
              </Pressable>
            )}
          />
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  segmentPill: {
    flex: 1,
    minHeight: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentPillActive: {
    backgroundColor: colors.background,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSurface,
  },
  clearAllText: {
    ...typography.small,
    color: colors.danger,
  },
  listContainer: {
    maxHeight: 340,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  itemUrl: {
    ...typography.small,
    color: colors.textSecondary,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
