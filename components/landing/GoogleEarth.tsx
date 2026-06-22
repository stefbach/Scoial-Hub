"use client";

// ── GoogleEarth — vrai globe « Google Earth » via CesiumJS ────────────────────
// Imagerie satellite réelle (Esri World Imagery, sans clé), zoom CONTINU de
// l'espace jusqu'au niveau rue, atmosphère, vol caméra vers n'importe quelle
// ville et recherche de lieu (Nominatim). Cesium est chargé depuis le CDN au
// runtime (aucune dépendance npm). En cas d'échec de chargement/init, on
// retombe proprement sur le globe three.js (GlobeHero) — la home ne casse jamais.

import { useEffect, useRef, useState } from "react";
import { GlobeHero } from "./GlobeHero";

const VER = "1.118";
const BASE = `https://cdn.jsdelivr.net/npm/cesium@${VER}/Build/Cesium/`;
const ESRI_IMG = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer";
const ESRI_REF = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer";

const CITIES = [
  { name: "Paris", lat: 48.8566, lon: 2.3522 },
  { name: "New York", lat: 40.7128, lon: -74.006 },
  { name: "Pékin", lat: 39.9042, lon: 116.4074 },
  { name: "Port-Louis", lat: -20.1609, lon: 57.5012 },
  { name: "Flic-en-Flac", lat: -20.2744, lon: 57.3631 },
  { name: "Tokyo", lat: 35.6762, lon: 139.6503 },
  { name: "Sydney", lat: -33.8688, lon: 151.2093 },
];

