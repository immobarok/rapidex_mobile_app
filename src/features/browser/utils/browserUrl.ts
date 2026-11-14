const IN_APP_SCHEMES = ['https:', 'http:', 'blob:', 'data:'] as const;

/**
 * Returns true for protocols that should render directly inside the in-app WebView
 * instead of triggering external app or store redirects.
 */
export function isInAppWebScheme(rawUrl: string): boolean {
  const normalized = rawUrl.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized === 'about:blank' || normalized.startsWith('about:blank#')) {
    return true;
  }
  return IN_APP_SCHEMES.some((scheme) => normalized.startsWith(scheme));
}

/**
 * Extracts an HTTP(S) fallback URL from an Android `intent://` deep link if present.
 */
export function extractIntentFallbackUrl(rawUrl: string): string | null {
  if (!rawUrl.trim().toLowerCase().startsWith('intent:')) {
    return null;
  }
  const match = rawUrl.match(/;S\.browser_fallback_url=([^;]+)/);
  if (!match?.[1]) {
    return null;
  }
  try {
    const decoded = decodeURIComponent(match[1]);
    return /^https?:\/\//i.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function matchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/**
 * Converts single-video YouTube or TikTok URLs to embeddable iframe URLs for Web preview.
 * Main site feeds return null because those platforms block iframes via X-Frame-Options.
 */
export function getWebEmbedUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();

    if (matchesDomain(host, 'youtu.be')) {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?playsinline=1` : null;
    }

    if (matchesDomain(host, 'youtube.com')) {
      if (parsed.pathname.startsWith('/watch')) {
        const id = parsed.searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?playsinline=1` : null;
      }
      const parts = parsed.pathname.split('/').filter(Boolean);
      if ((parts[0] === 'shorts' || parts[0] === 'live') && parts[1]) {
        return `https://www.youtube.com/embed/${encodeURIComponent(parts[1])}?playsinline=1`;
      }
      if (parts[0] === 'embed' && parts[1]) {
        return rawUrl;
      }
    }

    if (matchesDomain(host, 'tiktok.com')) {
      const videoMatch = parsed.pathname.match(/\/video\/(\d+)/);
      if (videoMatch?.[1]) {
        return `https://www.tiktok.com/embed/v2/${videoMatch[1]}`;
      }
    }

    return null;
  } catch {
    return null;
  }
}
