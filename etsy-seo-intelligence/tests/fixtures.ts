export const sourceUrl = 'https://www.etsy.com/listing/123456789/wall-art';

export const sample = {
  intent: 'Satın alma',
  competitionLabel: 'Örneklemde benzer başlıklar',
  demandLabel: 'Örnek kaynak sinyalleri',
  summary: 'Duvar sanatı örnek analizi.',
  audience: 'Yeni evini dekore edenler',
  description: 'Mekânınıza uygun duvar sanatı taslağı.',
  differentiation: 'Belirgin görsel stil',
  relatedKeywords: [
    { keyword: 'wall print', intent: 'Satın alma', competition: 'Belirsiz', category: 'Varyasyon' },
    { keyword: 'wall picture', intent: 'Satın alma', competition: 'Belirsiz', category: 'Varyasyon' },
    { keyword: 'botanical wall art set', intent: 'Satın alma', competition: 'Belirsiz', category: 'Long-tail' },
    { keyword: 'neutral art for bedroom', intent: 'Satın alma', competition: 'Belirsiz', category: 'Long-tail' },
    { keyword: 'wall art gift', intent: 'Satın alma', competition: 'Belirsiz', category: 'Alıcı odaklı' },
    { keyword: 'buy wall prints', intent: 'Satın alma', competition: 'Belirsiz', category: 'Alıcı odaklı' },
    { keyword: 'beige nursery prints', intent: 'Fikir edinme', competition: 'Belirsiz', category: 'Niş' },
    { keyword: 'retro kitchen wall prints', intent: 'Fikir edinme', competition: 'Belirsiz', category: 'Niş' }
  ],
  marketLeaders: [
    { title: 'Botanical Wall Art', shopName: 'Örnek Mağaza', price: '12.90', currency: 'USD', url: sourceUrl + '?from=search', reviewCount: 9, keywords: ['botanical'], strengths: 'Açık stil', weaknesses: 'Ölçü belirtilmiyor' },
    { title: 'Neutral Print Set for the Bedroom', shopName: null, price: null, currency: null, url: 'https://www.etsy.com/listing/123456790/neutral-art', reviewCount: null, keywords: ['neutral'], strengths: 'Belirgin oda', weaknesses: 'Format belirsiz' },
    { title: 'Minimal Wall Art', shopName: null, price: null, currency: null, url: 'https://www.etsy.com/listing/123456791/minimal-art', reviewCount: 0, keywords: ['minimal'], strengths: 'Açık amaç', weaknesses: 'Renk belirsiz' },
    { title: 'Sahte kaynak', shopName: null, price: null, currency: null, url: 'https://www.etsy.com/listing/123456799/not-in-sources', reviewCount: null, keywords: [], strengths: '', weaknesses: '' }
  ],
  generatedTitles: Array.from({ length: 10 }, (_, i) => 'Botanical Wall Art – Collection ' + (i + 1)),
  tags: ['wall art', 'wall print', 'botanical print', 'art set', 'neutral decor', 'leaf illustration', 'living room print', 'nature poster', 'bedroom wall art', 'modern wall decor', 'gallery wall', 'minimalist art', 'plant wall art'],
  evidence: [{ claim: 'Örnek başlık', url: sourceUrl }, { claim: 'Sahte kaynak', url: 'https://example.com' }],
  limitations: ['Test fikstürü.']
};

export function completion(output: unknown = sample) {
  return {
    status: 'completed',
    output: [
      { type: 'web_search_call', status: 'completed', action: {
        sources: sample.marketLeaders.slice(0, 3).map(row => ({ type: 'url', url: row.url }))
      } },
      { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }
    ]
  };
}
