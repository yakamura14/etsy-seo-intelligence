import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, BarChart3, Download, ExternalLink, FileSpreadsheet, History, LoaderCircle,
  Menu, Moon, Search, ShieldCheck, Sparkles, Sun, Tags, Trash2, Users
} from 'lucide-react';
import { httpsUrl, type Entry } from '../shared/report.js';
import './style.css';

const navigation = [
  ['dashboard', 'Dashboard', BarChart3],
  ['keywords', 'Anahtar Kelime Analizi', Search],
  ['competitors', 'Rakip Analizi', Users],
  ['seo', 'SEO Başlık ve Etiket Oluşturucu', Tags],
  ['history', 'Analiz Geçmişi', History],
  ['reports', 'Raporlar', FileSpreadsheet],
  ['status', 'Sistem Durumu', Activity]
] as const;

type View = typeof navigation[number][0];
type Health = { openaiConfigured: boolean; databaseConfigured: boolean; workspaceConfigured: boolean; authorized: boolean; model: string };
type HistoryItem = { id: string; createdAt: string; keyword: string; score: number | null };
type HistoryResult = { items: HistoryItem[]; hasMore: boolean };
const historyKey = 'etsy_seo_history_v1';
const formatDate = (value: string) => new Date(value).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch('/api' + path, { ...init, cache: 'no-store' });
  if (response.ok && response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error ?? 'Sunucudan yanıt alınamadı. Daha sonra tekrar deneyin.');
  return data as T;
}

function readLegacy(): Entry[] {
  try {
    const entries: unknown = JSON.parse(localStorage.getItem(historyKey) ?? '[]');
    if (!Array.isArray(entries)) return [];
    return entries.filter(item => item && typeof item.id === 'string' &&
      typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt)) &&
      typeof item.report?.keyword === 'string' &&
      ['relatedKeywords', 'marketLeaders', 'generatedTitles', 'evidence', 'limitations'].every(key => Array.isArray(item.report[key])));
  } catch {
    return [];
  }
}

function initialView(): View {
  const page = new URLSearchParams(location.hash.slice(1)).get('view');
  return navigation.find(item => item[0] === page)?.[0] ?? 'dashboard';
}

function Link({ url, children }: { url: string; children: React.ReactNode }) {
  const safe = httpsUrl(url);
  return safe ? <a href={safe.href} target="_blank" rel="noreferrer">{children} <ExternalLink size={14}/></a> : null;
}

