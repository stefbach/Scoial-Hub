"use client";

import { useCallback, useEffect, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { AgentModal } from "@/components/inbox/AgentModal";
import {
  CHANNEL_LABELS,
  type InboxAgent,
  type InboxChannel,
  type InboxMessage,
  type InboxMessageStatus,
} from "@/lib/inbox/types";

type Filter = "pending" | "needs_human" | "answered" | "all";

const STATUS_FILTERS: { id: Filter; fr: string; en: string }[] = [
  { id: "pending", fr: "À traiter", en: "To handle" },
  { id: "needs_human", fr: "Pour un humain", en: "For a human" },
  { id: "answered", fr: "Répondu", en: "Answered" },
  { id: "all", fr: "Tout", en: "All" },
];

const SENTIMENT_STYLE: Record<string, string> = {
  positive: "bg-success-50 text-success-700",
  negative: "bg-danger-50 text-danger-700",
  question: "bg-ai-textbg text-ai-text",
  neutral: "bg-canvas text-muted",
};

export default function InboxPage() {
  const { company } = useCompany();
  const companyId = company.id;
  const t = useT();

  const [agents, setAgents] = useState<InboxAgent[]>([]);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);

  const [agentModal, setAgentModal] = useState(false);
  const [editAgent, setEditAgent] = useState<InboxAgent | null>(null);
  const [simulateOpen, setSimulateOpen] = useState(false);

  const loadAgents = useCallback(async () => {
    try {
      const r = await fetch(`/api/inbox/agents?companyId=${encodeURIComponent(companyId)}`);
      if (r.ok) setAgents(await r.json());
    } catch {
      /* ignore */
    }
  }, [companyId]);

  const loadMessages = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const q = filter === "all" ? "" : `&status=${filter}`;
        const r = await fetch(`/api/inbox/messages?companyId=${encodeURIComponent(companyId)}${q}`);
        if (r.ok) setMessages(await r.json());
      } catch {
        /* ignore */
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [companyId, filter]
  );

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  async function sync() {
    setSyncing(true);
    setBanner(null);
    try {
      const r = await fetch("/api/inbox/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const d = await r.json();
      if (!d.available) {
        setBanner({ kind: "warn", text: t("Connectez votre Page Meta pour importer les commentaires.", "Connect your Meta Page to import comments.") });
      } else {
        setBanner({ kind: "ok", text: t(`${d.imported} message(s) importé(s).`, `${d.imported} message(s) imported.`) });
        await loadMessages(true);
      }
    } catch {
      setBanner({ kind: "warn", text: t("Échec de la synchronisation.", "Sync failed.") });
    } finally {
      setSyncing(false);
    }
  }

  function onMessageChanged(updated: InboxMessage) {
    setMessages((prev) => {
      // Si le filtre ne correspond plus au nouveau statut, on retire la carte.
      const stillMatches = filter === "all" || updated.status === filter;
      if (!stillMatches) return prev.filter((m) => m.id !== updated.id);
      return prev.map((m) => (m.id === updated.id ? updated : m));
    });
  }

  const counts = {
    pending: messages.filter((m) => m.status === "pending").length,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* En-tête */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("Messagerie & agents", "Inbox & agents")}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {t(
              "Vos agents répondent aux messages des réseaux dans la voix de la marque — et passent la main à un humain quand il le faut.",
              "Your agents reply to social messages in the brand voice — and hand off to a human when needed."
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setSimulateOpen(true)} className="btn-secondary text-sm">
            {t("Simuler un message", "Simulate a message")}
          </button>
          <button onClick={sync} disabled={syncing} className="btn-primary text-sm disabled:opacity-50">
            {syncing ? t("Synchronisation…", "Syncing…") : t("Synchroniser Meta", "Sync Meta")}
          </button>
        </div>
      </header>

      {banner && (
        <div
          role="status"
          className={`rounded-xl px-4 py-2.5 text-sm ${banner.kind === "ok" ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700"}`}
        >
          {banner.text}
        </div>
      )}

      {/* Agents */}
      <AgentsSection
        agents={agents}
        onCreate={() => {
          setEditAgent(null);
          setAgentModal(true);
        }}
        onEdit={(a) => {
          setEditAgent(a);
          setAgentModal(true);
        }}
        onToggle={async (a, enabled) => {
          await fetch(`/api/inbox/agents/${a.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyId, enabled }),
          });
          loadAgents();
        }}
        onDelete={async (a) => {
          await fetch(`/api/inbox/agents/${a.id}?companyId=${encodeURIComponent(companyId)}`, { method: "DELETE" });
          loadAgents();
        }}
      />

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${filter === f.id ? "bg-ink text-white" : "bg-canvas text-muted hover:text-ink"}`}
          >
            {t(f.fr, f.en)}
            {f.id === "pending" && counts.pending > 0 && filter !== "pending" && (
              <span className="ml-1.5 rounded-full bg-primary-100 px-1.5 text-2xs text-primary-700">{counts.pending}</span>
            )}
          </button>
        ))}
      </div>

      {/* Messages */}
      {loading ? (
        <p className="text-sm text-muted">{t("Chargement…", "Loading…")}</p>
      ) : messages.length === 0 ? (
        <EmptyInbox t={t} hasAgents={agents.length > 0} />
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <MessageCard
              key={m.id}
              companyId={companyId}
              message={m}
              hasAgent={agents.length > 0}
              onChanged={onMessageChanged}
            />
          ))}
        </div>
      )}

      <AgentModal
        open={agentModal}
        onClose={() => setAgentModal(false)}
        companyId={companyId}
        agent={editAgent}
        onSaved={() => loadAgents()}
      />
      <SimulateModal
        open={simulateOpen}
        onClose={() => setSimulateOpen(false)}
        companyId={companyId}
        onCreated={() => {
          setSimulateOpen(false);
          if (filter !== "pending") setFilter("pending");
          else loadMessages(true);
        }}
      />
    </div>
  );
}

