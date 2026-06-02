# AI-STACK — Quel modèle pour quoi

Référence des modèles IA utilisés dans Social Hub, par domaine de génération.
Cohérent avec `.env.example` et les clés `ANTHROPIC_MODEL`, `REPLICATE_API_TOKEN`, `FAL_KEY`, `OPENAI_API_KEY`, `RUNWAY_API_KEY`, `LUMA_API_KEY`.

---

## 1. Génération de texte — Claude (Anthropic)

Tous les textes passent par Claude. Pas d'alternative : cohérence de brand voice, qualité de français médical, et intégration déjà en place (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`).

### Modèles recommandés par usage

| Usage | Modèle recommandé | Justification |
|---|---|---|
| **Rédaction premium** : posts longs, threads, scripts vidéo, briefs créa | `claude-opus-4-5` (ou `claude-opus-4` selon dispo) | Meilleure qualité narrative, nuance médicale |
| **Rédaction standard** : captions, hooks, variantes A/B, réponses commentaires | `claude-sonnet-4-6` ← valeur par défaut (`ANTHROPIC_MODEL`) | Bon équilibre qualité/coût/vitesse |
| **Volume / batch** : génération de 10–50 variantes, scoring de templates | `claude-haiku-4` (vérifier ID exact dans console Anthropic) | 5–10× moins cher que Sonnet, adapté au batch |
| **Agent orchestrateur** : raisonnement multi-étapes, tool use | `claude-sonnet-4-6` ou `claude-opus-4-5` | Forte capacité de tool use et planification |
| **Garde-fou conformité** (bloquant) | `claude-sonnet-4-6` | Contexte système long, latence acceptable, coût maîtrisé |

> **IDs de modèles** : les identifiants Anthropic évoluent. Toujours vérifier les IDs actifs sur [console.anthropic.com/models](https://console.anthropic.com/models). Familles disponibles en 2026 : `claude-opus-4-x`, `claude-sonnet-4-x`, `claude-haiku-4-x`.

### Prompt caching — réduction de coût

Le prompt caching Anthropic permet de mettre en cache les blocs de contexte répétitifs (system prompt de marque, brand voice, historique, règles de conformité). Économie estimée : **60–80 % sur les tokens d'entrée** pour les appels en batch.

**Comment l'activer :**
```typescript
// Dans l'appel API Anthropic, marquer les blocs statiques :
{
  "type": "text",
  "text": "<brand_voice_context>...<compliance_rules>...</compliance_rules>",
  "cache_control": { "type": "ephemeral" }
}
```

Appliquer sur : le system prompt de marque, les règles de conformité santé, les exemples few-shot. Le cache TTL est de 5 minutes (renouvelé à chaque appel dans la fenêtre).

---

## 2. Génération d'images

### Comparatif des options disponibles

| Provider / Modèle | Qualité | Texte dans l'image | Coût approx. | Accès API | Variable env |
|---|---|---|---|---|---|
| **Flux Pro 1.1** (Replicate / fal.ai) | Excellente (photoréaliste) | Faible | ~0,04 $/image | Replicate ou fal.ai | `REPLICATE_API_TOKEN` ou `FAL_KEY` |
| **Flux Dev** (fal.ai) | Très bonne | Faible | ~0,02 $/image | fal.ai | `FAL_KEY` |
| **Ideogram 3** (fal.ai ou API native) | Bonne | Excellente | ~0,05–0,08 $/image | API Ideogram ou fal.ai | `FAL_KEY` |
| **OpenAI gpt-image-1 / DALL-E 3** | Bonne | Moyenne | ~0,04–0,08 $/image | OpenAI API | `OPENAI_API_KEY` |
| **Canva (MCP)** | Templates marque | Natif (texte éditable) | Inclus plan Canva | MCP Canva | — |

**Défaut recommandé : `Flux Pro 1.1` via fal.ai (`FAL_KEY`)**
- Meilleure qualité photoréaliste pour les visuels médicaux et lifestyle.
- API asynchrone simple, webhook ou polling.
- Fallback : Flux Dev si budget contraint.

**Pour les créas avec texte inséré (prix, accroche, CTA) : Ideogram 3.**
- Seul modèle capable de générer du texte lisible et centré dans l'image de façon fiable.

**Pour les créas no-code depuis templates de marque : Canva MCP.**
- Pas de génération IA mais contrôle total du brand design, charte couleur, logo.

### Formats Meta/Instagram requis

| Format | Ratio | Résolution minimale | Usage |
|---|---|---|---|
| Paysage (feed FB) | 1.91:1 | 1080×566 px | Posts FB, ads feed desktop |
| Carré (feed IG/FB) | 1:1 | 1080×1080 px | Feed Instagram, ads carré |
| Portrait (feed IG) | 4:5 | 1080×1350 px | Feed Instagram optimal |
| Stories / Reels | 9:16 | 1080×1920 px | Stories, Reels, ads plein écran |

Passer ces dimensions en paramètre au modèle d'image (`width`, `height` selon l'API).

---

