"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCompany } from "@/lib/company-context";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { findAdSet } from "@/lib/campaign-store";

export default function AdSetDetailPlaceholder() {
  const params = useParams<{ id: string }>();
  const { company } = useCompany();
  const found = findAdSet(company.id, params.id);

  if (!found) {
    return (
      <div>
        <Breadcrumb trail={[{ href: "/campaigns", label: "Campaigns" }, { label: "Ad set" }]} />
        <div className="card px-3 py-8 text-center text-sm text-muted">
          Ad set not found.{" "}
          <Link href="/campaigns" className="text-ai-text underline">
            Back to campaigns
          </Link>
        </div>
      </div>
    );
  }

  const { adSet, campaign } = found;

  return (
    <div>
      <Breadcrumb
        trail={[
          { href: "/campaigns", label: "Campaigns" },
          { href: `/campaigns/${campaign.id}`, label: campaign.name },
          { label: adSet.name },
        ]}
      />
      <h1 className="mb-1 text-lg font-semibold text-ink">{adSet.name}</h1>
      <p className="mb-4 text-2xs text-muted">
        {adSet.placement} · {adSet.targeting}
      </p>
      <div className="card px-3 py-8 text-center text-sm text-muted">
        Ad set detail coming soon.
      </div>
    </div>
  );
}
