import React from 'react';
import { IonButton, IonIcon, IonSpinner } from '@ionic/react';
import { checkmarkOutline, copyOutline } from 'ionicons/icons';

export type LogEntry = { label: string; result: unknown; error?: string; at: string };

type CheckItem = { label: string; title: string; action: () => Promise<unknown> };

type Props = {
  busy: string | null;
  logs: LogEntry[];
  readChecks: CheckItem[];
  copiedEntry: string | null;
  copyError: string | null;
  onRun: (label: string, action: () => Promise<unknown>) => void;
  onRunAll: () => void;
  onCopyResult: (entry: LogEntry, entryKey: string) => void;
  onCopyAllResults: () => void;
};

export const HealthDiagnosticsPanel: React.FC<Props> = ({
  busy,
  logs,
  readChecks,
  copiedEntry,
  copyError,
  onRun,
  onRunAll,
  onCopyResult,
  onCopyAllResults,
}) => {
  return (
    <div className="health-developer-body">
      <p className="health-test-note">
        Raw Health Connect inspection tools. These results are for diagnostics and are not shown in the normal RunMate experience.
      </p>

      <section className="health-test-actions">
        <IonButton expand="block" color="success" disabled={busy !== null} onClick={onRunAll}>
          {busy !== null && readChecks.some((check) => check.label === busy) ? <IonSpinner name="crescent" /> : 'Run All Checks'}
        </IonButton>

        <div className="health-test-divider" />

        {readChecks.map((check) => (
          <IonButton expand="block" fill="outline" disabled={busy !== null} onClick={() => onRun(check.label, check.action)} key={check.label}>
            {busy === check.label ? <IonSpinner name="crescent" /> : check.title}
          </IonButton>
        ))}
      </section>

      <section className="health-test-log">
        {logs.length === 0 && <p className="health-test-empty">Results will appear here.</p>}
        {logs.length > 0 && (
          <button type="button" className={copiedEntry === '__all__' ? 'health-copy-button copied' : 'health-copy-button'} onClick={onCopyAllResults}>
            <IonIcon icon={copiedEntry === '__all__' ? checkmarkOutline : copyOutline} />{copiedEntry === '__all__' ? 'Copied All' : 'Copy All Results'}
          </button>
        )}
        {copyError && <p className="health-test-copy-error" role="alert">{copyError}</p>}
        {logs.map((entry, index) => {
          const entryKey = `${entry.label}-${entry.at}-${index}`;
          const copied = copiedEntry === entryKey;
          return (
            <article className="health-test-entry" key={entryKey}>
              <header>
                <div><strong>{entry.label}</strong><span>{entry.at}</span></div>
                <button type="button" className={copied ? 'health-copy-button copied' : 'health-copy-button'} onClick={() => onCopyResult(entry, entryKey)} aria-label={`Copy ${entry.label} Result`}>
                  <IonIcon icon={copied ? checkmarkOutline : copyOutline} />{copied ? 'Copied' : 'Copy'}
                </button>
              </header>
              {entry.error ? <p className="health-test-error">{entry.error}</p> : <pre>{JSON.stringify(entry.result, null, 2)}</pre>}
            </article>
          );
        })}
      </section>
    </div>
  );
};
