# Social Hub MCP Server

Serveur **Model Context Protocol (MCP)** pour piloter l'application [Social Hub](https://github.com/your-org/social-hub) à distance depuis **Claude Desktop** ou tout client MCP compatible.

Ce serveur est un process Node.js indépendant. Il n'importe aucun code de l'application Next.js — il communique exclusivement avec l'**API HTTP** de l'app déployée.

---

## Prérequis

- **Node.js** 18+
- L'application Social Hub doit être démarrée et accessible (local ou déployée)

---

## Installation & build

```bash
# Se placer dans ce dossier
cd mcp

# Installer les dépendances
npm install

# Compiler le TypeScript
npm run build
```

Le binaire compilé est généré dans `mcp/dist/index.js`.

---

## Variables d'environnement

Copiez `.env.example` en `.env` et renseignez la valeur :

```bash
cp .env.example .env
```

| Variable         | Défaut                  | Description                                        |
|------------------|-------------------------|----------------------------------------------------|
| `SOCIAL_HUB_URL` | `http://localhost:3000` | URL de base de l'application Social Hub déployée. |

---

## Lancement manuel (test)

```bash
# Depuis le dossier mcp/
SOCIAL_HUB_URL=http://localhost:3000 node dist/index.js
```

Le serveur communique en **stdio** — il ne démarre pas un port HTTP. C'est Claude Desktop (ou votre client MCP) qui lance et communique avec lui.

---

## Configuration Claude Desktop

Ouvrez le fichier de configuration Claude Desktop :

- **macOS** : `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows** : `%APPDATA%\Claude\claude_desktop_config.json`

Ajoutez le bloc suivant dans la section `mcpServers` :

```json
{
  "mcpServers": {
    "social-hub": {
      "command": "node",
      "args": ["/chemin/absolu/vers/Scoial-Hub/mcp/dist/index.js"],
      "env": {
        "SOCIAL_HUB_URL": "https://votre-social-hub.vercel.app"
      }
    }
  }
}
```

> Remplacez `/chemin/absolu/vers/Scoial-Hub/mcp/dist/index.js` par le chemin réel sur votre machine.
> Remplacez `https://votre-social-hub.vercel.app` par l'URL de votre app déployée (ou `http://localhost:3000` pour le développement local).

Redémarrez Claude Desktop après avoir modifié ce fichier.

---

## Ajouter d'autres serveurs MCP (ex : GitHub)

Vous pouvez brancher plusieurs serveurs MCP simultanément. Par exemple, pour ajouter le [GitHub MCP Server officiel](https://github.com/github/github-mcp-server) :

```json
{
  "mcpServers": {
    "social-hub": {
      "command": "node",
      "args": ["/chemin/absolu/vers/Scoial-Hub/mcp/dist/index.js"],
      "env": {
        "SOCIAL_HUB_URL": "https://votre-social-hub.vercel.app"
      }
    },
    "github": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "GITHUB_PERSONAL_ACCESS_TOKEN",
        "ghcr.io/github/github-mcp-server"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_votre_token_github"
      }
    }
  }
}
```

Consultez la documentation officielle : https://github.com/github/github-mcp-server

---

## Tools exposés

| Tool                       | Description courte                                                    |
|----------------------------|-----------------------------------------------------------------------|
| `list_companies`           | Liste toutes les entreprises disponibles (fournit les `companyId`)    |
| `list_campaigns`           | Liste les campagnes d'une entreprise (`companyId` requis)             |
| `list_agents`              | Liste les agents IA disponibles dans l'orchestrateur                  |
| `connector_status`         | État de connexion des connecteurs sociaux (FB, IG, LI)               |
| `run_agent_orchestration`  | Lance une orchestration multi-agent complète pour une campagne        |
| `generate_post`            | Génère/améliore un post via l'IA (generate/rewrite/shorten/hashtags) |
| `check_compliance`         | Vérifie la conformité réglementaire santé d'un texte                 |
| `publish_post`             | Publie un post sur Facebook, Instagram ou LinkedIn                    |

---

## Workflow recommandé dans Claude

1. `list_companies` → obtenir le `companyId`
2. `connector_status` → vérifier que la plateforme est prête
3. `generate_post` → générer le contenu
4. `check_compliance` → valider la conformité
5. `publish_post` → publier
