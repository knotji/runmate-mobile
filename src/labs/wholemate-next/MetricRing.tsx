import { useEffect, useRef, useState } from 'react';
import type { RingMetric } from './mockToday';

const STATUS_COLOR: Record<RingMetric['status'], string> = {
  good: 'var(--wmn-status-good)',
  steady: 'var(--wmn-status-steady)',
  caution: 'var(--wmn-status-caution)',
  low: 'var(--wmn-status-low)',
};

const SIZE = 74;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Longer strings (sleep duration, "7h 42m") need a smaller center size
// than short scores ("86") to stay legible inside a fixed-size ring.
const centerSizeClass = (displayValue: string) => (displayValue.length > 5 ? 'wmn-ring-center-compact' : 'wmn-ring-center-roomy');

export const MetricRing: React.FC<{ metric: RingMetric; onOpen?: () => void; delayMs?: number }> = ({ metric, onOpen, delayMs = 0 }) => {
  const [filled, setFilled] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const id = window.setTimeout(() => { if (mounted.current) setFilled(true); }, 30 + delayMs);
    return () => { mounted.current = false; window.clearTimeout(id); };
  }, [delayMs]);

  const offset = CIRCUMFERENCE * (1 - (filled ? metric.value : 0) / 100);
  const color = STATUS_COLOR[metric.status];

  return (
    <button type="button" className="wmn-ring" onClick={onOpen} style={{ '--wmn-ring-delay': `${delayMs}ms` } as React.CSSProperties}>
      <span className="wmn-ring-dial">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="wmn-ring-svg">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} className="wmn-ring-track" />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            className="wmn-ring-fill"
            style={{
              stroke: color,
              strokeDasharray: CIRCUMFERENCE,
              strokeDashoffset: offset,
            }}
          />
        </svg>
        <span className={`wmn-ring-center ${centerSizeClass(metric.displayValue)}`}>
          <span className="wmn-ring-value">{metric.displayValue}</span>
          {metric.unit && <span className="wmn-ring-unit">{metric.unit}</span>}
        </span>
      </span>
      <span className="wmn-ring-label">{metric.label}</span>
    </button>
  );
};
