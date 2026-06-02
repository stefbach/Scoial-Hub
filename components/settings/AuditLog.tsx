"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { DatePicker } from "@/components/ui/DateTimePicker";
import { SubHeader } from "./shared";
import { AUDIT_LOG, COMPANIES, ORG_NAME, TEAM, type AuditEntity, type AuditEvent } from "@/lib/mock-data";
import { downloadFile } from "@/lib/history-store";

type RangeId = "7d" | "30d" | "90d" | "1y" | "all" | "custom";
const RANGE_LABEL: Record<RangeId, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "1y": "Last year",
  all: "All time",
  custom: "Custom range",
};

const ENTITY_LABEL: Record<AuditEntity | "all", string> = {
  all: "All",
  post: "Posts",
  campaign: "Campaigns",
  audience: "Audiences",
  ad_safety: "Ad Safety",
  team: "Team",
  settings: "Settings",
};

const ENTITY_VALUES: (AuditEntity | "all")[] = ["all", "post", "campaign", "audience", "ad_safety", "team", "settings"];
const RANGE_VALUES = new Set<RangeId>(["7d", "30d", "90d", "1y", "all", "custom"]);

const NOW = new Date("2026-05-30T00:00:00");
const PAGE_SIZE = 12;

function rangeStart(r: RangeId, customFrom: Date | null): Date | null {
  if (r === "all") return null;
  if (r === "custom") return customFrom;
  const d = new Date(NOW);
  if (r === "7d") d.setDate(d.getDate() - 7);
  else if (r === "30d") d.setDate(d.getDate() - 30);
  else if (r === "90d") d.setDate(d.getDate() - 90);
  else if (r === "1y") d.setFullYear(d.getFullYear() - 1);
  return d;
}

