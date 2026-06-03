"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Toast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TelegramConfig {
  status: "connected" | "pending" | "disconnected";
  config: {
    bot_token?: string;        // "__secret__" si défini
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

// ── Composant principal ───────────────────────────────────────────────────────

export default function TelegramConfigPage() {
  const params = useParams();
  const t = useT();
  const id =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
      ? params.id[0]
      : "";

  // Config chargée
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Champs du formulaire
  const [botToken, setBotToken] = useState("");
  const [allowedChatIds, setAllowedChatIds] = useState("");
  const [testChatId, setTestChatId] = useState("");

  // État bot activé
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null);

  // Loaders
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [testing, setTesting] = useState(false);

  // Toast
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string) => {
    setToast({ message, key: Date.now() });
  }, []);

  // ── Chargement ───────────────────────────────────────────────────────────────

  const loadConfig = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/telegram/config?companyId=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(`${t("Erreur", "Error")} ${res.status}`);
      const data: TelegramConfig = await res.json();
      setTelegramConfig(data);
      // Ne pas pré-remplir le token (c'est un secret masqué)
      setAllowedChatIds(data.config.allowed_chat_ids ?? "");
    } catch (err) {
      console.error("[telegram/config] chargement:", err);
      setTelegramConfig({ status: "disconnected", config: {}, connected_at: null });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // ── Enregistrer la config ────────────────────────────────────────────────────

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
        showToast(`${t("Erreur :", "Error:")} ${data.error ?? res.status}`);
        return;
      }
      setTelegramConfig(data);
      setBotToken(""); // effacer après enregistrement
      showToast(t("Configuration enregistrée avec succès.", "Configuration saved successfully."));
    } catch (err) {
      showToast(`${t("Erreur :", "Error:")} ${err instanceof Error ? err.message : t("inconnue", "unknown")}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Activer le webhook ───────────────────────────────────────────────────────

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
        showToast(`${t("Erreur :", "Error:")} ${data.error ?? res.status}`);
        return;
      }
      setBotInfo(data);
      await loadConfig();
      showToast(t(`Bot @${data.username} activé avec succès !`, `Bot @${data.username} activated successfully!`));
    } catch (err) {
      showToast(`${t("Erreur :", "Error:")} ${err instanceof Error ? err.message : t("inconnue", "unknown")}`);
    } finally {
      setActivating(false);
    }
  };

  // ── Désactiver ───────────────────────────────────────────────────────────────

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
        showToast(`${t("Erreur :", "Error:")} ${data.error ?? res.status}`);
        return;
      }
      setBotInfo(null);
      await loadConfig();
      showToast(t("Bot désactivé et webhook supprimé.", "Bot deactivated and webhook removed."));
    } catch (err) {
      showToast(`${t("Erreur :", "Error:")} ${err instanceof Error ? err.message : t("inconnue", "unknown")}`);
    } finally {
      setDeactivating(false);
    }
  };

  // ── Envoyer un message test ──────────────────────────────────────────────────

  const handleTest = async () => {
    if (!id || !testChatId.trim()) {
      showToast(t("Entrez un Chat ID pour envoyer le message test.", "Enter a Chat ID to send the test message."));
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
        showToast(`${t("Erreur :", "Error:")} ${data.error ?? res.status}`);
        return;
      }
      showToast(t("Message test envoyé avec succès !", "Test message sent successfully!"));
    } catch (err) {
      showToast(`${t("Erreur :", "Error:")} ${err instanceof Error ? err.message : t("inconnue", "unknown")}`);
    } finally {
      setTesting(false);
    }
  };

  // ── Statut ───────────────────────────────────────────────────────────────────

  const isConnected = telegramConfig?.status === "connected";
  const hasToken = !!telegramConfig?.config.bot_token; // "__secret__" si défini

  // ── Rendu ─────────────────────────────────────────────────────────────────────

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
      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link href="/admin/comptes" className="hover:text-ink hover:underline underline-offset-2">
          {t("Comptes & entités", "Accounts & entities")}
        </Link>
        <span aria-hidden>/</span>
        <Link href={`/admin/comptes/${id}`} className="hover:text-ink hover:underline underline-offset-2">
          {t("Fiche entité", "Entity details")}
        </Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-ink">{t("Chatbot Telegram", "Telegram Chatbot")}</span>
      </div>

      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Icône Telegram */}
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
            <h1 className="text-xl font-bold text-ink">{t("Chatbot Telegram", "Telegram Chatbot")}</h1>
            <p className="text-sm text-muted">
              {t("Pilotez vos agents et campagnes depuis Telegram.", "Manage your agents and campaigns from Telegram.")}
            </p>
          </div>
        </div>
        <Link href={`/admin/comptes/${id}`} className="btn-secondary shrink-0 text-xs">
          ← {t("Fiche entité", "Entity details")}
        </Link>
      </div>

      {/* Statut */}
      <div
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
          isConnected
            ? "border-success-200 bg-success-50"
            : "border-hair bg-canvas"
        }`}
      >
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            isConnected ? "bg-success-500" : "bg-muted/40"
          }`}
          aria-hidden
        />
        <div className="text-sm">
          {isConnected ? (
            <>
              <span className="font-semibold text-success-700">{t("Bot connecté", "Bot connected")}</span>
              {botInfo && (
                <span className="ml-2 text-success-600">@{botInfo.username}</span>
              )}
              {telegramConfig?.config.webhook_url && (
                <span className="ml-2 font-mono text-xs text-muted">
                  {telegramConfig.config.webhook_url}
                </span>
              )}
              {telegramConfig?.connected_at && (
                <div className="mt-0.5 text-xs text-muted">
                  {t("Connecté le", "Connected on")}{" "}
                  {new Date(telegramConfig.connected_at).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              )}
            </>
          ) : (
            <span className="text-muted">{t("Non connecté", "Not connected")}</span>
          )}
        </div>
      </div>

      {/* Comment faire */}
      <div className="card p-5">
        <div className="section-label mb-3">{t("Comment configurer votre bot Telegram", "How to set up your Telegram bot")}</div>
        <ol className="space-y-2 text-sm text-ink">
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-2xs font-bold text-white">1</span>
            <span>
              {t("Ouvrez Telegram et démarrez une conversation avec", "Open Telegram and start a conversation with")}{" "}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline underline-offset-2 hover:no-underline"
              >
                @BotFather
              </a>
              .
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-2xs font-bold text-white">2</span>
            <span>
              {t("Envoyez", "Send")}{" "}
              <code className="rounded bg-canvas px-1 py-0.5 font-mono text-xs">/newbot</code>{" "}
              {t("et suivez les instructions pour nommer votre bot.", "and follow the instructions to name your bot.")}
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-2xs font-bold text-white">3</span>
            <span>
              {t("Copiez le", "Copy the")}{" "}
              <strong>{t("token API", "API token")}</strong>{" "}
              {t("fourni par @BotFather (format", "provided by @BotFather (format")}{" "}
              <code className="rounded bg-canvas px-1 py-0.5 font-mono text-xs">1234567890:ABCdef…</code>).
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-2xs font-bold text-white">4</span>
            <span>
              {t("Collez le token ci-dessous, puis cliquez sur", "Paste the token below, then click")}{" "}
              <strong>{t("Enregistrer", "Save")}</strong>{" "}
              {t("puis", "then")}{" "}
              <strong>{t("Activer le webhook", "Activate webhook")}</strong>.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-2xs font-bold text-white">5</span>
            <span>
              {t("Utilisez", "Use")}{" "}
              <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2 hover:no-underline">@userinfobot</a>{" "}
              {t("pour connaître votre Chat ID et restreindre l'accès si souhaité.", "to find your Chat ID and restrict access if desired.")}
            </span>
          </li>
        </ol>
      </div>

      {/* Formulaire de configuration */}
      <div className="card p-5">
        <div className="section-label mb-4">{t("Configuration du bot", "Bot configuration")}</div>
        <div className="space-y-4">
          {/* Token */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {t("Token du bot", "Bot token")}
              <span className="rounded bg-warning-50 px-1.5 py-0.5 text-2xs font-semibold text-warning-700">
                {t("secret", "secret")}
              </span>
            </label>
            <input
              type="password"
              className="input w-full"
              placeholder={
                hasToken
                  ? t(
                      "••••••••••••••••••• (déjà enregistré — laissez vide pour conserver)",
                      "••••••••••••••••••• (already saved — leave blank to keep)"
                    )
                  : "1234567890:ABCdef..."
              }
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-muted">
              {t(
                "Obtenu via @BotFather. Une fois enregistré, il n'est plus affiché en clair.",
                "Obtained via @BotFather. Once saved, it is no longer displayed in plain text."
              )}
            </p>
          </div>

          {/* Chat IDs autorisés */}
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
              {t(
                "IDs numériques séparés par des virgules. Laissez vide pour autoriser tout le monde.",
                "Numeric IDs separated by commas. Leave blank to allow everyone."
              )}{" "}
              {t("Utilisez", "Use")}{" "}
              <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">@userinfobot</a>{" "}
              {t("pour trouver votre ID.", "to find your ID.")}
            </p>
          </div>

          {/* Bouton Enregistrer */}
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t("Enregistrement…", "Saving…") : t("Enregistrer", "Save")}
          </button>
        </div>
      </div>

      {/* Activation du webhook */}
      <div className="card p-5">
        <div className="section-label mb-4">{t("Webhook", "Webhook")}</div>
        <p className="mb-4 text-sm text-muted">
          {t(
            "L'activation enregistre l'URL de webhook auprès de Telegram et met le bot en ligne. Un token secret est généré automatiquement pour sécuriser les échanges.",
            "Activation registers the webhook URL with Telegram and brings the bot online. A secret token is automatically generated to secure exchanges."
          )}
        </p>

        {isConnected ? (
          <div className="space-y-3">
            {telegramConfig?.config.webhook_url && (
              <div className="rounded-lg border border-hair bg-canvas px-3 py-2.5">
                <div className="text-xs text-muted">{t("URL du webhook", "Webhook URL")}</div>
                <div className="mt-0.5 break-all font-mono text-xs text-ink">
                  {telegramConfig.config.webhook_url}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button
                className="btn-primary"
                onClick={handleActivate}
                disabled={activating || !hasToken}
                title={t("Re-enregistrer le webhook (utile après un changement d'URL)", "Re-register the webhook (useful after a URL change)")}
              >
                {activating ? t("Re-activation…", "Re-activating…") : t("Re-activer", "Re-activate")}
              </button>
              <button
                className="btn-secondary"
                onClick={handleDeactivate}
                disabled={deactivating}
              >
                {deactivating ? t("Désactivation…", "Deactivating…") : t("Désactiver", "Deactivate")}
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn-primary"
            onClick={handleActivate}
            disabled={activating || !hasToken}
            title={!hasToken ? t("Enregistrez d'abord un token bot", "Save a bot token first") : undefined}
          >
            {activating ? t("Activation en cours…", "Activating…") : t("Activer le webhook", "Activate webhook")}
          </button>
        )}

        {!hasToken && (
          <p className="mt-2 text-xs text-danger">
            {t("Enregistrez d'abord un token bot avant d'activer.", "Save a bot token first before activating.")}
          </p>
        )}
      </div>

      {/* Message test */}
      {isConnected && (
        <div className="card p-5">
          <div className="section-label mb-4">{t("Message de test", "Test message")}</div>
          <p className="mb-3 text-sm text-muted">
            {t(
              "Envoyez un message test pour vérifier que le bot répond correctement.",
              "Send a test message to verify that the bot responds correctly."
            )}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              className="input flex-1"
              placeholder={t("Votre Chat ID (ex : 123456789)", "Your Chat ID (e.g. 123456789)")}
              value={testChatId}
              onChange={(e) => setTestChatId(e.target.value)}
            />
            <button
              className="btn-primary shrink-0"
              onClick={handleTest}
              disabled={testing || !testChatId.trim()}
            >
              {testing ? t("Envoi…", "Sending…") : t("Envoyer", "Send")}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {t("Utilisez", "Use")}{" "}
            <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">@userinfobot</a>{" "}
            {t("pour connaître votre Chat ID.", "to find your Chat ID.")}
          </p>
        </div>
      )}

      {/* Commandes disponibles */}
      <div className="card p-5">
        <div className="section-label mb-4">{t("Commandes Telegram disponibles", "Available Telegram commands")}</div>
        <div className="space-y-2">
          {[
            { cmd: "/start", desc: t("Affiche le message d'aide", "Displays the help message") },
            { cmd: "/aide", desc: t("Affiche le message d'aide", "Displays the help message") },
            { cmd: "/status", desc: t("Résumé du compte et objectif en cours", "Account summary and current objective") },
            { cmd: "/objectif <texte>", desc: t("Enregistre un objectif par défaut", "Saves a default objective") },
            { cmd: "/lancer <texte>", desc: t("Lance une orchestration multi-agent", "Launches a multi-agent orchestration") },
            { cmd: "/veille", desc: t("Déclenche une analyse de veille concurrentielle", "Triggers a competitive intelligence analysis") },
            { cmd: "<texte libre>", desc: t("Traité comme /lancer avec ce texte", "Treated as /lancer with this text") },
          ].map(({ cmd, desc }) => (
            <div
              key={cmd}
              className="flex items-start gap-3 rounded-lg border border-hair bg-canvas px-3 py-2.5"
            >
              <code className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-primary">
                {cmd}
              </code>
              <span className="text-sm text-ink">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast key={toast.key} message={toast.message} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
