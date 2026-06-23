"use client";

// Page (non-modale) de création d'une VRAIE publicité Meta, branchée sur le
// compte publicitaire connecté. Chaîne complète Campagne → Ad set → Créative →
// Ad créée EN PAUSE (aucune dépense), puis activable explicitement (= dépense).

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCompany } from "@/lib/company-context";
import { useT, useLang } from "@/lib/i18n";
import { StudioHero, Segmented } from "@/components/studio/StudioUI";
import { IconMegaphone } from "@/components/visual/Icons";
import { MetaGeoPicker, type GeoLoc } from "@/components/ads/MetaGeoPicker";
import { MetaLanguagePicker, type MetaLocale } from "@/components/ads/MetaLanguagePicker";
import { Spinner, BusyHint } from "@/components/ui/Spinner";
import { generateVideoPolling } from "@/lib/ai/generate-video-client";
import { overlayLogoAndUpload, type LogoCorner } from "@/lib/media/logo-overlay";
import { AdResultPanel } from "@/components/paid/AdResultPanel";
import { AdAssistantPanel } from "@/components/paid/AdAssistantPanel";

interface Conn {
  connected: boolean;
  accountName?: string;
  currency?: string;
  adAccountId?: string;
  needsReconnect?: boolean;
}

interface PublishResult {
  campaignId: string;
  adSetId: string;
  creativeId: string;
  adId: string;
  adIds?: string[];
  leadFormId?: string;
  status: string;
}

const OBJECTIVES: { id: string; fr: string; en: string }[] = [
  { id: "notoriété", fr: "Notoriété", en: "Awareness" },
  { id: "trafic", fr: "Trafic", en: "Traffic" },
  { id: "engagement", fr: "Engagement", en: "Engagement" },
  { id: "leads", fr: "Prospects", en: "Leads" },
  { id: "ventes", fr: "Ventes", en: "Sales" },
  { id: "conversions", fr: "Conversions", en: "Conversions" },
];

const CTAS = ["LEARN_MORE", "SHOP_NOW", "SIGN_UP", "CONTACT_US", "SUBSCRIBE", "BOOK_TRAVEL", "GET_OFFER", "DOWNLOAD"];

// Formats de visuel adaptés aux placements Meta.
const VISUAL_FORMATS: { id: string; fr: string; en: string }[] = [
  { id: "1:1", fr: "Carré (fil)", en: "Square (feed)" },
  { id: "4:5", fr: "Portrait (fil)", en: "Portrait (feed)" },
  { id: "9:16", fr: "Story / Reel", en: "Story / Reel" },
  { id: "1.91:1", fr: "Paysage", en: "Landscape" },
];

