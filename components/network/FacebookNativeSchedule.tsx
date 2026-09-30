"use client";

// components/network/FacebookNativeSchedule.tsx
//
// Retour client Rosiane #7, BUGS-SocialHub35 : les publications programmées
// directement dans Meta Business Suite (hors Social Hub) n'apparaissaient
// nulle part dans l'app — impossible d'avoir une vue complète du calendrier
// de publication Facebook depuis un seul endroit. Lecture seule (Graph API
// `/{page-id}/scheduled_posts`, lib/connectors/meta.ts) : ne remplace pas le
// planificateur Social Hub ci-dessus, l'affiche simplement à côté.

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { Spinner } from "@/components/ui/Spinner";

interface NativeScheduledPost {
  id: string;
  message: string;
  scheduledPublishTime: string;
}

export function FacebookNativeSchedule({ companyId }: { companyId: string }) {
  const t = useT();
  const [posts, setPosts] = useState<NativeScheduledPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/connectors/facebook/scheduled?companyId=${encodeURIComponent(companyId)}`)
      .then((r) => r.json())
      .then((d: { posts?: NativeScheduledPost[]; error?: string }) => {
        if (cancelled) return;
        setPosts(Array.isArray(d.posts) ? d.posts : []);
        setError(d.error ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setPosts([]);
          setError(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return (
    <section className="card space-y-3 p-5">
      <div>
        <span className="section-label">
          {t("Publications programmées sur Facebook (Meta Business Suite)", "Posts scheduled on Facebook (Meta Business Suite)")}
        </span>
        <p className="mt-0.5 text-xs text-muted">
          {t(
            "Programmées directement sur Facebook, hors Social Hub — pour une vue complète du calendrier de publication.",
            "Scheduled directly on Facebook, outside Social Hub — for a full view of the publishing calendar."
          )}
        </p>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner size={16} className="text-primary-600" /> {t("Chargement…", "Loading…")}
        </p>
      ) : error ? (
        <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-muted ring-1 ring-hair">
          {t("Indisponible pour cette Page pour le moment.", "Unavailable for this Page right now.")}
        </p>
      ) : !posts || posts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-hair bg-canvas px-4 py-3 text-center text-sm text-muted">
          {t("Aucune publication programmée nativement sur Facebook.", "No post scheduled natively on Facebook.")}
        </p>
      ) : (
        <ul className="space-y-2">
          {posts.map((p) => (
            <li key={p.id} className="rounded-xl border border-hair bg-canvas p-3">
              <p className="text-2xs font-semibold text-primary-700">
                📅 {new Date(p.scheduledPublishTime).toLocaleString()}
              </p>
              {p.message && <p className="mt-0.5 line-clamp-2 break-words text-xs text-muted">{p.message}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
