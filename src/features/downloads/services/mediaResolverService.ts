import { inferMimeType, sanitizeFileName } from '@/lib/fileType';

export type MediaQualityPreference = 'best' | '1080' | '720' | '480' | 'audio';

export type ResolvedMediaFormat = {
  id: string;
  label: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  isAudioOnly: boolean;
};

export type MediaResolveResult = {
  title: string;
  formats: ResolvedMediaFormat[];
};

const RESOLVE_TIMEOUT_MS = 20000;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
  }
  return '';
}

function readNumber(obj: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
      return val;
    }
  }
  return 0;
}

/**
 * Validates that an extractor server endpoint is a valid HTTP(S) URL.
 */
export function isValidExtractorEndpoint(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function ensureFileExtension(
  rawTitle: string,
  ext: string,
  isAudioOnly: boolean
): string {
  const cleanExt = ext.replace(/^\./, '').toLowerCase() || (isAudioOnly ? 'mp3' : 'mp4');
  const safeBase = sanitizeFileName(rawTitle || (isAudioOnly ? 'audio' : 'video'));
  if (safeBase.toLowerCase().endsWith(`.${cleanExt}`)) {
    return safeBase;
  }
  return sanitizeFileName(`${safeBase}.${cleanExt}`);
}

function normalizeCobaltPayload(
  data: Record<string, unknown>,
  preferredQuality: MediaQualityPreference
): MediaResolveResult | null {
  const status = readString(data, 'status').toLowerCase();
  if (status === 'error') {
    const errObj = asRecord(data.error);
    const code = errObj ? readString(errObj, 'code', 'message') : readString(data, 'text', 'message');
    throw new Error(code || 'Extractor returned an error for this link.');
  }

  const fallbackTitle = readString(data, 'title', 'filename', 'fileName') || 'media';

  if (status === 'picker' && Array.isArray(data.picker)) {
    const formats: ResolvedMediaFormat[] = [];
    data.picker.forEach((entry, idx) => {
      const item = asRecord(entry);
      const itemUrl = item ? readString(item, 'url') : '';
      if (!itemUrl || !/^https?:\/\//i.test(itemUrl)) {
        return;
      }
      const itemType = item ? readString(item, 'type').toLowerCase() : 'video';
      const isAudioOnly = itemType === 'audio';
      const ext = isAudioOnly ? 'mp3' : 'mp4';
      const fileName = ensureFileExtension(`${fallbackTitle}_${idx + 1}`, ext, isAudioOnly);
      formats.push({
        id: `picker_${idx}`,
        label: itemType === 'photo' ? `Photo ${idx + 1}` : isAudioOnly ? 'Audio' : `Video ${idx + 1}`,
        url: itemUrl,
        fileName,
        mimeType: inferMimeType(fileName),
        sizeBytes: 0,
        isAudioOnly,
      });
    });

    const extraAudioUrl = readString(data, 'audio');
    if (extraAudioUrl && /^https?:\/\//i.test(extraAudioUrl)) {
      const audioName = readString(data, 'audioFilename') || ensureFileExtension(fallbackTitle, 'mp3', true);
      formats.push({
        id: 'picker_audio',
        label: 'Audio Track (MP3)',
        url: extraAudioUrl,
        fileName: sanitizeFileName(audioName),
        mimeType: inferMimeType(audioName),
        sizeBytes: 0,
        isAudioOnly: true,
      });
    }

    if (formats.length > 0) {
      return { title: fallbackTitle, formats };
    }
  }

  if ((status === 'tunnel' || status === 'redirect' || status === 'stream') && typeof data.url === 'string') {
    const isAudioOnly = preferredQuality === 'audio';
    const rawName = readString(data, 'filename', 'fileName');
    const fileName = rawName
      ? sanitizeFileName(rawName)
      : ensureFileExtension(fallbackTitle, isAudioOnly ? 'mp3' : 'mp4', isAudioOnly);
    return {
      title: rawName || fallbackTitle,
      formats: [
        {
          id: 'cobalt_primary',
          label: isAudioOnly
            ? 'Audio (MP3)'
            : preferredQuality === 'best'
              ? 'Best Video'
              : `${preferredQuality}p Video`,
          url: data.url,
          fileName,
          mimeType: inferMimeType(fileName),
          sizeBytes: 0,
          isAudioOnly,
        },
      ],
    };
  }

  return null;
}

function normalizeGenericPayload(
  data: Record<string, unknown>,
  preferredQuality: MediaQualityPreference
): MediaResolveResult {
  const errMsg = readString(data, 'error', 'detail');
  if (errMsg) {
    throw new Error(errMsg);
  }

  const title = readString(data, 'title', 'name', 'fileName', 'filename') || 'video';
  const formats: ResolvedMediaFormat[] = [];

  if (Array.isArray(data.formats)) {
    data.formats.forEach((rawFormat, idx) => {
      const fmt = asRecord(rawFormat);
      if (!fmt) {
        return;
      }
      const streamUrl = readString(fmt, 'url', 'downloadUrl');
      if (!streamUrl || !/^https?:\/\//i.test(streamUrl)) {
        return;
      }
      const isAudioOnly =
        fmt.isAudioOnly === true ||
        readString(fmt, 'vcodec') === 'none' ||
        readString(fmt, 'type').toLowerCase() === 'audio';
      const ext = readString(fmt, 'ext') || (isAudioOnly ? 'm4a' : 'mp4');
      const rawName = readString(fmt, 'fileName', 'filename');
      const fileName = rawName
        ? sanitizeFileName(rawName)
        : ensureFileExtension(title, ext, isAudioOnly);
      const mimeType = readString(fmt, 'mimeType', 'mime') || inferMimeType(fileName);
      const label =
        readString(fmt, 'label', 'quality', 'format_note', 'resolution') ||
        (isAudioOnly ? `Audio (${ext.toUpperCase()})` : `Video (${ext.toUpperCase()})`);

      formats.push({
        id: readString(fmt, 'id', 'format_id') || `fmt_${idx}`,
        label,
        url: streamUrl,
        fileName,
        mimeType,
        sizeBytes: readNumber(fmt, 'sizeBytes', 'filesize', 'filesize_approx', 'size'),
        isAudioOnly,
      });
    });
  }

  if (formats.length === 0) {
    const directUrl = readString(data, 'url', 'downloadUrl', 'streamUrl');
    if (directUrl && /^https?:\/\//i.test(directUrl)) {
      const isAudioOnly = preferredQuality === 'audio' || data.isAudioOnly === true;
      const ext = readString(data, 'ext') || (isAudioOnly ? 'mp3' : 'mp4');
      const fileName = ensureFileExtension(title, ext, isAudioOnly);
      const mimeType = readString(data, 'mimeType', 'mime') || inferMimeType(fileName);
      formats.push({
        id: 'single_primary',
        label: readString(data, 'quality', 'label') || (isAudioOnly ? 'Audio' : 'Video'),
        url: directUrl,
        fileName,
        mimeType,
        sizeBytes: readNumber(data, 'sizeBytes', 'filesize', 'size'),
        isAudioOnly,
      });
    }
  }

  if (formats.length === 0) {
    throw new Error('No downloadable stream URL returned by extractor server.');
  }

  return { title, formats };
}

function buildGetRequestUrl(
  endpoint: string,
  mediaUrl: string,
  quality: MediaQualityPreference
): string {
  if (endpoint.includes('{url}')) {
    return endpoint
      .replace(/\{url\}/g, encodeURIComponent(mediaUrl))
      .replace(/\{quality\}/g, encodeURIComponent(quality));
  }
  const separator = endpoint.includes('?') ? '&' : '?';
  return `${endpoint}${separator}url=${encodeURIComponent(mediaUrl)}&quality=${encodeURIComponent(quality)}`;
}

/**
 * Resolves a YouTube, TikTok, or social video page URL into direct downloadable streams
 * using a user-configured Cobalt or yt-dlp compatible backend endpoint.
 */
export async function resolveMediaUrl(
  mediaUrl: string,
  preferredQuality: MediaQualityPreference,
  endpointUrl: string,
  externalSignal?: AbortSignal
): Promise<MediaResolveResult> {
  const endpoint = endpointUrl.trim();
  if (!isValidExtractorEndpoint(endpoint)) {
    throw new Error('Configure a valid Extractor Server URL (http:// or https://) first.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onAbort);

  try {
    const usesUrlTemplate = endpoint.includes('{url}');
    let response: Response;

    if (usesUrlTemplate) {
      response = await fetch(buildGetRequestUrl(endpoint, mediaUrl, preferredQuality), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
    } else {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: mediaUrl,
          videoQuality: preferredQuality === 'best' ? 'max' : preferredQuality === 'audio' ? '720' : preferredQuality,
          downloadMode: preferredQuality === 'audio' ? 'audio' : 'auto',
          audioFormat: 'mp3',
        }),
        signal: controller.signal,
      });

      if (response.status === 405) {
        response = await fetch(buildGetRequestUrl(endpoint, mediaUrl, preferredQuality), {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
      }
    }

    const rawJson: unknown = await response.json().catch(() => null);
    const payload = asRecord(rawJson);

    if (!response.ok) {
      const serverErr = payload
        ? readString(payload, 'message', 'detail') ||
          readString(asRecord(payload.error) ?? {}, 'code', 'message')
        : '';
      throw new Error(serverErr || `Extractor server returned HTTP ${response.status}.`);
    }

    if (!payload) {
      throw new Error('Extractor server returned an invalid JSON response.');
    }

    return (
      normalizeCobaltPayload(payload, preferredQuality) ??
      normalizeGenericPayload(payload, preferredQuality)
    );
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Extractor request timed out.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onAbort);
  }
}

