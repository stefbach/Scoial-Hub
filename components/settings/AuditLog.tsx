"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { DatePicker } from "@/components/ui/DateTimePicker";
import { SubHeader } from "./shared";
import { AUDIT_LOG, COMPANIES, ORG_NAME, TEAM, type AuditEntity, type AuditEvent } from "@/lib/mock-data";
import { downloadFile } from "@/lib/history-store";
import { useT } from "@/lib/i18n";

type RangeId = "7d" | "30d" | "90d" | "1y" | "all" | "custom";

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
  const t = useT();

  const RANGE_LABEL: Record<RangeId, string> = {
    "7d": t("7 derniers jours", "Last 7 days"),
    "30d": t("30 derniers jours", "Last 30 days"),
    "90d": t("90 derniers jours", "Last 90 days"),
    "1y": t("Dernière année", "Last year"),
    all: t("Tout le temps", "All time"),
    custom: t("Plage personnalisée", "Custom range"),
  };

  const ENTITY_LABEL: Record<AuditEntity | "all", string> = {
    all: t("Tous", "All"),
    post: t("Publications", "Posts"),
    campaign: t("Campagnes", "Campaigns"),
    audience: t("Audiences", "Audiences"),
    ad_safety: t("Sécurité pub.", "Ad Safety"),
    team: t("Équipe", "Team"),
    settings: t("Paramètres", "Settings"),
  };

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
      const ts = new Date(e.timestamp);
      if (start && ts < start) return false;
      if (end && ts > end) return false;
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
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1"><SubHeader title={t("Journal d'audit", "Audit log")} scope="org" scopeLabel={ORG_NAME} /></div>
        <Dropdown
          align="right"
          trigger={(open, toggle) => (
            <button
              onClick={toggle}
              className="shrink-0 rounded-md border-hair border-hair bg-card px-3 py-1.5 text-sm text-ink hover:bg-canvas"
            >
              {t("Exporter", "Export")}
            </button>
          )}
        >
          {(close) => (
            <>
              <DropdownItem onClick={() => { onExport("csv"); close(); }}>{t("Exporter en CSV", "Export as CSV")}</DropdownItem>
              <DropdownItem onClick={() => { onExport("json"); close(); }}>{t("Exporter en JSON", "Export as JSON")}</DropdownItem>
            </>
          )}
        </Dropdown>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("Rechercher dans les descriptions…", "Search descriptions…")}
          className="flex-1 min-w-[180px] rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none"
        />
        <Dropdown
          align="right"
          trigger={(open, toggle) => (
            <button onClick={toggle} className="rounded-md border-hair border-hair bg-card px-3 py-2 text-xs text-ink hover:bg-canvas">
              {t("Action :", "Action:")} {ENTITY_LABEL[entityFilter]}
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
              {t("Utilisateur :", "User:")} {userFilter === "all" ? t("Tous", "All") : TEAM.find((u) => u.id === userFilter)?.name ?? t("Tous", "All")}
            </button>
          )}
        >
          {(close) => (
            <>
              <DropdownItem active={userFilter === "all"} onClick={() => { setUserFilter("all"); close(); }}>{t("Tous", "All")}</DropdownItem>
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
              {t("Entreprise :", "Company:")} {companyFilter === "all" ? t("Toutes", "All") : COMPANIES.find((c) => c.id === companyFilter)?.code ?? t("Toutes", "All")}
            </button>
          )}
        >
          {(close) => (
            <>
              <DropdownItem active={companyFilter === "all"} onClick={() => { setCompanyFilter("all"); close(); }}>{t("Toutes", "All")}</DropdownItem>
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
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-2xs text-muted">{t("Du", "From")}</span>
          <div className="w-full min-w-0 sm:w-40"><DatePicker value={customFrom ?? NOW} onChange={setCustomFrom} /></div>
          <span className="text-2xs text-muted">{t("au", "to")}</span>
          <div className="w-full min-w-0 sm:w-40"><DatePicker value={customTo ?? NOW} onChange={setCustomTo} /></div>
        </div>
      )}

      <div className="card divide-y divide-hair">
        {pageRows.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted">{t("Aucun événement ne correspond à ces filtres.", "No events match these filters.")}</div>
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
                      <Row label={t("Avant", "Before")} value={JSON.stringify(e.before)} />
                    )}
                    {e.after && (
                      <Row label={t("Après", "After")} value={JSON.stringify(e.after)} />
                    )}
                    <Row label={t("Adresse IP", "IP address")} value={e.ipAddress} />
                    <Row label={t("Agent utilisateur", "User agent")} value={e.userAgent} />
                    <Row label={t("ID événement", "Event ID")} value={e.id} />
                  </dl>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-2xs text-muted">
        <span>{t("Page", "Page")} {page} {t("sur", "of")} {totalPages} · {filtered.length} {filtered.length === 1 ? t("événement", "event") : t("événements", "events")}</span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md border-hair border-hair bg-card px-2 py-1 text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("← Préc.", "← Prev")}
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-md border-hair border-hair bg-card px-2 py-1 text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("Suiv. →", "Next →")}
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
