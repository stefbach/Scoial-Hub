"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Entity = { id: string; code: string; name: string; brandVoice?: string; accent?: string };

export default function AdminHome() {
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
          <h1 className="text-xl font-bold tracking-tight text-ink">Vue d'ensemble</h1>
          <p className="mt-0.5 text-sm text-muted">Pilotez les comptes, les entités et leur paramétrage.</p>
        </div>
        <Link href="/admin/comptes/nouveau" className="btn-primary">+ Créer un compte</Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Entités" value={entities ? entities.length : "…"} />
        <Stat label="Réseaux gérés" value="FB · IG · LinkedIn" />
        <Stat label="Agents IA" value="8" />
        <Stat label="Mode" value="Production" />
      </div>

      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <div className="section-label">Comptes / entités</div>
          <Link href="/admin/comptes" className="text-sm font-medium text-page hover:underline">Tout gérer →</Link>
        </div>
        <div className="card divide-y divide-hair">
          {entities === null && <div className="px-4 py-6 text-sm text-muted">Chargement…</div>}
          {entities?.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <p className="text-sm text-muted">Aucune entité pour le moment.</p>
              <Link href="/admin/comptes/nouveau" className="btn-primary">Créer la première entité</Link>
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
