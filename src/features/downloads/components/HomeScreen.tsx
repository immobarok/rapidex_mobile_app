import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BackgroundBlobs } from '@/components/BackgroundBlobs';
import { EmptyState } from '@/components/EmptyState';
import { GlassCard } from '@/components/GlassCard';
import { OrangeButton } from '@/components/OrangeButton';
import { SkeletonList } from '@/components/Skeleton';
import { formatBytes } from '@/lib/formatBytes';
import { formatSpeed } from '@/lib/formatSpeed';
import { triggerHaptic } from '@/lib/haptics';
import { validateDirectUrl } from '@/lib/validateUrl';
import { colors, radius, spacing, typography } from '@/theme';
import { DownloadItemRecord } from '@/types';
import { useAggregateDownloadStats } from '../hooks/useAggregateDownloadStats';
import { useDownloads } from '../hooks/useDownloads';
import {
  QUICK_APPS,
  resolveSearchOrUrl,
  useBrowserStore,
} from '@/features/browser/store';
import { DownloadCard } from './DownloadCard';

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    items,
    isHydrated,
    errorBanner,
    openAddSheet,
    setErrorBanner,
    handlePause,
    handleResume,
    handleRetry,
    handleDelete,
    handleCopyUrl,
    handleShareFile,
  } = useDownloads();

  const stats = useAggregateDownloadStats();
  const openBrowserSheet = useBrowserStore((s) => s.openBrowserSheet);
  const [quickUrl, setQuickUrl] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [clipboardSuggestion, setClipboardSuggestion] = useState<string | null>(null);

  const checkClipboardForDirectUrl = useCallback(async () => {
    try {
      const hasString = await Clipboard.hasStringAsync();
      if (!hasString) {
        return;
      }
      const text = (await Clipboard.getStringAsync()).trim();
      const validation = validateDirectUrl(text);
      if (validation.isValid) {
        setClipboardSuggestion(validation.normalizedUrl);
      }
    } catch {
      // Ignore clipboard permission errors
    }
  }, []);

  useEffect(() => {
    checkClipboardForDirectUrl();
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkClipboardForDirectUrl();
      }
    });
    return () => sub.remove();
  }, [checkClipboardForDirectUrl]);

  const activeItems = useMemo(
    () =>
      items.filter(
        (i) =>
          i.status === 'downloading' ||
          i.status === 'paused' ||
          i.status === 'queued'
      ),
    [items]
  );

  const recentCompleted = useMemo(
    () => items.filter((i) => i.status === 'completed').slice(0, 5),
    [items]
  );

  const handlePasteClipboard = async () => {
    triggerHaptic('selection');
    try {
      const text = await Clipboard.getStringAsync();
      if (!text.trim()) {
        setInputError('Clipboard is empty. Copy a direct file link first.');
        return;
      }
      setQuickUrl(text.trim());
      setInputError(null);
    } catch {
      setInputError('Unable to read clipboard.');
    }
  };

  const handlePressDownload = () => {
    const check = validateDirectUrl(quickUrl);
    if (!check.isValid) {
      setInputError(check.errorMessage);
      return;
    }
    setInputError(null);
    openAddSheet(check.normalizedUrl);
    setQuickUrl('');
  };

  const handleBrowseInput = () => {
    const trimmed = quickUrl.trim();
    if (!trimmed) {
      setInputError('Enter a search query or website URL.');
      return;
    }
    triggerHaptic('selection');
    setInputError(null);
    const targetUrl = resolveSearchOrUrl(trimmed);
    setQuickUrl('');
    router.push({ pathname: '/browser', params: { url: targetUrl } });
  };

  const handleOpenApp = (url: string) => {
    triggerHaptic('selection');
    router.push({ pathname: '/browser', params: { url } });
  };

  const handleOpenItem = (item: DownloadItemRecord) => {
    if (item.category === 'video' || item.category === 'audio') {
      router.push(`/player/${item.id}`);
    } else {
      handleShareFile(item.localUri);
    }
  };

  return (
    <BackgroundBlobs>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + spacing.tabBarHeight + spacing.xxl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.brandSubtitle}>FAST DIRECT DOWNLOADER</Text>
            <Text style={styles.title}>rapidex</Text>
          </View>
          <Pressable
            onPress={() => openAddSheet()}
            accessibilityRole="button"
            accessibilityLabel="Open add link sheet"
            style={styles.headerAction}
          >
            <Ionicons name="link-outline" size={22} color={colors.accent} />
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <GlassCard style={styles.statCard} contentStyle={styles.statContent}>
            <Text style={styles.statLabel}>SPEED</Text>
            <Text style={styles.statValue} numberOfLines={1}>
              {stats.downloadingCount > 0
                ? formatSpeed(stats.totalSpeedBytesPerSec)
                : 'Idle'}
            </Text>
          </GlassCard>
          <GlassCard style={styles.statCard} contentStyle={styles.statContent}>
            <Text style={styles.statLabel}>ACTIVE</Text>
            <Text style={styles.statValue}>{stats.activeCount}</Text>
          </GlassCard>
          <GlassCard style={styles.statCard} contentStyle={styles.statContent}>
            <Text style={styles.statLabel}>SAVED</Text>
            <Text style={styles.statValue} numberOfLines={1}>
              {formatBytes(stats.totalSavedBytes)}
            </Text>
          </GlassCard>
        </View>

        {clipboardSuggestion ? (
          <GlassCard contentStyle={styles.clipboardBanner}>
            <View style={styles.clipboardIconWrap}>
              <Ionicons name="sparkles-outline" size={18} color={colors.accent} />
            </View>
            <View style={styles.clipboardTextCol}>
              <Text style={styles.clipboardTitle}>Link detected in clipboard</Text>
              <Text style={styles.clipboardUrl} numberOfLines={1}>
                {clipboardSuggestion}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                triggerHaptic('light');
                const url = clipboardSuggestion;
                setClipboardSuggestion(null);
                openAddSheet(url);
              }}
              style={styles.clipboardActionPill}
              accessibilityRole="button"
              accessibilityLabel="Queue detected clipboard link"
            >
              <Text style={styles.clipboardActionText}>Add</Text>
            </Pressable>
            <Pressable
              onPress={() => setClipboardSuggestion(null)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Dismiss clipboard link"
            >
              <Ionicons name="close" size={16} color={colors.textSecondary} />
            </Pressable>
          </GlassCard>
        ) : null}

        {errorBanner ? (
          <Pressable
            onPress={() => setErrorBanner(null)}
            style={styles.banner}
            accessibilityRole="alert"
          >
            <Ionicons name="warning-outline" size={18} color={colors.danger} />
            <Text style={styles.bannerText}>{errorBanner}</Text>
            <Ionicons name="close" size={16} color={colors.textSecondary} />
          </Pressable>
        ) : null}

        <GlassCard enableBlur intensity={42} contentStyle={styles.heroCard}>
          <Text style={styles.cardHeading}>Search, Browse or Paste Direct Link</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
            <TextInput
              value={quickUrl}
              onChangeText={(val) => {
                setQuickUrl(val);
                if (inputError) {
                  setInputError(null);
                }
              }}
              placeholder="Search Google or enter URL..."
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="web-search"
              returnKeyType="go"
              onSubmitEditing={handleBrowseInput}
              style={styles.urlInput}
              accessibilityLabel="Search Google or enter URL"
            />
            {quickUrl.length > 0 ? (
              <Pressable
                onPress={() => setQuickUrl('')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear URL input"
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {inputError ? <Text style={styles.errorText}>{inputError}</Text> : null}

          <View style={styles.heroActions}>
            <OrangeButton
              label="Paste"
              variant="secondary"
              onPress={handlePasteClipboard}
              icon={<Ionicons name="clipboard-outline" size={18} color={colors.accent} />}
              style={styles.pasteBtn}
            />
            <OrangeButton
              label="Browse"
              variant="secondary"
              onPress={handleBrowseInput}
              icon={<Ionicons name="compass-outline" size={18} color={colors.accent} />}
              style={styles.pasteBtn}
            />
            <OrangeButton
              label="Download"
              onPress={handlePressDownload}
              icon={
                <Ionicons
                  name="arrow-down-circle-outline"
                  size={18}
                  color={colors.textOnAccent}
                />
              }
              style={styles.downloadBtn}
            />
          </View>
        </GlassCard>

        <GlassCard contentStyle={styles.appsCard}>
          <View style={styles.appsHeader}>
            <Text style={styles.cardHeading}>Quick Apps</Text>
            <View style={styles.browserPills}>
              <Pressable
                onPress={() => {
                  triggerHaptic('selection');
                  openBrowserSheet('history');
                }}
                style={styles.browserPill}
                accessibilityRole="button"
                accessibilityLabel="Open browsing history"
              >
                <Ionicons name="time-outline" size={15} color={colors.accent} />
                <Text style={styles.browserPillText}>History</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  triggerHaptic('selection');
                  openBrowserSheet('bookmarks');
                }}
                style={styles.browserPill}
                accessibilityRole="button"
                accessibilityLabel="Open bookmarks"
              >
                <Ionicons name="bookmark-outline" size={15} color={colors.accent} />
                <Text style={styles.browserPillText}>Bookmarks</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.appsGrid}>
            {QUICK_APPS.map((app) => (
              <Pressable
                key={app.id}
                onPress={() => handleOpenApp(app.url)}
                style={styles.appTile}
                accessibilityRole="button"
                accessibilityLabel={`Open ${app.name} in browser`}
              >
                <View style={styles.appIconCircle}>
                  <Ionicons name={app.icon} size={24} color={app.tintColor} />
                </View>
                <Text style={styles.appName} numberOfLines={1}>
                  {app.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </GlassCard>

        {!isHydrated ? (
          <SkeletonList count={3} />
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Transfers</Text>
              <Text style={styles.sectionCount}>{activeItems.length}</Text>
            </View>

            {activeItems.length === 0 ? (
              <EmptyState
                icon="cloud-download-outline"
                title="No Active Downloads"
                description="Paste a direct file URL above or tap + to start saving videos, audio, or documents."
              />
            ) : (
              activeItems.map((item) => (
                <DownloadCard
                  key={item.id}
                  item={item}
                  onPause={handlePause}
                  onResume={handleResume}
                  onRetry={handleRetry}
                  onDelete={handleDelete}
                  onCopyUrl={handleCopyUrl}
                  onShare={handleShareFile}
                  onOpenItem={handleOpenItem}
                />
              ))
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Files</Text>
              {recentCompleted.length > 0 ? (
                <Pressable
                  onPress={() => router.push('/(tabs)/library')}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="See all files in library"
                >
                  <Text style={styles.seeAllText}>See All</Text>
                </Pressable>
              ) : null}
            </View>

            {recentCompleted.length === 0 ? (
              <EmptyState
                icon="folder-open-outline"
                title="No Recent Files Yet"
                description="Completed downloads will appear here for instant offline playback."
              />
            ) : (
              recentCompleted.map((item) => (
                <DownloadCard
                  key={item.id}
                  item={item}
                  onPause={handlePause}
                  onResume={handleResume}
                  onRetry={handleRetry}
                  onDelete={handleDelete}
                  onCopyUrl={handleCopyUrl}
                  onShare={handleShareFile}
                  onOpenItem={handleOpenItem}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </BackgroundBlobs>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandSubtitle: {
    ...typography.small,
    color: colors.accent,
  },
  title: {
    ...typography.hero,
    color: colors.textPrimary,
  },
  headerAction: {
    width: spacing.touchMin,
    height: spacing.touchMin,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statCard: {
    flex: 1,
  },
  statContent: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  statLabel: {
    ...typography.small,
    color: colors.textSecondary,
  },
  statValue: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  clipboardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  clipboardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipboardTextCol: {
    flex: 1,
    gap: 1,
  },
  clipboardTitle: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  clipboardUrl: {
    ...typography.small,
    color: colors.textSecondary,
  },
  clipboardActionPill: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipboardActionText: {
    ...typography.caption,
    color: colors.textOnAccent,
    fontWeight: '700',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  bannerText: {
    ...typography.caption,
    color: colors.danger,
    flex: 1,
  },
  heroCard: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHeading: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  inputWrap: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  urlInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: spacing.xs,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
  heroActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pasteBtn: {
    flex: 1,
  },
  downloadBtn: {
    flex: 1.4,
  },
  appsCard: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  appsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  browserPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  browserPill: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSurface,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  browserPillText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  appsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  appTile: {
    flex: 1,
    minHeight: spacing.touchMin,
    alignItems: 'center',
    gap: spacing.xs,
  },
  appIconCircle: {
    width: 50,
    height: 50,
    borderRadius: radius.lg,
    backgroundColor: colors.glassBackgroundStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    ...typography.small,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  sectionCount: {
    ...typography.caption,
    color: colors.accent,
    backgroundColor: colors.accentSurface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  seeAllText: {
    ...typography.bodyStrong,
    color: colors.accent,
  },
});