// ── Section agents ────────────────────────────────────────────────────────────
function AgentsSection({
  agents,
  onCreate,
  onEdit,
  onToggle,
  onDelete,
}: {
  agents: InboxAgent[];
  onCreate: () => void;
  onEdit: (a: InboxAgent) => void;
  onToggle: (a: InboxAgent, enabled: boolean) => void;
  onDelete: (a: InboxAgent) => void;
}) {
  const t = useT();
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-hair bg-canvas px-5 py-3">
        <div>
          <span className="section-label">{t("Agents de réponse", "Reply agents")}</span>
          <p className="mt-0.5 text-2xs text-muted">
            {t("Un agent pour tout, ou un agent par canal.", "One agent for everything, or one per channel.")}
          </p>
        </div>
        <button onClick={onCreate} className="btn-primary text-xs">{t("+ Nouvel agent", "+ New agent")}</button>
      </div>
      {agents.length === 0 ? (
        <div className="px-5 py-6 text-center">
          <p className="text-sm font-medium text-ink">{t("Aucun agent configuré", "No agent configured")}</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted">
            {t(
              "Créez un agent : donnez-lui sa voix, son périmètre, et dites-lui quand passer la main à un humain.",
              "Create an agent: give it a voice, a scope, and tell it when to hand off to a human."
            )}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-hair">
          {agents.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{a.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${a.autonomy === "auto" ? "bg-success-50 text-success-700" : "bg-canvas text-muted ring-1 ring-hair"}`}>
                    {a.autonomy === "auto" ? t("Auto", "Auto") : t("Suggère", "Suggests")}
                  </span>
                  {!a.enabled && <span className="rounded-full bg-canvas px-2 py-0.5 text-2xs text-muted ring-1 ring-hair">{t("Inactif", "Off")}</span>}
                </div>
                <p className="mt-0.5 truncate text-2xs text-muted">
                  {a.scope === "all"
                    ? t("Tous les canaux", "All channels")
                    : a.channels.map((c) => CHANNEL_LABELS[c]).join(" · ") || t("Aucun canal", "No channel")}
                  {" · "}
                  {t("seuil", "threshold")} {Math.round(a.confidenceThreshold * 100)}%
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex cursor-pointer items-center gap-1.5 text-2xs text-muted">
                  <input type="checkbox" checked={a.enabled} onChange={(e) => onToggle(a, e.target.checked)} className="accent-primary-600" />
                  {t("Actif", "On")}
                </label>
                <button onClick={() => onEdit(a)} className="btn-secondary text-2xs">{t("Modifier", "Edit")}</button>
                <button
                  onClick={() => { if (confirm(t("Supprimer cet agent ?", "Delete this agent?"))) onDelete(a); }}
                  className="text-2xs text-danger-600 hover:underline"
                >
                  {t("Suppr.", "Delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Carte message ──────────────────────────────────────────────────────────────
function MessageCard({
  companyId,
  message,
  hasAgent,
  onChanged,
}: {
  companyId: string;
  message: InboxMessage;
  hasAgent: boolean;
  onChanged: (m: InboxMessage) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState(message.reply?.body ?? "");
  const [reply, setReply] = useState(message.reply ?? null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    setNote(null);
    try {
      const r = await fetch("/api/inbox/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, messageId: message.id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setReply(d.reply);
      setDraft(d.reply.body);
      if (d.autoSent) {
        setNote(t("Réponse envoyée automatiquement par l'agent.", "Reply auto-sent by the agent."));
        onChanged({ ...message, status: "answered", reply: d.reply });
      } else if (d.reply.needsHuman) {
        setNote(d.reply.reason || t("À valider par un humain.", "Needs human approval."));
        onChanged({ ...message, status: "needs_human", reply: d.reply });
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : t("Échec.", "Failed."));
    } finally {
      setGenerating(false);
    }
  }

  async function send() {
    if (!draft.trim()) return;
    setSending(true);
    setNote(null);
    try {
      const r = await fetch("/api/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, messageId: message.id, body: draft, replyId: reply?.id, agentId: reply?.agentId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      onChanged({ ...message, status: "answered", reply: d.reply });
      if (d.deliveryError) {
        setNote(t(`Enregistré, mais non publié : ${d.deliveryError}`, `Saved, but not posted: ${d.deliveryError}`));
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : t("Échec de l'envoi.", "Send failed."));
    } finally {
      setSending(false);
    }
  }

  async function setStatus(status: InboxMessageStatus) {
    await fetch(`/api/inbox/messages/${message.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, status }),
    });
    onChanged({ ...message, status });
  }

  const answered = message.status === "answered";

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">{message.authorName}</span>
            <span className="rounded-full bg-canvas px-2 py-0.5 text-2xs font-medium text-muted ring-1 ring-hair">
              {CHANNEL_LABELS[message.channel as InboxChannel] ?? message.channel}
            </span>
            {message.sentiment && (
              <span className={`rounded-full px-2 py-0.5 text-2xs font-medium ${SENTIMENT_STYLE[message.sentiment] ?? SENTIMENT_STYLE.neutral}`}>
                {message.sentiment}
              </span>
            )}
            {message.status === "needs_human" && (
              <span className="rounded-full bg-warning-50 px-2 py-0.5 text-2xs font-semibold text-warning-700">
                {t("Humain requis", "Human needed")}
              </span>
            )}
            {answered && (
              <span className="rounded-full bg-success-50 px-2 py-0.5 text-2xs font-semibold text-success-700">
                {t("Répondu", "Answered")}
              </span>
            )}
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink">{message.text}</p>
          {message.permalink && (
            <a href={message.permalink} target="_blank" rel="noreferrer" className="mt-1 inline-block text-2xs text-primary-600 hover:underline">
              {t("Voir sur la plateforme ↗", "View on platform ↗")}
            </a>
          )}
        </div>
      </div>

      {/* Zone de réponse */}
      <div className="mt-3 border-t border-hair pt-3">
        {reply && (
          <div className="mb-2 flex items-center gap-2 text-2xs text-muted">
            <span className="rounded-full bg-ai-textbg px-2 py-0.5 font-semibold text-ai-text">IA</span>
            {reply.confidence != null && (
              <span>{t("Confiance", "Confidence")} {Math.round((reply.confidence ?? 0) * 100)}%</span>
            )}
            {reply.needsHuman && <span className="text-warning-700">· {reply.reason}</span>}
          </div>
        )}

        {!answered && (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder={t("Rédigez ou générez une réponse…", "Write or generate a reply…")}
              className="w-full rounded-lg border border-hair bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button onClick={generate} disabled={generating || !hasAgent} className="btn-secondary text-xs disabled:opacity-50">
                {generating ? t("Génération…", "Generating…") : t("✨ Réponse IA", "✨ AI reply")}
              </button>
              <button onClick={send} disabled={sending || !draft.trim()} className="btn-primary text-xs disabled:opacity-50">
                {sending ? t("Envoi…", "Sending…") : t("Envoyer", "Send")}
              </button>
              <button onClick={() => setStatus("ignored")} className="text-xs text-muted hover:text-ink">
                {t("Ignorer", "Ignore")}
              </button>
              {!hasAgent && (
                <span className="text-2xs text-muted">{t("Créez un agent pour la réponse IA.", "Create an agent for AI replies.")}</span>
              )}
            </div>
          </>
        )}

        {answered && reply && (
          <div className="rounded-lg bg-canvas px-3 py-2 text-sm text-ink">{reply.body}</div>
        )}

        {note && <p className="mt-2 text-2xs text-warning-700">{note}</p>}
      </div>
    </div>
  );
}

