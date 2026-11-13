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
  DISCOVER_ARTICLES,
  DISCOVER_CATEGORIES,
  QUICK_APPS,
  resolveSearchOrUrl,
  useBrowserStore,
} from '@/features/browser/store';
import { DiscoverCategory } from '@/features/browser/types';
import { useVpnStore } from '@/features/vpn/store';
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
  const customShortcuts = useBrowserStore((s) => s.customShortcuts);
  const addCustomShortcut = useBrowserStore((s) => s.addCustomShortcut);
  const removeCustomShortcut = useBrowserStore((s) => s.removeCustomShortcut);
  const vpnStatus = useVpnStore((s) => s.status);

  const [quickUrl, setQuickUrl] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [clipboardSuggestion, setClipboardSuggestion] = useState<string | null>(null);
  const [selectedDiscover, setSelectedDiscover] = useState<DiscoverCategory>('For you');
  const [isAddingShortcut, setIsAddingShortcut] = useState(false);
  const [shortcutName, setShortcutName] = useState('');
  const [shortcutUrl, setShortcutUrl] = useState('');

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

  const handleSaveShortcut = () => {
    if (!shortcutUrl.trim()) {
      return;
    }
    triggerHaptic('success');
    addCustomShortcut(shortcutName, shortcutUrl);
    setShortcutName('');
    setShortcutUrl('');
    setIsAddingShortcut(false);
  };

  const allApps = useMemo(
    () => [...QUICK_APPS, ...customShortcuts],
    [customShortcuts]
  );

  const filteredArticles = useMemo(() => {
    if (selectedDiscover === 'For you') {
      return DISCOVER_ARTICLES;
    }
    return DISCOVER_ARTICLES.filter((a) => a.category === selectedDiscover);
  }, [selectedDiscover]);

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
            <Text style={styles.brandSubtitle}>PROXY BROWSER & DOWNLOADER</Text>
            <Text style={styles.title}>rapidex</Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable
              onPress={() => router.push('/(tabs)/vpn')}
              accessibilityRole="button"
              accessibilityLabel="Open VPN settings"
              style={[
                styles.vpnStatusPill,
                vpnStatus === 'connected' && styles.vpnStatusPillActive,
              ]}
            >
              <Ionicons
                name={vpnStatus === 'connected' ? 'shield-checkmark' : 'shield-outline'}
                size={15}
                color={vpnStatus === 'connected' ? colors.success : colors.textSecondary}
              />
              <Text
                style={[
                  styles.vpnStatusText,
                  vpnStatus === 'connected' && styles.vpnStatusTextActive,
                ]}
              >
                {vpnStatus === 'connected' ? 'VPN On' : 'VPN'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => openAddSheet()}
              accessibilityRole="button"
              accessibilityLabel="Open add link sheet"
              style={styles.headerAction}
            >
              <Ionicons name="add" size={24} color={colors.accent} />
            </Pressable>
          </View>
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
          <View style={styles.inputWrap}>
            <Pressable
              onPress={handleBrowseInput}
              style={styles.searchIconBadge}
              accessibilityRole="button"
              accessibilityLabel="Search or go to URL"
            >
              <Ionicons name="search" size={18} color={colors.textOnAccent} />
            </Pressable>
            <TextInput
              value={quickUrl}
              onChangeText={(val) => {
                setQuickUrl(val);
                if (inputError) {
                  setInputError(null);
                }
              }}
              placeholder="Search or Paste URL"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="web-search"
              returnKeyType="go"
              onSubmitEditing={handleBrowseInput}
              style={styles.urlInput}
              accessibilityLabel="Search or Paste URL"
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
            ) : (
              <Pressable
                onPress={handlePasteClipboard}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Paste from clipboard"
              >
                <Ionicons name="clipboard-outline" size={18} color={colors.accent} />
              </Pressable>
            )}
          </View>

          {inputError ? <Text style={styles.errorText}>{inputError}</Text> : null}

          <View style={styles.heroActions}>
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
          <View style={styles.appsGrid}>
            {allApps.map((app) => (
              <Pressable
                key={app.id}
                onPress={() => handleOpenApp(app.url)}
                onLongPress={
                  app.isCustom ? () => removeCustomShortcut(app.id) : undefined
                }
                style={styles.appTile}
                accessibilityRole="button"
                accessibilityLabel={`Open ${app.name} in browser`}
              >
                <View style={[styles.appIconTile, { backgroundColor: app.bgColor }]}>
                  <Ionicons name={app.icon} size={26} color={app.tintColor} />
                </View>
                <Text style={styles.appName} numberOfLines={1}>
                  {app.name}
                </Text>
              </Pressable>
            ))}

            <Pressable
              onPress={() => {
                triggerHaptic('selection');
                setIsAddingShortcut((prev) => !prev);
              }}
              style={styles.appTile}
              accessibilityRole="button"
              accessibilityLabel="Add custom shortcut"
            >
              <View style={[styles.appIconTile, styles.addAppTile]}>
                <Ionicons name="add" size={26} color={colors.textOnAccent} />
              </View>
              <Text style={styles.appName} numberOfLines={1}>
                Add
              </Text>
            </Pressable>
          </View>

          {isAddingShortcut ? (
            <View style={styles.shortcutForm}>
              <TextInput
                value={shortcutName}
                onChangeText={setShortcutName}
                placeholder="Site name (e.g. Wikipedia)"
                placeholderTextColor={colors.textMuted}
                style={styles.shortcutInput}
              />
              <TextInput
                value={shortcutUrl}
                onChangeText={setShortcutUrl}
                placeholder="URL (e.g. wikipedia.org)"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.shortcutInput}
              />
              <View style={styles.shortcutBtns}>
                <Pressable
                  onPress={() => setIsAddingShortcut(false)}
                  style={styles.shortcutCancelBtn}
                >
                  <Text style={styles.shortcutCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveShortcut}
                  style={styles.shortcutSaveBtn}
                >
                  <Text style={styles.shortcutSaveText}>Save Shortcut</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.utilityGrid}>
            <Pressable
              onPress={() => {
                triggerHaptic('selection');
                openBrowserSheet('history');
              }}
              style={styles.appTile}
              accessibilityRole="button"
              accessibilityLabel="Open browsing history"
            >
              <View style={styles.utilityIconTile}>
                <Ionicons name="time-outline" size={24} color={colors.textPrimary} />
              </View>
              <Text style={styles.appName}>History</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                triggerHaptic('selection');
                openBrowserSheet('bookmarks');
              }}
              style={styles.appTile}
              accessibilityRole="button"
              accessibilityLabel="Open bookmarks"
            >
              <View style={styles.utilityIconTile}>
                <Ionicons name="bookmarks-outline" size={22} color={colors.textPrimary} />
              </View>
              <Text style={styles.appName}>Bookmarks</Text>
            </Pressable>
          </View>
        </GlassCard>

        <GlassCard contentStyle={styles.discoverCard}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.discoverTabs}
          >
            {DISCOVER_CATEGORIES.map((category) => {
              const isSelected = selectedDiscover === category;
              return (
                <Pressable
                  key={category}
                  onPress={() => {
                    triggerHaptic('selection');
                    setSelectedDiscover(category);
                  }}
                  style={[
                    styles.discoverTab,
                    isSelected && styles.discoverTabActive,
                  ]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text
                    style={[
                      styles.discoverTabText,
                      isSelected && styles.discoverTabTextActive,
                    ]}
                  >
                    {category}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {filteredArticles.map((article) => (
            <Pressable
              key={article.id}
              onPress={() => handleOpenApp(article.url)}
              style={styles.articleRow}
              accessibilityRole="button"
              accessibilityLabel={`Read ${article.title}`}
            >
              <View style={styles.articleIconWrap}>
                <Ionicons name={article.icon} size={22} color={colors.accent} />
              </View>
              <View style={styles.articleBody}>
                <Text style={styles.articleTitle} numberOfLines={2}>
                  {article.title}
                </Text>
                <Text style={styles.articleSource}>
                  {article.source} • {article.category}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
          ))}
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  vpnStatusPill: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.glassBackgroundStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  vpnStatusPillActive: {
    backgroundColor: colors.successSurface,
    borderColor: colors.success,
  },
  vpnStatusText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  vpnStatusTextActive: {
    color: colors.success,
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
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: 6,
    paddingRight: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  searchIconBadge: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
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
    padding: spacing.md,
    gap: spacing.md,
  },
  appsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.md,
  },
  appTile: {
    width: '25%',
    minHeight: spacing.touchMin,
    alignItems: 'center',
    gap: 6,
  },
  appIconTile: {
    width: 54,
    height: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 3,
  },
  addAppTile: {
    backgroundColor: colors.accent,
  },
  utilityGrid: {
    flexDirection: 'row',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  utilityIconTile: {
    width: 54,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    ...typography.small,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  shortcutForm: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  shortcutInput: {
    minHeight: 40,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...typography.caption,
    color: colors.textPrimary,
  },
  shortcutBtns: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    marginTop: 4,
  },
  shortcutCancelBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  shortcutCancelText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  shortcutSaveBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  shortcutSaveText: {
    ...typography.caption,
    color: colors.textOnAccent,
    fontWeight: '700',
  },
  discoverCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  discoverTabs: {
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  discoverTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
  },
  discoverTabActive: {
    backgroundColor: colors.accentSurface,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  discoverTabText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  discoverTabTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  articleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  articleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  articleBody: {
    flex: 1,
    gap: 2,
  },
  articleTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  articleSource: {
    ...typography.small,
    color: colors.textSecondary,
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
