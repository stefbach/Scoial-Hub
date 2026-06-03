"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Stepper } from "@/components/admin/Stepper";
import { NetworkToggle, NetworksState, NetworkId } from "@/components/admin/NetworkToggle";
import { Toast } from "@/components/ui/Toast";
import { PRO_PROFILES } from "@/lib/agents/profiles";

// ── Types internes du wizard ─────────────────────────────────────────────────

interface Step1Data {
  name: string;
  code: string;
  profilId: string;
  brandVoice: string;
  accent: string;
}

interface NetworkObjective {
  objectif: string;
}

interface AlertConfig {
  budgetSeuil: string;
  cpaMax: string;
  engagementChute: string;
  alertesLibres: string;
}

interface Step3Data {
  objectifGlobal: string;
  objectifsReseau: Record<NetworkId, NetworkObjective>;
  alertes: AlertConfig;
}

// ── Constantes ───────────────────────────────────────────────────────────────

const WIZARD_STEPS = [
  { label: "Entité" },
  { label: "Réseaux" },
  { label: "Objectifs" },
  { label: "Récapitulatif" },
];

const NETWORKS: NetworkId[] = ["facebook", "instagram", "linkedin"];

const NETWORK_LABELS: Record<NetworkId, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
};

const ACCENT_PRESETS = [
  "#1e3a5f",
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#db2777",
  "#0891b2",
];

