# Serverni bepul Cloudflare tunnel (trycloudflare) bilan ishga tushiradi va o'chib qolsa qayta tiklaydi.
# Ishlatish:  powershell -ExecutionPolicy Bypass -File scripts\run-online.ps1
# Talab: cloudflared o'rnatilgan (winget install Cloudflare.cloudflared)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$cfExe = $null
$cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
if ($cmd) { $cfExe = $cmd.Source }
else {
  foreach ($p in @("$env:ProgramFiles\cloudflared\cloudflared.exe", "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe", "$env:LOCALAPPDATA\Microsoft\WinGet\Links\cloudflared.exe")) {
    if (Test-Path $p) { $cfExe = $p; break }
  }
}
if (-not $cfExe) { Write-Host "cloudflared topilmadi. O'rnating:  winget install Cloudflare.cloudflared" -ForegroundColor Red; exit 1 }

function Get-EnvVar($key) {
  if (-not (Test-Path .env)) { return $null }
  foreach ($l in Get-Content .env) { if ($l -match "^\s*$key\s*=\s*(.*?)\s*$") { return $Matches[1] } }
  return $null
}
function Set-EnvVar($key, $value) {
  $lines = @(); if (Test-Path .env) { $lines = @(Get-Content .env) }
  $found = $false
  $lines = $lines | ForEach-Object { if ($_ -match "^\s*$key\s*=") { $found = $true; "$key=$value" } else { $_ } }
  if (-not $found) { $lines += "$key=$value" }
  Set-Content .env -Value $lines -Encoding ascii
}

# Xavfsizlik: DEV_MODE yoqiq bo'lsa internetga ochmaymiz (Telegramsiz kirish imkonini beradi)
if ((Get-EnvVar 'DEV_MODE') -eq '1') { Write-Host ".env da DEV_MODE=1. Internetga ochishdan oldin DEV_MODE=0 qiling." -ForegroundColor Red; exit 1 }
if (-not (Get-EnvVar 'PLATFORM_BOT_TOKEN')) { Write-Host ".env da PLATFORM_BOT_TOKEN yo'q." -ForegroundColor Red; exit 1 }

New-Item -ItemType Directory -Force data | Out-Null
$script:server = $null
$script:tunnel = $null

function Stop-Proc($p) { if ($p -and -not $p.HasExited) { try { Stop-Process -Id $p.Id -Force } catch {} } }

function Start-Server {
  Stop-Proc $script:server
  $script:server = Start-Process node -ArgumentList 'src/server.js' -WorkingDirectory $root -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput data\server.log -RedirectStandardError data\server.err
  Write-Host "[$(Get-Date -f HH:mm:ss)] server ishga tushdi (pid $($script:server.Id))"
}

function Test-Url($u) {
  try { return (Invoke-WebRequest "$u/health" -UseBasicParsing -TimeoutSec 8).StatusCode -eq 200 } catch { return $false }
}

try {
  while ($true) {
    # 1) tunnel
    Remove-Item data\tunnel.log -ErrorAction SilentlyContinue
    $script:tunnel = Start-Process $cfExe -ArgumentList 'tunnel', '--url', 'http://localhost:3000', '--no-autoupdate' `
      -RedirectStandardError data\tunnel.log -PassThru -WindowStyle Hidden
    $url = $null
    for ($i = 0; $i -lt 40 -and -not $url; $i++) {
      Start-Sleep 1
      if ($script:tunnel.HasExited) { break }
      if (Test-Path data\tunnel.log) {
        $m = Select-String -Path data\tunnel.log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($m) { $url = $m.Matches[0].Value }
      }
    }
    if (-not $url) { Write-Host "Tunnel manzili olinmadi, 10 soniyadan keyin qayta uriniladi." -ForegroundColor Yellow; Stop-Proc $script:tunnel; Start-Sleep 10; continue }

    # 2) yangi manzilni yozib, serverni (qayta) ishga tushiramiz — webhook va menyu tugmalari yangilanadi
    Set-EnvVar 'PUBLIC_URL' $url
    Start-Server
    Start-Sleep 4
    Write-Host "[$(Get-Date -f HH:mm:ss)] ONLINE: $url" -ForegroundColor Green

    # 3) kuzatuv: server yiqilsa qayta ishga tushiramiz; tunnel yiqilsa yoki 3 marta javob bermasa — tunnelni yangilaymiz
    $fails = 0
    while ($true) {
      Start-Sleep 30
      if ($script:server.HasExited) { Write-Host "Server to'xtagan, qayta ishga tushirilmoqda." -ForegroundColor Yellow; Start-Server; Start-Sleep 4 }
      if ($script:tunnel.HasExited) { Write-Host "Tunnel to'xtadi." -ForegroundColor Yellow; break }
      if (Test-Url $url) { $fails = 0 } else { $fails++; Write-Host "Manzil javob bermadi ($fails/3)" -ForegroundColor Yellow }
      if ($fails -ge 3) { break }
    }
    Stop-Proc $script:tunnel
    Write-Host "Tunnel qayta ochilmoqda..." -ForegroundColor Yellow
  }
}
finally {
  Stop-Proc $script:tunnel; Stop-Proc $script:server
}
