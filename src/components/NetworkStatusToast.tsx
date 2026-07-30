import React, { useEffect, useState } from 'react';
import { IonToast } from '@ionic/react';
import { cloudOfflineOutline, wifiOutline } from 'ionicons/icons';

export const NetworkStatusToast: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showToast, setShowToast] = useState(!navigator.onLine);
  const [toastMessage, setToastMessage] = useState(
    navigator.onLine ? '' : 'Offline · Showing the latest data saved on this device.',
  );
  const [toastIcon, setToastIcon] = useState(cloudOfflineOutline);

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      setToastMessage('Offline · Showing the latest data saved on this device.');
      setToastIcon(cloudOfflineOutline);
      setShowToast(true);
    };

    const handleOnline = () => {
      setIsOffline((wasOffline) => {
        if (wasOffline) {
          setToastMessage('Back online · New data can sync again.');
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
      duration={isOffline ? 0 : 2800}
      icon={toastIcon}
      position="bottom"
      color={isOffline ? 'warning' : 'success'}
      className="network-status-toast"
      aria-live={isOffline ? 'assertive' : 'polite'}
    />
  );
};
