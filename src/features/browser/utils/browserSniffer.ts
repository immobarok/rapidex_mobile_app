const MEDIA_MESSAGE_TYPE = 'RAPIDEX_MEDIA_FOUND';

const KNOWN_MEDIA_EXTENSIONS = new Set([
  '.mp4',
  '.m4v',
  '.mov',
  '.webm',
  '.mkv',
  '.mp3',
  '.m4a',
  '.aac',
  '.ogg',
  '.wav',
  '.flac',
  '.m3u8',
]);

export const MEDIA_SNIFFER_SCRIPT = `
(function () {
  if (window.__rapidexMediaSnifferInstalled) {
    return;
  }
  window.__rapidexMediaSnifferInstalled = true;

  var lastHref = window.location.href;
  var seen = Object.create(null);

  function resetIfNavigated() {
    if (window.location.href !== lastHref) {
      lastHref = window.location.href;
      seen = Object.create(null);
    }
  }

  function normalizeHttpUrl(raw) {
    if (!raw || typeof raw !== 'string') {
      return null;
    }
    var trimmed = raw.trim();
    if (
      !trimmed ||
      trimmed.indexOf('blob:') === 0 ||
      trimmed.indexOf('data:') === 0 ||
      trimmed.indexOf('mediastream:') === 0 ||
      trimmed.indexOf('about:') === 0
    ) {
      return null;
    }
    try {
      var parsed = new URL(trimmed, window.location.href);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }
      return parsed.toString();
    } catch (_) {
      return null;
    }
  }

  function postUrls(urls) {
    if (!urls.length) {
      return;
    }
    var rnWebView = window.ReactNativeWebView;
    if (!rnWebView || typeof rnWebView.postMessage !== 'function') {
      return;
    }
    try {
      rnWebView.postMessage(
        JSON.stringify({
          type: '${MEDIA_MESSAGE_TYPE}',
          urls: urls,
        })
      );
    } catch (_) {
      // Ignore bridge serialization failures on cross-origin/unloading frames
    }
  }

  function collectFromElement(el, bucket) {
    if (!el || typeof el.getAttribute !== 'function') {
      return;
    }
    var candidates = [];
    if (typeof el.currentSrc === 'string' && el.currentSrc) {
      candidates.push(el.currentSrc);
    }
    var attrSrc = el.getAttribute('src');
    if (attrSrc) {
      candidates.push(attrSrc);
    }
    for (var i = 0; i < candidates.length; i += 1) {
      var normalized = normalizeHttpUrl(candidates[i]);
      if (normalized && !seen[normalized]) {
        seen[normalized] = true;
        bucket.push(normalized);
      }
    }
  }

  function scanMediaElements(rootTarget) {
    resetIfNavigated();
    var discovered = [];
    if (rootTarget && rootTarget.tagName) {
      var tag = String(rootTarget.tagName).toLowerCase();
      if (tag === 'video' || tag === 'audio' || tag === 'source') {
        collectFromElement(rootTarget, discovered);
      }
    }
    var nodes = document.querySelectorAll('video, audio, source');
    for (var i = 0; i < nodes.length; i += 1) {
      collectFromElement(nodes[i], discovered);
    }
    postUrls(discovered);
  }

  document.addEventListener(
    'loadstart',
    function (event) {
      scanMediaElements(event && event.target);
    },
    true
  );

  document.addEventListener(
    'loadedmetadata',
    function (event) {
      scanMediaElements(event && event.target);
    },
    true
  );

  document.addEventListener(
    'play',
    function (event) {
      scanMediaElements(event && event.target);
    },
    true
  );

  scanMediaElements(null);
})();
true;
`;

function isAcceptableHttpMediaUrl(candidate: string): boolean {
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const lowerPath = parsed.pathname.toLowerCase();
    const dotIndex = lowerPath.lastIndexOf('.');
    const ext = dotIndex >= 0 ? lowerPath.slice(dotIndex) : '';
    if (ext && KNOWN_MEDIA_EXTENSIONS.has(ext)) {
      return true;
    }

    // Allow extensionless CDN media streams (e.g. signed googlevideo/tiktok CDN URLs)
    return ext !== '.html' && ext !== '.htm' && ext !== '.js' && ext !== '.css';
  } catch {
    return false;
  }
}

/**
 * Parses a WebView `postMessage` JSON payload emitted by `MEDIA_SNIFFER_SCRIPT`
 * and returns deduplicated HTTP/HTTPS media stream URLs.
 */
export function parseSniffedMediaMessage(rawData: string): string[] {
  if (!rawData) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    return [];
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return [];
  }

  const record = parsed as Record<string, unknown>;
  if (record.type !== MEDIA_MESSAGE_TYPE || !Array.isArray(record.urls)) {
    return [];
  }

  const unique = new Set<string>();
  for (const item of record.urls) {
    if (typeof item !== 'string') {
      continue;
    }
    const trimmed = item.trim();
    if (isAcceptableHttpMediaUrl(trimmed)) {
      unique.add(trimmed);
    }
  }

  return Array.from(unique);
}

