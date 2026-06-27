# Apartım — PNG ikon üretici
# Kaynak: icons/app-icon-source.png
# Çalıştır: npm install --prefix tools && node tools/build-app-icons.cjs

Write-Host "build-app-icons.cjs calistiriliyor..."
node (Join-Path $PSScriptRoot "build-app-icons.cjs")