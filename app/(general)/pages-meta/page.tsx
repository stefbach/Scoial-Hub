"use client";

// ── Mes Pages & données ──────────────────────────────────────────────────────
// Sélecteur de Page Facebook (sociétés multi-Pages) + données réelles de la
// Page sélectionnée et du compte Instagram lié (abonnés, posts, engagement).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";

interface PageItem {
  id: string;
  name: string;
  igUsername: string | null;
  hasInstagram: boolean;
  picture: string | null;
  fanCount: number | null;
}
interface PagesResp {
  pages: PageItem[];
  selectedPageId: string | null;
  needsReconnect: boolean;
}
interface Post {
  id: string;
  message: string;
  url?: string;
  image?: string;
  createdAt?: string;
  likes?: number;
  comments?: number;
}
interface Insights {
  connected: boolean;
  facebook?: { name: string; fanCount: number; followers: number; picture?: string };
  instagram?: { username: string; followers: number; mediaCount: number; picture?: string };
  facebookPosts: Post[];
  instagramPosts: Post[];
}

const nf = (n: number) => n.toLocaleString("fr-FR");

export default function PagesMetaPage() {
  const t = useT();
  const { company } = useCompany();
  const companyId = company.id;

  const [pages, setPages] = useState<PagesResp | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, i] = await Promise.all([
      fetch(`/api/meta/pages?companyId=${encodeURIComponent(companyId)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`/api/meta/insights?companyId=${encodeURIComponent(companyId)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    setPages(p);
    setInsights(i);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function selectPage(pageId: string) {
    setSwitching(pageId);
    try {
      await fetch("/api/meta/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, pageId }),
      });
      await load();
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <header>
        <p className="section-label text-primary-500">{t("Pages & données", "Pages & data")}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
          {t("Vos Pages connectées", "Your connected Pages")}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
          {t(
            "Choisissez la Page Facebook à piloter pour cette société (votre compte en gère plusieurs) et consultez ses données réelles.",
            "Pick the Facebook Page to manage for this company (your account manages several) and view its real data."
          )}
        </p>
      </header>

      {loading ? (
        <div className="card flex items-center justify-center p-12 text-sm text-muted">
          <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-hair border-t-primary" />
          {t("Chargement…", "Loading…")}
        </div>
      ) : pages?.needsReconnect || !pages ? (
        <div className="card p-6 text-center">
          <p className="text-sm font-semibold text-ink">{t("Aucune connexion Meta active", "No active Meta connection")}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            {t(
              "Connectez Facebook/Instagram pour voir vos Pages et leurs données.",
              "Connect Facebook/Instagram to see your Pages and their data."
            )}
          </p>
          <Link href="/demarrage" className="btn-primary mt-4 inline-flex">{t("Connecter mes comptes", "Connect my accounts")}</Link>
        </div>
      ) : (
        <>
          {/* ── Données réelles de la Page sélectionnée ── */}
          {insights?.connected && (insights.facebook || insights.instagram) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {insights.facebook && (
                <StatCard
                  tone="facebook"
                  title={insights.facebook.name}
                  subtitle="Facebook"
                  picture={insights.facebook.picture}
                  stats={[
                    { label: t("Abonnés", "Followers"), value: nf(insights.facebook.followers) },
                    { label: "Fans", value: nf(insights.facebook.fanCount) },
                  ]}
                />
              )}
              {insights.instagram && (
                <StatCard
                  tone="instagram"
                  title={`@${insights.instagram.username}`}
                  subtitle="Instagram"
                  picture={insights.instagram.picture}
                  stats={[
                    { label: t("Abonnés", "Followers"), value: nf(insights.instagram.followers) },
                    { label: t("Publications", "Posts"), value: nf(insights.instagram.mediaCount) },
                  ]}
                />
              )}
            </div>
          )}

          {/* ── Sélecteur de Page ── */}
          <section className="space-y-3">
            <div className="section-label">{t("Choisir la Page de cette société", "Choose this company's Page")}</div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {pages.pages.map((p) => {
                const selected = p.id === pages.selectedPageId;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 rounded-2xl border p-4 transition-all ${
                      selected ? "border-primary-400 bg-primary-50 ring-2 ring-primary-200" : "border-hair bg-card hover:border-primary-200"
                    }`}
                  >
                    {p.picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.picture} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-canvas text-sm font-bold text-muted">
                        {p.name.slice(0, 1)}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                      <p className="truncate text-2xs text-muted">
                        {p.fanCount != null ? `${nf(p.fanCount)} fans` : ""}
                        {p.hasInstagram ? ` · IG @${p.igUsername}` : ` · ${t("pas d'Instagram lié", "no linked Instagram")}`}
                      </p>
                    </div>
                    {selected ? (
                      <span className="shrink-0 rounded-full bg-primary-100 px-2.5 py-1 text-2xs font-bold text-primary-700">
                        {t("Sélectionnée", "Selected")}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => selectPage(p.id)}
                        disabled={switching === p.id}
                        className="btn-secondary shrink-0 text-xs disabled:opacity-50"
                      >
                        {switching === p.id ? "…" : t("Utiliser", "Use")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Posts récents ── */}
          <PostsSection title={t("Publications Facebook récentes", "Recent Facebook posts")} posts={insights?.facebookPosts ?? []} t={t} />
          <PostsSection title={t("Publications Instagram récentes", "Recent Instagram posts")} posts={insights?.instagramPosts ?? []} t={t} />
        </>
      )}
    </div>
  );
}

function StatCard({
  tone,
  title,
  subtitle,
  picture,
  stats,
}: {
  tone: "facebook" | "instagram";
  title: string;
  subtitle: string;
  picture?: string;
  stats: { label: string; value: string }[];
}) {
  const color = tone === "facebook" ? "text-platform-facebook" : "text-platform-instagram";
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        {picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={picture} alt="" className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <span className={`flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-lg font-bold ${color}`}>
            {title.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{title}</p>
          <p className={`text-2xs font-semibold uppercase tracking-wide ${color}`}>{subtitle}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {stats.map((sx) => (
          <div key={sx.label} className="rounded-xl bg-canvas px-3 py-2.5">
            <div className="text-lg font-bold text-ink">{sx.value}</div>
            <div className="text-2xs text-muted">{sx.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PostsSection({ title, posts, t }: { title: string; posts: Post[]; t: (fr: string, en: string) => string }) {
  if (posts.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="section-label">{title}</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <a
            key={p.id}
            href={p.url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="card overflow-hidden transition-shadow hover:shadow-md"
          >
            {p.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image} alt="" className="h-40 w-full object-cover" />
            )}
            <div className="p-3">
              <p className="line-clamp-3 text-xs leading-relaxed text-ink">{p.message || t("(sans texte)", "(no caption)")}</p>
              <div className="mt-2 flex items-center gap-3 text-2xs text-muted">
                {p.createdAt && <span>{new Date(p.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span>}
                {p.likes != null && <span>♥ {nf(p.likes)}</span>}
                {p.comments != null && <span>💬 {nf(p.comments)}</span>}
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
