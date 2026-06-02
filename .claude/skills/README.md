# Skills — Social Hub

Skills officiels Anthropic (source : github.com/anthropics/skills), installés dans le repo
pour être disponibles dans les sessions Claude Code (web/CLI) sur ce projet.

> Note : un skill ajouté pendant une session ne s'active qu'à la **session suivante**
> (les skills sont chargés au démarrage).

## Les plus pertinents pour ce projet

| Skill | Usage pour Social Hub |
|---|---|
| **claude-api** | Construire/optimiser le cerveau IA et le dispositif multi-agent (tool use, caching) |
| **mcp-builder** | Créer des connecteurs MCP (Meta Ads, LinkedIn) en serveurs MCP |
| **brand-guidelines** | Cohérence de marque (OCC / Tibok / CVMI) dans les contenus générés |
| **frontend-design** | Évolutions UI de l'app |
| **webapp-testing** | Tests end-to-end de l'app |
| **theme-factory** | Systèmes de thèmes / design tokens |
| **canvas-design** | Création de visuels |
| **pptx / xlsx / docx / pdf** | Reporting de campagnes (decks, exports, rapports) |
| **skill-creator** | Créer des skills maison (ex : "lancer-campagne", "audit-conformité") |

## Non installés (et pourquoi)
- `alirezarezvani/claude-skills` : tiers, embarque des **hooks Python auto-exécutés** au
  démarrage de session → écarté par précaution (repo connecté à des données de prod).
- `awesome-claude-code` : simple liste de liens, rien à installer.
- `anthropics/claude-code` : code source du CLI, pas un skill.
