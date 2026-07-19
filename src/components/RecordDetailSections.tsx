import { IonIcon, IonSpinner } from '@ionic/react';
import { warningOutline } from 'ionicons/icons';

export function DetailState({ text, spinner }: { text: string; spinner?: boolean }) {
  return <div className="record-detail-state">{spinner ? <IonSpinner name="crescent" /> : <IonIcon icon={warningOutline} />}<p>{text}</p></div>;
}

export function DetailMetrics({ title, metrics, empty }: { title: string; metrics: Array<{ label: string; value: string }>; empty: string }) {
  return <section className="record-section"><header><p>Details</p><h2>{title}</h2></header>{metrics.length ? <div className="record-metric-grid">{metrics.map((metric) => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></div>)}</div> : <p className="record-empty">{empty}</p>}</section>;
}

export function DetailNotes({ title, notes, collapsible = false }: { title: string; notes: Array<{ label: string; value: string }>; collapsible?: boolean }) {
  if (collapsible) return <section className="record-section record-notes-section"><details className="record-notes-disclosure"><summary><div><p>Guidance</p><h2>{title}</h2></div><span>{notes.length} {notes.length === 1 ? 'Note' : 'Notes'}</span></summary><div className="record-notes">{notes.map((note) => <div key={note.label}><span>{note.label}</span><p>{note.value}</p></div>)}</div></details></section>;
  return <section className="record-section"><header><p>Guidance</p><h2>{title}</h2></header><div className="record-notes">{notes.map((note) => <div key={note.label}><span>{note.label}</span><p>{note.value}</p></div>)}</div></section>;
}
