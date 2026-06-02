# AGENTS — Dispositif multi-agent IA de Social Hub

Architecture "un cerveau à tous les niveaux" : chaque domaine fonctionnel dispose d'un agent spécialisé coordonné par un orchestrateur central.

---

## Principe d'autonomie graduée

Tout agent fonctionne à l'un des trois niveaux suivants. Le niveau est configurable par marque et par type d'action dans `companies.config` ou `automations.config`.

| Niveau | Nom | Description | Garde-fous |
|---|---|---|---|
| **1** | Recommandation | L'agent propose, l'humain décide et exécute | Aucun automatisme |
| **2** | Semi-automatique | L'agent prépare et planifie, l'humain valide avant publication | `needs_review = true` obligatoire |
| **3** | Automatique | L'agent planifie et publie sans validation | Budget cap, kill-switch, conformité bloquante, audit log complet |

**Garde-fous durs non contournables quel que soit le niveau :**
- `ad_safety.monthly_cap` : aucune dépense IA ne peut dépasser le plafond mensuel.
- Kill-switch : flag `automations.enabled = false` coupable à tout moment depuis l'UI.
- Validation conformité santé : toute publication passe par l'agent Conformité (résultat FAIL = blocage absolu).
- Validation médicale humaine : pour toute allégation clinique ou contenu patient, retour niveau 2 forcé.

---

## Agents — fiche par agent

### 1. Orchestrateur

**Rôle :** point d'entrée central. Décompose les demandes complexes en tâches, route vers les agents spécialisés, agrège les résultats, gère les erreurs et les retours en arrière.

**Entrées :**
- Demande utilisateur (brief, objectif campagne, déclencheur cron)
- Contexte : company_id, platform, dates, budget disponible

**Sorties :**
- Séquence de tâches ordonnées avec assignation par agent
- Statut de complétion, erreurs, logs

**Outils / API :**
- Appels aux autres agents (tool use Claude)
- Lecture `companies`, `automations`, `ad_safety`
- Écriture dans `audit_log` : `actor='agent:orchestrator'`

**Niveau d'autonomie :** 1–3 selon configuration de l'automation déclenchante.

**Implémentation :** API route Next.js `/api/ai/orchestrate` ou Supabase Edge Function. Modèle : `claude-sonnet-4-6` (tool use multi-étapes).

---

### 2. Stratège

**Rôle :** analyse la performance passée, génère des recommandations de stratégie de contenu et de campagne. Propose le planning éditorial hebdomadaire.

**Entrées :**
- `history_items` (métriques des publications passées)
- `campaigns.metrics` (performance paid)
- Brief objectif (awareness / conversion / fidélisation)
- Données GA4 (via API route de reporting)

**Sorties :**
- Recommandations de mix de contenu (formats, fréquences, thématiques)
- Planning éditorial structuré (JSON : date, platform, type, brief)
- Alertes sur les tendances de performance (CPM en hausse, engagement en baisse)

**Outils / API :**
- Lecture `history_items`, `campaigns`, `ad_sets`
- Google Analytics Data API (via `GA4_PROPERTY_ID`)
- Écriture `audit_log` : `actor='agent:strategist'`

**Niveau d'autonomie :** 1 par défaut (recommandations). Peut passer en 2 pour auto-alimenter le calendrier de publication.

**Modèle :** `claude-sonnet-4-6` avec prompt caching sur l'historique de métriques.

---

### 3. Copywriter

**Rôle :** rédige les textes de posts organiques et les copies publicitaires (headline, body_text, CTA) pour toutes les plateformes.

**Entrées :**
- Brief du Stratège ou de l'utilisateur
- `companies.brand_voice` (ton, valeurs, mots à éviter)
- Plateforme cible (longueur, style)
- Variantes demandées (A/B : 2–3 versions)

**Sorties :**
- Texte(s) de post prêts à validation
- Variantes A/B numérotées
- Méta-commentaire sur les choix éditoriaux

**Outils / API :**
- Anthropic API (`ANTHROPIC_API_KEY`)
- Lecture `templates` (exemples de posts existants pour few-shot)
- Écriture `scheduled_posts` (status='draft') ou `templates`
- Écriture `audit_log` : `actor='agent:copywriter'`

**Niveau d'autonomie :** 1–2. Jamais 3 directement — passe obligatoirement par l'agent Conformité avant publication.

**Modèle :** `claude-opus-4-5` pour contenu premium, `claude-sonnet-4-6` pour volume standard, `claude-haiku-4` pour batch de variantes.

---

### 4. Creative (image & vidéo)

**Rôle :** génère les visuels (images statiques, vidéos courtes) en cohérence avec le brief créa et la charte graphique de la marque.

**Entrées :**
- Brief créa (sujet, ton, format, dimensions cibles)
- Style de marque (couleur accent `companies.accent`, logo_url)
- Texte du Copywriter (pour aligner image et copy)
- Format de destination (ratio, résolution — voir docs/AI-STACK.md)

**Sorties :**
- URL(s) image/vidéo générée(s), uploadées dans Supabase Storage
- JSON media : `{kind: "image"|"video", url, dimensions, model_used}`
- Prêt à peupler `scheduled_posts.media` ou `ads` (format, dimensions)

