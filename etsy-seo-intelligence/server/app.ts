import 'dotenv/config';
import express from 'express';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { createRepository } from './database.js';
import { ServiceError } from './errors.js';
import { model, research } from './research.js';

const keywordInput = z.object({ keyword: z.string().trim().min(2).max(100).regex(/[\p{L}\p{N}]/u).regex(/^[^\p{Cc}]+$/u) });
const historyInput = z.object({ q: z.string().trim().max(100).default(''), page: z.coerce.number().int().min(1).max(4000).default(1) });
const uuid = z.string().uuid();

const hash = (value: string) => createHash('sha256').update(value).digest();
const equal = (left: string, right: string) => timingSafeEqual(hash(left), hash(right));
const configuredToken = () => process.env.WORKSPACE_ACCESS_TOKEN?.trim() ?? '';
const tokenReady = (token: string) => /^[a-fA-F0-9]{64}$/.test(token);
const cookieValue = (token: string) => createHmac('sha256', token).update('etsy-workspace-session-v1').digest('hex');
const cookieName = () => process.env.VERCEL || process.env.NODE_ENV === 'production' ? '__Host-etsy-workspace' : 'etsy-workspace';

function hasAccess(req: express.Request) {
  const token = configuredToken();
  const value = req.headers.cookie?.split(';').map(item => item.trim()).find(item => item.startsWith(cookieName() + '='))?.split('=')[1];
  return tokenReady(token) && Boolean(value && equal(value, cookieValue(token)));
}

export function createApp(repository = createRepository(), analyze = research) {
  const app = express();
  app.disable('x-powered-by');
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (req, res) => {
    res.json({
      ok: true, openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      databaseConfigured: Boolean(process.env.DATABASE_URL?.trim()), workspaceConfigured: tokenReady(configuredToken()),
      authorized: hasAccess(req), model: model()
    });
  });

  app.post('/api/session', (req, res) => {
    const token = configuredToken();
    if (!tokenReady(token)) throw new ServiceError(503, 'WORKSPACE_MISSING', 'Özel çalışma alanı henüz yapılandırılmadı.');
    const supplied = z.object({ token: z.string().regex(/^[a-fA-F0-9]{64}$/) }).safeParse(req.body);
    if (!supplied.success || !equal(supplied.data.token, token)) {
      throw new ServiceError(403, 'WORKSPACE_LINK_INVALID', 'Çalışma alanı bağlantısı geçersiz. Güncel özel bağlantıyı açın.');
    }
    const name = cookieName();
    res.cookie(name, cookieValue(token), { httpOnly: true, secure: name.startsWith('__Host-'), sameSite: 'strict', path: '/', maxAge: 30 * 86400_000 });
    res.status(204).end();
  });

  app.use(['/api/history', '/api/analyze'], (req, _res, next) => {
    if (!tokenReady(configuredToken())) throw new ServiceError(503, 'WORKSPACE_MISSING', 'Özel çalışma alanı henüz yapılandırılmadı.');
    if (!hasAccess(req)) throw new ServiceError(403, 'WORKSPACE_ACCESS_REQUIRED', 'Analiz ve geçmiş için özel çalışma alanı bağlantısını açın.');
    next();
  });

  app.post('/api/analyze', async (req, res, next) => {
    const input = keywordInput.safeParse(req.body);
    if (!input.success) return next(new ServiceError(400, 'INVALID_KEYWORD', '2–100 karakterlik bir anahtar kelime yazın.'));
    if (!process.env.OPENAI_API_KEY?.trim()) return next(new ServiceError(503, 'OPENAI_KEY_MISSING', 'OpenAI ayarı eksik. Proje yöneticisinin Vercel ortam değişkenlerini kontrol etmesi gerekiyor.'));
    const id = randomUUID();
    try {
      if (!await repository.reserve()) {
        throw new ServiceError(429, 'WORKSPACE_QUOTA', 'Çalışma alanı analiz kotasına ulaştı. Saatte 5, günde 20 analiz yapılabilir.');
      }
      const report = await analyze(input.data.keyword, id);
      res.status(201).json(await repository.save(id, report));
    } catch (error) {
      console.warn('analysis_failed', { id, code: error instanceof ServiceError ? error.code : 'DATABASE_ERROR' });
      next(error);
    }
  });

  app.get('/api/history', async (req, res, next) => {
    try {
      const input = historyInput.safeParse(req.query);
      if (!input.success) throw new ServiceError(400, 'INVALID_FILTER', 'Geçmiş filtresi geçersiz.');
      const rows = await repository.list(input.data.q, (input.data.page - 1) * 25);
      res.json({ items: rows.slice(0, 25), hasMore: rows.length > 25 });
    } catch (error) {
      next(error);
    }
  });

  app.param('id', (_req, _res, next, id) => {
    next(uuid.safeParse(id).success ? undefined : new ServiceError(400, 'INVALID_REPORT_ID', 'Rapor kimliği geçersiz.'));
  });
  app.get('/api/history/:id', async (req, res, next) => {
    try {
      const entry = await repository.get(req.params.id);
      if (!entry) throw new ServiceError(404, 'REPORT_NOT_FOUND', 'Analiz bulunamadı.');
      res.json(entry);
    } catch (error) {
      next(error);
    }
  });
  app.delete('/api/history/:id', async (req, res, next) => {
    try {
      await repository.remove(req.params.id);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'API adresi bulunamadı.' }));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof ServiceError) {
      res.status(error.status).json({ code: error.code, error: error.message });
      return;
    }
    if (error && typeof error === 'object' && 'status' in error && [400, 413].includes(Number(error.status))) {
      res.status(Number(error.status)).json({ error: 'İstek biçimi veya boyutu geçersiz.' });
      return;
    }
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
    console.warn('database_failure', { migrationMissing: code === '42P01' });
    res.status(503).json({ code: 'DATABASE_UNAVAILABLE', error: 'Geçmiş veritabanına erişilemedi. Daha sonra tekrar deneyin.' });
  });
  return app;
}

export default createApp();
