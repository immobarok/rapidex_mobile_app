import { detectFileCategory, getFileExtension, inferMimeType, sanitizeFileName } from './fileType';
import { FileCategory } from '@/types';

const MEDIA_PAGE_HOST_PATTERNS = [
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
      isMediaPage?: boolean;
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

/**
 * Extracts the first HTTP(S) URL from shared or copied text such as YouTube share messages.
 */
export function extractFirstHttpUrl(rawText: string): string | null {
  const match = rawText.match(/https?:\/\/[^\s<>"']+/i);
  if (!match?.[0]) {
    return null;
  }
  return match[0].replace(/[),.;!?]+$/, '');
}

/**
 * Returns true if the URL host belongs to a video/social streaming platform page
 * requiring stream extraction rather than direct binary download.
 */
export function isMediaPageHost(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    const host = parsed.hostname.toLowerCase();
    return MEDIA_PAGE_HOST_PATTERNS.some((pattern) => pattern.test(host));
  } catch {
    return false;
  }
}

function parseValidatedHttpUrl(rawInput: string):
  | {
      ok: true;
      parsed: URL;
      suggestedFileName: string;
      isMediaPage: boolean;
    }
  | { ok: false; errorMessage: string } {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      ok: false,
      errorMessage: 'Paste a video or direct file link (for example, https://example.com/video.mp4).',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      ok: false,
      errorMessage: 'Please enter a valid URL starting with https:// or http://.',
    };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      ok: false,
      errorMessage: 'Only HTTP and HTTPS links are supported.',
    };
  }

  const host = parsed.hostname.toLowerCase();
  const isMediaPage = MEDIA_PAGE_HOST_PATTERNS.some((pattern) => pattern.test(host));

  const pathSegments = parsed.pathname.split('/').filter(Boolean);
  const lastSegment = pathSegments[pathSegments.length - 1] ?? '';
  let decodedName = '';
  try {
    decodedName = decodeURIComponent(lastSegment);
  } catch {
    decodedName = lastSegment;
  }

  const ext = getFileExtension(decodedName);
  const fallbackBase = isMediaPage ? `video_${Date.now()}.mp4` : `download_${Date.now()}.bin`;
  const defaultName = decodedName ? sanitizeFileName(decodedName) : fallbackBase;
  const suggestedFileName =
    isMediaPage && !ext ? `${sanitizeFileName(defaultName)}.mp4` : defaultName;

  return {
    ok: true,
    parsed,
    suggestedFileName,
    isMediaPage,
  };
}

/**
 * Validates any HTTP(S) URL, tagging whether it belongs to a streaming page like YouTube or TikTok.
 */
export function validateAnyHttpUrl(rawInput: string): UrlValidationResult {
  const res = parseValidatedHttpUrl(rawInput);
  if (!res.ok) {
    return { isValid: false, errorMessage: res.errorMessage };
  }
  return {
    isValid: true,
    normalizedUrl: res.parsed.toString(),
    suggestedFileName: res.suggestedFileName,
    isMediaPage: res.isMediaPage,
  };
}

/**
 * Validates direct downloadable file URLs and rejects unextracted streaming page URLs.
 */
export function validateDirectUrl(rawInput: string): UrlValidationResult {
  const res = parseValidatedHttpUrl(rawInput);
  if (!res.ok) {
    return { isValid: false, errorMessage: res.errorMessage };
  }
  if (res.isMediaPage) {
    return {
      isValid: false,
      errorMessage:
        'Streaming page links need extraction first. Resolve a direct video stream or use a direct file link.',
    };
  }
  return {
    isValid: true,
    normalizedUrl: res.parsed.toString(),
    suggestedFileName: res.suggestedFileName,
    isMediaPage: false,
  };
}

/**
 * Extracts a downloadable or extractable HTTP(S) link from clipboard text.
 */
export function detectClipboardDownloadUrl(rawText: string): string | null {
  const candidate = extractFirstHttpUrl(rawText);
  if (!candidate) {
    return null;
  }
  const check = validateAnyHttpUrl(candidate);
  return check.isValid ? check.normalizedUrl : null;
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

