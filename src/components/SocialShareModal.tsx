import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import {
  checkmarkOutline,
  closeOutline,
  downloadOutline,
  informationCircleOutline,
  shareSocialOutline,
} from 'ionicons/icons';
import type { CoachContext } from '@/lib/buildCoachContext';
import { hapticImpact, hapticNotification } from '@/lib/haptics';
import { canSaveStoryImageNatively, saveStoryImageNatively } from '@/lib/storyImage';
import {
  getAvailableWorkoutMetrics,
  WORKOUT_METRIC_ORDER,
  type SportType,
  type WorkoutMetricKey,
} from '@/lib/workoutShareMetrics';
import './SocialShareModal.css';

export type ShareTheme = 'cyber-dark' | 'sunrise-fresh' | 'minimal-glass' | 'transparent-overlay' | 'ultra-minimal';
export type { SportType } from '@/lib/workoutShareMetrics';

export interface WorkoutShareData {
  title: string;
  type?: SportType;
  distanceKm?: number;
  durationSeconds: number;
  paceFormatted?: string;
  avgHeartRateBpm?: number;
  caloriesKcal?: number;
  elevationMeters?: number;
  dateStr?: string;
  isStrength?: boolean;
}

interface SocialShareModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  context?: CoachContext | null;
  mode?: 'recovery' | 'workout';
  workoutData?: WorkoutShareData | null;
}

type CanvasPalette = {
  text: string;
  muted: string;
  faint: string;
  accent: string;
  hairline: string;
};

type StoryMetric = {
  label: string;
  value: string;
  unit?: string;
};

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;
const STORY_FONT = '"IBM Plex Sans Thai", sans-serif';

