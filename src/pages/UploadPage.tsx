import { lazy, Suspense, useState, type ReactNode } from 'react';
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import './UploadPage.css';

type UploadType = 'meal' | 'workout' | 'sleep';

const flowLoaders = {
  sleep: () => import('@/components/SleepUploadFlow'),
  workout: () => import('@/components/WorkoutUploadFlow'),
  meal: () => import('@/components/MealUploadFlow'),
};
const SleepUploadFlow = lazy(flowLoaders.sleep);
const WorkoutUploadFlow = lazy(flowLoaders.workout);
const MealUploadFlow = lazy(flowLoaders.meal);

const UploadPage: React.FC = () => {
  const [uploadType, setUploadType] = useState<UploadType | null>(null);
  return <IonPage><IonHeader translucent className="upload-header"><IonToolbar><IonTitle>Upload</IonTitle></IonToolbar></IonHeader><IonContent fullscreen className="upload-content"><main className="upload-shell">
    {uploadType === null && <header className="upload-intro upload-chooser-intro"><p>Add Data</p><h1>What Would You Like To Upload?</h1><span>Choose a record type to begin. RunMate will not select one automatically.</span></header>}
    <nav className="upload-type-switch" aria-label="Upload Type">
      <TypeButton type="sleep" selected={uploadType} onSelect={setUploadType}>Sleep</TypeButton>
      <TypeButton type="workout" selected={uploadType} onSelect={setUploadType}>Workout</TypeButton>
      <TypeButton type="meal" selected={uploadType} onSelect={setUploadType}>Meal</TypeButton>
    </nav>
    <Suspense fallback={<UploadFlowSkeleton />}>
      {uploadType === 'sleep' && <SleepUploadFlow />}
      {uploadType === 'workout' && <WorkoutUploadFlow />}
      {uploadType === 'meal' && <MealUploadFlow />}
    </Suspense>
  </main></IonContent></IonPage>;
};

function TypeButton({ type, selected, onSelect, children }: { type: UploadType; selected: UploadType | null; onSelect: (type: UploadType) => void; children: ReactNode }) {
  const active = selected === type;
  const prepare = () => { void flowLoaders[type](); };
  return <button type="button" aria-pressed={active} className={active ? 'is-active' : ''} onPointerEnter={prepare} onFocus={prepare} onClick={() => onSelect(type)}>{children}</button>;
}

function UploadFlowSkeleton() {
  return <div className="upload-flow-skeleton" role="status" aria-label="Preparing Upload Form">
    <span className="upload-flow-skeleton-kicker" />
    <span className="upload-flow-skeleton-title" />
    <span className="upload-flow-skeleton-copy" />
    <div className="upload-flow-skeleton-card"><span /><span /><span /></div>
    <div className="upload-flow-skeleton-picker"><span /><strong /></div>
  </div>;
}

export default UploadPage;
