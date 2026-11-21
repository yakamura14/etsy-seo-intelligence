import ExcelJS from 'exceljs';
import { httpsUrl, type Entry } from '../shared/report.js';

const link = (value: string): ExcelJS.CellValue => {
  const url = httpsUrl(value);
  return url ? { text: url.href, hyperlink: url.href, tooltip: 'Kaynağı aç' } : null;
};

export function createWorkbook(entry: Entry) {
  const { report: r } = entry;
  const book = new ExcelJS.Workbook();
  book.creator = 'Etsy SEO Intelligence';
  book.created = new Date(entry.createdAt);

  function sheet(name: string, columns: string[], rows: ExcelJS.CellValue[][]) {
    const tab = book.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 4 }], properties: { tabColor: { argb: 'FF6157ED' } } });
    tab.mergeCells(1, 1, 1, columns.length);
    tab.getCell('A1').value = name;
    tab.getCell('A1').font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
    tab.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF101C33' } };
    tab.getRow(1).height = 33;
    tab.mergeCells(2, 1, 2, columns.length);
    tab.getCell('A2').value = `${r.keyword}  ·  ${new Date(entry.createdAt).toLocaleString('tr-TR')}`;
    tab.getCell('A2').font = { italic: true, color: { argb: 'FF48516F' } };
    const header = tab.getRow(4);
    header.values = columns;
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4941C1' } };
    header.height = 23;
    rows.forEach((values, index) => {
      const row = tab.addRow(values);
      row.alignment = { vertical: 'middle', wrapText: true };
      if (index % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F1FC' } };
      row.eachCell(cell => {
        if (cell.type === ExcelJS.ValueType.Hyperlink) cell.font = { color: { argb: 'FF4941C1' }, underline: true };
      });
    });
    for (const [index, column] of columns.entries()) {
      const lengths = rows.map(row => {
        const value = row[index];
        return value && typeof value === 'object' && 'hyperlink' in value ? value.text.length : String(value ?? '').length;
      });
      tab.getColumn(index + 1).width = Math.min(70, Math.max(16, column.length + 4, ...lengths.map(length => length + 3)));
    }
    rows.forEach((values, index) => {
      const lines = values.map((value, col) => typeof value === 'string'
        ? value.split('\n').reduce((total, line) => total + Math.max(1, Math.ceil(line.length / ((tab.getColumn(col + 1).width ?? 16) - 3))), 0)
        : 1);
      tab.getRow(index + 5).height = Math.min(390, Math.max(22, Math.max(...lines) * 16 + 6));
    });
    tab.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(5, rows.length + 4), column: columns.length } };
  }

  sheet('Genel Özet', ['Gösterge', 'Değer'], [
    ['Tarih', new Date(entry.createdAt).toISOString()],
    ['Arama niyeti', r.intent ?? '—'], ['Fırsat puanı', r.score ?? 'Yetersiz kaynak'],
    ['Rekabet', r.competitionLabel], ['Talep sinyali', r.demandLabel], ['Özet', r.summary],
    ['Hedef müşteri', r.audience ?? '—'], ['Ürün açıklaması', r.description ?? '—'],
    ['Farklılaşma', r.differentiation ?? '—'],
    ...(r.scoreBasis ?? []).map<ExcelJS.CellValue[]>(x => [x.label, `${x.points}/${x.maximum} · ${x.detail}`])
  ]);
  sheet('Rakip Analizi', ['Ürün başlığı', 'Mağaza', 'Fiyat', 'Para birimi', 'Değerlendirme', 'Başlık uzunluğu', 'Kelimeler', 'Güçlü yönler', 'Zayıf yönler', 'Ürün bağlantısı'],
    r.marketLeaders.map(x => [
      x.title, x.shopName, x.price && /^\d+(\.\d+)?$/.test(x.price) ? Number(x.price) : x.price, x.currency ?? null,
      x.reviewCount ?? null, x.title.length, x.keywords?.join(', ') ?? null, x.strengths ?? null, x.weaknesses ?? null, link(x.url)
    ]));
  sheet('Anahtar Kelimeler', ['Anahtar kelime', 'Kategori', 'Arama niyeti', 'Rekabet'],
    r.relatedKeywords.map(x => [x.keyword, x.category ?? null, x.intent, x.competition]));
  sheet('SEO Başlıkları', ['Başlık', 'Karakter sayısı'], r.generatedTitles.map(x => [x, x.length]));
  sheet('Etsy Etiketleri', ['Etiket', 'Karakter sayısı'], (r.tags ?? []).map(x => [x, x.length]));
  sheet('Kaynaklar', ['Gözlem', 'Kaynak bağlantısı'], r.evidence.map(x => [x.claim, link(x.url)]));
  sheet('Analiz Sınırlamaları', ['Sınırlama'], r.limitations.map(x => [x]));
  return book;
}

export async function downloadWorkbook(entry: Entry) {
  const bytes = await createWorkbook(entry).xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `etsy-seo-${entry.report.keyword.replace(/[^\p{L}\p{N}-]+/gu, '-').slice(0, 60)}-${entry.createdAt.slice(0, 10)}.xlsx`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15_000);
}
