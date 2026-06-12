"use client";

// ── GlobeHero — la Terre en 3D, façon Google Earth ───────────────────────────
// Le cœur de la promesse AXON : « on tourne autour du monde, et les satellites
// sont les réseaux sociaux ». Globe photoréaliste (texture satellite NASA Blue
// Marble), rotation libre au doigt/souris, zoom molette/pincement, et vol
// caméra vers n'importe quelle ville (Pékin, New York, Paris, Port-Louis,
// Flic-en-Flac…). Quatre satellites — Facebook, Instagram, LinkedIn, TikTok —
// orbitent autour de la planète, reliés aux villes par des arcs de signal.
//
// Sobriété : three.js (déjà présent), texture chargée depuis un CDN avec repli
// stylisé hors-ligne, DPR ≤ 2, pause hors écran, gestes inertiels, et mode
// statique si prefers-reduced-motion.

import { useEffect, useRef } from "react";
import * as THREE from "three";

const R = 1; // rayon du globe (unité scène)

/** Villes accessibles en un clic — le monde à portée. */
const CITIES: { name: string; lat: number; lon: number; chip?: boolean }[] = [
  { name: "Paris", lat: 48.8566, lon: 2.3522, chip: true },
  { name: "New York", lat: 40.7128, lon: -74.006, chip: true },
  { name: "Pékin", lat: 39.9042, lon: 116.4074, chip: true },
  { name: "Port-Louis", lat: -20.1609, lon: 57.5012, chip: true },
  { name: "Flic-en-Flac", lat: -20.2744, lon: 57.3631, chip: true },
  { name: "Tokyo", lat: 35.6762, lon: 139.6503, chip: true },
  { name: "Sydney", lat: -33.8688, lon: 151.2093, chip: true },
  { name: "Dubaï", lat: 25.2048, lon: 55.2708 },
  { name: "Londres", lat: 51.5074, lon: -0.1278 },
  { name: "São Paulo", lat: -23.5505, lon: -46.6333 },
  { name: "Lagos", lat: 6.5244, lon: 3.3792 },
  { name: "Montréal", lat: 45.5019, lon: -73.5674 },
  { name: "Singapour", lat: 1.3521, lon: 103.8198 },
  { name: "Mumbai", lat: 19.076, lon: 72.8777 },
];

