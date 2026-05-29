"use client";

import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default function AccountsPage() {
  const { company } = useCompany();

  return (
    <div>
      <PageHeader title="Connected accounts" />

      <div className="mb-4 rounded-md border-hair border-ai-text/20 bg-ai-textbg px-3 py-2.5 text-xs text-ai-text">
        Connect each platform once per company. Meta&apos;s connection covers Facebook and Instagram (organic + ads) together. LinkedIn is separate.
      </div>

      <div className="mb-2 text-sm font-medium text-ink">Meta (Facebook + Instagram)</div>
      <div className="card mb-5 p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink">Meta Business Manager</span>
              <StatusBadge tone="green">Connected</StatusBadge>
            </div>
            <div className="mt-0.5 text-2xs text-muted">Connected via Meta Official MCP · 21 May 2026</div>
            <div className="text-2xs text-muted">Business Manager: {company.code} Holdings</div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary">Reconnect</Button>
            <Button variant="danger">Disconnect</Button>
          </div>
        </div>

        <div className="mt-3 border-t-hair border-hair pt-3">
          <div className="section-label mb-2">Pages &amp; accounts available</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border-hair border-hair bg-canvas px-3 py-2">
              <div className="text-xs font-medium text-ink">{company.code} Facebook Page</div>
              <div className="text-2xs text-muted">Organic + Ads</div>
            </div>
            <div className="rounded-md border-hair border-hair bg-canvas px-3 py-2">
              <div className="text-xs font-medium text-ink">@{company.id}_mauritius</div>
              <div className="text-2xs text-muted">Business · Organic + Ads</div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-md bg-amber-50 px-3 py-2">
          <span className="text-2xs text-amber-700">
            Ads access: read-only for the first 7 days. Switch to full control after the safety period.
          </span>
          <Button variant="secondary" className="py-1 text-2xs">Manage</Button>
        </div>
      </div>

      <div className="mb-2 text-sm font-medium text-ink">LinkedIn</div>
      <div className="card p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink">LinkedIn Company Page</span>
              <StatusBadge tone="gray">Not connected</StatusBadge>
            </div>
            <div className="mt-0.5 text-2xs text-muted">
              Connect {company.code}&apos;s LinkedIn Company Page to publish organic posts. Requires LinkedIn Marketing Developer Platform access (approval takes 5-10 business days).
            </div>
          </div>
          <Button variant="primary">Connect</Button>
        </div>
      </div>
    </div>
  );
}
