import { IonIcon, IonSpinner } from '@ionic/react';
import { alertCircleOutline } from 'ionicons/icons';
import './PageState.css';

type PageStateProps = {
  kind: 'loading' | 'error' | 'empty';
  title: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: string;
  className?: string;
};

export function PageState({ kind, title, detail, actionLabel, onAction, icon, className = '' }: PageStateProps) {
  return <section className={`app-page-state app-page-state-${kind}${className ? ` ${className}` : ''}`} role={kind === 'error' ? 'alert' : 'status'} aria-live={kind === 'loading' ? 'polite' : undefined}>
    {kind === 'loading' ? <IonSpinner name="crescent" /> : <IonIcon icon={icon ?? alertCircleOutline} />}
    <div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>
    {actionLabel && onAction && <button type="button" onClick={onAction}>{actionLabel}</button>}
  </section>;
}
