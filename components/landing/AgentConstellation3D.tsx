"use client";

// ── AgentConstellation3D — le système nerveux de la marque, en VRAIE 3D ───────
// Graphe 3D vivant : votre marque → noyau AXON → 6 agents → publisher → réseaux.
// Ça tourne (auto-rotation + drag inertiel), ça respire (nœuds flottants), des
// impulsions de lumière voyagent sur les connexions, et c'est interactif
// (survol = mise en avant du nœud). Labels cuits dans les sprites → toujours
// face caméra et lisibles pendant la rotation. Zéro dépendance (three déjà là).

import { useEffect, useRef } from "react";
import * as THREE from "three";

type NodeDef = {
  id: string; pos: [number, number, number]; r: number; label: string;
  ring: string; bg: string; paths?: string[]; logo?: "fb" | "ig" | "li" | "tt";
};

const GLYPH = {
  heart: ["M12 20.5S4.5 15.6 4.5 10.4C4.5 7.8 6.5 6 8.8 6c1.3 0 2.5.6 3.2 1.6C12.7 6.6 13.9 6 15.2 6c2.3 0 4.3 1.8 4.3 4.4 0 5.2-7.5 10.1-7.5 10.1Z"],
  compass: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M15.2 8.8 13 13l-4.2 2.2L11 11l4.2-2.2Z"],
  pen: ["M16.5 3.9a2.1 2.1 0 0 1 3 3L8 18.4 4 19.5l1.1-4L16.5 3.9Z", "M13.5 6.9l3.6 3.6"],
  palette: ["M12 3.5a8.5 8.5 0 1 0 0 17h1.6a1.9 1.9 0 0 0 1.4-3.2c-.8-.9-.2-2.3 1-2.3h1.5a4 4 0 0 0 4-4c0-4.2-4.3-7.5-9.5-7.5Z", "M8 9.5h.01M12 7.5h.01M16 9.5h.01"],
  shield: ["M12 3.5 18.5 6v5c0 4.3-2.8 7.8-6.5 9-3.7-1.2-6.5-4.7-6.5-9V6L12 3.5Z", "m9 11.5 2.2 2.2 4-4.4"],
  megaphone: ["M4 10.5v3h2.5l8 4v-11l-8 4H4Z", "M17.5 9.5v5", "m7.5 13.7.9 4.3h2.2"],
  bars: ["M7 17v-5M12 17V7.5M17 17v-7", "M5 17h14"],
  plane: ["M21 3 10.8 13.2", "M21 3l-6.2 18-3.9-8.1L3 9.2 21 3Z"],
};

// Anneau d'agents (plan Y-Z) autour d'un centre, en 3D.
function ring(cx: number, count: number, R: number, i: number): [number, number, number] {
  const a = (i / count) * Math.PI * 2 - Math.PI / 2;
  return [cx, Math.sin(a) * R, Math.cos(a) * R * 0.9];
}

const NODES: NodeDef[] = [
  { id: "brand", pos: [-4.2, 0, 0], r: 0.62, label: "Votre marque", ring: "#a855f7", bg: "#171122", paths: GLYPH.heart },
  { id: "core", pos: [-2.0, 0, 0], r: 0.95, label: "AXON", ring: "#c4a5ff", bg: "#7c3aed" },
  { id: "a0", pos: ring(0.5, 6, 1.85, 0), r: 0.5, label: "Stratège", ring: "#7c3aed", bg: "#171122", paths: GLYPH.compass },
  { id: "a1", pos: ring(0.5, 6, 1.85, 1), r: 0.5, label: "Rédacteur", ring: "#7c3aed", bg: "#171122", paths: GLYPH.pen },
  { id: "a2", pos: ring(0.5, 6, 1.85, 2), r: 0.5, label: "Créatif", ring: "#7c3aed", bg: "#171122", paths: GLYPH.palette },
  { id: "a3", pos: ring(0.5, 6, 1.85, 3), r: 0.5, label: "Conformité", ring: "#7c3aed", bg: "#171122", paths: GLYPH.shield },
  { id: "a4", pos: ring(0.5, 6, 1.85, 4), r: 0.5, label: "Media Buyer", ring: "#7c3aed", bg: "#171122", paths: GLYPH.megaphone },
  { id: "a5", pos: ring(0.5, 6, 1.85, 5), r: 0.5, label: "Analyste", ring: "#7c3aed", bg: "#171122", paths: GLYPH.bars },
  { id: "pub", pos: [3.0, 0, 0], r: 0.66, label: "Publisher", ring: "#d946ef", bg: "#171122", paths: GLYPH.plane },
  { id: "fb", pos: ring(4.8, 4, 1.35, 0), r: 0.46, label: "Facebook", ring: "#1877F2", bg: "#1877F2", logo: "fb" },
  { id: "ig", pos: ring(4.8, 4, 1.35, 1), r: 0.46, label: "Instagram", ring: "#e1306c", bg: "#000", logo: "ig" },
  { id: "li", pos: ring(4.8, 4, 1.35, 2), r: 0.46, label: "LinkedIn", ring: "#0A66C2", bg: "#0A66C2", logo: "li" },
  { id: "tt", pos: ring(4.8, 4, 1.35, 3), r: 0.46, label: "TikTok", ring: "#25F4EE", bg: "#010101", logo: "tt" },
];

