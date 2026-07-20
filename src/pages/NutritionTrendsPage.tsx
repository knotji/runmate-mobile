import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonContent, IonHeader, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonTitle, IonToolbar, type RefresherEventDetail } from '@ionic/react';
import { arrowBackOutline, barChartOutline, fitnessOutline, restaurantOutline, sparklesOutline, trendingUpOutline } from 'ionicons/icons';
import { PageState } from '@/components/PageState';
import { loadHistoryItems } from '@/lib/cloudHistory';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { buildNutritionTrend, type NutritionTrend, type NutritionTrendDay } from '@/lib/nutritionTrends';
import { todayBangkokDateKey } from '@/lib/date';
import './NutritionTrendsPage.css';

const NutritionTrendsPage: React.FC = () => {
  const history = useHistory();
  const [range, setRange] = useState<7 | 30>(7);
  const [items, setItems] = useState<LocalHistoryItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const result = await loadHistoryItems(['meal', 'workout', 'strength']);
    if (result.ok) setItems(result.items);
    else setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const trend = useMemo(() => items ? buildNutritionTrend(items, range, todayBangkokDateKey()) : null, [items, range]);
  const refresh = async (event: CustomEvent<RefresherEventDetail>) => { await load(); event.detail.complete(); };

  return <IonPage>
    <IonHeader translucent className="nutrition-trends-header"><IonToolbar>
      <button type="button" className="nutrition-trends-back" aria-label="Back To Activity" onClick={() => history.goBack()}><IonIcon icon={arrowBackOutline} /></button>
      <IonTitle>Nutrition Trends</IonTitle>
    </IonToolbar></IonHeader>
    <IonContent fullscreen className="nutrition-trends-content">
      <IonRefresher slot="fixed" onIonRefresh={refresh}><IonRefresherContent pullingText="Pull to refresh" refreshingText="Refreshing…" /></IonRefresher>
      <main className="nutrition-trends-shell">
        <header className="nutrition-trends-heading"><p>LOGGED NUTRITION</p><h1>See Your Eating Patterns</h1><span>Calories and macros from meals recorded in RunMate. Missing days remain blank.</span></header>
        <div className="nutrition-range" role="group" aria-label="Nutrition trend range">
          <button type="button" className={range === 7 ? 'active' : ''} aria-pressed={range === 7} onClick={() => setRange(7)}>7 Days</button>
          <button type="button" className={range === 30 ? 'active' : ''} aria-pressed={range === 30} onClick={() => setRange(30)}>30 Days</button>
        </div>

        {loading && <PageState kind="loading" title="Building Nutrition Trends…" className="nutrition-trends-state" />}
        {!loading && error && <PageState kind="error" title="Nutrition Trends Are Unavailable" detail={error} actionLabel="Try Again" onAction={() => void load()} className="nutrition-trends-state" />}
        {!loading && trend && trend.loggedDays === 0 && <PageState kind="empty" icon={restaurantOutline} title="No Meals In This Range" detail="Log a meal to start building your nutrition trends." className="nutrition-trends-state" />}
        {!loading && trend && trend.loggedDays > 0 && <TrendContent trend={trend} onAskCoach={() => history.push('/ai-coach')} />}
      </main>
    </IonContent>
  </IonPage>;
};

