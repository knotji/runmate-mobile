import { useCallback, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { IonButton, IonContent, IonHeader, IonIcon, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { arrowBackOutline, fastFoodOutline } from 'ionicons/icons';
import { DetailMetrics, DetailNotes, DetailState } from '@/components/RecordDetailSections';
import { loadHistoryItems } from '@/lib/cloudHistory';
import { buildMealDetail } from '@/lib/activityDetails';
import type { LocalHistoryItem } from '@/lib/localHistory';
import './RecordDetailPage.css';

const MealDetailPage: React.FC = () => {
  const history = useHistory(); const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<LocalHistoryItem | null>(null); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { const result = await loadHistoryItems(['meal']); if (!result.ok) setError(result.error); else setItem(result.items.find((record) => record.id === decodeURIComponent(id)) ?? null); if (result.ok && !result.items.some((record) => record.id === decodeURIComponent(id))) setError('This meal record could not be found.'); }, [id]);
  useEffect(() => { void load(); }, [load]); const detail = item ? buildMealDetail(item) : null;
  return <IonPage><IonHeader translucent className="record-detail-header"><IonToolbar><IonButton slot="start" fill="clear" onClick={() => history.push('/tabs/activity')} aria-label="Back To Activity"><IonIcon slot="icon-only" icon={arrowBackOutline} /></IonButton><IonTitle>Meal Detail</IonTitle></IonToolbar></IonHeader><IonContent fullscreen className="record-detail-content"><main className="record-detail-shell">
    {!detail && !error && <DetailState text="Loading Meal…" spinner />}{error && <DetailState text={error} />}
    {detail && <><section className="record-hero record-hero-meal"><IonIcon icon={fastFoodOutline} /><div><p>Nutrition</p><h1>{detail.title}</h1><span>{detail.date}</span></div></section>
      <DetailMetrics title="Nutrition Overview" metrics={detail.metrics} empty="No structured nutrition values were provided." />
      {detail.foods.length > 0 && <section className="record-section record-foods-section"><header><p>Foods</p><h2>What Was Logged</h2><span>{detail.foods.length} {detail.foods.length === 1 ? 'item' : 'items'}</span></header><div className="record-food-lines"><span>Food | Quantity | Unit | Portion</span><textarea readOnly rows={Math.min(Math.max(detail.foods.length, 3), 10)} value={detail.foods.map(formatFoodLine).join('\n')} aria-label="Foods Logged" /></div></section>}
      {detail.guidance.length > 0 && <DetailNotes title="Meal Guidance" notes={detail.guidance} />}{detail.note && <DetailNotes title="Meal Note" notes={[{ label: 'Note', value: detail.note }]} />}</>}
  </main></IonContent></IonPage>;
};

function formatFoodLine(food: { name: string; quantity: number | null; unit: string | null; portion: string | null }): string {
  if (food.quantity !== null || food.unit || food.portion) return `${food.name} | ${food.quantity ?? ''} | ${food.unit ?? ''} | ${food.portion ?? ''}`.trimEnd();
  return food.name;
}

export default MealDetailPage;
