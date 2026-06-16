# Apartım — PNG ikon üretici (geçici, System.Drawing tabanlı)
# Üretilen ikonlar PWA için yeterlidir. Daha kaliteli ikonlar için
# tools/build-app-icons.cjs (Node + sharp) tercih edilebilir.

Add-Type -AssemblyName System.Drawing

$iconsDir = Join-Path $PSScriptRoot "..\icons"
if (-not (Test-Path $iconsDir)) { New-Item -ItemType Directory -Path $iconsDir | Out-Null }

function Draw-Icon([int]$size, [string]$outPath) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    # Arka plan (koyu lacivert, yuvarlak köşe)
    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $r = [int]($size * 0.19)
    $path.AddArc($rect.X, $rect.Y, $r, $r, 180, 90)
    $path.AddArc($rect.Right - $r, $rect.Y, $r, $r, 270, 90)
    $path.AddArc($rect.Right - $r, $rect.Bottom - $r, $r, $r, 0, 90)
    $path.AddArc($rect.X, $rect.Bottom - $r, $r, $r, 90, 90)
    $path.CloseFigure()

    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 0)),
        (New-Object System.Drawing.Point(0, $size)),
        [System.Drawing.Color]::FromArgb(27, 42, 58),
        [System.Drawing.Color]::FromArgb(13, 23, 33)
    )
    $g.FillPath($bgBrush, $path)
    $g.SetClip($path)

    # Çatı
    $s = $size / 512.0
    $cati = @(
        (New-Object System.Drawing.PointF((88*$s), (200*$s))),
        (New-Object System.Drawing.PointF((256*$s), (110*$s))),
        (New-Object System.Drawing.PointF((424*$s), (200*$s)))
    )
    $catiBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(91, 42, 23))
    $g.FillPolygon($catiBrush, $cati)

    # Üst kat ahşap
    $ahsap = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(167, 105, 54))
    $g.FillRectangle($ahsap, (166*$s), (200*$s), (180*$s), (80*$s))
    # Orta kat ahşap
    $g.FillRectangle($ahsap, (120*$s), (280*$s), (272*$s), (86*$s))
    # Alt kat taş
    $tas = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(203, 184, 156))
    $g.FillRectangle($tas, (120*$s), (366*$s), (272*$s), (80*$s))

    # Pencereler (cam)
    $cam = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(160, 200, 230))
    $g.FillRectangle($cam, (180*$s), (216*$s), (64*$s), (48*$s))
    $g.FillRectangle($cam, (268*$s), (216*$s), (64*$s), (48*$s))
    $g.FillRectangle($cam, (138*$s), (296*$s), (44*$s), (54*$s))
    $g.FillRectangle($cam, (194*$s), (296*$s), (44*$s), (54*$s))
    $g.FillRectangle($cam, (274*$s), (296*$s), (44*$s), (54*$s))
    $g.FillRectangle($cam, (330*$s), (296*$s), (44*$s), (54*$s))

    # Alt kat kapılar
    $kapi = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(94, 58, 28))
    $g.FillRectangle($kapi, (158*$s), (392*$s), (28*$s), (54*$s))
    $g.FillRectangle($kapi, (326*$s), (392*$s), (28*$s), (54*$s))
    # Alt kat pencereleri
    $g.FillRectangle($cam, (208*$s), (398*$s), (34*$s), (34*$s))
    $g.FillRectangle($cam, (270*$s), (398*$s), (34*$s), (34*$s))

    # Zemin
    $zemin = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(42, 26, 12))
    $g.FillRectangle($zemin, (80*$s), (446*$s), (352*$s), (14*$s))

    $g.Dispose()
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Olusturuldu: $outPath ($size x $size)"
}

Draw-Icon 192 (Join-Path $iconsDir "icon-192.png")
Draw-Icon 256 (Join-Path $iconsDir "icon-256.png")
Draw-Icon 512 (Join-Path $iconsDir "icon-512.png")
Draw-Icon 180 (Join-Path $iconsDir "icon-180.png")
Draw-Icon 48 (Join-Path $iconsDir "favicon-48.png")

# Favicon.ico: 48x48 PNG'yi .ico olarak da kopyala (basit)
Copy-Item -Path (Join-Path $iconsDir "favicon-48.png") -Destination (Join-Path $iconsDir "favicon.ico") -Force
Write-Host "Hepsi tamam."
