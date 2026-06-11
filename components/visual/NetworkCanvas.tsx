"use client";

// ── NetworkCanvas — « le réseau vivant » ─────────────────────────────────────
// Constellation neuronale animée (Canvas 2D) : des nœuds qui dérivent, des
// synapses qui s'illuminent quand deux nœuds se rapprochent, et une réaction
// douce au curseur (les connexions se densifient autour de lui). C'est la
// signature visuelle d'AXON-AI : l'axone, la connexion, le réseau.
//
// Performance & respect utilisateur :
// - Canvas 2D (zéro dépendance), devicePixelRatio plafonné à 2.
// - Pause automatique hors écran (IntersectionObserver).
// - Statique si `prefers-reduced-motion: reduce` (un seul rendu).
// - S'adapte au thème jour/nuit en lisant les tokens CSS au montage.

import { useEffect, useRef } from "react";

interface Node {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
}

export function NetworkCanvas({
  density = 1,
  intensity = 1,
  pointerTarget = "parent",
  className = "",
}: {
  /** Multiplicateur de densité de nœuds (1 = défaut, ~1 nœud / 14000px²). */
  density?: number;
  /** Multiplicateur d'opacité des liens/nœuds (1 = subtil, ~1.7 = affirmé). */
  intensity?: number;
  /** Où écouter le curseur : le parent (héros) ou la fenêtre (couche pleine page). */
  pointerTarget?: "parent" | "window";
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const light = document.documentElement.dataset.theme === "light";
    // Améthyste sur sombre, améthyste profonde sur clair — toujours discret.
    const nodeColor = light ? "124, 58, 237" : "196, 165, 255";
    const linkColor = light ? "124, 58, 237" : "168, 130, 255";
    const baseAlpha = Math.min(0.95, (light ? 0.5 : 0.55) * intensity);
    const linkScale = intensity;

    let w = 0, h = 0, dpr = 1;
    let nodes: Node[] = [];
    let raf = 0;
    let running = true;
    const mouse = { x: -9999, y: -9999 };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width; h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Plafonné à 110 nœuds : au-delà, le coût O(n²) des liaisons ne vaut
      // plus le gain visuel (même sur très grand écran).
      const target = Math.min(110, Math.max(14, Math.round((w * h) / 14000 * density)));
      nodes = Array.from({ length: target }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: 1 + Math.random() * 1.6,
      }));
    };

    const LINK_DIST = 130;
    const MOUSE_DIST = 170;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // Synapses : lignes dont l'opacité croît quand les nœuds se rapprochent.
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > LINK_DIST * LINK_DIST) continue;
          const d = Math.sqrt(d2);
          // Bonus de luminosité près du curseur → la connexion « répond ».
          const mx = (a.x + b.x) / 2 - mouse.x;
          const my = (a.y + b.y) / 2 - mouse.y;
          const md = Math.sqrt(mx * mx + my * my);
          const boost = md < MOUSE_DIST ? (1 - md / MOUSE_DIST) * 0.35 : 0;
          const alpha = Math.min(0.85, ((1 - d / LINK_DIST) * 0.16 + boost) * linkScale);
          ctx.strokeStyle = `rgba(${linkColor}, ${alpha.toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Nœuds : points doux, halo léger.
      for (const n of nodes) {
        ctx.fillStyle = `rgba(${nodeColor}, ${baseAlpha})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const step = () => {
      if (!running) return;
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < -10) n.x = w + 10; else if (n.x > w + 10) n.x = -10;
        if (n.y < -10) n.y = h + 10; else if (n.y > h + 10) n.y = -10;
      }
      draw();
      raf = requestAnimationFrame(step);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999; };

    // Couche pleine page (pointer-events:none) → on écoute la fenêtre ;
    // sinon le parent direct (héros) reçoit les événements.
    const evtTarget: GlobalEventHandlers | null =
      pointerTarget === "window" ? window : canvas.parentElement;

    resize();
    if (reduced) {
      draw(); // un seul rendu statique — pas d'animation
    } else {
      raf = requestAnimationFrame(step);
      evtTarget?.addEventListener("pointermove", onMove as EventListener);
      evtTarget?.addEventListener("pointerleave", onLeave);
    }

    // Pause hors écran (économie batterie / CPU).
    const io = new IntersectionObserver(([entry]) => {
      const visible = entry.isIntersecting;
      if (reduced) return;
      if (visible && !running) { running = true; raf = requestAnimationFrame(step); }
      else if (!visible && running) { running = false; cancelAnimationFrame(raf); }
    });
    io.observe(canvas);

    const ro = new ResizeObserver(() => { resize(); if (reduced) draw(); });
    ro.observe(canvas);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      evtTarget?.removeEventListener("pointermove", onMove as EventListener);
      evtTarget?.removeEventListener("pointerleave", onLeave);
    };
  }, [density, intensity, pointerTarget]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