/* eslint-disable @typescript-eslint/no-explicit-any */
let cesiumPromise: Promise<any> | null = null;
function loadCesium(): Promise<any> {
  const w = window as any;
  if (w.Cesium) return Promise.resolve(w.Cesium);
  if (cesiumPromise) return cesiumPromise;
  cesiumPromise = new Promise((resolve, reject) => {
    (window as any).CESIUM_BASE_URL = BASE;
    if (!document.querySelector("link[data-cesium]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet"; link.href = BASE + "Widgets/widgets.css";
      link.setAttribute("data-cesium", "1");
      document.head.appendChild(link);
    }
    const s = document.createElement("script");
    s.src = BASE + "Cesium.js"; s.async = true;
    s.onload = () => resolve((window as any).Cesium);
    s.onerror = reject;
    document.body.appendChild(s);
  });
  return cesiumPromise;
}

/** Logo réseau → dataURL (billboard satellite). */
function logoDataUrl(kind: "fb" | "ig" | "li" | "tt"): string {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const round = (col: string | CanvasGradient) => { g.fillStyle = col; g.beginPath(); g.roundRect(6, 6, 116, 116, 28); g.fill(); };
  if (kind === "fb") { round("#1877F2"); g.fillStyle = "#fff"; g.font = "bold 92px Georgia"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("f", 64, 72); }
  else if (kind === "ig") { const gr = g.createLinearGradient(10, 120, 120, 10); gr.addColorStop(0, "#feda75"); gr.addColorStop(.4, "#fa7e1e"); gr.addColorStop(.65, "#d62976"); gr.addColorStop(1, "#4f5bd5"); round(gr); g.strokeStyle = "#fff"; g.lineWidth = 9; g.beginPath(); g.roundRect(38, 38, 52, 52, 15); g.stroke(); g.beginPath(); g.arc(64, 64, 15, 0, 7); g.stroke(); }
  else if (kind === "li") { round("#0A66C2"); g.fillStyle = "#fff"; g.font = "bold 66px Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("in", 64, 70); }
  else { round("#010101"); g.fillStyle = "#fff"; g.beginPath(); g.arc(54, 90, 15, 0, 7); g.fill(); g.fillRect(63, 36, 9, 54); g.beginPath(); g.moveTo(63, 36); g.quadraticCurveTo(78, 52, 98, 53); g.lineTo(98, 65); g.quadraticCurveTo(78, 64, 72, 54); g.closePath(); g.fill(); }
  return c.toDataURL();
}

/** Avion vu de dessus (billboard du simulateur de vol). */
function planeDataUrl(): string {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.translate(64, 64);
  g.fillStyle = "#f4f0ff";
  g.strokeStyle = "#7c3aed"; g.lineWidth = 3; g.lineJoin = "round";
  g.beginPath();
  g.moveTo(0, -52);                 // nez
  g.lineTo(7, -16);
  g.lineTo(7, 6);
  g.lineTo(52, 26);                 // aile droite
  g.lineTo(52, 36);
  g.lineTo(7, 26);
  g.lineTo(7, 44);
  g.lineTo(20, 54);                 // empennage droit
  g.lineTo(20, 60);
  g.lineTo(0, 52);
  g.lineTo(-20, 60);
  g.lineTo(-20, 54);
  g.lineTo(-7, 44);
  g.lineTo(-7, 26);
  g.lineTo(-52, 36);                // aile gauche
  g.lineTo(-52, 26);
  g.lineTo(-7, 6);
  g.lineTo(-7, -16);
  g.closePath();
  g.fill(); g.stroke();
  return c.toDataURL();
}

export function GoogleEarth() {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [full, setFull] = useState(false);            // mode plein écran (exploration libre)
  const fullRef = useRef(false); fullRef.current = full;
  // ── Simulateur de vol (plein écran uniquement) ───────────────────────────────
  const [flying, setFlying] = useState(false);
  const flyingRef = useRef(false); flyingRef.current = flying;
  const startFlightRef = useRef<() => void>(() => {});
  const stopFlightRef = useRef<() => void>(() => {});
  const [hud, setHud] = useState({ speed: 150, alt: 4000, heading: 0, pitch: 0, roll: 0, throttle: 0.55 });
  const resizeKick = useRef<() => void>(() => {});
  const flyRef = useRef<(lat: number, lon: number) => void>(() => {});
  const searchRef = useRef<(q: string) => void>(() => {});
  const zoomRef = useRef<(dir: 1 | -1) => void>(() => {});
  const [search, setSearch] = useState("");

  useEffect(() => {
    let viewer: any = null;
    let cancelled = false;
    const fail = () => { if (!cancelled) setFailed(true); };
    const timeout = setTimeout(() => { if (!viewer) fail(); }, 11000);

    loadCesium().then((Cesium) => {
      if (cancelled || !ref.current) return;
      (async () => {
        try {
          // Pas d'ion : on évite toute dépendance à un token.
          try { Cesium.Ion.defaultAccessToken = ""; } catch { /* ignore */ }

          const imgProvider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(ESRI_IMG, { enablePickFeatures: false });
          viewer = new Cesium.Viewer(ref.current, {
            baseLayer: new Cesium.ImageryLayer(imgProvider),
            baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false,
            navigationHelpButton: false, animation: false, timeline: false, fullscreenButton: false,
            infoBox: false, selectionIndicator: false, requestRenderMode: false,
            creditContainer: document.createElement("div"),
            contextOptions: { webgl: { alpha: true } },
          });

          // Libellés de lieux par-dessus l'imagerie.
          try {
            const refProvider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(ESRI_REF, { enablePickFeatures: false });
            viewer.imageryLayers.addImageryProvider(refProvider);
          } catch { /* labels optionnels */ }

          const scene = viewer.scene;
          scene.globe.depthTestAgainstTerrain = false;
          scene.skyAtmosphere.show = true;
          scene.globe.enableLighting = true;
          scene.backgroundColor = Cesium.Color.fromCssColorString("#0a0710");
          if (scene.sun) scene.sun.show = true;
          if (scene.moon) scene.moon.show = false;
          viewer.cesiumWidget.creditContainer.style.display = "none";

          // ── Défilement de page préservé ─────────────────────────────────
          // Le zoom du globe ne capte plus la molette « nue » (sinon impossible
          // de scroller la home). Zoom = Ctrl/⌘ + molette, pincement, ou boutons.
          try {
            scene.screenSpaceCameraController.zoomEventTypes = [
              Cesium.CameraEventType.PINCH,
              { eventType: Cesium.CameraEventType.WHEEL, modifier: Cesium.KeyboardEventModifier.CTRL },
            ];
          } catch { /* ignore */ }
          // ── Zoom facile, scroll préservé ────────────────────────────────
          // La molette zoome le globe DÈS qu'on explore (vue rapprochée) ; en
          // vue « espace », elle fait défiler la page. Boutons +/- et double-
          // clic disponibles partout. Ctrl/⌘ + molette zoome toujours.
          try {
            scene.screenSpaceCameraController.zoomEventTypes = [
              Cesium.CameraEventType.WHEEL,
              Cesium.CameraEventType.PINCH,
            ];
          } catch { /* ignore */ }
          // Molette : en PLEIN ÉCRAN elle zoome librement (comme Google Maps).
          // En vue normale (intégrée), elle fait défiler la page — sauf Ctrl/⌘.
          const wheelGuard = (e: WheelEvent) => {
            if (fullRef.current) return;        // plein écran → Cesium zoome
            if (e.ctrlKey || e.metaKey) return; // Ctrl/⌘ → zoom même intégré
            e.stopPropagation(); e.preventDefault();
            const factor = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
            window.scrollBy(0, e.deltaY * factor);
          };
          ref.current!.addEventListener("wheel", wheelGuard, { capture: true, passive: false });
          (viewer as any)._axonWheelGuard = wheelGuard;

          // Zoom +/- FIABLE dans les deux sens : vol doux vers le point au
          // centre de l'écran, en multipliant/divisant l'altitude.
          zoomRef.current = (dir: 1 | -1) => {
            const cam = viewer.camera;
            const carto = cam.positionCartographic;
            const targetH = dir === 1
              ? Math.max(700, carto.height * 0.45)
              : Math.min(24_000_000, carto.height * 2.1);
            const canvas = scene.canvas;
            const center = cam.pickEllipsoid(new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2));
            let lon: number, lat: number;
            if (center) { const cc = Cesium.Cartographic.fromCartesian(center); lon = Cesium.Math.toDegrees(cc.longitude); lat = Cesium.Math.toDegrees(cc.latitude); }
            else { lon = Cesium.Math.toDegrees(carto.longitude); lat = Cesium.Math.toDegrees(carto.latitude); }
            cam.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(lon, lat, targetH),
              orientation: { heading: cam.heading, pitch: cam.pitch, roll: 0 },
              duration: 0.5,
            });
          };
          // Permet de forcer un resize Cesium quand on bascule en plein écran.
          resizeKick.current = () => { try { viewer.resize(); } catch { /* ignore */ } };

          // Double-clic → on plonge vers le point visé.
          const dbl = new Cesium.ScreenSpaceEventHandler(scene.canvas);
          dbl.setInputAction((ev: any) => {
            const cart = viewer.camera.pickEllipsoid(ev.position);
            if (!cart) return;
            const carto = Cesium.Cartographic.fromCartesian(cart);
            const newH = Math.max(1500, viewer.camera.positionCartographic.height * 0.35);
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(Cesium.Math.toDegrees(carto.longitude), Cesium.Math.toDegrees(carto.latitude), newH),
              orientation: { heading: 0, pitch: Cesium.Math.toRadians(newH < 60000 ? -55 : -90), roll: 0 },
              duration: 1.4,
            });
          }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

          // Vue initiale : globe plus grand (plus proche) et légèrement incliné.
          viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(20, 16, 13_500_000),
            orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
          });

          // ── Villes : points + libellés cliquables ────────────────────────
          for (const c of CITIES) {
            viewer.entities.add({
              id: `city-${c.name}`,
              position: Cesium.Cartesian3.fromDegrees(c.lon, c.lat),
              point: { pixelSize: 8, color: Cesium.Color.fromCssColorString("#c4a5ff"), outlineColor: Cesium.Color.fromCssColorString("#7c3aed"), outlineWidth: 2, scaleByDistance: new Cesium.NearFarScalar(1.5e6, 1.4, 2.0e7, 0.6) },
              label: { text: c.name, font: "600 13px Manrope, sans-serif", fillColor: Cesium.Color.WHITE, showBackground: true, backgroundColor: Cesium.Color.fromCssColorString("rgba(20,14,34,0.72)"), pixelOffset: new Cesium.Cartesian2(0, -18), scaleByDistance: new Cesium.NearFarScalar(1.5e6, 1.0, 2.0e7, 0.0), translucencyByDistance: new Cesium.NearFarScalar(1.5e7, 1.0, 2.4e7, 0.0) },
            });
          }

          // ── Arcs réseau : lignes virtuelles reliant les villes du monde ──
          const arcCity = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
            const start = Cesium.Cartographic.fromDegrees(a.lon, a.lat);
            const end = Cesium.Cartographic.fromDegrees(b.lon, b.lat);
            const geo = new Cesium.EllipsoidGeodesic(start, end);
            const n = 64;
            const peak = Math.min(2_400_000, 350_000 + geo.surfaceDistance * 0.16);
            const pts: any[] = [];
            for (let i = 0; i <= n; i++) {
              const f = i / n;
              const c = geo.interpolateUsingFraction(f);
              pts.push(Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, Math.sin(f * Math.PI) * peak));
            }
            return pts;
          };
          // Maillage : chaque ville reliée à 2 autres → toile sur le globe.
          const links: [number, number][] = [];
          for (let i = 0; i < CITIES.length; i++) {
            links.push([i, (i + 1) % CITIES.length]);
            links.push([i, (i + 3) % CITIES.length]);
          }
          links.forEach(([i, j], k) => {
            viewer.entities.add({
              polyline: {
                positions: arcCity(CITIES[i], CITIES[j]),
                width: 1.6,
                material: new Cesium.PolylineGlowMaterialProperty({
                  glowPower: 0.22,
                  color: new Cesium.CallbackProperty(() => {
                    // Pulsation lumineuse décalée par arc.
                    const a = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(Date.now() * 0.0016 + k));
                    return Cesium.Color.fromCssColorString("#c4a5ff").withAlpha(a);
                  }, false),
                }),
              },
            });
          });
          // Impulsions voyageant sur les arcs.
          const pulseLinks = links.slice(0, 6);
          pulseLinks.forEach(([i, j], k) => {
            const path = arcCity(CITIES[i], CITIES[j]);
            viewer.entities.add({
              position: new Cesium.CallbackProperty(() => {
                const f = ((Date.now() * 0.00018 + k * 0.16) % 1);
                const idx = Math.min(path.length - 1, Math.floor(f * path.length));
                return path[idx];
              }, false),
              point: { pixelSize: 6, color: Cesium.Color.WHITE, outlineColor: Cesium.Color.fromCssColorString("#c4a5ff"), outlineWidth: 1 },
            });
          });

          // ── Satellites = réseaux sociaux en orbite ───────────────────────
          const sats = [
            { kind: "fb" as const, alt: 1_400_000, inc: 18, speed: 9, phase: 0 },
            { kind: "ig" as const, alt: 1_900_000, inc: -26, speed: 7, phase: 90 },
            { kind: "li" as const, alt: 2_500_000, inc: 40, speed: 5.5, phase: 200 },
            { kind: "tt" as const, alt: 3_100_000, inc: -34, speed: 4.5, phase: 300 },
          ];
          const satEntities = sats.map((s) =>
            viewer.entities.add({
              position: new Cesium.CallbackProperty(() => {
                const t = Date.now() * 0.001;
                const lon = ((s.phase + t * s.speed) % 360) - 180;
                const lat = s.inc * Math.sin(t * s.speed * 0.03 + s.phase);
                return Cesium.Cartesian3.fromDegrees(lon, lat, 6_371_000 + s.alt);
              }, false),
              billboard: { image: logoDataUrl(s.kind), width: 42, height: 42, scaleByDistance: new Cesium.NearFarScalar(2e6, 1.2, 4e7, 0.45) },
            })
          );
          void satEntities;

          // ── Vol vers une ville / un lieu ─────────────────────────────────
          // On arrive en vue RÉGIONALE (à plat) : on voit la zone, puis on
          // zoome tranquillement avec +/- ou la molette (plein écran).
          flyRef.current = (lat: number, lon: number) => {
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(lon, lat, 90_000),
              orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
              duration: 2.6,
            });
            lastInteract = Date.now();
          };
          searchRef.current = async (q: string) => {
            try {
              const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`, { headers: { "Accept-Language": "fr" } });
              const d = await r.json();
              if (d?.[0]) flyRef.current(parseFloat(d[0].lat), parseFloat(d[0].lon));
            } catch { /* ignore */ }
          };

          // Clic sur une ville → vol.
          const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
          handler.setInputAction((click: any) => {
            const picked = scene.pick(click.position);
            if (picked?.id?.position) {
              const carto = Cesium.Cartographic.fromCartesian(picked.id.position.getValue(Cesium.JulianDate.now()));
              flyRef.current(Cesium.Math.toDegrees(carto.latitude), Cesium.Math.toDegrees(carto.longitude));
            }
            lastInteract = Date.now();
          }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

          // ── Simulateur de vol RÉALISTE (tangage / roulis / cap) ──────────
          // Modèle de vol : virage coordonné (le cap suit le roulis & la vitesse),
          // tangage = montée/descente, gaz = vitesse. Caméra à la poursuite,
          // l'horizon s'incline avec le roulis → vraie sensation de pilotage.
          const FLY = {
            active: false, lon: 0, lat: 0, alt: 4000,
            heading: 0, pitch: 0, roll: 0, speed: 150, throttle: 0.55,
            raf: 0, last: 0, hudLast: 0, plane: null as any,
            keys: {} as Record<string, boolean>,
          };
          const FLY_KEYS = ["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"];
          const onFlyKeyDown = (e: KeyboardEvent) => {
            if (!FLY.active) return;
            const k = e.key.toLowerCase();
            if (k === "escape") { setFlying(false); return; }
            if (FLY_KEYS.includes(k)) { e.preventDefault(); FLY.keys[k] = true; }
          };
          const onFlyKeyUp = (e: KeyboardEvent) => { FLY.keys[e.key.toLowerCase()] = false; };

          function flyTick() {
            if (!FLY.active) return;
            const now = performance.now();
            const dt = Math.min((now - FLY.last) / 1000, 0.05); FLY.last = now;
            const K = FLY.keys;
            // Roulis (←/→ ou A/D) avec retour à plat
            const rollMax = Cesium.Math.toRadians(62), rollRate = Cesium.Math.toRadians(75);
            if (K.arrowleft || K.a) FLY.roll = Math.max(FLY.roll - rollRate * dt, -rollMax);
            else if (K.arrowright || K.d) FLY.roll = Math.min(FLY.roll + rollRate * dt, rollMax);
            else FLY.roll *= Math.max(0, 1 - 2.4 * dt);
            // Tangage (↑/↓) avec léger rappel
            const pitchMax = Cesium.Math.toRadians(34), pitchRate = Cesium.Math.toRadians(42);
            if (K.arrowup) FLY.pitch = Math.min(FLY.pitch + pitchRate * dt, pitchMax);
            else if (K.arrowdown) FLY.pitch = Math.max(FLY.pitch - pitchRate * dt, -pitchMax);
            else FLY.pitch *= Math.max(0, 1 - 0.9 * dt);
            // Gaz (W/S)
            if (K.w) FLY.throttle = Math.min(1, FLY.throttle + 0.45 * dt);
            if (K.s) FLY.throttle = Math.max(0.12, FLY.throttle - 0.45 * dt);
            const targetSpeed = 55 + FLY.throttle * 545; // ~55..600 m/s
            FLY.speed += (targetSpeed - FLY.speed) * Math.min(1, 1.3 * dt);
            // Virage coordonné : g·tan(roulis)/vitesse
            FLY.heading += (9.81 * Math.tan(FLY.roll) / Math.max(FLY.speed, 40)) * dt;
            FLY.heading = ((FLY.heading % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
            // Déplacement dans le repère local (Est-Nord-Haut)
            const pos = Cesium.Cartesian3.fromDegrees(FLY.lon, FLY.lat, FLY.alt);
            const enu = Cesium.Transforms.eastNorthUpToFixedFrame(pos);
            const rot = Cesium.Matrix4.getMatrix3(enu, new Cesium.Matrix3());
            const cp = Math.cos(FLY.pitch);
            const dir = new Cesium.Cartesian3(Math.sin(FLY.heading) * cp, Math.cos(FLY.heading) * cp, Math.sin(FLY.pitch));
            Cesium.Cartesian3.multiplyByScalar(dir, FLY.speed * dt, dir);
            const disp = Cesium.Matrix3.multiplyByVector(rot, dir, new Cesium.Cartesian3());
            const np = Cesium.Cartographic.fromCartesian(Cesium.Cartesian3.add(pos, disp, new Cesium.Cartesian3()));
            FLY.lon = Cesium.Math.toDegrees(np.longitude);
            FLY.lat = Cesium.Math.toDegrees(np.latitude);
            FLY.alt = Math.min(Math.max(np.height, 120), 130000);
            if (FLY.plane) FLY.plane.position = Cesium.Cartesian3.fromDegrees(FLY.lon, FLY.lat, FLY.alt);
            // Caméra à la poursuite : derrière + au-dessus, inclinée avec le roulis
            const back = 230 + FLY.speed * 0.7, up = 60 + FLY.speed * 0.14;
            const camPos = Cesium.Cartesian3.fromDegrees(FLY.lon, FLY.lat, FLY.alt);
            const enu2 = Cesium.Matrix4.getMatrix3(Cesium.Transforms.eastNorthUpToFixedFrame(camPos), new Cesium.Matrix3());
            const camLocal = new Cesium.Cartesian3(-Math.sin(FLY.heading) * back, -Math.cos(FLY.heading) * back, up);
            const camDisp = Cesium.Matrix3.multiplyByVector(enu2, camLocal, new Cesium.Cartesian3());
            viewer.camera.setView({
              destination: Cesium.Cartesian3.add(camPos, camDisp, new Cesium.Cartesian3()),
              orientation: { heading: FLY.heading, pitch: FLY.pitch - 0.14, roll: FLY.roll },
            });
            if (now - FLY.hudLast > 80) {
              FLY.hudLast = now;
              setHud({ speed: FLY.speed, alt: FLY.alt, heading: Cesium.Math.toDegrees(FLY.heading), pitch: Cesium.Math.toDegrees(FLY.pitch), roll: Cesium.Math.toDegrees(FLY.roll), throttle: FLY.throttle });
            }
            FLY.raf = requestAnimationFrame(flyTick);
          }

          startFlightRef.current = () => {
            if (FLY.active) return;
            const carto = viewer.camera.positionCartographic;
            FLY.lon = Cesium.Math.toDegrees(carto.longitude);
            FLY.lat = Cesium.Math.toDegrees(carto.latitude);
            FLY.alt = Math.min(Math.max(carto.height, 2000), 8000);
            FLY.heading = viewer.camera.heading || 0;
            FLY.pitch = 0; FLY.roll = 0; FLY.speed = 160; FLY.throttle = 0.55; FLY.keys = {};
            FLY.active = true;
            scene.screenSpaceCameraController.enableInputs = false;
            FLY.plane = viewer.entities.add({
              position: Cesium.Cartesian3.fromDegrees(FLY.lon, FLY.lat, FLY.alt),
              billboard: { image: planeDataUrl(), width: 52, height: 52, disableDepthTestDistance: Number.POSITIVE_INFINITY },
            });
            window.addEventListener("keydown", onFlyKeyDown);
            window.addEventListener("keyup", onFlyKeyUp);
            FLY.last = performance.now();
            FLY.raf = requestAnimationFrame(flyTick);
          };
          stopFlightRef.current = () => {
            if (!FLY.active) return;
            FLY.active = false;
            cancelAnimationFrame(FLY.raf);
            window.removeEventListener("keydown", onFlyKeyDown);
            window.removeEventListener("keyup", onFlyKeyUp);
            try { if (FLY.plane) viewer.entities.remove(FLY.plane); } catch { /* ignore */ }
            FLY.plane = null;
            try { scene.screenSpaceCameraController.enableInputs = true; } catch { /* ignore */ }
            lastInteract = Date.now();
          };

          // Auto-rotation douce quand inactif (jamais pendant un vol).
          let lastInteract = Date.now();
          scene.canvas.addEventListener("pointerdown", () => { lastInteract = Date.now(); });
          scene.canvas.addEventListener("wheel", () => { lastInteract = Date.now(); });
          scene.postRender.addEventListener(() => {
            if (FLY.active) return;
            if (Date.now() - lastInteract > 4500 && viewer.camera.positionCartographic.height > 5_000_000) {
              viewer.camera.rotate(Cesium.Cartesian3.UNIT_Z, -0.00045);
            }
          });

          clearTimeout(timeout);
          if (!cancelled) setReady(true);
        } catch (e) {
          console.warn("[GoogleEarth] init Cesium échouée → repli globe three.js", e);
          fail();
        }
      })();
    }).catch(fail);

    void resizeKick;
    const node = ref.current;
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      try {
        if (viewer?._axonWheelGuard && node) node.removeEventListener("wheel", viewer._axonWheelGuard, { capture: true } as any);
      } catch { /* ignore */ }
      try { if (viewer) viewer.destroy(); } catch { /* ignore */ }
    };
  }, []);

  // Bascule plein écran : on redimensionne Cesium, on verrouille le scroll de
  // la page derrière, et Échap permet de sortir.
  useEffect(() => {
    if (!full) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t1 = setTimeout(() => resizeKick.current(), 60);
    const t2 = setTimeout(() => resizeKick.current(), 360);
    // Échap : quitte d'abord le pilotage s'il est actif, sinon le plein écran.
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { if (flyingRef.current) setFlying(false); else setFull(false); } };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      clearTimeout(t1); clearTimeout(t2);
      window.removeEventListener("keydown", onKey);
      setFlying(false); // on ne pilote jamais hors plein écran
      setTimeout(() => resizeKick.current(), 60);
    };
  }, [full]);

  // Démarre / arrête le simulateur de vol selon l'état (et à la sortie).
  useEffect(() => {
    if (flying) startFlightRef.current();
    return () => { stopFlightRef.current(); };
  }, [flying]);

  if (failed) return <GlobeHero />;

  return (
    <div className={`globe-hero${full ? " earth-full" : ""}`}>
      <div ref={ref} className="globe-canvas earth3d-canvas" />
      {!ready && <div className="earth3d-loading">Chargement de la Terre…</div>}

      {/* Bouton plein écran / sortie : l'exploration libre (molette = zoom) */}
      {ready && !flying && (
        <button type="button" className="globe-full-btn" onClick={() => setFull((f) => !f)}>
          {full ? "✕ Quitter" : "⛶ Explorer en plein écran"}
        </button>
      )}

      {/* Simulateur de vol : disponible UNIQUEMENT en plein écran */}
      {ready && full && !flying && (
        <button type="button" className="fsim-launch" onClick={() => setFlying(true)}>
          🛩️ Piloter le monde
        </button>
      )}

      {/* HUD du simulateur de vol */}
      {flying && (
        <div className="fsim">
          <button type="button" className="fsim-exit" onClick={() => setFlying(false)}>✕ Quitter le pilotage</button>

          {/* Horizon artificiel + cap/vitesse/altitude */}
          <div className="fsim-hud">
            <div className="fsim-adi" aria-hidden>
              <div className="fsim-adi-sky" style={{ transform: `rotate(${-hud.roll}deg) translateY(${Math.max(-46, Math.min(46, hud.pitch * 1.6))}px)` }} />
              <div className="fsim-adi-grid" />
              <div className="fsim-adi-plane" />
            </div>
            <div className="fsim-gauge fsim-spd"><b>{Math.round(hud.speed * 3.6)}</b><span>km/h</span></div>
            <div className="fsim-gauge fsim-alt"><b>{hud.alt >= 1000 ? (hud.alt / 1000).toFixed(1) : Math.round(hud.alt)}</b><span>{hud.alt >= 1000 ? "km alt" : "m alt"}</span></div>
            <div className="fsim-gauge fsim-hdg"><b>{String(Math.round((hud.heading + 360) % 360)).padStart(3, "0")}°</b><span>cap</span></div>
            <div className="fsim-thr"><div className="fsim-thr-fill" style={{ height: `${Math.round(hud.throttle * 100)}%` }} /><span>gaz</span></div>
          </div>

          <div className="fsim-help">
            <b>Pilotage</b> · <kbd>↑</kbd><kbd>↓</kbd> tangage · <kbd>←</kbd><kbd>→</kbd> roulis (virage) · <kbd>W</kbd><kbd>S</kbd> gaz · <kbd>Échap</kbd> quitter
          </div>
        </div>
      )}

      {/* Invitation (mode intégré uniquement) */}
      {ready && !full && (
        <div className="globe-invite">
          <span className="globe-invite-dot" />
          {"Cliquez une ville, ou « Explorer en plein écran » pour zoomer jusqu'à votre rue — ou piloter le monde 🛩️"}
        </div>
      )}

      {/* Commandes de zoom (masquées en vol) */}
      {ready && !flying && (
        <div className="globe-zoom">
          <button type="button" aria-label="Zoomer" onClick={() => zoomRef.current(1)}>+</button>
          <button type="button" aria-label="Dézoomer" onClick={() => zoomRef.current(-1)}>−</button>
        </div>
      )}

      {!flying && (
        <form className="globe-search" onSubmit={(e) => { e.preventDefault(); if (search.trim()) searchRef.current(search.trim()); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Atterrir sur un lieu : Pékin, New York, Flic-en-Flac…" aria-label="Rechercher un lieu" />
          <button type="submit">Aller</button>
        </form>
      )}

      {!flying && (
        <div className="globe-chips">
          <span className="globe-hint">{full ? "Molette = zoom · glissez = tourner · double-clic = plonger" : "Cliquez une ville pour la survoler · zoom avec +/−"}</span>
          {CITIES.map((c) => (
            <button key={c.name} type="button" className="globe-chip" onClick={() => flyRef.current(c.lat, c.lon)}>{c.name}</button>
          ))}
        </div>
      )}
    </div>
  );
}
