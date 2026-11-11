import { create } from 'zustand';
import { kvStorage } from '@/lib/storage';
import { MaxConcurrentOption, SaveFolderOption, SettingsState } from './types';

const KEYS = {
  WIFI_ONLY: 'settings.wifiOnly',
  MAX_CONCURRENT: 'settings.maxConcurrent',
  DEFAULT_FOLDER: 'settings.defaultFolder',
  NOTIFICATIONS_ENABLED: 'settings.notificationsEnabled',
  ONBOARDING_DONE: 'settings.hasCompletedOnboarding',
} as const;

function readInitialMaxConcurrent(): MaxConcurrentOption {
  const saved = kvStorage.getNumber(KEYS.MAX_CONCURRENT);
  if (saved === 1 || saved === 2 || saved === 3 || saved === 4) {
    return saved;
  }
  return 2;
}

function readInitialFolder(): SaveFolderOption {
  const saved = kvStorage.getString(KEYS.DEFAULT_FOLDER);
  if (
    saved === 'Downloads' ||
    saved === 'Videos' ||
    saved === 'Music' ||
    saved === 'Documents'
  ) {
    return saved;
  }
  return 'Downloads';
}

export const useSettingsStore = create<SettingsState>((set) => ({
  wifiOnly: kvStorage.getBoolean(KEYS.WIFI_ONLY) ?? false,
  maxConcurrent: readInitialMaxConcurrent(),
  defaultFolder: readInitialFolder(),
  notificationsEnabled: kvStorage.getBoolean(KEYS.NOTIFICATIONS_ENABLED) ?? false,
  hasCompletedOnboarding: kvStorage.getBoolean(KEYS.ONBOARDING_DONE) ?? false,

  setWifiOnly: (value) => {
    kvStorage.set(KEYS.WIFI_ONLY, value);
    set({ wifiOnly: value });
  },

  setMaxConcurrent: (value) => {
    kvStorage.set(KEYS.MAX_CONCURRENT, value);
    set({ maxConcurrent: value });
  },

  setDefaultFolder: (value) => {
    kvStorage.set(KEYS.DEFAULT_FOLDER, value);
    set({ defaultFolder: value });
  },

  setNotificationsEnabled: (value) => {
    kvStorage.set(KEYS.NOTIFICATIONS_ENABLED, value);
    set({ notificationsEnabled: value });
  },

  completeOnboarding: () => {
    kvStorage.set(KEYS.ONBOARDING_DONE, true);
    set({ hasCompletedOnboarding: true });
  },
}));