function TrendContent({ trend, onAskCoach }: { trend: NutritionTrend; onAskCoach: () => void }) {
  return <>
    <section className="nutrition-overview-card" aria-labelledby="nutrition-overview-heading">
      <div className="nutrition-card-heading"><div><p>AT A GLANCE</p><h2 id="nutrition-overview-heading">Your Logged Nutrition</h2></div><span className="nutrition-heading-icon"><IonIcon icon={restaurantOutline} /></span></div>
      <div className="nutrition-overview-metrics">
        <Metric value={`${trend.loggedDays}/${trend.rangeDays}`} label="Days Logged" />
        <Metric value={String(trend.mealCount)} label="Meals" />
        <Metric value={`${trend.proteinDataDays}/${trend.loggedDays}`} label="Protein Days" />
      </div>
      <small>Averages below use only days where that value was recorded.</small>
    </section>

    <section className="nutrition-average-card" aria-labelledby="nutrition-average-heading">
      <div className="nutrition-card-heading"><div><p>DAILY AVERAGE</p><h2 id="nutrition-average-heading">What You Logged</h2></div><span className="nutrition-heading-icon"><IonIcon icon={barChartOutline} /></span></div>
      <div className="nutrition-average-grid">
        <AverageMetric value={trend.averageCalories} suffix="kcal" label="Calories" />
        <AverageMetric value={trend.averageProtein} suffix="g" label="Protein" />
        <AverageMetric value={trend.averageCarbs} suffix="g" label="Carbs" />
        <AverageMetric value={trend.averageFat} suffix="g" label="Fat" />
      </div>
    </section>

    <section className="nutrition-chart-card" aria-labelledby="nutrition-chart-heading">
      <div className="nutrition-card-heading"><div><p>DAILY TREND</p><h2 id="nutrition-chart-heading">Calories And Protein</h2></div><span>{trend.loggedDays} Logged Days</span></div>
      <MiniBars title="Calories" unit="kcal" days={trend.days} metric="caloriesKcal" tone="calories" />
      <MiniBars title="Protein" unit="g" days={trend.days} metric="proteinG" tone="protein" />
    </section>

    <section className="nutrition-compare-card" aria-labelledby="nutrition-compare-heading">
      <div className="nutrition-card-heading"><div><p>TRAINING CONTEXT</p><h2 id="nutrition-compare-heading">Training And Rest Days</h2></div><span className="nutrition-heading-icon"><IonIcon icon={fitnessOutline} /></span></div>
      <div className="nutrition-comparison-grid">
        <Comparison label="Training Days" data={trend.training} />
        <Comparison label="Rest Days" data={trend.rest} />
      </div>
      <small>This is a factual comparison of logged meals, not a nutrition target.</small>
    </section>

    <section className="nutrition-insight-card">
      <div className="nutrition-insight-icon"><IonIcon icon={trendingUpOutline} /></div>
      <div><p>PATTERN TO NOTICE</p><h2>{trend.insight.title}</h2><span>{trend.insight.summary}</span></div>
    </section>

    <button type="button" className="nutrition-coach-button" onClick={onAskCoach}><IonIcon icon={sparklesOutline} /><span><strong>Ask AI Coach</strong><small>Get a practical suggestion for your next meal.</small></span></button>
    <p className="nutrition-trends-note">RunMate reports only meals you logged. It does not treat a missing day as zero intake.</p>
  </>;
}

function Metric({ value, label }: { value: string; label: string }) { return <div><strong>{value}</strong><span>{label}</span></div>; }
function AverageMetric({ value, suffix, label }: { value: number | null; suffix: string; label: string }) { return <div><span>{label}</span><strong>{value === null ? '—' : format(value)}{value !== null && <small>{suffix}</small>}</strong></div>; }

function MiniBars({ title, unit, days, metric, tone }: { title: string; unit: string; days: NutritionTrendDay[]; metric: 'caloriesKcal' | 'proteinG'; tone: string }) {
  const values = days.map((day) => day[metric]);
  const max = Math.max(1, ...values.filter((value): value is number => value !== null));
  return <div className={`nutrition-mini-chart ${tone}`}>
    <header><strong>{title}</strong><span>Daily {unit}</span></header>
    <div className="nutrition-bars" role="img" aria-label={`${title} over the last ${days.length} days`}>
      {days.map((day) => { const value = day[metric]; return <span className={value === null ? 'missing' : ''} style={{ '--bar-height': `${value === null ? 3 : Math.max(8, value / max * 100)}%` } as React.CSSProperties} aria-label={`${formatDate(day.date)}: ${value === null ? 'not logged' : `${format(value)} ${unit}`}`} title={`${formatDate(day.date)}: ${value === null ? 'Not Logged' : `${format(value)} ${unit}`}`} key={day.date} />; })}
    </div>
    <div className="nutrition-chart-dates"><span>{formatDate(days[0].date)}</span><span>{formatDate(days[Math.floor(days.length / 2)].date)}</span><span>{formatDate(days.at(-1)!.date)}</span></div>
  </div>;
}

function Comparison({ label, data }: { label: string; data: NutritionTrend['training'] }) {
  return <div><header><strong>{label}</strong><span>{data.loggedDays} {data.loggedDays === 1 ? 'Day' : 'Days'}</span></header><p><strong>{data.averageCalories === null ? '—' : format(data.averageCalories)}</strong><span>Avg kcal</span></p><p><strong>{data.averageProtein === null ? '—' : `${format(data.averageProtein)} g`}</strong><span>Avg Protein</span></p></div>;
}
function format(value: number): string { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value); }
function formatDate(date: string): string { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)); }

export default NutritionTrendsPage;
