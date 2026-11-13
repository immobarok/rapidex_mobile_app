import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BackgroundBlobs } from '@/components/BackgroundBlobs';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonList } from '@/components/Skeleton';
import { triggerHaptic } from '@/lib/haptics';
import { colors, radius, spacing, typography } from '@/theme';
import { DownloadItemRecord } from '@/types';
import { useLibrary } from '../hooks/useLibrary';
import { LibraryFilterCategory, LibraryFolderFilter } from '../types';
import { FileDetailsModal } from './FileDetailsModal';
import { LibraryItemCard } from './LibraryItemCard';

const CATEGORIES: { key: LibraryFilterCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'video', label: 'Video' },
  { key: 'audio', label: 'Audio' },
  { key: 'document', label: 'Docs' },
  { key: 'other', label: 'Other' },
];

const FOLDERS: LibraryFolderFilter[] = [
  'All Folders',
  'Downloads',
  'Videos',
  'Music',
  'Documents',
];

export function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    files,
    countsByCategory,
    isHydrated,
    searchQuery,
    setSearchQuery,
    category,
    setCategory,
    folder,
    setFolder,
    sortBy,
    cycleSortBy,
    viewMode,
    toggleViewMode,
    handleDelete,
    handleRename,
    handleMoveFolder,
    handleCopyUrl,
    handleShareFile,
  } = useLibrary();

  const [detailsItem, setDetailsItem] = useState<DownloadItemRecord | null>(null);

  const handleOpenFile = useCallback(
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
          { paddingTop: insets.top + spacing.md },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>Library</Text>
          <View style={styles.headerControls}>
            <Pressable
              onPress={() => {
                triggerHaptic('selection');
                cycleSortBy();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Sort by ${sortBy}`}
              style={styles.controlChip}
            >
              <Ionicons name="swap-vertical" size={16} color={colors.accent} />
              <Text style={styles.controlChipText}>
                {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                triggerHaptic('selection');
                toggleViewMode();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${viewMode === 'list' ? 'grid' : 'list'} view`}
              style={styles.iconBtn}
            >
              <Ionicons
                name={viewMode === 'list' ? 'grid-outline' : 'list-outline'}
                size={20}
                color={colors.textPrimary}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search saved files..."
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            accessibilityLabel="Search library files"
          />
          {searchQuery.length > 0 ? (
            <Pressable
              onPress={() => setSearchQuery('')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.filtersBlock}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScroll}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat.key;
              const count = countsByCategory[cat.key];
              return (
                <Pressable
                  key={cat.key}
                  onPress={() => {
                    triggerHaptic('selection');
                    setCategory(cat.key);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={[styles.chip, isSelected && styles.chipActive]}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                    {cat.label}
                    {count > 0 ? ` (${count})` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScroll}
          >
            {FOLDERS.map((fld) => {
              const isSelected = folder === fld;
              return (
                <Pressable
                  key={fld}
                  onPress={() => {
                    triggerHaptic('selection');
                    setFolder(fld);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={[styles.folderChip, isSelected && styles.folderChipActive]}
                >
                  <Ionicons
                    name="folder-outline"
                    size={14}
                    color={isSelected ? colors.accent : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.folderChipText,
                      isSelected && styles.folderChipTextActive,
                    ]}
                  >
                    {fld}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {!isHydrated ? (
          <SkeletonList count={4} />
        ) : (
          <View style={styles.listWrap}>
            <FlashList
              key={viewMode}
              data={files}
              numColumns={viewMode === 'grid' ? 2 : 1}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{
                paddingBottom: insets.bottom + spacing.tabBarHeight + spacing.xxl,
              }}
              ListEmptyComponent={
                <EmptyState
                  icon="folder-open-outline"
                  title="No Matching Files"
                  description="Your completed downloads will appear here organized by category and folder."
                />
              }
              renderItem={({ item }) => (
                <LibraryItemCard
                  item={item}
                  viewMode={viewMode}
                  onPress={handleOpenFile}
                  onOpenDetails={setDetailsItem}
                />
              )}
            />
          </View>
        )}

        <FileDetailsModal
          item={detailsItem}
          onClose={() => setDetailsItem(null)}
          onRename={handleRename}
          onMoveFolder={handleMoveFolder}
          onCopyUrl={handleCopyUrl}
          onShare={handleShareFile}
          onDelete={handleDelete}
        />
      </View>
    </BackgroundBlobs>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
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
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  controlChip: {
    minHeight: spacing.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.glassBackgroundStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  controlChipText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  iconBtn: {
    width: spacing.touchMin,
    height: spacing.touchMin,
    borderRadius: radius.pill,
    backgroundColor: colors.glassBackgroundStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.glassBackgroundStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
  },
  filtersBlock: {
    gap: spacing.xs,
  },
  chipsScroll: {
    gap: spacing.xs,
    paddingVertical: 2,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.glassBackgroundStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.textOnAccent,
    fontWeight: '700',
  },
  folderChip: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  folderChipActive: {
    backgroundColor: colors.accentSurface,
    borderColor: colors.accentBorder,
  },
  folderChipText: {
    ...typography.small,
    color: colors.textSecondary,
  },
  folderChipTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  listWrap: {
    flex: 1,
  },
});
