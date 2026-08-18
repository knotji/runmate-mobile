import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { checkmarkOutline, closeOutline, downloadOutline, informationCircleOutline, shareSocialOutline } from 'ionicons/icons';
import type { CoachContext } from '@/lib/buildCoachContext';
import type { EnergyReserve } from '@/lib/energyReserve';
import { hapticImpact, hapticNotification } from '@/lib/haptics';
import { recordPerformanceDiagnostic } from '@/lib/performanceDiagnostics';
import {
  recoveryShareComposition,
  todayShareComposition,
  weeklyShareComposition,
  workoutShareComposition,
  type ShareBackground,
  type ShareComposition,
  type ShareLayout,
  type ShareTextTreatment,
  type WorkoutShareData,
} from '@/lib/shareComposition';
import { renderShareComposition } from '@/lib/shareCanvasRenderer';
import { canSaveStoryImageNatively, saveStoryImageNatively } from '@/lib/storyImage';
import type { WeeklyRecapHighlights } from '@/lib/weeklyRecapHighlights';
import { getAvailableWorkoutMetrics, WORKOUT_METRIC_ORDER, type WorkoutMetricKey } from '@/lib/workoutShareMetrics';
import './SocialShareModal.css';

export type { SportType } from '@/lib/workoutShareMetrics';
export type { WorkoutShareData } from '@/lib/shareComposition';

type ShareMode = 'recovery' | 'today' | 'workout' | 'weekly';
type TodayContent = 'today' | 'recovery';

interface SocialShareModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  context?: CoachContext | null;
  energyReserve?: EnergyReserve | null;
  mode?: ShareMode;
  workoutData?: WorkoutShareData | null;
  weeklyData?: WeeklyRecapHighlights | null;
}

const layouts: Array<{ value: ShareLayout; label: string }> = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'stack', label: 'Stack' },
  { value: 'signature', label: 'Signature' },
];