function App() {
  const [view, setView] = useState<View>(initialView);
  const [menu, setMenu] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('etsy_theme') === 'dark');
  const [health, setHealth] = useState<Health | null>(null);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [keyword, setKeyword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState(false);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<HistoryResult>({ items: [], hasMore: false });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [legacy, setLegacy] = useState(readLegacy);
  const [refresh, setRefresh] = useState(0);
  const [competitorFilter, setCompetitorFilter] = useState('');
  const [sort, setSort] = useState('source');

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('etsy_theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    const update = () => setView(initialView());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  useEffect(() => {
    async function connect() {
      const hash = new URLSearchParams(location.hash.slice(1));
      const token = hash.get('access');
      if (token !== null) {
        hash.delete('access');
        const remaining = hash.toString();
        window.history.replaceState(null, '', location.pathname + location.search + (remaining ? '#' + remaining : ''));
        try {
          await request('/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
          setNotice('Çalışma alanı açıldı.');
        } catch (reason) {
          setError(String((reason as Error).message));
        }
      }
      try {
        setHealth(await request<Health>('/health'));
      } catch (reason) {
        setError((reason as Error).message);
      }
    }
    void connect();
  }, [refresh]);

  useEffect(() => {
    if (!health?.authorized || !['history', 'reports', 'dashboard'].includes(view)) return;
    const controller = new AbortController();
    setHistoryLoading(true);
    const query = new URLSearchParams({ q: view === 'dashboard' ? '' : filter, page: String(view === 'dashboard' ? 1 : page) });
    const debounce = setTimeout(async () => {
      try {
        const result = await request<HistoryResult>('/history?' + query, { signal: controller.signal });
        if (!controller.signal.aborted) setHistory(result);
      } catch (reason) {
        if (!controller.signal.aborted) setError((reason as Error).message);
      } finally {
        if (!controller.signal.aborted) setHistoryLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
  }, [health?.authorized, view, filter, page, refresh]);

  function go(next: View) {
    setView(next);
    setMenu(false);
    setError('');
    setPage(1);
    location.hash = 'view=' + next;
  }

  async function analyze(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !health?.authorized) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await request<Entry>('/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword: keyword.trim() })
      });
      setEntry(result);
      setCompetitorFilter('');
      setSort('source');
      setRefresh(value => value + 1);
      go('keywords');
      setNotice('Analiz çalışma alanına kaydedildi.');
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handle(work: () => Promise<void>) {
    setError('');
    setNotice('');
    setWorking(true);
    try {
      await work();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function load(id: string, local = false) {
    if (!local) return request<Entry>('/history/' + encodeURIComponent(id));
    const report = legacy.find(item => item.id === id);
    if (!report) throw new Error('Tarayıcıdaki rapor bulunamadı.');
    return report;
  }

  function open(id: string, local = false) {
    void handle(async () => {
      setEntry(await load(id, local));
      setCompetitorFilter('');
      setSort('source');
      go('keywords');
    });
  }

  function download(id: string, local = false, selected?: Entry) {
    void handle(async () => {
      const [record, workbook] = await Promise.all([selected ?? load(id, local), import('./excel')]);
      await workbook.downloadWorkbook(record);
      setNotice('Excel raporu hazırlandı.');
    });
  }

  function remove(id: string, local = false) {
    if (!window.confirm('Bu analiz silinsin mi?')) return;
    void handle(async () => {
      if (local) {
        const remaining = legacy.filter(item => item.id !== id);
        localStorage.setItem(historyKey, JSON.stringify(remaining));
        setLegacy(remaining);
      } else {
        await request('/history/' + encodeURIComponent(id), { method: 'DELETE' });
        if (history.items.length === 1 && page > 1) setPage(page - 1);
        setRefresh(value => value + 1);
      }
      if (entry?.id === id) setEntry(null);
      setNotice('Analiz silindi.');
    });
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice('Panoya kopyalandı.');
    } catch {
      setError('Panoya kopyalanamadı. Metni seçerek kopyalayabilirsiniz.');
    }
  }

  const result = entry?.report;
  const competitors = (result?.marketLeaders ?? []).filter(item =>
    [item.title, item.shopName, ...(item.keywords ?? [])].join(' ').toLocaleLowerCase('tr').includes(competitorFilter.toLocaleLowerCase('tr')));
  if (sort === 'reviews') competitors.sort((a, b) => (b.reviewCount ?? -1) - (a.reviewCount ?? -1));
  if (sort === 'title') competitors.sort((a, b) => a.title.localeCompare(b.title, 'tr'));
  if (sort === 'length') competitors.sort((a, b) => b.title.length - a.title.length);
  const current = navigation.find(item => item[0] === view)!;
  const needsReport = ['keywords', 'competitors', 'seo'].includes(view);
  const waiting = health?.authorized === false;
  const legacyShown = legacy.filter(item => item.report.keyword.toLocaleLowerCase('tr').includes(filter.toLocaleLowerCase('tr')));
  const metric = (value: number | null) => value === null ? '—' : `${value}/100`;

  const printRow = (item: HistoryItem, local = false, deletable = true) => (
    <div className="historyrow" key={item.id}>
      <div><b>{item.keyword}</b><small>{formatDate(item.createdAt)} · Fırsat puanı {metric(item.score)}</small></div>
      <div className="actions">
        <button disabled={working} onClick={() => open(item.id, local)}>Aç</button>
        <button disabled={working} aria-label={`${item.keyword} Excel raporunu indir`} onClick={() => download(item.id, local)}><Download size={17}/></button>
        {deletable && <button disabled={working} aria-label={`${item.keyword} analizini sil`} onClick={() => remove(item.id, local)}><Trash2 size={17}/></button>}
      </div>
    </div>
  );

  const list = (preview = false) => (
    <section className="panel" aria-busy={historyLoading}>
      <div className="sectionhead"><h2>{preview ? 'Son analizler' : 'Kaydedilen analizler'}</h2>
        {preview && history.items.length > 0 && <button className="secondary" onClick={() => go('history')}>Tüm geçmiş</button>}
      </div>
      {!preview && <label className="control">Anahtar kelimeyle ara
        <input value={filter} maxLength={100} onChange={event => { setFilter(event.target.value); setPage(1); }} placeholder="Örn. wall art"/>
      </label>}
      {historyLoading ? <p className="muted">Geçmiş yükleniyor…</p>
        : history.items.length ? history.items.slice(0, preview ? 5 : 25).map(item => printRow(item, false, view === 'history'))
          : <p className="muted">{filter && !preview ? 'Bu aramayla eşleşen analiz bulunamadı.' : 'Henüz analiz yok.'}</p>}
      {!preview && (page > 1 || history.hasMore) && <div className="pagination">
        <button className="secondary" disabled={page === 1 || historyLoading} onClick={() => setPage(page - 1)}>Önceki</button>
        <span>Sayfa {page}</span>
        <button className="secondary" disabled={!history.hasMore || historyLoading} onClick={() => setPage(page + 1)}>Sonraki</button>
      </div>}
    </section>
  );

  return <div className="app">
    <aside className="sidebar">
      <div className="brand">
        <span className="brandicon"><Sparkles size={21}/></span>
        <div><b>ETSY <span>INTELLIGENCE</span></b><small>SEO Araştırma Paneli</small></div>
        <button className="menu-toggle" aria-label="Gezinme menüsü" aria-expanded={menu} onClick={() => setMenu(!menu)}><Menu size={23}/></button>
      </div>
      <nav className={menu ? 'navigation expanded' : 'navigation'} aria-label="Çalışma alanı">
        {navigation.map(([id, name, Icon]) => <button key={id} className={'nav ' + (id === view ? 'active' : '')}
          aria-current={id === view ? 'page' : undefined} onClick={() => go(id)}><Icon size={19}/>{name}</button>)}
      </nav>
      <div className="asidebottom"><ShieldCheck size={16}/> Özel çalışma alanı</div>
    </aside>
    <main>
      <header>
        <div><p className="eyebrow">ETSY PAZAR ARAŞTIRMASI</p><h1>{current[1]}</h1></div>
        <button className="secondary theme" aria-label={dark ? 'Açık temaya geç' : 'Koyu temaya geç'} onClick={() => setDark(!dark)}>
          {dark ? <Sun size={19}/> : <Moon size={19}/>}
        </button>
      </header>
      {error && <p role="alert" className="error">{error}</p>}
      {notice && <p role="status" className="notice">{notice}</p>}
      {waiting && view !== 'status' && <p className="access"><ShieldCheck size={19}/>{health.workspaceConfigured
        ? 'Analiz ve kayıtlı raporlar için size verilen özel çalışma alanı bağlantısını açın.'
        : 'Özel çalışma alanı henüz yapılandırılmadı.'}</p>}

      {(view === 'dashboard' || view === 'keywords') && <section className="searchpanel">
        <h2>Yeni araştırma</h2>
        <form className="searchform" onSubmit={analyze}>
          <Search size={20}/><input aria-label="Etsy anahtar kelimesi" value={keyword} maxLength={100} onChange={event => setKeyword(event.target.value)} placeholder="Örn. wall art"/>
          <button className="primary" disabled={busy || !health?.authorized || keyword.trim().length < 2}>{busy ? 'Araştırılıyor…' : 'Analiz et'}</button>
        </form>
        <p className="muted">Etsy ürünlerini ve SEO fırsatlarını web kaynaklarıyla inceleyin.</p>
      </section>}
      {busy && <section role="status" className="loading panel"><LoaderCircle className="spin" size={22}/><div>
        <b>Etsy kaynakları taranıyor</b><p className="muted">Kaynaklar inceleniyor ve öneriler hazırlanıyor. İşlem bir dakikadan uzun sürebilir.</p>
        <progress aria-label="Araştırma devam ediyor"/>
      </div></section>}

      {view === 'dashboard' && health?.authorized && list(true)}
      {(view === 'history' || view === 'reports') && <>
        {health?.authorized && list()}
        {!!legacy.length && <section className="panel"><h2>Bu tarayıcıdaki eski analizler</h2>
          <p className="muted">Bu kayıtlar önceki sürümde bu tarayıcıya kaydedildi.</p>
          {legacyShown.map(item => printRow({ id: item.id, createdAt: item.createdAt, keyword: item.report.keyword, score: item.report.score }, true, view === 'history'))}
        </section>}
      </>}

      {needsReport && !result && !busy && <section className="panel empty">
        <BarChart3 size={30}/><h2>Rapor seçilmedi</h2>
        <p className="muted">Yeni araştırma başlatabilir veya geçmişteki bir raporu açabilirsiniz.</p>
        {view !== 'keywords' && <button className="secondary" onClick={() => go('keywords')}>Araştırmaya git</button>}
      </section>}
      {needsReport && entry && result && <>
        <div className="resultheading">
          <div><h2>{result.keyword}</h2><p className="muted">{formatDate(entry.createdAt)}</p></div>
          <button className="primary" disabled={working} onClick={() => download(entry.id, false, entry)}><Download size={17}/> Excel indir</button>
        </div>
        {view === 'keywords' && <>
          <div className="stats">
            <div className="stat"><small>Fırsat puanı</small><strong>{metric(result.score)}</strong>
              {result.score !== null && <meter min={0} max={100} value={result.score} aria-label="Fırsat puanı"/>}
            </div>
            <div className="stat"><small>Rekabet</small><b>{result.competitionLabel}</b></div>
            <div className="stat"><small>Talep sinyali</small><b>{result.demandLabel}</b></div>
            <div className="stat"><small>Kaynaklı ürünler</small><strong>{result.marketLeaders.length}</strong></div>
          </div>
          <section className="panel">
            <h2>Arama niyeti ve fırsatlar</h2>
            {result.intent && <p><b>Arama niyeti</b> · {result.intent}</p>}
            <p>{result.summary}</p>
            {result.scoreBasis?.map(item => <div className="score-row" key={item.label}>
              <div><b>{item.label}</b><span>{item.points}/{item.maximum}</span></div>
              <meter min={0} max={item.maximum} value={item.points} aria-label={item.label}/>
              <small>{item.detail}</small>
            </div>)}
          </section>
          <section className="panel"><h2>Anahtar kelime önerileri</h2>
            <div className="tablewrap"><table><thead><tr><th>Anahtar kelime</th><th>Kategori</th><th>Niyet</th><th>Rekabet</th></tr></thead>
              <tbody>{result.relatedKeywords.map((item, i) => <tr key={i}><td>{item.keyword}</td><td>{item.category ?? '—'}</td><td>{item.intent}</td><td>{item.competition}</td></tr>)}</tbody>
            </table></div>
          </section>
          <section className="panel"><h2>Kaynaklar ve veri sınırları</h2>
            {result.evidence.map((item, i) => <div className="source" key={i}><p>{item.claim}</p><Link url={item.url}>Kaynağı aç</Link></div>)}
            <ul>{result.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul>
          </section>
        </>}
        {view === 'competitors' && <section className="panel"><h2>Etsy ürünleri</h2>
          <div className="filters">
            <label className="control">Ürün veya mağaza ara<input value={competitorFilter} onChange={event => setCompetitorFilter(event.target.value)}/></label>
            <label className="control">Sırala<select value={sort} onChange={event => setSort(event.target.value)}>
              <option value="source">Araştırma sırası</option><option value="title">Ürün adı</option>
              <option value="reviews">Değerlendirme sayısı</option><option value="length">Başlık uzunluğu</option>
            </select></label>
          </div>
          {competitors.length ? <div className="tablewrap"><table>
            <thead><tr><th>Ürün</th><th>Mağaza</th><th>Fiyat</th><th>Değerlendirme</th><th>Başlık ve kelimeler</th><th>SEO değerlendirmesi</th></tr></thead>
            <tbody>{competitors.map((item, i) => <tr key={item.url + i}>
              <td><Link url={item.url}>{item.title}</Link></td><td>{item.shopName ?? '—'}</td>
              <td>{item.price ? [item.price, item.currency].filter(Boolean).join(' ') : '—'}</td><td>{item.reviewCount ?? '—'}</td>
              <td>{item.title.length} karakter{item.keywords?.length ? <small>{item.keywords.join(', ')}</small> : null}</td>
              <td>{item.strengths && <p><b>Güçlü</b> · {item.strengths}</p>}{item.weaknesses && <p><b>Zayıf</b> · {item.weaknesses}</p>}</td>
            </tr>)}</tbody>
          </table></div> : <p className="muted">{competitorFilter ? 'Filtreye uygun ürün yok.' : 'Web aramasında kaynaklı Etsy ürün sayfası bulunamadı.'}</p>}
        </section>}
        {view === 'seo' && <>
          <section className="panel"><h2>SEO başlıkları</h2>{result.generatedTitles.map((title, i) =>
            <div className="titleitem" key={i}><p>{title}<small>{title.length} / 140 karakter</small></p><button className="secondary" onClick={() => copy(title)}>Kopyala</button></div>)}</section>
          <section className="panel"><div className="sectionhead"><h2>Etsy etiketleri</h2>
            {result.tags?.length ? <button className="secondary" onClick={() => copy(result.tags!.join(', '))}>Tümünü kopyala</button> : null}
          </div>
            {result.tags?.length ? <div className="chips">{result.tags.map(tag =>
              <button className="secondary" key={tag} aria-label={`${tag} etiketini kopyala`} onClick={() => copy(tag)}>{tag}</button>)}</div>
              : <p className="muted">Bu raporda kayıtlı etiket bulunmuyor.</p>}
          </section>
          {result.description && <section className="panel"><div className="sectionhead"><h2>Ürün açıklaması</h2>
            <button className="secondary" onClick={() => copy(result.description!)}>Kopyala</button></div><p className="multiline">{result.description}</p></section>}
          {result.audience && <section className="panel"><h2>Hedef müşteri</h2><p>{result.audience}</p><h3>Farklılaşma stratejisi</h3><p>{result.differentiation}</p></section>}
        </>}
      </>}
      {view === 'status' && <section className="panel">
        <div className="sectionhead"><h2>Yapılandırma durumu</h2><button className="secondary" onClick={() => setRefresh(value => value + 1)}>Yenile</button></div>
        {health ? <dl className="status-list">
          <dt>Uygulama API’si</dt><dd>Yanıt veriyor</dd>
          <dt>OpenAI anahtarı</dt><dd>{health.openaiConfigured ? 'Tanımlı' : 'Eksik'}</dd>
          <dt>OpenAI modeli</dt><dd>{health.model}</dd>
          <dt>Veritabanı bağlantı ayarı</dt><dd>{health.databaseConfigured ? 'Tanımlı' : 'Eksik'}</dd>
          <dt>Özel çalışma alanı</dt><dd>{health.authorized ? 'Erişim etkin' : health.workspaceConfigured ? 'Özel bağlantı gerekli' : 'Yapılandırma eksik'}</dd>
        </dl> : <p className="muted">Durum bilgisi henüz alınamadı.</p>}
        <p className="muted">OpenAI anahtarı ve web arama yetkisi analiz sırasında, veritabanı bağlantısı geçmiş açılırken sınanır.</p>
      </section>}
    </main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App/>);
