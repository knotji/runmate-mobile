import { useHistory } from 'react-router-dom';
import { IonIcon, IonSpinner } from '@ionic/react';
import { chevronForwardOutline, eyeOffOutline, trashOutline } from 'ionicons/icons';
import { getHistoryItemDateKey } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { activitySourceLabel, describeHistoryItem } from '@/lib/activityHistoryPresentation';
import { cacheMealDetailItem } from '@/lib/mealDetailCache';
import { isHealthConnectImportedItem } from '@/lib/localHistory';

export function ActivityHistoryRow({ item, deleting, onDelete }: { item: LocalHistoryItem; deleting: boolean; onDelete: () => void }) {
  const history = useHistory();
  const presentation = describeHistoryItem(item);
  const importedHealthRecord = isHealthConnectImportedItem(item);
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
    <div className={`history-icon history-icon-${presentation.tone}`} aria-hidden="true"><IonIcon icon={presentation.icon} /></div>
    <div className="history-copy">
      <div className="history-copy-eyebrow"><span>{presentation.label}</span>{item.source?.provider && <small>{activitySourceLabel(item)}</small>}</div>
      <h3>{presentation.title}</h3>
      <p>{presentation.detail}</p>
    </div>
    {detailPath && <IonIcon className="history-row-chevron" icon={chevronForwardOutline} aria-hidden="true" />}
  </>;
  return <div className="history-row-shell">
    {detailPath ? <button type="button" className="history-row history-row-button" aria-label={`Open ${presentation.title} details`} disabled={deleting} onClick={() => { if (item.type === 'meal') cacheMealDetailItem(item); history.push(detailPath); }}>{content}</button> : <article className="history-row">{content}</article>}
    <button type="button" className="history-row-delete" disabled={deleting} aria-busy={deleting} onClick={onDelete} aria-label={deleting ? `${importedHealthRecord ? 'Hiding' : 'Deleting'} ${presentation.title}` : `${importedHealthRecord ? 'Hide From RunMate' : 'Delete'} ${presentation.title}`}>{deleting ? <IonSpinner name="crescent" aria-hidden="true" /> : <IonIcon icon={importedHealthRecord ? eyeOffOutline : trashOutline} aria-hidden="true" />}</button>
  </div>;
}
