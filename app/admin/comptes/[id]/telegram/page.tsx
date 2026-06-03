"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Toast } from "@/components/ui/Toast";

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
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
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
        showToast(`Erreur : ${data.error ?? res.status}`);
        return;
      }
      setTelegramConfig(data);
      setBotToken(""); // effacer après enregistrement
      showToast("Configuration enregistrée avec succès.");
    } catch (err) {
      showToast(`Erreur : ${err instanceof Error ? err.message : "inconnue"}`);
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
        showToast(`Erreur : ${data.error ?? res.status}`);
        return;
      }
      setBotInfo(data);
      await loadConfig();
      showToast(`Bot @${data.username} activé avec succès !`);
    } catch (err) {
      showToast(`Erreur : ${err instanceof Error ? err.message : "inconnue"}`);
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
        showToast(`Erreur : ${data.error ?? res.status}`);
        return;
      }
      setBotInfo(null);
      await loadConfig();
      showToast("Bot désactivé et webhook supprimé.");
    } catch (err) {
      showToast(`Erreur : ${err instanceof Error ? err.message : "inconnue"}`);
    } finally {
      setDeactivating(false);
    }
  };

  // ── Envoyer un message test ──────────────────────────────────────────────────

  const handleTest = async () => {
    if (!id || !testChatId.trim()) {
      showToast("Entrez un Chat ID pour envoyer le message test.");
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
        showToast(`Erreur : ${data.error ?? res.status}`);
        return;
      }
      showToast("Message test envoyé avec succès !");
    } catch (err) {
      showToast(`Erreur : ${err instanceof Error ? err.message : "inconnue"}`);
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
        <span className="ml-3 text-sm text-muted">Chargement…</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link href="/admin/comptes" className="hover:text-ink hover:underline underline-offset-2">
          Comptes & entités
        </Link>
        <span aria-hidden>/</span>
        <Link href={`/admin/comptes/${id}`} className="hover:text-ink hover:underline underline-offset-2">
          Fiche entité
        </Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-ink">Chatbot Telegram</span>
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
            <h1 className="text-xl font-bold text-ink">Chatbot Telegram</h1>
            <p className="text-sm text-muted">
              Pilotez vos agents et campagnes depuis Telegram.
            </p>
          </div>
        </div>
        <Link href={`/admin/comptes/${id}`} className="btn-secondary shrink-0 text-xs">
          ← Fiche entité
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
              <span className="font-semibold text-success-700">Bot connecté</span>
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
                  Connecté le{" "}
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
            <span className="text-muted">Non connecté</span>
          )}
        </div>
      </div>

      {/* Comment faire */}
      <div className="card p-5">
        <div className="section-label mb-3">Comment configurer votre bot Telegram</div>
        <ol className="space-y-2 text-sm text-ink">
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-2xs font-bold text-white">1</span>
            <span>
              Ouvrez Telegram et démarrez une conversation avec{" "}
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
              Envoyez <code className="rounded bg-canvas px-1 py-0.5 font-mono text-xs">/newbot</code> et suivez les instructions pour nommer votre bot.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-2xs font-bold text-white">3</span>
            <span>
              Copiez le <strong>token API</strong> fourni par @BotFather (format{" "}
              <code className="rounded bg-canvas px-1 py-0.5 font-mono text-xs">1234567890:ABCdef…</code>).
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-2xs font-bold text-white">4</span>
            <span>
              Collez le token ci-dessous, puis cliquez sur{" "}
              <strong>Enregistrer</strong> puis <strong>Activer le webhook</strong>.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-2xs font-bold text-white">5</span>
            <span>
              Utilisez <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2 hover:no-underline">@userinfobot</a>{" "}
              pour connaître votre Chat ID et restreindre l'accès si souhaité.
            </span>
          </li>
        </ol>
      </div>

      {/* Formulaire de configuration */}
      <div className="card p-5">
        <div className="section-label mb-4">Configuration du bot</div>
        <div className="space-y-4">
          {/* Token */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Token du bot
              <span className="rounded bg-warning-50 px-1.5 py-0.5 text-2xs font-semibold text-warning-700">
                secret
              </span>
            </label>
            <input
              type="password"
              className="input w-full"
              placeholder={
                hasToken
                  ? "••••••••••••••••••• (déjà enregistré — laissez vide pour conserver)"
                  : "1234567890:ABCdef..."
              }
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-muted">
              Obtenu via @BotFather. Une fois enregistré, il n'est plus affiché en clair.
            </p>
          </div>

          {/* Chat IDs autorisés */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Chat IDs autorisés{" "}
              <span className="font-normal normal-case text-muted/70">(optionnel)</span>
            </label>
            <input
              type="text"
              className="input w-full"
              placeholder="123456789, -987654321"
              value={allowedChatIds}
              onChange={(e) => setAllowedChatIds(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted">
              IDs numériques séparés par des virgules. Laissez vide pour autoriser tout le monde.
              Utilisez <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">@userinfobot</a> pour trouver votre ID.
            </p>
          </div>

          {/* Bouton Enregistrer */}
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>

      {/* Activation du webhook */}
      <div className="card p-5">
        <div className="section-label mb-4">Webhook</div>
        <p className="mb-4 text-sm text-muted">
          L'activation enregistre l'URL de webhook auprès de Telegram et met le bot en ligne.
          Un token secret est généré automatiquement pour sécuriser les échanges.
        </p>

        {isConnected ? (
          <div className="space-y-3">
            {telegramConfig?.config.webhook_url && (
              <div className="rounded-lg border border-hair bg-canvas px-3 py-2.5">
                <div className="text-xs text-muted">URL du webhook</div>
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
                title="Re-enregistrer le webhook (utile après un changement d'URL)"
              >
                {activating ? "Re-activation…" : "Re-activer"}
              </button>
              <button
                className="btn-secondary"
                onClick={handleDeactivate}
                disabled={deactivating}
              >
                {deactivating ? "Désactivation…" : "Désactiver"}
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn-primary"
            onClick={handleActivate}
            disabled={activating || !hasToken}
            title={!hasToken ? "Enregistrez d'abord un token bot" : undefined}
          >
            {activating ? "Activation en cours…" : "Activer le webhook"}
          </button>
        )}

        {!hasToken && (
          <p className="mt-2 text-xs text-danger">
            Enregistrez d'abord un token bot avant d'activer.
          </p>
        )}
      </div>

      {/* Message test */}
      {isConnected && (
        <div className="card p-5">
          <div className="section-label mb-4">Message de test</div>
          <p className="mb-3 text-sm text-muted">
            Envoyez un message test pour vérifier que le bot répond correctement.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              className="input flex-1"
              placeholder="Votre Chat ID (ex : 123456789)"
              value={testChatId}
              onChange={(e) => setTestChatId(e.target.value)}
            />
            <button
              className="btn-primary shrink-0"
              onClick={handleTest}
              disabled={testing || !testChatId.trim()}
            >
              {testing ? "Envoi…" : "Envoyer"}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            Utilisez <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">@userinfobot</a> pour connaître votre Chat ID.
          </p>
        </div>
      )}

      {/* Commandes disponibles */}
      <div className="card p-5">
        <div className="section-label mb-4">Commandes Telegram disponibles</div>
        <div className="space-y-2">
          {[
            { cmd: "/start", desc: "Affiche le message d'aide" },
            { cmd: "/aide", desc: "Affiche le message d'aide" },
            { cmd: "/status", desc: "Résumé du compte et objectif en cours" },
            { cmd: "/objectif <texte>", desc: "Enregistre un objectif par défaut" },
            { cmd: "/lancer <texte>", desc: "Lance une orchestration multi-agent" },
            { cmd: "/veille", desc: "Déclenche une analyse de veille concurrentielle" },
            { cmd: "<texte libre>", desc: "Traité comme /lancer avec ce texte" },
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
