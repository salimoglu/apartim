# Apartım

Apart-otel takip uygulaması. Daireleri bina silüetinden tıklayarak seçin; her daire için takvim, dolu/boş günler, temizlik durumu ve rezervasyon kayıtlarını tek ekranda yönetin.

## Özellikler

- 3 katlı, 5 daireli (üst kat 1, orta 2, alt 2) interaktif SVG bina ana ekran
- Dairelere tıklayarak aylık takvim görünümü
- Müşteri girişi: giriş tarihi, çıkış tarihi, günlük ücret, otomatik toplam tutar
- Temizlik durumu (temiz / kirli / temizleniyor) ve değişiklik geçmişi
- Web + masaüstü + telefon (PWA) tek kod tabanı
- Firebase Auth (Google + e-posta) ve Realtime Database ile cihazlar arası senkron
- Dark / Light tema

## Teknoloji

- Vanilla HTML / CSS / JavaScript (build adımı yok)
- Firebase Auth + Realtime Database (`firebase-compat` 10.x)
- Service Worker + Web App Manifest (PWA)
- GitHub Pages üzerinde yayın

## Yerel çalıştırma

Statik bir site olduğu için yalnızca dosyaları bir tarayıcıda açmak yeterli, ancak service worker ve Firebase için bir HTTP sunucusu üzerinden açılması önerilir:

```powershell
# Node.js varsa
npx http-server -p 8080 .
# veya Python ile
python -m http.server 8080
```

Sonra tarayıcıda `http://localhost:8080` adresine gidin.

## Firebase yapılandırması

`js/firebase.js` dosyasındaki `firebaseConfig` değerlerini kendi projenizinkilerle değiştirin. Yeni bir Firebase projesi açıp Realtime Database'i etkinleştirmeniz yeterli; ardından `database.rules.json` dosyasındaki güvenlik kuralları her kullanıcının yalnızca kendi verisine erişmesini sağlar.

## Lisans

Tüm hakları saklıdır.