export const SocialShareModal: React.FC<SocialShareModalProps> = ({
  isOpen,
  onDismiss,
  context = null,
  energyReserve = null,
  mode = 'today',
  workoutData = null,
  weeklyData = null,
}) => {
  const [layout, setLayout] = useState<ShareLayout>('signature');
  const [treatment, setTreatment] = useState<ShareTextTreatment>('light');
  const [background, setBackground] = useState<ShareBackground>('transparent');
  const [todayContent, setTodayContent] = useState<TodayContent>(mode === 'recovery' ? 'recovery' : 'today');
  const [selectedWorkoutMetrics, setSelectedWorkoutMetrics] = useState<WorkoutMetricKey[]>([]);
  const [generating, setGenerating] = useState(false);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const generationRef = useRef(0);
  const previewUrlRef = useRef<string | null>(null);
  const renderCacheRef = useRef(new Map<string, Blob>());

  const sportType = workoutData?.type ?? (workoutData?.isStrength ? 'strength' : 'workout');
  const availableWorkoutMetrics = useMemo(() => workoutData ? getAvailableWorkoutMetrics({
    sportType,
    distanceKm: workoutData.distanceKm,
    durationSeconds: workoutData.durationSeconds,
    pace: workoutData.paceFormatted,
    averageHeartRate: workoutData.avgHeartRateBpm,
    caloriesKcal: workoutData.caloriesKcal,
    elevationMeters: workoutData.elevationMeters,
    loadScore: workoutData.loadScore,
  }) : [], [sportType, workoutData]);

  const composition = useMemo<ShareComposition | null>(() => {
    if (mode === 'workout' && workoutData) return workoutShareComposition(workoutData, selectedWorkoutMetrics);
    if (mode === 'weekly' && weeklyData) return weeklyShareComposition(weeklyData);
    if (context && (mode === 'today' || mode === 'recovery')) {
      return todayContent === 'today'
        ? todayShareComposition(context, energyReserve)
        : recoveryShareComposition(context, energyReserve);
    }
    return null;
  }, [context, energyReserve, mode, selectedWorkoutMetrics, todayContent, weeklyData, workoutData]);

  const showPreview = useCallback((blob: Blob) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextUrl = URL.createObjectURL(blob);
    previewUrlRef.current = nextUrl;
    setImageBlob(blob);
    setPreviewUrl(nextUrl);
  }, []);

  const prepareStory = useCallback(async () => {
    if (!canvasRef.current || !composition) {
      setImageBlob(null);
      setPreviewUrl(null);
      return;
    }
    const generation = ++generationRef.current;
    const cacheKey = JSON.stringify({ composition, layout, treatment, background });
    const cached = renderCacheRef.current.get(cacheKey);
    if (cached) {
      showPreview(cached);
      recordPerformanceDiagnostic('share_render', 0, 'skipped', 'Prepared image cache hit', 'prepared');
      setGenerating(false);
      return;
    }
    if (!imageBlob) setGenerating(true);
    const startedAt = performance.now();
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      renderShareComposition(canvasRef.current, composition, { layout, treatment, background });
      const blob = await canvasToBlob(canvasRef.current);
      if (generation !== generationRef.current) return;
      renderCacheRef.current.set(cacheKey, blob);
      while (renderCacheRef.current.size > 6) {
        const oldest = renderCacheRef.current.keys().next().value as string | undefined;
        if (!oldest) break;
        renderCacheRef.current.delete(oldest);
      }
      showPreview(blob);
      recordPerformanceDiagnostic('share_render', performance.now() - startedAt, 'success', `${layout} · ${background}`, 'live');
    } catch (error) {
      recordPerformanceDiagnostic('share_render', performance.now() - startedAt, 'failed', error instanceof Error ? error.message : 'Render failed');
      throw error;
    } finally {
      if (generation === generationRef.current) setGenerating(false);
    }
  }, [background, composition, imageBlob, layout, showPreview, treatment]);

  useEffect(() => {
    if (!isOpen) return;
    setLayout('signature');
    setTreatment('light');
    setBackground('transparent');
    setTodayContent(mode === 'recovery' ? 'recovery' : 'today');
    if (mode === 'workout') setSelectedWorkoutMetrics(availableWorkoutMetrics.slice(0, 3).map((metric) => metric.key));
  }, [availableWorkoutMetrics, isOpen, mode]);

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => void prepareStory());
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, prepareStory]);

  useEffect(() => {
    if (isOpen) return;
    generationRef.current += 1;
    renderCacheRef.current.clear();
    setImageBlob(null);
    setPreviewUrl(null);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
  }, [isOpen]);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    renderCacheRef.current.clear();
  }, []);

  const showToast = (message: string, durationMs = 2600) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), durationMs);
  };

  const setOption = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
    void hapticImpact();
    setter(value);
  };

  const toggleWorkoutMetric = (metric: WorkoutMetricKey) => {
    void hapticImpact();
    setSelectedWorkoutMetrics((current) => {
      if (current.includes(metric)) {
        if (current.length === 1) { showToast('Keep at least one metric'); return current; }
        return current.filter((key) => key !== metric);
      }
      if (current.length >= 3) { showToast('Choose up to 3 metrics'); return current; }
      const next = new Set([...current, metric]);
      return WORKOUT_METRIC_ORDER.filter((key) => next.has(key));
    });
  };

  const fileName = () => `WholeMate-${composition?.kind ?? 'Story'}-${Date.now()}.png`;

  const saveImage = async () => {
    if (!imageBlob) return;
    void hapticImpact();
    const startedAt = performance.now();
    if (canSaveStoryImageNatively()) {
      try {
        const dataUrl = await blobToDataUrl(imageBlob);
        await saveStoryImageNatively(dataUrl, fileName());
        recordPerformanceDiagnostic('share_export', performance.now() - startedAt, 'success', 'Android MediaStore', 'live');
        void hapticNotification();
        showToast(background === 'transparent' ? 'Transparent PNG Saved' : 'Saved To Pictures / WholeMate');
      } catch (error) {
        recordPerformanceDiagnostic('share_export', performance.now() - startedAt, 'failed', error instanceof Error ? error.message : 'Save failed');
        showToast('Could Not Save Image');
      }
      return;
    }
    const link = document.createElement('a');
    link.download = fileName();
    link.href = URL.createObjectURL(imageBlob);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
    recordPerformanceDiagnostic('share_export', performance.now() - startedAt, 'success', 'Browser download', 'live');
    void hapticNotification();
    showToast('Story Image Saved');
  };

  const shareImage = async () => {
    if (!imageBlob || !composition) return;
    void hapticImpact();
    const startedAt = performance.now();
    try {
      const file = new File([imageBlob], 'wholemate-story.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `WholeMate ${composition.eyebrow}`, text: composition.accessibleDescription, files: [file] });
        recordPerformanceDiagnostic('share_export', performance.now() - startedAt, 'success', 'Web Share', 'live');
        void hapticNotification();
        return;
      }
    } catch (error) {
      recordPerformanceDiagnostic('share_export', performance.now() - startedAt, 'failed', error instanceof Error ? error.message : 'Share failed');
    }
    await saveImage();
  };

  const title = mode === 'workout' ? 'Share Workout' : mode === 'weekly' ? 'Share Recap' : 'Share Today';
  const ready = Boolean(imageBlob && composition) && !generating;

  return (
    <IonModal isOpen={isOpen} onDidPresent={() => void prepareStory()} onDidDismiss={onDismiss} className="social-share-modal">
      <IonHeader translucent className="social-share-header">
        <div className="social-share-sheet-handle" aria-hidden="true" />
        <IonToolbar>
          <IonTitle>{title}</IonTitle>
          <IonButtons slot="end"><IonButton onClick={onDismiss} aria-label="Close Share"><IonIcon icon={closeOutline} /></IonButton></IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="social-share-content">
        <div className="social-share-shell">
          <div className={`social-share-preview-container${background === 'transparent' ? ' transparent-grid' : ''}`}>
            {generating && !previewUrl && <div className="social-share-loading" role="status"><IonSpinner name="crescent" /><p>Preparing Story</p></div>}
            <canvas ref={canvasRef} hidden />
            {previewUrl && <img src={previewUrl} alt={composition?.accessibleDescription ?? 'WholeMate Story preview'} className="social-share-preview-img" draggable={false} />}
          </div>

          <div className="social-share-export-note">
            <strong>{background === 'transparent' ? 'Transparent PNG' : 'Soft Canvas'}</strong>
            {background === 'transparent' && <button type="button" onClick={() => showToast('Add this PNG over a photo or video. Some apps may flatten transparency when opened directly.', 4200)} aria-label="About Transparent PNG"><IonIcon icon={informationCircleOutline} /></button>}
            <span>1080 × 1920 · Story</span>
          </div>

          <div className="social-share-controls">
            {(mode === 'today' || mode === 'recovery') && <ControlGroup label="Share">
              <OptionRow options={[{ value: 'today', label: 'Today' }, { value: 'recovery', label: 'Recovery' }]} value={todayContent} onChange={(value) => setOption(setTodayContent, value as TodayContent)} />
            </ControlGroup>}
            <ControlGroup label="Layout">
              <OptionRow options={layouts} value={layout} onChange={(value) => setOption(setLayout, value as ShareLayout)} />
            </ControlGroup>
            <div className="social-share-control-grid">
              <ControlGroup label="Text"><OptionRow options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} value={treatment} onChange={(value) => setOption(setTreatment, value as ShareTextTreatment)} /></ControlGroup>
              <ControlGroup label="Canvas"><OptionRow options={[{ value: 'transparent', label: 'Clear' }, { value: 'soft', label: 'Soft' }]} value={background} onChange={(value) => setOption(setBackground, value as ShareBackground)} /></ControlGroup>
            </div>
            {mode === 'workout' && availableWorkoutMetrics.length > 0 && <ControlGroup label="Workout Metrics" hint="Choose 1–3">
              <div className="social-share-metric-chips">{availableWorkoutMetrics.map((metric) => {
                const active = selectedWorkoutMetrics.includes(metric.key);
                return <button key={metric.key} type="button" className={active ? 'active' : ''} aria-pressed={active} onClick={() => toggleWorkoutMetric(metric.key)}><IonIcon icon={checkmarkOutline} />{metric.label}</button>;
              })}</div>
            </ControlGroup>}
          </div>

          <div className="social-share-actions">
            <button type="button" className="share-action-btn primary" disabled={!ready} onClick={() => void shareImage()}><IonIcon icon={shareSocialOutline} /> Share</button>
            <button type="button" className="share-action-btn secondary" disabled={!ready} onClick={() => void saveImage()}><IonIcon icon={downloadOutline} /> Save</button>
          </div>
          {toastMessage && <div className="social-share-toast" role="status">{toastMessage}</div>}
        </div>
      </IonContent>
    </IonModal>
  );
};

const ControlGroup: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => <section className="social-share-control-group"><header><strong>{label}</strong>{hint && <span>{hint}</span>}</header>{children}</section>;

const OptionRow: React.FC<{ options: Array<{ value: string; label: string }>; value: string; onChange: (value: string) => void }> = ({ options, value, onChange }) => <div className="social-share-option-row">{options.map((option) => <button key={option.value} type="button" className={option.value === value ? 'active' : ''} aria-pressed={option.value === value} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error('Could not encode PNG'));
  }, 'image/png'));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not encode image'));
    reader.onerror = () => reject(reader.error ?? new Error('Could not encode image'));
    reader.readAsDataURL(blob);
  });
}
