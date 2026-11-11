import { create } from 'zustand';
import { DownloadsStoreState } from './types';

export const useDownloadsStore = create<DownloadsStoreState>((set) => ({
  items: [],
  progressById: {},
  isHydrated: false,
  isAddSheetOpen: false,
  prefilledUrl: '',
  errorBanner: null,

  setHydratedItems: (items) =>
    set({
      items,
      isHydrated: true,
    }),

  upsertItem: (item) =>
    set((state) => {
      const existingIdx = state.items.findIndex((i) => i.id === item.id);
      if (existingIdx === -1) {
        return { items: [item, ...state.items] };
      }
      const next = [...state.items];
      next[existingIdx] = item;
      return { items: next };
    }),

  updateItemFields: (id, patch) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    })),

  removeItem: (id) =>
    set((state) => {
      const nextProgress = { ...state.progressById };
      delete nextProgress[id];
      return {
        items: state.items.filter((item) => item.id !== id),
        progressById: nextProgress,
      };
    }),

  removeCompletedItems: () =>
    set((state) => ({
      items: state.items.filter((item) => item.status !== 'completed'),
    })),

  setProgressSnapshot: (id, snapshot) =>
    set((state) => ({
      progressById: {
        ...state.progressById,
        [id]: snapshot,
      },
    })),

  clearProgressSnapshot: (id) =>
    set((state) => {
      if (!state.progressById[id]) {
        return state;
      }
      const next = { ...state.progressById };
      delete next[id];
      return { progressById: next };
    }),

  openAddSheet: (prefillUrl = '') =>
    set({
      isAddSheetOpen: true,
      prefilledUrl: prefillUrl,
    }),

  closeAddSheet: () =>
    set({
      isAddSheetOpen: false,
      prefilledUrl: '',
    }),

  setErrorBanner: (message) =>
    set({
      errorBanner: message,
    }),
}));

