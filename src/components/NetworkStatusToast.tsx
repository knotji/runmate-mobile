import React, { useEffect, useState } from 'react';
import { IonToast } from '@ionic/react';
import { cloudOfflineOutline, wifiOutline } from 'ionicons/icons';

export const NetworkStatusToast: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastIcon, setToastIcon] = useState(cloudOfflineOutline);

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      setToastMessage('You are offline. Showing cached RunMate data.');
      setToastIcon(cloudOfflineOutline);
      setShowToast(true);
    };

    const handleOnline = () => {
      setIsOffline((wasOffline) => {
        if (wasOffline) {
          setToastMessage('Back online. Connection restored.');
          setToastIcon(wifiOutline);
          setShowToast(true);
        }
        return false;
      });
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return (
    <IonToast
      isOpen={showToast}
      onDidDismiss={() => setShowToast(false)}
      message={toastMessage}
      duration={3500}
      icon={toastIcon}
      position="bottom"
      color={isOffline ? 'warning' : 'success'}
      className="network-status-toast"
    />
  );
};
