import { neon } from '@neondatabase/serverless';
import type { Entry, Report } from '../shared/report.js';
import { ServiceError } from './errors.js';

export const database = () => {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new ServiceError(503, 'DATABASE_MISSING', 'Geçmiş veritabanı yapılandırılmamış. Proje yöneticisine başvurun.');
  return neon(url, { fetchOptions: { signal: AbortSignal.timeout(5000) } });
};

export function createRepository(connect = database) {
  return {
    async reserve() {
      const sql = connect();
      const rows = await sql`
        INSERT INTO etsy_analysis_quota (day, day_count, hour_start, hour_count)
        VALUES ((now() AT TIME ZONE 'UTC')::date, 1, date_trunc('hour', now(), 'UTC'), 1)
        ON CONFLICT (day) DO UPDATE SET
          day_count = etsy_analysis_quota.day_count + 1,
          hour_start = greatest(EXCLUDED.hour_start, etsy_analysis_quota.hour_start),
          hour_count = CASE WHEN EXCLUDED.hour_start > etsy_analysis_quota.hour_start THEN 1
                            ELSE etsy_analysis_quota.hour_count + 1 END
        WHERE etsy_analysis_quota.day_count < 20
          AND (EXCLUDED.hour_start > etsy_analysis_quota.hour_start OR etsy_analysis_quota.hour_count < 5)
        RETURNING day_count`;
      return rows.length > 0;
    },
    async save(id: string, report: Report): Promise<Entry> {
      const rows = await connect()`
        INSERT INTO etsy_reports (id, keyword, report)
        VALUES (${id}, ${report.keyword}, ${JSON.stringify(report)}::jsonb)
        RETURNING created_at AS "createdAt"`;
      return { id, report, createdAt: rows[0].createdAt };
    },
    async list(query: string, offset: number) {
      return connect()`
        SELECT id, created_at AS "createdAt", keyword, report->'score' AS score
        FROM etsy_reports
        WHERE strpos(lower(keyword), lower(${query})) > 0 OR ${query} = ''
        ORDER BY created_at DESC, id DESC
        LIMIT 26 OFFSET ${offset}`;
    },
    async get(id: string) {
      const rows = await connect()`SELECT id, created_at AS "createdAt", report FROM etsy_reports WHERE id = ${id}`;
      return rows[0] ?? null;
    },
    async remove(id: string) {
      await connect()`DELETE FROM etsy_reports WHERE id = ${id}`;
    }
  };
}
