import { useCallback, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { IonButton, IonContent, IonHeader, IonIcon, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { arrowBackOutline, chevronForwardOutline, heartOutline, medkitOutline } from 'ionicons/icons';
import { loadHistoryItems } from '@/lib/cloudHistory';
import { buildHealthDetail } from '@/lib/activityDetails';
import { getHistoryItemDateKey } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { DetailMetrics, DetailNotes, DetailState } from '@/components/RecordDetailSections';
import './RecordDetailPage.css';

const HealthDetailPage: React.FC = () => {
  const history = useHistory(); const { id } = useParams<{ id: string }>();
  const selectedId = decodeURIComponent(id);
  const [item, setItem] = useState<LocalHistoryItem | null>(null); const [items, setItems] = useState<LocalHistoryItem[]>([]); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null); setItem(null);
    const result = await loadHistoryItems(['pain', 'sick']);
    if (!result.ok) { setError(result.error); return; }
    const sorted = [...result.items].sort((left, right) => healthTimestamp(right) - healthTimestamp(left));
    const match = sorted.find((record) => record.id === selectedId);
    setItems(sorted); setItem(match ?? null);
    if (!match) setError('This health record could not be found.');
  }, [selectedId]);
  useEffect(() => { void load(); }, [load]); const detail = item ? buildHealthDetail(item) : null;
  const latest = items[0];
  const openRecord = (record: LocalHistoryItem) => history.replace(`/activity/health/${encodeURIComponent(record.id)}`);
  return <IonPage><IonHeader translucent className="record-detail-header"><IonToolbar><IonButton slot="start" fill="clear" onClick={() => history.push('/tabs/activity')} aria-label="Back To Activity"><IonIcon slot="icon-only" icon={arrowBackOutline} /></IonButton><IonTitle>Health Detail</IonTitle></IonToolbar></IonHeader><IonContent fullscreen className="record-detail-content"><main className="record-detail-shell health-detail-shell">
    {!detail && !error && <DetailState text="Loading Health Record..." spinner />}{error && <DetailState text={error} />}
    {detail && <><section className={`record-hero record-hero-${detail.tone}`}><IonIcon icon={detail.kind === 'Pain' ? heartOutline : medkitOutline} /><div><p>{detail.kind}</p><h1>{detail.title}</h1><span>{detail.date}</span></div><strong>{detail.status}</strong></section>
      {detail.alerts.length > 0 && <section className="record-alert"><strong>Safety Flags</strong><ul>{detail.alerts.map((alert) => <li key={alert}>{alert}</li>)}</ul></section>}
      {detail.guidance && <DetailNotes title="What To Do" notes={[{ label: 'Training Recommendation', value: detail.guidance }]} />}
      <DetailMetrics title={detail.kind === 'Pain' ? 'Pain Overview' : 'Health Overview'} metrics={detail.metrics} empty="No structured health metrics were provided." />
      {detail.tags.length > 0 && <section className="record-section"><header><p>{detail.kind === 'Pain' ? 'Symptoms' : 'Reported Symptoms'}</p><h2>{detail.kind === 'Pain' ? 'Pain Pattern' : 'What You Reported'}</h2></header><div className="record-tags">{detail.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></section>}
      {detail.note && <DetailNotes title="Health Note" notes={[{ label: 'Note', value: detail.note }]} collapsible />}
      <section className="record-section health-timeline"><details className="health-timeline-disclosure"><summary><div><p>History</p><h2>Health Timeline</h2></div><span>{items.length} {items.length === 1 ? 'Record' : 'Records'}</span></summary><div className="health-timeline-body">
        {latest && latest.id !== selectedId && <button className="health-timeline-current" type="button" onClick={() => openRecord(latest)}>View Current Record</button>}
        <div className="health-timeline-list">{items.map((record) => { const summary = buildHealthDetail(record); const selected = record.id === selectedId; return <button type="button" className={selected ? 'is-selected' : ''} key={record.id} onClick={() => !selected && openRecord(record)} aria-current={selected ? 'true' : undefined}><span className={`health-timeline-icon health-timeline-icon-${summary.tone}`}><IonIcon icon={summary.kind === 'Pain' ? heartOutline : medkitOutline} /></span><span className="health-timeline-copy"><small>{formatTimelineDate(record)}</small><strong>{summary.title}</strong><em>{summary.status}</em></span>{!selected && <IonIcon className="health-timeline-chevron" icon={chevronForwardOutline} />}</button>; })}</div>
      </div></details></section></>}
  </main></IonContent></IonPage>;
};

function healthTimestamp(item: LocalHistoryItem): number {
  return new Date(item.recordedAt ?? item.createdAt).getTime();
}

function formatTimelineDate(item: LocalHistoryItem): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${getHistoryItemDateKey(item)}T12:00:00`));
}
export default HealthDetailPage;
