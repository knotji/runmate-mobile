import { useCallback, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { IonButton, IonContent, IonHeader, IonIcon, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { arrowBackOutline, fastFoodOutline } from 'ionicons/icons';
import { DetailMetrics, DetailNotes, DetailState } from '@/components/RecordDetailSections';
import { loadHistoryItemById } from '@/lib/cloudHistory';
import { buildMealDetail } from '@/lib/activityDetails';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { cacheMealDetailItem, loadCachedMealDetailItem } from '@/lib/mealDetailCache';
import { measurePerformanceDiagnostic } from '@/lib/performanceDiagnostics';
import './RecordDetailPage.css';

const MealDetailPage: React.FC = () => {
  const history = useHistory(); const { id } = useParams<{ id: string }>(); const decodedId = decodeURIComponent(id);
  const [item, setItem] = useState<LocalHistoryItem | null>(() => loadCachedMealDetailItem(decodedId)); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    const result = await measurePerformanceDiagnostic(
      'meal_detail',
      () => loadHistoryItemById(decodedId),
      (value) => ({ status: value.ok ? 'success' : 'failed', detail: value.ok ? 'Single meal record prepared' : value.error }),
    );
    if (!result.ok) {
      if (!loadCachedMealDetailItem(decodedId)) setError(result.error);
      return;
    }
    if (result.item.type !== 'meal') {
      setError('This meal record could not be found.');
      return;
    }
    cacheMealDetailItem(result.item);
    setItem(result.item);
  }, [decodedId]);
  useEffect(() => { void load(); }, [load]); const detail = item ? buildMealDetail(item) : null;
  const mealNotes = detail ? [
    ...detail.guidance,
    ...(detail.note ? [{ label: 'Meal Note', value: detail.note }] : []),
  ] : [];
  return <IonPage><IonHeader translucent className="record-detail-header"><IonToolbar><IonButton slot="start" fill="clear" onClick={() => history.push('/tabs/activity')} aria-label="Back To Activity"><IonIcon slot="icon-only" icon={arrowBackOutline} /></IonButton><IonTitle>Meal Detail</IonTitle></IonToolbar></IonHeader><IonContent fullscreen className="record-detail-content"><main className="record-detail-shell meal-detail-shell">
    {!detail && !error && <DetailState text="Loading Meal…" spinner />}{error && <DetailState text={error} />}
    {detail && <><section className="record-hero record-hero-meal"><IonIcon icon={fastFoodOutline} /><div><p>Nutrition</p><h1>{detail.title}</h1><span>{detail.date}</span></div></section>
      <DetailMetrics title="Nutrition Overview" metrics={detail.metrics} empty="No structured nutrition values were provided." />
      {detail.foods.length > 0 && <section className="record-section record-foods-section"><header><p>Foods</p><h2>What Was Logged</h2><span>{detail.foods.length} {detail.foods.length === 1 ? 'Item' : 'Items'}</span></header><ol className="record-food-list">{detail.foods.map((food, index) => <li key={`${food.name}-${index}`}><span>{index + 1}</span><div><strong>{food.name}</strong><small>{formatFoodDetail(food)}</small></div></li>)}</ol></section>}
      {mealNotes.length > 0 && <DetailNotes title="Guidance And Notes" notes={mealNotes} collapsible />}</>}
  </main></IonContent></IonPage>;
};

function formatFoodDetail(food: { quantity: number | null; unit: string | null; portion: string | null }): string {
  const amount = [food.quantity, food.unit].filter((value) => value !== null && value !== '').join(' ');
  return [amount, food.portion].filter(Boolean).join(' · ') || 'No Portion Details';
}

export default MealDetailPage;
