import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Search,
  BarChart3,
  History,
  Download,
  Trash2,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  LoaderCircle
} from 'lucide-react';
import './style.css';

type Report = {
  keyword: string;
  score: number;
  competitionLabel: string;
  demandLabel: string;
  summary: string;
  relatedKeywords: {
    keyword: string;
    intent: string;
    competition: string;
  }[];
  marketLeaders: {
    title: string;
    price: string;
    shopName: string;
    url: string;
  }[];
  generatedTitles: string[];
  evidence: {
    claim: string;
    url: string;
  }[];
  limitations: string[];
};

type Entry = {
  id: string;
  createdAt: string;
  report: Report;
};

const STORAGE_KEY = 'etsy_seo_history_v1';

function readHistory(): Entry[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function App() {
  const [keyword, setKeyword] = useState('');
  const [history, setHistory] = useState<Entry[]>(readHistory);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<
    'overview' | 'competitors' | 'keywords' | 'titles' | 'sources'
  >('overview');
  const [view, setView] = useState<'dashboard' | 'history'>('dashboard');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      console.warn('Analiz geçmişi tarayıcıya kaydedilemedi.');
    }
  }, [history]);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim() || loading) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ keyword: keyword.trim() })
      });

      let data: unknown;

      try {
        data = await response.json();
      } catch {
        throw new Error('Sunucudan geçerli bir JSON yanıtı alınamadı.');
      }

      if (!response.ok) {
        const message =
          data && typeof data === 'object' && 'error' in data
            ? String(data.error)
            : 'Analiz işlemi başarısız.';
        throw new Error(message);
      }

      const result = data as Entry;

      if (!result.report || !result.report.keyword) {
        throw new Error('Sunucudan beklenen analiz raporu alınamadı.');
      }

      const newEntry: Entry = {
        id: result.id || crypto.randomUUID(),
        createdAt: result.createdAt || new Date().toISOString(),
        report: result.report
      };

      setEntry(newEntry);
      setHistory(previous => [
        newEntry,
        ...previous.filter(x => x.id !== newEntry.id)
      ]);
      setTab('overview');
      setView('dashboard');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Bilinmeyen bir hata oluştu.'
      );
    } finally {
      setLoading(false);
    }
  }

  function exportExcel(id: string) {
    const selected = history.find(x => x.id === id) ||
      (entry?.id === id ? entry : null);

    if (!selected) {
      alert('Rapor bulunamadı.');
      return;
    }

    const report = selected.report;

    // Excel ile açılabilen CSV yedeği.
    // Gerçek XLSX dışa aktarma için sunucu veya XLSX kütüphanesi gerekir.
    const rows: string[][] = [
      ['Etsy SEO Intelligence', 'Analiz Raporu'],
      ['Anahtar Kelime', report.keyword],
      ['Fırsat Puanı', String(report.score)],
      ['Rekabet', report.competitionLabel],
      ['Talep Sinyali', report.demandLabel],
      ['Özet', report.summary],
      [],
      ['RAKİP ÜRÜNLER'],
      ['Ürün Başlığı', 'Mağaza', 'Fiyat', 'URL'],
      ...report.marketLeaders.map(x => [
        x.title, x.shopName, x.price, x.url
      ]),
      [],
      ['İLGİLİ ANAHTAR KELİMELER'],
      ['Anahtar Kelime', 'Arama Niyeti', 'Rekabet'],
      ...report.relatedKeywords.map(x => [
        x.keyword, x.intent, x.competition
      ]),
      [],
      ['SEO BAŞLIKLARI'],
      ...report.generatedTitles.map(x => [x]),
      [],
      ['KAYNAKLAR'],
      ...report.evidence.map(x => [x.claim, x.url]),
      [],
      ['VERİ SINIRLARI'],
      ...report.limitations.map(x => [x])
    ];

    const csv = rows.map(row =>
      row.map(value =>
        '"' + String(value ?? '').replace(/"/g, '""') + '"'
      ).join(';')
    ).join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'etsy-report-' + id + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function remove(id: string) {
    if (!confirm('Bu analizi silmek istiyor musun?')) return;
    setHistory(previous => previous.filter(x => x.id !== id));
    if (entry?.id === id) setEntry(null);
  }

  const r = entry?.report;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandicon"><Sparkles size={23}/></div>
          <div>
            <b>ETSY <span>INTELLIGENCE</span></b>
            <small>SEO Research Studio</small>
          </div>
        </div>

        <div className="navtitle">ÇALIŞMA ALANI</div>

        <button
          className={'nav ' + (view === 'dashboard' ? 'active' : '')}
          onClick={() => setView('dashboard')}
        >
          <BarChart3 size={18}/> Analiz Paneli
        </button>

        <button
          className={'nav ' + (view === 'history' ? 'active' : '')}
          onClick={() => setView('history')}
        >
          <History size={18}/> Analiz Geçmişi
          <em>{history.length}</em>
        </button>

        <div className="asidebottom">
          <ShieldCheck size={17}/> Kaynağa dayalı araştırma
          <small>Gerçek dışı hacim verisi üretilmez.</small>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <div className="eyebrow">ETSY PAZAR ARAŞTIRMASI</div>
            <h1>
              {view === 'history'
                ? 'Analiz Geçmişi'
                : 'Anahtar Kelime Analizi'}
            </h1>
            <p>
              {view === 'history'
                ? 'Kaydettiğin analizleri tekrar aç veya dışa aktar.'
                : 'Etsy pazarı için araştır, rakipleri karşılaştır, daha iyi başlıklar oluştur.'}
            </p>
          </div>
          <div className="avatar">SEO</div>
        </header>

        {view === 'history' ? (
          <section className="panel">
            <h2>Kaydedilen araştırmalar</h2>

            {history.length === 0 ? (
              <p className="muted">Henüz analiz yok.</p>
            ) : (
              <div className="history">
                {history.map(x => (
                  <div className="historyrow" key={x.id}>
                    <div>
                      <b>{x.report.keyword}</b>
                      <small>
                        {new Date(x.createdAt).toLocaleString('tr-TR')}
                        {' · '}Fırsat puanı: {x.report.score}/100
                      </small>
                    </div>
                    <div className="actions">
                      <button onClick={() => {
                        setEntry(x);
                        setView('dashboard');
                        setTab('overview');
                      }}>Aç</button>
                      <button title="Rapor indir" onClick={() => exportExcel(x.id)}>
                        <Download size={16}/>
                      </button>
                      <button title="Sil" onClick={() => remove(x.id)}>
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="searchpanel">
              <div className="searchhead">
                <Sparkles size={20}/>
                <b>Yeni araştırma başlat</b>
              </div>

              <form onSubmit={analyze} className="searchform">
                <Search size={21}/>
                <input
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  maxLength={100}
                  placeholder="Örn. personalized wedding gift, digital planner..."
                />
                <button disabled={loading || keyword.trim().length < 2}>
                  {loading ? (
                    <>
                      <LoaderCircle className="spin" size={18}/>
                      Araştırılıyor
                    </>
                  ) : (
                    <>Analiz Et <span>→</span></>
                  )}
                </button>
              </form>

              <p className="hint">
                Araştırma canlı web araması kullanır.
                Sonuçlar ve fiyatlar zamanla değişebilir.
              </p>
            </section>

            {error && <div className="error">{error}</div>}

            {loading && (
              <div className="loading">
                <LoaderCircle className="spin"/>
                Etsy sonuçları araştırılıyor, bu işlem biraz sürebilir...
              </div>
            )}

            {r ? (
              <>
                <div className="resultheading">
                  <div>
                    <span className="eyebrow">ARAŞTIRMA RAPORU</span>
                    <h2>{r.keyword}</h2>
                    <p>
                      {entry &&
                        new Date(entry.createdAt).toLocaleString('tr-TR')}
                    </p>
                  </div>
                  <button
                    className="export"
                    onClick={() => entry && exportExcel(entry.id)}
                  >
                    <Download size={18}/> Rapor İndir
                  </button>
                </div>

                <div className="stats">
                  <div className="stat">
                    <small>FIRSAT PUANI · TAHMİNİ</small>
                    <strong>{r.score}<span>/100</span></strong>
                    <div className="progress">
                      <i style={{ width: r.score + '%' }}/>
                    </div>
                  </div>
                  <div className="stat">
                    <small>REKABET DEĞERLENDİRMESİ</small>
                    <strong className="stattext">{r.competitionLabel}</strong>
                    <p>Web arama sinyallerine göre</p>
                  </div>
                  <div className="stat">
                    <small>TALEP SİNYALİ</small>
                    <strong className="stattext">{r.demandLabel}</strong>
                    <p>Doğrulanabilen göstergeler</p>
                  </div>
                  <div className="stat">
                    <small>İNCELENEN RAKİP</small>
                    <strong>{r.marketLeaders.length}</strong>
                    <p>Etsy bağlantısı bulunan ürün</p>
                  </div>
                </div>

                <div className="tabs">
                  {([
                    ['overview', 'Genel Bakış'],
                    ['competitors', 'Rakipler'],
                    ['keywords', 'İlgili Kelimeler'],
                    ['titles', 'SEO Başlıkları'],
                    ['sources', 'Kaynaklar']
                  ] as const).map(([id, name]) => (
                    <button
                      className={tab === id ? 'selected' : ''}
                      key={id}
                      onClick={() => setTab(id)}
                    >
                      {name}
                    </button>
                  ))}
                </div>

                <section className="panel content">
                  {tab === 'overview' && (
                    <>
                      <h2>Fırsat değerlendirmesi</h2>
                      <p className="summary">{r.summary}</p>
                      <h3>Veri sınırları</h3>
                      <ul>
                        {r.limitations.map((x, i) => <li key={i}>{x}</li>)}
                      </ul>
                    </>
                  )}

                  {tab === 'competitors' && (
                    <>
                      <h2>Etsy rakip ürünleri</h2>
                      {r.marketLeaders.length ? (
                        <div className="tablewrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Ürün</th>
                                <th>Mağaza</th>
                                <th>Fiyat</th>
                                <th>Bağlantı</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.marketLeaders.map((x, i) => (
                                <tr key={i}>
                                  <td>{x.title}</td>
                                  <td>{x.shopName}</td>
                                  <td>{x.price}</td>
                                  <td>
                                    <a target="_blank" rel="noreferrer" href={x.url}>
                                      <ExternalLink size={17}/>
                                    </a>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="muted">
                          Doğrulanabilir Etsy ürün bağlantısı bulunamadı.
                        </p>
                      )}
                    </>
                  )}

                  {tab === 'keywords' && (
                    <>
                      <h2>İlgili anahtar kelimeler</h2>
                      <div className="tablewrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Anahtar kelime</th>
                              <th>Arama niyeti</th>
                              <th>Rekabet</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.relatedKeywords.map((x, i) => (
                              <tr key={i}>
                                <td>{x.keyword}</td>
                                <td>{x.intent}</td>
                                <td>{x.competition}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {tab === 'titles' && (
                    <>
                      <h2>SEO başlık önerileri</h2>
                      {r.generatedTitles.map((x, i) => (
                        <div className="titleitem" key={i}>
                          <span>{i + 1}</span>
                          <p>{x}</p>
                          <button onClick={() => navigator.clipboard.writeText(x)}>
                            Kopyala
                          </button>
                        </div>
                      ))}
                    </>
                  )}

                  {tab === 'sources' && (
                    <>
                      <h2>Kaynak ve kanıtlar</h2>
                      {r.evidence.length ? (
                        r.evidence.map((x, i) => (
                          <div className="source" key={i}>
                            <p>{x.claim}</p>
                            <a href={x.url} target="_blank" rel="noreferrer">
                              Kaynağı aç <ExternalLink size={14}/>
                            </a>
                          </div>
                        ))
                      ) : (
                        <p className="muted">Kaynak bulunamadı.</p>
                      )}
                    </>
                  )}
                </section>
              </>
            ) : !loading && (
              <section className="empty">
                <div className="emptyicon"><BarChart3 size={34}/></div>
                <h2>İlk analizini başlat</h2>
                <p>
                  Yukarıdaki alana Etsy'de araştırmak istediğin anahtar
                  kelimeyi yaz. Sonuçları otomatik olarak geçmişe kaydedeceğiz.
                </p>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App/>);