**Outils / API :**
- fal.ai (`FAL_KEY`) : Flux Pro 1.1 (images), Kling 2.0 (vidéos)
- Ideogram (`FAL_KEY` ou API native) : si texte dans l'image
- Canva MCP : si génération depuis template de marque
- Supabase Storage : upload et CDN des assets
- Écriture `audit_log` : `actor='agent:creative'`

**Niveau d'autonomie :** 2 par défaut (validation visuelle humaine recommandée). Peut passer en 3 pour des formats standardisés (stories produit sur template fixe).

**Notes :**
- Les générations vidéo sont asynchrones : polling du statut toutes les 10s, timeout à 5 minutes.
- Stocker les assets dans Supabase Storage bucket `media` avec path `{company_id}/{post_id}/`.

---

### 5. Media Buyer

**Rôle :** gère les campagnes payantes Meta (et LinkedIn en P2). Crée, active, ajuste les campagnes, ad sets et ads. Surveille le spend vs budget.

**Entrées :**
- Brief campagne (objectif, audience, budget, dates)
- `audiences` (audiences sauvegardées, Custom, Lookalike)
- `ad_safety` (plafonds, seuils de confirmation)
- Créatives fournies par l'agent Creative

**Sorties :**
- Création / mise à jour de `campaigns`, `ad_sets`, `ads` avec les IDs externes Meta
- Alertes de dépassement de budget
- Recommandations d'ajustement (bid, audience, créative)

**Outils / API :**
- Meta Marketing API (`META_APP_ID`, `META_APP_SECRET`, `META_API_VERSION`)
- Vérification `ad_safety.monthly_cap` avant toute activation (garde-fou dur)
- Lecture/écriture `campaigns`, `ad_sets`, `ads`, `audiences`
- Écriture `audit_log` : `actor='agent:media_buyer'`, `action='campaign.activated'|'budget.alert'`

**Niveau d'autonomie :**
- Création de campagne : niveau 2 (validation humaine obligatoire)
- Ajustements de bid / budget mineurs (< seuil `double_confirm_threshold`) : niveau 3 possible
- Désactivation d'une campagne sous-performante : niveau 2 (alerte + proposition)

**Garde-fou spécifique :** avant tout appel d'activation Meta, vérifier :
```sql
SELECT (monthly_cap - used_this_month) FROM ad_safety WHERE company_id = $1
```
Si solde insuffisant → blocage immédiat, alerte email (`Gmail MCP`).

---

### 6. Analyste

**Rôle :** collecte, agrège et interprète les métriques de performance (organic + paid). Produit les rapports et identifie les anomalies.

**Entrées :**
- `history_items.metrics` (métriques organic par post)
- `campaigns.metrics`, `ads.metrics` (métriques paid)
- Google Analytics 4 Data API (trafic web, conversions)
- Données Meta Pixel / CAPI (conversions attributées)

**Sorties :**
- Rapport hebdomadaire structuré (JSON + résumé en langue naturelle)
- Alertes anomalies : CTR < seuil, CPM > seuil, posts viraux
- Recommandations transmises au Stratège

**Outils / API :**
- Lecture toutes les tables métriques
- Google Analytics Data API (`GA4_PROPERTY_ID`, `GOOGLE_SERVICE_ACCOUNT_KEY`)
- Meta Graph API insights (métriques organiques)
- Meta Marketing API reporting (métriques paid)
- Gmail MCP : envoi du digest quotidien si `ad_safety.daily_digest = true`
- Écriture `audit_log` : `actor='agent:analyst'`

**Niveau d'autonomie :** 1 (lecture et rapport uniquement, aucune action automatique).

**Modèle :** `claude-sonnet-4-6` avec prompt caching sur les données historiques agrégées.

---

### 7. Conformité (agent bloquant)

**Rôle :** vérifie que tout contenu (texte, image, vidéo) respecte les règles publicitaires applicables aux cliniques médicales : réglementation française, politiques Meta Health & Wellness, règles LinkedIn. Étape non contournable.

**Entrées :**
- Texte du post ou de l'ad (headline + body_text + CTA)
- Description du visuel (alt-text ou brief créa)
- Plateforme cible et marque (OCC / Tibok / CVMI)

**Sorties :**
```json
{
  "status": "PASS" | "FAIL" | "WARNING",
  "issues": [
    {
      "rule": "allégation_thérapeutique",
      "excerpt": "texte problématique",
      "fix": "reformulation proposée"
    }
  ],
  "auto_additions": ["Consultez un professionnel de santé avant tout traitement."],
  "requires_human_review": true | false
}
```

**Règles vérifiées :**

| Règle | Gravité | Action |
|---|---|---|
| Promesse de guérison / résultat garanti | Critique | FAIL — reformulation obligatoire |
| Avant/après photos (politique Meta) | Critique | FAIL — suppression du visuel |
| Allégation non substantiée scientifiquement | Haute | FAIL — reformulation |
| Prix sans mention "à partir de" | Moyenne | WARNING — validation humaine |
| Absence de "Consultez un médecin" si conseil médical | Moyenne | AUTO-AJOUT dans le texte |
| Citation de cas patients (même anonymisée) | Critique | FAIL — blocage absolu |
| Ciblage par condition médicale (politique Meta) | Haute | FAIL — révision du targeting |

