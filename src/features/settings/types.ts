export type MaxConcurrentOption = 1 | 2 | 3 | 4;

export type SaveFolderOption = 'Downloads' | 'Videos' | 'Music' | 'Documents';

export type SettingsState = {
  wifiOnly: boolean;
  maxConcurrent: MaxConcurrentOption;
  defaultFolder: SaveFolderOption;
  notificationsEnabled: boolean;
  hasCompletedOnboarding: boolean;
  setWifiOnly: (value: boolean) => void;
  setMaxConcurrent: (value: MaxConcurrentOption) => void;
  setDefaultFolder: (value: SaveFolderOption) => void;
  setNotificationsEnabled: (value: boolean) => void;
  completeOnboarding: () => void;
};
