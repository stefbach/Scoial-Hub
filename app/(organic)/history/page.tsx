"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PlatformTag } from "@/components/ui/PlatformTag";
import type { HistoryItem } from "@/lib/types";

export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryContent />
    </Suspense>
  );
}

function HistoryContent() {
  const { data } = useCompany();
  const params = useSearchParams();
  const tab = params.get("tab");
  const defaultActiveId = tab === "published" ? "pub" : tab === "failed" ? "fail" : "all";

  const items = data.history;
  const published = items.filter((i) => i.status === "published");
  const failed = items.filter((i) => i.status === "failed");

  return (
    <div>
      <PageHeader title="History" actions={<Button variant="secondary">Export</Button>} />

      <Tabs
        defaultActiveId={defaultActiveId}
        tabs={[
          { id: "all", label: `All (${items.length})`, content: <List items={items} /> },
          { id: "pub", label: `Published (${published.length})`, content: <List items={published} /> },
          { id: "fail", label: `Failed (${failed.length})`, content: <List items={failed} /> },
        ]}
      />
    </div>
  );
}

function List({ items }: { items: HistoryItem[] }) {
  return (
    <>
      <input
        placeholder="Search post history…"
        className="mb-3 w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm placeholder:text-muted focus:outline-none"
      />
      <div className="card divide-y divide-hair">
        {items.map((item) => (
          <div key={item.id} className={item.status === "failed" ? "bg-red-50/50" : ""}>
            <div className="flex items-center gap-3 px-3 py-2.5">
              <PlatformTag platform={item.platform} />
              <div className="flex-1">
                <div className="text-sm text-ink">{item.body}</div>
                <div className="text-2xs text-muted">
                  {item.when} · {item.source}
                  {item.stats ? ` · ${item.stats}` : ""}
                </div>
              </div>
              {item.status === "published" ? (
                <StatusBadge tone="green">Published</StatusBadge>
              ) : (
                <StatusBadge tone="red">Failed</StatusBadge>
              )}
            </div>
            {item.error && (
              <div className="mx-3 mb-3 flex items-center justify-between rounded-md border-hair border-red-200 bg-card px-3 py-2">
                <div>
                  <div className="text-2xs font-medium text-red-600">{item.error.title}</div>
                  <div className="text-2xs text-muted">{item.error.detail}</div>
                </div>
                <Button variant="secondary" className="py-1 text-2xs">
                  Retry
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
