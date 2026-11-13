import { Ionicons } from '@expo/vector-icons';

export type QuickAppItem = {
  id: string;
  name: string;
  url: string;
  icon: keyof typeof Ionicons.glyphMap;
  tintColor: string;
  bgColor: string;
  isCustom?: boolean;
};

export type DiscoverCategory = 'For you' | 'Tech' | 'Sports' | 'World';

export type DiscoverArticle = {
  id: string;
  category: DiscoverCategory;
  title: string;
  source: string;
  url: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export type BrowserHistoryEntry = {
  id: string;
  title: string;
  url: string;
  visitedAt: number;
};

export type BrowserBookmarkEntry = {
  id: string;
  title: string;
  url: string;
  createdAt: number;
};

export type BrowserSheetTab = 'bookmarks' | 'history';
