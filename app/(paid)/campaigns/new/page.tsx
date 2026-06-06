"use client";

// Page (non-modale) de création d'une VRAIE publicité Meta, branchée sur le
// compte publicitaire connecté. Chaîne complète Campagne → Ad set → Créative →
// Ad créée EN PAUSE (aucune dépense), puis activable explicitement (= dépense).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner, BusyHint } from "@/components/ui/Spinner";

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

export default function NewMetaAdPage() {
  const t = useT();
  const { company } = useCompany();
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
  const [countriesStr, setCountriesStr] = useState("FR");
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(65);
  const [imageUrl, setImageUrl] = useState("");
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

  async function generateVisual() {
    const prompt = [headline, primaryText, name].find((s) => s.trim()) || "";
    if (!prompt.trim()) { setError(t("Écrivez d'abord un texte ou un titre pour générer le visuel.", "Write some text or a headline first to generate the visual.")); return; }
    setError(null); setGenImg(true);
    try {
      const r = await fetch("/api/ai/generate-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, platform: "facebook", n: 1 }),
      });
      const raw = await r.text();
      let d: { images?: Array<string | { url?: string }>; error?: string; simulated?: boolean } = {};
      try { d = raw ? JSON.parse(raw) : {}; } catch { setError(t("Réponse inattendue lors de la génération.", "Unexpected response while generating.")); return; }
      if (!r.ok) { setError(d.error || t("Échec de génération d'image.", "Image generation failed.")); return; }
      const urls = (d.images ?? []).map((i) => (typeof i === "string" ? i : i?.url ?? "")).filter(Boolean);
      if (urls[0]) setImageUrl(urls[0]);
      else if (d.simulated) setError(t("Génération d'images non configurée (REPLICATE_API_TOKEN).", "Image generation not configured."));
      else setError(t("Aucune image renvoyée. Réessayez.", "No image returned. Try again."));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Échec de génération d'image.", "Image generation failed."));
    } finally { setGenImg(false); }
  }

  function validate(): string | null {
    if (!name.trim()) return t("Donnez un nom à la campagne.", "Name the campaign.");
    if (!primaryText.trim()) return t("Écrivez le texte principal.", "Write the primary text.");
    if (!imageUrl.trim()) return t("Ajoutez un visuel (URL ou génération IA).", "Add a visual (URL or AI generation).");
    if (!budget || budget < 1) return t("Indiquez un budget quotidien.", "Enter a daily budget.");
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
      const countries = countriesStr.split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
      const leadForm = adType === "lead" ? {
        formName: formName.trim() || `${name} — Formulaire`,
        privacyUrl: privacyUrl.trim(),
        intro: formIntro.trim() || undefined,
        fields: leadFieldsArr(),
        thankYouTitle: thankYouTitle.trim() || undefined,
        thankYouBody: thankYouBody.trim() || undefined,
        locale: "fr_FR",
      } : undefined;
      const r = await fetch("/api/meta/ads/publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId, name,
          objective: adType === "lead" ? "leads" : objective,
          dailyBudgetCents: Math.round(budget * 100),
          countries: countries.length ? countries : ["FR"],
          ageMin, ageMax, imageUrl, primaryText, headline,
          link: link || (adType === "lead" ? privacyUrl : ""),
          cta: adType === "lead" ? "SIGN_UP" : cta,
          leadForm,
        }),
      });
      const raw = await r.text();
      let d: PublishResult & { ok?: boolean; error?: string } = {} as PublishResult & { ok?: boolean; error?: string };
      try { d = raw ? JSON.parse(raw) : {}; } catch {
        setError(r.status === 504 ? t("La création a dépassé le temps imparti. Réessayez.", "Creation timed out. Try again.") : t(`Réponse serveur inattendue (${r.status}).`, `Unexpected server response (${r.status}).`));
        return;
      }
      if (!r.ok) { setError(d.error || t("Échec de la création.", "Creation failed.")); return; }
      setResult({ campaignId: d.campaignId, adSetId: d.adSetId, creativeId: d.creativeId, adId: d.adId, leadFormId: d.leadFormId, status: d.status });
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
    <div className="mx-auto max-w-3xl animate-fade-in">
      <PageHeader
        title={t("Créer une publicité Meta", "Create a Meta ad")}
        actions={<Link href="/campaigns" className="btn-secondary text-sm">{t("← Campagnes", "← Campaigns")}</Link>}
      />
      <p className="mb-5 text-sm text-muted">
        {t(
          "Publie une vraie campagne Facebook/Instagram via votre compte connecté. Elle est créée EN PAUSE (aucune dépense) — vous l'activez ensuite explicitement.",
          "Publishes a real Facebook/Instagram campaign through your connected account. It is created PAUSED (no spend) — you then activate it explicitly."
        )}
      </p>

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

      <fieldset disabled={!conn?.connected || publishing} className="space-y-5 disabled:opacity-60">
        {/* Type de publicité */}
        <section className="card p-5 space-y-3">
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
        <section className="card p-5 space-y-4">
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
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${objective === o.id ? "bg-primary-600 text-white" : "bg-canvas text-muted ring-1 ring-hair hover:text-ink"}`}>
                    {t(o.fr, o.en)}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-2xs text-muted">{t("Notoriété → portée ; Engagement → interactions ; les autres → trafic vers le site.", "Awareness → reach; Engagement → interactions; others → website traffic.")}</p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">{t("Budget / jour (EUR)", "Daily budget (EUR)")}</label>
              <input type="number" min={1} value={budget} onChange={(e) => setBudget(Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">{t("Pays (codes ISO, séparés par des virgules)", "Countries (ISO codes, comma-separated)")}</label>
              <input value={countriesStr} onChange={(e) => setCountriesStr(e.target.value)} placeholder="FR, MU, BE" className={inputCls} />
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

        {/* Créative */}
        <section className="card p-5 space-y-4">
          <span className="section-label">{t("Visuel & message", "Creative & copy")}</span>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">{t("Texte principal", "Primary text")}</label>
            <textarea value={primaryText} onChange={(e) => setPrimaryText(e.target.value)} rows={3} placeholder={t("Le message qui accompagne la publicité…", "The message shown with the ad…")} className={inputCls} />
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
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">{t("Visuel (URL d'image publique)", "Visual (public image URL)")}</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…/image.jpg" className={inputCls} />
              <button type="button" onClick={generateVisual} disabled={genImg} className="btn-secondary inline-flex shrink-0 items-center gap-1.5 text-xs disabled:opacity-50">
                {genImg && <Spinner size={14} className="text-current" />}
                {genImg ? t("Génération…", "Generating…") : t("✨ Générer (IA)", "✨ Generate (AI)")}
              </button>
            </div>
            {genImg && <BusyHint className="mt-2" label={t("Génération du visuel…", "Generating visual…")} eta={t("~20–60 s", "~20–60 s")} />}
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="aperçu" className="mt-3 max-h-56 w-auto rounded-lg border border-hair object-contain" />
            )}
          </div>
        </section>

        {/* Formulaire de prospects (Instant Form) */}
        {adType === "lead" && (
          <section className="card p-5 space-y-4">
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
        <section className="card mt-5 border-l-4 border-success-400 p-5">
          <div className="flex items-center gap-2">
            <span className="section-label text-success-700">{t("Publicité créée sur Meta", "Ad created on Meta")}</span>
            <span className="rounded-full bg-canvas px-2 py-0.5 text-2xs font-semibold text-muted ring-1 ring-hair">{isLive ? "ACTIVE" : "PAUSED"}</span>
          </div>
          <p className="mt-2 text-sm text-ink">
            {t(
              "Elle est en pause sur votre compte Meta — aucune dépense pour l'instant. Vous pouvez l'activer ici ou depuis le Gestionnaire de publicités.",
              "It is paused on your Meta account — no spend yet. You can activate it here or from Ads Manager."
            )}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-2xs text-muted sm:grid-cols-4">
            <span>Campaign: {result.campaignId}</span>
            <span>Ad set: {result.adSetId}</span>
            <span>Creative: {result.creativeId}</span>
            <span>Ad: {result.adId}</span>
            {result.leadFormId && <span>{t("Formulaire", "Form")}: {result.leadFormId}</span>}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button onClick={activate} disabled={activating || isLive} className="btn-primary inline-flex items-center gap-1.5 text-sm disabled:opacity-50">
              {activating && <Spinner size={14} className="text-white" />}
              {isLive ? t("En ligne ✓", "Live ✓") : activating ? t("Activation…", "Activating…") : t("Activer (dépense réelle)", "Activate (real spend)")}
            </button>
            <a
              href={conn?.adAccountId ? `https://business.facebook.com/adsmanager/manage/campaigns?act=${conn.adAccountId}` : "https://www.facebook.com/adsmanager"}
              target="_blank" rel="noreferrer" className="btn-secondary text-sm"
            >
              {t("Ouvrir le Gestionnaire de pubs", "Open Ads Manager")}
            </a>
            <Link href="/ad-performance" className="text-xs text-primary-600 hover:underline">{t("Voir la performance →", "View performance →")}</Link>
          </div>
          {liveMsg && <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-xs text-ink">{liveMsg}</p>}
        </section>
      )}
    </div>
  );
}
