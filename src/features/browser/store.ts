import { create } from 'zustand';
import { kvStorage } from '@/lib/storage';
import {
  BrowserBookmarkEntry,
  BrowserHistoryEntry,
  QuickAppItem,
} from './types';

const KEYS = {
  HISTORY: 'browser.history',
  BOOKMARKS: 'browser.bookmarks',
} as const;

export const QUICK_APPS: QuickAppItem[] = [
  {
    id: 'google',
    name: 'Google',
    url: 'https://www.google.com',
    icon: 'logo-google',
    tintColor: '#4285F4',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    url: 'https://m.youtube.com',
    icon: 'logo-youtube',
    tintColor: '#FF0000',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    url: 'https://www.tiktok.com',
    icon: 'logo-tiktok',
    tintColor: '#14161A',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    url: 'https://m.facebook.com',
    icon: 'logo-facebook',
    tintColor: '#1877F2',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    url: 'https://www.instagram.com',
    icon: 'logo-instagram',
    tintColor: '#E4405F',
  },
];

export function resolveSearchOrUrl(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return 'https://www.google.com';
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+([/?#].*)?$/.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

function readJsonList<T>(key: string): T[] {
  try {
    const raw = kvStorage.getString(key);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJsonList<T>(key: string, items: T[]): void {
  try {
    kvStorage.set(key, JSON.stringify(items));
  } catch {
    // Ignore storage write error
  }
}

type BrowserStoreState = {
  history: BrowserHistoryEntry[];
  bookmarks: BrowserBookmarkEntry[];
  isSheetOpen: boolean;
  sheetTab: 'bookmarks' | 'history';

  hydrateBrowser: () => void;
  addHistoryEntry: (title: string, url: string) => void;
  removeHistoryEntry: (id: string) => void;
  clearHistory: () => void;
  toggleBookmark: (title: string, url: string) => void;
  removeBookmark: (id: string) => void;
  openBrowserSheet: (tab: 'bookmarks' | 'history') => void;
  closeBrowserSheet: () => void;
};

export const useBrowserStore = create<BrowserStoreState>((set, get) => ({
  history: [],
  bookmarks: [],
  isSheetOpen: false,
  sheetTab: 'bookmarks',

  hydrateBrowser: () => {
    set({
      history: readJsonList<BrowserHistoryEntry>(KEYS.HISTORY),
      bookmarks: readJsonList<BrowserBookmarkEntry>(KEYS.BOOKMARKS),
    });
  },

  addHistoryEntry: (title, url) => {
    if (!url || url === 'about:blank') {
      return;
    }
    const cleanTitle = title.trim() || url;
    const current = get().history;
    const withoutDup = current.filter((entry) => entry.url !== url);
    const next: BrowserHistoryEntry[] = [
      {
        id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: cleanTitle,
        url,
        visitedAt: Date.now(),
      },
      ...withoutDup,
    ].slice(0, 80);

    writeJsonList(KEYS.HISTORY, next);
    set({ history: next });
  },

  removeHistoryEntry: (id) => {
    const next = get().history.filter((entry) => entry.id !== id);
    writeJsonList(KEYS.HISTORY, next);
    set({ history: next });
  },

  clearHistory: () => {
    writeJsonList(KEYS.HISTORY, []);
    set({ history: [] });
  },

  toggleBookmark: (title, url) => {
    if (!url) {
      return;
    }
    const current = get().bookmarks;
    const existing = current.find((b) => b.url === url);
    const next = existing
      ? current.filter((b) => b.url !== url)
      : [
          {
            id: `bm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            title: title.trim() || url,
            url,
            createdAt: Date.now(),
          },
          ...current,
        ];

    writeJsonList(KEYS.BOOKMARKS, next);
    set({ bookmarks: next });
  },

  removeBookmark: (id) => {
    const next = get().bookmarks.filter((b) => b.id !== id);
    writeJsonList(KEYS.BOOKMARKS, next);
    set({ bookmarks: next });
  },

  openBrowserSheet: (tab) => set({ isSheetOpen: true, sheetTab: tab }),
  closeBrowserSheet: () => set({ isSheetOpen: false }),
}));
