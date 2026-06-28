"use client";

// /reseau/[platform] — espace dédié d'un réseau (Facebook, Instagram, Twitter/X,
// Pinterest, TikTok), façon « Espace LinkedIn ». LinkedIn garde son studio dédié.

import { useParams } from "next/navigation";
import { NetworkSpace } from "@/components/network/NetworkSpace";
import { isSeriesPlatform } from "@/lib/social-series";

export default function ReseauPage() {
  const params = useParams();
  const raw = typeof params.platform === "string"
    ? params.platform
    : Array.isArray(params.platform)
    ? params.platform[0]
    : "";

  if (!isSeriesPlatform(raw)) {
    return <div className="p-6 text-sm text-muted">Réseau inconnu.</div>;
  }

  return <NetworkSpace platform={raw} />;
}