## 3. Génération de vidéo

### Comparatif des générateurs vidéo (2026)

| Générateur | Durée max | Qualité | Coût approx./clip | Accès API | Variable env |
|---|---|---|---|---|---|
| **Google Veo 3** (via Vertex AI ou fal.ai) | 8–30 s | Excellente (cinématique) | ~1–3 $/clip | Vertex AI / fal.ai | `FAL_KEY` ou clé GCP |
| **Runway Gen-4** | 5–10 s | Très bonne (cohérence) | ~0,5–1 $/clip | API Runway | `RUNWAY_API_KEY` |
| **Kling 2.0** (fal.ai) | 5–10 s | Très bonne (mouvements fluides) | ~0,4–0,8 $/clip | fal.ai | `FAL_KEY` |
| **Luma Dream Machine 2** | 5–9 s | Bonne (rapide) | ~0,3–0,6 $/clip | API Luma | `LUMA_API_KEY` |
| **Pika 2.0** | 3–5 s | Moyenne (clips courts) | ~0,2–0,4 $/clip | API Pika | à ajouter dans .env |
| **Sora (OpenAI)** | jusqu'à 60 s | Excellente | accès API limité | OpenAI API | `OPENAI_API_KEY` |

> **Vérifier les IDs et tarifs exacts dans la console de chaque provider.** Les prix et capacités évoluent rapidement en 2026.

**Défaut recommandé : `Kling 2.0` via fal.ai (`FAL_KEY`)**
- Bon équilibre qualité / coût / disponibilité API.
- Cohérence des personnages sur 10 secondes suffisante pour les reels produits médicaux.
- Même clé que la génération d'images (fal.ai = API unifiée).

**Pour les productions premium (campagnes brand awareness) : Google Veo 3.**
- Qualité cinématique supérieure pour les vidéos institutionnelles Obesity Care Clinic / Tibok.

**Alternative rapide et économique : Luma Dream Machine 2.**
- Délai de génération < 2 minutes, adapté au test de concepts.

### Contraintes vidéo Meta/Instagram

| Format | Ratio | Durée | Usage |
|---|---|---|---|
| Reels Instagram | 9:16 | 3–90 s | Portée organique maximale |
| Stories | 9:16 | max 60 s | Engagement direct |
| Feed video (carré) | 1:1 | 3–60 s | Compatibilité FB + IG |
| Ads vidéo | 1:1 ou 9:16 | 6–15 s recommandé | Rétention publicitaire |

---

## 4. Pipeline de production d'un post réel

Séquence complète, de la demande à la publication.

```
[1] BRIEF
    Entrée : brand code (OCC/TBK/CVMI), objectif, plateforme, format
    Acteur : Stratège (Claude Sonnet)
          ↓
[2] GÉNÉRATION TEXTE
    Claude Sonnet (ou Opus pour premium)
    Prompt : brand voice de la company (companies.brand_voice) + objectif
    Sortie : post body + variantes A/B (2–3 versions)
          ↓
[3] GARDE-FOU CONFORMITÉ  ← ÉTAPE NON NÉGOCIABLE
    Claude Sonnet avec system prompt de conformité santé spécialisé
    Vérifie :
      - Allégations médicales non substantiées (interdites)
      - Avant/après interdit (politique Meta Health)
      - Prix ou garanties de résultats
      - Mention obligatoire de consulter un médecin si applicable
    Sortie : PASS / FAIL + liste des modifications requises
    Si FAIL : retour en [2] avec corrections, ou blocage et alerte humaine
          ↓
[4] GÉNÉRATION IMAGE (si format visuel)
    Flux Pro 1.1 (fal.ai) — ou Ideogram si texte dans l'image
    Dimensions : selon plateforme (tableau section 2)
    Sortie : URL image → upload Supabase Storage
          ↓
[5] GÉNÉRATION VIDÉO (si format reel/story vidéo)
    Kling 2.0 (fal.ai) — asynchrone, polling statut
    Sortie : URL vidéo → upload Supabase Storage
          ↓
[6] ASSEMBLAGE
    Création de l'enregistrement scheduled_posts :
      - body (texte validé)
      - media (JSON : {kind, url, dimensions})
      - date, time, platform, company_id
      - needs_review : true si source=automation ET marque médicale
          ↓
[7] VALIDATION HUMAINE (si needs_review = true)
    L'éditeur approuve ou rejette dans l'interface
    Audit log : actor='agent:copywriter', action='post.drafted'
    Audit log après validation : actor='user:<id>', action='post.approved'
          ↓
[8] PLANIFICATION & PUBLICATION
    Cron Supabase Edge Function (ou Vercel Cron)
    Appel Meta Graph API / LinkedIn Pages API
    Mise à jour : scheduled_posts.status → 'published'
    Création : history_items avec external_url et metrics init
          ↓
[9] RE-MESURE
    Cron de collecte des métriques (J+1, J+7, J+30)
    Mise à jour history_items.metrics (reach, engagement, clicks)
    Alimentation du rapport Analyste
```

---

