import { useMemo, useState } from 'react';
import { useDownloads } from '@/features/downloads/hooks/useDownloads';
import { SortOption } from '@/types';
import {
  LibraryFilterCategory,
  LibraryFolderFilter,
  LibraryViewMode,
} from '../types';

export function useLibrary() {
  const {
    items,
    isHydrated,
    handleDelete,
    handleRename,
    handleShareFile,
  } = useDownloads();

  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<LibraryFilterCategory>('all');
  const [folder, setFolder] = useState<LibraryFolderFilter>('All Folders');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [viewMode, setViewMode] = useState<LibraryViewMode>('list');

  const completedFiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = items.filter((item) => {
      if (item.status !== 'completed') {
        return false;
      }
      if (category !== 'all' && item.category !== category) {
        return false;
      }
      if (folder !== 'All Folders' && item.folder !== folder) {
        return false;
      }
      if (query.length > 0 && !item.fileName.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        return a.fileName.localeCompare(b.fileName);
      }
      if (sortBy === 'size') {
        return b.totalBytes - a.totalBytes;
      }
      return (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt);
    });
  }, [category, folder, items, searchQuery, sortBy]);

  const cycleSortBy = () => {
    setSortBy((prev) => {
      if (prev === 'date') return 'name';
      if (prev === 'name') return 'size';
      return 'date';
    });
  };

  const toggleViewMode = () => {
    setViewMode((prev) => (prev === 'list' ? 'grid' : 'list'));
  };

  return {
    files: completedFiles,
    isHydrated,
    searchQuery,
    setSearchQuery,
    category,
    setCategory,
    folder,
    setFolder,
    sortBy,
    cycleSortBy,
    viewMode,
    toggleViewMode,
    handleDelete,
    handleRename,
    handleShareFile,
  };
}