const LINKS: [string, string][] = [
  ["brand", "core"],
  ...["a0", "a1", "a2", "a3", "a4", "a5"].flatMap((a) => [["core", a], [a, "pub"]] as [string, string][]),
  ...["fb", "ig", "li", "tt"].map((n) => ["pub", n] as [string, string]),
];

/** Texture d'un nœud : cercle + anneau + icône (Path2D) + label, cuit pour
 *  faire toujours face à la caméra. */
function nodeTexture(n: NodeDef): THREE.CanvasTexture {
  const W = 256, H = 340;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const cx = W / 2, cy = 116, rad = 100;
  // Disque + anneau
  g.fillStyle = n.bg; g.beginPath(); g.arc(cx, cy, rad, 0, 7); g.fill();
  g.strokeStyle = n.ring; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, rad, 0, 7); g.stroke();

  if (n.logo) {
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
    if (n.logo === "fb") { g.font = "bold 120px Georgia"; g.fillText("f", cx, cy + 6); }
    else if (n.logo === "li") { g.font = "bold 84px Arial"; g.fillText("in", cx, cy + 4); }
    else if (n.logo === "ig") {
      g.strokeStyle = "#fff"; g.lineWidth = 9;
      g.beginPath(); g.roundRect(cx - 34, cy - 34, 68, 68, 20); g.stroke();
      g.beginPath(); g.arc(cx, cy, 20, 0, 7); g.stroke();
      g.beginPath(); g.arc(cx + 24, cy - 24, 6, 0, 7); g.fill();
    } else { // tiktok
      g.beginPath(); g.arc(cx - 18, cy + 26, 20, 0, 7); g.fill();
      g.fillRect(cx - 6, cy - 40, 12, 66);
      g.beginPath(); g.moveTo(cx - 6, cy - 40); g.quadraticCurveTo(cx + 18, cy - 16, cx + 44, cy - 14);
      g.lineTo(cx + 44, cy + 2); g.quadraticCurveTo(cx + 18, cy, cx + 6, cy - 16); g.closePath(); g.fill();
    }
  } else if (n.id === "core") {
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "800 38px Manrope, sans-serif"; g.fillText("AXON", cx, cy - 6);
    g.font = "600 16px Manrope, sans-serif"; g.fillStyle = "#e9d5ff"; g.fillText("ORCHESTRATEUR", cx, cy + 24);
  } else if (n.paths) {
    const s = (rad * 1.05) / 24;
    g.save();
    g.translate(cx - 12 * s, cy - 12 * s); g.scale(s, s);
    g.strokeStyle = "#fff"; g.lineWidth = 1.9; g.lineCap = "round"; g.lineJoin = "round";
    for (const d of n.paths) g.stroke(new Path2D(d));
    g.restore();
  }

  // Label
  g.fillStyle = "#cdbfe8"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "600 30px Manrope, sans-serif";
  g.fillText(n.label, cx, 300);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