/** lat/lon → position 3D sur la sphère (aligné texture équirectangulaire). */
function latLonToVec3(lat: number, lon: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

/** Logo réseau → CanvasTexture (rendu net, pas d'emoji). */
function logoTexture(kind: "fb" | "ig" | "li" | "tt"): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const round = (col: string | CanvasGradient) => {
    g.fillStyle = col;
    g.beginPath();
    g.roundRect(8, 8, 240, 240, 56);
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
    round("#010101");
    // Note de musique TikTok simplifiée, blanche.
    g.fillStyle = "#fff";
    g.beginPath(); g.arc(104, 178, 30, 0, Math.PI * 2); g.fill();
    g.fillRect(122, 70, 18, 108);
    g.beginPath();
    g.moveTo(122, 70); g.quadraticCurveTo(150, 102, 192, 104);
    g.lineTo(192, 128); g.quadraticCurveTo(150, 126, 140, 108);
    g.lineTo(140, 70); g.closePath(); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function GlobeHero() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const flyToRef = useRef<(lat: number, lon: number) => void>(() => {});

  useEffect(() => {
    const wrap = wrapRef.current;
    const labelsEl = labelsRef.current;
    if (!wrap || !labelsEl) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ── Scène / caméra / rendu ───────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
    const sph = new THREE.Spherical(3.1, Math.PI / 2.15, 0.6); // dist, phi, theta
    const sphTarget = { radius: 3.1, phi: Math.PI / 2.15, theta: 0.6 };

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab;";
    wrap.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
    sun.position.set(-3, 1.2, 2.2);
    scene.add(sun);

    // ── Globe (texture satellite réelle + repli stylisé) ─────────────────────
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    const sphereGeo = new THREE.SphereGeometry(R, 96, 96);
    const fallbackMat = new THREE.MeshStandardMaterial({ color: 0x14102a, roughness: 0.9, metalness: 0.1 });
    const globe = new THREE.Mesh(sphereGeo, fallbackMat);
    globeGroup.add(globe);

    // Graticule discret (visible surtout en repli hors-ligne).
    const grid = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.SphereGeometry(R * 1.001, 24, 16)),
      new THREE.LineBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.18 })
    );
    globeGroup.add(grid);

    const texLoader = new THREE.TextureLoader();
    texLoader.setCrossOrigin("anonymous");
    texLoader.load(
      "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        globe.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 });
        fallbackMat.dispose();
        grid.visible = false; // la vraie Terre n'a pas besoin du quadrillage
      },
      undefined,
      () => { /* hors-ligne → globe stylisé améthyste, déjà en place */ }
    );

    // Atmosphère (halo fresnel additif).
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.07, 64, 64),
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        uniforms: {},
        vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `varying vec3 vN; void main(){ float i = pow(0.72 - dot(vN, vec3(0.0,0.0,1.0)), 2.6); gl_FragColor = vec4(0.55, 0.45, 1.0, 1.0) * i; }`,
      })
    );
    scene.add(atmo);

    // ── Marqueurs de villes + libellés HTML ──────────────────────────────────
    const markerGeo = new THREE.SphereGeometry(R * 0.012, 12, 12);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xd9c7ff });
    const haloTex = (() => {
      const c = document.createElement("canvas"); c.width = c.height = 64;
      const g = c.getContext("2d")!;
      const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
      grad.addColorStop(0, "rgba(196,165,255,0.9)"); grad.addColorStop(1, "rgba(168,85,247,0)");
      g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();

    const labels: { el: HTMLButtonElement; marker: THREE.Object3D; city: (typeof CITIES)[number] }[] = [];
    for (const city of CITIES) {
      const pos = latLonToVec3(city.lat, city.lon, R * 1.005);
      const m = new THREE.Mesh(markerGeo, markerMat);
      m.position.copy(pos);
      globeGroup.add(m);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false }));
      halo.scale.setScalar(R * 0.085);
      halo.position.copy(pos);
      globeGroup.add(halo);

      const el = document.createElement("button");
      el.type = "button";
      el.className = "globe-label";
      el.textContent = city.name;
      el.addEventListener("click", () => flyToRef.current(city.lat, city.lon));
      labelsEl.appendChild(el);
      labels.push({ el, marker: m, city });
    }

    // ── Satellites = les réseaux sociaux en orbite ──────────────────────────
    const SATS: { kind: "fb" | "ig" | "li" | "tt"; alt: number; tilt: number; speed: number; phase: number }[] = [
      { kind: "fb", alt: 1.55, tilt: 0.45, speed: 0.22, phase: 0 },
      { kind: "ig", alt: 1.7, tilt: -0.3, speed: 0.17, phase: 2.1 },
      { kind: "li", alt: 1.85, tilt: 0.8, speed: 0.13, phase: 4.2 },
      { kind: "tt", alt: 2.0, tilt: -0.65, speed: 0.1, phase: 1.2 },
    ];
    const satSprites: { sprite: THREE.Sprite; cfg: (typeof SATS)[number]; group: THREE.Group }[] = [];
    for (const cfg of SATS) {
      const group = new THREE.Group();
      group.rotation.x = cfg.tilt;
      scene.add(group);
      // Anneau d'orbite discret
      const ringPts: THREE.Vector3[] = [];
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        ringPts.push(new THREE.Vector3(Math.cos(a) * R * cfg.alt, 0, Math.sin(a) * R * cfg.alt));
      }
      const ring = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(ringPts),
        new THREE.LineBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.16 })
      );
      group.add(ring);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: logoTexture(cfg.kind), transparent: true }));
      sprite.scale.setScalar(R * 0.17);
      group.add(sprite);
      satSprites.push({ sprite, cfg, group });
    }

    // ── Arcs de signal ville → satellite (impulsions du monde vers le réseau) ─
    const arcs: { line: THREE.Line; mat: THREE.LineDashedMaterial; born: number }[] = [];
    function spawnArc(now: number) {
      if (arcs.length >= 3) return;
      const city = CITIES[Math.floor(Math.random() * CITIES.length)];
      const sat = satSprites[Math.floor(Math.random() * satSprites.length)];
      const from = latLonToVec3(city.lat, city.lon, R * 1.005).applyMatrix4(globeGroup.matrixWorld);
      const to = sat.sprite.getWorldPosition(new THREE.Vector3());
      const mid = from.clone().add(to).multiplyScalar(0.5).normalize().multiplyScalar(Math.max(from.length(), to.length()) * 1.18);
      const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(48));
      const mat = new THREE.LineDashedMaterial({ color: 0xc4a5ff, transparent: true, opacity: 0.85, dashSize: 0.08, gapSize: 0.05 });
      const line = new THREE.Line(geo, mat);
      line.computeLineDistances();
      scene.add(line);
      arcs.push({ line, mat, born: now });
    }

    // ── Interactions : drag inertiel + zoom + clic ───────────────────────────
    let dragging = false;
    let lastX = 0, lastY = 0, velT = 0, velP = 0, lastInteract = 0, moved = 0;
    const el = renderer.domElement;
    const onDown = (e: PointerEvent) => {
      dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
      el.style.cursor = "grabbing";
      el.setPointerCapture(e.pointerId);
      lastInteract = performance.now();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      lastX = e.clientX; lastY = e.clientY;
      sphTarget.theta -= dx * 0.005;
      sphTarget.phi = Math.min(Math.PI - 0.35, Math.max(0.35, sphTarget.phi - dy * 0.005));
      velT = -dx * 0.005; velP = -dy * 0.005;
      lastInteract = performance.now();
    };
    const raycaster = new THREE.Raycaster();
    const onUp = (e: PointerEvent) => {
      dragging = false;
      el.style.cursor = "grab";
      // Clic (sans drag) sur un marqueur → vol vers la ville.
      if (moved < 6) {
        const rect = el.getBoundingClientRect();
        const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObjects(labels.map((l) => l.marker));
        if (hits.length) {
          const hit = labels.find((l) => l.marker === hits[0].object);
          if (hit) flyToRef.current(hit.city.lat, hit.city.lon);
        }
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      sphTarget.radius = Math.min(4.6, Math.max(1.45, sphTarget.radius * (1 + e.deltaY * 0.0011)));
      lastInteract = performance.now();
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    // ── Vol caméra vers une ville (fly-to façon Google Earth) ───────────────
    let fly: { t0: number; from: { r: number; p: number; t: number }; to: { r: number; p: number; t: number } } | null = null;
    flyToRef.current = (lat: number, lon: number) => {
      const world = latLonToVec3(lat, lon, R).applyQuaternion(globeGroup.quaternion);
      const target = new THREE.Spherical().setFromVector3(world);
      // Chemin le plus court en theta
      let dT = target.theta - sph.theta;
      while (dT > Math.PI) dT -= Math.PI * 2;
      while (dT < -Math.PI) dT += Math.PI * 2;
      fly = {
        t0: performance.now(),
        from: { r: sph.radius, p: sph.phi, t: sph.theta },
        to: { r: 1.75, p: Math.min(Math.PI - 0.3, Math.max(0.3, target.phi)), t: sph.theta + dT },
      };
      lastInteract = performance.now();
    };

    // ── Boucle ───────────────────────────────────────────────────────────────
    let raf = 0;
    let running = true;
    let lastArc = 0;
    const camDir = new THREE.Vector3();
    const wp = new THREE.Vector3();

    const frame = (now: number) => {
      if (!running) return;

      // Vol en cours (ease in-out ~1.4s)
      if (fly) {
        const k = Math.min(1, (now - fly.t0) / 1400);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        sph.radius = fly.from.r + (fly.to.r - fly.from.r) * e;
        sph.phi = fly.from.p + (fly.to.p - fly.from.p) * e;
        sph.theta = fly.from.t + (fly.to.t - fly.from.t) * e;
        sphTarget.radius = sph.radius; sphTarget.phi = sph.phi; sphTarget.theta = sph.theta;
        if (k >= 1) fly = null;
      } else {
        // Inertie + lissage vers la cible
        if (!dragging) {
          sphTarget.theta += velT; sphTarget.phi = Math.min(Math.PI - 0.35, Math.max(0.35, sphTarget.phi + velP));
          velT *= 0.94; velP *= 0.94;
          // Auto-rotation douce après 4s d'inactivité
          if (!reduced && now - lastInteract > 4000) sphTarget.theta += 0.0011;
        }
        sph.radius += (sphTarget.radius - sph.radius) * 0.12;
        sph.phi += (sphTarget.phi - sph.phi) * 0.18;
        sph.theta += (sphTarget.theta - sph.theta) * 0.18;
      }
      camera.position.setFromSpherical(sph);
      camera.lookAt(0, 0, 0);

      // Satellites en orbite
      if (!reduced) {
        for (const s of satSprites) {
          const a = s.cfg.phase + now * 0.001 * s.cfg.speed * Math.PI;
          s.sprite.position.set(Math.cos(a) * R * s.cfg.alt, 0, Math.sin(a) * R * s.cfg.alt);
        }
        // Arcs de signal
        if (now - lastArc > 2200) { spawnArc(now); lastArc = now; }
        for (let i = arcs.length - 1; i >= 0; i--) {
          const a = arcs[i];
          const age = (now - a.born) / 2000;
          a.mat.gapSize = 0.05 + age * 0.02;
          (a.line.material as THREE.LineDashedMaterial).opacity = Math.max(0, 0.85 * (1 - age));
          a.line.geometry.attributes.position.needsUpdate = false;
          if (age >= 1) {
            scene.remove(a.line);
            a.line.geometry.dispose(); a.mat.dispose();
            arcs.splice(i, 1);
          }
        }
      }

      // Libellés HTML projetés (cachés derrière l'horizon)
      camera.getWorldDirection(camDir);
      const w = el.clientWidth, h = el.clientHeight;
      for (const l of labels) {
        l.marker.getWorldPosition(wp);
        const facing = wp.clone().normalize().dot(camera.position.clone().normalize());
        const v = wp.clone().project(camera);
        const visible = facing > 0.18 && v.z < 1;
        l.el.style.opacity = visible ? "1" : "0";
        l.el.style.pointerEvents = visible ? "auto" : "none";
        if (visible) {
          l.el.style.transform = `translate(-50%,-130%) translate(${((v.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * h).toFixed(1)}px)`;
        }
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };

    // ── Taille / visibilité ─────────────────────────────────────────────────
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / Math.max(1, rect.height);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !running) { running = true; raf = requestAnimationFrame(frame); }
      else if (!entry.isIntersecting && running) { running = false; cancelAnimationFrame(raf); }
    });
    io.observe(wrap);

    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
      labels.forEach((l) => l.el.remove());
      renderer.dispose();
      wrap.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="globe-hero">
      <div ref={wrapRef} className="globe-canvas" />
      <div ref={labelsRef} className="globe-labels" aria-hidden />
      {/* Le monde à portée : villes en un clic */}
      <div className="globe-chips">
        {CITIES.filter((c) => c.chip).map((c) => (
          <button key={c.name} type="button" className="globe-chip" onClick={() => flyToRef.current(c.lat, c.lon)}>
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
