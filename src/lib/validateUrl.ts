import { detectFileCategory, getFileExtension, inferMimeType, sanitizeFileName } from './fileType';
import { FileCategory } from '@/types';

const RESTRICTED_HOST_PATTERNS = [
  /(^|\.)youtube\.com$/i,
  /(^|\.)youtu\.be$/i,
  /(^|\.)facebook\.com$/i,
  /(^|\.)fb\.watch$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)tiktok\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)vimeo\.com$/i,
  /(^|\.)dailymotion\.com$/i,
  /(^|\.)twitch\.tv$/i,
];

export type UrlValidationResult =
  | {
      isValid: true;
      normalizedUrl: string;
      suggestedFileName: string;
    }
  | {
      isValid: false;
      errorMessage: string;
    };

export type UrlProbeMetadata = {
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  category: FileCategory;
  supportsRange: boolean;
  isDirectFile: boolean;
  warningMessage: string | null;
};

export function validateDirectUrl(rawInput: string): UrlValidationResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      isValid: false,
      errorMessage: 'Paste a direct file link (for example, https://example.com/video.mp4).',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      isValid: false,
      errorMessage: 'Please enter a valid URL starting with https:// or http://.',
    };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      isValid: false,
      errorMessage: 'Only direct HTTP and HTTPS file links are supported.',
    };
  }

  const host = parsed.hostname.toLowerCase();
  const isRestrictedPlatform = RESTRICTED_HOST_PATTERNS.some((pattern) =>
    pattern.test(host)
  );

  if (isRestrictedPlatform) {
    return {
      isValid: false,
      errorMessage:
        'Streaming platforms are not supported. Please paste a direct file link that you have the right to save.',
    };
  }

  const pathSegments = parsed.pathname.split('/').filter(Boolean);
  const lastSegment = pathSegments[pathSegments.length - 1] ?? '';
  let decodedName = '';
  try {
    decodedName = decodeURIComponent(lastSegment);
  } catch {
    decodedName = lastSegment;
  }

  const ext = getFileExtension(decodedName);
  const defaultName = decodedName
    ? sanitizeFileName(decodedName)
    : `download_${Date.now()}.bin`;

  const suggestedFileName = ext ? defaultName : `${defaultName}`;

  return {
    isValid: true,
    normalizedUrl: parsed.toString(),
    suggestedFileName,
  };
}

function parseContentDispositionFileName(header: string | null): string | null {
  if (!header) {
    return null;
  }
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8Match?.[1]) {
    try {
      return sanitizeFileName(decodeURIComponent(utf8Match[1].trim()));
    } catch {
      return sanitizeFileName(utf8Match[1].trim());
    }
  }
  const quotedMatch = /filename="?([^";]+)"?/i.exec(header);
  if (quotedMatch?.[1]) {
    return sanitizeFileName(quotedMatch[1].trim());
  }
  return null;
}

export async function probeDirectUrl(
  url: string,
  fallbackFileName: string,
  signal?: AbortSignal
): Promise<UrlProbeMetadata> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') ?? '';
    const contentLengthHeader = response.headers.get('content-length');
    const contentDisposition = response.headers.get('content-disposition');
    const acceptRanges = response.headers.get('accept-ranges') ?? '';

    const sizeBytes = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : 0;
    const headerFileName = parseContentDispositionFileName(contentDisposition);
    const resolvedFileName = headerFileName ?? sanitizeFileName(fallbackFileName);
    const mimeType = inferMimeType(resolvedFileName, contentType);
    const category = detectFileCategory(resolvedFileName, mimeType);

    const isHtmlPage =
      contentType.toLowerCase().includes('text/html') &&
      !resolvedFileName.toLowerCase().endsWith('.html');

    return {
      fileName: resolvedFileName,
      sizeBytes: Number.isFinite(sizeBytes) && sizeBytes > 0 ? sizeBytes : 0,
      mimeType,
      category,
      supportsRange: acceptRanges.toLowerCase().includes('bytes'),
      isDirectFile: !isHtmlPage,
      warningMessage: isHtmlPage
        ? 'This link appears to be a web page rather than a direct file link.'
        : null,
    };
  } catch {
    const cleanName = sanitizeFileName(fallbackFileName);
    const mimeType = inferMimeType(cleanName);
    return {
      fileName: cleanName,
      sizeBytes: 0,
      mimeType,
      category: detectFileCategory(cleanName, mimeType),
      supportsRange: false,
      isDirectFile: true,
      warningMessage: null,
    };
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}
