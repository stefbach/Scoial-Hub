# Moteur premium — MiroFish (simulation multi-agents)

Le module **Simulateur & Prédiction** d'AXON-AI a deux moteurs :

| Moteur | Technologie | Vitesse | Profondeur | Activation |
| ------ | ----------- | ------- | ---------- | ---------- |
| **Standard** | Claude (natif, intégré) | ~30–60 s | Personas synthétiques + prédiction | Toujours actif (si `ANTHROPIC_API_KEY`) |
| **Premium** | [MiroFish](https://github.com/666ghj/MiroFish) (multi-agents, self-hosted) | plusieurs minutes | Graphe de connaissance + milliers d'agents + rapport niveau cabinet | Si `MIROFISH_BASE_URL` est renseigné |

Le moteur premium est pensé pour une **offre haut de gamme / consulting**. Les agents sont cadrés par du *prompt engineering* « cabinet d'élite » (KPMG/McKinsey/BCG) injecté dans la demande de simulation (`lib/integrations/mirofish-prompt.ts`).

---

## 1. Pré-requis & avertissements

- **Licence AGPL-3.0** : MiroFish est sous AGPL. Il est ici utilisé **comme service séparé**, appelé via HTTP (frontière réseau) — notre code propriétaire n'est pas lié/embarqué. Faire valider cette approche par un conseil juridique avant exploitation commerciale ; ne **jamais** copier le code MiroFish dans ce dépôt.
- **Coût & latence** : un run mobilise un LLM sur des milliers d'agents → **lent et coûteux**. À réserver au premium/consulting, en asynchrone.
- **Rigueur** : sortie **directionnelle** (simulation), pas une garantie. L'UI l'indique explicitement.

## 2. Déployer MiroFish (Docker)

Sur un hôte dédié (VM/serveur, **pas** Vercel) :

```yaml
# docker-compose.yml
services:
  mirofish:
    image: ghcr.io/666ghj/mirofish:latest
    container_name: mirofish
    ports:
      - "3000:3000"   # frontend MiroFish (optionnel)
      - "5001:5001"   # API backend (utilisée par AXON-AI)
    env_file:
      - .env
    volumes:
      - ./backend/uploads:/app/backend/uploads
    restart: unless-stopped
```

`.env` de l'instance MiroFish :

```bash
LLM_API_KEY=...            # n'importe quel LLM au format OpenAI SDK
LLM_BASE_URL=https://...   # ex. Alibaba Bailian / OpenAI / Azure / vLLM
LLM_MODEL_NAME=qwen-plus   # ou le modèle de votre choix
ZEP_API_KEY=...            # mémoire des agents (Zep Cloud)
```

Lancer : `docker compose up -d`. Vérifier l'API : `curl http://HOTE:5001/api/graph/tasks`.

## 3. Brancher AXON-AI sur l'instance

Dans les variables d'environnement Vercel d'AXON-AI :

```bash
MIROFISH_BASE_URL=http://HOTE:5001     # URL de l'API backend MiroFish
MIROFISH_API_KEY=                      # optionnel (si vous protégez l'instance)
```

> ⚠️ Exposez l'instance derrière HTTPS + une protection réseau (l'API n'a pas d'auth native ; `MIROFISH_API_KEY` est relayé en `Authorization: Bearer` si défini — utile derrière un reverse-proxy qui le vérifie).

Redéployer. L'option **« Premium · MiroFish »** apparaît alors dans le module Simulateur.

## 4. Architecture de l'intégration (côté AXON-AI)

- `lib/env.ts` → `isMirofishConfigured`, `env.mirofishBaseUrl`, `env.mirofishApiKey`.
- `lib/integrations/mirofish-prompt.ts` → cadrage « cabinet d'élite » (requirement + contexte + préambule chat).
- `app/api/mirofish/[...path]/route.ts` → **proxy sécurisé** (garde d'accès édition, all-list `api/graph|simulation|report`, URL/clé gardées serveur).
- `app/api/mirofish/available/route.ts` → indique au client si le premium est branché.
- `components/simulateur/MirofishStudio.tsx` → orchestrateur du pipeline (ontologie → graphe → personas → simulation → rapport → chat) avec avancement par étape.

### Pipeline MiroFish utilisé
1. `POST /api/graph/ontology/generate` (multipart) → `project_id`
2. `POST /api/graph/build` → `task_id` → poll `GET /api/graph/task/<id>` → `graph_id`
3. `POST /api/simulation/create` → `simulation_id`
4. `POST /api/simulation/prepare` → poll `POST /api/simulation/prepare/status` (personas)
5. `POST /api/simulation/start` → poll `GET /api/simulation/<id>/run-status` (rounds)
6. `POST /api/report/generate` → poll `POST /api/report/generate/status` → `GET /api/report/<id>` (markdown)
7. `POST /api/report/chat` → Q&A avec le ReportAgent

> L'API amont n'est pas documentée publiquement : l'orchestrateur tolère les variantes de noms de champs (id/status). Après le **premier run réel**, ajuster si besoin les clés exactes dans `MirofishStudio.tsx`.