// Date locale au format input datetime-local (YYYY-MM-DDTHH:MM).
function toLocalDT(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function NewMetaAdPage() {
  const t = useT();
  const { lang } = useLang();
  const { company, access } = useCompany();
  const canEdit = access.canEdit;
  const companyId = company.id;

  // Connexion Meta
  const [conn, setConn] = useState<Conn | null>(null);
  const [loadingConn, setLoadingConn] = useState(true);

  // Type de publicité : trafic vers le site OU formulaire de prospects (Lead Ad)
  const [adType, setAdType] = useState<"traffic" | "lead">("traffic");

  // Champs
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("trafic");

  // Formulaire de prospects (Instant Form)
  const [formName, setFormName] = useState("");
  const [privacyUrl, setPrivacyUrl] = useState("");
  const [formIntro, setFormIntro] = useState("");
  const [fldFullName, setFldFullName] = useState(true);
  const [fldEmail, setFldEmail] = useState(true);
  const [fldPhone, setFldPhone] = useState(true);
  const [thankYouTitle, setThankYouTitle] = useState("");
  const [thankYouBody, setThankYouBody] = useState("");
  const [budget, setBudget] = useState(20); // EUR / jour
  const [budgetType, setBudgetType] = useState<"daily" | "lifetime">("daily");
  const [lifetimeBudget, setLifetimeBudget] = useState(300);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  // Localisations Meta (pays + villes + régions) via autocomplétion officielle.
  const [geoLocs, setGeoLocs] = useState<GeoLoc[]>([
    { key: "FR", name: "France", type: "country", countryCode: "FR" },
  ]);
  const [languages, setLanguages] = useState<MetaLocale[]>([]);
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(65);
  const [gender, setGender] = useState<"all" | "male" | "female">("all");

  // Audience : centres d'intérêt
  const [interestQuery, setInterestQuery] = useState("");
  const [interestResults, setInterestResults] = useState<{ id: string; name: string; audienceSize?: number }[]>([]);
  const [searchingInt, setSearchingInt] = useState(false);
  const [selInterests, setSelInterests] = useState<{ id: string; name: string }[]>([]);
  // Exclusions de ciblage (intérêts, audiences, localisations).
  const [exInterests, setExInterests] = useState<{ id: string; name: string }[]>([]);
  // Recherche DÉDIÉE pour les centres d'intérêt à EXCLURE (#6).
  const [exQuery, setExQuery] = useState("");
  const [exResults, setExResults] = useState<{ id: string; name: string; audienceSize?: number }[]>([]);
  const [searchingEx, setSearchingEx] = useState(false);
  const [exAudiences, setExAudiences] = useState<{ id: string; name: string }[]>([]);
  const [exGeoLocs, setExGeoLocs] = useState<GeoLoc[]>([]);

  // Placements
  const [placement, setPlacement] = useState<"auto" | "manual">("auto");
  const [plFacebook, setPlFacebook] = useState(true);
  const [plInstagram, setPlInstagram] = useState(true);
  const [posFeed, setPosFeed] = useState(true);
  const [posStory, setPosStory] = useState(false);
  const [posReels, setPosReels] = useState(false);

  // Visuels (carrousel possible) + vidéo
  const [imageUrl, setImageUrl] = useState("");
  const [extraImages, setExtraImages] = useState<string[]>([]);
  const [newExtraUrl, setNewExtraUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoThumbUrl, setVideoThumbUrl] = useState("");
  const [genVid, setGenVid] = useState(false);
  const [vidStatus, setVidStatus] = useState("");
  // Prompt du visuel + formats à générer
  const [visualPrompt, setVisualPrompt] = useState("");
  const [visualFormats, setVisualFormats] = useState<string[]>(["1:1"]);
  const [generatedVisuals, setGeneratedVisuals] = useState<{ format: string; url: string }[]>([]);
  // Bibliothèque média
  const [libOpen, setLibOpen] = useState(false);
  const [libAssets, setLibAssets] = useState<{ url: string; type: string; format?: string; source?: string }[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  // Logo de marque incrusté sur le visuel de l'annonce
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  const [logoCorner, setLogoCorner] = useState<LogoCorner>("br");
  const [applyingLogo, setApplyingLogo] = useState(false);

  // Conversions (pixel)
  const [pixels, setPixels] = useState<{ id: string; name: string }[]>([]);
  const [pixelId, setPixelId] = useState("");
  const [conversionEvent, setConversionEvent] = useState("LEAD");

  // Audiences personnalisées / similaires
  const [audiences, setAudiences] = useState<{ id: string; name: string; subtype: string; size?: number }[]>([]);
  const [selAudiences, setSelAudiences] = useState<{ id: string; name: string }[]>([]);
  const [loadingAud, setLoadingAud] = useState(false);

  // Variantes A/B (textes principaux additionnels)
  const [variants, setVariants] = useState<string[]>([]);

  // Prospects récupérés (après création d'une pub formulaire)
  const [leads, setLeads] = useState<{ createdTime: string; fields: Record<string, string> }[] | null>(null);
  const [loadingLeads, setLoadingLeads] = useState(false);

  const isConvObjective = objective === "ventes" || objective === "conversions";

  // Deux expériences possibles : assistant IA OU réglages avancés manuels.
  const [mode, setMode] = useState<"assist" | "manual">("assist");

  // Assistant IA conversationnel (chat → remplissage automatique)
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [assisting, setAssisting] = useState(false);
  const [planReady, setPlanReady] = useState(false);
  const [primaryText, setPrimaryText] = useState("");
  const [headline, setHeadline] = useState("");
  const [link, setLink] = useState("");
  const [cta, setCta] = useState("LEARN_MORE");

  // États
  const [genImg, setGenImg] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [liveMsg, setLiveMsg] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  const loadConn = useCallback(async () => {
    setLoadingConn(true);
    try {
      const r = await fetch(`/api/meta/adaccounts?companyId=${encodeURIComponent(companyId)}`);
      if (!r.ok) { setConn({ connected: false }); return; }
      const d = await r.json();
      setConn({
        connected: !d.needsReconnect && !!d.selectedId,
        accountName: d.data?.account?.name,
        currency: d.data?.account?.currency,
        adAccountId: d.selectedId ? String(d.selectedId).replace(/^act_/, "") : undefined,
        needsReconnect: d.needsReconnect,
      });
    } catch {
      setConn({ connected: false });
    } finally {
      setLoadingConn(false);
    }
  }, [companyId]);

  useEffect(() => { loadConn(); }, [loadConn]);

  // Pré-remplissage depuis n'importe quelle page (studio, bibliothèque, post) via
  // ?image=…&video=…&text=…&name=…  → « créer une campagne » lié de partout.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const img = sp.get("image"); const vid = sp.get("video"); const txt = sp.get("text"); const nm = sp.get("name");
    if (img) { setImageUrl(img); setGeneratedVisuals((g) => [{ format: "import", url: img }, ...g]); }
    if (vid) setVideoUrl(vid);
    if (txt) setPrimaryText(txt);
    if (nm) setName(nm);
  }, []);

  // Génération vidéo IA (asynchrone) pour la créative de campagne.
  async function generateVideo() {
    const prompt = ((visualPrompt || [headline, primaryText, name].find((s) => s.trim()) || "").trim());
    if (!prompt) { setError(t("Écrivez un prompt (ou un titre/texte) pour la vidéo.", "Write a prompt (or headline/text) for the video.")); return; }
    setError(null); setGenVid(true); setVidStatus(t("Lancement…", "Starting…"));
    try {
      const aspect = visualFormats.includes("9:16") ? "9:16" : visualFormats.includes("1.91:1") ? "16:9" : "1:1";
      const res = await generateVideoPolling({ prompt, aspect, seconds: 6 }, { onStatus: (s) => setVidStatus(s) });
      if (res.url) { setVideoUrl(res.url); setVidStatus(""); saveToLibrary(res.url, "video"); }
      else if (res.simulated) setError(t("Génération vidéo non configurée (REPLICATE_API_TOKEN).", "Video generation not configured."));
      else setError(res.error === "network" ? t("Erreur réseau.", "Network error.") : t("Échec de génération vidéo. Réessayez.", "Video generation failed. Try again."));
    } finally { setGenVid(false); setVidStatus(""); }
  }

  // Génère le visuel pour chaque format sélectionné (carré, portrait, story…).
  // `sourceUrl` → mode déclinaison (img2img) à partir d'un visuel existant.
  async function generateVisual(promptOverride?: string, formatsOverride?: string[], sourceUrl?: string) {
    const prompt = ((promptOverride ?? visualPrompt) || [headline, primaryText, name].find((s) => s.trim()) || "").trim();
    if (!prompt) { setError(t("Écrivez un prompt de visuel (ou un titre/texte).", "Write a visual prompt (or a headline/text).")); return; }
    const formats = formatsOverride && formatsOverride.length ? formatsOverride : visualFormats;
    if (!formats.length) { setError(t("Choisissez au moins un format.", "Pick at least one format.")); return; }
    setError(null); setGenImg(true);
    try {
      const results: { format: string; url: string }[] = [];
      for (const fmt of formats) {
        const r = await fetch("/api/ai/generate-image", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, format: fmt, n: 1, companyId, imageUrl: sourceUrl || undefined }),
        });
        const raw = await r.text();
        let d: { images?: Array<string | { url?: string }>; error?: string; simulated?: boolean } = {};
        try { d = raw ? JSON.parse(raw) : {}; } catch { setError(t("Réponse inattendue lors de la génération.", "Unexpected response while generating.")); continue; }
        if (!r.ok) { setError(d.error || t("Échec de génération d'image.", "Image generation failed.")); continue; }
        if (d.simulated) { setError(t("Génération d'images non configurée (REPLICATE_API_TOKEN).", "Image generation not configured.")); break; }
        const urls = (d.images ?? []).map((i) => (typeof i === "string" ? i : i?.url ?? "")).filter(Boolean);
        if (urls[0]) results.push({ format: fmt, url: urls[0] });
      }
      if (results.length) {
        setGeneratedVisuals((prev) => [...prev.filter((p) => !results.some((r) => r.format === p.format)), ...results]);
        setImageUrl((cur) => cur || results[0].url); // 1er format = visuel principal par défaut
        // (enregistrement bibliothèque fait côté serveur via companyId)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Échec de génération d'image.", "Image generation failed."));
    } finally { setGenImg(false); }
  }
  function toggleFormat(f: string) {
    setVisualFormats((cur) => cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]);
  }
  // Enregistre un asset dans la bibliothèque (non bloquant).
  function saveToLibrary(url: string, type: "image" | "video", format?: string) {
    if (!url) return;
    fetch("/api/media", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, url, type, format, source: "campaign" }),
    }).catch(() => {});
  }
  async function loadLibrary() {
    setLibOpen(true); setLibLoading(true);
    try {
      const r = await fetch(`/api/media?companyId=${encodeURIComponent(companyId)}`);
      const d = await r.json();
      setLibAssets(Array.isArray(d.assets) ? d.assets : []);
    } catch { setLibAssets([]); } finally { setLibLoading(false); }
  }

  // Récupère le logo de la marque (depuis la bibliothèque) au chargement, pour
  // proposer son incrustation sur le visuel de l'annonce.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await fetch(`/api/media?companyId=${encodeURIComponent(companyId)}`);
        const d = await r.json();
        const assets: { url: string; source?: string }[] = Array.isArray(d.assets) ? d.assets : [];
        const logo = assets.find((a) => (a.source ?? "").startsWith("brand-kit:logo"));
        if (active && logo?.url) setBrandLogoUrl(logo.url);
      } catch { /* logo optionnel */ }
    })();
    return () => { active = false; };
  }, [companyId]);

  // Incruste le logo de la marque sur le visuel sélectionné → nouveau visuel logoté.
  async function applyLogoToVisual() {
    if (!imageUrl) { setError(t("Choisissez d'abord un visuel.", "Pick a visual first.")); return; }
    if (!brandLogoUrl) { setError(t("Aucun logo de marque. Importez-le dans le brand kit (studio).", "No brand logo. Upload it in the brand kit (studio).")); return; }
    setError(null); setApplyingLogo(true);
    try {
      const url = await overlayLogoAndUpload({ companyId, imageUrl, logoUrl: brandLogoUrl, corner: logoCorner, source: "campaign-logo" });
      setGeneratedVisuals((prev) => [{ format: t("logo", "logo"), url }, ...prev]);
      setImageUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Échec de l'incrustation du logo.", "Logo overlay failed."));
    } finally { setApplyingLogo(false); }
  }

  // Convertit une date (ISO ou yyyy-mm-dd) au format input datetime-local.
  function toLocalInput(d?: string): string {
    if (!d) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      // Pour une date sans heure : si c'est aujourd'hui, propose une heure
      // POSTÉRIEURE à maintenant (≈ +1 h arrondie) plutôt qu'un 9 h figé déjà passé.
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (d === todayStr) {
        const later = new Date(now.getTime() + 60 * 60 * 1000);
        later.setMinutes(0, 0, 0);
        return `${d}T${String(later.getHours()).padStart(2, "0")}:00`;
      }
      return `${d}T09:00`;
    }
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 16);
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  function applyPlan(p: any) {
    if (!p) return;
    const lead = p.adType === "lead";
    setAdType(lead ? "lead" : "traffic");
    if (p.name) setName(String(p.name));
    if (!lead && typeof p.objective === "string" && OBJECTIVES.some((o) => o.id === p.objective)) setObjective(p.objective);
    setBudgetType(p.budgetType === "lifetime" ? "lifetime" : "daily");
    if (Number(p.dailyBudget) > 0) setBudget(Math.round(Number(p.dailyBudget)));
    if (Number(p.lifetimeBudget) > 0) setLifetimeBudget(Math.round(Number(p.lifetimeBudget)));
    if (p.startDate) setStartDate(toLocalInput(p.startDate));
    if (p.endDate) setEndDate(toLocalInput(p.endDate));
    if (Array.isArray(p.countries) && p.countries.length) {
      // L'IA renvoie des codes pays → on les ajoute comme localisations « pays ».
      setGeoLocs(p.countries.map((c: string) => {
        const code = String(c).trim().toUpperCase();
        return { key: code, name: code, type: "country", countryCode: code };
      }));
    }
    if (["all", "male", "female"].includes(p.gender)) setGender(p.gender);
    if (Number(p.ageMin)) setAgeMin(Number(p.ageMin));
    if (Number(p.ageMax)) setAgeMax(Number(p.ageMax));
    if (Array.isArray(p.interests)) setSelInterests(p.interests.filter((i: any) => i?.id && i?.name).map((i: any) => ({ id: String(i.id), name: String(i.name) })));
    setPlacement(p.placement === "manual" ? "manual" : "auto");
    if (p.primaryText) setPrimaryText(String(p.primaryText));
    if (p.headline) setHeadline(String(p.headline));
    if (p.cta) setCta(String(p.cta));
    if (typeof p.link === "string") setLink(p.link);
    if (Array.isArray(p.variants)) setVariants(p.variants.filter(Boolean).slice(0, 4).map(String));
    if (p.conversionEvent) setConversionEvent(String(p.conversionEvent));
    if (lead && p.leadForm) {
      const lf = p.leadForm;
      if (lf.formName) setFormName(String(lf.formName));
      if (lf.privacyUrl) setPrivacyUrl(String(lf.privacyUrl));
      if (lf.intro) setFormIntro(String(lf.intro));
      const f: string[] = Array.isArray(lf.fields) ? lf.fields : [];
      setFldFullName(f.includes("FULL_NAME"));
      setFldEmail(f.includes("EMAIL") || f.length === 0);
      setFldPhone(f.includes("PHONE"));
      if (lf.thankYouTitle) setThankYouTitle(String(lf.thankYouTitle));
      if (lf.thankYouBody) setThankYouBody(String(lf.thankYouBody));
    }
    // Prompt visuel proposé par l'IA → mémorisé + génération auto multi-formats
    // (carré pour le fil + 9:16 pour stories/reels) si aucun visuel n'est posé.
    if (p.visualPrompt) {
      setVisualPrompt(String(p.visualPrompt));
      const autoFormats = ["1:1", "9:16"];
      setVisualFormats(autoFormats);
      if (!imageUrl.trim() && !videoUrl.trim()) generateVisual(String(p.visualPrompt), autoFormats);
    }
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || assisting) return;
    const next = [...chatMessages, { role: "user" as const, content: text }];
    setChatMessages(next);
    setChatInput("");
    setAssisting(true); setError(null);
    try {
      const r = await fetch("/api/meta/ads/assist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, messages: next, language: lang }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || t("L'assistant a échoué.", "Assistant failed.")); return; }
      setChatMessages((m) => [...m, { role: "assistant", content: d.reply || "" }]);
      if (d.done && d.plan) { applyPlan(d.plan); setPlanReady(true); }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("L'assistant a échoué.", "Assistant failed."));
    } finally { setAssisting(false); }
  }

  async function searchInterests() {
    if (interestQuery.trim().length < 2) return;
    setSearchingInt(true);
    try {
      const r = await fetch(`/api/meta/ad-interests?companyId=${encodeURIComponent(companyId)}&q=${encodeURIComponent(interestQuery.trim())}&locale=${lang}`);
      const d = await r.json();
      setInterestResults(Array.isArray(d.interests) ? d.interests : []);
    } catch {
      setInterestResults([]);
    } finally { setSearchingInt(false); }
  }
  function toggleInterest(it: { id: string; name: string }) {
    setSelInterests((cur) => cur.some((x) => x.id === it.id) ? cur.filter((x) => x.id !== it.id) : [...cur, { id: it.id, name: it.name }]);
  }
  async function searchExInterests() {
    if (exQuery.trim().length < 2) return;
    setSearchingEx(true);
    try {
      const r = await fetch(`/api/meta/ad-interests?companyId=${encodeURIComponent(companyId)}&q=${encodeURIComponent(exQuery.trim())}&locale=${lang}`);
      const d = await r.json();
      setExResults(Array.isArray(d.interests) ? d.interests : []);
    } catch {
      setExResults([]);
    } finally { setSearchingEx(false); }
  }
  function toggleExInterest(it: { id: string; name: string }) {
    setExInterests((cur) => cur.some((x) => x.id === it.id) ? cur.filter((x) => x.id !== it.id) : [...cur, { id: it.id, name: it.name }]);
  }
  function addExtraImage() {
    const u = newExtraUrl.trim();
    if (u && /^https?:\/\//i.test(u)) { setExtraImages((a) => [...a, u]); setNewExtraUrl(""); }
  }
  // Heure mini = maintenant (on n'autorise pas une diffusion dans le passé) ;
  // l'heure suggérée par défaut est l'heure pleine SUIVANTE.
  const minDateTime = useMemo(() => toLocalDT(new Date()), []);
  useEffect(() => {
    if (!startDate) {
      const next = new Date(Date.now() + 60 * 60 * 1000);
      next.setMinutes(0, 0, 0);
      setStartDate(toLocalDT(next));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Destinations connectées (réelles) pour suggérer l'URL de destination (#4).
  const [destinations, setDestinations] = useState<{ label: string; url: string }[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/connectors?companyId=${encodeURIComponent(companyId)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        if (cancelled || !Array.isArray(list)) return;
        const out: { label: string; url: string }[] = [];
        for (const s of list) {
          for (const a of s.accounts ?? []) {
            if (a.url && /^https?:\/\//i.test(a.url)) out.push({ label: `${s.platform} — ${a.accountName}`, url: a.url });
          }
        }
        setDestinations(out);
      })
      .catch(() => { /* silencieux */ });
    return () => { cancelled = true; };
  }, [companyId]);

  // ── #10 — Sauvegarde automatique du brouillon (par société) ─────────────────
  // On ne perd plus la saisie en quittant la page : restauration au retour.
  const draftKey = `sh_campaign_draft_${companyId}`;
  const [draftRestored, setDraftRestored] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw) as Record<string, unknown>;
      if (typeof d.name === "string") setName(d.name);
      if (d.adType === "lead" || d.adType === "traffic") setAdType(d.adType);
      if (typeof d.objective === "string") setObjective(d.objective);
      if (d.budgetType === "daily" || d.budgetType === "lifetime") setBudgetType(d.budgetType);
      if (Number(d.budget) > 0) setBudget(Number(d.budget));
      if (Number(d.lifetimeBudget) > 0) setLifetimeBudget(Number(d.lifetimeBudget));
      if (typeof d.startDate === "string") setStartDate(d.startDate);
      if (typeof d.endDate === "string") setEndDate(d.endDate);
      if (typeof d.primaryText === "string") setPrimaryText(d.primaryText);
      if (typeof d.headline === "string") setHeadline(d.headline);
      if (typeof d.link === "string") setLink(d.link);
      if (typeof d.cta === "string") setCta(d.cta);
      if (typeof d.visualPrompt === "string") setVisualPrompt(d.visualPrompt);
      if (typeof d.imageUrl === "string") setImageUrl(d.imageUrl);
      if (typeof d.videoUrl === "string") setVideoUrl(d.videoUrl);
      if (Number(d.ageMin)) setAgeMin(Number(d.ageMin));
      if (Number(d.ageMax)) setAgeMax(Number(d.ageMax));
      if (d.gender === "all" || d.gender === "male" || d.gender === "female") setGender(d.gender);
      if (Array.isArray(d.selInterests)) setSelInterests(d.selInterests as { id: string; name: string }[]);
      if (Array.isArray(d.exInterests)) setExInterests(d.exInterests as { id: string; name: string }[]);
      setDraftRestored(true);
    } catch { /* brouillon illisible — ignoré */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({
          name, adType, objective, budgetType, budget, lifetimeBudget, startDate, endDate,
          primaryText, headline, link, cta, visualPrompt, imageUrl, videoUrl, ageMin, ageMax, gender, selInterests, exInterests,
        }));
      } catch { /* quota/indispo — non bloquant */ }
    }, 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, adType, objective, budgetType, budget, lifetimeBudget, startDate, endDate, primaryText, headline, link, cta, visualPrompt, imageUrl, videoUrl, ageMin, ageMax, gender, selInterests, exInterests]);

  function clearDraft() {
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    setDraftRestored(false);
  }

  async function loadAudiences() {
    setLoadingAud(true);
    try {
      const r = await fetch(`/api/meta/audiences?companyId=${encodeURIComponent(companyId)}`);
      const d = await r.json();
      setAudiences(Array.isArray(d.audiences) ? d.audiences : []);
    } catch { setAudiences([]); } finally { setLoadingAud(false); }
  }
  function toggleAudience(a: { id: string; name: string }) {
    setSelAudiences((cur) => cur.some((x) => x.id === a.id) ? cur.filter((x) => x.id !== a.id) : [...cur, { id: a.id, name: a.name }]);
  }
  async function fetchLeads(formId: string) {
    setLoadingLeads(true);
    try {
      const r = await fetch(`/api/meta/leads?companyId=${encodeURIComponent(companyId)}&formId=${encodeURIComponent(formId)}`);
      const d = await r.json();
      setLeads(Array.isArray(d.leads) ? d.leads : []);
    } catch { setLeads([]); } finally { setLoadingLeads(false); }
  }

  // Charge les pixels quand l'objectif devient « Ventes/Conversions ».
  useEffect(() => {
    if (adType !== "traffic" || !isConvObjective || !conn?.connected || pixels.length) return;
    (async () => {
      try {
        const r = await fetch(`/api/meta/pixels?companyId=${encodeURIComponent(companyId)}`);
        const d = await r.json();
        const px = Array.isArray(d.pixels) ? d.pixels : [];
        setPixels(px);
        if (px[0] && !pixelId) setPixelId(px[0].id);
      } catch { /* ignore */ }
    })();
  }, [adType, isConvObjective, conn?.connected, companyId, pixels.length, pixelId]);

  function validate(): string | null {
    if (!name.trim()) return t("Donnez un nom à la campagne.", "Name the campaign.");
    if (!primaryText.trim()) return t("Écrivez le texte principal.", "Write the primary text.");
    if (!imageUrl.trim() && !videoUrl.trim()) return t("Ajoutez un visuel (image ou vidéo).", "Add a visual (image or video).");
    if (adType === "traffic" && isConvObjective && !pixelId) return t("Sélectionnez un pixel pour l'objectif Conversions.", "Select a pixel for the Conversions objective.");
    if (!budget || budget < 1) return t("Indiquez un budget quotidien.", "Enter a daily budget.");
    if (geoLocs.length === 0) return t("Ajoutez au moins une localisation (pays ou ville).", "Add at least one location (country or city).");
    if (adType === "lead") {
      if (!privacyUrl.trim() || !/^https?:\/\//i.test(privacyUrl)) return t("Le formulaire exige une URL de politique de confidentialité valide.", "The form requires a valid privacy policy URL.");
      if (!fldFullName && !fldEmail && !fldPhone) return t("Sélectionnez au moins un champ du formulaire.", "Select at least one form field.");
    } else if (!link.trim() || !/^https?:\/\//i.test(link)) {
      return t("Indiquez une URL de destination valide (https://…).", "Enter a valid destination URL (https://…).");
    }
    return null;
  }

  function leadFieldsArr(): string[] {
    const f: string[] = [];
    if (fldFullName) f.push("FULL_NAME");
    if (fldEmail) f.push("EMAIL");
    if (fldPhone) f.push("PHONE");
    return f;
  }

  async function publish() {
    const v = validate();
    if (v) { setError(v); return; }
    setError(null); setPublishing(true); setResult(null); setLiveMsg(null); setIsLive(false);
    try {
      // Géo : pays (code ISO), villes (clé Meta + rayon), régions (clé Meta).
      const countries = geoLocs.filter((g) => g.type === "country").map((g) => (g.countryCode || g.key).toUpperCase());
      const cities = geoLocs.filter((g) => g.type === "city").map((g) => ({ key: g.key, radius: g.radius ?? 25, distanceUnit: "kilometer" as const }));
      const regions = geoLocs.filter((g) => g.type === "region").map((g) => ({ key: g.key }));
      const leadForm = adType === "lead" ? {
        formName: formName.trim() || `${name} — Formulaire`,
        privacyUrl: privacyUrl.trim(),
        intro: formIntro.trim() || undefined,
        fields: leadFieldsArr(),
        thankYouTitle: thankYouTitle.trim() || undefined,
        thankYouBody: thankYouBody.trim() || undefined,
        locale: "fr_FR",
      } : undefined;
      const igPositions = [posFeed && "stream", posStory && "story", posReels && "reels"].filter(Boolean) as string[];
      const fbPositions = [posFeed && "feed", posStory && "story"].filter(Boolean) as string[];
      const r = await fetch("/api/meta/ads/publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId, name,
          objective: adType === "lead" ? "leads" : objective,
          budgetType,
          dailyBudgetCents: Math.round(budget * 100),
          lifetimeBudgetCents: Math.round(lifetimeBudget * 100),
          startTime: startDate ? new Date(startDate).toISOString() : undefined,
          endTime: endDate ? new Date(endDate).toISOString() : undefined,
          countries: countries.length || cities.length || regions.length ? countries : ["FR"],
          cities: cities.length ? cities : undefined,
          regions: regions.length ? regions : undefined,
          locales: languages.length ? languages.map((l) => l.key) : undefined,
          ageMin, ageMax, gender,
          interests: selInterests.length ? selInterests : undefined,
          placement,
          publisherPlatforms: placement === "manual" ? [plFacebook && "facebook", plInstagram && "instagram"].filter(Boolean) : undefined,
          facebookPositions: placement === "manual" && plFacebook ? fbPositions : undefined,
          instagramPositions: placement === "manual" && plInstagram ? igPositions : undefined,
          imageUrl,
          images: extraImages.length ? extraImages : undefined,
          videoUrl: videoUrl.trim() || undefined,
          videoThumbUrl: videoThumbUrl.trim() || undefined,
          primaryText, headline,
          link: link || (adType === "lead" ? privacyUrl : ""),
          cta: adType === "lead" ? "SIGN_UP" : cta,
          leadForm,
          pixelId: adType === "traffic" && isConvObjective ? pixelId : undefined,
          conversionEvent: adType === "traffic" && isConvObjective ? conversionEvent : undefined,
          customAudiences: selAudiences.length ? selAudiences : undefined,
          excludedInterests: exInterests.length ? exInterests : undefined,
          excludedCustomAudiences: exAudiences.length ? exAudiences.map((a) => ({ id: a.id })) : undefined,
          excludedCountries: exGeoLocs.filter((g) => g.type === "country").map((g) => (g.countryCode || g.key).toUpperCase()),
          excludedCities: exGeoLocs.filter((g) => g.type === "city").map((g) => ({ key: g.key, radius: g.radius ?? 25, distanceUnit: "kilometer" as const })),
          excludedRegions: exGeoLocs.filter((g) => g.type === "region").map((g) => ({ key: g.key })),
          variants: variants.map((v) => ({ primaryText: v })).filter((v) => v.primaryText.trim()),
        }),
      });
      const raw = await r.text();
      let d: PublishResult & { ok?: boolean; error?: string } = {} as PublishResult & { ok?: boolean; error?: string };
      try { d = raw ? JSON.parse(raw) : {}; } catch {
        setError(r.status === 504 ? t("La création a dépassé le temps imparti. Réessayez.", "Creation timed out. Try again.") : t(`Réponse serveur inattendue (${r.status}).`, `Unexpected server response (${r.status}).`));
        return;
      }
      if (!r.ok) { setError(d.error || t("Échec de la création.", "Creation failed.")); return; }
      setResult({ campaignId: d.campaignId, adSetId: d.adSetId, creativeId: d.creativeId, adId: d.adId, adIds: d.adIds, leadFormId: d.leadFormId, status: d.status });
      clearDraft(); // annonce créée → on jette le brouillon
      setLeads(null);
      setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 150);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Échec de la création.", "Creation failed."));
    } finally { setPublishing(false); }
  }

  async function activate() {
    if (!result) return;
    const ok = window.confirm(
      t(
        `Mettre cette publicité EN LIGNE déclenche une dépense réelle (jusqu'à ${budget} €/jour). Confirmer l'activation ?`,
        `Setting this ad LIVE triggers real spend (up to €${budget}/day). Confirm activation?`
      )
    );
    if (!ok) return;
    setActivating(true); setLiveMsg(null);
    try {
      const r = await fetch("/api/meta/ads/activate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, campaignId: result.campaignId, adSetId: result.adSetId, adId: result.adId, live: true }),
      });
      const d = await r.json();
      if (!r.ok) { setLiveMsg(d.error || t("Échec de l'activation.", "Activation failed.")); return; }
      setIsLive(true);
      setLiveMsg(t("Publicité activée — en cours de diffusion sur Meta ✓", "Ad activated — now delivering on Meta ✓"));
    } catch (e) {
      setLiveMsg(e instanceof Error ? e.message : t("Échec de l'activation.", "Activation failed."));
    } finally { setActivating(false); }
  }

  const inputCls = "w-full rounded-lg border border-hair bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400";

  return (
    <div className="mx-auto max-w-4xl animate-fade-in space-y-5">
      <StudioHero
        icon={<IconMegaphone size={24} />}
        title={t("Créer une publicité Meta", "Create a Meta ad")}
        subtitle={t(
          "Une vraie campagne Facebook/Instagram via votre compte connecté, créée EN PAUSE (aucune dépense) — vous l'activez ensuite explicitement.",
          "A real Facebook/Instagram campaign through your connected account, created PAUSED (no spend) — you then activate it explicitly."
        )}
        actions={<Link href="/campaigns" className="btn-secondary text-sm">{t("← Campagnes", "← Campaigns")}</Link>}
      />

      {/* #10 — Brouillon restauré : la saisie a été conservée automatiquement. */}
      {draftRestored && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary-50 px-3 py-2 text-xs text-primary-700 ring-1 ring-primary-200">
          <span>{t("✓ Brouillon restauré — votre saisie a été sauvegardée automatiquement.", "✓ Draft restored — your progress was saved automatically.")}</span>
          <button type="button" onClick={clearDraft} className="font-semibold underline hover:no-underline">{t("Effacer le brouillon", "Discard draft")}</button>
        </div>
      )}

      {/* État de connexion Meta */}
      {loadingConn ? (
        <div className="card mb-5 flex items-center gap-2 p-4 text-sm text-muted">
          <Spinner size={16} className="text-primary-600" /> {t("Vérification de la connexion Meta…", "Checking Meta connection…")}
        </div>
      ) : !conn?.connected ? (
        <div className="card mb-5 p-5">
          <p className="text-sm font-semibold text-ink">{t("Compte publicitaire Meta requis", "Meta ad account required")}</p>
          <p className="mt-1 text-sm text-muted">
            {conn?.needsReconnect
              ? t("Reconnectez Meta pour publier des publicités.", "Reconnect Meta to publish ads.")
              : t("Connectez Meta et sélectionnez un compte publicitaire + une Page Facebook.", "Connect Meta and select an ad account + a Facebook Page.")}
          </p>
          <Link href="/pages-meta" className="btn-primary mt-3 inline-flex text-sm">{t("Gérer la connexion Meta", "Manage Meta connection")}</Link>
        </div>
      ) : (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-success-100 bg-success-50 px-4 py-2.5 text-xs text-success-700">
          <span className="rounded-full bg-success-100 px-2 py-0.5 font-bold uppercase">{t("Connecté", "Connected")}</span>
          {t("Compte :", "Account:")} {conn.accountName || "—"} {conn.currency ? `· ${conn.currency}` : ""}
        </div>
      )}

      {/* Choix de l'expérience : assistant IA OU réglages avancés (les deux complets) */}
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { id: "assist", label: t("✨ Assistant IA", "✨ AI assistant") },
          { id: "manual", label: t("⚙️ Réglages avancés", "⚙️ Advanced settings") },
        ]}
      />

      {/* Assistant IA conversationnel : on discute, l'IA remplit tout */}
      <AdAssistantPanel
        active={mode === "assist"}
        messages={chatMessages}
        assisting={assisting}
        planReady={planReady}
        publishing={publishing}
        genImg={genImg}
        canEdit={canEdit}
        connected={!!conn?.connected}
        input={chatInput}
        onInputChange={setChatInput}
        onSend={sendChat}
        onPublish={publish}
        onSwitchToManual={() => setMode("manual")}
      />

      <fieldset disabled={!conn?.connected || publishing || !canEdit} className={`stagger-in space-y-5 disabled:opacity-60 ${mode === "manual" ? "" : "hidden"}`}>
        {/* Type de publicité */}
        <section className="studio-card p-5 space-y-3">
          <span className="section-label">{t("Type de publicité", "Ad type")}</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {([
              { id: "traffic", fr: "Trafic vers le site", en: "Website traffic", desc: t("Envoie vers une page (site, prise de RDV…).", "Sends to a page (site, booking…).") },
              { id: "lead", fr: "Formulaire de prospects", en: "Lead form", desc: t("Formulaire instantané rempli dans Facebook/Instagram.", "Instant form filled inside Facebook/Instagram.") },
            ] as const).map((o) => (
              <button key={o.id} type="button" onClick={() => setAdType(o.id)}
                className={`rounded-xl border p-3 text-left transition-all ${adType === o.id ? "border-primary-400 bg-primary-50 ring-2 ring-primary-200" : "border-hair hover:border-primary-200"}`}>
                <span className="block text-sm font-semibold text-ink">{t(o.fr, o.en)}</span>
                <span className="mt-0.5 block text-2xs text-muted">{o.desc}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Réglages campagne */}
        <section className="studio-card p-5 space-y-4">
          <span className="section-label">{t("Campagne", "Campaign")}</span>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">{t("Nom de la campagne", "Campaign name")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("ex. Programme Détox — Prospects", "e.g. Detox Program — Leads")} className={inputCls} />
          </div>
          {adType === "traffic" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">{t("Objectif", "Objective")}</label>
              <div className="flex flex-wrap gap-1.5">
                {OBJECTIVES.filter((o) => o.id !== "leads").map((o) => (
                  <button key={o.id} type="button" onClick={() => setObjective(o.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${objective === o.id ? "bg-page text-white" : "bg-canvas text-muted ring-1 ring-hair hover:text-ink"}`}>
                    {t(o.fr, o.en)}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-2xs text-muted">{t("Notoriété → portée ; Engagement → interactions ; Ventes/Conversions → optimisé pixel ; sinon trafic.", "Awareness → reach; Engagement → interactions; Sales/Conversions → pixel-optimized; otherwise traffic.")}</p>
            </div>
          )}
          {adType === "traffic" && isConvObjective && (
            <div className="rounded-lg border border-hair bg-canvas p-3">
              <span className="text-xs font-semibold text-ink">{t("Conversions (pixel)", "Conversions (pixel)")}</span>
              {pixels.length === 0 ? (
                <p className="mt-1 text-2xs text-muted">{t("Aucun pixel détecté sur le compte. Sans pixel, l'objectif retombe sur du trafic optimisé.", "No pixel found on the account. Without a pixel, the objective falls back to optimized traffic.")}</p>
              ) : (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <select value={pixelId} onChange={(e) => setPixelId(e.target.value)} className={inputCls}>
                    {pixels.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select value={conversionEvent} onChange={(e) => setConversionEvent(e.target.value)} className={inputCls}>
                    {["LEAD", "PURCHASE", "COMPLETE_REGISTRATION", "CONTACT", "ADD_TO_CART", "SCHEDULE"].map((ev) => <option key={ev} value={ev}>{ev}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
          {/* Budget : quotidien ou à vie */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">{t("Budget", "Budget")}</label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-hair bg-canvas p-0.5">
                {(["daily", "lifetime"] as const).map((b) => (
                  <button key={b} type="button" onClick={() => setBudgetType(b)}
                    className={`rounded-md px-2.5 py-1 text-2xs font-semibold ${budgetType === b ? "bg-page text-white" : "text-muted hover:text-ink"}`}>
                    {b === "daily" ? t("Quotidien", "Daily") : t("À vie", "Lifetime")}
                  </button>
                ))}
              </div>
              {budgetType === "daily" ? (
                <div className="flex items-center gap-1"><span className="text-2xs text-muted">EUR</span><input type="number" min={1} value={budget} onChange={(e) => setBudget(Number(e.target.value))} className={`${inputCls} w-28`} /><span className="text-2xs text-muted">/ {t("jour", "day")}</span></div>
              ) : (
                <div className="flex items-center gap-1"><span className="text-2xs text-muted">EUR</span><input type="number" min={1} value={lifetimeBudget} onChange={(e) => setLifetimeBudget(Number(e.target.value))} className={`${inputCls} w-28`} /><span className="text-2xs text-muted">{t("au total", "total")}</span></div>
              )}
            </div>
          </div>

          {/* Calendrier */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">{t("Début (heure pleine suivante par défaut)", "Start (defaults to the next full hour)")}</label>
              <input type="datetime-local" min={minDateTime} value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">{budgetType === "lifetime" ? t("Fin (obligatoire)", "End (required)") : t("Fin (optionnel)", "End (optional)")}</label>
              <input type="datetime-local" min={startDate || minDateTime} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Localisations — autocomplétion Meta (pays + villes + régions) */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">{t("Localisations (pays, villes, régions)", "Locations (countries, cities, regions)")}</label>
            <MetaGeoPicker companyId={companyId} value={geoLocs} onChange={setGeoLocs} disabled={!conn?.connected} />
            <p className="mt-1 text-2xs text-muted">{t("Recherchez comme dans Meta. Les villes ont un rayon ajustable.", "Search like in Meta. Cities have an adjustable radius.")}</p>
          </div>

          {/* Langues (optionnel) — autocomplétion Meta */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">{t("Langues (optionnel)", "Languages (optional)")}</label>
            <MetaLanguagePicker companyId={companyId} value={languages} onChange={setLanguages} disabled={!conn?.connected} />
            <p className="mt-1 text-2xs text-muted">{t("Laissez vide pour toutes les langues, ou restreignez le ciblage.", "Leave empty for all languages, or restrict targeting.")}</p>
          </div>

          {/* Ciblage de base */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">{t("Genre", "Gender")}</label>
              <select value={gender} onChange={(e) => setGender(e.target.value as typeof gender)} className={inputCls}>
                <option value="all">{t("Tous", "All")}</option>
                <option value="female">{t("Femmes", "Women")}</option>
                <option value="male">{t("Hommes", "Men")}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">{t("Âge min", "Min age")}</label>
              <input type="number" min={13} max={65} value={ageMin} onChange={(e) => setAgeMin(Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">{t("Âge max", "Max age")}</label>
              <input type="number" min={13} max={65} value={ageMax} onChange={(e) => setAgeMax(Number(e.target.value))} className={inputCls} />
            </div>
          </div>
        </section>

        {/* Audience — centres d'intérêt */}
        <section className="studio-card p-5 space-y-3">
          <span className="section-label">{t("Audience — centres d'intérêt", "Audience — interests")}</span>
          <div className="flex gap-2">
            <input
              value={interestQuery}
              onChange={(e) => setInterestQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchInterests(); } }}
              placeholder={t("ex. nutrition, perte de poids, bien-être…", "e.g. nutrition, weight loss, wellness…")}
              className={inputCls}
            />
            <button type="button" onClick={searchInterests} disabled={searchingInt} className="btn-secondary inline-flex shrink-0 items-center gap-1.5 text-xs disabled:opacity-50">
              {searchingInt && <Spinner size={14} className="text-current" />}
              {t("Rechercher", "Search")}
            </button>
          </div>
          {interestResults.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {interestResults.map((it) => {
                const on = selInterests.some((x) => x.id === it.id);
                return (
                  <button key={it.id} type="button" onClick={() => toggleInterest(it)}
                    className={`rounded-full px-3 py-1 text-2xs font-medium ${on ? "bg-page text-white" : "bg-canvas text-muted ring-1 ring-hair hover:text-ink"}`}>
                    {it.name}{it.audienceSize ? ` · ${(it.audienceSize / 1e6).toFixed(1)}M` : ""}
                  </button>
                );
              })}
            </div>
          )}
          {selInterests.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-2xs text-muted">{t("Sélectionnés :", "Selected:")}</span>
              {selInterests.map((it) => (
                <button key={it.id} type="button" onClick={() => toggleInterest(it)} className="rounded-full bg-primary-50 px-2.5 py-1 text-2xs font-semibold text-primary-700 ring-1 ring-primary-200">
                  {it.name} ✕
                </button>
              ))}
            </div>
          )}
          <p className="text-2xs text-muted">{t("Laissez vide pour une audience large (recommandé au début, l'IA de Meta optimise).", "Leave empty for a broad audience (recommended at first — Meta's AI optimizes).")}</p>

          {/* Audiences personnalisées / similaires */}
          <div className="border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink">{t("Audiences personnalisées / similaires", "Custom / lookalike audiences")}</span>
              <button type="button" onClick={loadAudiences} disabled={loadingAud} className="btn-secondary inline-flex items-center gap-1.5 text-2xs disabled:opacity-50">
                {loadingAud && <Spinner size={12} className="text-current" />}
                {audiences.length ? t("Recharger", "Reload") : t("Charger", "Load")}
              </button>
            </div>
            {audiences.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {audiences.map((a) => {
                  const on = selAudiences.some((x) => x.id === a.id);
                  return (
                    <button key={a.id} type="button" onClick={() => toggleAudience(a)}
                      className={`rounded-full px-3 py-1 text-2xs font-medium ${on ? "bg-page text-white" : "bg-canvas text-muted ring-1 ring-hair hover:text-ink"}`}
                      title={a.subtype}>
                      {a.name}{a.size ? ` · ${(a.size / 1000).toFixed(0)}k` : ""}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Exclusions de ciblage (qui NE PAS toucher) */}
        <section className="studio-card p-5 space-y-3">
          <span className="section-label">{t("Exclusions (qui ne pas cibler)", "Exclusions (who not to target)")}</span>

          {/* Lieux exclus */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">{t("Lieux exclus", "Excluded locations")}</label>
            <MetaGeoPicker companyId={companyId} value={exGeoLocs} onChange={setExGeoLocs} disabled={!conn?.connected} />
          </div>

          {/* Intérêts exclus — recherche DÉDIÉE (#6) */}
          <div className="border-t pt-3">
            <span className="text-xs font-semibold text-ink">{t("Centres d'intérêt exclus", "Excluded interests")}</span>
            <div className="mt-1.5 flex gap-2">
              <input
                value={exQuery}
                onChange={(e) => setExQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchExInterests(); } }}
                placeholder={t("Rechercher un intérêt à exclure…", "Search an interest to exclude…")}
                className={inputCls}
              />
              <button type="button" onClick={searchExInterests} disabled={searchingEx} className="btn-secondary inline-flex shrink-0 items-center gap-1.5 text-xs disabled:opacity-50">
                {searchingEx && <Spinner size={14} className="text-current" />}
                {t("Rechercher", "Search")}
              </button>
            </div>
            {exResults.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {exResults.map((it) => {
                  const on = exInterests.some((x) => x.id === it.id);
                  return (
                    <button key={`ex-${it.id}`} type="button" onClick={() => toggleExInterest(it)}
                      className={`rounded-full px-3 py-1 text-2xs font-medium ${on ? "bg-danger-500 text-white" : "bg-canvas text-muted ring-1 ring-hair hover:text-ink"}`}>
                      {on ? "− " : ""}{it.name}
                    </button>
                  );
                })}
              </div>
            )}
            {exInterests.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-2xs text-muted">{t("Exclus :", "Excluded:")}</span>
                {exInterests.map((it) => (
                  <button key={it.id} type="button" onClick={() => setExInterests((cur) => cur.filter((x) => x.id !== it.id))}
                    className="rounded-full bg-danger-50 px-2.5 py-1 text-2xs font-semibold text-danger-700 ring-1 ring-danger-200">{it.name} ✕</button>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-2xs text-muted">{t("Recherchez un intérêt ci-dessus, puis cliquez un résultat pour l'exclure.", "Search an interest above, then click a result to exclude it.")}</p>
            )}
          </div>

          {/* Audiences exclues — réutilise la liste chargée ci-dessus */}
          {audiences.length > 0 && (
            <div className="border-t pt-3">
              <span className="text-xs font-semibold text-ink">{t("Audiences exclues", "Excluded audiences")}</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {audiences.map((a) => {
                  const on = exAudiences.some((x) => x.id === a.id);
                  return (
                    <button key={`exa-${a.id}`} type="button"
                      onClick={() => setExAudiences((cur) => cur.some((x) => x.id === a.id) ? cur.filter((x) => x.id !== a.id) : [...cur, { id: a.id, name: a.name }])}
                      className={`rounded-full px-3 py-1 text-2xs font-medium ${on ? "bg-danger-500 text-white" : "bg-canvas text-muted ring-1 ring-hair hover:text-ink"}`}>
                      {on ? "− " : ""}{a.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Placements */}
        <section className="studio-card p-5 space-y-3">
          <span className="section-label">{t("Placements", "Placements")}</span>
          <div className="inline-flex rounded-lg border border-hair bg-canvas p-0.5">
            {(["auto", "manual"] as const).map((p) => (
              <button key={p} type="button" onClick={() => setPlacement(p)}
                className={`rounded-md px-2.5 py-1 text-2xs font-semibold ${placement === p ? "bg-page text-white" : "text-muted hover:text-ink"}`}>
                {p === "auto" ? t("Automatiques (Advantage+)", "Automatic (Advantage+)") : t("Manuels", "Manual")}
              </button>
            ))}
          </div>
          {placement === "manual" && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-1.5 text-sm text-ink"><input type="checkbox" checked={plFacebook} onChange={(e) => setPlFacebook(e.target.checked)} className="h-4 w-4 accent-primary-600" />Facebook</label>
                <label className="inline-flex items-center gap-1.5 text-sm text-ink"><input type="checkbox" checked={plInstagram} onChange={(e) => setPlInstagram(e.target.checked)} className="h-4 w-4 accent-primary-600" />Instagram</label>
              </div>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" checked={posFeed} onChange={(e) => setPosFeed(e.target.checked)} className="h-4 w-4 accent-primary-600" />{t("Fil", "Feed")}</label>
                <label className="inline-flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" checked={posStory} onChange={(e) => setPosStory(e.target.checked)} className="h-4 w-4 accent-primary-600" />Stories</label>
                <label className="inline-flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" checked={posReels} onChange={(e) => setPosReels(e.target.checked)} className="h-4 w-4 accent-primary-600" />Reels</label>
              </div>
            </div>
          )}
        </section>

        {/* Créative */}
        <section className="studio-card p-5 space-y-4">
          <span className="section-label">{t("Visuel & message", "Creative & copy")}</span>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">{t("Texte principal", "Primary text")}</label>
            <textarea value={primaryText} onChange={(e) => setPrimaryText(e.target.value)} rows={6} placeholder={t("Le message qui accompagne la publicité…", "The message shown with the ad…")} className={`${inputCls} resize-y min-h-[8rem]`} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">{t("Titre (accroche)", "Headline")}</label>
              <input value={headline} onChange={(e) => setHeadline(e.target.value)} className={inputCls} />
            </div>
            {adType === "traffic" ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{t("Bouton (CTA)", "Button (CTA)")}</label>
                <select value={cta} onChange={(e) => setCta(e.target.value)} className={inputCls}>
                  {CTAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{t("Bouton (CTA)", "Button (CTA)")}</label>
                <input value="SIGN_UP" disabled className={`${inputCls} opacity-60`} />
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              {adType === "lead" ? t("Lien (optionnel — sinon l'URL de confidentialité)", "Link (optional — falls back to privacy URL)") : t("URL de destination", "Destination URL")}
            </label>
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" list="connected-destinations" className={inputCls} />
            {destinations.length > 0 && (
              <>
                <datalist id="connected-destinations">
                  {destinations.map((d) => <option key={d.url} value={d.url}>{d.label}</option>)}
                </datalist>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className="text-2xs text-muted">{t("Destinations connectées :", "Connected destinations:")}</span>
                  {destinations.map((d) => (
                    <button key={d.url} type="button" onClick={() => setLink(d.url)}
                      className={`rounded-full px-2.5 py-0.5 text-2xs font-medium ${link === d.url ? "bg-page text-white" : "bg-canvas text-muted ring-1 ring-hair hover:text-ink"}`}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">{t("Prompt du visuel (IA)", "Visual prompt (AI)")}</label>
            <textarea
              value={visualPrompt}
              onChange={(e) => setVisualPrompt(e.target.value)}
              rows={2}
              placeholder={t("Décrivez l'image souhaitée (style, sujet, ambiance)…", "Describe the image you want (style, subject, mood)…")}
              className={inputCls}
            />
            {/* Formats à générer */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-2xs text-muted">{t("Formats :", "Formats:")}</span>
              {VISUAL_FORMATS.map((f) => (
                <button key={f.id} type="button" onClick={() => toggleFormat(f.id)}
                  className={`rounded-full px-2.5 py-1 text-2xs font-medium ${visualFormats.includes(f.id) ? "bg-page text-white" : "bg-canvas text-muted ring-1 ring-hair hover:text-ink"}`}>
                  {t(f.fr, f.en)} · {f.id}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => generateVisual()} disabled={genImg} className="btn-secondary inline-flex items-center gap-1.5 text-xs disabled:opacity-50">
                {genImg && <Spinner size={14} className="text-current" />}
                {genImg ? t("Génération…", "Generating…") : t("✨ Générer le(s) visuel(s)", "✨ Generate visual(s)")}
              </button>
              <button type="button" onClick={() => (libOpen ? setLibOpen(false) : loadLibrary())} className="btn-secondary inline-flex items-center gap-1.5 text-xs">
                {libLoading && <Spinner size={14} className="text-current" />}
                {t("📚 Bibliothèque", "📚 Library")}
              </button>
              <button type="button" onClick={() => generateVisual(undefined, undefined, imageUrl)} disabled={genImg || !imageUrl}
                className="btn-secondary inline-flex items-center gap-1.5 text-xs disabled:opacity-50"
                title={t("Repart du visuel sélectionné et applique le prompt (déclinaison)", "Starts from the selected visual and applies the prompt (variation)")}>
                {t("⤳ Décliner depuis ce visuel", "⤳ Derive from this visual")}
              </button>
            </div>

            {/* Logo de marque incrusté sur le visuel de l'annonce */}
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-hair bg-canvas px-3 py-2">
              <span className="text-2xs font-medium text-muted">🏷️ {t("Logo de marque", "Brand logo")}</span>
              {brandLogoUrl ? (
                <>
                  <span className="text-2xs text-muted">{t("Coin :", "Corner:")}</span>
                  <div className="flex gap-1">
                    {([["tl", "↖"], ["tr", "↗"], ["bl", "↙"], ["br", "↘"]] as const).map(([k, ic]) => (
                      <button key={k} type="button" onClick={() => setLogoCorner(k)}
                        className={`h-6 w-6 rounded text-xs ${logoCorner === k ? "bg-page text-white" : "bg-card text-muted ring-1 ring-hair hover:text-ink"}`}>{ic}</button>
                    ))}
                  </div>
                  <button type="button" onClick={applyLogoToVisual} disabled={applyingLogo || !imageUrl}
                    className="btn-secondary inline-flex items-center gap-1.5 text-xs disabled:opacity-50"
                    title={!imageUrl ? t("Choisissez d'abord un visuel", "Pick a visual first") : undefined}>
                    {applyingLogo && <Spinner size={14} className="text-current" />}
                    {applyingLogo ? t("Incrustation…", "Applying…") : t("Incruster le logo", "Burn in the logo")}
                  </button>
                </>
              ) : (
                <span className="text-2xs text-muted">{t("Aucun logo — importez-le dans le brand kit (studio).", "No logo — upload it in the brand kit (studio).")}</span>
              )}
            </div>

            {/* Bibliothèque média : visuels/vidéos déjà créés, réutilisables */}
            {libOpen && (
              <div className="mt-3 rounded-lg border border-hair bg-canvas p-3">
                {libLoading ? (
                  <p className="text-2xs text-muted">{t("Chargement…", "Loading…")}</p>
                ) : libAssets.length === 0 ? (
                  <p className="text-2xs text-muted">{t("Bibliothèque vide. Les visuels générés ici (et le logo de marque) y apparaîtront.", "Empty library. Visuals generated here (and the brand logo) will appear here.")}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {libAssets.map((a, i) => (
                      <button key={i} type="button"
                        onClick={() => { if (a.type === "video") setVideoUrl(a.url); else setImageUrl(a.url); }}
                        className="relative overflow-hidden rounded-lg border border-hair hover:border-primary-400" title={a.source}>
                        {a.type === "video"
                          // eslint-disable-next-line jsx-a11y/media-has-caption
                          ? <video src={a.url} className="h-24 w-24 object-cover" />
                          // eslint-disable-next-line @next/next/no-img-element
                          : <img src={a.url} alt="" className="h-24 w-24 object-cover" />}
                        <span className="absolute bottom-0 left-0 right-0 bg-black/55 px-1 py-0.5 text-center text-[10px] text-white">{a.type === "video" ? "▶ vidéo" : (a.format || t("image", "image"))}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {genImg && <BusyHint className="mt-2" label={t("Génération des visuels…", "Generating visuals…")} eta={t("~20–60 s / format", "~20–60 s / format")} />}

            {/* Visuels générés — clic pour choisir le visuel principal de l'annonce */}
            {generatedVisuals.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {generatedVisuals.map((g) => {
                  const on = imageUrl === g.url;
                  return (
                    <button key={g.format} type="button" onClick={() => setImageUrl(g.url)}
                      className={`relative overflow-hidden rounded-lg border-2 ${on ? "border-primary-500 ring-2 ring-primary-200" : "border-hair hover:border-primary-300"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={g.url} alt={g.format} className="h-28 w-28 object-cover" />
                      <span className="absolute bottom-0 left-0 right-0 bg-black/55 px-1 py-0.5 text-center text-[10px] text-white">{g.format}{on ? " ✓" : ""}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <label className="mt-3 mb-1 block text-2xs font-medium text-muted">{t("…ou coller une URL d'image publique", "…or paste a public image URL")}</label>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…/image.jpg" className={inputCls} />
            {/* Grand aperçu du visuel SÉLECTIONNÉ — assez grand pour être analysé, cliquable pour l'ouvrir en taille réelle. */}
            {imageUrl && (
              <div className="mt-3">
                <a href={imageUrl} target="_blank" rel="noopener noreferrer" title={t("Ouvrir en taille réelle", "Open full size")} className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt={t("Aperçu du visuel sélectionné", "Selected visual preview")} className="max-h-[28rem] w-full rounded-lg border border-hair bg-canvas object-contain" />
                </a>
                <p className="mt-1 text-2xs text-muted">{t("🔍 Cliquez l'image pour l'ouvrir en taille réelle.", "🔍 Click the image to open it full size.")}</p>
              </div>
            )}
            <p className="mt-1 text-2xs text-muted">{t("Le visuel sélectionné (✓) est celui de l'annonce. Générez plusieurs formats pour couvrir fil, portrait et stories.", "The selected (✓) visual is used for the ad. Generate several formats to cover feed, portrait and stories.")}</p>
          </div>

          {/* Carrousel : visuels supplémentaires (mode trafic uniquement) */}
          {adType === "traffic" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">{t("Visuels supplémentaires → carrousel (optionnel)", "Extra visuals → carousel (optional)")}</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input value={newExtraUrl} onChange={(e) => setNewExtraUrl(e.target.value)} placeholder="https://…/image2.jpg" className={inputCls} />
                <button type="button" onClick={addExtraImage} className="btn-secondary shrink-0 text-xs">{t("Ajouter", "Add")}</button>
              </div>
              {extraImages.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {extraImages.map((u, i) => (
                    <div key={i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt={`carrousel ${i + 1}`} className="h-20 w-20 rounded-lg border border-hair object-cover" />
                      <button type="button" onClick={() => setExtraImages((a) => a.filter((_, j) => j !== i))}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-danger-500 text-[10px] font-bold text-white">✕</button>
                    </div>
                  ))}
                </div>
              )}
              {extraImages.length > 0 && <p className="mt-1 text-2xs text-muted">{t(`Carrousel de ${extraImages.length + 1} cartes.`, `Carousel of ${extraImages.length + 1} cards.`)}</p>}
            </div>
          )}

          {/* Vidéo (prioritaire sur l'image si renseignée) */}
          {adType === "traffic" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{t("Vidéo (URL publique .mp4, optionnel)", "Video (public .mp4 URL, optional)")}</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://…/video.mp4" className={inputCls} />
                  <button type="button" onClick={generateVideo} disabled={genVid} className="btn-secondary inline-flex shrink-0 items-center gap-1.5 text-xs disabled:opacity-50">
                    {genVid && <Spinner size={14} className="text-current" />}
                    {genVid ? t("Génération…", "Generating…") : t("🎬 Générer (IA)", "🎬 Generate (AI)")}
                  </button>
                </div>
                {genVid && <BusyHint className="mt-2" label={`${t("Génération de la vidéo…", "Generating video…")} ${vidStatus}`} eta={t("~2–5 min", "~2–5 min")} />}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{t("Miniature vidéo (optionnel)", "Video thumbnail (optional)")}</label>
                <input value={videoThumbUrl} onChange={(e) => setVideoThumbUrl(e.target.value)} placeholder="https://…/thumb.jpg" className={inputCls} />
              </div>
              {videoUrl && (
                <div className="sm:col-span-2">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video src={videoUrl} controls className="max-h-56 w-auto rounded-lg border border-hair" />
                  <p className="text-2xs text-muted">{t("Une vidéo remplace l'image/carrousel pour cette annonce.", "A video replaces the image/carousel for this ad.")}</p>
                </div>
              )}
            </div>
          )}

          {/* Variantes A/B (textes additionnels → annonces supplémentaires) */}
          {adType === "traffic" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">{t("Variantes A/B (textes alternatifs, optionnel)", "A/B variants (alternative texts, optional)")}</label>
              {variants.map((v, i) => (
                <div key={i} className="mb-2 flex gap-2">
                  <input value={v} onChange={(e) => setVariants((a) => a.map((x, j) => (j === i ? e.target.value : x)))} placeholder={t(`Variante ${i + 2}`, `Variant ${i + 2}`)} className={inputCls} />
                  <button type="button" onClick={() => setVariants((a) => a.filter((_, j) => j !== i))} className="btn-secondary shrink-0 text-xs">✕</button>
                </div>
              ))}
              {variants.length < 4 && (
                <button type="button" onClick={() => setVariants((a) => [...a, ""])} className="btn-secondary text-xs">{t("+ Ajouter une variante", "+ Add a variant")}</button>
              )}
              <p className="mt-1 text-2xs text-muted">{t("Chaque variante crée une annonce supplémentaire dans le même ad set (test créatif).", "Each variant creates an extra ad in the same ad set (creative test).")}</p>
            </div>
          )}
        </section>

        {/* Formulaire de prospects (Instant Form) */}
        {adType === "lead" && (
          <section className="studio-card p-5 space-y-4">
            <span className="section-label">{t("Formulaire de prospects", "Lead form")}</span>
            <p className="text-2xs text-muted">{t("Le prospect remplit ces champs directement dans Facebook/Instagram, sans quitter l'app.", "The prospect fills these fields directly in Facebook/Instagram, without leaving the app.")}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{t("Nom du formulaire", "Form name")}</label>
                <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder={t("ex. Prospects — Consultation", "e.g. Leads — Consultation")} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{t("URL politique de confidentialité", "Privacy policy URL")}</label>
                <input value={privacyUrl} onChange={(e) => setPrivacyUrl(e.target.value)} placeholder="https://…/confidentialite" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">{t("Accroche du formulaire", "Form intro")}</label>
              <input value={formIntro} onChange={(e) => setFormIntro(e.target.value)} placeholder={t("ex. Recevez votre bilan personnalisé", "e.g. Get your personalized assessment")} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">{t("Champs demandés", "Requested fields")}</label>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-1.5 text-sm text-ink"><input type="checkbox" checked={fldFullName} onChange={(e) => setFldFullName(e.target.checked)} className="h-4 w-4 accent-primary-600" />{t("Nom complet", "Full name")}</label>
                <label className="inline-flex items-center gap-1.5 text-sm text-ink"><input type="checkbox" checked={fldEmail} onChange={(e) => setFldEmail(e.target.checked)} className="h-4 w-4 accent-primary-600" />{t("E-mail", "Email")}</label>
                <label className="inline-flex items-center gap-1.5 text-sm text-ink"><input type="checkbox" checked={fldPhone} onChange={(e) => setFldPhone(e.target.checked)} className="h-4 w-4 accent-primary-600" />{t("Téléphone", "Phone")}</label>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{t("Remerciement — titre", "Thank-you — title")}</label>
                <input value={thankYouTitle} onChange={(e) => setThankYouTitle(e.target.value)} placeholder={t("Merci !", "Thank you!")} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{t("Remerciement — message", "Thank-you — message")}</label>
                <input value={thankYouBody} onChange={(e) => setThankYouBody(e.target.value)} placeholder={t("Nous vous recontactons vite.", "We'll get back to you soon.")} className={inputCls} />
              </div>
            </div>
          </section>
        )}

        {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}

        <button type="button" onClick={publish} disabled={publishing} className="btn-primary inline-flex w-full items-center justify-center gap-2 disabled:opacity-50">
          {publishing && <Spinner size={16} className="text-white" />}
          {publishing ? t("Création sur Meta…", "Creating on Meta…") : t("Créer la publicité (EN PAUSE) sur Meta", "Create the ad (PAUSED) on Meta")}
        </button>
        {publishing && <BusyHint label={t("Création de la campagne, de l'ad set, de la créative et de l'annonce…", "Creating campaign, ad set, creative and ad…")} eta="~10–20 s" />}
      </fieldset>

      {/* Résultat + activation */}
      {result && (
        <AdResultPanel
          result={result}
          isLive={isLive}
          adAccountId={conn?.adAccountId}
          activating={activating}
          onActivate={activate}
          loadingLeads={loadingLeads}
          onFetchLeads={fetchLeads}
          liveMsg={liveMsg}
          leads={leads}
        />
      )}
    </div>
  );
}
