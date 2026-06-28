# Haftalık Pazar rapor e-postası (Cloud Functions)

Sezon boyunca (Haziran–Eylül) her **Pazar 08:00** (Europe/Istanbul) rezervasyon özeti `.xls` ek olarak gönderilir.

## Kurulum (bir kez)

### 1. SMTP secrets (Gmail örneği)

Proje kökünde:

```powershell
cd functions
npm install
cd ..

firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASS
```

Gmail için `SMTP_USER` = Gmail adresiniz, `SMTP_PASS` = [uygulama şifresi](https://myaccount.google.com/apppasswords).

Varsayılan SMTP: `smtp.gmail.com:587`. Farklı sağlayıcı için deploy öncesi ortam değişkeni tanımlayabilirsiniz (`SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`).

### 2. Deploy

```powershell
firebase deploy --only functions
```

GitHub Actions ile: **Deploy Firebase Functions** workflow → `workflow_dispatch`.

### 3. Uygulama ayarı

Apartım → Ayarlar → **Haftalık rapor e-postası** → e-posta adresinizi girin → Kaydet → **Test maili gönder** ile doğrulayın.

## Fonksiyonlar

| Ad | Açıklama |
|----|----------|
| `pazarRaporu` | Zamanlanmış — her Pazar 08:00, sezon içinde |
| `raporTestGonder` | Callable — giriş yapmış kullanıcıya anında test raporu |

## Notlar

- Manuel Excel indirme değişmez.
- `raporPazarAktif: false` olan veya e-postası olmayan kullanıcılara gönderilmez.
- SMTP secrets tanımlı değilse deploy sonrası mail gitmez; Firebase Console → Functions loglarından hata görülebilir.
