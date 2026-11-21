export type Competitor = {
  title: string;
  price: string | null;
  currency?: string | null;
  shopName: string | null;
  url: string;
  reviewCount?: number | null;
  keywords?: string[];
  strengths?: string;
  weaknesses?: string;
};

export type Report = {
  keyword: string;
  score: number | null;
  scoreBasis?: { label: string; points: number; maximum: number; detail: string }[];
  competitionLabel: string;
  demandLabel: string;
  summary: string;
  intent?: string;
  audience?: string;
  description?: string;
  differentiation?: string;
  relatedKeywords: { keyword: string; intent: string; competition: string; category?: string }[];
  marketLeaders: Competitor[];
  generatedTitles: string[];
  tags?: string[];
  evidence: { claim: string; url: string }[];
  limitations: string[];
};

export type Entry = { id: string; createdAt: string; report: Report };

export function httpsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

export function etsyListingId(value: string): string | null {
  const url = httpsUrl(value);
  if (!url || url.port || !['etsy.com', 'www.etsy.com'].includes(url.hostname)) return null;
  return url.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?listing\/(\d+)(?:\/|$)/i)?.[1] ?? null;
}
