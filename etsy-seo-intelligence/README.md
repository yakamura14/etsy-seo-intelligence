# Etsy SEO Intelligence — Bulut sürümü

React + Vite ön yüzü, Vercel üzerinde sunucusuz API, Neon Postgres analiz geçmişi, OpenAI web araması ve Excel raporu.

## Bilgisayara program kurmadan yayınlama

1. GitHub hesabı açın. ZIP içindeki **etsy-seo-intelligence** klasörünün içeriğini yeni bir özel (private) GitHub deposuna yükleyin (GitHub web arayüzündeki **Add file → Upload files**).
2. [Neon](https://console.neon.tech/) hesabı açın ve yeni Postgres projesi oluşturun. Bağlantı dizesini (`postgresql://...`) kopyalayın.
3. [OpenAI Platform](https://platform.openai.com/api-keys) üzerinden API anahtarı oluşturun ve faturalandırmayı yapılandırın. ChatGPT Plus API kredisi içermez.
4. [Vercel](https://vercel.com/new) üzerinden GitHub deponuzu **Import** edin. Framework: **Vite**; Root Directory: depo kökü.
5. Vercel proje ayarlarında **Environment Variables** kısmına şu dört değişkeni ekleyin: `OPENAI_API_KEY`, `OPENAI_MODEL` (`gpt-4.1`), `DATABASE_URL` (Neon bağlantısı), `APP_PASSWORD` (güçlü, uzun bir şifre). Bunları GitHub'a yüklemeyin.
6. **Deploy** yapın. Vercel'in verdiği HTTPS adresini evde, işte ve telefonda açabilirsiniz. İlk girişte `APP_PASSWORD` şifrenizi kullanın.
7. Ortam değişkenlerini sonradan değiştirirseniz Vercel'de yeniden dağıtım (Redeploy) yapın.

## Güvenlik ve doğruluk

- API anahtarı sunucu ortam değişkeninde kalır. Parola girişte API'ye özel başlıkla gönderilir ve yalnızca tarayıcı oturumu boyunca tutulur.
- Bu basit tek-kullanıcılı şifre mekanizması ekip/çok kullanıcılı kullanım için yeterli değildir; geniş kullanımda tam kimlik doğrulama, hız sınırlama ve maliyet limitleri ekleyin.
- `DATABASE_URL` ve API anahtarlarını asla sohbete, GitHub'a veya istemci koduna koymayın.
- Etsy'nin gerçek aylık arama hacmi, CTR, CPC ve geçmiş satış verileri doğrulanmadan üretilmez. Fırsat puanı sezgiseldir.
- Canlı dağıtım, gerçek API erişimi ve Neon bağlantısı bu ortamda test edilmemiştir; ilk yayınlamada hata çıkarsa dağıtım günlüklerine göre düzeltilebilir.

## Yerel geliştirme (isteğe bağlı)
`npm install`, ardından `npm run dev`. Kullanıcıların yerel kurulum yapmasına gerek yoktur.
