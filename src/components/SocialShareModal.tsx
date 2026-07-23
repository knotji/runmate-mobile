import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonIcon,
  IonSpinner,
} from '@ionic/react';
import {
  closeOutline,
  shareSocialOutline,
  downloadOutline,
  sparklesOutline,
  checkmarkCircleOutline,
  moonOutline,
  sunnyOutline,
  colorPaletteOutline,
  imageOutline,
  contrastOutline,
} from 'ionicons/icons';
import type { CoachContext } from '@/lib/buildCoachContext';
import { hapticImpact, hapticNotification } from '@/lib/haptics';
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

export const SocialShareModal: React.FC<SocialShareModalProps> = ({
  isOpen,
  onDismiss,
  context = null,
  mode = 'recovery',
  workoutData = null,
}) => {
  const defaultTheme: ShareTheme = mode === 'workout' ? 'transparent-overlay' : 'cyber-dark';
  const [selectedTheme, setSelectedTheme] = useState<ShareTheme>(defaultTheme);
  const [generating, setGenerating] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [customPhotoUrl, setCustomPhotoUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recovery Data
  const score = context?.recoverySystem.overallScore ? Math.round(context.recoverySystem.overallScore) : 70;
  const label = context?.recoverySystem.overallLabel ?? 'Good Recovery';
  const sleepMinutes = context?.recoverySystem.sleepPerformance.actualSleepMinutes ?? 420;
  const strainScore = context?.recoverySystem.strain.score ?? 8.5;
  const hrResting = context?.recoverySystem.sleepPerformance.state !== 'unscorable' ? 54 : 58;

  // Workout Data Fallbacks
  const title = workoutData?.title ?? 'Morning Workout';
  const sportType: SportType = workoutData?.type ?? (workoutData?.isStrength ? 'strength' : 'running');
  const dist = workoutData?.distanceKm ?? (sportType === 'strength' ? 0 : 10.5);
  const pace = workoutData?.paceFormatted ?? (sportType === 'strength' ? '' : "5'24\"");
  const durationSec = workoutData?.durationSeconds ?? 3402; // ~56:42
  const hrAvg = workoutData?.avgHeartRateBpm ?? 148;
  const dateText = workoutData?.dateStr ?? new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

  const formatDuration = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getSportIcon = (type: SportType) => {
    switch (type) {
      case 'running': return '🏃';
      case 'strength': return '🏋️';
      case 'cycling': return '🚴';
      case 'walking': return '🚶';
      case 'swimming': return '🏊';
      default: return '⚡';
    }
  };

  const renderCardCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1080;
    const height = 1920;
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    if (mode === 'workout') {
      // -------------------------------------------------------------
      // WORKOUT STORY CARD RENDER (MINIMAL STRAVA STYLE)
      // -------------------------------------------------------------
      if (selectedTheme === 'transparent-overlay') {
        ctx.clearRect(0, 0, width, height);
      } else if (selectedTheme === 'custom-photo' && customPhotoUrl) {
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const imgRatio = img.width / img.height;
            const canvasRatio = width / height;
            let drawW = width;
            let drawH = height;
            let startX = 0;
            let startY = 0;

            if (imgRatio > canvasRatio) {
              drawW = height * imgRatio;
              startX = (width - drawW) / 2;
            } else {
              drawH = width / imgRatio;
              startY = (height - drawH) / 2;
            }

            ctx.drawImage(img, startX, startY, drawW, drawH);

            const vignette = ctx.createLinearGradient(0, height * 0.3, 0, height);
            vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
            vignette.addColorStop(0.6, 'rgba(0, 0, 0, 0.4)');
            vignette.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
            ctx.fillStyle = vignette;
            ctx.fillRect(0, 0, width, height);

            resolve();
          };
          img.src = customPhotoUrl;
        });
      } else if (selectedTheme === 'sunrise-fresh') {
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#0f2742');
        grad.addColorStop(0.5, '#195079');
        grad.addColorStop(1, '#227896');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      } else {
        // Cyber Dark Default
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#0a1626');
        grad.addColorStop(0.5, '#0e243b');
        grad.addColorStop(1, '#060d17');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }

      // Minimal Outer Card Frame
      if (selectedTheme !== 'transparent-overlay') {
        const cardX = 80;
        const cardY = 180;
        const cardW = 920;
        const cardH = 1560;

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 56);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.stroke();
        ctx.restore();
      }

      // Top Brand & Sport Badge Header (Minimal Strava Header)
      const iconSymbol = getSportIcon(sportType);

      // Icon Circle Badge
      ctx.beginPath();
      ctx.arc(160, 290, 42, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(38, 181, 230, 0.2)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#38bdf8';
      ctx.stroke();

      ctx.font = '36px "IBM Plex Sans Thai", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(iconSymbol, 160, 302);

      // Title & Date
      ctx.textAlign = 'left';
      ctx.font = 'bold 36px "IBM Plex Sans Thai", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 10;
      ctx.fillText(title.toUpperCase(), 230, 290);

      ctx.font = '500 26px "IBM Plex Sans Thai", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText(dateText, 230, 330);

      // Top Brand Right
      ctx.textAlign = 'right';
      ctx.font = 'bold 32px "IBM Plex Sans Thai", sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('RUNMATE', 940, 290);

      // Subtle Divider
      ctx.beginPath();
      ctx.moveTo(120, 370);
      ctx.lineTo(960, 370);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Main Hero Metric (Minimal Strava Big Metric)
      if (sportType === 'strength') {
        // STRENGTH TRAINING DISPLAY (Duration Big)
        const durY = 700;
        ctx.textAlign = 'center';
        ctx.font = '800 170px "IBM Plex Sans Thai", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 24;
        ctx.fillText(formatDuration(durationSec), width / 2, durY);

        ctx.font = 'bold 36px "IBM Plex Sans Thai", sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('WORKOUT DURATION', width / 2, durY + 75);

        // Grid Metrics for Strength (Avg HR, Estimated Burn)
        const gridY = 1080;
        const gridW = 840;
        const gridX = (width - gridW) / 2;
        const itemW = (gridW - 20) / 2;

        const sMetrics = [
          { title: 'AVG HEART RATE', val: `${hrAvg}`, sub: 'bpm' },
          { title: 'EST. CALORIES', val: `${Math.round((durationSec / 60) * 7.5)}`, sub: 'kcal' },
        ];

        sMetrics.forEach((m, idx) => {
          const boxX = gridX + idx * (itemW + 20);
          const boxY = gridY;
          const boxH = 200;

          ctx.beginPath();
          ctx.roundRect(boxX, boxY, itemW, boxH, 28);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.stroke();

          ctx.textAlign = 'center';
          ctx.font = 'bold 24px "IBM Plex Sans Thai", sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.fillText(m.title, boxX + itemW / 2, boxY + 52);

          ctx.font = 'bold 46px "IBM Plex Sans Thai", sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(m.val, boxX + itemW / 2, boxY + 120);

          ctx.font = '500 22px "IBM Plex Sans Thai", sans-serif';
          ctx.fillStyle = '#38bdf8';
          ctx.fillText(m.sub, boxX + itemW / 2, boxY + 162);
        });
      } else {
        // RUNNING / CYCLING / WALKING / SWIMMING DISPLAY (Distance Big)
        const distY = 660;
        ctx.textAlign = 'center';
        ctx.font = '800 210px "IBM Plex Sans Thai", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 24;
        ctx.fillText(dist.toFixed(2), width / 2, distY);

        ctx.font = 'bold 40px "IBM Plex Sans Thai", sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('KILOMETERS', width / 2, distY + 80);

        // Workout Metrics Banner Grid (Pace, Time, HR)
        const gridY = 1060;
        const gridW = 840;
        const gridX = (width - gridW) / 2;
        const itemW = (gridW - 40) / 3;

        const wMetrics = [
          { title: 'AVG PACE', val: pace || '—', sub: '/km' },
          { title: 'TIME', val: formatDuration(durationSec), sub: 'Duration' },
          { title: 'AVG HR', val: `${hrAvg}`, sub: 'bpm' },
        ];

        wMetrics.forEach((m, idx) => {
          const boxX = gridX + idx * (itemW + 20);
          const boxY = gridY;
          const boxH = 200;

          ctx.beginPath();
          ctx.roundRect(boxX, boxY, itemW, boxH, 28);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.stroke();

          ctx.textAlign = 'center';
          ctx.font = 'bold 24px "IBM Plex Sans Thai", sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.fillText(m.title, boxX + itemW / 2, boxY + 52);

          ctx.font = 'bold 42px "IBM Plex Sans Thai", sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(m.val, boxX + itemW / 2, boxY + 118);

          ctx.font = '500 22px "IBM Plex Sans Thai", sans-serif';
          ctx.fillStyle = '#38bdf8';
          ctx.fillText(m.sub, boxX + itemW / 2, boxY + 162);
        });
      }

      // Bottom Strava-style Tagline
      ctx.textAlign = 'center';
      ctx.font = '600 28px "IBM Plex Sans Thai", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.fillText('RUNMATE RECOVERY & TRAINING ENGINE', width / 2, 1590);

    } else {
      // -------------------------------------------------------------
      // RECOVERY STORY CARD RENDER
      // -------------------------------------------------------------
      if (selectedTheme === 'cyber-dark') {
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#0a1626');
        grad.addColorStop(0.5, '#0d233a');
        grad.addColorStop(1, '#050c14');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        const orbGrad1 = ctx.createRadialGradient(250, 350, 20, 250, 350, 450);
        orbGrad1.addColorStop(0, 'rgba(32, 160, 214, 0.25)');
        orbGrad1.addColorStop(1, 'rgba(32, 160, 214, 0)');
        ctx.fillStyle = orbGrad1;
        ctx.fillRect(0, 0, width, height);
      } else if (selectedTheme === 'sunrise-fresh') {
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#102a45');
        grad.addColorStop(0.6, '#18476e');
        grad.addColorStop(1, '#236e8a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      } else {
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#0d1d2d');
        grad.addColorStop(0.5, '#13283c');
        grad.addColorStop(1, '#0b1622');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }

      const cardX = 80;
      const cardY = 180;
      const cardW = 920;
      const cardH = 1560;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 56);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.stroke();
      ctx.restore();

      // Top Brand
      ctx.font = 'bold 38px "IBM Plex Sans Thai", sans-serif';
      ctx.fillStyle = '#26a3d6';
      ctx.textAlign = 'left';
      ctx.fillText('RUNMATE', cardX + 60, cardY + 110);
      ctx.font = '600 38px "IBM Plex Sans Thai", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(' AI', cardX + 245, cardY + 110);

      ctx.font = '500 30px "IBM Plex Sans Thai", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.textAlign = 'right';
      ctx.fillText(dateText, cardX + cardW - 60, cardY + 110);

      ctx.beginPath();
      ctx.moveTo(cardX + 60, cardY + 160);
      ctx.lineTo(cardX + cardW - 60, cardY + 160);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Score Circle
      const centerX = width / 2;
      const centerY = cardY + 450;
      const radius = 200;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.lineWidth = 28;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.stroke();

      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + (2 * Math.PI * (score / 100));
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.lineWidth = 28;

      const strokeGrad = ctx.createLinearGradient(centerX - radius, centerY, centerX + radius, centerY);
      if (score >= 66) {
        strokeGrad.addColorStop(0, '#24d697');
        strokeGrad.addColorStop(1, '#20b8dc');
      } else if (score >= 34) {
        strokeGrad.addColorStop(0, '#ffb833');
        strokeGrad.addColorStop(1, '#f27e2b');
      } else {
        strokeGrad.addColorStop(0, '#ff5c5c');
        strokeGrad.addColorStop(1, '#e03868');
      }
      ctx.strokeStyle = strokeGrad;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = 'bold 140px "IBM Plex Sans Thai", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${score}`, centerX, centerY + 25);

      ctx.font = 'bold 30px "IBM Plex Sans Thai", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText('% RECOVERY', centerX, centerY + 85);

      // Readiness Badge
      const badgeW = 340;
      const badgeH = 64;
      const badgeX = centerX - badgeW / 2;
      const badgeY = centerY + 235;

      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 32);
      ctx.fillStyle = 'rgba(38, 163, 214, 0.22)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(38, 163, 214, 0.55)';
      ctx.stroke();

      ctx.font = 'bold 28px "IBM Plex Sans Thai", sans-serif';
      ctx.fillStyle = '#5ed0fa';
      ctx.fillText(label.toUpperCase(), centerX, badgeY + 42);

      // Grid
      const gridY = cardY + 840;
      const gridW = cardW - 120;
      const gridX = cardX + 60;
      const itemW = (gridW - 40) / 3;

      const metrics = [
        { title: 'SLEEP', val: `${Math.floor(sleepMinutes / 60)}h ${sleepMinutes % 60}m`, sub: 'Rest Duration' },
        { title: 'STRAIN', val: `${strainScore.toFixed(1)}`, sub: 'Day Load' },
        { title: 'REST HR', val: `${hrResting}`, sub: 'bpm' },
      ];

      metrics.forEach((m, idx) => {
        const boxX = gridX + idx * (itemW + 20);
        const boxY = gridY;
        const boxH = 190;

        ctx.beginPath();
        ctx.roundRect(boxX, boxY, itemW, boxH, 24);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.font = 'bold 22px "IBM Plex Sans Thai", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillText(m.title, boxX + itemW / 2, boxY + 48);

        ctx.font = 'bold 38px "IBM Plex Sans Thai", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(m.val, boxX + itemW / 2, boxY + 110);

        ctx.font = '500 20px "IBM Plex Sans Thai", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.fillText(m.sub, boxX + itemW / 2, boxY + 152);
      });

      // AI Coach Quote
      const quoteY = gridY + 225;
      const quoteW = gridW;
      const quoteX = gridX;
      const quoteH = 220;

      ctx.beginPath();
      ctx.roundRect(quoteX, quoteY, quoteW, quoteH, 28);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 24px "IBM Plex Sans Thai", sans-serif';
      ctx.fillStyle = '#3bc7ed';
      ctx.fillText('AI COACH RECOMMENDATION', quoteX + 40, quoteY + 50);

      const quoteText = score >= 66
        ? 'ร่างกายฟื้นตัวดีเยี่ยม! เหมาะกับการซ้อมตามแผนหรือเพิ่มระยะ Easy Run'
        : score >= 34
        ? 'ระดับความพร้อมปานกลาง แนะนำเน้นวิ่งควบคุม Heart Rate ใน Zone 2'
        : 'ควรเน้นพักผ่อน นอนหลับให้เต็มที่ และจิบน้ำสม่ำเสมอในวันนี้';

      ctx.font = '500 28px "IBM Plex Sans Thai", sans-serif';
      ctx.fillStyle = '#ffffff';

      const words = quoteText.split(' ');
      let currentLine = '';
      let lineY = quoteY + 105;
      const maxTextW = quoteW - 80;

      words.forEach((word) => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metricsTest = ctx.measureText(testLine);
        if (metricsTest.width > maxTextW && currentLine) {
          ctx.fillText(currentLine, quoteX + 40, lineY);
          currentLine = word;
          lineY += 42;
        } else {
          currentLine = testLine;
        }
      });
      if (currentLine) {
        ctx.fillText(currentLine, quoteX + 40, lineY);
      }

      ctx.textAlign = 'center';
      ctx.font = '600 28px "IBM Plex Sans Thai", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillText('POWERED BY RUNMATE RECOVERY ENGINE', width / 2, cardY + cardH - 50);
    }

    setDataUrl(canvas.toDataURL('image/png'));
  }, [mode, selectedTheme, customPhotoUrl, score, label, sleepMinutes, strainScore, hrResting, title, sportType, dist, pace, durationSec, hrAvg, dateText]);

  useEffect(() => {
    if (isOpen) {
      setGenerating(true);
      const timer = setTimeout(() => {
        void renderCardCanvas();
        setGenerating(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, renderCardCanvas]);

  const handleSelectTheme = (theme: ShareTheme) => {
    void hapticImpact();
    if (theme === 'custom-photo' && fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      setSelectedTheme(theme);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCustomPhotoUrl(event.target.result as string);
          setSelectedTheme('custom-photo');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownload = () => {
    if (!dataUrl) return;
    void hapticImpact();
    const link = document.createElement('a');
    link.download = `RunMate-${mode === 'workout' ? 'Workout' : 'Story'}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    void hapticNotification();
    showToast('ดาวน์โหลดรูปภาพ Story เรียบร้อยแล้ว!');
  };

  const handleShare = async () => {
    if (!dataUrl) return;
    void hapticImpact();

    try {
      if (navigator.share) {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], 'runmate-story.png', { type: 'image/png' });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: mode === 'workout' ? 'RunMate Workout Story' : 'RunMate Recovery Story',
            text: mode === 'workout' 
              ? `${title} ${dist > 0 ? `${dist.toFixed(2)} KM` : ''}! #RunMate #Running` 
              : `วันนี้ Recovery Score ของฉันอยู่ที่ ${score}%! #RunMate #Running`,
            files: [file],
          });
          void hapticNotification();
          return;
        }
      }
      handleDownload();
    } catch {
      handleDownload();
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss} className="social-share-modal">
      <IonHeader translucent className="social-share-header">
        <IonToolbar>
          <IonTitle>{mode === 'workout' ? 'Share Workout Story' : 'Share Recovery Story'}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onDismiss} aria-label="Close modal">
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="social-share-content">
        <div className="social-share-shell">
          <div className={`social-share-preview-container ${selectedTheme === 'transparent-overlay' ? 'transparent-grid' : ''}`}>
            {generating && (
              <div className="social-share-loading">
                <IonSpinner name="crescent" />
                <p>Generating 9:16 Story Card…</p>
              </div>
            )}
            <canvas ref={canvasRef} className="social-share-canvas" style={{ display: 'none' }} />
            {dataUrl && (
              <img
                src={dataUrl}
                alt="RunMate Story Preview"
                className="social-share-preview-img"
              />
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handlePhotoUpload}
          />

          {/* Theme Selector */}
          <div className="social-share-theme-selector">
            <p className="social-share-theme-label">
              <IonIcon icon={colorPaletteOutline} /> CHOOSE STORY THEME
            </p>
            <div className="social-share-theme-chips">
              {mode === 'workout' && (
                <>
                  <button
                    type="button"
                    className={`theme-chip ${selectedTheme === 'transparent-overlay' ? 'active' : ''}`}
                    onClick={() => handleSelectTheme('transparent-overlay')}
                  >
                    <IonIcon icon={contrastOutline} /> Transparent PNG
                  </button>

                  <button
                    type="button"
                    className={`theme-chip ${selectedTheme === 'custom-photo' ? 'active' : ''}`}
                    onClick={() => handleSelectTheme('custom-photo')}
                  >
                    <IonIcon icon={imageOutline} /> My Photo
                  </button>
                </>
              )}

              <button
                type="button"
                className={`theme-chip ${selectedTheme === 'cyber-dark' ? 'active' : ''}`}
                onClick={() => handleSelectTheme('cyber-dark')}
              >
                <IonIcon icon={moonOutline} /> Cyber Dark
              </button>

              <button
                type="button"
                className={`theme-chip ${selectedTheme === 'sunrise-fresh' ? 'active' : ''}`}
                onClick={() => handleSelectTheme('sunrise-fresh')}
              >
                <IonIcon icon={sunnyOutline} /> Sunrise Fresh
              </button>

              {mode === 'recovery' && (
                <button
                  type="button"
                  className={`theme-chip ${selectedTheme === 'minimal-glass' ? 'active' : ''}`}
                  onClick={() => handleSelectTheme('minimal-glass')}
                >
                  <IonIcon icon={sparklesOutline} /> Minimal Glass
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="social-share-actions">
            <button type="button" className="share-action-btn primary" onClick={() => void handleShare()}>
              <IonIcon icon={shareSocialOutline} /> Share To Story / Apps
            </button>
            <button type="button" className="share-action-btn secondary" onClick={handleDownload}>
              <IonIcon icon={downloadOutline} /> Save Image
            </button>
          </div>

          {toastMessage && (
            <div className="social-share-toast" role="status">
              <IonIcon icon={checkmarkCircleOutline} /> {toastMessage}
            </div>
          )}
        </div>
      </IonContent>
    </IonModal>
  );
};
