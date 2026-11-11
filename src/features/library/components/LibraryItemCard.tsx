import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/GlassCard';
import { formatBytes } from '@/lib/formatBytes';
import { formatDuration } from '@/lib/formatDuration';
import { colors, radius, spacing, typography } from '@/theme';
import { DownloadItemRecord } from '@/types';
import { LibraryViewMode } from '../types';

type Props = {
  item: DownloadItemRecord;
  viewMode: LibraryViewMode;
  onPress: (item: DownloadItemRecord) => void;
  onOpenDetails: (item: DownloadItemRecord) => void;
};

export const LibraryItemCard = memo(function LibraryItemCard({
  item,
  viewMode,
  onPress,
  onOpenDetails,
}: Props) {
  const iconName: keyof typeof Ionicons.glyphMap =
    item.category === 'video'
      ? 'videocam'
      : item.category === 'audio'
        ? 'musical-notes'
        : item.category === 'document'
          ? 'document-text'
          : 'cube';

  const hasSavedPosition = item.lastPlaybackPositionMs > 2000;

  if (viewMode === 'grid') {
    return (
      <Pressable
        onPress={() => onPress(item)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.fileName}`}
        style={styles.gridItemWrap}
      >
        <GlassCard contentStyle={styles.gridContent}>
          <View style={styles.gridTopRow}>
            <View style={styles.iconBadge}>
              <Ionicons name={iconName} size={22} color={colors.accent} />
            </View>
            <Pressable
              onPress={() => onOpenDetails(item)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`File details for ${item.fileName}`}
              style={styles.moreBtn}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={18}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>

          <Text style={styles.gridTitle} numberOfLines={2}>
            {item.fileName}
          </Text>

          <Text style={styles.metaText} numberOfLines={1}>
            {formatBytes(item.totalBytes)} • {item.folder}
          </Text>
        </GlassCard>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.fileName}`}
    >
      <GlassCard style={styles.listCard} contentStyle={styles.listContent}>
        <View style={styles.iconBadge}>
          <Ionicons name={iconName} size={22} color={colors.accent} />
        </View>

        <View style={styles.infoCol}>
          <Text style={styles.listTitle} numberOfLines={1}>
            {item.fileName}
          </Text>
          <Text style={styles.metaText} numberOfLines={1}>
            {formatBytes(item.totalBytes)} • {item.folder}
            {hasSavedPosition
              ? ` • Resume at ${formatDuration(item.lastPlaybackPositionMs / 1000)}`
              : ''}
          </Text>
        </View>

        <Pressable
          onPress={() => onOpenDetails(item)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`File details for ${item.fileName}`}
          style={styles.moreBtn}
        >
          <Ionicons
            name="ellipsis-vertical"
            size={18}
            color={colors.textSecondary}
          />
        </Pressable>
      </GlassCard>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  listCard: {
    marginBottom: spacing.sm,
  },
  listContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  gridItemWrap: {
    flex: 1,
    padding: spacing.xxs,
    marginBottom: spacing.xs,
  },
  gridContent: {
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: 140,
    justifyContent: 'space-between',
  },
  gridTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
    gap: 2,
  },
  listTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  gridTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  moreBtn: {
    width: spacing.touchMin,
    height: spacing.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
