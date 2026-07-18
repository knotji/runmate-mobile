import { useRef } from 'react';
import { IonIcon } from '@ionic/react';
import { calendarClearOutline } from 'ionicons/icons';

export default function UploadDateField({ label, value, max, onChange, className = '' }: { label: string; value: string; max: string; onChange: (value: string) => void; className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const open = () => { const input = inputRef.current; if (!input) return; if (typeof input.showPicker === 'function') input.showPicker(); else input.click(); };
  return <label className={`upload-date-control ${className}`.trim()}><span>{label}</span><button type="button" onClick={open}><IonIcon icon={calendarClearOutline} /><strong>{formatDisplayDate(value)}</strong></button><input ref={inputRef} type="date" value={value} max={max} onChange={(event) => onChange(event.target.value)} tabIndex={-1} aria-hidden="true" /></label>;
}

function formatDisplayDate(value: string): string {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : 'Select Date';
}
