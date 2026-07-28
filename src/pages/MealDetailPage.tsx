import { useCallback, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { IonButton, IonContent, IonHeader, IonIcon, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { arrowBackOutline, fastFoodOutline } from 'ionicons/icons';
import { DetailNotes, DetailState } from '@/components/RecordDetailSections';
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
      <NutritionOverview metrics={detail.metrics} />
      {detail.foods.length > 0 && <section className="record-section record-foods-section"><header><div><p>Foods</p><h2>What Was Logged</h2></div><span>{detail.foods.length} {detail.foods.length === 1 ? 'Item' : 'Items'}</span></header><ol className="record-food-list">{detail.foods.map((food, index) => <li key={`${food.name}-${index}`}><span className="record-food-index">{index + 1}</span><div className="record-food-copy"><strong>{food.name}</strong><small>{formatFoodDetail(food)}</small></div></li>)}</ol></section>}
      {mealNotes.length > 0 && <DetailNotes title="Guidance And Notes" notes={mealNotes} collapsible />}</>}
  </main></IonContent></IonPage>;
};

function NutritionOverview({ metrics }: { metrics: Array<{ label: string; value: string }> }) {
  const value = (label: string) => {
    const parsed = Number.parseFloat(metrics.find((metric) => metric.label === label)?.value ?? '');
    return Number.isFinite(parsed) ? parsed : null;
  };
  const calories = value('Calories');
  const protein = value('Protein');
  const carbs = value('Carbs');
  const fat = value('Fat');
  const fiber = value('Fiber');
  const macros = [
    { key: 'protein', label: 'Protein', grams: protein, energy: (protein ?? 0) * 4 },
    { key: 'carbs', label: 'Carbs', grams: carbs, energy: (carbs ?? 0) * 4 },
    { key: 'fat', label: 'Fat', grams: fat, energy: (fat ?? 0) * 9 },
  ].filter((macro) => macro.grams !== null);
  const macroEnergy = macros.reduce((sum, macro) => sum + macro.energy, 0);

  return <section className="record-section meal-nutrition-section">
    <header><p>Details</p><h2>Nutrition Overview</h2></header>
    {metrics.length === 0 ? <p className="record-empty">No structured nutrition values were provided.</p> : <div className="meal-nutrition-card">
      <div className="meal-calorie-summary"><span>Estimated Energy</span><strong>{calories === null ? '—' : `${formatNutritionValue(calories)} kcal`}</strong></div>
      {macros.length > 0 && <div className="meal-macro-composition">
        <div className="meal-macro-heading"><strong>Macro Composition</strong><span>By estimated energy</span></div>
        <div className="meal-macro-bar" role="img" aria-label={macros.map((macro) => `${macro.label} ${formatNutritionValue(macro.grams!)} grams`).join(', ')}>
          {macros.map((macro) => <span className={`macro-${macro.key}`} style={{ width: `${macroEnergy > 0 ? macro.energy / macroEnergy * 100 : 100 / macros.length}%` }} key={macro.key} />)}
        </div>
        <div className="meal-macro-legend">
          {macros.map((macro) => <div className={`macro-${macro.key}`} key={macro.key}><span>{macro.label}</span><strong>{formatNutritionValue(macro.grams!)} g</strong></div>)}
        </div>
      </div>}
      {fiber !== null && <div className="meal-fiber-row"><span>Fiber</span><strong>{formatNutritionValue(fiber)} g</strong></div>}
    </div>}
  </section>;
}

function formatNutritionValue(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
}

function formatFoodDetail(food: { quantity: number | null; unit: string | null; portion: string | null }): string {
  const amount = [food.quantity, food.unit].filter((value) => value !== null && value !== '').join(' ');
  return [amount, food.portion].filter(Boolean).join(' · ') || 'No Portion Details';
}

export default MealDetailPage;
