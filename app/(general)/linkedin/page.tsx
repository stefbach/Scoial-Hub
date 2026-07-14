"use client";

// Espace dédié LinkedIn (même logique que le hub Meta) : accéder au compte
// LinkedIn connecté de la société → publier → analyser la stratégie.

import { useCallback, useEffect, useState } from "react";
import { addDays, format } from "date-fns";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { Spinner, BusyHint } from "@/components/ui/Spinner";
import { DatePicker, TimePicker } from "@/components/ui/DateTimePicker";
import { ArticleStudio } from "@/components/linkedin/ArticleStudio";
import { ConnectGuide } from "@/components/connect/ConnectGuide";

interface Account {
  connected: boolean;
  accountName?: string;
  urn?: string;
  picture?: string;
  isOrganization?: boolean;
}
interface Targets {
  connected: boolean;
  person?: { urn: string; name: string; picture?: string };
  organizations?: { urn: string; name: string }[];
  orgsAvailable?: boolean;
  selected?: string;
}
interface Strategy {
  positioning: string;
  cadence: string;
  angles: string[];
  postIdeas: { title: string; hook: string }[];
  dos: string[];
  donts: string[];
  aiGenerated: boolean;
}

export default function LinkedInPage() {
  const t = useT();
  const { company, access } = useCompany();
  const canEdit = access.canEdit;
  const companyId = company.id;

  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [savingTarget, setSavingTarget] = useState(false);

  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [useMemory, setUseMemory] = useState(false);
  const [writing, setWriting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [pubMsg, setPubMsg] = useState<string | null>(null);

  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [guide, setGuide] = useState(false);
  // Graine « Utiliser cette idée » → préremplit le studio (espace unique).
  const [seed, setSeed] = useState<{ nonce: number; text: string } | undefined>();

  // Planification d'un post unique (onglet Publication)
  const [schedDate, setSchedDate] = useState<Date>(() => addDays(new Date(), 1));
  const [schedTime, setSchedTime] = useState("09:00");
  const [scheduling, setScheduling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Les deux appels sont indépendants → en parallèle (au lieu de séquentiel).
      const [r, tr] = await Promise.all([
        fetch(`/api/linkedin/account?companyId=${encodeURIComponent(companyId)}`),
        fetch(`/api/linkedin/targets?companyId=${encodeURIComponent(companyId)}`),
      ]);
      const acc = r.ok ? await r.json() : { connected: false };
      setAccount(acc);
      if (acc.connected && tr.ok) {
        const tg = (await tr.json()) as Targets;
        setTargets(tg);
        setSelected(tg.selected || tg.person?.urn || "");
      }
    } catch {
      setAccount({ connected: false });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  async function chooseTarget(urn: string, name: string) {
    setSelected(urn);
    setSavingTarget(true);
    try {
      await fetch("/api/linkedin/targets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, urn, name }),
      });
    } finally { setSavingTarget(false); }
  }

  useEffect(() => { load(); }, [load]);

  async function writeWithAI() {
    setWriting(true); setPubMsg(null);
    try {
      const r = await fetch("/api/ai/generate-post", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text || t("Rédige un post LinkedIn professionnel et engageant.", "Write a professional, engaging LinkedIn post."), platform: "linkedin", brandVoice: company.brandVoice ?? "", action: text ? "rewrite" : "generate", companyId, useMemory }),
      });
      const d = await r.json();
      if (d.text) setText(d.text);
      if (d.mock) setPubMsg(t("Démo — IA texte non configurée.", "Demo — text AI not configured."));
    } finally { setWriting(false); }
  }

  async function publish() {
    if (!text.trim()) { setPubMsg(t("Écrivez un texte.", "Write some text.")); return; }
    setPublishing(true); setPubMsg(null);
    try {
      const r = await fetch("/api/linkedin/publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, text, link: link || undefined }),
      });
      const d = await r.json();
      if (d.connected === false) { setPubMsg(t("LinkedIn non connecté — connectez-le d'abord.", "LinkedIn not connected — connect it first.")); return; }
      if (!r.ok) { setPubMsg(d.error ?? t("Échec.", "Failed.")); return; }
      if (d.simulated) setPubMsg(t("Publié en simulation (LinkedIn non configuré).", "Simulated (LinkedIn not configured)."));
      else { setPubMsg(t(`Publié sur LinkedIn ✓`, `Published on LinkedIn ✓`)); setText(""); setLink(""); }
    } catch (e) {
      setPubMsg(e instanceof Error ? e.message : t("Échec de la publication.", "Publish failed."));
    } finally { setPublishing(false); }
  }

  async function schedule() {
    if (!text.trim()) { setPubMsg(t("Écrivez un texte.", "Write some text.")); return; }
    setScheduling(true); setPubMsg(null);
    try {
      const r = await fetch("/api/scheduled-posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          platform: "linkedin",
          title: text.trim().split("\n")[0].slice(0, 80) || "Post LinkedIn",
          body: text,
          date: format(schedDate, "yyyy-MM-dd"),
          time: schedTime,
          status: "scheduled",
          source: "manual",
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setPubMsg(d.error ?? t("Échec de la planification.", "Scheduling failed."));
        return;
      }
      setPubMsg(t(
        `Publication planifiée pour le ${format(schedDate, "yyyy-MM-dd")} à ${schedTime} ✓ — retrouvez-la dans l'onglet Programmation.`,
        `Post scheduled for ${format(schedDate, "yyyy-MM-dd")} at ${schedTime} ✓ — see the Scheduling tab.`
      ));
      setText(""); setLink("");
    } catch (e) {
      setPubMsg(e instanceof Error ? e.message : t("Échec de la planification.", "Scheduling failed."));
    } finally { setScheduling(false); }
  }

  async function analyze() {
    setAnalyzing(true);
    try {
      const r = await fetch("/api/linkedin/strategy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const d = await r.json();
      if (d.strategy) setStrategy(d.strategy);
    } finally { setAnalyzing(false); }
  }

  const inputCls = "w-full rounded-lg border border-hair bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400";
  const connectUrl = `/api/connectors/linkedin/auth?companyId=${encodeURIComponent(companyId)}&return=/linkedin`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="section-label text-primary-500">LinkedIn</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">{t("Votre espace LinkedIn", "Your LinkedIn space")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          {t("Un seul espace « Articles & visuels » : écrivez, publiez ou programmez, gérez la file d'attente et continuez à écrire — tout au même endroit.", "One “Articles & visuals” space: write, publish or schedule, manage the queue and keep writing — all in one place.")}
        </p>
      </header>

      {/* Connexion */}
      {loading ? (
        <div className="card p-6 text-sm text-muted">{t("Chargement…", "Loading…")}</div>
      ) : account?.connected ? (
        <div className="card flex items-center gap-3 p-5">
          {account.picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={account.picture} alt="" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0A66C2] text-lg font-bold text-white">in</span>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{account.accountName}</p>
            <p className="text-2xs text-muted">
              {account.isOrganization ? t("Page entreprise", "Company page") : t("Profil membre", "Member profile")} · {t("connecté", "connected")} ✓
            </p>
          </div>
          <a href={connectUrl} className="btn-secondary ml-auto text-xs">{t("Reconnecter", "Reconnect")}</a>
        </div>
      ) : (
        <div className="card p-6 text-center">
          <p className="text-sm font-semibold text-ink">{t("LinkedIn non connecté", "LinkedIn not connected")}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            {t("Connectez LinkedIn pour publier et analyser votre stratégie.", "Connect LinkedIn to publish and analyze your strategy.")}
          </p>
          <a href={connectUrl} className="btn-primary mt-4 inline-flex">{t("Connecter LinkedIn", "Connect LinkedIn")}</a>
        </div>
      )}

      {/* Espace unique « Articles & visuels » — connexion + cible LinkedIn */}
      <section className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="section-label">{t("Connexion LinkedIn", "LinkedIn connection")}</span>
        </div>

        {/* CONNECT-FIRST : si non connecté, message clair + CTA avant toute saisie */}
        {!loading && !account?.connected && (
          <div className="rounded-xl border border-dashed border-hair bg-canvas px-4 py-3 text-center">
            <p className="text-sm font-semibold text-ink">{t("Connectez LinkedIn pour publier", "Connect LinkedIn to publish")}</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted">
              {t("Reliez votre compte avant d'écrire — vous éviterez de rédiger pour rien.", "Connect your account before writing — so you don't draft for nothing.")}
            </p>
            <button onClick={() => setGuide(true)} className="btn-primary mt-3 inline-flex text-sm">
              {t("Connecter LinkedIn", "Connect LinkedIn")}
            </button>
          </div>
        )}

        {/* Bloc de rédaction — grisé/désactivé tant que LinkedIn n'est pas connecté */}
        <div className={!loading && !account?.connected ? "pointer-events-none select-none opacity-50" : ""} aria-disabled={!account?.connected}>

        {/* Cible : profil ou Page entreprise */}
        {targets?.connected && (
          <div>
            <p className="section-label">{t("Publier en tant que", "Publish as")}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {targets.person && (
                <button
                  type="button"
                  onClick={() => chooseTarget(targets.person!.urn, targets.person!.name)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${selected === targets.person.urn ? "border-primary-400 bg-primary-50 text-primary-700 font-semibold" : "border-hair text-muted hover:bg-canvas"}`}
                >
                  👤 {targets.person.name} <span className="text-2xs opacity-70">{t("(profil)", "(profile)")}</span>
                </button>
              )}
              {(targets.organizations ?? []).map((o) => (
                <button
                  key={o.urn}
                  type="button"
                  onClick={() => chooseTarget(o.urn, o.name)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${selected === o.urn ? "border-primary-400 bg-primary-50 text-primary-700 font-semibold" : "border-hair text-muted hover:bg-canvas"}`}
                >
                  🏢 {o.name} <span className="text-2xs opacity-70">{t("(Page)", "(Page)")}</span>
                </button>
              ))}
              {savingTarget && <span className="self-center text-2xs text-muted">{t("enregistrement…", "saving…")}</span>}
            </div>
            {/* Note « accès organisation LinkedIn » retirée à la demande de
                l'utilisateur (validation Community Management en cours — le
                sélecteur de Pages apparaîtra de lui-même une fois l'accès
                accordé, sans message d'explication). */}
          </div>
        )}

        </div>
        <p className="text-2xs text-muted">{t("La cible choisie s'applique à toutes vos publications & programmations LinkedIn.", "The chosen target applies to all your LinkedIn posts & scheduled posts.")}</p>
      </section>

      {/* Le studio = écrire · publier tout de suite · programmer · file d'attente */}
      <ArticleStudio seed={seed} />

      {/* Stratégie */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="section-label text-ai-text">{t("Stratégie LinkedIn", "LinkedIn strategy")}</div>
            <p className="mt-0.5 text-xs text-muted">{t("L'IA bâtit une stratégie de contenu à partir de votre profil de marque.", "The AI builds a content strategy from your brand profile.")}</p>
          </div>
          <button onClick={analyze} disabled={analyzing} className="btn-primary inline-flex items-center gap-1.5 text-sm disabled:opacity-50">
            {analyzing && <Spinner size={16} className="text-white" />}
            {analyzing ? t("Analyse…", "Analyzing…") : strategy ? t("Ré-analyser", "Re-analyze") : t("Analyser ma stratégie", "Analyze my strategy")}
          </button>
        </div>

        {analyzing && (
          <BusyHint label={t("L'IA construit votre stratégie LinkedIn…", "The AI is building your LinkedIn strategy…")} eta={t("~30–60 s", "~30–60 s")} />
        )}

        {strategy && (
          <div className="space-y-4">
            <div className="card border-l-4 border-ai-text p-5">
              <div className="flex items-center gap-2">
                <span className="section-label text-ai-text">{t("Positionnement", "Positioning")}</span>
                {strategy.aiGenerated && <span className="rounded-full bg-ai-textbg px-2 py-0.5 text-2xs font-semibold text-ai-text">IA</span>}
              </div>
              <p className="mt-2 text-sm text-ink">{strategy.positioning}</p>
              <p className="mt-2 text-xs text-muted"><strong>{t("Cadence", "Cadence")} :</strong> {strategy.cadence}</p>
            </div>

            {strategy.angles.length > 0 && (
              <div className="card p-5">
                <div className="section-label">{t("Piliers éditoriaux", "Content pillars")}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {strategy.angles.map((a) => (
                    <span key={a} className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">{a}</span>
                  ))}
                </div>
              </div>
            )}

            {strategy.postIdeas.length > 0 && (
              <div className="card p-5">
                <div className="section-label">{t("Idées de posts", "Post ideas")}</div>
                <ul className="mt-3 space-y-2.5">
                  {strategy.postIdeas.map((idea, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-2xs font-bold text-primary-700">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-semibold text-ink">{idea.title}</p>
                        <p className="break-words text-xs text-muted">{idea.hook}</p>
                      </div>
                      <button onClick={() => { setSeed({ nonce: Date.now(), text: `${idea.title} — ${idea.hook}` }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="btn-secondary shrink-0 self-start text-2xs">
                        {t("Utiliser", "Use")}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {strategy.dos.length > 0 && (
                <div className="card p-5">
                  <div className="section-label text-success-700">{t("À faire", "Do")}</div>
                  <ul className="mt-2 space-y-1.5">
                    {strategy.dos.map((d, i) => <li key={i} className="flex gap-2 text-sm text-ink"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success-500" />{d}</li>)}
                  </ul>
                </div>
              )}
              {strategy.donts.length > 0 && (
                <div className="card p-5">
                  <div className="section-label text-danger-700">{t("À éviter", "Avoid")}</div>
                  <ul className="mt-2 space-y-1.5">
                    {strategy.donts.map((d, i) => <li key={i} className="flex gap-2 text-sm text-ink"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-danger-500" />{d}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <ConnectGuide
        open={guide}
        onClose={() => setGuide(false)}
        platform="linkedin"
        companyId={companyId}
        returnTo="/linkedin"
      />
    </div>
  );
}
