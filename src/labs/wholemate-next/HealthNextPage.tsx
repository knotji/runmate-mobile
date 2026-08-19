import { useEffect, useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { RECOVERY_TREND, HEALTH_STAT_TILES, DATA_SOURCES } from './mockHealth';
import { LabNav } from './LabNav';
import './tokens.css';
import './shared.css';
import './HealthNextPage.css';

const STATE_LABEL: Record<(typeof DATA_SOURCES)[number]['state'], string> = {
  ok: 'Synced',
  stale: 'Stale',
  missing: 'Missing',
};

const HealthNextPage: React.FC = () => {
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setGrown(true), 40);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <IonPage>
      <IonContent fullscreen scrollY className="wmn-content">
        <div className="wm-next wmn-health">
          <div className="wmn-lab-banner">
            <span>WholeMate Next — Health prototype</span>
            <span className="wmn-lab-banner-tag">not shipped</span>
          </div>

          <header className="wmn-health-header">
            <span className="wmn-hero-eyebrow wmn-health-eyebrow-dark">What’s Changing Over Time</span>
            <h1 className="wmn-health-title">Health</h1>
          </header>

          {/* Anchor module — the one trend worth seeing before anything else */}
          <section className="wmn-card wmn-trend-card">
            <span className="wmn-eyebrow">Recovery · 7 Days</span>
            <p className="wmn-trend-value">86<small>/100 today</small></p>
            <div className="wmn-trend-bars" role="img" aria-label="Recovery over the last 7 days">
              {RECOVERY_TREND.map((day, index) => (
                <div key={day.label} className="wmn-trend-bar-col">
                  <div className="wmn-trend-bar-track">
                    <div
                      className={`wmn-trend-bar-fill wmn-trend-bar-${day.status}`}
                      style={{
                        height: grown ? `${day.value}%` : '0%',
                        transitionDelay: `${index * 45}ms`,
                      }}
                    />
                  </div>
                  <span className="wmn-trend-bar-label">{day.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Modular grid — scannable, independent tiles */}
          <section className="wmn-stat-grid" aria-label="Health signals this week">
            {HEALTH_STAT_TILES.map((tile) => {
              const positive = tile.deltaDirection === 'flat' ? true : tile.deltaDirection === tile.goodDirection;
              return (
                <div key={tile.key} className="wmn-card wmn-stat-tile">
                  <span className="wmn-eyebrow wmn-stat-eyebrow">{tile.eyebrow}</span>
                  <p className="wmn-stat-value">
                    {tile.value}
                    {tile.unit && <small>{tile.unit}</small>}
                  </p>
                  <span className={`wmn-stat-delta${positive ? ' positive' : ''}`}>
                    {tile.deltaDirection !== 'flat' && (
                      <i className={`wmn-stat-delta-arrow wmn-stat-delta-arrow-${tile.deltaDirection}`} aria-hidden="true" />
                    )}
                    {tile.deltaLabel}
                  </span>
                </div>
              );
            })}
          </section>

          {/* Provenance module — "missing stays missing," never smoothed over */}
          <section className="wmn-card wmn-sources-card">
            <span className="wmn-eyebrow">Data Sources & Freshness</span>
            <ul className="wmn-sources-list">
              {DATA_SOURCES.map((source) => (
                <li key={source.label} className="wmn-sources-row">
                  <div>
                    <p className="wmn-sources-label">{source.label}</p>
                    <p className="wmn-sources-detail">{source.detail}</p>
                  </div>
                  <span className={`wmn-sources-tag wmn-sources-tag-${source.state}`}>{STATE_LABEL[source.state]}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </IonContent>
      <LabNav active="health" />
    </IonPage>
  );
};

export default HealthNextPage;
