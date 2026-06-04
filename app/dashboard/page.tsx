"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCompany } from "@/lib/company-context";
import { MetricCard } from "@/components/ui/MetricCard";
import { Button } from "@/components/ui/Button";
import { PlatformTag } from "@/components/ui/PlatformTag";
import { eur } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { OnboardingCockpit } from "@/components/onboarding/OnboardingCockpit";

export default function DashboardPage() {
  const { company, data } = useCompany();
  const router = useRouter();
  const t = useT();
  const d = data.dashboard;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Cockpit Démarrage — invite au parcours guidé tant qu'il n'est pas terminé */}
      <OnboardingCockpit />

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">
            {t("Tableau de bord", "Dashboard")}
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            {t("Vue d'ensemble de", "Overview of")}{" "}
            <span className="font-semibold text-ink">{company.name}</span>.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" onClick={() => router.push("/campaigns?new=true")}>
            {t("Nouvelle campagne", "New campaign")}
          </Button>
          <Button variant="primary" onClick={() => router.push("/compose")}>
            {t("Nouveau post", "New post")}
          </Button>
        </div>
      </div>

      {/* Organic metrics */}
      <section>
        <div className="section-label mb-3">{t("Organique", "Organic")}</div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MetricCard label={t("Programmés", "Scheduled")} value={d.organic.scheduled} href="/scheduled" />
          <MetricCard label={t("Publiés (7j)", "Published (7d)")} value={d.organic.published7d} href="/history?tab=published" />
          <MetricCard label={t("En bibliothèque", "In library")} value={d.organic.inLibrary} href="/library" />
          <MetricCard
            label={t("Posts en échec", "Failed posts")}
            value={d.organic.failed}
            alert={d.organic.failed > 0}
            href="/history?tab=failed"
          />
        </div>
      </section>

      {/* Paid Ads metrics */}
      <section>
        <div className="section-label mb-3">{t("Publicités payantes", "Paid Ads")}</div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MetricCard label={t("Campagnes actives", "Active campaigns")} value={d.paid.activeCampaigns} href="/campaigns" />
          <MetricCard
            label={t("Dépenses (MTD)", "Spend (MTD)")}
            value={eur(d.paid.spendMtd)}
            sub={t(`sur ${eur(d.paid.spendCap)} plafond`, `of ${eur(d.paid.spendCap)} cap`)}
            href="/ad-performance"
          />
          <MetricCard label={t("Conversions", "Conversions")} value={d.paid.conversions} href="/ad-performance" />
          <MetricCard
            label={t("Budget IA", "AI budget")}
            value={`${eur(d.paid.aiBudgetUsed).replace("EUR ", "EUR ")}/${d.paid.aiBudgetCap}`}
          />
        </div>
      </section>

      {/* Bottom two-column section */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Upcoming posts */}
        <section className="animate-slide-up">
          <h2 className="mb-3 text-sm font-semibold text-ink">{t("Posts à venir", "Upcoming posts")}</h2>
          <div className="card overflow-hidden">
            {d.upcomingPosts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-2xl shadow-xs">
                  📅
                </span>
                <div>
                  <p className="text-sm font-medium text-ink">{t("Aucun post à venir", "No upcoming posts")}</p>
                  <p className="mt-0.5 text-2xs text-muted">{t("Créez votre premier post pour commencer.", "Create your first post to get started.")}</p>
                </div>
                <Button variant="secondary" onClick={() => router.push("/compose")}>
                  {t("Créer un post", "Create a post")}
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-hair">
                {d.upcomingPosts.map((p, i) => (
                  <Link
                    key={i}
                    href="/scheduled"
                    className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-canvas"
                  >
                    <PlatformTag platform={p.platform} />
                    <span className="flex-1 truncate text-ink">{p.title}</span>
                    <span className="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-2xs text-muted">
                      {p.when}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Top performing ad */}
        <section className="animate-slide-up" style={{ animationDelay: "40ms" }}>
          <h2 className="mb-3 text-sm font-semibold text-ink">{t("Publicité la plus performante", "Top performing ad")}</h2>
          <Link
            href="/ad-performance"
            className="card block cursor-pointer p-4 transition-shadow hover:shadow-md"
          >
            <div className="mb-4 flex items-center gap-2.5">
              <PlatformTag platform={d.topAd.platform} />
              <span className="font-semibold text-ink">{d.topAd.name}</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-canvas px-3 py-3 shadow-xs">
                <div className="text-2xs text-muted">{t("Dépenses", "Spend")}</div>
                <div className="mt-1 text-sm font-bold text-ink">{eur(d.topAd.spend)}</div>
              </div>
              <div className="rounded-xl bg-canvas px-3 py-3 shadow-xs">
                <div className="text-2xs text-muted">CTR</div>
                <div className="mt-1 text-sm font-bold text-ink">{d.topAd.ctr}</div>
              </div>
              <div className="rounded-xl bg-canvas px-3 py-3 shadow-xs">
                <div className="text-2xs text-muted">{t("Conv.", "Conv.")}</div>
                <div className="mt-1 text-sm font-bold text-ink">{d.topAd.conversions}</div>
              </div>
            </div>
          </Link>
        </section>
      </div>
    </div>
  );
}