export function AuditLog({
  initialFilter,
  initialUser,
  initialCompany,
  initialRange,
}: {
  initialFilter?: string;
  initialUser?: string;
  initialCompany?: string;
  initialRange?: string;
}) {
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState<AuditEntity | "all">(
    initialFilter && ENTITY_VALUES.includes(initialFilter as AuditEntity)
      ? (initialFilter as AuditEntity)
      : "all"
  );
  const [userFilter, setUserFilter] = useState<string>(
    initialUser && TEAM.some((t) => t.id === initialUser) ? initialUser : "all"
  );
  const [companyFilter, setCompanyFilter] = useState<string>(
    initialCompany && COMPANIES.some((c) => c.id === initialCompany) ? initialCompany : "all"
  );
  const [range, setRange] = useState<RangeId>(
    initialRange && RANGE_VALUES.has(initialRange as RangeId) ? (initialRange as RangeId) : "30d"
  );
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Reset page when filters change.
  useEffect(() => {
    setPage(1);
  }, [search, entityFilter, userFilter, companyFilter, range, customFrom, customTo]);

  const start = rangeStart(range, customFrom);
  const end = range === "custom" ? customTo : null;

  const filtered = useMemo(() => {
    return AUDIT_LOG.filter((e) => {
      if (entityFilter !== "all" && e.entity !== entityFilter) return false;
      if (userFilter !== "all" && e.userId !== userFilter) return false;
      if (companyFilter !== "all" && e.companyId !== companyFilter) return false;
      if (search.trim() && !e.description.toLowerCase().includes(search.toLowerCase())) return false;
      const t = new Date(e.timestamp);
      if (start && t < start) return false;
      if (end && t > end) return false;
      return true;
    });
  }, [search, entityFilter, userFilter, companyFilter, start, end]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const onExport = (kind: "csv" | "json") => {
    const today = format(new Date(), "yyyy-MM-dd");
    const file = `social-hub-audit-${today}.${kind === "csv" ? "csv" : "json"}`;
    const rows = filtered.map((e) => ({
      timestamp: e.timestamp,
      user: e.userName,
      company: e.companyCode ?? "",
      entity: e.entity,
      severity: e.severity,
      description: e.description,
      ip_address: e.ipAddress,
      user_agent: e.userAgent,
    }));
    if (kind === "csv") {
      const cols = Object.keys(rows[0] ?? {
        timestamp: "", user: "", company: "", entity: "", severity: "", description: "", ip_address: "", user_agent: "",
      });
      const esc = (v: unknown) => {
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc((r as Record<string, unknown>)[c])).join(","))].join("\n");
      downloadFile(file, csv, "text/csv");
    } else {
      downloadFile(file, JSON.stringify(rows, null, 2), "application/json");
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <SubHeader title="Audit log" scope="org" scopeLabel={ORG_NAME} />
        <Dropdown
          align="right"
          trigger={(open, toggle) => (
            <button
              onClick={toggle}
              className="rounded-md border-hair border-hair bg-card px-3 py-1.5 text-sm text-ink hover:bg-canvas"
            >
              Export
            </button>
          )}
        >
          {(close) => (
            <>
              <DropdownItem onClick={() => { onExport("csv"); close(); }}>Export as CSV</DropdownItem>
              <DropdownItem onClick={() => { onExport("json"); close(); }}>Export as JSON</DropdownItem>
            </>
          )}
        </Dropdown>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search descriptions…"
          className="flex-1 min-w-[180px] rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none"
        />
        <Dropdown
          align="right"
          trigger={(open, toggle) => (
            <button onClick={toggle} className="rounded-md border-hair border-hair bg-card px-3 py-2 text-xs text-ink hover:bg-canvas">
              Action: {ENTITY_LABEL[entityFilter]}
            </button>
          )}
        >
          {(close) =>
            (["all", "post", "campaign", "audience", "ad_safety", "team", "settings"] as (AuditEntity | "all")[]).map((e) => (
              <DropdownItem key={e} active={e === entityFilter} onClick={() => { setEntityFilter(e); close(); }}>
                {ENTITY_LABEL[e]}
              </DropdownItem>
            ))
          }
        </Dropdown>
        <Dropdown
          align="right"
          trigger={(open, toggle) => (
            <button onClick={toggle} className="rounded-md border-hair border-hair bg-card px-3 py-2 text-xs text-ink hover:bg-canvas">
              User: {userFilter === "all" ? "All" : TEAM.find((t) => t.id === userFilter)?.name ?? "All"}
            </button>
          )}
        >
          {(close) => (
            <>
              <DropdownItem active={userFilter === "all"} onClick={() => { setUserFilter("all"); close(); }}>All</DropdownItem>
              {TEAM.map((u) => (
                <DropdownItem key={u.id} active={userFilter === u.id} onClick={() => { setUserFilter(u.id); close(); }}>
                  {u.name}
                </DropdownItem>
              ))}
            </>
          )}
        </Dropdown>
        <Dropdown
          align="right"
          trigger={(open, toggle) => (
            <button onClick={toggle} className="rounded-md border-hair border-hair bg-card px-3 py-2 text-xs text-ink hover:bg-canvas">
              Company: {companyFilter === "all" ? "All" : COMPANIES.find((c) => c.id === companyFilter)?.code ?? "All"}
            </button>
          )}
        >
          {(close) => (
            <>
              <DropdownItem active={companyFilter === "all"} onClick={() => { setCompanyFilter("all"); close(); }}>All</DropdownItem>
              {COMPANIES.map((c) => (
                <DropdownItem key={c.id} active={companyFilter === c.id} onClick={() => { setCompanyFilter(c.id); close(); }}>
                  {c.name}
                </DropdownItem>
              ))}
            </>
          )}
        </Dropdown>
        <Dropdown
          align="right"
          trigger={(open, toggle) => (
            <button onClick={toggle} className="rounded-md border-hair border-hair bg-card px-3 py-2 text-xs text-ink hover:bg-canvas">
              {RANGE_LABEL[range]}
            </button>
          )}
        >
          {(close) =>
            (Object.keys(RANGE_LABEL) as RangeId[]).map((r) => (
              <DropdownItem key={r} active={r === range} onClick={() => { setRange(r); close(); }}>
                {RANGE_LABEL[r]}
              </DropdownItem>
            ))
          }
        </Dropdown>
      </div>

      {range === "custom" && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-2xs text-muted">From</span>
          <div className="w-40"><DatePicker value={customFrom ?? NOW} onChange={setCustomFrom} /></div>
          <span className="text-2xs text-muted">to</span>
          <div className="w-40"><DatePicker value={customTo ?? NOW} onChange={setCustomTo} /></div>
        </div>
      )}

      <div className="card divide-y divide-hair">
        {pageRows.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted">No events match these filters.</div>
        ) : (
          pageRows.map((e) => (
            <div key={e.id}>
              <button
                onClick={() => setExpanded((x) => (x === e.id ? null : e.id))}
                className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-canvas"
              >
                <span className="w-24 shrink-0 text-2xs text-muted">{format(new Date(e.timestamp), "d MMM HH:mm")}</span>
                <UserAvatar name={e.userName} />
                {e.companyCode ? (
                  <span className="shrink-0 rounded bg-canvas px-1.5 py-0.5 text-2xs font-medium text-muted">{e.companyCode}</span>
                ) : (
                  <span className="shrink-0 rounded bg-canvas px-1.5 py-0.5 text-2xs text-muted">Org</span>
                )}
                <span className="min-w-0 flex-1 text-sm text-ink">{e.description}</span>
                <SeverityIcon severity={e.severity} />
              </button>
              {expanded === e.id && (
                <div className="bg-canvas/40 px-3 py-3 text-2xs text-muted">
                  <dl className="space-y-1">
                    {e.before && (
                      <Row label="Before" value={JSON.stringify(e.before)} />
                    )}
                    {e.after && (
                      <Row label="After" value={JSON.stringify(e.after)} />
                    )}
                    <Row label="IP address" value={e.ipAddress} />
                    <Row label="User agent" value={e.userAgent} />
                    <Row label="Event ID" value={e.id} />
                  </dl>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-2xs text-muted">
        <span>Page {page} of {totalPages} · {filtered.length} event{filtered.length === 1 ? "" : "s"}</span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md border-hair border-hair bg-card px-2 py-1 text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
          >
            ← Prev
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-md border-hair border-hair bg-card px-2 py-1 text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

function UserAvatar({ name }: { name: string }) {
  const initials = name === "System"
    ? "SYS"
    : name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-page text-[10px] font-semibold text-white">
      {initials}
    </span>
  );
}

function SeverityIcon({ severity }: { severity: AuditEvent["severity"] }) {
  const map = {
    info: { color: "text-muted", path: "M12 8h.01M11 12h1v5h1" },
    warning: { color: "text-amber-600", path: "M12 9v4M12 17h.01" },
    danger: { color: "text-red-600", path: "M12 9v4M12 17h.01" },
  } as const;
  const m = map[severity];
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={`shrink-0 ${m.color}`}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d={m.path} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="break-words text-ink">{value}</dd>
    </div>
  );
}
