import { IonIcon } from '@ionic/react';
import { batteryHalfOutline, chevronForwardOutline } from 'ionicons/icons';
import type { EnergyReserve } from '@/lib/energyReserve';
import './EnergyReserveCard.css';

export function EnergyReserveCard({ energy, onOpen }: { energy: EnergyReserve; onOpen: () => void }) {
  const progress = energy.score ?? 0;
  return (
    <button type="button" className={`energy-reserve-card is-${energy.level}`} onClick={onOpen} aria-label={energy.available ? `Energy Reserve ${energy.score} out of 100, ${energy.label}. Open details.` : 'Energy Reserve unavailable. Open details.'}>
      <span className="energy-reserve-ring" aria-hidden="true">
        <span className="energy-reserve-ring-dial" style={{ '--energy-dial-progress': `${progress}%` } as React.CSSProperties}>
          <span className="energy-reserve-ring-center">
            {energy.available ? <strong>{energy.score}</strong> : <IonIcon icon={batteryHalfOutline} />}
          </span>
        </span>
      </span>
      <span className="energy-reserve-body">
        <span className="energy-reserve-heading"><span>Energy Remaining</span><strong>{energy.label}</strong></span>
        <span className="energy-reserve-meta">
          {energy.available ? <><span>Start {energy.startingRecovery}</span><span>Used {energy.used}</span></> : <span>Waiting for current Recovery</span>}
          {energy.fuel.status !== 'unknown' && <span className={`is-fuel-${energy.fuel.status}`}>{energy.fuel.label}</span>}
        </span>
        <span className="energy-reserve-action">{energy.action.title}</span>
      </span>
      <IonIcon className="energy-reserve-chevron" icon={chevronForwardOutline} aria-hidden="true" />
    </button>
  );
}
