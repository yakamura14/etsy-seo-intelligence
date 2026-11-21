import express from 'express';
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

const app = express();
app.use(express.json({limit:'32kb'}));
const PORT=Number(process.env.PORT||3001);
function database(){if(!process.env.DATABASE_URL)throw Error('DATABASE_URL ayarlanmamış');return neon(process.env.DATABASE_URL)}
async function initDb(){await database()`CREATE TABLE IF NOT EXISTS seo_history (id text PRIMARY KEY, created_at timestamptz NOT NULL, report jsonb NOT NULL)`}
function requirePassword(req:any,res:any,next:any){const password=process.env.APP_PASSWORD;if(!password){res.status(503).json({error:'APP_PASSWORD ayarlanmamış'});return}if(req.headers['x-app-password']!==password){res.status(401).json({error:'Giriş şifresi hatalı'});return}next()}
app.use('/api',requirePassword);
const keywordSchema=z.object({keyword:z.string().trim().min(2).max(100)});
const reportSchema=z.object({keyword:z.string(),score:z.number().min(0).max(100),competitionLabel:z.string(),demandLabel:z.string(),summary:z.string(),relatedKeywords:z.array(z.object({keyword:z.string(),intent:z.string(),competition:z.string()})),marketLeaders:z.array(z.object({title:z.string(),price:z.string(),shopName:z.string(),url:z.string()})),generatedTitles:z.array(z.string()),evidence:z.array(z.object({claim:z.string(),url:z.string()})),limitations:z.array(z.string())});
type Report=z.infer<typeof reportSchema>;
type Entry={id:string;createdAt:string;report:Report};
async function readHistory():Promise<Entry[]>{await initDb();const rows=await database()`SELECT id, created_at, report FROM seo_history ORDER BY created_at DESC LIMIT 200`;return rows.map((r:any)=>({id:r.id,createdAt:new Date(r.created_at).toISOString(),report:r.report as Report}))}
async function saveHistory(entry:Entry){await initDb();await database()`INSERT INTO seo_history(id,created_at,report) VALUES (${entry.id},${entry.createdAt},${JSON.stringify(entry.report)}::jsonb)`}
async function deleteHistory(id:string){await initDb();await database()`DELETE FROM seo_history WHERE id=${id}`}
function outputText(obj:any):string{if(typeof obj.output_text==='string')return obj.output_text;return (obj.output||[]).flatMap((x:any)=>x.content||[]).filter((x:any)=>x.type==='output_text').map((x:any)=>x.text).join('\n')}
function parseJson(text:string):unknown{const clean=text.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'').trim();try{return JSON.parse(clean)}catch{const a=clean.indexOf('{'),b=clean.lastIndexOf('}');if(a<0||b<=a)throw Error('Model geçerli JSON döndürmedi');return JSON.parse(clean.slice(a,b+1))}}
async function analyze(keyword:string):Promise<Report>{
 const key=process.env.OPENAI_API_KEY;
 if(!key||key==='sk-your-key-here')throw Error('OPENAI_API_KEY ayarlanmamış. .env dosyasını düzenleyin.');
 const instruction=`You are a cautious Etsy SEO research assistant. Use web search to research Etsy listings for the requested keyword. Prefer searches formatted site:etsy.com <keyword> and Etsy listing pages. Never fabricate listing names, prices, shops, URLs, sales figures, monthly search volumes, CTR, CPC, or historical trends. Ground marketLeaders only in listings actually found, with their real Etsy URLs; if uncertain, leave them out. Use evidence URLs to support claims. No arbitrary monthly search volumes. Score 0-100 is a clearly heuristic opportunity score, not a measured Etsy metric; be conservative if evidence sparse. All narrative text in Turkish. Return ONLY a JSON object with exactly: keyword(string), score(number 0-100), competitionLabel(string), demandLabel(string, qualitative only), summary(string), relatedKeywords(array of {keyword,intent,competition}), marketLeaders(array of {title,price,shopName,url}), generatedTitles(array of strings, Etsy-friendly and avoid keyword stuffing), evidence(array of {claim,url}), limitations(array of strings). If data unavailable use 'Doğrulanamadı' and empty arrays. Include limitation about lack of direct Etsy search volume data.`;
 const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1',instructions:instruction,input:`Etsy anahtar kelimesini araştır: ${keyword}. Gerçek Etsy ürünlerini ve fiyatlarını web aramasıyla doğrula.`,tools:[{type:'web_search_preview'}],max_output_tokens:3500})});
 const payload:any=await response.json();
 if(!response.ok)throw Error(payload.error?.message||`OpenAI API HTTP ${response.status}`);
 const report=reportSchema.parse(parseJson(outputText(payload)));
 report.keyword=keyword;
 report.marketLeaders=report.marketLeaders.filter(x=>{try{const u=new URL(x.url);return u.protocol==='https:'&&(u.hostname==='etsy.com'||u.hostname.endsWith('.etsy.com'))}catch{return false}});
 report.evidence=report.evidence.filter(x=>{try{return new URL(x.url).protocol==='https:'}catch{return false}});
 return report;
}
app.get('/api/health',(_req,res)=>res.json({ok:true,configured:!!process.env.OPENAI_API_KEY}));
app.get('/api/history',async(_req,res)=>{try{res.json(await readHistory())}catch{res.status(500).json({error:'Geçmiş okunamadı'})}});
app.post('/api/analyze',async(req,res)=>{const input=keywordSchema.safeParse(req.body);if(!input.success){res.status(400).json({error:'Anahtar kelime 2-100 karakter olmalı'});return}try{const report=await analyze(input.data.keyword);const entry:Entry={id:randomUUID(),createdAt:new Date().toISOString(),report};await saveHistory(entry);res.json(entry)}catch(e){console.error(e);res.status(502).json({error:e instanceof Error?e.message:'Analiz başarısız'})}});
app.delete('/api/history/:id',async(req,res)=>{try{await deleteHistory(req.params.id);res.json({ok:true})}catch{res.status(500).json({error:'Silinemedi'})}});
app.get('/api/export/:id',async(req,res)=>{try{const entry=(await readHistory()).find(x=>x.id===req.params.id);if(!entry){res.status(404).json({error:'Rapor bulunamadı'});return}const wb=new ExcelJS.Workbook();const r=entry.report;const overview=wb.addWorksheet('Özet');[['Anahtar kelime',r.keyword],['Fırsat puanı (tahmini)',r.score],['Rekabet',r.competitionLabel],['Talep sinyali',r.demandLabel],['Özet',r.summary],['Analiz tarihi',entry.createdAt]].forEach(x=>overview.addRow(x));const leaders=wb.addWorksheet('Rakipler');leaders.addRow(['Ürün başlığı','Fiyat','Mağaza','Etsy bağlantısı']);r.marketLeaders.forEach(x=>leaders.addRow([x.title,x.price,x.shopName,x.url]));const words=wb.addWorksheet('İlgili kelimeler');words.addRow(['Kelime','Arama niyeti','Rekabet']);r.relatedKeywords.forEach(x=>words.addRow([x.keyword,x.intent,x.competition]));const titles=wb.addWorksheet('SEO başlıkları');titles.addRow(['Önerilen başlık']);r.generatedTitles.forEach(x=>titles.addRow([x]));const evidence=wb.addWorksheet('Kaynaklar ve sınırlar');evidence.addRow(['Kanıt','URL']);r.evidence.forEach(x=>evidence.addRow([x.claim,x.url]));r.limitations.forEach(x=>evidence.addRow(['Sınırlama: '+x]));for(const sheet of wb.worksheets){sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF253858'}};sheet.columns.forEach(c=>c.width=35)}res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition',`attachment; filename="etsy-report-${entry.id}.xlsx"`);await wb.xlsx.write(res);res.end()}catch(e){console.error(e);if(!res.headersSent)res.status(500).json({error:'Excel oluşturulamadı'})}});
export default app;
