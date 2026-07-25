import { IonIcon } from '@ionic/react';
import { checkmarkCircleOutline, warningOutline } from 'ionicons/icons';
import type { WeekSleepRow } from '@/lib/buildCoachContext';
import type { RunMateSleepScoreResult, SleepScoreComponent } from '@/lib/runMateSleepScore';
import { formatImportedAt, formatMinutes, formatOptionalMinutes, formatSleepTime } from '@/lib/sleepDetailFormatting';

export function SleepScoreBreakdown({ result }: { result: RunMateSleepScoreResult }) {
  const availableCount = result.components.filter((component) => component.score != null).length;
  const reweighted = availableCount < result.components.length;
  return (
    <section className="sleep-detail-section sleep-score-breakdown-section">
      <details className="sleep-detail-disclosure sleep-score-breakdown">
        <summary>
          <div><p>Sleep Score</p><h2>How This Score Was Built</h2></div>
          <span>{availableCount}/{result.components.length} Factors</span>
        </summary>
        <div className="sleep-score-factor-list">
          {result.components.map((component) => (
            <div className={`sleep-score-factor${component.score == null ? ' missing' : ''}`} key={component.key}>
              <IonIcon icon={component.score == null ? warningOutline : checkmarkCircleOutline} />
              <div className="sleep-score-factor-copy">
                <div><strong>{component.label}</strong><span>{scoreFactorDetail(component, result)}</span></div>
                {component.score != null && <i aria-hidden="true"><span style={{ width: `${component.score}%` }} /></i>}
              </div>
              <div className="sleep-score-factor-value">
                <strong>{component.score == null ? 'Missing' : `${Math.round(component.score)}/100`}</strong>
                <span>{componentWeightLabel(component)}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="sleep-score-method-note">
          {reweighted
            ? 'Missing factors stay missing. Their weight is redistributed across the factors available for this night.'
            : 'All four factors were available. Standard weighting was used for this night.'}
        </p>
      </details>
    </section>
  );
}

function scoreFactorDetail(component: SleepScoreComponent, result: RunMateSleepScoreResult): string {
  if (component.score == null) {
    return component.key === 'consistency' ? 'Needs at least three timed nights' : 'Not available for this night';
  }
  if (component.key === 'duration') return `${formatOptionalMinutes(result.actualSleepMinutes)} of ${formatMinutes(result.sleepNeedMinutes)} Sleep Need`;
  if (component.key === 'consistency') return 'Bedtime and wake-time regularity';
  if (component.key === 'efficiency') return 'Sleep time compared with Time In Bed';
  return 'REM and Deep share of staged sleep';
}

function componentWeightLabel(component: SleepScoreComponent): string {
  if (component.score == null) return `${component.baseWeight}% reweighted`;
  const effective = Math.round(component.effectiveWeight);
  return effective === component.baseWeight ? `${component.baseWeight}% weight` : `${component.baseWeight}% → ${effective}% used`;
}

export function SleepStages({ night }: { night: WeekSleepRow }) {
  const stages = [
    { label: 'Awake', value: night.awakeMinutes, className: 'awake' },
    { label: 'REM', value: night.remMinutes, className: 'rem' },
    { label: 'Light', value: night.lightMinutes, className: 'light' },
    { label: 'Deep', value: night.deepMinutes, className: 'deep' },
  ];
  const total = stages.reduce((sum, stage) => sum + (stage.value ?? 0), 0);
  if (total <= 0) return (
    <section className="sleep-detail-section">
      <header><p>Sleep Stages</p><h2>No Stage Data</h2></header>
      <p className="sleep-stages-empty">Your data source did not provide sleep stages for this night.</p>
    </section>
  );
  return (
    <section className="sleep-detail-section">
      <header><p>Sleep Stages</p><h2>How Your Night Was Spent</h2></header>
      <div className="sleep-stages-card">
        <div className="sleep-stage-bar" aria-label="Sleep stage distribution">
          {stages.map((stage) => stage.value != null && stage.value > 0
            ? <span key={stage.label} className={stage.className} style={{ width: `${(stage.value / total) * 100}%` }} />
            : null)}
        </div>
        <div className="sleep-stage-legend">
          {stages.map((stage) => (
            <div key={stage.label}><i className={stage.className} /><span>{stage.label}</span><strong>{formatOptionalMinutes(stage.value)}</strong></div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SleepHeartRate({ night }: { night: WeekSleepRow }) {
  const points = (night.sleepHeartRateTimeline ?? [])
    .map((point) => ({ at: Date.parse(point.at), bpm: point.bpm }))
    .filter((point) => Number.isFinite(point.at) && Number.isFinite(point.bpm) && point.bpm >= 30 && point.bpm <= 240)
    .sort((a, b) => a.at - b.at);
  if (points.length < 2) return null;

  const average = night.avgSleepingHeartRate ?? Math.round(points.reduce((sum, point) => sum + point.bpm, 0) / points.length);
  const lowest = night.lowestSleepingHeartRate ?? Math.round(Math.min(...points.map((point) => point.bpm)));
  const width = 320;
  const height = 118;
  const left = 8;
  const right = 8;
  const top = 12;
  const bottom = 12;
  const startAt = Date.parse(night.sleepStartTime ?? '') || points[0].at;
  const endAt = Date.parse(night.sleepEndTime ?? '') || points.at(-1)!.at;
  const minBpm = Math.max(25, Math.floor(Math.min(...points.map((point) => point.bpm)) / 5) * 5 - 5);
  const maxBpm = Math.ceil(Math.max(...points.map((point) => point.bpm)) / 5) * 5 + 5;
  const x = (at: number) => left + Math.max(0, Math.min(1, (at - startAt) / Math.max(1, endAt - startAt))) * (width - left - right);
  const y = (bpm: number) => top + (1 - (bpm - minBpm) / Math.max(1, maxBpm - minBpm)) * (height - top - bottom);
  const paths: string[] = [];
  let path = '';
  points.forEach((point, index) => {
    if (index > 0 && point.at - points[index - 1].at > 20 * 60_000) {
      if (path) paths.push(path);
      path = '';
    }
    path += `${path ? ' L' : 'M'} ${x(point.at).toFixed(1)} ${y(point.bpm).toFixed(1)}`;
  });
  if (path) paths.push(path);

  return (
    <section className="sleep-detail-section sleep-heart-rate-section">
      <header><p>Overnight Vitals</p><h2>Sleep Heart Rate</h2></header>
      <div className="sleep-heart-rate-card">
        <div className="sleep-heart-rate-summary">
          <div><span>Average</span><strong>{average}<small>bpm</small></strong></div>
          <div><span>Lowest</span><strong>{lowest}<small>bpm</small></strong></div>
        </div>
        <div className="sleep-heart-rate-chart-wrap">
          <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Sleep heart rate. Average ${average} bpm and lowest ${lowest} bpm.`}>
            {[.25, .5, .75].map((ratio) => <line key={ratio} x1={left} x2={width - right} y1={top + ratio * (height - top - bottom)} y2={top + ratio * (height - top - bottom)} className="sleep-heart-rate-grid" />)}
            <line x1={left} x2={width - right} y1={y(average)} y2={y(average)} className="sleep-heart-rate-average" />
            {paths.map((item, index) => <path key={index} d={item} className="sleep-heart-rate-line" />)}
          </svg>
        </div>
        <div className="sleep-heart-rate-times"><span>{formatSleepTime(startAt)}</span><span>{formatSleepTime(endAt)}</span></div>
        <p>Measured by Samsung Health during your recorded Sleep Window.</p>
      </div>
    </section>
  );
}

export function RecordReliability({ night }: { night: WeekSleepRow }) {
  const sources = night.sources?.length ? night.sources : ['RunMate'];
  const correctedCount = Object.values(night.fieldSources ?? {}).filter((source) => source === 'User Corrected').length;
  const status = sources.length > 1 ? 'Reconciled' : 'Single Source';
  return (
    <section className="sleep-detail-section sleep-reliability-section">
      <details className="sleep-detail-disclosure">
        <summary>
          <div><p>Record Reliability</p><h2>Source And Merge</h2></div>
          <span>{status}</span>
        </summary>
        <div className="sleep-reliability-list">
          <div><span>Sources</span><strong>{sources.join(' + ')}</strong></div>
          <div><span>User Corrections</span><strong>{correctedCount ? `${correctedCount} Preserved` : 'None'}</strong></div>
          <div><span>Last Imported</span><strong>{formatImportedAt(night.lastImportedAt)}</strong></div>
        </div>
      </details>
    </section>
  );
}
