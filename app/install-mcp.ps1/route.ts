// Installeur une-ligne (Windows / PowerShell) du connecteur MCP AXON-AI.
//   iwr -useb https://<app>/install-mcp.ps1 | iex

export const runtime = "nodejs";

import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  const script = `# AXON-AI · Connecteur MCP pour Claude Desktop (Windows)
$ErrorActionPreference = "Stop"
$AxonDefaultUrl = "${origin}"
$Dir = Join-Path $env:USERPROFILE ".axon-mcp"

Write-Host ""
Write-Host "  AXON-AI - Connecteur MCP pour Claude Desktop" -ForegroundColor Magenta
Write-Host ""

# 1) Node.js requis
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "  X Node.js introuvable. Installez Node.js 18+ : https://nodejs.org" -ForegroundColor Red
  exit 1
}

# 2) URL + cle
$AxonUrl = Read-Host "  URL AXON-AI [$AxonDefaultUrl]"
if ([string]::IsNullOrWhiteSpace($AxonUrl)) { $AxonUrl = $AxonDefaultUrl }
$AxonUrl = $AxonUrl.TrimEnd('/')

$AxonKey = Read-Host "  Votre cle API (axon_...)"
if ([string]::IsNullOrWhiteSpace($AxonKey)) {
  Write-Host "  X Cle API manquante. Generez-la dans AXON-AI -> Connecteur MCP." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "  -> Installation dans $Dir"
New-Item -ItemType Directory -Force -Path $Dir | Out-Null

# 3) Telecharger le serveur MCP
Invoke-WebRequest -UseBasicParsing -Uri "$AxonUrl/mcp-server.mjs" -OutFile (Join-Path $Dir "index.mjs")

# 4) package.json + SDK
@'
{ "name": "axon-mcp", "version": "1.0.0", "private": true, "type": "module",
  "dependencies": { "@modelcontextprotocol/sdk": "^1.12.1" } }
'@ | Set-Content -Path (Join-Path $Dir "package.json") -Encoding utf8

Write-Host "  -> Installation du SDK MCP (npm)..."
Push-Location $Dir
npm install --silent --no-audit --no-fund
Pop-Location

# 5) Configurer Claude Desktop
$Cfg = Join-Path $env:APPDATA "Claude\\claude_desktop_config.json"
New-Item -ItemType Directory -Force -Path (Split-Path $Cfg) | Out-Null
if (-not (Test-Path $Cfg)) { "{}" | Set-Content -Path $Cfg -Encoding utf8 }

$json = Get-Content $Cfg -Raw | ConvertFrom-Json
if ($null -eq $json) { $json = [pscustomobject]@{} }
if (-not ($json.PSObject.Properties.Name -contains "mcpServers")) {
  $json | Add-Member -NotePropertyName "mcpServers" -NotePropertyValue ([pscustomobject]@{})
}
$entry = [pscustomobject]@{
  command = "node"
  args    = @((Join-Path $Dir "index.mjs"))
  env     = [pscustomobject]@{ AXON_API_URL = $AxonUrl; AXON_API_KEY = $AxonKey }
}
if ($json.mcpServers.PSObject.Properties.Name -contains "axon-ai") {
  $json.mcpServers."axon-ai" = $entry
} else {
  $json.mcpServers | Add-Member -NotePropertyName "axon-ai" -NotePropertyValue $entry
}
$json | ConvertTo-Json -Depth 10 | Set-Content -Path $Cfg -Encoding utf8
Write-Host "  + Claude Desktop configure : $Cfg" -ForegroundColor Green

Write-Host ""
Write-Host "  + Termine !" -ForegroundColor Green
Write-Host "    1. Quittez completement Claude Desktop."
Write-Host "    2. Relancez Claude Desktop."
Write-Host "    3. Demandez : Liste mes comptes AXON-AI."
Write-Host ""
`;

  return new Response(script, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
