"use client";

import { useEffect, useRef } from "react";

/**
 * Cerveau en activité — réseau neuronal animé.
 * Canvas léger (sans dépendance) : des nœuds disposés en forme de cerveau,
 * reliés par des synapses, parcourus par des signaux lumineux qui pulsent.
 * Respecte prefers-reduced-motion.
 */

type Node = { x: number; y: number; r: number; pulse: number; speed: number };
type Edge = { a: number; b: number; dist: number };
type Signal = { edge: number; t: number; speed: number; dir: 1 | -1; hue: string };

// Silhouette stylisée d'un cerveau (points normalisés 0..1).
const BRAIN_SHAPE: [number, number][] = [
  [0.50, 0.12], [0.40, 0.14], [0.31, 0.20], [0.25, 0.29], [0.22, 0.40],
  [0.21, 0.52], [0.24, 0.63], [0.30, 0.72], [0.39, 0.78], [0.50, 0.81],
  [0.61, 0.78], [0.70, 0.72], [0.76, 0.63], [0.79, 0.52], [0.78, 0.40],
  [0.75, 0.29], [0.69, 0.20], [0.60, 0.14],
  // lobes internes
  [0.42, 0.30], [0.55, 0.28], [0.36, 0.45], [0.50, 0.42], [0.64, 0.45],
  [0.40, 0.58], [0.55, 0.56], [0.48, 0.68], [0.62, 0.64], [0.34, 0.36],
  [0.66, 0.34], [0.30, 0.55], [0.70, 0.55], [0.50, 0.55], [0.45, 0.22],
  [0.58, 0.70], [0.43, 0.72], [0.50, 0.30],
];

const SIGNAL_HUES = [
  "59, 113, 243", // primary blue — intelligence
  "124, 58, 237", // violet — vidéo / créa
  "16, 185, 129", // green — connectivité
  "245, 158, 11", // amber — puissance
];

export function BrainCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let nodes: Node[] = [];
    let edges: Edge[] = [];
    let signals: Signal[] = [];
    let raf = 0;
    let t0 = performance.now();

    function build() {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Place nodes from the brain shape, scaled to fill the canvas.
      const pad = 0.08;
      const size = Math.min(width, height);
      const offX = (width - size) / 2 + size * pad;
      const offY = (height - size) / 2 + size * pad;
      const span = size * (1 - pad * 2);

      nodes = BRAIN_SHAPE.map(([nx, ny]) => ({
        x: offX + nx * span,
        y: offY + ny * span,
        r: 1.6 + Math.random() * 2.2,
        pulse: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 1.4,
      }));

      // Connect each node to its nearest neighbours.
      edges = [];
      for (let i = 0; i < nodes.length; i++) {
        const dists: { j: number; d: number }[] = [];
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
          dists.push({ j, d });
        }
        dists.sort((a, b) => a.d - b.d);
        for (let k = 0; k < 3; k++) {
          const j = dists[k].j;
          if (i < j) edges.push({ a: i, b: j, dist: dists[k].d });
        }
      }

      // Seed travelling signals.
      signals = [];
      const count = reduced ? 0 : Math.min(26, Math.floor(edges.length * 0.5));
      for (let i = 0; i < count; i++) spawnSignal();
    }

    function spawnSignal() {
      const edge = Math.floor(Math.random() * edges.length);
      signals.push({
        edge,
        t: Math.random(),
        speed: 0.12 + Math.random() * 0.5,
        dir: Math.random() > 0.5 ? 1 : -1,
        hue: SIGNAL_HUES[Math.floor(Math.random() * SIGNAL_HUES.length)],
      });
    }

    function frame(now: number) {
      const dt = Math.min((now - t0) / 1000, 0.05);
      t0 = now;
      ctx.clearRect(0, 0, width, height);

      // Edges
      ctx.lineWidth = 1;
      for (const e of edges) {
        const a = nodes[e.a];
        const b = nodes[e.b];
        ctx.strokeStyle = "rgba(59, 113, 243, 0.10)";
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Nodes (pulsing)
      for (const n of nodes) {
        n.pulse += dt * n.speed * (reduced ? 0 : 1);
        const glow = 0.5 + Math.sin(n.pulse) * 0.5;
        const r = n.r * (1 + glow * 0.5);
        const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 4);
        grd.addColorStop(0, `rgba(59, 113, 243, ${0.35 + glow * 0.4})`);
        grd.addColorStop(1, "rgba(59, 113, 243, 0)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(255, 255, 255, ${0.6 + glow * 0.4})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }

      // Signals travelling along edges
      if (!reduced) {
        for (const s of signals) {
          const e = edges[s.edge];
          if (!e) continue;
          const a = nodes[e.a];
          const b = nodes[e.b];
          s.t += dt * s.speed * s.dir;
          if (s.t > 1 || s.t < 0) {
            // respawn on a new edge
            s.edge = Math.floor(Math.random() * edges.length);
            s.t = s.dir === 1 ? 0 : 1;
            s.hue = SIGNAL_HUES[Math.floor(Math.random() * SIGNAL_HUES.length)];
            continue;
          }
          const x = a.x + (b.x - a.x) * s.t;
          const y = a.y + (b.y - a.y) * s.t;
          const grd = ctx.createRadialGradient(x, y, 0, x, y, 6);
          grd.addColorStop(0, `rgba(${s.hue}, 0.9)`);
          grd.addColorStop(1, `rgba(${s.hue}, 0)`);
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(frame);
    }

    build();
    if (reduced) {
      // Draw a single static frame.
      frame(performance.now());
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(frame);
    }

    const onResize = () => build();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="h-full w-full"
    />
  );
}
