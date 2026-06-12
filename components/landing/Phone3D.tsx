"use client";

// ── Phone3D — téléphone 3D animé (CSS 3D, zéro dépendance) ────────────────────
// Remplace le visuel statique : un smartphone qui flotte et tourne en 3D, avec
// un fil social vivant à l'intérieur (logos réseaux, barres d'analyse animées,
// pastille « live »). Léger, GPU-only, figé si prefers-reduced-motion.

const BARS = [42, 66, 38, 84, 58, 92, 50];

export function Phone3D() {
  return (
    <div className="phone3d" aria-hidden>
      <div className="phone3d-stage">
        <div className="phone3d-body">
          <div className="phone3d-notch" />
          <div className="phone3d-screen">
            {/* En-tête appli */}
            <div className="phone3d-head">
              <span className="phone3d-avatar" />
              <span className="phone3d-lines"><i /><i /></span>
              <span className="phone3d-live">LIVE</span>
            </div>
            {/* Réseaux connectés */}
            <div className="phone3d-nets">
              <span className="p3-net p3-fb">f</span>
              <span className="p3-net p3-ig">○</span>
              <span className="p3-net p3-li">in</span>
              <span className="p3-net p3-tt">♪</span>
            </div>
            {/* Média (dégradé animé) */}
            <div className="phone3d-media" />
            {/* Graphe de performance */}
            <div className="phone3d-chart">
              {BARS.map((h, i) => (
                <span key={i} style={{ height: `${h}%`, animationDelay: `${i * 0.12}s` }} />
              ))}
            </div>
            <div className="phone3d-foot"><i /><i /></div>
          </div>
        </div>
        <div className="phone3d-glow" />
      </div>
    </div>
  );
}
