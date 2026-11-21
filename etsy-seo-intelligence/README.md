# Etsy SEO Intelligence

Türkçe Etsy araştırma paneli. OpenAI Responses API üzerinden kaynaklı rakip araştırması, SEO önerileri, PostgreSQL’de ortak çalışma alanı geçmişi ve yedi sayfalı Excel raporları üretir.

## Vercel ve Neon kurulumu

Vercel projesinin kök dizini `etsy-seo-intelligence` olmalıdır. Preview için Neon’da ayrı bir veritabanı dalı kullanın. Neon SQL Editor’da [veritabanı kurulum dosyasını](migrations/001_workspace.sql) çalıştırın. Bu dosya tekrar çalıştırılabilir.

Vercel projesinin **Settings → Environment Variables** bölümünde aşağıdaki değişkenleri önce **Preview** kapsamına ekleyin.

| Değişken | Değer |
| --- | --- |
| `OPENAI_API_KEY` | Responses API ve web aramasına erişimi olan OpenAI proje anahtarı. Projenin kullanım kotası ve faturalandırması etkin olmalı. |
| `DATABASE_URL` | Preview için Neon bağlantı dizesi. |
| `WORKSPACE_ACCESS_TOKEN` | Sunucu için kriptografik olarak üretilmiş 32 rastgele baytın 64 karakterlik onaltılık gösterimi. |
| `OPENAI_MODEL` | İsteğe bağlı model. Varsayılan `gpt-4.1-mini`. Responses API, web araması ve Structured Outputs desteği gerekir. |

Değişkenleri ekledikten sonra Preview’ı yeniden dağıtın. Özel çalışma alanını açmak için yayınlanan adresin sonuna `/#access=<WORKSPACE_ACCESS_TOKEN>` ekleyin ve oluşan bağlantıyı yalnızca yetkili kişilerle güvenli bir kanaldan paylaşın. Adresi açmak, o tarayıcıya 30 günlük güvenli oturum tanımlar. Erişim değeri adres çubuğundan kaldırılır. İkinci cihazda aynı özel bağlantıyı açmak geçmişe erişim sağlar. Erişimi iptal etmek için Vercel’de çalışma alanı token’ını değiştirip yeniden dağıtın. Production için ayrı bağlantı dizesi ve ayrı token kullanın.

Çalışma alanı tek bir paylaşılan geçmiş kullanır. Analiz başlatma, geçmişi okuma ve silme işlemlerinin tamamı bu alanla sınırlıdır. Saatte 5 ve günde 20 analiz hakkı UTC saat diliminde veritabanında tutulur ve tüm sunucu örneklerinde ortaktır. OpenAI’ye giden bir analiz denemesi başarısız olursa ayrılan kota bu zaman aralığında kullanılmış sayılır. OpenAI hesabında proje bütçesi ayrıca yönetilebilir.

## Davranış

- Yeni analizler veritabanına yazıldıktan sonra tarayıcıya döner. Önceki sürümden kalan yerel kayıtlar kendi tarayıcısında açılabilir ve XLSX olarak indirilebilir.
- Ürün URL’leri OpenAI web aramasının sağladığı Etsy ürün kaynaklarıyla eşleşir. Ürün ayrıntıları arama kaynağından çıkarılır. Kaynağın sunmadığı alanlar boş bırakılır. Ürün bilgileri zamanla değişebilir.
- En az üç kaynaklı ürün olduğunda fırsat puanı hesaplanır. Puanın 60 puana kadarlık bölümü örnek başlıklarda tam anahtar kelime ifadesinin bulunmamasına, 40 puana kadarlık bölümü farklı long-tail ve niş önerilerine dayanır.
- Başlıkların 140 karakter sınırı ve etiketlerin 20 karakter sınırı kontrol edilir. Her raporda 10 benzersiz başlık ve 13 benzersiz etiket gerekir. [Etsy ilan kılavuzu](https://help.etsy.com/hc/en-us/articles/115015628707-How-to-Create-a-Listing) · [Etsy etiket kılavuzu](https://help.etsy.com/hc/en-us/articles/360000336307-How-to-Use-Tags-to-Get-Found-in-Search)
- Sistem Durumu, sunucu ayarlarının tanımlı olup olmadığını gösterir. Uçtan uca erişim Preview’da analiz ve geçmiş açılarak doğrulanır.

## Geliştirme ve test

Node.js 22 veya üzeri gerekir. Bağımlılıkları `npm ci` ile yükleyin. Geliştirme için `npm run dev`, derleme için `npm run build`, otomatik testler için `npm test` kullanılır. Yerel .env ile bağlanılan Neon veritabanına migration uygulamak için `npm run db:migrate` kullanılabilir. Testler lisanslı veya ücretli bir API çağrısı yapmadan OpenAI yanıtlarını taklit eder ve geçici PostgreSQL üzerinde çalışır.
