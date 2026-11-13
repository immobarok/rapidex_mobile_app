import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  isPictureInPictureSupported,
  useVideoPlayer,
  VideoContentFit,
  VideoView,
} from 'expo-video';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '@/components/EmptyState';
import { useDownloadsStore } from '@/features/downloads/store';
import { formatDuration } from '@/lib/formatDuration';
import { triggerHaptic } from '@/lib/haptics';
import { colors, radius, spacing, typography } from '@/theme';
import { usePlayerPosition } from '../hooks/usePlayerPosition';
import {
  PLAYBACK_SPEEDS,
  PlaybackSpeedOption,
  SLEEP_TIMER_OPTIONS,
  SleepTimerMinutes,
} from '../types';

type Props = {
  id: string;
};

export function PlayerScreen({ id }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const videoViewRef = useRef<VideoView | null>(null);
  const lastTapLeftRef = useRef(0);
  const lastTapRightRef = useRef(0);

  const items = useDownloadsStore((s) => s.items);
  const item = useMemo(() => items.find((i) => i.id === id), [id, items]);

  const mediaPlaylist = useMemo(
    () =>
      items.filter(
        (i) =>
          i.status === 'completed' &&
          (i.category === 'video' || i.category === 'audio')
      ),
    [items]
  );

  const currentIndex = useMemo(
    () => mediaPlaylist.findIndex((i) => i.id === id),
    [id, mediaPlaylist]
  );

  const prevItem =
    currentIndex > 0 ? mediaPlaylist[currentIndex - 1] : undefined;
  const nextItem =
    currentIndex >= 0 && currentIndex < mediaPlaylist.length - 1
      ? mediaPlaylist[currentIndex + 1]
      : undefined;

  const [speed, setSpeed] = useState<PlaybackSpeedOption>(1);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [contentFit, setContentFit] = useState<VideoContentFit>('contain');
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [sleepMinutes, setSleepMinutes] = useState<SleepTimerMinutes>(0);
  const [seekFeedback, setSeekFeedback] = useState<string | null>(null);
  const [scrubberWidth, setScrubberWidth] = useState(1);

  const player = useVideoPlayer(item?.localUri ?? null, (instance) => {
    instance.loop = false;
    instance.staysActiveInBackground = true;
    instance.showNowPlayingNotification = true;
    instance.timeUpdateEventInterval = 0.5;
    instance.play();
  });

  const {
    currentTimeSec,
    durationSec,
    isPlaying,
    handleSeekToRatio,
    handleSkipBySeconds,
    handleTogglePlayPause,
  } = usePlayerPosition(id, player, item?.lastPlaybackPositionMs ?? 0);

  // Auto-hide controls while playing video
  useEffect(() => {
    if (!controlsVisible || !isPlaying || isLocked || item?.category === 'audio') {
      return;
    }
    const timer = setTimeout(() => {
      setControlsVisible(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [controlsVisible, isLocked, isPlaying, item?.category]);

  // Sleep timer countdown
  useEffect(() => {
    if (sleepMinutes === 0 || !player) {
      return;
    }
    const timer = setTimeout(() => {
      player.pause();
      setSleepMinutes(0);
    }, sleepMinutes * 60 * 1000);
    return () => clearTimeout(timer);
  }, [player, sleepMinutes]);

  const showTemporarySeekFeedback = useCallback((label: string) => {
    setSeekFeedback(label);
    setTimeout(() => {
      setSeekFeedback((prev) => (prev === label ? null : prev));
    }, 700);
  }, []);

  if (!item) {
    return (
      <View style={[styles.emptyRoot, { paddingTop: insets.top + spacing.xl }]}>
        <EmptyState
          icon="alert-circle-outline"
          title="Media Not Found"
          description="This file was moved or deleted from your library."
          actionLabel="Go Back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const canUsePip = Platform.OS !== 'web' && isPictureInPictureSupported();
  const hasSubtitleTracks = (player?.availableSubtitleTracks?.length ?? 0) > 0;
  const progressRatio =
    durationSec > 0 ? Math.min(1, currentTimeSec / durationSec) : 0;

  const handleCycleSpeed = () => {
    triggerHaptic('selection');
    const currentIdx = PLAYBACK_SPEEDS.indexOf(speed);
    const nextSpeed =
      PLAYBACK_SPEEDS[(currentIdx + 1) % PLAYBACK_SPEEDS.length] ?? 1;
    setSpeed(nextSpeed);
    if (player) {
      player.playbackRate = nextSpeed;
    }
  };

  const handleCycleSleepTimer = () => {
    triggerHaptic('selection');
    const idx = SLEEP_TIMER_OPTIONS.indexOf(sleepMinutes);
    const next = SLEEP_TIMER_OPTIONS[(idx + 1) % SLEEP_TIMER_OPTIONS.length] ?? 0;
    setSleepMinutes(next);
  };

  const handleToggleSubtitles = () => {
    if (!player || player.availableSubtitleTracks.length === 0) {
      return;
    }
    const nextState = !subtitlesEnabled;
    setSubtitlesEnabled(nextState);
    player.subtitleTrack = nextState
      ? (player.availableSubtitleTracks[0] ?? null)
      : null;
  };

  const handleStartPip = () => {
    triggerHaptic('light');
    videoViewRef.current?.startPictureInPicture().catch(() => undefined);
  };

  const handleScrubberLayout = (e: LayoutChangeEvent) => {
    setScrubberWidth(Math.max(1, e.nativeEvent.layout.width));
  };

  const handleTapZone = (side: 'left' | 'right') => {
    if (isLocked) {
      return;
    }
    const now = Date.now();
    const ref = side === 'left' ? lastTapLeftRef : lastTapRightRef;
    if (now - ref.current < 280) {
      const delta = side === 'left' ? -10 : 10;
      handleSkipBySeconds(delta);
      triggerHaptic('light');
      showTemporarySeekFeedback(delta < 0 ? '-10s' : '+10s');
      ref.current = 0;
    } else {
      ref.current = now;
      setControlsVisible((prev) => !prev);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.stage}>
        {item.category === 'audio' ? (
          <View style={styles.audioArtworkCard}>
            <View style={styles.audioCircle}>
              <Ionicons name="musical-notes" size={64} color={colors.accent} />
            </View>
            <Text style={styles.audioTitle} numberOfLines={2}>
              {item.fileName}
            </Text>
            <Text style={styles.audioSubtitle}>
              {sleepMinutes > 0
                ? `Sleep timer: ${sleepMinutes}m`
                : 'Background Audio Enabled'}
            </Text>
          </View>
        ) : null}

        <VideoView
          ref={videoViewRef}
          player={player}
          style={item.category === 'audio' ? styles.hiddenVideo : styles.videoSurface}
          nativeControls={false}
          contentFit={contentFit}
          allowsPictureInPicture
          startsPictureInPictureAutomatically
        />

        {item.category !== 'audio' ? (
          <View style={styles.tapZonesOverlay} pointerEvents="box-none">
            <Pressable
              style={styles.tapZone}
              onPress={() => handleTapZone('left')}
              accessibilityLabel="Double tap to rewind 10 seconds"
            />
            <Pressable
              style={styles.tapZone}
              onPress={() => handleTapZone('right')}
              accessibilityLabel="Double tap to forward 10 seconds"
            />
          </View>
        ) : null}

        {seekFeedback ? (
          <View style={styles.seekFeedbackPill}>
            <Text style={styles.seekFeedbackText}>{seekFeedback}</Text>
          </View>
        ) : null}
      </View>

      {isLocked ? (
        <View
          style={[
            styles.lockedBar,
            { top: insets.top + spacing.sm },
          ]}
        >
          <Pressable
            onPress={() => {
              triggerHaptic('selection');
              setIsLocked(false);
              setControlsVisible(true);
            }}
            style={styles.unlockPill}
            accessibilityRole="button"
            accessibilityLabel="Unlock player controls"
          >
            <Ionicons name="lock-closed" size={16} color={colors.accent} />
            <Text style={styles.unlockText}>Tap to Unlock</Text>
          </Pressable>
        </View>
      ) : null}

      {controlsVisible && !isLocked ? (
        <View
          style={[
            styles.topGlassBar,
            { top: insets.top + spacing.xs },
          ]}
        >
          {Platform.OS !== 'web' ? (
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          ) : null}
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close player"
            style={styles.roundBtn}
          >
            <Ionicons name="chevron-down" size={24} color={colors.textOnAccent} />
          </Pressable>

          <View style={styles.titleWrap}>
            <Text style={styles.fileTitle} numberOfLines={1}>
              {item.fileName}
            </Text>
            <Text style={styles.fileSubtitle}>
              {item.category === 'audio'
                ? 'Audio Player'
                : `${contentFit === 'contain' ? 'Fit' : 'Fill'} • Local HD`}
            </Text>
          </View>

          {item.category !== 'audio' ? (
            <Pressable
              onPress={() =>
                setContentFit((prev) => (prev === 'contain' ? 'cover' : 'contain'))
              }
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Toggle video aspect fit"
              style={styles.roundBtn}
            >
              <Ionicons
                name={contentFit === 'contain' ? 'expand-outline' : 'contract-outline'}
                size={20}
                color={colors.textOnAccent}
              />
            </Pressable>
          ) : null}

          <Pressable
            onPress={handleCycleSleepTimer}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Cycle sleep timer"
            style={styles.roundBtn}
          >
            <Ionicons
              name={sleepMinutes > 0 ? 'moon' : 'moon-outline'}
              size={19}
              color={sleepMinutes > 0 ? colors.accent : colors.textOnAccent}
            />
          </Pressable>

          <Pressable
            onPress={() => {
              triggerHaptic('selection');
              setIsLocked(true);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Lock player controls"
            style={styles.roundBtn}
          >
            <Ionicons name="lock-open-outline" size={19} color={colors.textOnAccent} />
          </Pressable>

          {canUsePip ? (
            <Pressable
              onPress={handleStartPip}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Enter Picture in Picture"
              style={styles.roundBtn}
            >
              <Ionicons name="albums-outline" size={20} color={colors.textOnAccent} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {(controlsVisible || item.category === 'audio') && !isLocked ? (
        <View
          style={[
            styles.bottomGlassControls,
            { bottom: Math.max(insets.bottom, spacing.md) },
          ]}
        >
          {Platform.OS !== 'web' ? (
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
          ) : null}

          <Pressable
            onLayout={handleScrubberLayout}
            onPress={(e) => {
              const tapX = e.nativeEvent.locationX;
              handleSeekToRatio(tapX / scrubberWidth);
            }}
            accessibilityRole="adjustable"
            accessibilityLabel="Playback timeline scrubber"
            style={styles.scrubberHitArea}
          >
            <View style={styles.scrubberTrack}>
              <View
                style={[
                  styles.scrubberFill,
                  { width: `${Math.round(progressRatio * 100)}%` },
                ]}
              />
            </View>
          </Pressable>

          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatDuration(currentTimeSec)}</Text>
            {sleepMinutes > 0 ? (
              <Text style={styles.sleepBadge}>Sleep {sleepMinutes}m</Text>
            ) : null}
            <Text style={styles.timeText}>{formatDuration(durationSec)}</Text>
          </View>

          <View style={styles.transportRow}>
            <Pressable
              onPress={handleCycleSpeed}
              accessibilityRole="button"
              accessibilityLabel={`Playback speed ${speed}x`}
              style={styles.pillBtn}
            >
              <Text style={styles.pillText}>{speed}x</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                if (prevItem) {
                  router.replace(`/player/${prevItem.id}`);
                } else {
                  handleSkipBySeconds(-10);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={prevItem ? 'Previous media' : 'Rewind 10 seconds'}
              style={styles.roundBtn}
            >
              <Ionicons
                name={prevItem ? 'play-skip-back' : 'play-back'}
                size={22}
                color={colors.textOnAccent}
              />
            </Pressable>

            <Pressable
              onPress={() => {
                triggerHaptic('light');
                handleTogglePlayPause();
              }}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
              style={styles.playMainBtn}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={28}
                color={colors.textOnAccent}
              />
            </Pressable>

            <Pressable
              onPress={() => {
                if (nextItem) {
                  router.replace(`/player/${nextItem.id}`);
                } else {
                  handleSkipBySeconds(10);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={nextItem ? 'Next media' : 'Forward 10 seconds'}
              style={styles.roundBtn}
            >
              <Ionicons
                name={nextItem ? 'play-skip-forward' : 'play-forward'}
                size={22}
                color={colors.textOnAccent}
              />
            </Pressable>

            <Pressable
              onPress={handleToggleSubtitles}
              disabled={!hasSubtitleTracks}
              accessibilityRole="button"
              accessibilityLabel="Toggle subtitles"
              style={[styles.pillBtn, !hasSubtitleTracks && styles.disabledBtn]}
            >
              <Ionicons
                name={
                  subtitlesEnabled
                    ? 'chatbox-ellipses'
                    : 'chatbox-ellipses-outline'
                }
                size={18}
                color={subtitlesEnabled ? colors.accent : colors.textOnAccent}
              />
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.playerBackground,
  },
  emptyRoot: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoSurface: {
    width: '100%',
    height: '100%',
  },
  hiddenVideo: {
    width: 1,
    height: 1,
    opacity: 0,
  },
  tapZonesOverlay: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
  },
  tapZone: {
    flex: 1,
  },
  seekFeedbackPill: {
    position: 'absolute',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.playerGlass,
    borderWidth: 1,
    borderColor: colors.playerGlassBorder,
  },
  seekFeedbackText: {
    ...typography.title,
    color: colors.textOnAccent,
  },
  lockedBar: {
    position: 'absolute',
    alignSelf: 'center',
  },
  unlockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.playerGlass,
    borderWidth: 1,
    borderColor: colors.playerGlassBorder,
  },
  unlockText: {
    ...typography.caption,
    color: colors.textOnAccent,
    fontWeight: '700',
  },
  topGlassBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.xl,
    backgroundColor: colors.playerGlass,
    borderWidth: 1,
    borderColor: colors.playerGlassBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    overflow: 'hidden',
  },
  titleWrap: {
    flex: 1,
    paddingHorizontal: spacing.xs,
  },
  fileTitle: {
    ...typography.bodyStrong,
    color: colors.textOnAccent,
  },
  fileSubtitle: {
    ...typography.small,
    color: colors.textMuted,
  },
  audioArtworkCard: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  audioCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.accentSurface,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioTitle: {
    ...typography.title,
    color: colors.textOnAccent,
    textAlign: 'center',
  },
  audioSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  bottomGlassControls: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.playerGlass,
    borderWidth: 1,
    borderColor: colors.playerGlassBorder,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  scrubberHitArea: {
    minHeight: 32,
    justifyContent: 'center',
  },
  scrubberTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.playerGlassBorder,
    overflow: 'hidden',
  },
  scrubberFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    ...typography.small,
    color: colors.textOnAccent,
  },
  sleepBadge: {
    ...typography.small,
    color: colors.accent,
  },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  roundBtn: {
    width: spacing.touchMin,
    height: spacing.touchMin,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playMainBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
  pillBtn: {
    minWidth: spacing.touchMin,
    height: spacing.touchMin,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.playerGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    ...typography.caption,
    color: colors.textOnAccent,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.4,
  },
});
