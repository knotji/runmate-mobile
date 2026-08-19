import { IonContent, IonPage } from '@ionic/react';
import { LabNav, type LabTabId } from './LabNav';
import './tokens.css';
import './shared.css';
import './LabComingSoon.css';

interface LabComingSoonProps {
  tab: LabTabId;
  title: string;
  note: string;
}

export const LabComingSoon: React.FC<LabComingSoonProps> = ({ tab, title, note }) => (
  <IonPage>
    <IonContent fullscreen className="wmn-content">
      <div className="wm-next wmn-coming-soon">
        <div className="wmn-lab-banner">
          <span>WholeMate Next — {title} prototype</span>
          <span className="wmn-lab-banner-tag">not shipped</span>
        </div>
        <div className="wmn-coming-soon-body">
          <span className="wmn-eyebrow">Up Next</span>
          <p className="wmn-coming-soon-title">Not designed yet</p>
          <p className="wmn-coming-soon-note">{note}</p>
        </div>
      </div>
    </IonContent>
    <LabNav active={tab} />
  </IonPage>
);
