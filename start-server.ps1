# start-server.ps1
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  INICIADOR DE SERVIDOR FERRAMENTARIA  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Parar TODOS os servidores Node
Write-Host "`n[1/4] Parando servidores Node anteriores..." -ForegroundColor Yellow
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
    Write-Host "   ✓ Parados: $($nodeProcesses.Count) processos" -ForegroundColor Green
} else {
    Write-Host "   ✓ Nenhum processo Node encontrado" -ForegroundColor Green
}

# 2. Verificar qual porta está configurada
Write-Host "`n[2/4] Verificando configuração..." -ForegroundColor Yellow
$serverContent = Get-Content Server.js -Raw
if ($serverContent -match "const PORT = (\d+)") {
    $port = $matches[1]
    Write-Host "   ✓ Porta configurada: $port" -ForegroundColor Green
} else {
    $port = 3000
    Write-Host "   ⚠️  Porta não encontrada, usando padrão: $port" -ForegroundColor Yellow
}

# 3. Verificar e liberar a porta
Write-Host "`n[3/4] Verificando porta $port..." -ForegroundColor Yellow
$portInUse = netstat -ano | findstr ":$port"
if ($portInUse) {
    Write-Host "   ⚠️  Porta $port em uso! Liberando..." -ForegroundColor Red
    $portInUse | ForEach-Object {
        if ($_ -match '\s+(\d+)$') {
            $pidNum = $matches[1]
            taskkill /PID $pidNum /F 2>$null
            Write-Host "     ✓ Processo $pidNum terminado" -ForegroundColor Green
        }
    }
} else {
    Write-Host "   ✓ Porta $port está livre" -ForegroundColor Green
}

# 4. Iniciar servidor
Write-Host "`n[4/4] Iniciando servidor..." -ForegroundColor Green
Write-Host "`n══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🚀 SISTEMA FERRAMENTARIA ONLINE" -ForegroundColor Green
Write-Host "══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  📍 Acesse: http://localhost:$port" -ForegroundColor Yellow
Write-Host "  👤 Login: admin" -ForegroundColor Yellow
Write-Host "  🔑 Senha: admin123" -ForegroundColor Yellow
Write-Host "══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Pressione Ctrl+C para parar o servidor" -ForegroundColor Gray
Write-Host "══════════════════════════════════════════════`n" -ForegroundColor Cyan

# Iniciar servidor
node Server.js