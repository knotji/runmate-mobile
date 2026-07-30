import { IonIcon } from '@ionic/react';
import { checkmarkCircleOutline, syncOutline, warningOutline } from 'ionicons/icons';
import type { RecoveryDataStatus } from '@/lib/recoveryDataFreshness';
import './DataFreshnessStatus.css';

type Props = {
  status: RecoveryDataStatus;
  detail: string;
  label?: string;
  note?: string;
  onRetry?: () => void;
  variant?: 'inline' | 'panel';
  className?: string;
  quietWhenFresh?: boolean;
};

export function DataFreshnessStatus({
  status,
  detail,
  label,
  note,
  onRetry,
  variant = 'inline',
  className = '',
  quietWhenFresh = false,
}: Props) {
  if (quietWhenFresh && status === 'fresh') return null;
  const needsRetry = status === 'stale' || status === 'fallback';
  const icon = status === 'refreshing' ? syncOutline : needsRetry ? warningOutline : checkmarkCircleOutline;
  return (
    <div
      className={`data-freshness data-freshness-${variant} data-freshness-${status} ${className}`.trim()}
      role="status"
      aria-live={status === 'fallback' ? 'assertive' : 'polite'}
    >
      <IonIcon icon={icon} aria-hidden="true" />
      <span>
        {label && <strong>{label}</strong>}
        <small>{detail}{note ? ` · ${note}` : ''}</small>
      </span>
      {needsRetry && onRetry && <button type="button" onClick={onRetry} aria-label={`${label ?? 'Data'}: retry refresh`}>Retry</button>}
    </div>
  );
}
