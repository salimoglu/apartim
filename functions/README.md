# Haftalık Pazar rapor e-postası

Kullanıcılar uygulamada **yalnızca alıcı e-posta adresini** girer.  
Gönderim **SendGrid** ile yapılır — **bir kez** siz (uygulama sahibi) API anahtarı ayarlarsınız.

## Kurulum (bir kez — sizin)

### 1. SendGrid hesabı

1. [sendgrid.com](https://sendgrid.com) → ücretsiz hesap  
2. **Settings → Sender Authentication → Verify a Single Sender**  
   → Gmail adresinizi doğrulayın (gelen maildeki linke tıklayın)  
3. **Settings → API Keys → Create API Key** → Full Access veya Mail Send  
   → `SG.xxxx...` anahtarını kopyalayın

### 2. Firebase secrets (Notepad + dosyadan — yapıştırma sorunu yok)

Notepad’e API anahtarını yazın → `C:\Users\pc\Desktop\sg-key.txt` kaydedin:

```powershell
cd "c:\Users\pc\Desktop\HESAP KİTAP\apartim"
npx.cmd firebase-tools@latest functions:secrets:set SENDGRID_API_KEY --data-file "C:\Users\pc\Desktop\sg-key.txt" -f
Remove-Item "C:\Users\pc\Desktop\sg-key.txt"
```

Gönderen adres (SendGrid’de doğruladığınız mail):

Notepad → `salimoglu61@gmail.com` → `sg-from.txt`:

```powershell
npx.cmd firebase-tools@latest functions:secrets:set SENDGRID_FROM --data-file "C:\Users\pc\Desktop\sg-from.txt" -f
Remove-Item "C:\Users\pc\Desktop\sg-from.txt"
```

### 3. Deploy

```powershell
npx.cmd firebase-tools@latest deploy --only functions
```

## Kullanıcı tarafı

Ayarlar → **Haftalık rapor e-postası** → istediği adres → Kaydet → Test maili.

Şifre gerekmez.
