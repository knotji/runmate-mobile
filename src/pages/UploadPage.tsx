import { useState, type ReactNode } from 'react';
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import MealUploadFlow from '@/components/MealUploadFlow';
import SleepUploadFlow from '@/components/SleepUploadFlow';
import WorkoutUploadFlow from '@/components/WorkoutUploadFlow';
import './UploadPage.css';

type UploadType = 'meal' | 'workout' | 'sleep';

const UploadPage: React.FC = () => {
  const [uploadType, setUploadType] = useState<UploadType | null>(null);
  return <IonPage><IonHeader translucent className="upload-header"><IonToolbar><IonTitle>Upload</IonTitle></IonToolbar></IonHeader><IonContent fullscreen className="upload-content"><main className="upload-shell">
    {uploadType === null && <header className="upload-intro upload-chooser-intro"><p>Add Data</p><h1>What Would You Like To Upload?</h1><span>Choose a record type to begin. RunMate will not select one automatically.</span></header>}
    <nav className="upload-type-switch" aria-label="Upload Type">
      <TypeButton type="sleep" selected={uploadType} onSelect={setUploadType}>Sleep</TypeButton>
      <TypeButton type="workout" selected={uploadType} onSelect={setUploadType}>Workout</TypeButton>
      <TypeButton type="meal" selected={uploadType} onSelect={setUploadType}>Meal</TypeButton>
    </nav>
    {uploadType === 'sleep' && <SleepUploadFlow />}
    {uploadType === 'workout' && <WorkoutUploadFlow />}
    {uploadType === 'meal' && <MealUploadFlow />}
  </main></IonContent></IonPage>;
};

function TypeButton({ type, selected, onSelect, children }: { type: UploadType; selected: UploadType | null; onSelect: (type: UploadType) => void; children: ReactNode }) {
  const active = selected === type;
  return <button type="button" aria-pressed={active} className={active ? 'is-active' : ''} onClick={() => onSelect(type)}>{children}</button>;
}

export default UploadPage;