## 5. Branchement Replicate (réel)

Implémentation active dans `lib/ai/replicate.ts`. Une seule clé `REPLICATE_API_TOKEN` couvre images et vidéos.

### Modèles utilisés

| Domaine | Modèle Replicate | ID exact |
|---|---|---|
| **Image** | Flux 1.1 Pro (Black Forest Labs) | `black-forest-labs/flux-1.1-pro` |
| **Vidéo** | MiniMax Video-01 | `minimax/video-01` |

### Coûts approximatifs (tarifs Replicate 2026)

| Modèle | Coût approx. | Notes |
|---|---|---|
| `flux-1.1-pro` | ~0,04 $/image | Résolution jusqu'à 1440 px, WebP |
| `minimax/video-01` | ~0,50 $/clip | Clip 5–6 s, polling ~30–90 s |

> Vérifier les tarifs exacts sur [replicate.com/pricing](https://replicate.com/pricing) — ils varient selon la charge GPU.

### Architecture technique

- **Endpoint** : `POST https://api.replicate.com/v1/models/{owner}/{name}/predictions` (cible toujours la dernière version du modèle).
- **Polling** : intervalle 2 s, timeout global 120 s. L'en-tête `Prefer: wait` permet à Replicate de répondre directement si la prédiction est rapide.
- **Pas de dépendance npm** : implémentation en `fetch` natif Node.js, aucun paquet tiers ajouté.

### Comment tester

**Sans clé (mode simulé) :**
```bash
curl -X POST http://localhost:3000/api/ai/generate-image \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test","format":"square","n":1}'
# → {"images":[],"simulated":true,"model":"simulated"}

curl -X POST http://localhost:3000/api/ai/generate-video \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test","seconds":5,"aspect":"9:16"}'
# → {"simulated":true,"model":"simulated"}
```

**Avec clé réelle (`.env.local`) :**
```bash
echo "REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxxxxxxxxx" >> .env.local

# Image (format Stories Instagram)
curl -X POST http://localhost:3000/api/ai/generate-image \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Medical wellness, warm light, modern clinic interior","format":"story","n":1}'
# → {"images":[{"url":"https://replicate.delivery/..."}],"model":"black-forest-labs/flux-1.1-pro"}

# Vidéo (Reel 9:16, 5 s)
curl -X POST http://localhost:3000/api/ai/generate-video \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Doctor welcoming patient, warm clinic, smooth cinematic","seconds":5,"aspect":"9:16"}'
# → {"video":{"url":"https://replicate.delivery/..."},"model":"minimax/video-01"}
```

### Paramètres acceptés

**`POST /api/ai/generate-image`**

| Champ | Type | Défaut | Description |
|---|---|---|---|
| `prompt` | `string` | `""` | Description de l'image à générer |
| `format` | `string` | `"square"` | `square` (1:1), `portrait` (4:5), `landscape` (16:9), `story` (9:16) |
| `n` | `number` | `1` | Nombre d'images (1–4) |

**`POST /api/ai/generate-video`**

| Champ | Type | Défaut | Description |
|---|---|---|---|
| `prompt` | `string` | `""` | Description de la vidéo à générer |
| `seconds` | `number` | `5` | Durée (5 ou 6 s, limite MiniMax) |
| `aspect` | `string` | `"9:16"` | Ratio : `9:16`, `16:9`, `1:1` |

---

## 6. Garde-fou conformité santé — détail

Cette étape est **bloquante** et non contournable pour les 3 marques (cliniques médicales, soins obésité, télémédecine).

### Règles à vérifier automatiquement

| Catégorie | Règle | Action si violation |
|---|---|---|
| Allégations thérapeutiques | Aucune promesse de guérison, de résultat garanti | FAIL — reformulation obligatoire |
| Avant/après | Interdit sur Meta (politique Health & Wellness) | FAIL — suppression du visuel |
| Prix / offres | Les prix peuvent figurer si sans garantie de résultat | WARNING — validation humaine |
| Mentions légales | "Consultez un professionnel de santé" si conseil médical | AUTO-AJOUT dans le texte |
| Données sensibles | Ne pas citer de cas patients, même anonymisés | FAIL — blocage |
| RGPD | Pas de collecte de données santé via les formulaires ads sans consentement explicite | NOTE pour l'équipe juridique |

### Implémentation

```typescript
// System prompt de conformité (à cacher avec prompt caching) :
const COMPLIANCE_SYSTEM = `
Tu es un expert en régulation publicitaire pour le secteur médical français et cap-verdien.
Analyse le texte suivant et retourne un JSON strict :
{
  "status": "PASS" | "FAIL" | "WARNING",
  "issues": [{ "rule": string, "excerpt": string, "fix": string }],
  "auto_additions": string[]   // mentions à ajouter automatiquement
}
Règles applicables : [liste complète...]
`;
```

L'étape de conformité est tracée dans `audit_log` avec `action='compliance.check'`, `payload={status, issues}`. Tout FAIL est visible dans le tableau de bord et bloque la publication automatique.
