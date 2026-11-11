import { FileCategory, SortOption } from '@/types';

export type LibraryFilterCategory = 'all' | FileCategory;

export type LibraryViewMode = 'list' | 'grid';

export type LibraryFolderFilter = 'All Folders' | 'Downloads' | 'Videos' | 'Music' | 'Documents';

export type LibraryFilterState = {
  searchQuery: string;
  category: LibraryFilterCategory;
  folder: LibraryFolderFilter;
  sortBy: SortOption;
  viewMode: LibraryViewMode;
};

