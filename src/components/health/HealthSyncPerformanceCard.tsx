import React from 'react';
import { IonIcon } from '@ionic/react';
import { checkmarkOutline, copyOutline } from 'ionicons/icons';
import type { HealthSyncPerformanceComparison, PerformanceDiagnosticPhase, PerformanceDiagnosticSummary } from '@/lib/performanceDiagnostics';

type Props = {
  performanceSummaries: PerformanceDiagnosticSummary[];
  healthSyncComparison: HealthSyncPerformanceComparison[];
  copiedEntry: string | null;
  onCopyPerformanceDiagnostics: () => void;
  formatDiagnosticDuration: (ms: number) => string;
};

export const HealthSyncPerformanceCard: React.FC<Props> = ({
  performanceSummaries,
  healthSyncComparison,
  copiedEntry,
  onCopyPerformanceDiagnostics,
  formatDiagnosticDuration,
}) => {
  return (
    <section className="health-performance-diagnostics" aria-labelledby="performance-diagnostics-heading">
      <header>
        <div><span>Recovery And Activity</span><h2 id="performance-diagnostics-heading">Page Performance Diagnostics</h2></div>
        {performanceSummaries.length > 0 && (
          <button type="button" className={copiedEntry === '__performance__' ? 'health-copy-button copied' : 'health-copy-button'} onClick={onCopyPerformanceDiagnostics}>
            <IonIcon icon={copiedEntry === '__performance__' ? checkmarkOutline : copyOutline} />{copiedEntry === '__performance__' ? 'Copied' : 'Copy'}
          </button>
        )}
      </header>
      {performanceSummaries.length === 0 ? (
        <p>Open Recovery and Activity once to record Sync and page-loading timings.</p>
      ) : (
        <div className="health-performance-list">
          {performanceSummaries.map((summary) => (
            <PerformanceTimingRow summary={summary} key={summary.phase} formatDiagnosticDuration={formatDiagnosticDuration} />
          ))}
        </div>
      )}
      {healthSyncComparison.length > 0 && (
        <div className="health-sync-comparison">
          <span>Recovery Startup Health Read</span>
          <div>
            {healthSyncComparison.map((item) => (
              <div key={item.variant}>
                <b>{healthSyncVariantLabel(item.variant)}</b>
                <strong>{formatDiagnosticDuration(item.averageMs)}</strong>
                <small>{item.sampleCount} sample{item.sampleCount === 1 ? '' : 's'}</small>
              </div>
            ))}
          </div>
        </div>
      )}
      <small>Latest duration and average of up to five runs. Timings stay on this device.</small>
    </section>
  );
};

function PerformanceTimingRow({ summary, formatDiagnosticDuration }: { summary: PerformanceDiagnosticSummary; formatDiagnosticDuration: (ms: number) => string }) {
  return (
    <div className="health-performance-row">
      <div>
        <strong>{performancePhaseLabel(summary.phase)}</strong>
        <span>{summary.latest.detail ?? performanceStatusLabel(summary.latest.status)}</span>
      </div>
      <div>
        <strong>{formatDiagnosticDuration(summary.latest.durationMs)}</strong>
        <span>{summary.sampleCount > 1 ? `${formatDiagnosticDuration(summary.averageMs)} avg` : 'First sample'}</span>
      </div>
    </div>
  );
}

function performancePhaseLabel(phase: PerformanceDiagnosticPhase): string {
  if (phase === 'health_sync') return 'Health Sync';
  if (phase === 'recovery_core') return 'Recovery Core';
  if (phase === 'recovery_secondary') return 'Secondary Content';
  if (phase === 'activity_health_sync') return 'Activity Health Sync';
  if (phase === 'activity_records') return 'Activity Records';
  if (phase === 'activity_archive') return 'Activity Archive';
  return 'Nutrition Summary';
}

function performanceStatusLabel(status: PerformanceDiagnosticSummary['latest']['status']): string {
  if (status === 'failed') return 'Failed';
  if (status === 'skipped') return 'Skipped';
  return 'Completed';
}

function healthSyncVariantLabel(variant: HealthSyncPerformanceComparison['variant']): string {
  if (variant === 'prepared') return 'Prepared Snapshot';
  if (variant === 'mixed') return 'Snapshot + Live';
  return 'Live Health Connect';
}
