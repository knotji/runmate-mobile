import { Redirect, Route } from 'react-router-dom';
import { IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/react';
import { addCircleOutline, ellipsisHorizontalCircleOutline, pulseOutline, todayOutline } from 'ionicons/icons';
import RecoveryPage from '@/pages/RecoveryPage';
import ActivityPage from '@/pages/ActivityPage';
import UploadPage from '@/pages/UploadPage';
import MorePage from '@/pages/MorePage';

const MainTabs: React.FC = () => (
  <IonTabs>
    <IonRouterOutlet>
      <Route exact path="/tabs/recovery" component={RecoveryPage} />
      <Route exact path="/tabs/activity" component={ActivityPage} />
      <Route exact path="/tabs/upload" component={UploadPage} />
      <Route exact path="/tabs/more" component={MorePage} />
      <Route exact path="/tabs/history"><Redirect to="/tabs/activity" /></Route>
      <Route exact path="/tabs"><Redirect to="/tabs/recovery" /></Route>
    </IonRouterOutlet>
    <IonTabBar slot="bottom" className="main-tab-bar">
      <IonTabButton tab="recovery" href="/tabs/recovery"><IonIcon icon={pulseOutline} /><IonLabel>Recovery</IonLabel></IonTabButton>
      <IonTabButton tab="upload" href="/tabs/upload"><IonIcon icon={addCircleOutline} /><IonLabel>Upload</IonLabel></IonTabButton>
      <IonTabButton tab="activity" href="/tabs/activity"><IonIcon icon={todayOutline} /><IonLabel>Activity</IonLabel></IonTabButton>
      <IonTabButton tab="more" href="/tabs/more"><IonIcon icon={ellipsisHorizontalCircleOutline} /><IonLabel>More</IonLabel></IonTabButton>
    </IonTabBar>
  </IonTabs>
);

export default MainTabs;