export const SocialShareModal: React.FC<SocialShareModalProps> = ({
  isOpen,
  onDismiss,
  context = null,
  mode = 'recovery',
  workoutData = null,
}) => {
  const defaultTheme: ShareTheme = mode === 'workout' ? 'transparent-overlay' : 'minimal-glass';
  const [selectedTheme, setSelectedTheme] = useState<ShareTheme>(defaultTheme);
  const [generating, setGenerating] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedWorkoutMetrics, setSelectedWorkoutMetrics] = useState<WorkoutMetricKey[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const themeOptions: Array<{ theme: ShareTheme; label: string }> = mode === 'workout'
    ? [
      { theme: 'transparent-overlay', label: 'Overlay' },
      { theme: 'ultra-minimal', label: 'Ultra Minimal' },
      { theme: 'cyber-dark', label: 'Dark' },
      { theme: 'minimal-glass', label: 'Light' },
    ]
    : [
      { theme: 'cyber-dark', label: 'Dark' },
      { theme: 'minimal-glass', label: 'Light' },
    ];
  const themeIndex = Math.max(0, themeOptions.findIndex(({ theme }) =>
    theme === selectedTheme || (theme === 'minimal-glass' && selectedTheme === 'sunrise-fresh')));

  const score = context ? Math.round(context.recoverySystem.overallScore) : null;
  const recoveryLabel = context?.recoverySystem.overallLabel ?? 'Recovery';
  const sleepMinutes = context?.recoverySystem.sleepPerformance.actualSleepMinutes ?? null;
  const strainScore = context?.recoverySystem.strain.score ?? null;

  const title = workoutData?.title ?? 'Workout';
  const sportType: SportType = workoutData?.type ?? (workoutData?.isStrength ? 'strength' : 'workout');
  const distanceKm = workoutData?.distanceKm;
  const durationSeconds = workoutData?.durationSeconds ?? 0;
  const pace = workoutData?.paceFormatted;
  const averageHeartRate = workoutData?.avgHeartRateBpm;
  const caloriesKcal = workoutData?.caloriesKcal;
  const elevationMeters = workoutData?.elevationMeters;
  const dateText = workoutData?.dateStr ?? new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  }).format(new Date());
  const availableWorkoutMetrics = useMemo(
    () => getAvailableWorkoutMetrics({
      sportType,
      distanceKm,
      durationSeconds,
      pace,
      averageHeartRate,
      caloriesKcal,
      elevationMeters,
    }),
    [averageHeartRate, caloriesKcal, distanceKm, durationSeconds, elevationMeters, pace, sportType],
  );

  const renderCardCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return false;

    canvas.width = STORY_WIDTH;
    canvas.height = STORY_HEIGHT;
    ctx.clearRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

    const palette = drawStoryBackground(ctx, selectedTheme);

    if (mode === 'workout') {
      drawWorkoutStory(ctx, palette, {
        title,
        sportType,
        theme: selectedTheme,
        distanceKm,
        durationSeconds,
        pace,
        averageHeartRate,
        caloriesKcal,
        elevationMeters,
        dateText,
        selectedMetrics: selectedWorkoutMetrics,
      });
    } else if (score !== null) {
      drawRecoveryStory(ctx, palette, {
        score,
        label: recoveryLabel,
        sleepMinutes,
        strainScore,
        dateText,
      });
    }

    setDataUrl(canvas.toDataURL('image/png'));
    return true;
  }, [
    averageHeartRate,
    caloriesKcal,
    dateText,
    distanceKm,
    durationSeconds,
    elevationMeters,
    mode,
    pace,
    recoveryLabel,
    score,
    selectedWorkoutMetrics,
    selectedTheme,
    sleepMinutes,
    sportType,
    strainScore,
    title,
  ]);

  const prepareStory = useCallback(async () => {
    setGenerating(true);
    try {
      await renderCardCanvas();
    } finally {
      setGenerating(false);
    }
  }, [renderCardCanvas]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedTheme(mode === 'workout' ? 'transparent-overlay' : 'minimal-glass');
    if (mode === 'workout') {
      setSelectedWorkoutMetrics(availableWorkoutMetrics.slice(0, 4).map((metric) => metric.key));
    }
  }, [availableWorkoutMetrics, isOpen, mode]);

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => {
      void prepareStory();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, prepareStory]);

  const selectTheme = (theme: ShareTheme) => {
    void hapticImpact();
    setSelectedTheme(theme);
  };

  const stepTheme = (direction: 1 | -1) => {
    const nextIndex = themeIndex + direction;
    if (nextIndex < 0 || nextIndex >= themeOptions.length) return;
    selectTheme(themeOptions[nextIndex].theme);
  };

  const SWIPE_THRESHOLD_PX = 45;

  const handlePreviewTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    swipeStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handlePreviewTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) < Math.abs(deltaY)) return;
    stepTheme(deltaX < 0 ? 1 : -1);
  };

  const showToast = (message: string, durationMs = 2600) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), durationMs);
  };

  const showOverlayInfo = () => {
    void hapticImpact();
    showToast(
      'Layer this over your own photo or video in Instagram/Facebook Stories. Saving it directly may show as solid black in apps that do not support transparency.',
      4200,
    );
  };

  const toggleWorkoutMetric = (metric: WorkoutMetricKey) => {
    void hapticImpact();
    setSelectedWorkoutMetrics((current) => {
      if (current.includes(metric)) {
        if (current.length === 1) {
          showToast('Keep at least one detail');
          return current;
        }
        return current.filter((key) => key !== metric);
      }
      if (current.length >= 4) {
        showToast('Choose up to 4 details');
        return current;
      }
      const next = new Set([...current, metric]);
      return WORKOUT_METRIC_ORDER.filter((key) => next.has(key));
    });
  };

  const saveImage = async () => {
    if (!dataUrl) return;
    void hapticImpact();
    const fileName = `RunMate-${mode === 'workout' ? 'Workout' : 'Recovery'}-${Date.now()}.png`;
    const savedMessage = selectedTheme === 'transparent-overlay'
      ? 'Saved (Transparent Background)'
      : 'Saved To Pictures / RunMate';
    if (canSaveStoryImageNatively()) {
      try {
        await saveStoryImageNatively(dataUrl, fileName);
        void hapticNotification();
        showToast(savedMessage);
      } catch {
        showToast('Could Not Save Image');
      }
      return;
    }
    const link = document.createElement('a');
    link.download = fileName;
    link.href = dataUrl;
    link.click();
    void hapticNotification();
    showToast(selectedTheme === 'transparent-overlay' ? savedMessage : 'Story image saved');
  };

  const shareImage = async () => {
    if (!dataUrl) return;
    void hapticImpact();
    try {
      const response = await fetch(dataUrl);
      const file = new File([await response.blob()], 'runmate-story.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: mode === 'workout' ? 'RunMate Workout' : 'RunMate Recovery',
          text: mode === 'workout'
            ? `${title}${distanceKm ? ` · ${distanceKm.toFixed(2)} km` : ''}`
            : `Recovery ${score ?? '—'}/100`,
          files: [file],
        });
        void hapticNotification();
        return;
      }
      await saveImage();
    } catch {
      await saveImage();
    }
  };

  const isReady = Boolean(dataUrl) && !generating;

  return (
    <IonModal
      isOpen={isOpen}
      onDidPresent={() => void prepareStory()}
      onDidDismiss={onDismiss}
      className="social-share-modal"
    >
      <IonHeader translucent className="social-share-header">
        <div className="social-share-sheet-handle" aria-hidden="true" />
        <IonToolbar>
          <IonTitle>{mode === 'workout' ? 'Share Workout' : 'Share Recovery'}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onDismiss} aria-label="Close Share">
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="social-share-content">
        <div className="social-share-shell">
          <div
            className={`social-share-preview-container ${selectedTheme === 'transparent-overlay' ? 'transparent-grid' : ''}`}
            onTouchStart={handlePreviewTouchStart}
            onTouchEnd={handlePreviewTouchEnd}
          >
            {generating && (
              <div className="social-share-loading" role="status">
                <IonSpinner name="crescent" />
                <p>Preparing Story</p>
              </div>
            )}
            <canvas ref={canvasRef} className="social-share-canvas" hidden />
            {dataUrl && <img src={dataUrl} alt="RunMate Story Preview" className="social-share-preview-img" draggable={false} />}
          </div>

          <div className="social-share-theme-slider" aria-labelledby="story-style-label">
            <div className="social-share-theme-current-row">
              <p id="story-style-label" className="social-share-theme-current">{themeOptions[themeIndex]?.label}</p>
              {selectedTheme === 'transparent-overlay' && (
                <button type="button" className="theme-info-btn" aria-label="About Transparent Background" onClick={showOverlayInfo}>
                  <IonIcon icon={informationCircleOutline} />
                </button>
              )}
            </div>
            <div className="social-share-theme-dots">
              {themeOptions.map((option, index) => (
                <button
                  key={option.theme}
                  type="button"
                  className={`theme-dot${index === themeIndex ? ' active' : ''}`}
                  aria-label={`Background Style: ${option.label}`}
                  aria-pressed={index === themeIndex}
                  onClick={() => selectTheme(option.theme)}
                />
              ))}
            </div>
            <p className="social-share-theme-hint">Swipe The Preview To Change Background</p>
          </div>

          {mode === 'workout' && availableWorkoutMetrics.length > 0 && (
            <div className="social-share-controls">
              <section className="social-share-detail-selector" aria-labelledby="story-details-label">
                <div className="social-share-selector-heading">
                  <p id="story-details-label">Workout Metrics</p>
                  <span>Select 1–4</span>
                </div>
                <p className="social-share-selector-note">The top active metric is shown largest.</p>
                <div className="social-share-detail-chips">
                  {availableWorkoutMetrics.map((metric) => {
                    const active = selectedWorkoutMetrics.includes(metric.key);
                    return (
                      <button
                        type="button"
                        key={metric.key}
                        className={`detail-chip${active ? ' active' : ''}`}
                        aria-pressed={active}
                        onClick={() => toggleWorkoutMetric(metric.key)}
                      >
                        <span aria-hidden="true">{active && <IonIcon icon={checkmarkOutline} />}</span>
                        {metric.label}
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          <div className="social-share-actions">
            <button type="button" className="share-action-btn primary" disabled={!isReady} onClick={() => void shareImage()}>
              <IonIcon icon={shareSocialOutline} /> Share
            </button>
            <button type="button" className="share-action-btn secondary" disabled={!isReady} onClick={() => void saveImage()}>
              <IonIcon icon={downloadOutline} /> Save
            </button>
          </div>

          {toastMessage && <div className="social-share-toast" role="status">{toastMessage}</div>}
        </div>
      </IonContent>
    </IonModal>
  );
};


function drawStoryBackground(
  ctx: CanvasRenderingContext2D,
  theme: ShareTheme,
): CanvasPalette {
  if (theme === 'transparent-overlay') {
    ctx.clearRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
    return darkPalette();
  }

  if (theme === 'ultra-minimal') {
    const background = ctx.createLinearGradient(0, 0, 0, STORY_HEIGHT);
    background.addColorStop(0, '#0c131a');
    background.addColorStop(1, '#05090d');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
    return {
      text: '#ffffff',
      muted: 'rgba(255, 255, 255, 0.72)',
      faint: 'rgba(255, 255, 255, 0.45)',
      accent: '#00f0ff',
      hairline: 'rgba(255, 255, 255, 0.12)',
    };
  }

  if (theme === 'minimal-glass' || theme === 'sunrise-fresh') {
    const background = ctx.createLinearGradient(0, 0, STORY_WIDTH, STORY_HEIGHT);
    background.addColorStop(0, '#f5fbfd');
    background.addColorStop(1, '#dceff4');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
    return {
      text: '#102c43',
      muted: 'rgba(16, 44, 67, .66)',
      faint: 'rgba(16, 44, 67, .42)',
      accent: '#138fb1',
      hairline: 'rgba(16, 44, 67, .14)',
    };
  }

  const background = ctx.createLinearGradient(0, 0, 0, STORY_HEIGHT);
  background.addColorStop(0, '#10263a');
  background.addColorStop(1, '#08131f');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  return darkPalette();
}

function darkPalette(): CanvasPalette {
  return {
    text: '#ffffff',
    muted: 'rgba(255, 255, 255, .68)',
    faint: 'rgba(255, 255, 255, .44)',
    accent: '#42c5e8',
    hairline: 'rgba(255, 255, 255, .18)',
  };
}

function drawWorkoutStory(
  ctx: CanvasRenderingContext2D,
  palette: CanvasPalette,
  data: {
    title: string;
    sportType: SportType;
    theme: ShareTheme;
    distanceKm?: number;
    durationSeconds: number;
    pace?: string;
    averageHeartRate?: number;
    caloriesKcal?: number;
    elevationMeters?: number;
    dateText: string;
    selectedMetrics: WorkoutMetricKey[];
  },
) {
  const metrics = getAvailableWorkoutMetrics(data)
    .filter((metric) => data.selectedMetrics.includes(metric.key));
  const heroMetric = metrics[0];
  const secondaryMetrics = metrics.slice(1, 4);
  const centerX = STORY_WIDTH / 2;

  ctx.save();

  // A short accent flourish above the hero number fills the otherwise bare
  // top third of the 9:16 canvas and reads as an intentional stat-card
  // header rather than empty space, without adding any title/date text.
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(centerX - 38, 372);
  ctx.lineTo(centerX + 38, 372);
  ctx.stroke();
  ctx.fillStyle = palette.accent;
  ctx.beginPath();
  ctx.arc(centerX, 372, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'rgba(0, 0, 0, .45)';
  ctx.shadowBlur = data.theme === 'transparent-overlay' ? 12 : data.theme === 'minimal-glass' || data.theme === 'sunrise-fresh' ? 0 : 10;

  if (heroMetric) {
    drawFittedTextCentered(ctx, heroMetric.value, centerX, 550, 900, 180, palette.text, '700');
    ctx.font = `700 34px ${STORY_FONT}`;
    ctx.fillStyle = palette.accent;
    ctx.textAlign = 'center';
    ctx.fillText((heroMetric.unit ?? heroMetric.label).toUpperCase(), centerX, 618);
  }

  ctx.shadowBlur = 0;
  drawWorkoutMetricRow(ctx, palette, secondaryMetrics, 800);
  drawSportSignature(ctx, palette, data.sportType, secondaryMetrics.length > 0 ? 1220 : 1080, 0.95);
  ctx.restore();
}

function cleanMetricLabel(label: string): string {
  return label
    .replace(/^AVERAGE\s+/i, 'AVG ')
    .replace(/^AVG\.\s+/i, 'AVG ')
    .toUpperCase();
}

function drawWorkoutMetricRow(ctx: CanvasRenderingContext2D, palette: CanvasPalette, metrics: StoryMetric[], y: number) {
  if (metrics.length === 0) return;
  const left = 90;
  const width = 900;
  const columnWidth = width / metrics.length;

  ctx.strokeStyle = palette.hairline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, y - 65);
  ctx.lineTo(left + width, y - 65);
  ctx.stroke();

  metrics.forEach((metric, index) => {
    const textX = left + columnWidth * (index + 0.5);
    if (index > 0) {
      const dividerX = left + columnWidth * index;
      ctx.beginPath();
      ctx.moveTo(dividerX, y - 15);
      ctx.lineTo(dividerX, y + 105);
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = palette.faint;
    ctx.font = `600 20px ${STORY_FONT}`;
    ctx.fillText(cleanMetricLabel(metric.label), textX, y);
    ctx.fillStyle = palette.text;
    ctx.font = `700 48px ${STORY_FONT}`;
    ctx.fillText(metric.value, textX, y + 56);
    if (metric.unit) {
      ctx.fillStyle = palette.accent;
      ctx.font = `600 22px ${STORY_FONT}`;
      ctx.fillText(metric.unit, textX, y + 94);
    }
  });
}

function drawRecoveryStory(
  ctx: CanvasRenderingContext2D,
  palette: CanvasPalette,
  data: { score: number; label: string; sleepMinutes: number | null; strainScore: number | null; dateText: string },
) {
  drawStoryHeader(ctx, palette, 'Recovery', data.dateText);

  const centerX = STORY_WIDTH / 2;
  const centerY = 690;
  const radius = 210;
  ctx.lineWidth = 18;
  ctx.lineCap = 'round';
  ctx.strokeStyle = palette.hairline;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  const accent = recoveryAccent(data.score);
  ctx.strokeStyle = accent;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(100, data.score)) / 100);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = palette.text;
  ctx.font = `700 178px ${STORY_FONT}`;
  ctx.fillText(`${data.score}`, centerX, centerY + 45);
  ctx.fillStyle = palette.muted;
  ctx.font = `600 26px ${STORY_FONT}`;
  ctx.fillText('RECOVERY / 100', centerX, centerY + 105);
  ctx.fillStyle = accent;
  ctx.font = `700 30px ${STORY_FONT}`;
  ctx.fillText(data.label, centerX, centerY + 290);

  const metrics: StoryMetric[] = [];
  if (data.sleepMinutes !== null) metrics.push({ label: 'SLEEP', value: formatSleep(data.sleepMinutes) });
  if (data.strainScore !== null) metrics.push({ label: 'STRAIN', value: data.strainScore.toFixed(1), unit: '/21' });
  drawMetricRow(ctx, palette, metrics, 1200);
  drawFooter(ctx, palette);
}

function drawStoryHeader(ctx: CanvasRenderingContext2D, palette: CanvasPalette, title: string, date: string) {
  drawFittedText(ctx, title, 110, 230, 860, 54, palette.text, '700');
  ctx.textAlign = 'left';
  ctx.fillStyle = palette.muted;
  ctx.font = `500 24px ${STORY_FONT}`;
  ctx.fillText(date, 110, 275);
}

function drawMetricRow(ctx: CanvasRenderingContext2D, palette: CanvasPalette, metrics: StoryMetric[], y: number) {
  if (metrics.length === 0) return;
  const left = 110;
  const width = 860;
  const columnWidth = width / metrics.length;

  metrics.forEach((metric, index) => {
    const x = left + columnWidth * index;
    ctx.textAlign = 'center';
    const textX = x + columnWidth / 2;
    ctx.fillStyle = palette.faint;
    ctx.font = `600 19px ${STORY_FONT}`;
    ctx.fillText(metric.label, textX, y);
    ctx.fillStyle = palette.text;
    ctx.font = `650 42px ${STORY_FONT}`;
    ctx.fillText(metric.value, textX, y + 66);
    if (metric.unit) {
      ctx.fillStyle = palette.accent;
      ctx.font = `500 18px ${STORY_FONT}`;
      ctx.fillText(metric.unit, textX, y + 105);
    }
  });
}

function drawFooter(ctx: CanvasRenderingContext2D, palette: CanvasPalette) {
  ctx.textAlign = 'right';
  ctx.fillStyle = palette.faint;
  ctx.font = `600 21px ${STORY_FONT}`;
  ctx.fillText('RUNMATE', 970, 1760);
}

function drawSportSignature(
  ctx: CanvasRenderingContext2D,
  palette: CanvasPalette,
  sportType: SportType,
  centerY = 1510,
  scale = 1,
) {
  const centerX = STORY_WIDTH / 2;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(scale, scale);
  ctx.strokeStyle = palette.accent;
  ctx.fillStyle = palette.accent;
  ctx.lineWidth = 15;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (sportType) {
    case 'cycling':
      drawCyclingGlyph(ctx);
      break;
    case 'strength':
      drawStrengthGlyph(ctx);
      break;
    case 'swimming':
      drawSwimmingGlyph(ctx);
      break;
    case 'walking':
      drawWalkingGlyph(ctx);
      break;
    case 'running':
      drawRunningGlyph(ctx);
      break;
    default:
      drawWorkoutGlyph(ctx);
      break;
  }

  ctx.restore();
  ctx.textAlign = 'center';
  ctx.fillStyle = palette.text;
  ctx.font = `700 ${Math.round(30 * scale)}px ${STORY_FONT}`;
  ctx.fillText('RUNMATE', centerX, centerY + 138 * scale);
}

function drawCyclingGlyph(ctx: CanvasRenderingContext2D) {
  strokeCircle(ctx, -78, 32, 48);
  strokeCircle(ctx, 78, 32, 48);
  ctx.beginPath();
  ctx.moveTo(-78, 32);
  ctx.lineTo(-24, 32);
  ctx.lineTo(10, -28);
  ctx.lineTo(48, 32);
  ctx.lineTo(-24, 32);
  ctx.lineTo(-4, -8);
  ctx.lineTo(62, -8);
  ctx.moveTo(-14, -32);
  ctx.lineTo(17, -32);
  ctx.moveTo(48, 32);
  ctx.lineTo(67, -30);
  ctx.lineTo(87, -30);
  ctx.stroke();
}

function drawStrengthGlyph(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(-92, 0);
  ctx.lineTo(92, 0);
  ctx.stroke();
  [-72, -48, 48, 72].forEach((x) => {
    ctx.beginPath();
    ctx.moveTo(x, -42);
    ctx.lineTo(x, 42);
    ctx.stroke();
  });
}

function drawSwimmingGlyph(ctx: CanvasRenderingContext2D) {
  strokeCircle(ctx, -34, -44, 19, true);
  ctx.beginPath();
  ctx.moveTo(-12, -27);
  ctx.lineTo(34, -5);
  ctx.lineTo(74, -35);
  ctx.moveTo(-91, 22);
  ctx.bezierCurveTo(-58, -2, -29, 46, 3, 22);
  ctx.bezierCurveTo(34, -2, 61, 46, 94, 22);
  ctx.moveTo(-91, 62);
  ctx.bezierCurveTo(-58, 38, -29, 86, 3, 62);
  ctx.bezierCurveTo(34, 38, 61, 86, 94, 62);
  ctx.stroke();
}

function drawWalkingGlyph(ctx: CanvasRenderingContext2D) {
  strokeCircle(ctx, 4, -66, 21, true);
  ctx.beginPath();
  ctx.moveTo(-1, -39);
  ctx.lineTo(-18, 9);
  ctx.lineTo(-68, 45);
  ctx.moveTo(-13, -2);
  ctx.lineTo(38, 18);
  ctx.lineTo(67, 66);
  ctx.moveTo(-18, 9);
  ctx.lineTo(7, 43);
  ctx.lineTo(-26, 84);
  ctx.stroke();
}

function drawRunningGlyph(ctx: CanvasRenderingContext2D) {
  // A simple running shoe stays recognizable at Story-preview size and avoids
  // the ambiguous crossed limbs of a small stick-figure runner.
  ctx.beginPath();
  ctx.moveTo(-90, 23);
  ctx.bezierCurveTo(-65, 22, -48, 9, -40, -22);
  ctx.lineTo(-29, -56);
  ctx.lineTo(-3, -34);
  ctx.bezierCurveTo(18, -16, 43, -2, 77, 9);
  ctx.bezierCurveTo(96, 15, 104, 27, 99, 41);
  ctx.bezierCurveTo(95, 54, 83, 61, 65, 61);
  ctx.lineTo(-73, 61);
  ctx.bezierCurveTo(-94, 61, -105, 50, -103, 38);
  ctx.bezierCurveTo(-102, 30, -98, 25, -90, 23);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-92, 34);
  ctx.lineTo(93, 34);
  ctx.moveTo(-34, -20);
  ctx.lineTo(-4, -13);
  ctx.moveTo(-18, -4);
  ctx.lineTo(12, 3);
  ctx.moveTo(-98, 82);
  ctx.lineTo(-48, 82);
  ctx.moveTo(-113, 105);
  ctx.lineTo(-77, 105);
  ctx.stroke();
}

function drawWorkoutGlyph(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(-90, 5);
  ctx.lineTo(-50, 5);
  ctx.lineTo(-25, -38);
  ctx.lineTo(9, 55);
  ctx.lineTo(40, -5);
  ctx.lineTo(90, -5);
  ctx.stroke();
}

function strokeCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fill = false,
) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  if (fill) {
    ctx.fill();
  } else {
    ctx.stroke();
  }
}

function drawFittedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxFontSize: number,
  color: string,
  weight: string,
) {
  let fontSize = maxFontSize;
  do {
    ctx.font = `${weight} ${fontSize}px ${STORY_FONT}`;
    fontSize -= 2;
  } while (ctx.measureText(text).width > maxWidth && fontSize > 34);
  ctx.textAlign = 'left';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawFittedTextCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxFontSize: number,
  color: string,
  weight: string,
) {
  let fontSize = maxFontSize;
  do {
    ctx.font = `${weight} ${fontSize}px ${STORY_FONT}`;
    fontSize -= 2;
  } while (ctx.measureText(text).width > maxWidth && fontSize > 34);
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function recoveryAccent(score: number): string {
  if (score >= 67) return '#16b894';
  if (score >= 34) return '#e5a11d';
  return '#e45d6c';
}

function formatSleep(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
