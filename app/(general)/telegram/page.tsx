"use client";

import { useEffect, useState, useCallback } from "react";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { Toast } from "@/components/ui/Toast";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TelegramConfig {
  status: "connected" | "pending" | "disconnected";
  config: {
    bot_token?: string; // "__secret__" si défini
    allowed_chat_ids?: string;
    webhook_url?: string;
  };
  connected_at: string | null;
}

interface BotInfo {
  username: string;
  firstName: string;
  botId: number;
  webhookUrl: string;
}

interface ToastState {
  message: string;
  key: number;
}

// ── Page Telegram côté client ───────────────────────────────────────────────────
// Chaque compte/entité dispose de son propre bot Telegram. Le client configure
// ici son bot pour piloter ses agents et campagnes à la voix, jour et nuit.

export default function ClientTelegramPage() {
  const { company } = useCompany();
  const id = company.id;
  const t = useT();

  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const [botToken, setBotToken] = useState("");
  const [allowedChatIds, setAllowedChatIds] = useState("");
  const [testChatId, setTestChatId] = useState("");

  const [botInfo, setBotInfo] = useState<BotInfo | null>(null);

  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [testing, setTesting] = useState(false);

  const [toast, setToast] = useState<ToastState | null>(null);
  const showToast = useCallback((message: string) => {
    setToast({ message, key: Date.now() });
  }, []);

  // ── Chargement ─────────────────────────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/telegram/config?companyId=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data: TelegramConfig = await res.json();
      setTelegramConfig(data);
      setAllowedChatIds(data.config.allowed_chat_ids ?? "");
    } catch {
      setTelegramConfig({ status: "disconnected", config: {}, connected_at: null });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    loadConfig();
  }, [loadConfig]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const res = await fetch("/api/telegram/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: id,
          bot_token: botToken || undefined,
          allowed_chat_ids: allowedChatIds,
        }),
      });
      const data: TelegramConfig & { error?: string } = await res.json();
      if (!res.ok) {
        showToast(t(`Erreur : ${data.error ?? res.status}`, `Error: ${data.error ?? res.status}`));
        return;
      }
      setTelegramConfig(data);
      setBotToken("");
      showToast(t("Configuration enregistrée.", "Configuration saved."));
    } catch (err) {
      showToast(t(`Erreur : ${err instanceof Error ? err.message : "inconnue"}`, `Error: ${err instanceof Error ? err.message : "unknown"}`));
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async () => {
    if (!id) return;
    setActivating(true);
    try {
      const res = await fetch("/api/telegram/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: id }),
      });
      const data: BotInfo & { error?: string } = await res.json();
      if (!res.ok) {
        showToast(t(`Erreur : ${data.error ?? res.status}`, `Error: ${data.error ?? res.status}`));
        return;
      }
      setBotInfo(data);
      await loadConfig();
      showToast(t(`Bot @${data.username} activé !`, `Bot @${data.username} activated!`));
    } catch (err) {
      showToast(t(`Erreur : ${err instanceof Error ? err.message : "inconnue"}`, `Error: ${err instanceof Error ? err.message : "unknown"}`));
    } finally {
      setActivating(false);
    }
  };

  const handleDeactivate = async () => {
    if (!id) return;
    setDeactivating(true);
    try {
      const res = await fetch("/api/telegram/activate", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: id }),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        showToast(t(`Erreur : ${data.error ?? res.status}`, `Error: ${data.error ?? res.status}`));
        return;
      }
      setBotInfo(null);
      await loadConfig();
      showToast(t("Bot désactivé.", "Bot deactivated."));
    } catch (err) {
      showToast(t(`Erreur : ${err instanceof Error ? err.message : "inconnue"}`, `Error: ${err instanceof Error ? err.message : "unknown"}`));
    } finally {
      setDeactivating(false);
    }
  };

  const handleTest = async () => {
    if (!id || !testChatId.trim()) {
      showToast(t("Entrez un Chat ID pour le test.", "Enter a Chat ID to test."));
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: id, chatId: testChatId.trim() }),
      });
      const data: { ok?: boolean; error?: string } = await res.json();
      if (!res.ok || !data.ok) {
        showToast(t(`Erreur : ${data.error ?? res.status}`, `Error: ${data.error ?? res.status}`));
        return;
      }
      showToast(t("Message test envoyé !", "Test message sent!"));
    } catch (err) {
      showToast(t(`Erreur : ${err instanceof Error ? err.message : "inconnue"}`, `Error: ${err instanceof Error ? err.message : "unknown"}`));
    } finally {
      setTesting(false);
    }
  };

  const isConnected = telegramConfig?.status === "connected";
  const hasToken = !!telegramConfig?.config.bot_token;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <svg className="h-5 w-5 animate-spin text-muted" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="ml-3 text-sm text-muted">{t("Chargement…", "Loading…")}</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* En-tête */}
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: "#229ED9" }}
          aria-hidden
        >
          <svg viewBox="0 0 24 24" fill="white" width="22" height="22">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
          </svg>
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">
            {t("Chatbot Telegram", "Telegram Chatbot")}
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            {t(
              `Pilotez tous les agents et campagnes de « ${company.name} » directement depuis Telegram, à la voix ou au texte, jour et nuit.`,
              `Pilot all agents and campaigns for “${company.name}” straight from Telegram, by voice or text, day and night.`
            )}
          </p>
        </div>
      </div>

      {/* Statut */}
      <div
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
          isConnected ? "border-success-200 bg-success-50" : "border-hair bg-canvas"
        }`}
      >
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${isConnected ? "bg-success-500" : "bg-muted/40"}`}
          aria-hidden
        />
        <div className="text-sm">
          {isConnected ? (
            <>
              <span className="font-semibold text-success-700">{t("Bot connecté", "Bot connected")}</span>
              {(botInfo?.username) && <span className="ml-2 text-success-600">@{botInfo.username}</span>}
              {telegramConfig?.connected_at && (
                <div className="mt-0.5 text-xs text-muted">
                  {t("Connecté le ", "Connected on ")}
                  {new Date(telegramConfig.connected_at).toLocaleDateString(t("fr-FR", "en-US"), {
                    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </div>
              )}
            </>
          ) : (
            <span className="text-muted">{t("Non connecté — suivez les 5 étapes ci-dessous.", "Not connected — follow the 5 steps below.")}</span>
          )}
        </div>
      </div>

      {/* Comment faire */}
      <div className="card p-5">
        <div className="section-label mb-3">{t("Configurer votre bot en 5 étapes", "Set up your bot in 5 steps")}</div>
        <ol className="space-y-2.5 text-sm text-ink">
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-2xs font-bold text-white">1</span>
            <span>
              {t("Ouvrez Telegram et démarrez une conversation avec ", "Open Telegram and start a chat with ")}
              <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2 hover:no-underline">@BotFather</a>.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-2xs font-bold text-white">2</span>
            <span>
              {t("Envoyez ", "Send ")}<code className="rounded bg-canvas px-1 py-0.5 font-mono text-xs">/newbot</code>
              {t(" puis suivez les instructions pour nommer votre bot.", " then follow the instructions to name your bot.")}
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-2xs font-bold text-white">3</span>
            <span>
              {t("Copiez le ", "Copy the ")}<strong>{t("token API", "API token")}</strong>
              {t(" fourni (format ", " provided (format ")}<code className="rounded bg-canvas px-1 py-0.5 font-mono text-xs">1234567890:ABCdef…</code>).
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-2xs font-bold text-white">4</span>
            <span>
              {t("Collez le token ci-dessous, cliquez sur ", "Paste the token below, click ")}
              <strong>{t("Enregistrer", "Save")}</strong>{t(" puis ", " then ")}<strong>{t("Activer le webhook", "Activate webhook")}</strong>.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-2xs font-bold text-white">5</span>
            <span>
              {t("Récupérez votre Chat ID via ", "Get your Chat ID via ")}
              <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2 hover:no-underline">@userinfobot</a>
              {t(" et envoyez un message test.", " and send a test message.")}
            </span>
          </li>
        </ol>
      </div>

      {/* Configuration */}
      <div className="card p-5">
        <div className="section-label mb-4">{t("Configuration du bot", "Bot configuration")}</div>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {t("Token du bot", "Bot token")}
              <span className="rounded bg-warning-50 px-1.5 py-0.5 text-2xs font-semibold text-warning-700">{t("secret", "secret")}</span>
            </label>
            <input
              type="password"
              className="input w-full"
              placeholder={hasToken
                ? t("••••••••• (déjà enregistré — laissez vide pour conserver)", "••••••••• (already saved — leave empty to keep)")
                : "1234567890:ABCdef..."}
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-muted">
              {t("Obtenu via @BotFather. Une fois enregistré, il n'est plus affiché en clair.", "Obtained via @BotFather. Once saved, it is never shown in clear text again.")}
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              {t("Chat IDs autorisés", "Allowed Chat IDs")}{" "}
              <span className="font-normal normal-case text-muted/70">({t("optionnel", "optional")})</span>
            </label>
            <input
              type="text"
              className="input w-full"
              placeholder="123456789, -987654321"
              value={allowedChatIds}
              onChange={(e) => setAllowedChatIds(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted">
              {t("IDs numériques séparés par des virgules. Vide = tout le monde autorisé.", "Numeric IDs separated by commas. Empty = everyone allowed.")}
            </p>
          </div>

          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? t("Enregistrement…", "Saving…") : t("Enregistrer", "Save")}
          </button>
        </div>
      </div>

      {/* Webhook */}
      <div className="card p-5">
        <div className="section-label mb-4">{t("Mise en ligne (webhook)", "Go live (webhook)")}</div>
        <p className="mb-4 text-sm text-muted">
          {t(
            "L'activation enregistre le webhook auprès de Telegram et met votre bot en ligne. Un secret est généré automatiquement pour sécuriser les échanges.",
            "Activation registers the webhook with Telegram and brings your bot online. A secret is generated automatically to secure exchanges."
          )}
        </p>
        {isConnected ? (
          <div className="flex gap-2">
            <button className="btn-primary" onClick={handleActivate} disabled={activating || !hasToken}>
              {activating ? t("Ré-activation…", "Re-activating…") : t("Ré-activer", "Re-activate")}
            </button>
            <button className="btn-secondary" onClick={handleDeactivate} disabled={deactivating}>
              {deactivating ? t("Désactivation…", "Deactivating…") : t("Désactiver", "Deactivate")}
            </button>
          </div>
        ) : (
          <button className="btn-primary" onClick={handleActivate} disabled={activating || !hasToken}
            title={!hasToken ? t("Enregistrez d'abord un token", "Save a token first") : undefined}>
            {activating ? t("Activation…", "Activating…") : t("Activer le webhook", "Activate webhook")}
          </button>
        )}
        {!hasToken && (
          <p className="mt-2 text-xs text-danger">{t("Enregistrez d'abord un token bot avant d'activer.", "Save a bot token before activating.")}</p>
        )}
      </div>

      {/* Message test */}
      {isConnected && (
        <div className="card p-5">
          <div className="section-label mb-4">{t("Message de test", "Test message")}</div>
          <div className="flex gap-2">
            <input
              type="text"
              className="input flex-1"
              placeholder={t("Votre Chat ID (ex : 123456789)", "Your Chat ID (e.g. 123456789)")}
              value={testChatId}
              onChange={(e) => setTestChatId(e.target.value)}
            />
            <button className="btn-primary shrink-0" onClick={handleTest} disabled={testing || !testChatId.trim()}>
              {testing ? t("Envoi…", "Sending…") : t("Envoyer", "Send")}
            </button>
          </div>
        </div>
      )}

      {/* Commandes */}
      <div className="card p-5">
        <div className="section-label mb-4">{t("Commandes disponibles", "Available commands")}</div>
        <div className="space-y-2">
          {[
            { cmd: "/start", fr: "Affiche le message d'aide", en: "Show the help message" },
            { cmd: "/status", fr: "Résumé du compte et objectif en cours", en: "Account summary and current objective" },
            { cmd: "/objectif <texte>", fr: "Enregistre un objectif par défaut", en: "Set a default objective" },
            { cmd: "/lancer <texte>", fr: "Lance une orchestration multi-agent", en: "Launch a multi-agent orchestration" },
            { cmd: "/veille", fr: "Déclenche une analyse de veille concurrentielle", en: "Trigger a competitive market-watch analysis" },
            { cmd: "<texte libre>", fr: "Traité comme /lancer avec ce texte", en: "Treated as /lancer with that text" },
          ].map(({ cmd, fr, en }) => (
            <div key={cmd} className="flex items-start gap-3 rounded-lg border border-hair bg-canvas px-3 py-2.5">
              <code className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-primary">{cmd}</code>
              <span className="text-sm text-ink">{t(fr, en)}</span>
            </div>
          ))}
        </div>
      </div>

      {toast && <Toast key={toast.key} message={toast.message} onDismiss={() => setToast(null)} />}
    </div>
  );
}
