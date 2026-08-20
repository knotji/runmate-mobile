import { useCallback, useEffect, useState } from 'react';
import { IonContent, IonIcon, IonPage } from '@ionic/react';
import { personCircleOutline } from 'ionicons/icons';
import { RECOVERY_TREND, HEALTH_STAT_TILES, DATA_SOURCES, type DataSourceRow, type StatTile, type TrendDay } from './mockHealth';
import { loadRealHealthData, type RealHealthResult } from './realHealth';
import { LabNav } from './LabNav';
import './tokens.css';
import './shared.css';
import './HealthNextPage.css';

const STATE_LABEL: Record<DataSourceRow['state'], string> = {
  ok: 'Synced',
  stale: 'Stale',
  missing: 'Missing',
};

const STATE_PANEL_COPY: Record<Exclude<RealHealthResult['status'], 'ready'>, { title: string; detail: string }> = {
  unauthenticated: { title: 'Log In To Preview Real Data', detail: 'This device isn’t signed in, so there’s no account context to load. Mock data still works without one.' },
  error: { title: 'Couldn’t Load Your Data', detail: '' },
};

const HealthNextPage: React.FC = () => {
  const [grown, setGrown] = useState(false);
  const [dataMode, setDataMode] = useState<'mock' | 'real'>('mock');
  const [realLoading, setRealLoading] = useState(false);
  const [realResult, setRealResult] = useState<RealHealthResult | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setGrown(true), 40);
    return () => window.clearTimeout(id);
  }, []);

  const switchToRealData = useCallback(async () => {
    setDataMode('real');
    setRealLoading(true);
    const result = await loadRealHealthData();
    setRealResult(result);
    setRealLoading(false);
  }, []);

  const switchToMockData = () => setDataMode('mock');

  const trend: TrendDay[] = dataMode === 'real' && realResult?.status === 'ready' ? realResult.trend : RECOVERY_TREND;
  const tiles: StatTile[] = dataMode === 'real' && realResult?.status === 'ready' ? realResult.tiles : HEALTH_STAT_TILES;
  const sources: DataSourceRow[] = dataMode === 'real' && realResult?.status === 'ready' ? realResult.sources : DATA_SOURCES;
  const anchorValue = dataMode === 'real' && realResult?.status === 'ready' ? realResult.anchorValue : '86';
  const statePanel = dataMode === 'real' && realResult && realResult.status !== 'ready' ? STATE_PANEL_COPY[realResult.status] : null;
  const statePanelDetail = statePanel && realResult && 'message' in realResult ? realResult.message : statePanel?.detail;

  return (
    <IonPage>
      <IonContent fullscreen scrollY className="wmn-content">
        <div className="wm-next wmn-health">
          <div className="wmn-lab-banner">
            <span>WholeMate Next — Health prototype</span>
            <span className="wmn-lab-banner-tag">frozen · reference only</span>
          </div>

          <header className="wmn-page-header">
            <span className="wmn-hero-eyebrow wmn-page-eyebrow-accent">What’s Changing Over Time</span>
            <h1 className="wmn-page-title">Health</h1>
          </header>

          <div className="wmn-data-mode-row">
            <button
              type="button"
              className={`wmn-real-data-toggle${dataMode === 'real' ? ' active' : ''}`}
              onClick={() => { if (dataMode === 'real') { switchToMockData(); } else { void switchToRealData(); } }}
              aria-pressed={dataMode === 'real'}
            >
              <IonIcon icon={personCircleOutline} />
              My Real Data
            </button>
          </div>

          {realLoading && (
            <div className="wmn-card wmn-state-panel">
              <span className="wmn-eyebrow">Loading</span>
              <p className="wmn-state-panel-title">Reading your account’s Recovery, baselines, and nutrition history…</p>
            </div>
          )}

          {!realLoading && statePanel && (
            <div className="wmn-card wmn-state-panel">
              <span className="wmn-eyebrow">My Real Data</span>
              <p className="wmn-state-panel-title">{statePanel.title}</p>
              {statePanelDetail && <p className="wmn-state-panel-detail">{statePanelDetail}</p>}
              <button type="button" className="wmn-action-button" onClick={switchToMockData}>
                Back To Mock Data
              </button>
            </div>
          )}

          {!realLoading && !statePanel && (
            <>
              {/* Shared heading over both the trend and the stat grid below it —
                  frames Recovery as one tracked signal among several, not the
                  page's identity. */}
              <p className="wmn-health-section-label">This Week’s Signals</p>

              {/* Anchor module — the one trend worth seeing before anything else */}
              <section className="wmn-card wmn-trend-card">
                <span className="wmn-eyebrow">Recovery</span>
                <p className="wmn-trend-value">{anchorValue}<small>/100 today</small></p>
                <div className="wmn-trend-bars" role="img" aria-label="Recovery over the last 7 days">
                  {trend.map((day, index) => (
                    <div key={`${day.label}-${index}`} className="wmn-trend-bar-col">
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
                {tiles.map((tile) => {
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
                  {sources.map((source) => (
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
            </>
          )}
        </div>
      </IonContent>
      <LabNav active="health" />
    </IonPage>
  );
};

export default HealthNextPage;
