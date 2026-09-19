param(
    [string]$FoundryData = "$env:LOCALAPPDATA\FoundryVTT"
)

$ErrorActionPreference = "Stop"

$ModuleId = "dragons-ante"
$LegacyModuleId = "balatro-for-foundry"

$Source = $PSScriptRoot
$ModulesDir = Join-Path $FoundryData "Data\modules"
$Target = Join-Path $ModulesDir $ModuleId
$LegacyTarget = Join-Path $ModulesDir $LegacyModuleId

$ManifestPath = Join-Path $Source "module.json"
if (-not (Test-Path $ManifestPath)) {
    throw "module.json introuvable dans $Source"
}

$Manifest = Get-Content -Raw -Path $ManifestPath | ConvertFrom-Json
$Version = [string]$Manifest.version

New-Item -ItemType Directory -Force -Path $ModulesDir | Out-Null

if (Test-Path $LegacyTarget) {
    Write-Host "Ancien prototype detecte : $LegacyTarget" -ForegroundColor Yellow
    Write-Host "Suppression de balatro-for-foundry..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $LegacyTarget
}

if (Test-Path $Target) {
    Write-Host "Suppression de l'ancienne version de Dragon's Ante..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $Target
}

New-Item -ItemType Directory -Force -Path $Target | Out-Null
Copy-Item -Path (Join-Path $Source "*") -Destination $Target -Recurse -Force

Write-Host ""
Write-Host "Dragon's Ante v$Version installe !" -ForegroundColor Green
Write-Host "Dossier : $Target"
Write-Host ""
Write-Host "Relance Foundry puis active Dragon's Ante dans ton monde." -ForegroundColor Cyan
