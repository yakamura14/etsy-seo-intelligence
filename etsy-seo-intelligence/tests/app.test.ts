import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from "node:net";
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import ExcelJS from 'exceljs';
import { createApp } from '../server/app.js';
import { createRepository, type database } from '../server/database.js';
import { research } from '../server/research.js';
import { createWorkbook } from '../src/excel.js';
import { completion, sample, sourceUrl } from './fixtures.js';

const token = 'da'.repeat(32);
const mockKey = 'not-a-real-provider-key';
const db = new PGlite();
const migration = await readFile(new URL('../migrations/001_workspace.sql', import.meta.url), 'utf8');
const repository = createRepository(() => ((parts: TemplateStringsArray, ...values: unknown[]) =>
  db.query(parts.reduce((query, part, i) => query + (i ? '$' + i : '') + part, ''), values).then(result => result.rows)) as ReturnType<typeof database>);
let upstream = () => Response.json(completion());
let upstreamCalls = 0;
const provider: typeof fetch = async (_target, init) => {
  upstreamCalls++;
  const config = JSON.parse(String(init?.body));
  assert.equal(config.tools[0].type, 'web_search');
  assert.equal(config.text.format.strict, true);
  assert.equal(config.store, false);
  return upstream();
};
const expressApp = createApp(repository, (keyword, id) => research(keyword, id, provider));
const server = expressApp.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;

const asJson = (body: unknown, cookie?: string): RequestInit => ({
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body)
});

async function login() {
  const response = await fetch(base + '/api/session', asJson({ token }));
  assert.equal(response.status, 204);
  const setCookie = response.headers.get('Set-Cookie')!;
  assert.match(setCookie, /HttpOnly; SameSite=Strict/);
  assert.ok(!setCookie.includes(token));
  return setCookie.split(';')[0];
}

before(async () => {
  process.env.WORKSPACE_ACCESS_TOKEN = token;
  process.env.OPENAI_API_KEY = mockKey;
  process.env.DATABASE_URL = 'postgresql://fixture';
  await db.exec(migration);
  await db.exec(migration);
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await db.close();
});

test('wall art, source filtering, search, fresh sessions, XLSX round trip and deletion', async () => {
  assert.equal((await fetch(base + '/api/history')).status, 403);
  assert.equal((await fetch(base + '/api/analyze', asJson({ keyword: 'wall art' }))).status, 403);
  assert.equal(upstreamCalls, 0);
  assert.equal((await fetch(base + '/api/session', asJson({ token: 'dd'.repeat(32) }))).status, 403);
  const cookie = await login();
  assert.equal((await fetch(base + '/api/analyze', asJson({ keyword: '\n!' }, cookie))).status, 400);
  const response = await fetch(base + '/api/analyze', asJson({ keyword: '  wall art  ' }, cookie));
  assert.equal(response.status, 201);
  assert.match(response.headers.get('Cache-Control')!, /no-store/);
  const entry = await response.json();
  assert.equal(entry.report.keyword, 'wall art');
  assert.equal(entry.report.marketLeaders.length, 3);
  assert.equal(entry.report.marketLeaders[0].url, sourceUrl);
  assert.equal(entry.report.evidence.length, 3);
  assert.equal(entry.report.score, 52);
  assert.equal(entry.report.generatedTitles.length, 10);
  assert.equal(entry.report.tags.length, 13);

  const anotherBrowser = { headers: { cookie: await login() } };
  const history = await fetch(base + '/api/history?q=WALL', anotherBrowser).then(result => result.json());
  assert.equal(history.items[0].id, entry.id);
  const empty = await fetch(base + '/api/history?q=no-match', anotherBrowser).then(result => result.json());
  assert.deepEqual(empty.items, []);
  const reopened = await fetch(base + '/api/history/' + entry.id, anotherBrowser).then(result => result.json());
  assert.deepEqual(reopened, entry);

  const binary = await createWorkbook(reopened).xlsx.writeBuffer();
  assert.equal(Buffer.from(binary).subarray(0, 2).toString(), 'PK');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(binary);
  assert.deepEqual(workbook.worksheets.map(tab => tab.name), ['Genel Özet', 'Rakip Analizi', 'Anahtar Kelimeler', 'SEO Başlıkları', 'Etsy Etiketleri', 'Kaynaklar', 'Analiz Sınırlamaları']);
  const rivals = workbook.getWorksheet('Rakip Analizi')!;
  assert.equal(rivals.getCell('J5').hyperlink, sourceUrl);
  assert.equal(rivals.getCell('B5').text, 'Örnek Mağaza');
  assert.equal(rivals.getCell('C5').value, 12.9);
  assert.ok(rivals.autoFilter);
  assert.equal((await fetch(base + '/api/history/' + entry.id, { ...anotherBrowser, method: 'DELETE' })).status, 204);
  assert.equal((await fetch(base + '/api/history/' + entry.id, anotherBrowser)).status, 404);
});

