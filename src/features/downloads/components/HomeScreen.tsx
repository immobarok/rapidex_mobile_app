import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
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
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BackgroundBlobs } from '@/components/BackgroundBlobs';
import { EmptyState } from '@/components/EmptyState';
import { GlassCard } from '@/components/GlassCard';
import { SkeletonList } from '@/components/Skeleton';
import { triggerHaptic } from '@/lib/haptics';
import { validateDirectUrl } from '@/lib/validateUrl';
import { colors, radius, spacing, typography } from '@/theme';
import { DownloadItemRecord } from '@/types';
import { useDownloads } from '../hooks/useDownloads';
import {
  DISCOVER_ARTICLES,
  DISCOVER_CATEGORIES,
  QUICK_APPS,
  resolveSearchOrUrl,
  useBrowserStore,
} from '@/features/browser/store';
import { fetchLiveDiscoverNews } from '@/features/browser/services/newsService';
import { DiscoverArticle, DiscoverCategory } from '@/features/browser/types';
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

  const openBrowserSheet = useBrowserStore((s) => s.openBrowserSheet);
  const customShortcuts = useBrowserStore((s) => s.customShortcuts);
  const addCustomShortcut = useBrowserStore((s) => s.addCustomShortcut);
  const removeCustomShortcut = useBrowserStore((s) => s.removeCustomShortcut);
  const vpnStatus = useVpnStore((s) => s.status);

  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [quickUrl, setQuickUrl] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [clipboardSuggestion, setClipboardSuggestion] = useState<string | null>(null);
  const [selectedDiscover, setSelectedDiscover] = useState<DiscoverCategory>('For you');
  const [liveArticles, setLiveArticles] = useState<DiscoverArticle[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(true);
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

  const handleVoiceSearch = () => {
    triggerHaptic('selection');
    setInputError(null);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      type WebSpeechEvent = {
        results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
      };
      type WebSpeechRecognition = {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onresult: ((event: WebSpeechEvent) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
      };
      type SpeechCtor = new () => WebSpeechRecognition;
      const win = window as unknown as {
        SpeechRecognition?: SpeechCtor;
        webkitSpeechRecognition?: SpeechCtor;
      };
      const Recognition = win.SpeechRecognition ?? win.webkitSpeechRecognition;

      if (Recognition) {
        const recognition = new Recognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        setIsListening(true);
        setVoiceHint('Listening... Speak your search query');

        recognition.onresult = (event) => {
          const transcript = event.results?.[0]?.[0]?.transcript?.trim() ?? '';
          setIsListening(false);
          setVoiceHint(null);
          if (transcript) {
            setQuickUrl(transcript);
            const targetUrl = resolveSearchOrUrl(transcript);
            router.push({ pathname: '/browser', params: { url: targetUrl } });
          }
        };
        recognition.onerror = () => {
          setIsListening(false);
          setVoiceHint('Could not hear clearly. Try typing or speaking again.');
        };
        recognition.onend = () => {
          setIsListening(false);
        };
        recognition.start();
        return;
      }
    }

    inputRef.current?.focus();
    setVoiceHint('Tap the microphone on your keyboard to speak a search.');
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

  const loadNews = useCallback(
    async (category: DiscoverCategory, forceRefresh = false) => {
      setIsLoadingNews(true);
      try {
        const fetched = await fetchLiveDiscoverNews(category, forceRefresh);
        if (fetched.length > 0) {
          setLiveArticles(fetched);
        } else {
          setLiveArticles(
            category === 'For you'
              ? DISCOVER_ARTICLES
              : DISCOVER_ARTICLES.filter((a) => a.category === category)
          );
        }
      } catch {
        setLiveArticles(
          category === 'For you'
            ? DISCOVER_ARTICLES
            : DISCOVER_ARTICLES.filter((a) => a.category === category)
        );
      } finally {
        setIsLoadingNews(false);
      }
    },
    []
  );

  useEffect(() => {
    loadNews(selectedDiscover);
  }, [loadNews, selectedDiscover]);

  const filteredArticles = liveArticles;

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
              ref={inputRef}
              value={quickUrl}
              onChangeText={(val) => {
                setQuickUrl(val);
                if (inputError) {
                  setInputError(null);
                }
                if (voiceHint) {
                  setVoiceHint(null);
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
            ) : null}
            <Pressable
              onPress={handleVoiceSearch}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Voice search"
              style={styles.micButton}
            >
              <Ionicons
                name={isListening ? 'mic' : 'mic-outline'}
                size={20}
                color={isListening ? colors.accent : colors.textSecondary}
              />
            </Pressable>
          </View>

          {voiceHint ? <Text style={styles.voiceHintText}>{voiceHint}</Text> : null}
          {inputError ? <Text style={styles.errorText}>{inputError}</Text> : null}
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
          <View style={styles.discoverHeaderRow}>
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

            <Pressable
              onPress={() => {
                triggerHaptic('selection');
                loadNews(selectedDiscover, true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Refresh live news feed"
              style={styles.refreshNewsBtn}
            >
              <Ionicons name="refresh" size={16} color={colors.accent} />
            </Pressable>
          </View>

          {isLoadingNews && filteredArticles.length === 0 ? (
            <View style={styles.newsLoadingBox}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.newsLoadingText}>Loading live stories...</Text>
            </View>
          ) : (
            filteredArticles.map((article) => (
              <Pressable
                key={article.id}
                onPress={() => handleOpenApp(article.url)}
                style={styles.articleCard}
                accessibilityRole="button"
                accessibilityLabel={`Read ${article.title}`}
              >
                <Image
                  source={{ uri: article.imageUrl }}
                  style={styles.articleImage}
                  contentFit="cover"
                  transition={200}
                />
                <View style={styles.articleFooter}>
                  <View style={styles.articleBody}>
                    <Text style={styles.articleTitle} numberOfLines={2}>
                      {article.title}
                    </Text>
                    <Text style={styles.articleSource}>
                      {article.source} • {article.category}
                    </Text>
                  </View>
                  <Ionicons
                    name="ellipsis-vertical"
                    size={18}
                    color={colors.textSecondary}
                  />
                </View>
              </Pressable>
            ))
          )}
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
    padding: spacing.sm,
    gap: spacing.xs,
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
  micButton: {
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceHintText: {
    ...typography.caption,
    color: colors.accent,
    paddingHorizontal: spacing.xs,
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
  discoverHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  refreshNewsBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newsLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  newsLoadingText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  discoverTabs: {
    gap: spacing.xs,
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
  articleCard: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  articleImage: {
    width: '100%',
    height: 170,
    borderRadius: radius.md,
    backgroundColor: colors.skeletonBase,
  },
  articleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
