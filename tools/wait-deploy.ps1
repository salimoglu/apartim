# Canli GitHub Pages surumunu main ile karsilastirir.
# Kullanim: .\tools\wait-deploy.ps1
#           .\tools\wait-deploy.ps1 -Expected "2.66" -TimeoutSec 480

param(
  [string]$Expected = "",
  [int]$TimeoutSec = 480,
  [int]$IntervalSec = 15
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

if (-not $Expected) {
  $verFile = Join-Path $root "js\version.js"
  if (Test-Path $verFile) {
    $content = Get-Content $verFile -Raw
    if ($content -match 'APP\s*=\s*"([^"]+)"') {
      $Expected = $Matches[1]
    }
  }
}

if (-not $Expected) {
  Write-Error "Beklenen surum bulunamadi. -Expected parametresi verin."
}

$liveUrl = "https://salimoglu.github.io/apartim/js/version.js?t=" + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$deadline = (Get-Date).AddSeconds($TimeoutSec)
Write-Host "Deploy bekleniyor: hedef v$Expected (en fazla ${TimeoutSec}s)"

while ((Get-Date) -lt $deadline) {
  try {
    $live = (Invoke-WebRequest -Uri $liveUrl -UseBasicParsing -TimeoutSec 20).Content
    if ($live -match 'APP\s*=\s*"([^"]+)"') {
      $liveVer = $Matches[1]
      Write-Host "  canli: v$liveVer"
      if ($liveVer -eq $Expected) {
        Write-Host "Deploy tamam: v$liveVer"
        exit 0
      }
    }
  } catch {
    Write-Host "  canli site henuz yanit vermiyor..."
  }
  Start-Sleep -Seconds $IntervalSec
  $liveUrl = "https://salimoglu.github.io/apartim/js/version.js?t=" + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
}

Write-Error "Deploy zaman asimina ugradi. Hedef v$Expected, canli hala guncellenmedi."
exit 1
