# Script para limpar cache e iniciar servidor
param([int]$Port = 3000)

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  LIMPADOR DE CACHE + INICIADOR SERVER  " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Parar servidor anterior
Write-Host "`n[1/5] Parando servidores Node..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# 2. Verificar e liberar porta
Write-Host "`n[2/5] Verificando porta $Port..." -ForegroundColor Yellow
$portProcess = netstat -ano | findstr ":$Port"
if ($portProcess) {
    Write-Host "  ⚠️  Porta $Port em uso! Liberando..." -ForegroundColor Red
    $portProcess | ForEach-Object {
        $parts = $_ -split '\s+'
        $pidNum = $parts[-1]
        taskkill /PID $pidNum /F 2>$null
        Write-Host "    ✓ Processo $pidNum terminado" -ForegroundColor Green
    }
}

# 3. Limpar cache do Chrome
Write-Host "`n[3/5] Limpando cache do navegador..." -ForegroundColor Yellow
$browsers = @(
    @{ Name = "Chrome"; Path = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cache" },
    @{ Name = "Edge"; Path = "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Cache" },
    @{ Name = "Firefox"; Path = "$env:APPDATA\Mozilla\Firefox\Profiles\*.default-release\cache2" }
)

foreach ($browser in $browsers) {
    if (Test-Path $browser.Path) {
        Remove-Item "$($browser.Path)\*" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "    ✓ Cache do $($browser.Name) limpo" -ForegroundColor Green
    }
}

# 4. Atualizar Server.js com porta correta
Write-Host "`n[4/5] Configurando Server.js na porta $Port..." -ForegroundColor Yellow
$serverContent = Get-Content Server.js -Raw
if ($serverContent -notmatch "const PORT = $Port") {
    $serverContent = $serverContent -replace "const PORT = \d+", "const PORT = $Port"
    $serverContent | Set-Content Server.js -Encoding UTF8
    Write-Host "    ✓ Porta atualizada para $Port" -ForegroundColor Green
}

# 5. Iniciar servidor
Write-Host "`n[5/5] Iniciando servidor..." -ForegroundColor Green
Write-Host "  📍 URL: http://localhost:$Port" -ForegroundColor Cyan
Write-Host "  👤 Login: admin" -ForegroundColor Cyan
Write-Host "  🔑 Senha: admin123" -ForegroundColor Cyan
Write-Host "`nPressione Ctrl+C para parar o servidor" -ForegroundColor Yellow
Write-Host "=========================================`n" -ForegroundColor Cyan

# Iniciar servidor
node Server.js