import { useHistory } from 'react-router-dom';
import { IonIcon } from '@ionic/react';
import { fitnessOutline, heartOutline, homeOutline, personOutline } from 'ionicons/icons';
import './LabNav.css';

export type LabTabId = 'today' | 'health' | 'move' | 'you';

const TABS: { id: LabTabId; label: string; path: string; icon: string }[] = [
  { id: 'today', label: 'Today', path: '/labs/today-next', icon: homeOutline },
  { id: 'health', label: 'Health', path: '/labs/health-next', icon: heartOutline },
  { id: 'move', label: 'Move', path: '/labs/move-next', icon: fitnessOutline },
  { id: 'you', label: 'You', path: '/labs/you-next', icon: personOutline },
];

// Scoped to the /labs/* prototype only — a deliberate second tab bar, not a
// reskin of the shipped MainTabs, so evaluating the four-pillar IA here can
// never touch production navigation.
export const LabNav: React.FC<{ active: LabTabId }> = ({ active }) => {
  const history = useHistory();
  return (
    <nav className="wm-next wmn-lab-nav" aria-label="WholeMate Next prototype sections">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`wmn-lab-nav-item${tab.id === active ? ' active' : ''}`}
          onClick={() => { if (tab.id !== active) history.push(tab.path); }}
          aria-current={tab.id === active ? 'page' : undefined}
        >
          <IonIcon icon={tab.icon} />
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};