test('missing, invalid and restricted OpenAI keys, quota, incomplete and invalid output', async () => {
  const cookie = await login();
  delete process.env.OPENAI_API_KEY;
  const missing = await fetch(base + '/api/analyze', asJson({ keyword: 'wall art' }, cookie));
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).code, 'OPENAI_KEY_MISSING');
  process.env.OPENAI_API_KEY = mockKey;
  for (const [status, providerCode, userCode] of [
    [401, 'invalid_api_key', 'OPENAI_KEY_INVALID'], [403, 'forbidden', 'OPENAI_FORBIDDEN'],
    [429, 'insufficient_quota', 'OPENAI_QUOTA']
  ] as const) {
    upstream = () => Response.json({ error: { code: providerCode, message: mockKey } }, { status });
    const response = await fetch(base + '/api/analyze', asJson({ keyword: 'wall art' }, cookie));
    const result = await response.text();
    assert.equal(JSON.parse(result).code, userCode);
    assert.ok(!result.includes(mockKey));
  }
  upstream = () => Response.json({ status: 'incomplete' });
  await assert.rejects(research('wall art', 'fixture', provider), { code: 'OPENAI_INCOMPLETE' });
  upstream = () => Response.json(completion({ ...sample, tags: ['x'.repeat(21)] }));
  await assert.rejects(research('wall art', 'fixture', provider), { code: 'SEO_SUGGESTIONS_INVALID' });
  upstream = () => Response.json({ ...completion(), output: completion().output.slice(1) });
  await assert.rejects(research('wall art', 'fixture', provider), { code: 'OPENAI_SEARCH_MISSING' });

  upstream = () => Response.json({ error: { code: 'rate_limit_exceeded' } }, { status: 429, headers: { 'Retry-After': '8' } });
  await assert.rejects(research('wall art', 'fixture', provider), { code: 'OPENAI_RATE_LIMIT' });
  let tries = 0;
  upstream = () => ++tries === 1
    ? Response.json({}, { status: 500, headers: { 'Retry-After': '0' } })
    : Response.json(completion());
  assert.equal((await research('wall art', 'fixture', provider)).score, 52);
  assert.equal(tries, 2);
  upstream = () => Response.json({}, { status: 500, headers: { 'Retry-After': '0' } });
  await assert.rejects(research('wall art', 'fixture', provider), { code: 'OPENAI_UNAVAILABLE' });
  const health = await fetch(base + '/api/health').then(result => result.text());
  assert.ok(!health.includes(mockKey) && !health.includes(token) && !health.includes('postgresql'));
});

test('concurrent requests share five hourly slots and twenty daily slots', async () => {
  await db.exec('TRUNCATE etsy_analysis_quota');
  const accepted = await Promise.all(Array.from({ length: 12 }, () => repository.reserve()));
  assert.equal(accepted.filter(Boolean).length, 5);
  await db.exec("UPDATE etsy_analysis_quota SET hour_start = hour_start - interval '1 hour', day_count = 19");
  assert.equal(await repository.reserve(), true);
  assert.equal(await repository.reserve(), false);
  const cookie = await login();
  const response = await fetch(base + '/api/analyze', asJson({ keyword: 'wall art' }, cookie));
  assert.equal(response.status, 429);
  assert.equal((await response.json()).code, 'WORKSPACE_QUOTA');
});