// ── États / modales auxiliaires ─────────────────────────────────────────────────
function EmptyInbox({ t, hasAgents }: { t: (fr: string, en: string) => string; hasAgents: boolean }) {
  return (
    <div className="card p-8 text-center">
      <p className="text-sm font-medium text-ink">{t("Boîte vide", "Empty inbox")}</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted">
        {hasAgents
          ? t(
              "Cliquez « Synchroniser Meta » pour importer les commentaires de votre Page, ou « Simuler un message » pour tester.",
              "Click “Sync Meta” to import your Page comments, or “Simulate a message” to test."
            )
          : t(
              "Commencez par créer un agent ci-dessus, puis synchronisez vos messages.",
              "Start by creating an agent above, then sync your messages."
            )}
      </p>
    </div>
  );
}

function SimulateModal({
  open,
  onClose,
  companyId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  companyId: string;
  onCreated: () => void;
}) {
  const t = useT();
  const [channel, setChannel] = useState<InboxChannel>("facebook");
  const [authorName, setAuthorName] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/inbox/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          channel,
          text: text.trim(),
          authorName: authorName.trim() || "Visiteur",
          kind: "comment",
        }),
      });
      setText("");
      setAuthorName("");
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-ink">{t("Simuler un message entrant", "Simulate an incoming message")}</h3>
        <p className="mt-0.5 text-2xs text-muted">
          {t("Pour tester vos agents sans connexion réelle.", "To test your agents without a live connection.")}
        </p>
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <select value={channel} onChange={(e) => setChannel(e.target.value as InboxChannel)} className="rounded-lg border border-hair bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400">
              {(["facebook", "instagram", "linkedin", "telegram", "twitter"] as InboxChannel[]).map((c) => (
                <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
              ))}
            </select>
            <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder={t("Auteur", "Author")} className="rounded-lg border border-hair bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400" />
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={t("Le message reçu…", "The received message…")} className="w-full rounded-lg border border-hair bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm">{t("Annuler", "Cancel")}</button>
          <button onClick={create} disabled={saving || !text.trim()} className="btn-primary text-sm disabled:opacity-50">
            {saving ? t("Ajout…", "Adding…") : t("Ajouter", "Add")}
          </button>
        </div>
      </div>
    </div>
  );
}
