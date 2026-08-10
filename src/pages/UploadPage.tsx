import { lazy, Suspense, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import './UploadPage.css';

type LogType = 'meal' | 'workout' | 'sleep';

const flowLoaders = {
  sleep: () => import('@/components/SleepUploadFlow'),
  workout: () => import('@/components/WorkoutUploadFlow'),
  meal: () => import('@/components/MealUploadFlow'),
};
const SleepUploadFlow = lazy(flowLoaders.sleep);
const WorkoutUploadFlow = lazy(flowLoaders.workout);
const MealUploadFlow = lazy(flowLoaders.meal);

const UploadPage: React.FC = () => {
  const location = useLocation();
  const [logType, setLogType] = useState<LogType | null>(() => requestedLogType(location.search));
  return <IonPage><IonHeader translucent className="upload-header"><IonToolbar><IonTitle>Log</IonTitle></IonToolbar></IonHeader><IonContent fullscreen className="upload-content"><main className="upload-shell">
    {logType === null && <header className="upload-intro upload-chooser-intro"><p>Manual Log</p><h1>What Would You Like To Log?</h1><span>Add data Health Connect cannot provide, or use photo analysis when you need a fallback.</span></header>}
    <nav className="upload-type-switch" aria-label="Record Type">
      <TypeButton type="sleep" selected={logType} onSelect={setLogType}>Sleep</TypeButton>
      <TypeButton type="workout" selected={logType} onSelect={setLogType}>Workout</TypeButton>
      <TypeButton type="meal" selected={logType} onSelect={setLogType}>Meal</TypeButton>
    </nav>
    <Suspense fallback={<UploadFlowSkeleton />}>
      {logType === 'sleep' && <SleepUploadFlow />}
      {logType === 'workout' && <WorkoutUploadFlow />}
      {logType === 'meal' && <MealUploadFlow />}
    </Suspense>
  </main></IonContent></IonPage>;
};

function requestedLogType(search: string): LogType | null {
  const requested = new URLSearchParams(search).get('type');
  return requested === 'sleep' || requested === 'workout' || requested === 'meal' ? requested : null;
}

function TypeButton({ type, selected, onSelect, children }: { type: LogType; selected: LogType | null; onSelect: (type: LogType) => void; children: ReactNode }) {
  const active = selected === type;
  const prepare = () => { void flowLoaders[type](); };
  return <button type="button" aria-pressed={active} className={active ? 'is-active' : ''} onPointerEnter={prepare} onFocus={prepare} onClick={() => onSelect(type)}>{children}</button>;
}

function UploadFlowSkeleton() {
  return <div className="upload-flow-skeleton" role="status" aria-label="Preparing Log Form">
    <span className="upload-flow-skeleton-kicker" />
    <span className="upload-flow-skeleton-title" />
    <span className="upload-flow-skeleton-copy" />
    <div className="upload-flow-skeleton-card"><span /><span /><span /></div>
    <div className="upload-flow-skeleton-picker"><span /><strong /></div>
  </div>;
}

export default UploadPage;