function slugify(str: string): string {
  return str
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

// ── Composants de chaque étape ────────────────────────────────────────────────

function Step1Entity({
  data,
  onChange,
}: {
  data: Step1Data;
  onChange: (d: Step1Data) => void;
}) {
  function handleNameBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (!data.code && e.target.value) {
      onChange({ ...data, code: slugify(e.target.value) });
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-base font-semibold text-ink">Informations de l'entité</h2>
        <p className="mt-0.5 text-sm text-muted">
          Nommez et configurez l'identité de ce compte.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Nom */}
        <div className="sm:col-span-2">
          <label className="section-label mb-1.5 block" htmlFor="ent-name">
            Nom du compte <span className="text-danger-600">*</span>
          </label>
          <input
            id="ent-name"
            type="text"
            placeholder="Ex : Clinique du Soleil"
            value={data.name}
            onBlur={handleNameBlur}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
            className="input w-full"
            autoFocus
          />
        </div>

        {/* Code */}
        <div>
          <label className="section-label mb-1.5 block" htmlFor="ent-code">
            Code court <span className="text-danger-600">*</span>
          </label>
          <input
            id="ent-code"
            type="text"
            placeholder="Ex : CDS"
            maxLength={6}
            value={data.code}
            onChange={(e) => onChange({ ...data, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
            className="input w-full font-mono uppercase"
          />
          <p className="mt-1 text-xs text-muted">
            Identifiant court (2–6 caractères), auto-suggéré depuis le nom.
          </p>
        </div>

        {/* Couleur d'accent */}
        <div>
          <label className="section-label mb-1.5 block">Couleur d'accent</label>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENT_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                title={color}
                onClick={() => onChange({ ...data, accent: color })}
                className={[
                  "h-7 w-7 rounded-full border-2 transition-all",
                  data.accent === color
                    ? "border-ink scale-110 shadow-md"
                    : "border-transparent hover:scale-105",
                ].join(" ")}
                style={{ backgroundColor: color }}
                aria-label={`Choisir la couleur ${color}`}
              />
            ))}
            <input
              type="color"
              value={data.accent}
              onChange={(e) => onChange({ ...data, accent: e.target.value })}
              className="h-7 w-7 cursor-pointer rounded-full border border-hair bg-transparent p-0.5"
              title="Couleur personnalisée"
            />
          </div>
        </div>
      </div>

      {/* Profil professionnel */}
      <div>
        <label className="section-label mb-2 block">Profil professionnel</label>
        <div className="grid gap-2 sm:grid-cols-2">
          {PRO_PROFILES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange({ ...data, profilId: p.id })}
              className={[
                "rounded-xl border p-3 text-left transition-all duration-150",
                data.profilId === p.id
                  ? "border-page bg-page/5 ring-2 ring-page"
                  : "border-hair bg-card hover:border-page/30 hover:bg-canvas",
              ].join(" ")}
            >
              <div className="text-sm font-semibold text-ink">{p.label}</div>
              <div className="mt-0.5 line-clamp-2 text-xs text-muted">{p.description}</div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {p.priorityPlatforms.slice(0, 3).map((pl) => (
                  <span key={pl} className="chip text-2xs">
                    {pl}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Brand voice */}
      <div>
        <label className="section-label mb-1.5 block" htmlFor="ent-brandvoice">
          Brand voice
        </label>
        <textarea
          id="ent-brandvoice"
          rows={3}
          placeholder="Ex : Ton chaleureux, accessible, expert. Communication orientée patient et proximité locale."
          value={data.brandVoice}
          onChange={(e) => onChange({ ...data, brandVoice: e.target.value })}
          className="input w-full resize-none"
        />
        <p className="mt-1 text-xs text-muted">
          Décrivez le ton, le style et les valeurs communicationnelles de ce compte.
        </p>
      </div>
    </div>
  );
}

function Step2Networks({
  networks,
  onChange,
}: {
  networks: NetworksState;
  onChange: (n: NetworksState) => void;
}) {
  const anyEnabled = NETWORKS.some((n) => networks[n].enabled);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-base font-semibold text-ink">Réseaux & canaux</h2>
        <p className="mt-0.5 text-sm text-muted">
          Activez les réseaux à piloter et configurez les canaux associés.
        </p>
      </div>

      {!anyEnabled && (
        <div className="rounded-xl border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          Activez au moins un réseau pour continuer.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {NETWORKS.map((net) => (
          <NetworkToggle
            key={net}
            network={net}
            config={networks[net]}
            onChange={(cfg) => onChange({ ...networks, [net]: cfg })}
          />
        ))}
      </div>

      <div className="rounded-xl border border-hair bg-canvas p-4 text-xs text-muted">
        <strong className="text-ink">Note :</strong> Les comptes réseaux seront connectés dans l'écran
        «&nbsp;Connecteurs&nbsp;» après la création. Cette étape configure les canaux activés dans le
        moteur de pilotage.
      </div>
    </div>
  );
}

function Step3Objectives({
  data,
  networks,
  onChange,
}: {
  data: Step3Data;
  networks: NetworksState;
  onChange: (d: Step3Data) => void;
}) {
  const activeNets = NETWORKS.filter((n) => networks[n].enabled);

  function updateNetObj(net: NetworkId, val: string) {
    onChange({
      ...data,
      objectifsReseau: {
        ...data.objectifsReseau,
        [net]: { objectif: val },
      },
    });
  }

  function updateAlertes(field: keyof AlertConfig, val: string) {
    onChange({ ...data, alertes: { ...data.alertes, [field]: val } });
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-base font-semibold text-ink">Objectifs & consignes d'alerte</h2>
        <p className="mt-0.5 text-sm text-muted">
          Définissez les objectifs stratégiques et les seuils de surveillance pour l'agent de pilotage.
        </p>
      </div>

      {/* Objectif global */}
      <div className="card p-4">
        <label className="section-label mb-2 block" htmlFor="obj-global">
          Objectif global du compte
        </label>
        <textarea
          id="obj-global"
          rows={3}
          placeholder="Ex : Accroître la notoriété locale, générer des leads qualifiés dans un rayon de 15 km, atteindre 500 nouveaux patients en 90 jours."
          value={data.objectifGlobal}
          onChange={(e) => onChange({ ...data, objectifGlobal: e.target.value })}
          className="input w-full resize-none"
        />
      </div>

      {/* Objectifs par réseau */}
      {activeNets.length > 0 && (
        <div>
          <div className="section-label mb-2">Objectifs par réseau</div>
          <div className="space-y-3">
            {activeNets.map((net) => (
              <div key={net} className="card p-4">
                <label
                  className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-ink"
                  htmlFor={`obj-net-${net}`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        net === "facebook"
                          ? "#1877f2"
                          : net === "instagram"
                          ? "#e1306c"
                          : "#0a66c2",
                    }}
                  />
                  {NETWORK_LABELS[net]}
                </label>
                <textarea
                  id={`obj-net-${net}`}
                  rows={2}
                  placeholder={`Objectif spécifique pour ${NETWORK_LABELS[net]}…`}
                  value={data.objectifsReseau[net]?.objectif ?? ""}
                  onChange={(e) => updateNetObj(net, e.target.value)}
                  className="input w-full resize-none"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Consignes d'alerte */}
      <div className="card p-4">
        <div className="section-label mb-3">Consignes d'alerte</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink" htmlFor="alerte-budget">
              Seuil budget (€/mois)
            </label>
            <input
              id="alerte-budget"
              type="number"
              min={0}
              placeholder="Ex : 2000"
              value={data.alertes.budgetSeuil}
              onChange={(e) => updateAlertes("budgetSeuil", e.target.value)}
              className="input w-full"
            />
            <p className="mt-0.5 text-2xs text-muted">Alerte si dépense dépasse ce seuil</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink" htmlFor="alerte-cpa">
              CPA max (€)
            </label>
            <input
              id="alerte-cpa"
              type="number"
              min={0}
              placeholder="Ex : 45"
              value={data.alertes.cpaMax}
              onChange={(e) => updateAlertes("cpaMax", e.target.value)}
              className="input w-full"
            />
            <p className="mt-0.5 text-2xs text-muted">Alerte si coût par acquisition dépasse</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink" htmlFor="alerte-engagement">
              Chute engagement (%)
            </label>
            <input
              id="alerte-engagement"
              type="number"
              min={0}
              max={100}
              placeholder="Ex : 30"
              value={data.alertes.engagementChute}
              onChange={(e) => updateAlertes("engagementChute", e.target.value)}
              className="input w-full"
            />
            <p className="mt-0.5 text-2xs text-muted">Alerte si baisse relative d'engagement</p>
          </div>
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor="alertes-libres">
            Consignes libres pour l'agent
          </label>
          <textarea
            id="alertes-libres"
            rows={3}
            placeholder="Ex : Bloquer toute dépense non approuvée le week-end. Alerter si CTR < 0.8% pendant 3 jours consécutifs. Ne jamais dépasser 150€/jour de budget publicitaire."
            value={data.alertes.alertesLibres}
            onChange={(e) => updateAlertes("alertesLibres", e.target.value)}
            className="input w-full resize-none"
          />
        </div>
      </div>
    </div>
  );
}

function Step4Summary({
  step1,
  networks,
  step3,
}: {
  step1: Step1Data;
  networks: NetworksState;
  step3: Step3Data;
}) {
  const profil = PRO_PROFILES.find((p) => p.id === step1.profilId);
  const activeNets = NETWORKS.filter((n) => networks[n].enabled);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-base font-semibold text-ink">Récapitulatif</h2>
        <p className="mt-0.5 text-sm text-muted">
          Vérifiez les informations avant de créer le compte.
        </p>
      </div>

      {/* Entité */}
      <div className="card p-4">
        <div className="section-label mb-3">Entité</div>
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
            style={{ backgroundColor: step1.accent || "#1e3a5f" }}
          >
            {step1.code}
          </span>
          <div>
            <div className="font-semibold text-ink">{step1.name}</div>
            {profil && (
              <div className="mt-0.5 text-xs text-muted">{profil.label}</div>
            )}
          </div>
        </div>
        {step1.brandVoice && (
          <p className="mt-3 border-t border-hair pt-3 text-sm text-muted italic">
            &laquo;&nbsp;{step1.brandVoice}&nbsp;&raquo;
          </p>
        )}
      </div>

      {/* Réseaux */}
      <div className="card p-4">
        <div className="section-label mb-3">Réseaux activés</div>
        {activeNets.length === 0 ? (
          <p className="text-sm text-muted italic">Aucun réseau activé.</p>
        ) : (
          <div className="space-y-2">
            {activeNets.map((net) => {
              const cfg = networks[net];
              return (
                <div key={net} className="flex items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        net === "facebook"
                          ? "#1877f2"
                          : net === "instagram"
                          ? "#e1306c"
                          : "#0a66c2",
                    }}
                  />
                  <span className="text-sm font-medium text-ink">{NETWORK_LABELS[net]}</span>
                  <div className="flex gap-1.5">
                    {cfg.organic && <span className="chip">Organique</span>}
                    {cfg.ads && <span className="chip">Ads</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Objectifs */}
      {step3.objectifGlobal && (
        <div className="card p-4">
          <div className="section-label mb-2">Objectif global</div>
          <p className="text-sm text-ink">{step3.objectifGlobal}</p>
        </div>
      )}

      {/* Alertes */}
      {(step3.alertes.budgetSeuil ||
        step3.alertes.cpaMax ||
        step3.alertes.engagementChute ||
        step3.alertes.alertesLibres) && (
        <div className="card p-4">
          <div className="section-label mb-3">Consignes d'alerte</div>
          <div className="space-y-1.5 text-sm">
            {step3.alertes.budgetSeuil && (
              <div className="flex gap-2">
                <span className="text-muted">Seuil budget :</span>
                <span className="font-medium text-ink">{step3.alertes.budgetSeuil} €/mois</span>
              </div>
            )}
            {step3.alertes.cpaMax && (
              <div className="flex gap-2">
                <span className="text-muted">CPA max :</span>
                <span className="font-medium text-ink">{step3.alertes.cpaMax} €</span>
              </div>
            )}
            {step3.alertes.engagementChute && (
              <div className="flex gap-2">
                <span className="text-muted">Chute engagement :</span>
                <span className="font-medium text-ink">−{step3.alertes.engagementChute} %</span>
              </div>
            )}
            {step3.alertes.alertesLibres && (
              <p className="mt-2 text-xs text-muted italic">{step3.alertes.alertesLibres}</p>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-page">
        <strong>Phase 1 :</strong> L'entité sera créée en base via l'API. La configuration réseaux,
        objectifs et alertes sera stockée localement (<code className="font-mono text-xs">sh_entity_config_&lt;id&gt;</code>).
        La persistance complète en base arrivera en Phase 2.
      </div>
    </div>
  );
}

// ── Page principale du wizard ─────────────────────────────────────────────────

export default function NouveauComptePage() {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [createdEntity, setCreatedEntity] = useState<{ id: string; name: string } | null>(null);

  // Données de chaque étape
  const [step1, setStep1] = useState<Step1Data>({
    name: "",
    code: "",
    profilId: PRO_PROFILES[0].id,
    brandVoice: "",
    accent: "#1e3a5f",
  });

  const [networks, setNetworks] = useState<NetworksState>({
    facebook: { enabled: false, organic: true, ads: false },
    instagram: { enabled: false, organic: true, ads: false },
    linkedin: { enabled: false, organic: true, ads: false },
  });

  const [step3, setStep3] = useState<Step3Data>({
    objectifGlobal: "",
    objectifsReseau: {
      facebook: { objectif: "" },
      instagram: { objectif: "" },
      linkedin: { objectif: "" },
    },
    alertes: {
      budgetSeuil: "",
      cpaMax: "",
      engagementChute: "",
      alertesLibres: "",
    },
  });

  // ── Validation par étape ────────────────────────────────────────────────────

  function validateStep(): string | null {
    if (step === 0) {
      if (!step1.name.trim()) return "Le nom du compte est requis.";
      if (!step1.code.trim()) return "Le code court est requis.";
      if (step1.code.length < 2) return "Le code doit contenir au moins 2 caractères.";
    }
    if (step === 1) {
      const anyEnabled = NETWORKS.some((n) => networks[n].enabled);
      if (!anyEnabled) return "Activez au moins un réseau pour continuer.";
    }
    return null;
  }

  function handleNext() {
    const err = validateStep();
    if (err) {
      setToast(err);
      return;
    }
    setStep((s) => s + 1);
  }

  function handleBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  // ── Création ────────────────────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: step1.name.trim(),
          code: step1.code.trim(),
          brandVoice: step1.brandVoice.trim(),
          accent: step1.accent,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Erreur ${res.status}`);
      }

      const entity = await res.json();

      // Persistance localStorage (Phase 1)
      const config = {
        profilId: step1.profilId,
        networks,
        objectifGlobal: step3.objectifGlobal,
        objectifsReseau: step3.objectifsReseau,
        alertes: step3.alertes,
        createdAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem(`sh_entity_config_${entity.id}`, JSON.stringify(config));
      } catch {
        // localStorage peut être indisponible en SSR / private browsing
      }

      setCreatedEntity({ id: entity.id, name: entity.name });
      setToast("Compte créé avec succès !");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setToast(`Erreur : ${msg}`);
    } finally {
      setCreating(false);
    }
  }, [step1, networks, step3]);

  // ── Écran de succès ─────────────────────────────────────────────────────────

  if (createdEntity) {
    return (
      <div className="animate-fade-in flex flex-col items-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success-50 text-success-600">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="mt-5 text-xl font-bold text-ink">
          Compte «&nbsp;{createdEntity.name}&nbsp;» créé !
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted">
          L'entité a été enregistrée en base. La configuration réseaux, objectifs et alertes
          est sauvegardée localement (Phase 1).
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/dashboard" className="btn-primary">
            Ouvrir l'app
          </Link>
          <Link
            href={`/admin/comptes/${createdEntity.id}`}
            className="btn-secondary"
          >
            Gérer l'entité →
          </Link>
          <Link href="/admin/comptes" className="btn-ghost">
            Retour aux comptes
          </Link>
        </div>

        {toast && (
          <Toast message={toast} onDismiss={() => setToast(null)} />
        )}
      </div>
    );
  }

  // ── Rendu principal ──────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in">
      {/* En-tête */}
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/comptes" className="btn-ghost px-2 py-1 text-muted hover:text-ink">
          ← Retour
        </Link>
        <div>
          <h1 className="text-xl font-bold text-ink">Créer un nouveau compte</h1>
          <p className="mt-0.5 text-sm text-muted">Tunnel de création guidé — {WIZARD_STEPS.length} étapes</p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl">
        {/* Stepper */}
        <Stepper steps={WIZARD_STEPS} current={step} />

        {/* Corps de l'étape */}
        <div className="card p-6">
          {step === 0 && <Step1Entity data={step1} onChange={setStep1} />}
          {step === 1 && <Step2Networks networks={networks} onChange={setNetworks} />}
          {step === 2 && (
            <Step3Objectives data={step3} networks={networks} onChange={setStep3} />
          )}
          {step === 3 && (
            <Step4Summary step1={step1} networks={networks} step3={step3} />
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between border-t border-hair pt-5">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 0}
              className="btn-secondary"
            >
              ← Précédent
            </button>

            <span className="text-xs text-muted">
              Étape {step + 1} / {WIZARD_STEPS.length}
            </span>

            {step < WIZARD_STEPS.length - 1 ? (
              <button type="button" onClick={handleNext} className="btn-primary">
                Suivant →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="btn-primary min-w-[220px]"
              >
                {creating ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Création en cours…
                  </span>
                ) : (
                  "Créer le compte & lancer le paramétrage"
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
