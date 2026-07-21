import './AppBootScreen.css';

interface AppBootScreenProps {
  message?: string;
}

export function AppBootScreen({ message = 'Getting Your Day Ready' }: AppBootScreenProps) {
  return (
    <main className="app-boot-screen" role="status" aria-live="polite" aria-label={message}>
      <div className="app-boot-brand" aria-hidden="true">
        <div className="app-boot-logo-wrap">
          <img src="/icon-512.png" alt="" className="app-boot-logo" />
          <span className="app-boot-logo-glow" />
        </div>
        <strong>RunMate</strong>
        <span>{message}</span>
        <div className="app-boot-progress"><i /></div>
      </div>
    </main>
  );
}
