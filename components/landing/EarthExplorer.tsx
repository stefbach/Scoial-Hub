"use client";

// ── EarthExplorer — atterrissage satellite façon Google Earth ────────────────
// Overlay plein écran : tuiles satellite RÉELLES (Esri World Imagery, sans clé),
// zoomables en continu jusqu'au niveau rue, + recherche de n'importe quel lieu
// du monde (Pékin, New York, Paris, Port-Louis, Flic-en-Flac…) via Nominatim.
//
// Leaflet est chargé depuis le CDN au moment de l'ouverture (aucune dépendance
// npm ajoutée). Repli silencieux si hors-ligne.

import { useEffect, useRef, useState } from "react";

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

// Charge Leaflet une seule fois (promesse mémorisée au niveau module).
let leafletPromise: Promise<unknown> | null = null;
function loadLeaflet(): Promise<unknown> {
  if (typeof window === "undefined") return Promise.reject();
  const w = window as unknown as { L?: unknown };
  if (w.L) return Promise.resolve(w.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve((window as unknown as { L: unknown }).L);
    script.onerror = reject;
    document.body.appendChild(script);
  });
  return leafletPromise;
}

export interface Place { lat: number; lon: number; name: string; query?: string }

/** Géocodage Nominatim → première correspondance, ou null. */
async function geocode(q: string): Promise<{ lat: number; lon: number; label: string } | null> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`, {
      headers: { "Accept-Language": "fr" },
    });
    const data = (await r.json()) as { lat: string; lon: string; display_name: string }[];
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), label: data[0].display_name.split(",").slice(0, 2).join(", ") };
  } catch { return null; }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function EarthExplorer({ place, onClose }: { place: Place | null; onClose: () => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [label, setLabel] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // Init/destroy de la carte quand l'overlay s'ouvre/ferme.
  useEffect(() => {
    if (!place) return;
    let cancelled = false;
    setLabel(place.name);
    setErr(null);

    loadLeaflet()
      .then((Lraw) => {
        if (cancelled || !mapRef.current) return;
        const L = Lraw as any;
        const map = L.map(mapRef.current, { zoomControl: false, attributionControl: true, worldCopyJump: true })
          .setView([place.lat, place.lon], 13);
        mapObj.current = map;

        // Imagerie satellite Esri (sans clé) + libellés de lieux.
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 19, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" }
        ).addTo(map);
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 19, opacity: 0.9 }
        ).addTo(map);

        L.control.zoom({ position: "bottomright" }).addTo(map);
        markerRef.current = L.circleMarker([place.lat, place.lon], {
          radius: 7, color: "#c4a5ff", weight: 2, fillColor: "#7c3aed", fillOpacity: 0.85,
        }).addTo(map);

        // Si ouvert via une recherche libre : on géocode puis on y vole.
        if (place.query) {
          geocode(place.query).then((res) => {
            if (cancelled || !res) { if (!res) setErr("Lieu introuvable — précisez (ville, pays)."); return; }
            setLabel(res.label);
            map.flyTo([res.lat, res.lon], 16, { duration: 2.4 });
            markerRef.current?.setLatLng([res.lat, res.lon]);
          });
        } else {
          // Plongée fluide vers le niveau rue après l'atterrissage.
          setTimeout(() => { if (!cancelled) map.flyTo([place.lat, place.lon], 16, { duration: 2.2 }); }, 250);
        }
      })
      .catch(() => { if (!cancelled) setErr("Carte satellite indisponible (hors-ligne)."); });

    return () => {
      cancelled = true;
      if (mapObj.current) { mapObj.current.remove(); mapObj.current = null; }
    };
  }, [place]);

  // Fermeture au clavier (Échap).
  useEffect(() => {
    if (!place) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [place, onClose]);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true); setErr(null);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`, {
        headers: { "Accept-Language": "fr" },
      });
      const data = (await r.json()) as { lat: string; lon: string; display_name: string }[];
      if (!data.length) { setErr("Lieu introuvable — précisez (ville, pays)."); return; }
      const lat = parseFloat(data[0].lat), lon = parseFloat(data[0].lon);
      setLabel(data[0].display_name.split(",").slice(0, 2).join(", "));
      const map = mapObj.current;
      if (map) {
        const L = (window as unknown as { L: any }).L;
        map.flyTo([lat, lon], 16, { duration: 2 });
        if (markerRef.current) markerRef.current.setLatLng([lat, lon]);
        else markerRef.current = L.circleMarker([lat, lon], { radius: 7, color: "#c4a5ff", weight: 2, fillColor: "#7c3aed", fillOpacity: 0.85 }).addTo(map);
      }
    } catch {
      setErr("Recherche indisponible. Réessayez.");
    } finally { setSearching(false); }
  }

  if (!place) return null;

  return (
    <div className="earth-ex" role="dialog" aria-modal="true" aria-label="Explorateur satellite">
      <div ref={mapRef} className="earth-ex-map" />

      {/* Barre supérieure : recherche + lieu courant + fermer */}
      <div className="earth-ex-top">
        <form onSubmit={search} className="earth-ex-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cherchez un lieu : Pékin, New York, Flic-en-Flac…"
            aria-label="Rechercher un lieu"
          />
          <button type="submit" disabled={searching}>{searching ? "…" : "Aller"}</button>
        </form>
        <span className="earth-ex-place">{label}</span>
        <button type="button" onClick={onClose} className="earth-ex-close" aria-label="Fermer">✕</button>
      </div>

      {err && <div className="earth-ex-err">{err}</div>}
      <div className="earth-ex-hint">Molette / pincement pour zoomer · glissez pour explorer</div>
    </div>
  );
}
