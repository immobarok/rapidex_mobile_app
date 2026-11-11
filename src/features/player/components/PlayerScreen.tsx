import React, { useRef, useState } from 'react';
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
  VideoView,
} from 'expo-video';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '@/components/EmptyState';
import { useDownloadsStore } from '@/features/downloads/store';
import { formatDuration } from '@/lib/formatDuration';
import { colors, radius, spacing, typography } from '@/theme';
import { usePlayerPosition } from '../hooks/usePlayerPosition';
import { PLAYBACK_SPEEDS, PlaybackSpeedOption } from '../types';

type Props = {
  id: string;
};

export function PlayerScreen({ id }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const videoViewRef = useRef<VideoView | null>(null);

  const item = useDownloadsStore((s) => s.items.find((i) => i.id === id));
  const [speed, setSpeed] = useState<PlaybackSpeedOption>(1);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
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
  const progressRatio = durationSec > 0 ? Math.min(1, currentTimeSec / durationSec) : 0;

  const handleCycleSpeed = () => {
    Haptics.selectionAsync().catch(() => undefined);
    const currentIdx = PLAYBACK_SPEEDS.indexOf(speed);
    const nextSpeed = PLAYBACK_SPEEDS[(currentIdx + 1) % PLAYBACK_SPEEDS.length] ?? 1;
    setSpeed(nextSpeed);
    if (player) {
      player.playbackRate = nextSpeed;
    }
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
    videoViewRef.current?.startPictureInPicture().catch(() => undefined);
  };

  const handleScrubberLayout = (e: LayoutChangeEvent) => {
    setScrubberWidth(Math.max(1, e.nativeEvent.layout.width));
  };

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.topGlassBar,
          { marginTop: insets.top + spacing.xs },
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
            {item.category === 'audio' ? 'Background Audio Ready' : 'HD Local Playback'}
          </Text>
        </View>

        {canUsePip ? (
          <Pressable
            onPress={handleStartPip}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Enter Picture in Picture"
            style={styles.roundBtn}
          >
            <Ionicons name="albums-outline" size={20} color={colors.textOnAccent} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.stage}>
        {item.category === 'audio' ? (
          <View style={styles.audioArtworkCard}>
            <View style={styles.audioCircle}>
              <Ionicons name="musical-notes" size={64} color={colors.accent} />
            </View>
            <Text style={styles.audioTitle} numberOfLines={2}>
              {item.fileName}
            </Text>
          </View>
        ) : null}

        <VideoView
          ref={videoViewRef}
          player={player}
          style={item.category === 'audio' ? styles.hiddenVideo : styles.videoSurface}
          nativeControls={false}
          contentFit="contain"
          allowsPictureInPicture
          startsPictureInPictureAutomatically
        />
      </View>

      <View
        style={[
          styles.bottomGlassControls,
          { marginBottom: Math.max(insets.bottom, spacing.md) },
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
            onPress={() => handleSkipBySeconds(-10)}
            accessibilityRole="button"
            accessibilityLabel="Rewind 10 seconds"
            style={styles.roundBtn}
          >
            <Ionicons name="play-back" size={22} color={colors.textOnAccent} />
          </Pressable>

          <Pressable
            onPress={handleTogglePlayPause}
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
            onPress={() => handleSkipBySeconds(10)}
            accessibilityRole="button"
            accessibilityLabel="Forward 10 seconds"
            style={styles.roundBtn}
          >
            <Ionicons name="play-forward" size={22} color={colors.textOnAccent} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.playerBackground,
    justifyContent: 'space-between',
  },
  emptyRoot: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  topGlassBar: {
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.xl,
    backgroundColor: colors.playerGlass,
    borderWidth: 1,
    borderColor: colors.playerGlassBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  titleWrap: {
    flex: 1,
  },
  fileTitle: {
    ...typography.bodyStrong,
    color: colors.textOnAccent,
  },
  fileSubtitle: {
    ...typography.small,
    color: colors.textMuted,
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
  bottomGlassControls: {
    marginHorizontal: spacing.md,
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
  },
  timeText: {
    ...typography.small,
    color: colors.textOnAccent,
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
