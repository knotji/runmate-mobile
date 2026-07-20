import { useHistory } from 'react-router-dom';
import { IonIcon, IonSpinner } from '@ionic/react';
import { chevronForwardOutline, trashOutline } from 'ionicons/icons';
import { getHistoryItemDateKey } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { activitySourceLabel, describeHistoryItem } from '@/lib/activityHistoryPresentation';

export function ActivityHistoryRow({ item, deleting, onDelete }: { item: LocalHistoryItem; deleting: boolean; onDelete: () => void }) {
  const history = useHistory();
  const presentation = describeHistoryItem(item);
  const detailPath = item.type === 'workout' || item.type === 'strength'
    ? `/activity/workout/${encodeURIComponent(item.id)}`
    : item.type === 'sleep'
      ? `/sleep?date=${encodeURIComponent(getHistoryItemDateKey(item))}&from=activity`
      : item.type === 'meal'
        ? `/activity/meal/${encodeURIComponent(item.id)}`
        : item.type === 'pain' || item.type === 'sick'
          ? `/activity/health/${encodeURIComponent(item.id)}`
          : null;
  const content = <>
    <div className={`history-icon history-icon-${presentation.tone}`}><IonIcon icon={presentation.icon} /></div>
    <div className="history-copy"><span>{presentation.label}</span><h3>{presentation.title}</h3><div className="history-row-meta"><p>{presentation.detail}</p>{item.source?.provider && <small>{activitySourceLabel(item)}</small>}</div></div>
    {detailPath && <IonIcon className="history-row-chevron" icon={chevronForwardOutline} />}
  </>;
  return <div className="history-row-shell">
    {detailPath ? <button type="button" className="history-row history-row-button" disabled={deleting} onClick={() => history.push(detailPath)}>{content}</button> : <article className="history-row">{content}</article>}
    <button type="button" className="history-row-delete" disabled={deleting} onClick={onDelete} aria-label={`Delete ${presentation.title}`}>{deleting ? <IonSpinner name="crescent" /> : <IonIcon icon={trashOutline} />}</button>
  </div>;
}
