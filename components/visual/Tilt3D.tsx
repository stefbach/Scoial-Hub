"use client";

// ── Tilt3D — profondeur 3D au survol ─────────────────────────────────────────
// Enveloppe n'importe quel contenu d'une inclinaison 3D suivie au pointeur
// (perspective + rotateX/rotateY) et d'un reflet spéculaire qui suit le
// curseur. Lecture « objet physique » immédiate, coût quasi nul (transform
// GPU, aucune dépendance). Désactivé si prefers-reduced-motion.

import { useRef, type ReactNode, type PointerEvent } from "react";

export function Tilt3D({
  children,
  max = 7,
  className = "",
}: {
  children: ReactNode;
  /** Inclinaison maximale en degrés (subtil par défaut). */
  max?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;   // 0 → 1
    const py = (e.clientY - rect.top) / rect.height;   // 0 → 1
    const rx = (0.5 - py) * max;                        // haut/bas
    const ry = (px - 0.5) * max;                        // gauche/droite
    el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateZ(0)`;
    const glare = glareRef.current;
    if (glare) {
      glare.style.opacity = "1";
      glare.style.background = `radial-gradient(420px circle at ${(px * 100).toFixed(1)}% ${(py * 100).toFixed(1)}%, rgb(255 255 255 / 0.10), transparent 55%)`;
    }
  };

  const onLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
    if (glareRef.current) glareRef.current.style.opacity = "0";
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`relative transition-transform duration-200 ease-out will-change-transform ${className}`}
      style={{ transformStyle: "preserve-3d" }}
    >
      {children}
      {/* Reflet spéculaire qui suit le curseur */}
      <div
        ref={glareRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300"
      />
    </div>
  );
}
