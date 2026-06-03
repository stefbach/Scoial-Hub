// Installeur une-ligne (macOS / Linux) du connecteur MCP AXON-AI.
//   curl -fsSL https://<app>/install-mcp.sh | bash
// Le script télécharge le serveur MCP, installe le SDK et configure Claude Desktop.

export const runtime = "nodejs";

import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  const script = `#!/usr/bin/env bash
set -euo pipefail

AXON_DEFAULT_URL="${origin}"
DIR="$HOME/.axon-mcp"

echo ""
echo "  ╭───────────────────────────────────────────────╮"
echo "  │   AXON-AI · Connecteur MCP pour Claude Desktop │"
echo "  ╰───────────────────────────────────────────────╯"
echo ""

# 1) Node.js requis
if ! command -v node >/dev/null 2>&1; then
  echo "  ✗ Node.js introuvable. Installez Node.js 18+ : https://nodejs.org"
  exit 1
fi

# 2) Demander URL + clé (lecture depuis le terminal même si le script est pipé)
read -r -p "  URL AXON-AI [$AXON_DEFAULT_URL] : " AXON_URL </dev/tty || true
AXON_URL="\${AXON_URL:-$AXON_DEFAULT_URL}"
AXON_URL="\${AXON_URL%/}"

read -r -p "  Votre clé API (axon_...) : " AXON_KEY </dev/tty || true
if [ -z "\${AXON_KEY:-}" ]; then
  echo "  ✗ Clé API manquante. Générez-la dans AXON-AI → Connecteur MCP."
  exit 1
fi

echo ""
echo "  → Installation dans $DIR"
mkdir -p "$DIR"

# 3) Télécharger le serveur MCP
curl -fsSL "$AXON_URL/mcp-server.mjs" -o "$DIR/index.mjs"

# 4) package.json + dépendance SDK
cat > "$DIR/package.json" <<'PKG'
{ "name": "axon-mcp", "version": "1.0.0", "private": true, "type": "module",
  "dependencies": { "@modelcontextprotocol/sdk": "^1.12.1" } }
PKG

echo "  → Installation du SDK MCP (npm)…"
( cd "$DIR" && npm install --silent --no-audit --no-fund )

# 5) Configurer Claude Desktop
if [ "$(uname)" = "Darwin" ]; then
  CFG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
else
  CFG="$HOME/.config/Claude/claude_desktop_config.json"
fi
mkdir -p "$(dirname "$CFG")"
[ -f "$CFG" ] || echo '{}' > "$CFG"

AXON_URL="$AXON_URL" AXON_KEY="$AXON_KEY" DIR="$DIR" CFG="$CFG" node <<'NODE'
import { readFileSync, writeFileSync } from "node:fs";
const cfgPath = process.env.CFG;
let cfg = {};
try { cfg = JSON.parse(readFileSync(cfgPath, "utf8") || "{}"); } catch { cfg = {}; }
cfg.mcpServers = cfg.mcpServers || {};
cfg.mcpServers["axon-ai"] = {
  command: "node",
  args: [process.env.DIR + "/index.mjs"],
  env: { AXON_API_URL: process.env.AXON_URL, AXON_API_KEY: process.env.AXON_KEY },
};
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
console.log("  ✓ Claude Desktop configuré : " + cfgPath);
NODE

echo ""
echo "  ✓ Terminé !"
echo "    1. Quittez complètement Claude Desktop (Cmd+Q)."
echo "    2. Relancez Claude Desktop."
echo "    3. Demandez : « Liste mes comptes AXON-AI »."
echo ""
`;

  return new Response(script, {
    headers: {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
