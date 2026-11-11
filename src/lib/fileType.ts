import { FileCategory } from '@/types';

const VIDEO_EXTENSIONS = new Set([
  'mp4',
  'mov',
  'm4v',
  'mkv',
  'webm',
  'avi',
]);

const AUDIO_EXTENSIONS = new Set([
  'mp3',
  'm4a',
  'aac',
  'wav',
  'flac',
  'ogg',
  'opus',
]);

const DOCUMENT_EXTENSIONS = new Set([
  'pdf',
  'epub',
  'txt',
  'md',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'csv',
  'json',
]);

export function getFileExtension(fileNameOrUrl: string): string {
  const clean = fileNameOrUrl.split('?')[0]?.split('#')[0] ?? '';
  const base = clean.split('/').pop() ?? '';
  const dotIndex = base.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === base.length - 1) {
    return '';
  }
  return base.slice(dotIndex + 1).toLowerCase();
}

export function detectFileCategory(
  fileName: string,
  mimeType?: string | null
): FileCategory {
  const normalizedMime = (mimeType ?? '').toLowerCase();
  if (normalizedMime.startsWith('video/')) {
    return 'video';
  }
  if (normalizedMime.startsWith('audio/')) {
    return 'audio';
  }
  if (
    normalizedMime.startsWith('application/pdf') ||
    normalizedMime.startsWith('text/') ||
    normalizedMime.includes('document') ||
    normalizedMime.includes('epub')
  ) {
    return 'document';
  }

  const ext = getFileExtension(fileName);
  if (VIDEO_EXTENSIONS.has(ext)) {
    return 'video';
  }
  if (AUDIO_EXTENSIONS.has(ext)) {
    return 'audio';
  }
  if (DOCUMENT_EXTENSIONS.has(ext)) {
    return 'document';
  }
  return 'other';
}

export function inferMimeType(fileName: string, headerMime?: string | null): string {
  if (headerMime && headerMime !== 'application/octet-stream') {
    return headerMime.split(';')[0]?.trim() ?? 'application/octet-stream';
  }
  const ext = getFileExtension(fileName);
  switch (ext) {
    case 'mp4':
    case 'm4v':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case 'webm':
      return 'video/webm';
    case 'mp3':
      return 'audio/mpeg';
    case 'm4a':
    case 'aac':
      return 'audio/mp4';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
      return 'audio/ogg';
    case 'pdf':
      return 'application/pdf';
    case 'txt':
    case 'md':
      return 'text/plain';
    case 'zip':
      return 'application/zip';
    default:
      return 'application/octet-stream';
  }
}

export function sanitizeFileName(rawName: string): string {
  const trimmed = rawName.trim();
  const stripped = trimmed
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '');

  if (!stripped || stripped.length === 0) {
    return `file_${Date.now()}.bin`;
  }
  return stripped.slice(0, 120);
}

export function sanitizeFolderName(rawFolder: string): string {
  const cleaned = rawFolder
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'Downloads';
}
