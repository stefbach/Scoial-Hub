"use client";

// ── Phone3D — smartphone réaliste premium (CSS 3D, zéro dépendance) ───────────
// Châssis type iPhone (île dynamique, boutons latéraux, reflet de verre), avec
// à l'écran une interface AXON crédible : post de marque cross-réseaux,
// métriques réelles, navigation. Flotte/tourne en 3D ; figé si reduced-motion.

const BARS = [38, 60, 34, 78, 52, 88, 46, 70];

export function Phone3D() {
  return (
    <div className="ph" aria-hidden>
      <div className="ph-float">
        <div className="ph-frame">
          {/* Boutons physiques */}
          <span className="ph-btn ph-vol-up" />
          <span className="ph-btn ph-vol-dn" />
          <span className="ph-btn ph-power" />

          <div className="ph-screen">
            {/* Barre d'état */}
            <div className="ph-status">
              <span className="ph-time">9:41</span>
              <span className="ph-status-icons">
                <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="6" width="3" height="5" rx="1" opacity=".5"/><rect x="4" y="4" width="3" height="7" rx="1" opacity=".7"/><rect x="8" y="2" width="3" height="9" rx="1" opacity=".85"/><rect x="12" y="0" width="3" height="11" rx="1"/></svg>
                <svg width="15" height="11" viewBox="0 0 15 11" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M1 4.2a9 9 0 0 1 13 0M3.2 6.4a6 6 0 0 1 8.6 0M5.4 8.6a3 3 0 0 1 4.2 0"/></svg>
                <svg width="22" height="11" viewBox="0 0 24 12" fill="none"><rect x="1" y="1" width="20" height="10" rx="2.5" stroke="currentColor" strokeWidth="1" opacity=".6"/><rect x="2.5" y="2.5" width="15" height="7" rx="1.2" fill="currentColor"/><rect x="22" y="4" width="1.6" height="4" rx="1" fill="currentColor" opacity=".6"/></svg>
              </span>
            </div>

            {/* Île dynamique */}
            <div className="ph-island" />

            {/* En-tête appli */}
            <div className="ph-appbar">
              <span className="ph-logo"><b>A</b></span>
              <div className="ph-appttl"><b>AXON</b><i>Tibok Clinic</i></div>
              <span className="ph-bell">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>
                <i className="ph-bell-dot" />
              </span>
            </div>

            {/* Onglets */}
            <div className="ph-tabs">
              <span className="on">Publier</span><span>Pubs</span><span>Boîte</span>
            </div>

            {/* Carte de post cross-réseaux */}
            <div className="ph-card">
              <div className="ph-card-h">
                <span className="ph-av" />
                <div className="ph-card-id"><b>Tibok Clinic</b><i>@tibok · maintenant</i></div>
                <span className="ph-nets">
                  <span className="ph-n ph-fb">f</span>
                  <span className="ph-n ph-ig" />
                  <span className="ph-n ph-li">in</span>
                </span>
              </div>
              <div className="ph-media">
                <span className="ph-media-sky" />
                <span className="ph-media-city" />
                <span className="ph-media-glow" />
              </div>
              <div className="ph-cap"><i style={{ width: "92%" }} /><i style={{ width: "74%" }} /></div>
              <div className="ph-act">
                <span className="ph-a ph-like"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.5S4.5 15.6 4.5 10.4C4.5 7.8 6.5 6 8.8 6c1.3 0 2.5.6 3.2 1.6C12.7 6.6 13.9 6 15.2 6c2.3 0 4.3 1.8 4.3 4.4 0 5.2-7.5 10.1-7.5 10.1Z"/></svg>2,4k</span>
                <span className="ph-a"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 11.5a8 8 0 0 1-11.6 7.1L4 20.5l1.9-5.3A8 8 0 1 1 21 11.5Z"/></svg>318</span>
                <span className="ph-a"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13"/></svg>96</span>
              </div>
            </div>

            {/* Bandeau métriques */}
            <div className="ph-kpis">
              <div className="ph-kpi"><b>12,4k</b><i>Portée</i></div>
              <div className="ph-kpi"><b>4,8%</b><i>Engagement</i></div>
              <div className="ph-kpi"><b>+38%</b><i>7 jours</i></div>
            </div>
            <div className="ph-chart">
              {BARS.map((h, i) => <span key={i} style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }} />)}
            </div>

            {/* Barre de navigation */}
            <div className="ph-nav">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 11l9-8 9 8M5 10v10h14V10"/></svg>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 19.5h18M4.5 15l5-5 3.5 3.5L20 6.5"/></svg>
              <span className="ph-nav-fab"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg></span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 5h16v10H8l-4 4z"/></svg>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/></svg>
            </div>
          </div>

          {/* Reflet de verre */}
          <span className="ph-glare" />
        </div>
        <span className="ph-shadow" />
      </div>
    </div>
  );
}
