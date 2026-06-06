"use client";

/* Scène WebGL réaliste pour le hero : téléphone + tableau de bord en verre,
   logos sociaux (Facebook/Instagram/LinkedIn/X) en orbite, noyau IA lumineux.
   Réflexions PBR via RoomEnvironment (aucun asset externe — robuste).
   Parallax à la souris, nettoyage complet, prefers-reduced-motion respecté. */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/* Visuels photoréalistes optionnels (Flux Ultra) déposés dans /public/hero/.
   S'ils existent, ils servent de texture ; sinon repli procédural. */
const HERO_SCREEN_URL = "/hero/phone-screen.jpg"; // mockup de post ultra
const HERO_DASH_URL = "/hero/dashboard.jpg";       // tableau de bord ultra

/* Dessine une texture de logo réseau sur un canvas → CanvasTexture. */
function logoTexture(kind: "fb" | "ig" | "li" | "x"): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const r = 56;
  const round = (col: string | CanvasGradient) => {
    g.fillStyle = col;
    g.beginPath();
    g.roundRect(8, 8, 240, 240, r);
    g.fill();
  };
  g.clearRect(0, 0, 256, 256);
  if (kind === "fb") {
    round("#1877F2");
    g.fillStyle = "#fff"; g.font = "bold 180px Georgia"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("f", 128, 140);
  } else if (kind === "ig") {
    const grad = g.createLinearGradient(20, 240, 240, 20);
    grad.addColorStop(0, "#feda75"); grad.addColorStop(.35, "#fa7e1e"); grad.addColorStop(.6, "#d62976"); grad.addColorStop(1, "#4f5bd5");
    round(grad);
    g.strokeStyle = "#fff"; g.lineWidth = 16;
    g.beginPath(); g.roundRect(74, 74, 108, 108, 30); g.stroke();
    g.beginPath(); g.arc(128, 128, 30, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(168, 88, 9, 0, Math.PI * 2); g.fill();
  } else if (kind === "li") {
    round("#0A66C2");
    g.fillStyle = "#fff"; g.font = "bold 130px Arial"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("in", 128, 138);
  } else {
    round("#0a0a0a");
    g.fillStyle = "#fff"; g.font = "bold 150px Arial"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("𝕏", 128, 138);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* Texture "écran de post" pour le téléphone. */
function screenTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 1024;
  const g = c.getContext("2d")!;
  g.fillStyle = "#120b1e"; g.fillRect(0, 0, 512, 1024);
  // header
  g.fillStyle = "#a855f7"; g.beginPath(); g.arc(70, 90, 34, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#cdbff0"; g.fillRect(120, 70, 230, 18); g.fillStyle = "#5a4d75"; g.fillRect(120, 100, 150, 12);
  // media
  const grad = g.createLinearGradient(40, 160, 472, 620);
  grad.addColorStop(0, "#1877F2"); grad.addColorStop(.5, "#a855f7"); grad.addColorStop(1, "#e1306c");
  g.fillStyle = grad; g.beginPath(); g.roundRect(40, 160, 432, 460, 28); g.fill();
  // actions + lines
  g.fillStyle = "#3a2f54";
  [60, 130, 200].forEach((x) => { g.beginPath(); g.roundRect(x, 660, 44, 44, 12); g.fill(); });
  g.fillStyle = "#2c2440"; g.fillRect(40, 740, 400, 18); g.fillRect(40, 778, 250, 18);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* Texture "tableau de bord" (KPIs + barres). */
function dashTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 640;
  const g = c.getContext("2d")!;
  g.fillStyle = "#160f24"; g.fillRect(0, 0, 1024, 640);
  g.fillStyle = "#22c55e"; g.beginPath(); g.arc(46, 56, 12, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#cdbff0"; g.font = "600 34px Arial"; g.textAlign = "left"; g.fillText("Performance · Meta", 74, 68);
  g.fillStyle = "#22c55e"; g.font = "600 22px Arial"; g.fillText("LIVE", 920, 64);
  const kpis: [string, string][] = [["1 266 €", "Dépense"], ["2.1%", "CTR"], ["394k", "Conv."]];
  kpis.forEach(([v, k], i) => {
    const x = 60 + i * 310;
    g.fillStyle = "rgba(168,85,247,.16)"; g.beginPath(); g.roundRect(x, 110, 270, 120, 18); g.fill();
    g.fillStyle = "#fff"; g.font = "700 52px Georgia"; g.fillText(v, x + 26, 175);
    g.fillStyle = "#a395c0"; g.font = "400 24px Arial"; g.fillText(k, x + 26, 210);
  });
  const bars = [0.42, 0.7, 0.35, 0.88, 0.6, 0.95, 0.52, 0.78];
  const bw = 90, gap = 26, base = 600, maxH = 300, x0 = 70;
  bars.forEach((h, i) => {
    const x = x0 + i * (bw + gap), bh = h * maxH;
    const grad = g.createLinearGradient(0, base - bh, 0, base);
    grad.addColorStop(0, "#c084fc"); grad.addColorStop(1, "#7c3aed");
    g.fillStyle = grad; g.beginPath(); g.roundRect(x, base - bh, bw, bh, 10); g.fill();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function Hero3D() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const W = () => mount.clientWidth;
    const H = () => mount.clientHeight || 480;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W(), H());
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, W() / H(), 0.1, 100);
    camera.position.set(0, 0, 8.2);

    // Environnement réaliste (réflexions PBR) — généré en mémoire, aucun fetch.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    // Lumières (key + accents marque).
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(4, 6, 6); scene.add(key);
    const p1 = new THREE.PointLight(0xa855f7, 60, 30); p1.position.set(-4, 2, 4); scene.add(p1);
    const p2 = new THREE.PointLight(0x1877f2, 40, 30); p2.position.set(4, -3, 3); scene.add(p2);

    // Post-processing : bloom cinématique (qualité "ultra").
    const composer = new EffectComposer(renderer);
    composer.setSize(W(), H());
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W(), H()), 0.55, 0.85, 0.2);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    const deck = new THREE.Group(); scene.add(deck);
    const disposables: { dispose: () => void }[] = [envTex, pmrem];

    // Charge un visuel ultra (Flux) s'il existe, sinon garde le procédural.
    const tryTexture = (url: string, apply: (tx: THREE.Texture) => void) => {
      new THREE.TextureLoader().load(
        url,
        (tx) => { tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; apply(tx); disposables.push(tx); },
        undefined,
        () => { /* absent → repli procédural */ }
      );
    };

    // ── Téléphone ──
    const phone = new THREE.Group();
    const bodyGeo = new RoundedBoxGeometry(1.55, 3.15, 0.22, 6, 0.16);
    const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0x18121f, metalness: 0.9, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.2 });
    const body = new THREE.Mesh(bodyGeo, bodyMat); phone.add(body);
    const scrTex = screenTexture();
    const scrMat = new THREE.MeshStandardMaterial({ map: scrTex, emissive: 0xffffff, emissiveMap: scrTex, emissiveIntensity: 0.55, roughness: 0.25, metalness: 0 });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 2.86), scrMat);
    screen.position.z = 0.116; phone.add(screen);
    phone.position.set(2.4, -0.2, 0.6); phone.rotation.set(0.12, -0.5, 0.04);
    deck.add(phone);
    disposables.push(bodyGeo, bodyMat, scrTex, scrMat, screen.geometry);
    tryTexture(HERO_SCREEN_URL, (tx) => { scrMat.map = tx; scrMat.emissiveMap = tx; scrMat.needsUpdate = true; });

    // ── Tableau de bord (verre) ──
    const dashTex = dashTexture();
    const dashGeo = new RoundedBoxGeometry(3.2, 2.0, 0.1, 5, 0.08);
    const dashMat = new THREE.MeshPhysicalMaterial({ color: 0x140e22, metalness: 0.3, roughness: 0.12, transmission: 0.6, ior: 1.4, thickness: 0.6, clearcoat: 1, transparent: true });
    const dash = new THREE.Mesh(dashGeo, dashMat);
    const dashFaceMat = new THREE.MeshStandardMaterial({ map: dashTex, emissive: 0xffffff, emissiveMap: dashTex, emissiveIntensity: 0.55, roughness: 0.4 });
    const dashFace = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.86), dashFaceMat);
    dashFace.position.z = 0.055; dash.add(dashFace);
    dash.position.set(-1.7, 0.7, -0.4); dash.rotation.set(0.1, 0.45, -0.04);
    deck.add(dash);
    disposables.push(dashTex, dashGeo, dashMat, dashFace.geometry, dashFaceMat);
    tryTexture(HERO_DASH_URL, (tx) => { dashFaceMat.map = tx; dashFaceMat.emissiveMap = tx; dashFaceMat.needsUpdate = true; });

    // ── Noyau IA ──
    const coreGeo = new THREE.IcosahedronGeometry(0.42, 2);
    const coreMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0xa855f7, emissiveIntensity: 2.2, roughness: 0.3, metalness: 0.2 });
    const core = new THREE.Mesh(coreGeo, coreMat); core.position.set(0.1, 0.1, 0.2); deck.add(core);
    const coreLight = new THREE.PointLight(0xc084fc, 30, 14); core.add(coreLight);
    disposables.push(coreGeo, coreMat);

    // ── Logos sociaux en orbite ──
    const kinds: ("fb" | "ig" | "li" | "x")[] = ["fb", "ig", "li", "x"];
    const cardGeo = new RoundedBoxGeometry(0.74, 0.74, 0.12, 4, 0.1);
    const orbit = new THREE.Group(); orbit.rotation.x = 0.5; deck.add(orbit);
    const sats: THREE.Mesh[] = [];
    const radius = 3.1;
    kinds.forEach((k, i) => {
      const tex = logoTexture(k);
      const mat = new THREE.MeshPhysicalMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25, metalness: 0.4, roughness: 0.25, clearcoat: 1 });
      const m = new THREE.Mesh(cardGeo, mat);
      const a = (i / kinds.length) * Math.PI * 2;
      m.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
      orbit.add(m); sats.push(m);
      disposables.push(tex, mat);
    });
    disposables.push(cardGeo);

    // Parallax souris.
    const target = { x: 0, y: 0 };
    const onMove = (e: MouseEvent) => {
      const r = mount.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      target.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    if (!reduce) window.addEventListener("mousemove", onMove);

    // Cadrage + perf adaptatifs (mobile = caméra reculée, verre allégé).
    const applyResponsive = () => {
      const w = W(), h = H();
      renderer.setSize(w, h); composer.setSize(w, h);
      const small = w < 700;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 2));
      camera.aspect = w / h; camera.updateProjectionMatrix();
      // Recule la caméra quand le cadre est étroit pour tout garder visible.
      camera.position.z = camera.aspect < 0.85 ? 12 : camera.aspect < 1.25 ? 10 : 8.2;
      bloom.strength = small ? 0.4 : 0.55;
      // La transmission (verre) est coûteuse → on la coupe sur mobile.
      dashMat.transmission = small ? 0 : 0.55;
      dashMat.opacity = small ? 1 : 1;
    };
    const ro = new ResizeObserver(applyResponsive); ro.observe(mount);
    applyResponsive();

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      const t = clock.getElapsedTime();
      deck.rotation.y += (target.x * 0.5 - deck.rotation.y) * 0.05;
      deck.rotation.x += (-target.y * 0.3 - deck.rotation.x) * 0.05;
      orbit.rotation.z = t * 0.35;
      sats.forEach((m) => m.rotation.z = -t * 0.35); // logos restent droits
      core.rotation.y = t * 0.6; core.rotation.x = t * 0.3;
      coreMat.emissiveIntensity = 1.9 + Math.sin(t * 2) * 0.5;
      phone.position.y = -0.2 + Math.sin(t * 1.1) * 0.12;
      dash.position.y = 0.7 + Math.sin(t * 0.9 + 1) * 0.1;
      composer.render();
      if (!reduce) raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
      disposables.forEach((d) => d.dispose());
      composer.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="mc-webgl" aria-hidden />;
}
