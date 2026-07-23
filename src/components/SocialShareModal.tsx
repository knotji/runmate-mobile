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
} from 'ionicons/icons';
import type { CoachContext } from '@/lib/buildCoachContext';
import { hapticImpact, hapticNotification } from '@/lib/haptics';
import './SocialShareModal.css';

export type ShareTheme = 'cyber-dark' | 'sunrise-fresh' | 'minimal-glass';

interface SocialShareModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  context: CoachContext | null;
}

export const SocialShareModal: React.FC<SocialShareModalProps> = ({
  isOpen,
  onDismiss,
  context,
}) => {
  const [selectedTheme, setSelectedTheme] = useState<ShareTheme>('cyber-dark');
  const [generating, setGenerating] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const score = context?.recoverySystem.overallScore ? Math.round(context.recoverySystem.overallScore) : 70;
  const label = context?.recoverySystem.overallLabel ?? 'Good Recovery';
  const sleepMinutes = context?.recoverySystem.sleepPerformance.actualSleepMinutes ?? 420;
  const strainScore = context?.recoverySystem.strain.score ?? 8.5;
  const hrResting = context?.recoverySystem.sleepPerformance.state !== 'unscorable' ? 54 : 58;

  const renderCardCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1080;
    const height = 1920;
    canvas.width = width;
    canvas.height = height;

    // Backgrounds according to theme
    if (selectedTheme === 'cyber-dark') {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#0a1626');
      grad.addColorStop(0.5, '#0d233a');
      grad.addColorStop(1, '#050c14');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Glow Orbs
      const orbGrad1 = ctx.createRadialGradient(250, 350, 20, 250, 350, 450);
      orbGrad1.addColorStop(0, 'rgba(32, 160, 214, 0.25)');
      orbGrad1.addColorStop(1, 'rgba(32, 160, 214, 0)');
      ctx.fillStyle = orbGrad1;
      ctx.fillRect(0, 0, width, height);

      const orbGrad2 = ctx.createRadialGradient(850, 1100, 20, 850, 1100, 500);
      orbGrad2.addColorStop(0, 'rgba(36, 196, 172, 0.2)');
      orbGrad2.addColorStop(1, 'rgba(36, 196, 172, 0)');
      ctx.fillStyle = orbGrad2;
      ctx.fillRect(0, 0, width, height);
    } else if (selectedTheme === 'sunrise-fresh') {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#102a45');
      grad.addColorStop(0.6, '#18476e');
      grad.addColorStop(1, '#236e8a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const orbGrad = ctx.createRadialGradient(540, 300, 50, 540, 300, 600);
      orbGrad.addColorStop(0, 'rgba(255, 140, 66, 0.28)');
      orbGrad.addColorStop(1, 'rgba(255, 140, 66, 0)');
      ctx.fillStyle = orbGrad;
      ctx.fillRect(0, 0, width, height);
    } else {
      // Minimal Glass
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#0d1d2d');
      grad.addColorStop(0.5, '#13283c');
      grad.addColorStop(1, '#0b1622');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // Outer Glass Container Card
    const cardX = 80;
    const cardY = 180;
    const cardW = 920;
    const cardH = 1560;
    const cardR = 56;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardR);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.stroke();
    ctx.restore();

    // Top Brand Logo
    ctx.font = 'bold 38px "IBM Plex Sans Thai", sans-serif';
    ctx.fillStyle = '#26a3d6';
    ctx.textAlign = 'left';
    ctx.fillText('RUNMATE', cardX + 60, cardY + 110);
    ctx.font = '600 38px "IBM Plex Sans Thai", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(' AI', cardX + 245, cardY + 110);

    // Date
    const todayStr = new Date().toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    ctx.font = '500 30px "IBM Plex Sans Thai", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'right';
    ctx.fillText(todayStr, cardX + cardW - 60, cardY + 110);

    // Divider Line
    ctx.beginPath();
    ctx.moveTo(cardX + 60, cardY + 160);
    ctx.lineTo(cardX + cardW - 60, cardY + 160);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Score Circle (Center Center)
    const centerX = width / 2;
    const centerY = cardY + 450;
    const radius = 200;

    // Background Circle Track
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.lineWidth = 28;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.stroke();

    // Progress Arc
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

    // Inside Score Text
    ctx.textAlign = 'center';
    ctx.font = 'bold 140px "IBM Plex Sans Thai", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${score}`, centerX, centerY + 25);

    ctx.font = 'bold 30px "IBM Plex Sans Thai", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText('% RECOVERY', centerX, centerY + 85);

    // Readiness Label Badge (Positioned below circle cleanly)
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

    // Metrics Grid Box (3 Items: Sleep, Strain, Resting HR)
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

    // AI Coach Quote Banner (With Multi-line text wrapping)
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

    // Simple Multi-line text wrapping for Thai Canvas
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

    // Bottom Branding Footer
    ctx.textAlign = 'center';
    ctx.font = '600 28px "IBM Plex Sans Thai", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('POWERED BY RUNMATE RECOVERY ENGINE', width / 2, cardY + cardH - 50);

    // Convert Canvas to Data URL
    setDataUrl(canvas.toDataURL('image/png'));
  }, [selectedTheme, score, label, sleepMinutes, strainScore, hrResting]);

  useEffect(() => {
    if (isOpen) {
      setGenerating(true);
      const timer = setTimeout(() => {
        renderCardCanvas();
        setGenerating(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, renderCardCanvas]);

  const handleSelectTheme = (theme: ShareTheme) => {
    void hapticImpact();
    setSelectedTheme(theme);
  };

  const handleDownload = () => {
    if (!dataUrl) return;
    void hapticImpact();
    const link = document.createElement('a');
    link.download = `RunMate-Story-${Date.now()}.png`;
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
            title: 'RunMate Recovery Story',
            text: `วันนี้ Recovery Score ของฉันอยู่ที่ ${score}%! #RunMate #Running #Recovery`,
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
          <IonTitle>Share Recovery Story</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onDismiss} aria-label="Close modal">
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="social-share-content">
        <div className="social-share-shell">
          <div className="social-share-preview-container">
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

          {/* Theme Selector */}
          <div className="social-share-theme-selector">
            <p className="social-share-theme-label">
              <IonIcon icon={colorPaletteOutline} /> CHOOSE STORY THEME
            </p>
            <div className="social-share-theme-chips">
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

              <button
                type="button"
                className={`theme-chip ${selectedTheme === 'minimal-glass' ? 'active' : ''}`}
                onClick={() => handleSelectTheme('minimal-glass')}
              >
                <IonIcon icon={sparklesOutline} /> Minimal Glass
              </button>
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
