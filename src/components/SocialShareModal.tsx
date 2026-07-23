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
  closeOutline,
  downloadOutline,
  shareSocialOutline,
} from 'ionicons/icons';
import type { CoachContext } from '@/lib/buildCoachContext';
import { hapticImpact, hapticNotification } from '@/lib/haptics';
import { canSaveStoryImageNatively, saveStoryImageNatively } from '@/lib/storyImage';
import './SocialShareModal.css';

export type ShareTheme = 'cyber-dark' | 'sunrise-fresh' | 'minimal-glass' | 'transparent-overlay' | 'custom-photo';
export type SportType = 'running' | 'walking' | 'cycling' | 'strength' | 'swimming' | 'workout';

export interface WorkoutShareData {
  title: string;
  type?: SportType;
  distanceKm?: number;
  durationSeconds: number;
  paceFormatted?: string;
  avgHeartRateBpm?: number;
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

type WorkoutMetricKey = 'distance' | 'duration' | 'pace' | 'heart-rate' | 'elevation';

type WorkoutStoryMetric = StoryMetric & {
  key: WorkoutMetricKey;
};

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;
const STORY_FONT = '"IBM Plex Sans Thai", sans-serif';
const WORKOUT_METRIC_ORDER: WorkoutMetricKey[] = ['distance', 'duration', 'pace', 'heart-rate', 'elevation'];

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
  const [customPhotoUrl, setCustomPhotoUrl] = useState<string | null>(null);
  const [selectedWorkoutMetrics, setSelectedWorkoutMetrics] = useState<WorkoutMetricKey[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      elevationMeters,
    }),
    [averageHeartRate, distanceKm, durationSeconds, elevationMeters, pace, sportType],
  );

  const renderCardCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return false;

    canvas.width = STORY_WIDTH;
    canvas.height = STORY_HEIGHT;
    ctx.clearRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

    const palette = await drawStoryBackground(ctx, selectedTheme, customPhotoUrl);

    if (mode === 'workout') {
      drawWorkoutStory(ctx, palette, {
        title,
        sportType,
        theme: selectedTheme,
        distanceKm,
        durationSeconds,
        pace,
        averageHeartRate,
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
    customPhotoUrl,
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
    if (theme === 'custom-photo') {
      fileInputRef.current?.click();
      return;
    }
    setSelectedTheme(theme);
  };

  const uploadPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      setCustomPhotoUrl(reader.result);
      setSelectedTheme('custom-photo');
    };
    reader.readAsDataURL(file);
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 2600);
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
    if (canSaveStoryImageNatively()) {
      try {
        await saveStoryImageNatively(dataUrl, fileName);
        void hapticNotification();
        showToast('Saved To Pictures / RunMate');
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
    showToast('Story image saved');
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
          <div className={`social-share-preview-container ${selectedTheme === 'transparent-overlay' ? 'transparent-grid' : ''}`}>
            {generating && (
              <div className="social-share-loading" role="status">
                <IonSpinner name="crescent" />
                <p>Preparing Story</p>
              </div>
            )}
            <canvas ref={canvasRef} className="social-share-canvas" hidden />
            {dataUrl && <img src={dataUrl} alt="RunMate Story Preview" className="social-share-preview-img" />}
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={uploadPhoto} />

          {mode === 'workout' && availableWorkoutMetrics.length > 0 && (
            <section className="social-share-detail-selector" aria-labelledby="story-details-label">
              <div className="social-share-selector-heading">
                <p id="story-details-label">Share Details</p>
                <span>Choose Up To 4</span>
              </div>
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
                      <span aria-hidden="true">{active ? '✓' : ''}</span>
                      {metric.label}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section className="social-share-theme-selector" aria-labelledby="story-style-label">
            <p id="story-style-label" className="social-share-theme-label">Background</p>
            <div className="social-share-theme-chips">
              {mode === 'workout' && (
                <>
                  <ThemeButton label="Overlay" active={selectedTheme === 'transparent-overlay'} onClick={() => selectTheme('transparent-overlay')} />
                  <ThemeButton label="Photo" active={selectedTheme === 'custom-photo'} onClick={() => selectTheme('custom-photo')} />
                </>
              )}
              <ThemeButton label="Dark" active={selectedTheme === 'cyber-dark'} onClick={() => selectTheme('cyber-dark')} />
              <ThemeButton label="Light" active={selectedTheme === 'minimal-glass' || selectedTheme === 'sunrise-fresh'} onClick={() => selectTheme('minimal-glass')} />
            </div>
          </section>

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

function ThemeButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`theme-chip${active ? ' active' : ''}`} aria-pressed={active} onClick={onClick}>
      {label}
    </button>
  );
}

async function drawStoryBackground(
  ctx: CanvasRenderingContext2D,
  theme: ShareTheme,
  customPhotoUrl: string | null,
): Promise<CanvasPalette> {
  if (theme === 'transparent-overlay') {
    ctx.clearRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
    return darkPalette();
  }

  if (theme === 'custom-photo' && customPhotoUrl) {
    await drawCoverImage(ctx, customPhotoUrl);
    const shade = ctx.createLinearGradient(0, 0, 0, STORY_HEIGHT);
    shade.addColorStop(0, 'rgba(3, 12, 20, .22)');
    shade.addColorStop(.45, 'rgba(3, 12, 20, .08)');
    shade.addColorStop(1, 'rgba(3, 12, 20, .72)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
    return darkPalette();
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
    elevationMeters?: number;
    dateText: string;
    selectedMetrics: WorkoutMetricKey[];
  },
) {
  const metrics = getAvailableWorkoutMetrics(data)
    .filter((metric) => data.selectedMetrics.includes(metric.key));
  const heroMetric = metrics[0];

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, .28)';
  ctx.shadowBlur = data.theme === 'minimal-glass' || data.theme === 'sunrise-fresh' ? 0 : 10;

  if (heroMetric) {
    drawFittedTextCentered(ctx, heroMetric.value, STORY_WIDTH / 2, 625, 840, 210, palette.text, '700');
    ctx.font = `700 38px ${STORY_FONT}`;
    ctx.fillStyle = palette.accent;
    ctx.textAlign = 'center';
    ctx.fillText((heroMetric.unit ?? heroMetric.label).toUpperCase(), STORY_WIDTH / 2, 690);
  }

  ctx.shadowBlur = 0;
  drawWorkoutMetricRow(ctx, palette, metrics.slice(1, 4), 910);
  drawSportSignature(ctx, palette, data.sportType, 1320, 0.82);
  ctx.restore();
}

function getAvailableWorkoutMetrics(data: {
  sportType: SportType;
  distanceKm?: number;
  durationSeconds: number;
  pace?: string;
  averageHeartRate?: number;
  elevationMeters?: number;
}): WorkoutStoryMetric[] {
  const metrics: WorkoutStoryMetric[] = [];
  const hasDistance = typeof data.distanceKm === 'number' && data.distanceKm > 0;
  if (hasDistance) {
    const showSwimMeters = data.sportType === 'swimming' && data.distanceKm! < 1;
    metrics.push({
      key: 'distance',
      label: 'Distance',
      value: showSwimMeters ? `${Math.round(data.distanceKm! * 1000)}` : formatDistance(data.distanceKm!),
      unit: showSwimMeters ? 'm' : 'km',
    });
  }
  if (data.durationSeconds > 0) {
    metrics.push({
      key: 'duration',
      label: 'Time',
      value: formatDuration(data.durationSeconds),
    });
  }
  if (data.pace) {
    metrics.push({
      key: 'pace',
      label: 'Average Pace',
      value: data.pace,
    });
  }
  if (typeof data.averageHeartRate === 'number') {
    metrics.push({
      key: 'heart-rate',
      label: 'Average HR',
      value: `${Math.round(data.averageHeartRate)}`,
      unit: 'bpm',
    });
  }
  if (typeof data.elevationMeters === 'number') {
    metrics.push({
      key: 'elevation',
      label: 'Elevation',
      value: `${Math.round(data.elevationMeters)}`,
      unit: 'm',
    });
  }
  return metrics;
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

function drawWorkoutMetricRow(ctx: CanvasRenderingContext2D, palette: CanvasPalette, metrics: StoryMetric[], y: number) {
  if (metrics.length === 0) return;
  const left = 135;
  const width = 810;
  const columnWidth = width / metrics.length;

  ctx.strokeStyle = palette.hairline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, y - 70);
  ctx.lineTo(left + width, y - 70);
  ctx.stroke();

  metrics.forEach((metric, index) => {
    const textX = left + columnWidth * (index + 0.5);
    if (index > 0) {
      const dividerX = left + columnWidth * index;
      ctx.beginPath();
      ctx.moveTo(dividerX, y - 18);
      ctx.lineTo(dividerX, y + 118);
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = palette.faint;
    ctx.font = `650 30px ${STORY_FONT}`;
    ctx.fillText(metric.label.toUpperCase(), textX, y);
    ctx.fillStyle = palette.text;
    ctx.font = `650 68px ${STORY_FONT}`;
    ctx.fillText(metric.value, textX, y + 65);
    if (metric.unit) {
      ctx.fillStyle = palette.accent;
      ctx.font = `600 26px ${STORY_FONT}`;
      ctx.fillText(metric.unit, textX, y + 103);
    }
  });
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

function drawCoverImage(ctx: CanvasRenderingContext2D, source: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.max(STORY_WIDTH / image.width, STORY_HEIGHT / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      ctx.drawImage(image, (STORY_WIDTH - width) / 2, (STORY_HEIGHT - height) / 2, width, height);
      resolve();
    };
    image.onerror = () => resolve();
    image.src = source;
  });
}

function recoveryAccent(score: number): string {
  if (score >= 67) return '#16b894';
  if (score >= 34) return '#e5a11d';
  return '#e45d6c';
}

function formatDistance(distance: number): string {
  return distance >= 100 ? Math.round(distance).toString() : distance.toFixed(2);
}

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    : `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatSleep(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
