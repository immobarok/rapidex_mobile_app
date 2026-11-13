import { DiscoverArticle, DiscoverCategory } from '../types';

const DEFAULT_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=900&q=80';

const TECH_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80';

const SPORTS_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=900&q=80';

type SpaceflightResponse = {
  results?: Array<{
    id: number;
    title?: string;
    url?: string;
    image_url?: string;
    news_site?: string;
  }>;
};

type WikiFeaturedResponse = {
  mostread?: {
    articles?: Array<{
      pageid?: number;
      normalizedtitle?: string;
      titles?: { normalized?: string };
      description?: string;
      thumbnail?: { source?: string };
      content_urls?: { mobile?: { page?: string }; desktop?: { page?: string } };
    }>;
  };
};

type EspnNewsResponse = {
  articles?: Array<{
    id?: number | string;
    headline?: string;
    description?: string;
    links?: { web?: { href?: string } };
    images?: Array<{ url?: string }>;
  }>;
};

type HnAlgoliaResponse = {
  hits?: Array<{
    objectID: string;
    title?: string;
    url?: string;
  }>;
};

const feedCache = new Map<DiscoverCategory, DiscoverArticle[]>();

function getYesterdayPath(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchSpaceflightNews(category: DiscoverCategory): Promise<DiscoverArticle[]> {
  const data = await fetchJson<SpaceflightResponse>(
    'https://api.spaceflightnewsapi.net/v4/articles/?limit=6',
  );
  return (data.results ?? [])
    .filter((item) => Boolean(item.title && item.url))
    .map((item) => ({
      id: `sf_${item.id}`,
      category,
      title: item.title!.trim(),
      source: item.news_site?.trim() || 'Science & Tech',
      url: item.url!,
      imageUrl: item.image_url || TECH_FALLBACK_IMAGE,
      icon: 'hardware-chip-outline',
    }));
}

async function fetchWikipediaWorldNews(category: DiscoverCategory): Promise<DiscoverArticle[]> {
  const datePath = getYesterdayPath();
  const data = await fetchJson<WikiFeaturedResponse>(
    `https://en.wikipedia.org/api/rest_v1/feed/featured/${datePath}`,
  );
  return (data.mostread?.articles ?? [])
    .filter((a) => Boolean(a.thumbnail?.source && (a.content_urls?.mobile?.page || a.content_urls?.desktop?.page)))
    .slice(0, 6)
    .map((a, index) => {
      const title =
        a.titles?.normalized ||
        a.normalizedtitle ||
        'Trending Story';
      const subtitle = a.description ? `${title} — ${a.description}` : title;
      const pageUrl =
        a.content_urls?.mobile?.page ||
        a.content_urls?.desktop?.page ||
        'https://en.wikipedia.org';
      return {
        id: `wiki_${a.pageid ?? index}`,
        category,
        title: subtitle,
        source: 'Wikipedia Trending',
        url: pageUrl,
        imageUrl: a.thumbnail?.source || DEFAULT_FALLBACK_IMAGE,
        icon: 'earth-outline',
      };
    });
}

async function fetchEspnSportsNews(): Promise<DiscoverArticle[]> {
  const data = await fetchJson<EspnNewsResponse>(
    'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/news?limit=6',
  );
  return (data.articles ?? [])
    .filter((a) => Boolean(a.headline && a.links?.web?.href))
    .map((a, index) => ({
      id: `espn_${a.id ?? index}`,
      category: 'Sports',
      title: a.headline!.trim(),
      source: 'ESPN Football',
      url: a.links!.web!.href!,
      imageUrl: a.images?.[0]?.url || SPORTS_FALLBACK_IMAGE,
      icon: 'football-outline',
    }));
}

async function fetchHackerNews(): Promise<DiscoverArticle[]> {
  const data = await fetchJson<HnAlgoliaResponse>(
    'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=6',
  );
  return (data.hits ?? [])
    .filter((hit) => Boolean(hit.title && hit.url))
    .map((hit) => ({
      id: `hn_${hit.objectID}`,
      category: 'Tech',
      title: hit.title!.trim(),
      source: 'Hacker News',
      url: hit.url!,
      imageUrl: TECH_FALLBACK_IMAGE,
      icon: 'newspaper-outline',
    }));
}

export async function fetchLiveDiscoverNews(
  category: DiscoverCategory,
  forceRefresh = false,
): Promise<DiscoverArticle[]> {
  if (!forceRefresh && feedCache.has(category)) {
    return feedCache.get(category)!;
  }

  let articles: DiscoverArticle[] = [];

  if (category === 'Sports') {
    articles = await fetchEspnSportsNews();
  } else if (category === 'Tech') {
    const [sf, hn] = await Promise.allSettled([
      fetchSpaceflightNews('Tech'),
      fetchHackerNews(),
    ]);
    articles = [
      ...(sf.status === 'fulfilled' ? sf.value : []),
      ...(hn.status === 'fulfilled' ? hn.value : []),
    ].slice(0, 8);
  } else if (category === 'World') {
    articles = await fetchWikipediaWorldNews('World');
  } else {
    const [wiki, espn, sf] = await Promise.allSettled([
      fetchWikipediaWorldNews('For you'),
      fetchEspnSportsNews(),
      fetchSpaceflightNews('For you'),
    ]);
    articles = [
      ...(espn.status === 'fulfilled' ? espn.value.slice(0, 2) : []),
      ...(sf.status === 'fulfilled' ? sf.value.slice(0, 2) : []),
      ...(wiki.status === 'fulfilled' ? wiki.value.slice(0, 3) : []),
    ];
  }

  if (articles.length > 0) {
    feedCache.set(category, articles);
  }
  return articles;
}

