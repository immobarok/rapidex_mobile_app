import React, { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/GlassCard';
import { ProgressRing } from '@/components/ProgressRing';
import { formatBytes } from '@/lib/formatBytes';
import { formatEta } from '@/lib/formatDuration';
import { formatSpeed } from '@/lib/formatSpeed';
import { colors, radius, spacing, typography } from '@/theme';
import { DownloadItemRecord } from '@/types';
import { useDownloadProgress } from '../hooks/useDownloadProgress';

type Props = {
  item: DownloadItemRecord;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onToggleSelect?: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
  onShare: (localUri: string) => void;
  onOpenItem?: (item: DownloadItemRecord) => void;
};

export const DownloadCard = memo(function DownloadCard({
  item,
  isSelected = false,
  isSelectionMode = false,
  onToggleSelect,
  onPause,
  onResume,
  onRetry,
  onDelete,
  onShare,
  onOpenItem,
}: Props) {
  const liveProgress = useDownloadProgress(item.id);
  const [showActions, setShowActions] = useState(false);

  const downloaded = liveProgress?.downloadedBytes ?? item.downloadedBytes;
  const total = liveProgress?.totalBytes ?? item.totalBytes;
  const speed = liveProgress?.speedBytesPerSec ?? 0;
  const eta = liveProgress?.etaSeconds ?? null;
  const ratio = total > 0 ? downloaded / total : item.status === 'completed' ? 1 : 0;

  const handleCardPress = () => {
    if (isSelectionMode && onToggleSelect) {
      onToggleSelect(item.id);
      return;
    }
    if (item.status === 'completed' && onOpenItem) {
      onOpenItem(item);
      return;
    }
    setShowActions((prev) => !prev);
  };

  const handleLongPress = () => {
    if (onToggleSelect) {
      onToggleSelect(item.id);
    } else {
      setShowActions((prev) => !prev);
    }
  };

  return (
    <Pressable
      onPress={handleCardPress}
      onLongPress={handleLongPress}
      accessibilityRole="button"
      accessibilityLabel={`Download ${item.fileName}, status ${item.status}`}
    >
      <GlassCard
        style={[styles.card, isSelected && styles.selectedCard]}
        contentStyle={styles.content}
      >
        <View style={styles.mainRow}>
          {isSelectionMode ? (
            <View style={styles.checkboxWrap}>
              <Ionicons
                name={isSelected ? 'checkbox' : 'square-outline'}
                size={22}
                color={isSelected ? colors.accent : colors.textSecondary}
              />
            </View>
          ) : null}

          {item.status === 'downloading' || item.status === 'paused' || item.status === 'queued' ? (
            <ProgressRing
              progress={ratio}
              isActive={item.status === 'downloading'}
              size={50}
            />
          ) : (
            <View
              style={[
                styles.statusIconBox,
                item.status === 'failed' && styles.failedIconBox,
              ]}
            >
              <Ionicons
                name={
                  item.status === 'failed'
                    ? 'alert-circle-outline'
                    : item.category === 'video'
                      ? 'videocam-outline'
                      : item.category === 'audio'
                        ? 'musical-notes-outline'
                        : 'document-text-outline'
                }
                size={24}
                color={item.status === 'failed' ? colors.danger : colors.accent}
              />
            </View>
          )}

          <View style={styles.infoCol}>
            <Text style={styles.fileName} numberOfLines={1}>
              {item.fileName}
            </Text>
            <Text style={styles.metaText} numberOfLines={1}>
              {item.status === 'downloading'
                ? `${formatBytes(downloaded)} / ${total > 0 ? formatBytes(total) : '--'} • ${formatSpeed(speed)} • ${formatEta(eta)}`
                : item.status === 'paused'
                  ? `Paused • ${formatBytes(downloaded)} of ${total > 0 ? formatBytes(total) : '--'}`
                  : item.status === 'queued'
                    ? `Queued in ${item.folder}`
                    : item.status === 'failed'
                      ? item.errorMessage ?? 'Download failed'
                      : `${formatBytes(total || downloaded)} • ${item.folder}`}
            </Text>
          </View>

          <View style={styles.rightControls}>
            {item.status === 'downloading' ? (
              <Pressable
                onPress={() => onPause(item.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Pause download"
                style={styles.iconBtn}
              >
                <Ionicons name="pause" size={20} color={colors.accent} />
              </Pressable>
            ) : item.status === 'paused' || item.status === 'queued' ? (
              <Pressable
                onPress={() => onResume(item.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Resume download"
                style={styles.iconBtn}
              >
                <Ionicons name="play" size={20} color={colors.accent} />
              </Pressable>
            ) : item.status === 'failed' ? (
              <Pressable
                onPress={() => onRetry(item.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Retry download"
                style={styles.iconBtn}
              >
                <Ionicons name="refresh" size={20} color={colors.accent} />
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => setShowActions((prev) => !prev)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Toggle item actions"
              style={styles.moreBtn}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={18}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>
        </View>

        {showActions ? (
          <View style={styles.actionsBar}>
            {item.status === 'completed' ? (
              <Pressable
                onPress={() => onShare(item.localUri)}
                style={styles.actionPill}
                accessibilityRole="button"
                accessibilityLabel="Share file"
              >
                <Ionicons name="share-outline" size={16} color={colors.textPrimary} />
                <Text style={styles.actionLabel}>Share</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => onDelete(item.id)}
              style={[styles.actionPill, styles.deletePill]}
              accessibilityRole="button"
              accessibilityLabel="Delete download"
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={styles.deleteLabel}>Delete</Text>
            </Pressable>
          </View>
        ) : null}
      </GlassCard>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  selectedCard: {
    borderColor: colors.accent,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkboxWrap: {
    paddingRight: spacing.xxs,
  },
  statusIconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  failedIconBox: {
    backgroundColor: colors.dangerSurface,
  },
  infoCol: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  iconBtn: {
    width: spacing.touchMin,
    height: spacing.touchMin,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreBtn: {
    width: 36,
    height: spacing.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  actionPill: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
  },
  deletePill: {
    backgroundColor: colors.dangerSurface,
  },
  actionLabel: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  deleteLabel: {
    ...typography.caption,
    color: colors.danger,
  },
});

