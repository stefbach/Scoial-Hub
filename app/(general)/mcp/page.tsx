"use client";

import { useCallback, useEffect, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { Toast } from "@/components/ui/Toast";

// ── Connecteur MCP Claude — clé personnelle + installeur une-ligne ──────────────

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function ClientMcpPage() {
  const { company } = useCompany();
  const t = useT();
  const companyId = company.id;

  const [origin, setOrigin] = useState("https://votre-app.vercel.app");
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; key: number } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/api-keys?companyId=${encodeURIComponent(companyId)}`);
      if (res.ok) setKeys(await res.json());
    } catch {
      /* ignore */
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  function notify(msg: string) {
    setToast({ message: msg, key: Date.now() });
  }

  async function createKey() {
    setCreating(true);
    setFreshKey(null);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, name: name.trim() || t("Clé MCP", "MCP key") }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(t(`Erreur : ${data.error ?? res.status}`, `Error: ${data.error ?? res.status}`));
        return;
      }
      setFreshKey(data.plaintext);
      setName("");
      await load();
    } catch {
      notify(t("Erreur réseau.", "Network error."));
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    try {
      const res = await fetch(`/api/api-keys/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      if (res.ok) {
        await load();
        notify(t("Clé révoquée.", "Key revoked."));
      }
    } catch {
      notify(t("Erreur réseau.", "Network error."));
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard?.writeText(text).then(
      () => notify(t(`${label} copié.`, `${label} copied.`)),
      () => notify(t("Copie impossible.", "Copy failed."))
    );
  }

  const macCmd = `curl -fsSL ${origin}/install-mcp.sh | bash`;
  const winCmd = `iwr -useb ${origin}/install-mcp.ps1 | iex`;

  return (
    <div className="animate-fade-in space-y-5">
      {/* En-tête */}
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white"
          aria-hidden
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2l2.4 5.6L20 9l-4.5 4 1.3 6L12 16l-4.8 3 1.3-6L4 9l5.6-1.4L12 2Z" fill="white" />
          </svg>
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">
            {t(`Connecter « ${company.name} » à Claude Desktop`, `Connect “${company.name}” to Claude Desktop`)}
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            {t("Générez votre clé, lancez une commande, c'est fini.", "Generate your key, run one command, done.")}
          </p>
        </div>
      </div>

      {/* Étape 1 — Clé API */}
      <Step n={1} title={t("Générez une clé API personnelle", "Generate a personal API key")}>
        <p className="mb-3 text-sm leading-relaxed text-muted">
          {t(
            "Chaque clé est liée à ce compte, révocable à tout moment et stockée hachée — personne ne peut la relire en clair, pas même les admins.",
            "Each key is bound to this account, revocable anytime and stored hashed — nobody can read it back in clear text, not even admins."
          )}
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input flex-1"
            placeholder={t("Nom de la clé (ex : MCP MacBook Pro)", "Key name (e.g. MCP MacBook Pro)")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createKey()}
          />
          <button className="btn-primary shrink-0" onClick={createKey} disabled={creating}>
            {creating ? t("Création…", "Creating…") : t("+ Créer", "+ Create")}
          </button>
        </div>

        {/* Clé fraîchement créée (affichée une seule fois) */}
        {freshKey && (
          <div className="mt-3 rounded-lg border border-success-200 bg-success-50 p-3">
            <p className="mb-1.5 text-xs font-semibold text-success-700">
              {t("Copiez cette clé maintenant — elle ne sera plus jamais affichée :", "Copy this key now — it will never be shown again:")}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-card px-2 py-1.5 font-mono text-xs text-ink">{freshKey}</code>
              <button className="btn-secondary shrink-0 text-xs" onClick={() => copy(freshKey, t("Clé", "Key"))}>
                {t("Copier", "Copy")}
              </button>
            </div>
          </div>
        )}

        {/* Clés actives */}
        {keys.length > 0 && (
          <div className="mt-4">
            <div className="section-label mb-2">{t("Clés actives", "Active keys")}</div>
            <ul className="space-y-2">
              {keys.map((k) => (
                <li key={k.id} className="flex items-center gap-3 rounded-lg border border-hair bg-canvas px-3 py-2.5">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0 text-muted" aria-hidden>
                    <circle cx="5" cy="7.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M7.3 7.5H13M11 7.5v2M13 7.5v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">{k.name}</div>
                    <div className="truncate font-mono text-2xs text-muted">{k.keyPrefix}…</div>
                  </div>
                  <span className="hidden shrink-0 text-2xs text-muted sm:block">
                    {k.lastUsedAt
                      ? t("Utilisée le ", "Used ") + new Date(k.lastUsedAt).toLocaleDateString(t("fr-FR", "en-US"))
                      : t("Jamais utilisée", "Never used")}
                  </span>
                  <button
                    className="shrink-0 rounded-md p-1.5 text-danger transition-colors hover:bg-danger/10"
                    onClick={() => revoke(k.id)}
                    aria-label={t("Révoquer", "Revoke")}
                    title={t("Révoquer", "Revoke")}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2.5 3.5h9M5.5 3.5V2.5h3v1M3.5 3.5l.5 8h6l.5-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Step>

      {/* Étape 2 — Prérequis */}
      <Step n={2} title={t("Pré-requis sur votre ordinateur", "Prerequisites on your computer")}>
        <ul className="space-y-2 text-sm text-ink">
          <li className="flex items-start gap-2">
            <Dot />
            <span>
              <strong>{t("Claude Desktop installé.", "Claude Desktop installed.")}</strong>{" "}
              <a href="https://claude.ai/download" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:no-underline">
                {t("Télécharger", "Download")}
              </a>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Dot />
            <span>
              <strong>Node.js 18+.</strong>{" "}
              <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:no-underline">
                {t("Télécharger Node.js", "Download Node.js")}
              </a>{" "}
              <span className="text-muted">({t("Mac : ", "Mac: ")}<code className="rounded bg-canvas px-1 font-mono text-xs">brew install node</code>)</span>
            </span>
          </li>
        </ul>
      </Step>

      {/* Étape 3 — Mac/Linux */}
      <Step n={3} title={t("macOS ou Linux — une commande", "macOS or Linux — one command")}>
        <p className="mb-2 text-sm text-muted">
          {t("Ouvrez le Terminal, collez la commande, pressez Entrée. Le script vous demandera l'URL et la clé que vous venez de générer.", "Open Terminal, paste the command, press Enter. The script will ask for the URL and the key you just generated.")}
        </p>
        <CodeRow code={macCmd} onCopy={() => copy(macCmd, t("Commande", "Command"))} copyLabel={t("Copier", "Copy")} />
      </Step>

      {/* Étape 4 — Windows */}
      <Step n={4} title={t("Windows — une commande", "Windows — one command")}>
        <p className="mb-2 text-sm text-muted">{t("Ouvrez PowerShell, collez la commande, pressez Entrée.", "Open PowerShell, paste the command, press Enter.")}</p>
        <CodeRow code={winCmd} onCopy={() => copy(winCmd, t("Commande", "Command"))} copyLabel={t("Copier", "Copy")} />
      </Step>

      {/* Étape 5 — Test */}
      <Step n={5} title={t("Testez", "Test")}>
        <ol className="space-y-1.5 text-sm text-ink">
          <li>1. <strong>{t("Quittez complètement Claude Desktop", "Quit Claude Desktop completely")}</strong> {t("(Cmd+Q sur Mac).", "(Cmd+Q on Mac).")}</li>
          <li>2. <strong>{t("Relancez Claude Desktop.", "Relaunch Claude Desktop.")}</strong></li>
          <li>3. {t("Tapez dans une nouvelle conversation : ", "Type in a new conversation: ")}
            <code className="rounded bg-primary-50 px-1.5 py-0.5 font-mono text-xs text-primary-700">{t("Liste mes comptes AXON-AI", "List my AXON-AI accounts")}</code>
          </li>
        </ol>
      </Step>

      {toast && <Toast key={toast.key} message={toast.message} onDismiss={() => setToast(null)} />}
    </div>
  );
}

// ── Sous-composants ─────────────────────────────────────────────────────────────

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-2xs font-bold text-white">{n}</span>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function CodeRow({ code, onCopy, copyLabel }: { code: string; onCopy: () => void; copyLabel: string }) {
  return (
    <div className="flex items-stretch gap-2">
      <pre className="flex-1 overflow-x-auto rounded-lg bg-[#1e1b2e] px-4 py-3 text-xs leading-relaxed text-[#e9e3f5]">
        <code>{code}</code>
      </pre>
      <button className="btn-secondary shrink-0 text-xs" onClick={onCopy}>{copyLabel}</button>
    </div>
  );
}

function Dot() {
  return <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />;
}