**Outils / API :**
- Anthropic API : `claude-sonnet-4-6` avec system prompt de conformité complet (mis en cache)
- Écriture `audit_log` : `actor='agent:compliance'`, `action='compliance.check'`, `payload={status, issues}`
- Si FAIL → mise à jour `scheduled_posts.status = 'draft'`, `needs_review = true`

**Niveau d'autonomie :** l'agent Conformité opère toujours en mode bloquant. Il n'a pas de niveau — son résultat est une condition d'accès à la publication pour tous les autres agents.

**Modèle :** `claude-sonnet-4-6`. Prompt caching sur les règles de conformité (système constant, ~2000 tokens).

---

## Boucle de pilotage

```
[MESURE]
  Cron collecte métriques (J+1, J+7)
  Analyste agrège et détecte anomalies
        ↓
[RECOMMANDATION]
  Stratège génère le planning et les ajustements
  → Rapport lisible en dashboard
        ↓
[VALIDATION HUMAINE]
  L'éditeur ou le media buyer humain approuve/rejette
  Audit log : actor='user:<id>', action='plan.approved'
        ↓
[EXÉCUTION]
  Orchestrateur déclenche Copywriter → Conformité → Creative → Planification
  Si needs_review=true : attente validation humaine avant publication
  Sinon (niveau 3 validé) : publication automatique
        ↓
[RE-MESURE]
  Retour au début
```

---

## Rôle du `audit_log`

La table `audit_log` est le registre de toutes les actions, humaines ou automatisées.

| Champ | Contenu |
|---|---|
| `actor` | `'user:<uuid>'` (action humaine) ou `'agent:<name>'` (action IA) |
| `action` | Verbe métier : `post.drafted`, `compliance.check`, `campaign.activated`, `budget.alert`, `plan.approved`… |
| `entity` / `entity_id` | Table et ID de l'entité concernée (ex: `scheduled_posts` / `<uuid>`) |
| `payload` | Données contextuelles (résultat conformité, delta budget, modèle utilisé, tokens consommés) |

**Usage :** traçabilité réglementaire, debug des agents, reporting de l'activité IA aux clients, base pour l'audit RGPD.

---

## Approche d'implémentation technique

### Option A : API Routes Next.js (recommandé pour démarrer)

```
app/api/ai/
  orchestrate/route.ts      ← point d'entrée principal
  generate-post/route.ts    ← Copywriter
  compliance/route.ts       ← Conformité (déjà en place)
  generate-image/route.ts   ← Creative images
  generate-video/route.ts   ← Creative vidéo (async)
  analyze/route.ts          ← Analyste
  media-buyer/route.ts      ← Media Buyer
```

Chaque route utilise l'Anthropic SDK avec `tool_use` pour les agents qui doivent appeler des services externes. L'orchestrateur chaîne les appels via des `Promise` séquentielles ou un pattern de workflow simple.

### Option B : Supabase Edge Functions (recommandé pour les crons et l'async)

```
supabase/functions/
  publish-cron/         ← publie les posts planifiés (pg_cron trigger)
  metrics-collector/    ← collecte métriques J+1 (cron quotidien)
  compliance-webhook/   ← webhook appelé avant toute publication
  video-status-poll/    ← polling du statut de génération vidéo
```

Les Edge Functions Deno ont accès à toutes les variables d'env et contournent le timeout de 10s des API Routes Vercel.

### Orchestration avec Claude Agent SDK

Pour les workflows multi-étapes complexes (ex: générer 10 posts + images + vérification conformité en batch), utiliser le **Claude Agent SDK** (API Anthropic avec tool use itératif) :

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: env.anthropicKey });

// L'orchestrateur définit les outils disponibles (agents)
const tools = [
  { name: 'generate_post', description: 'Génère un post via le Copywriter', input_schema: {...} },
  { name: 'check_compliance', description: 'Vérifie la conformité santé', input_schema: {...} },
  { name: 'generate_image', description: 'Génère un visuel via fal.ai', input_schema: {...} },
  { name: 'schedule_post', description: 'Planifie le post en base', input_schema: {...} },
];

// Boucle agentic : Claude appelle les outils jusqu'à complétion
let response = await client.messages.create({
  model: env.anthropicModel,
  max_tokens: 4096,
  tools,
  messages: [{ role: 'user', content: brief }],
});

while (response.stop_reason === 'tool_use') {
  const toolResults = await executeTools(response.content);
  response = await client.messages.create({
    model: env.anthropicModel,
    max_tokens: 4096,
    tools,
    messages: [...previousMessages, { role: 'assistant', content: response.content }, { role: 'user', content: toolResults }],
  });
}
```

Chaque outil correspond à un appel à l'API route ou à la logique d'un agent. L'orchestrateur Claude décide de l'ordre et gère les erreurs et retries.
