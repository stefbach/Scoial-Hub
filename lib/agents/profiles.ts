/**
 * Catalogue de profils professionnels pour Social Hub.
 * Chaque profil adapte la stratégie, le ton, les plateformes et la compliance
 * aux réalités sectorielles d'un marché spécifique.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SectorKPIs {
  /** Coût pour mille impressions (€) — fourchette secteur */
  cpm: { min: number; max: number; unit: "€" };
  /** Coût par clic (€) — fourchette secteur */
  cpc: { min: number; max: number; unit: "€" };
  /** Taux de clic (%) — fourchette secteur */
  ctr: { min: number; max: number; unit: "%" };
  /** Taux d'engagement (%) — fourchette secteur */
  engagementRate: { min: number; max: number; unit: "%" };
  /** Coût par acquisition / lead (€) — fourchette secteur */
  cpa: { min: number; max: number; unit: "€" };
  /** Taux de conversion landing page (%) */
  conversionRate: { min: number; max: number; unit: "%" };
  /** ROAS moyen (si applicable) */
  roas?: { min: number; max: number; unit: "x" };
}

export interface ProProfile {
  /** Identifiant unique */
  id: string;
  /** Libellé affiché en français */
  label: string;
  /** Description courte du secteur */
  description: string;
  /** Leviers d'acquisition typiques pour ce secteur */
  acquisitionLevers: string[];
  /** Plateformes prioritaires (du plus au moins prioritaire) */
  priorityPlatforms: string[];
  /** Contraintes réglementaires et compliance spécifiques */
  complianceConstraints: string[];
  /** KPIs sectoriels de référence */
  sectorKPIs: SectorKPIs;
  /** Audience typique (démographie, psychographie) */
  typicalAudience: string;
  /** Angles de contenu recommandés */
  contentAngles: string[];
  /** Ton de communication recommandé */
  recommendedTone: string;
  /** Champ sémantique prioritaire (mots-clés / thèmes) */
  semanticField: string[];
  /** Objectif de captation audience (% de portée sur cible) — objectif réaliste 90 jours */
  audienceCaptureTarget90d: number;
}

// ── Catalogue des profils ──────────────────────────────────────────────────────