export function AgentConstellation3D() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0.4, 0.4, 12.2);
    camera.lookAt(0.4, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:grab;";
    wrap.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    // Nœuds (sprites)
    const byId = new Map<string, { def: NodeDef; sprite: THREE.Sprite; base: number }>();
    for (const n of NODES) {
      const mat = new THREE.SpriteMaterial({ map: nodeTexture(n), transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      const h = n.r * 2 * (340 / 256);
      sprite.scale.set(n.r * 2, h, 1);
      sprite.position.set(...n.pos);
      sprite.userData.id = n.id;
      group.add(sprite);
      byId.set(n.id, { def: n, sprite, base: n.r * 2 });
    }

    // Connexions
    const linkData: { a: THREE.Vector3; b: THREE.Vector3 }[] = [];
    for (const [ia, ib] of LINKS) {
      const a = new THREE.Vector3(...byId.get(ia)!.def.pos);
      const b = new THREE.Vector3(...byId.get(ib)!.def.pos);
      const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.28 }));
      group.add(line);
      linkData.push({ a, b });
    }

    // Impulsions le long des connexions
    const pulseTex = (() => {
      const c = document.createElement("canvas"); c.width = c.height = 64;
      const g = c.getContext("2d")!;
      const gr = g.createRadialGradient(32, 32, 1, 32, 32, 30);
      gr.addColorStop(0, "rgba(255,255,255,0.95)"); gr.addColorStop(0.5, "rgba(196,165,255,0.8)"); gr.addColorStop(1, "rgba(168,85,247,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    const pulses = linkData.map((l, i) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: pulseTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.scale.setScalar(0.32);
      group.add(sp);
      return { sp, l, off: (i * 0.137) % 1, speed: 0.22 + (i % 4) * 0.05 };
    });

    // Interaction : drag inertiel + auto-rotation + survol
    let dragging = false, lastX = 0, lastY = 0, velY = 0, velX = 0, lastInteract = 0;
    let rotY = 0, rotX = 0;
    const dom = renderer.domElement;
    const onDown = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; dom.style.cursor = "grabbing"; dom.setPointerCapture(e.pointerId); lastInteract = performance.now(); };
    const onUp = () => { dragging = false; dom.style.cursor = "grab"; };
    const ndc = new THREE.Vector2(2, 2);
    const onMove = (e: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      rotY += dx * 0.006; rotX = Math.max(-0.6, Math.min(0.6, rotX + dy * 0.004));
      velY = dx * 0.006; velX = dy * 0.004;
      lastInteract = performance.now();
    };
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointerup", onUp);
    dom.addEventListener("pointermove", onMove);

    const raycaster = new THREE.Raycaster();
    let raf = 0, running = true;
    const tmp = new THREE.Vector3();

    const tick = (now: number) => {
      if (!running) return;
      const t = now * 0.001;
      if (!dragging) {
        rotY += velY; rotX = Math.max(-0.6, Math.min(0.6, rotX + velX));
        velY *= 0.93; velX *= 0.93;
        if (!reduced && now - lastInteract > 2600) rotY += 0.0016; // auto-rotation
      }
      group.rotation.y = rotY;
      group.rotation.x = rotX;

      // Nœuds : flottement + survol
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects([...byId.values()].map((v) => v.sprite));
      const hitId = hits[0]?.object.userData.id;
      let i = 0;
      for (const { def, sprite, base } of byId.values()) {
        const float = reduced ? 0 : Math.sin(t * 1.2 + i) * 0.04;
        sprite.position.set(def.pos[0], def.pos[1] + float, def.pos[2]);
        const target = (hitId === def.id ? base * 1.18 : base) ;
        const cur = sprite.scale.x + (target - sprite.scale.x) * 0.15;
        sprite.scale.set(cur, cur * (340 / 256), 1);
        (sprite.material as THREE.SpriteMaterial).opacity = hitId && hitId !== def.id ? 0.78 : 1;
        i++;
      }
      dom.style.cursor = hitId ? "pointer" : (dragging ? "grabbing" : "grab");

      // Impulsions
      for (const p of pulses) {
        const f = (p.off + t * p.speed) % 1;
        tmp.copy(p.l.a).lerp(p.l.b, f);
        p.sp.position.copy(tmp);
        (p.sp.material as THREE.SpriteMaterial).opacity = Math.sin(f * Math.PI);
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / Math.max(1, rect.height);
      camera.updateProjectionMatrix();
      // Recadre légèrement selon la largeur (mobile = recule)
      camera.position.z = rect.width < 700 ? 16 : 12.2;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(wrap);
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !running) { running = true; raf = requestAnimationFrame(tick); }
      else if (!e.isIntersecting && running) { running = false; cancelAnimationFrame(raf); }
    });
    io.observe(wrap);
    raf = requestAnimationFrame(tick);

    return () => {
      running = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointerup", onUp);
      dom.removeEventListener("pointermove", onMove);
      renderer.dispose();
      wrap.removeChild(dom);
    };
  }, []);

  return <div ref={wrapRef} className="constellation3d" aria-hidden />;
}
