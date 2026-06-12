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

export function GoogleEarth() {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
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
          const ENGAGE_H = 5_000_000; // sous ce niveau → on explore
          const wheelGuard = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) return; // zoom globe
            const h = viewer?.camera?.positionCartographic?.height ?? 1e9;
            if (h < ENGAGE_H) return;            // en exploration → la molette zoome
            // En vue espace → la page défile.
            e.stopPropagation(); e.preventDefault();
            const factor = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
            window.scrollBy(0, e.deltaY * factor);
          };
          ref.current!.addEventListener("wheel", wheelGuard, { capture: true, passive: false });
          (viewer as any)._axonWheelGuard = wheelGuard;

          // Boutons +/- (zoom relatif à l'altitude courante → fluide).
          zoomRef.current = (dir: 1 | -1) => {
            const h = viewer.camera.positionCartographic.height;
            if (dir === 1) viewer.camera.zoomIn(h * 0.45);
            else viewer.camera.zoomOut(h * 0.55);
          };

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
          flyRef.current = (lat: number, lon: number) => {
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(lon, lat, 1800),
              orientation: { heading: 0, pitch: Cesium.Math.toRadians(-55), roll: 0 },
              duration: 3.4,
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

          // Auto-rotation douce quand inactif.
          let lastInteract = Date.now();
          scene.canvas.addEventListener("pointerdown", () => { lastInteract = Date.now(); });
          scene.canvas.addEventListener("wheel", () => { lastInteract = Date.now(); });
          scene.postRender.addEventListener(() => {
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

  if (failed) return <GlobeHero />;

  return (
    <div className="globe-hero">
      <div ref={ref} className="globe-canvas earth3d-canvas" />
      {!ready && <div className="earth3d-loading">Chargement de la Terre…</div>}

      {/* Invitation à zoomer */}
      {ready && (
        <div className="globe-invite">
          <span className="globe-invite-dot" />
          {"Zoomez (+/− ou double-clic) jusqu'à votre rue — Paris, New York, Flic-en-Flac…"}
        </div>
      )}

      {/* Commandes de zoom bien visibles */}
      {ready && (
        <div className="globe-zoom">
          <button type="button" aria-label="Zoomer" onClick={() => zoomRef.current(1)}>+</button>
          <button type="button" aria-label="Dézoomer" onClick={() => zoomRef.current(-1)}>−</button>
        </div>
      )}

      <form className="globe-search" onSubmit={(e) => { e.preventDefault(); if (search.trim()) searchRef.current(search.trim()); }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Atterrir sur un lieu : Pékin, New York, Flic-en-Flac…" aria-label="Rechercher un lieu" />
        <button type="submit">Explorer</button>
      </form>

      <div className="globe-chips">
        <span className="globe-hint">Cliquez une ville ou double-cliquez pour plonger · +/− ou molette (en exploration) pour zoomer</span>
        {CITIES.map((c) => (
          <button key={c.name} type="button" className="globe-chip" onClick={() => flyRef.current(c.lat, c.lon)}>{c.name}</button>
        ))}
      </div>
    </div>
  );
}
