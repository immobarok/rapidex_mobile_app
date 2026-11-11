import { useCallback, useEffect, useRef, useState } from 'react';
import { VideoPlayer } from 'expo-video';
import { useDownloadsStore } from '@/features/downloads/store';
import { updatePlaybackPositionInDb } from '@/lib/db';

export function usePlayerPosition(
  id: string,
  player: VideoPlayer | null,
  initialSavedMs: number
) {
  const updateItemFields = useDownloadsStore((s) => s.updateItemFields);
  const [currentTimeSec, setCurrentTimeSec] = useState(initialSavedMs / 1000);
  const [durationSec, setDurationSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const hasRestoredPosition = useRef(false);

  const persistPosition = useCallback(
    (timeSec: number, durSec: number) => {
      const posMs = Math.max(0, Math.floor(timeSec * 1000));
      const totalMs = Math.max(0, Math.floor(durSec * 1000));
      updateItemFields(id, {
        lastPlaybackPositionMs: posMs,
        durationMs: totalMs,
      });
      updatePlaybackPositionInDb(id, posMs, totalMs).catch(() => undefined);
    },
    [id, updateItemFields]
  );

  useEffect(() => {
    if (!player) {
      return;
    }

    const interval = setInterval(() => {
      const dur = player.duration > 0 ? player.duration : 0;
      const cur = player.currentTime >= 0 ? player.currentTime : 0;

      if (!hasRestoredPosition.current && dur > 0) {
        hasRestoredPosition.current = true;
        if (initialSavedMs > 2000 && initialSavedMs / 1000 < dur - 3) {
          player.currentTime = initialSavedMs / 1000;
        }
      }

      setCurrentTimeSec(player.currentTime);
      setDurationSec(dur);
      setIsPlaying(player.playing);

      if (player.playing && dur > 0) {
        persistPosition(cur, dur);
      }
    }, 500);

    return () => {
      clearInterval(interval);
      if (player.duration > 0) {
        persistPosition(player.currentTime, player.duration);
      }
    };
  }, [initialSavedMs, persistPosition, player]);

  const handleSeekToRatio = useCallback(
    (ratio: number) => {
      if (!player || durationSec <= 0) {
        return;
      }
      const clamped = Math.min(1, Math.max(0, ratio));
      const nextTime = clamped * durationSec;
      player.currentTime = nextTime;
      setCurrentTimeSec(nextTime);
      persistPosition(nextTime, durationSec);
    },
    [durationSec, persistPosition, player]
  );

  const handleSkipBySeconds = useCallback(
    (deltaSec: number) => {
      if (!player) {
        return;
      }
      const maxDur = player.duration > 0 ? player.duration : durationSec;
      const next = Math.min(
        maxDur > 0 ? maxDur : Number.MAX_SAFE_INTEGER,
        Math.max(0, player.currentTime + deltaSec)
      );
      player.currentTime = next;
      setCurrentTimeSec(next);
      persistPosition(next, maxDur);
    },
    [durationSec, persistPosition, player]
  );

  const handleTogglePlayPause = useCallback(() => {
    if (!player) {
      return;
    }
    if (player.playing) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  }, [player]);

  return {
    currentTimeSec,
    durationSec,
    isPlaying,
    handleSeekToRatio,
    handleSkipBySeconds,
    handleTogglePlayPause,
  };
}