export const PRO_PROFILES: ProProfile[] = [
  {
    id: "sante_clinique",
    label: "Clinique / Santé générale",
    description:
      "Établissements de soins, cliniques, centres médicaux pluridisciplinaires. Priorité à la confiance, à l'accessibilité et à la proximité patient.",
    acquisitionLevers: [
      "SEA local (Google Ads) sur mots-clés symptômes",
      "Facebook Ads ciblage géographique 15 km",
      "Contenu éducatif (articles, vidéos) pour le SEO",
      "Partenariats médecins généralistes / pharmacies",
      "Avis Google My Business et référencement local",
    ],
    priorityPlatforms: ["Facebook", "Instagram", "Google", "YouTube"],
    complianceConstraints: [
      "ANSM : aucune promesse de guérison, résultats garantis interdits",
      "CSA / Arcom : mentions légales obligatoires (N° RPPS, Ordres)",
      "RGPD : collecte de données de santé — consentement explicite requis",
      "Meta Health policies : pas de ciblage par condition médicale",
      "Loi Kouchner : respect du droit à l'information des patients",
    ],
    sectorKPIs: {
      cpm: { min: 6, max: 12, unit: "€" },
      cpc: { min: 0.8, max: 2.0, unit: "€" },
      ctr: { min: 1.2, max: 2.5, unit: "%" },
      engagementRate: { min: 1.5, max: 4.0, unit: "%" },
      cpa: { min: 15, max: 45, unit: "€" },
      conversionRate: { min: 3, max: 8, unit: "%" },
    },
    typicalAudience:
      "35–65 ans, toute CSP, préoccupations santé actives, géolocalisation urbaine/péri-urbaine France",
    contentAngles: [
      "Prévention et dépistage",
      "Témoignages patients (avec consentement)",
      "Présentation des praticiens",
      "Informations sur les pathologies fréquentes",
      "Accès aux soins et prise en charge",
    ],
    recommendedTone:
      "Rassurant, expert, chaleureux, accessible. Éviter tout jargon médical non expliqué.",
    semanticField: [
      "soin",
      "santé",
      "médecin",
      "consultation",
      "bien-être",
      "prévention",
      "spécialiste",
      "prise en charge",
      "accompagnement",
    ],
    audienceCaptureTarget90d: 12,
  },
  {
    id: "teleconsultation",
    label: "Téléconsultation médicale",
    description:
      "Plateformes de médecine à distance, consultation vidéo, télésuivi. Accent sur la praticité, la rapidité et la déstigmatisation.",
    acquisitionLevers: [
      "App Store Optimization (ASO) et install ads",
      "Google UAC (Universal App Campaigns)",
      "Instagram/TikTok Ads — 18-45 ans urbains",
      "Référencement SEO sur requêtes d'urgence et garde",
      "Partenariats mutuelles et employeurs (B2B2C)",
      "Influenceurs santé et médecins créateurs de contenu",
    ],
    priorityPlatforms: ["Instagram", "TikTok", "Google", "Facebook", "LinkedIn"],
    complianceConstraints: [
      "Décret télémédecine (Art. L.6316-1 CSP) : acte médical réglementé",
      "ANSM : interdiction de délivrance d'ordonnances sans antécédent",
      "CNIL : hébergeur de données de santé (HDS) obligatoire",
      "Meta : aucun ciblage par état de santé ou comportement médical",
      "Publicité médicale : visa publiicté ministère de la santé si médicament",
    ],
    sectorKPIs: {
      cpm: { min: 5, max: 10, unit: "€" },
      cpc: { min: 0.6, max: 1.5, unit: "€" },
      ctr: { min: 1.8, max: 3.5, unit: "%" },
      engagementRate: { min: 2.0, max: 5.5, unit: "%" },
      cpa: { min: 8, max: 25, unit: "€" },
      conversionRate: { min: 5, max: 12, unit: "%" },
      roas: { min: 2.5, max: 6.0, unit: "x" },
    },
    typicalAudience:
      "18–45 ans, CSP+, urbains et ruraux sans médecin traitant, actifs pressés, parents de jeunes enfants",
    contentAngles: [
      "Gain de temps / praticité",
      "Accès aux soins en zones sous-dotées",
      "Tarification et remboursement sécurité sociale",
      "Urgences non-vitales et avis médical rapide",
      "Santé mentale et suivi chronique",
    ],
    recommendedTone:
      "Moderne, dynamique, rassurant. Mettre en avant la simplicité d'usage et la légitimité médicale.",
    semanticField: [
      "téléconsultation",
      "consultation en ligne",
      "médecin à distance",
      "ordonnance",
      "urgence",
      "disponible 24h",
      "sans déplacement",
      "remboursé",
      "application santé",
    ],
    audienceCaptureTarget90d: 18,
  },
  {
    id: "medical_international",
    label: "Médical international",
    description:
      "Tourisme médical, centres de soin à l'international, cliniques recevant des patients étrangers. Multilinguisme et standards internationaux.",
    acquisitionLevers: [
      "Google Ads international (Search + Display) multi-langues",
      "Contenu YouTube en arabe, anglais, français",
      "Partenariats avec agences de tourisme médical",
      "SEO sur requêtes « chirurgie esthétique [pays] prix »",
      "Campagnes Meta ciblage diaspora et expats",
      "Réseaux sociaux spécifiques marché (Snapchat MENA, WeChat Asie)",
    ],
    priorityPlatforms: ["Facebook", "Instagram", "YouTube", "Google", "Snapchat"],
    complianceConstraints: [
      "Publicité comparative interdite (Directive 2006/114/CE)",
      "Mention du pays de réglementation et des accréditations",
      "Conformité RGPD pour les citoyens européens",
      "Politiques de visa médical selon pays de destination",
      "Interdiction des témoignages avant/après chirurgie sur Meta",
    ],
    sectorKPIs: {
      cpm: { min: 4, max: 9, unit: "€" },
      cpc: { min: 0.5, max: 1.8, unit: "€" },
      ctr: { min: 1.5, max: 3.0, unit: "%" },
      engagementRate: { min: 1.8, max: 4.5, unit: "%" },
      cpa: { min: 30, max: 120, unit: "€" },
      conversionRate: { min: 2, max: 6, unit: "%" },
    },
    typicalAudience:
      "25–60 ans, revenus moyens-élevés, diaspora africaine/moyen-orientale en Europe, expatriés, patients recherchant des soins abordables",
    contentAngles: [
      "Expertise médicale et accréditations internationales",
      "Prise en charge complète (voyage + séjour + soin)",
      "Tarifs transparents et comparatifs",
      "Témoignages multilingues",
      "Protocoles de sécurité et qualité",
    ],
    recommendedTone:
      "Professionnel, international, transparent sur les tarifs, rassurant sur la sécurité.",
    semanticField: [
      "tourisme médical",
      "soins à l'étranger",
      "chirurgie",
      "accréditation",
      "package médical",
      "clinique internationale",
      "prix compétitifs",
      "qualité européenne",
    ],
    audienceCaptureTarget90d: 10,
  },
  {
    id: "ecommerce_dtc",
    label: "E-commerce DTC (Direct-to-Consumer)",
    description:
      "Marques vendant directement au consommateur en ligne : cosmétiques, compléments alimentaires, dispositifs médicaux grand public.",
    acquisitionLevers: [
      "Meta Ads (Prospecting + Retargeting) avec catalogue produit",
      "Google Shopping + Performance Max",
      "Email marketing automation (welcome, abandon panier)",
      "Influenceur micro & nano (taux d'engagement élevé)",
      "TikTok Shop et live commerce",
      "Programme de parrainage et fidélité",
    ],
    priorityPlatforms: ["Instagram", "TikTok", "Facebook", "Google", "Pinterest"],
    complianceConstraints: [
      "DGCCRF : pas d'allégations santé non autorisées (Règlement CE 1924/2006)",
      "ARPP : code de la publicité responsable",
      "Meta : restrictions produits santé et beauté",
      "ANSM : dispositifs médicaux — marquage CE obligatoire",
      "Code de la consommation : droit de rétractation 14j mentionné",
    ],
    sectorKPIs: {
      cpm: { min: 7, max: 18, unit: "€" },
      cpc: { min: 0.5, max: 2.5, unit: "€" },
      ctr: { min: 1.5, max: 4.0, unit: "%" },
      engagementRate: { min: 2.5, max: 7.0, unit: "%" },
      cpa: { min: 12, max: 55, unit: "€" },
      conversionRate: { min: 2, max: 8, unit: "%" },
      roas: { min: 2.0, max: 8.0, unit: "x" },
    },
    typicalAudience:
      "18–45 ans, femmes majoritairement, CSP+, sensibles au bien-être et à la beauté naturelle, acheteurs en ligne réguliers",
    contentAngles: [
      "Résultats visibles et mesurables (sans promesses médicales)",
      "Ingrédients et formulations transparentes",
      "UGC (User Generated Content) et avis clients",
      "Rituels et routines bien-être",
      "Durabilité et ingrédients naturels",
    ],
    recommendedTone:
      "Aspirationnel, authentique, lifestyle. Miser sur l'identification et le désir plutôt que sur la peur.",
    semanticField: [
      "bien-être",
      "naturel",
      "routine",
      "résultats",
      "ingrédients",
      "certifié",
      "efficace",
      "transformez",
      "vitalité",
    ],
    audienceCaptureTarget90d: 22,
  },
  {
    id: "saas_b2b",
    label: "SaaS B2B",
    description:
      "Logiciels en mode SaaS vendus aux entreprises : gestion médicale, CRM santé, outils de coordination de soins, télémédecine B2B.",
    acquisitionLevers: [
      "LinkedIn Ads (decision makers, job title targeting)",
      "Content marketing SEO (articles expert, livres blancs)",
      "Webinaires et démos produit",
      "Cold outreach LinkedIn et email séquences",
      "G2 / Capterra reviews et SEO comparatifs",
      "Partenariats intégrateurs et revendeurs",
    ],
    priorityPlatforms: ["LinkedIn", "Google", "Twitter/X", "YouTube"],
    complianceConstraints: [
      "RGPD : DPA (Data Processing Agreement) avec les clients",
      "HDS si traitement de données de santé",
      "SOC 2 / ISO 27001 mentionner les certifications",
      "Pas de garanties de résultats financiers (réglementation AMF si investissement)",
      "ANSM si dispositif médical numérique (DM software)",
    ],
    sectorKPIs: {
      cpm: { min: 12, max: 35, unit: "€" },
      cpc: { min: 2.5, max: 8.0, unit: "€" },
      ctr: { min: 0.5, max: 1.5, unit: "%" },
      engagementRate: { min: 0.8, max: 2.5, unit: "%" },
      cpa: { min: 80, max: 400, unit: "€" },
      conversionRate: { min: 1, max: 5, unit: "%" },
      roas: { min: 3.0, max: 10.0, unit: "x" },
    },
    typicalAudience:
      "Décideurs 30–55 ans, DSI, DRH, DAF, directeurs médicaux, PME et ETI, secteur santé, médico-social",
    contentAngles: [
      "ROI et gains d'efficacité chiffrés",
      "Cas clients et études de cas",
      "Intégrations avec l'écosystème existant",
      "Conformité réglementaire et sécurité des données",
      "Comparatifs concurrents (position leader)",
    ],
    recommendedTone:
      "Expert, sobre, orienté business value. Données et preuves avant tout. Éviter les superlatifs non étayés.",
    semanticField: [
      "efficacité",
      "ROI",
      "automatisation",
      "conformité",
      "intégration",
      "scalable",
      "sécurisé",
      "données de santé",
      "productivité",
    ],
    audienceCaptureTarget90d: 8,
  },
  {
    id: "cabinet_liberal",
    label: "Cabinet libéral médical",
    description:
      "Médecins, kinésithérapeutes, infirmiers, dentistes, psychologues en exercice libéral. Proximité locale et relation patient au cœur.",
    acquisitionLevers: [
      "Google My Business (fiche et avis patients)",
      "Facebook local ads (rayon 5-10 km)",
      "Doctolib / Keldoc référencement payant",
      "Site web SEO local (balises locales, schema.org)",
      "Instagram professionnel (coulisses, équipe)",
      "Réseau de prescription médecins généralistes",
    ],
    priorityPlatforms: ["Facebook", "Google", "Instagram"],
    complianceConstraints: [
      "Code de déontologie médicale (art. 13 & 19) : publicité réglementée",
      "Ordre des médecins : communication professionnelle uniquement",
      "Pas de tarification affichée sans mention des dépassements",
      "RGPD : données patients — strictement no-tracking tiers",
      "Télésanté : acte déclaré à la CPAM obligatoire",
    ],
    sectorKPIs: {
      cpm: { min: 5, max: 10, unit: "€" },
      cpc: { min: 0.6, max: 1.8, unit: "€" },
      ctr: { min: 1.0, max: 2.5, unit: "%" },
      engagementRate: { min: 2.0, max: 5.0, unit: "%" },
      cpa: { min: 10, max: 35, unit: "€" },
      conversionRate: { min: 4, max: 10, unit: "%" },
    },
    typicalAudience:
      "Tous âges, géolocalisation stricte (2-8 km autour du cabinet), familles, personnes âgées, actifs",
    contentAngles: [
      "Présentation du praticien et de ses valeurs",
      "Conseils santé de saison",
      "Prise de rendez-vous en ligne (Doctolib)",
      "Nouvelles technologies du cabinet",
      "Prévention et vaccination",
    ],
    recommendedTone:
      "Local, humain, de proximité. Montrer le visage du praticien. Éviter le corporatif.",
    semanticField: [
      "votre médecin",
      "proche de chez vous",
      "rendez-vous",
      "cabinet",
      "spécialiste",
      "consultation",
      "soins",
      "prise en charge",
    ],
    audienceCaptureTarget90d: 15,
  },
  {
    id: "retail_local",
    label: "Retail local / Commerce de proximité",
    description:
      "Pharmacies, parapharmacies, magasins bio, boutiques de matériel médical. Ancrage territorial et conseil expert.",
    acquisitionLevers: [
      "Facebook/Instagram local ads (rayon <10 km)",
      "Google Local Inventory Ads",
      "Programme de fidélité digital",
      "SMS marketing et push notifications",
      "Animations en magasin relayées sur les réseaux",
      "Google My Business posts hebdomadaires",
    ],
    priorityPlatforms: ["Facebook", "Instagram", "Google"],
    complianceConstraints: [
      "Ordre national des pharmaciens : publicité très encadrée",
      "ANSM : interdiction de promotion de médicaments sur ordonnance",
      "Code de la consommation : prix barrés et promotions réglementés",
      "Loi Évin : aucune référence à l'alcool dans produits santé",
      "DGCCRF : étiquetage et allégations nutritionnelles conformes",
    ],
    sectorKPIs: {
      cpm: { min: 4, max: 9, unit: "€" },
      cpc: { min: 0.4, max: 1.2, unit: "€" },
      ctr: { min: 1.5, max: 3.5, unit: "%" },
      engagementRate: { min: 2.0, max: 6.0, unit: "%" },
      cpa: { min: 5, max: 20, unit: "€" },
      conversionRate: { min: 5, max: 15, unit: "%" },
      roas: { min: 3.0, max: 12.0, unit: "x" },
    },
    typicalAudience:
      "Tous âges, géolocalisation très stricte (<8 km), familles avec enfants, seniors actifs",
    contentAngles: [
      "Promotions et temps forts saisonniers",
      "Conseils pharmacien / expert conseil",
      "Nouveaux produits en stock",
      "Services en magasin (vaccination, dépistage rapide)",
      "Programme fidélité et avantages clients",
    ],
    recommendedTone:
      "Convivial, expert, local. Parler à la communauté. Valoriser le conseil humain vs internet.",
    semanticField: [
      "pharmacie",
      "conseil",
      "parapharmacie",
      "livraison",
      "produit naturel",
      "bio",
      "santé familiale",
      "promotion",
      "fidélité",
    ],
    audienceCaptureTarget90d: 20,
  },
];

/** Retrouve un profil par son identifiant. */
export function getProfile(id: string): ProProfile | undefined {
  return PRO_PROFILES.find((p) => p.id === id);
}

/** Retourne le profil par défaut (clinique/santé générale). */
export function getDefaultProfile(): ProProfile {
  return PRO_PROFILES[0];
}
