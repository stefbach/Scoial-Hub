# MiroFish Studio

Outil **autonome** de simulation de marché multi-agents : une interface de conseil
par-dessus l'**API MiroFish**, avec un cadrage « cabinet d'élite » (KPMG/McKinsey/BCG).

> Application **conteneurisée** — elle **ne tourne pas sur Vercel**. Elle s'héberge
> sur Railway / Render / Fly.io / un VPS Docker, à côté de l'instance MiroFish.

## Architecture

```
[Navigateur] → MiroFish Studio (Next.js, ce projet) → API MiroFish (port 5001)
                         proxy /api/mf/*                 graph → simulation → report
```

Le Studio ne contient **aucune** logique de simulation : il orchestre l'API MiroFish
(ontologie → graphe → personas → simulation → rapport → chat) et injecte le prompt
engineering consulting. MiroFish utilise son propre LLM.

## Variables d'environnement

```
MIROFISH_BASE_URL = https://<instance-mirofish>:5001   # URL de l'API backend MiroFish
MIROFISH_API_KEY  =                                    # optionnel (si reverse-proxy d'auth)
```

## Développement local

```bash
npm install
MIROFISH_BASE_URL=http://localhost:5001 npm run dev
# http://localhost:3000
```

## Build & Docker

```bash
docker build -t mirofish-studio .
docker run -p 3000:3000 -e MIROFISH_BASE_URL=http://<host>:5001 mirofish-studio
```

## Déploiement Railway

1. **New Project → Deploy from Repo** (dossier `mirofish-studio/`) ou **Deploy Docker Image** après un build/push.
2. Variable : `MIROFISH_BASE_URL` = URL de l'API MiroFish.
3. **Settings → Networking → Generate Domain**, target port **3000**.

## Sécurité

L'API MiroFish n'a pas d'authentification native. Garde les URLs discrètes et,
en production, place un reverse-proxy qui vérifie un token (`MIROFISH_API_KEY`
est relayé en `Authorization: Bearer`).
