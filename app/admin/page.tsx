"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

type Entity = { id: string; code: string; name: string; brandVoice?: string; accent?: string };

export default function AdminHome() {
  const t = useT();
  const [entities, setEntities] = useState<Entity[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/companies")
      .then((r) => r.json())
      .then((d) => alive && setEntities(Array.isArray(d) ? d : []))
      .catch(() => alive && setEntities([]));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">{t("Vue d'ensemble", "Overview")}</h1>
          <p className="mt-0.5 text-sm text-muted">{t("Pilotez les comptes, les entités et leur paramétrage.", "Manage accounts, entities and their configuration.")}</p>
        </div>
        <Link href="/admin/comptes/nouveau" className="btn-primary">+ {t("Créer un compte", "Create account")}</Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label={t("Entités", "Entities")} value={entities ? entities.length : "…"} />
        <Stat label={t("Réseaux gérés", "Managed networks")} value="FB · IG · LinkedIn" />
        <Stat label={t("Agents IA", "AI Agents")} value="8" />
        <Stat label={t("Mode", "Mode")} value={t("Production", "Production")} />
      </div>

      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <div className="section-label">{t("Comptes / entités", "Accounts / entities")}</div>
          <Link href="/admin/comptes" className="text-sm font-medium text-page hover:underline">{t("Tout gérer →", "Manage all →")}</Link>
        </div>
        <div className="card divide-y divide-hair">
          {entities === null && <div className="px-4 py-6 text-sm text-muted">{t("Chargement…", "Loading…")}</div>}
          {entities?.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <p className="text-sm text-muted">{t("Aucune entité pour le moment.", "No entities yet.")}</p>
              <Link href="/admin/comptes/nouveau" className="btn-primary">{t("Créer la première entité", "Create first entity")}</Link>
            </div>
          )}
          {entities?.map((e) => (
            <Link key={e.id} href={`/admin/comptes`} className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-canvas">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg text-2xs font-bold text-white" style={{ background: e.accent ?? "#1e3a5f" }}>
                {e.code}
              </span>
              <span className="flex-1 font-medium text-ink">{e.name}</span>
              <span className="text-2xs text-muted">{e.brandVoice}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <div className="text-2xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-xl font-bold text-ink">{value}</div>
    </div>
  );
}
