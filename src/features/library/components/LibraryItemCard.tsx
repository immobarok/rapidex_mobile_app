import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/GlassCard';
import { getFileExtension } from '@/lib/fileType';
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

  const ext = getFileExtension(item.fileName).toUpperCase().slice(0, 4);
  const hasSavedPosition = item.lastPlaybackPositionMs > 2000;
  const playbackRatio =
    hasSavedPosition && item.durationMs > 0
      ? Math.min(1, item.lastPlaybackPositionMs / item.durationMs)
      : 0;

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
              <Ionicons name={iconName} size={20} color={colors.accent} />
              {ext ? <Text style={styles.extText}>{ext}</Text> : null}
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

          <View style={styles.gridFooter}>
            <Text style={styles.metaText} numberOfLines={1}>
              {formatBytes(item.totalBytes)} • {item.folder}
            </Text>
            {playbackRatio > 0 ? (
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round(playbackRatio * 100)}%` },
                  ]}
                />
              </View>
            ) : null}
          </View>
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
        <View style={styles.listRow}>
          <View style={styles.iconBadge}>
            <Ionicons name={iconName} size={20} color={colors.accent} />
            {ext ? <Text style={styles.extText}>{ext}</Text> : null}
          </View>

          <View style={styles.infoCol}>
            <Text style={styles.listTitle} numberOfLines={1}>
              {item.fileName}
            </Text>
            <Text style={styles.metaText} numberOfLines={1}>
              {formatBytes(item.totalBytes)} • {item.folder}
              {hasSavedPosition
                ? ` • Resume ${formatDuration(item.lastPlaybackPositionMs / 1000)}`
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
        </View>

        {playbackRatio > 0 ? (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(playbackRatio * 100)}%` },
              ]}
            />
          </View>
        ) : null}
      </GlassCard>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  listCard: {
    marginBottom: spacing.sm,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  gridItemWrap: {
    flex: 1,
    padding: spacing.xxs,
    marginBottom: spacing.xs,
  },
  gridContent: {
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: 146,
    justifyContent: 'space-between',
  },
  gridTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gridFooter: {
    gap: spacing.xxs,
  },
  iconBadge: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.accent,
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
  progressTrack: {
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSurface,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },
});
