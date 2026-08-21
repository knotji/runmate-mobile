import type { ShareBackground, ShareComposition, ShareLayout, ShareMetric, ShareTextTreatment } from '@/lib/shareComposition';

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;
const FONT = '"IBM Plex Sans Thai", system-ui, sans-serif';

type RenderOptions = {
  layout: ShareLayout;
  treatment: ShareTextTreatment;
  background: ShareBackground;
};

type Palette = {
  ink: string;
  muted: string;
  faint: string;
  surface: string;
  surfaceStrong: string;
  line: string;
  accent: string;
};

export function renderShareComposition(canvas: HTMLCanvasElement, composition: ShareComposition, options: RenderOptions): void {
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable');
  ctx.clearRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  const palette = makePalette(composition.accent, options.treatment);
  if (options.background === 'soft') drawSoftBackground(ctx, palette, options.treatment);
  if (composition.kind === 'recovery') {
    drawCompactRecovery(ctx, palette, composition);
    return;
  }
  drawBodyFlow(ctx, palette, composition.flow, options.layout);
  if (options.layout === 'minimal') drawMinimal(ctx, palette, composition);
  else if (options.layout === 'stack') drawStack(ctx, palette, composition);
  else drawSignature(ctx, palette, composition);
  drawBrand(ctx, palette);
}

/**
 * Ultra-minimal Recovery share: no card panel, no supporting metrics, no
 * explanation text - just one ring, the score, a small "Recovery" label, and
 * an optional tiny date/brand mark. Deliberately not the full Today card
 * treatment (drawBodyFlow/drawStack/etc. below) so it stays legible when
 * overlaid on a photo or an Instagram Story background.
 */
function drawCompactRecovery(ctx: CanvasRenderingContext2D, palette: Palette, data: ShareComposition) {
  const heroScore = data.hero ? Number(data.hero.value) : null;
  const centerX = STORY_WIDTH / 2;
  const centerY = 900;
  const radius = 200;

  ctx.textAlign = 'center';
  ctx.fillStyle = palette.accent;
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText((data.hero?.label ?? 'Recovery').toUpperCase(), centerX, centerY - radius - 54);

  drawScoreRing(ctx, centerX, centerY, radius, heroScore, palette, 18);

  let metaY = centerY + radius + 74;
  if (data.meta) {
    ctx.textAlign = 'center';
    ctx.fillStyle = palette.faint;
    ctx.font = `600 24px ${FONT}`;
    ctx.fillText(data.meta, centerX, metaY);
    metaY += 44;
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = palette.muted;
  ctx.font = `800 18px ${FONT}`;
  ctx.fillText('WHOLEMATE', centerX, metaY);
}

function drawScoreRing(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, score: number | null, palette: Palette, lineWidth = 16) {
  ctx.save();
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.strokeStyle = palette.line;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  if (score != null && Number.isFinite(score)) {
    ctx.strokeStyle = palette.accent;
    ctx.beginPath();
    ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(100, score)) / 100);
    ctx.stroke();
  }
  const numeralSize = Math.round(radius * 0.65);
  ctx.textAlign = 'center';
  ctx.fillStyle = palette.ink;
  ctx.font = `750 ${numeralSize}px ${FONT}`;
  if (score != null && Number.isFinite(score)) {
    ctx.fillText(`${Math.round(score)}`, x, y + numeralSize * 0.3);
    ctx.fillStyle = palette.faint;
    ctx.font = `650 ${Math.round(numeralSize * 0.22)}px ${FONT}`;
    ctx.fillText('/100', x, y + numeralSize * 0.68);
  }
  ctx.restore();
}

function makePalette(accent: ShareComposition['accent'], treatment: ShareTextTreatment): Palette {
  const accentColor = accent === 'amber' ? '#e7a426' : accent === 'blue' ? '#55a9ea' : '#3fc2ad';
  const light = treatment === 'light';
  return {
    ink: light ? '#ffffff' : '#102f46',
    muted: light ? 'rgba(255,255,255,.82)' : 'rgba(16,47,70,.72)',
    faint: light ? 'rgba(255,255,255,.58)' : 'rgba(16,47,70,.48)',
    surface: light ? 'rgba(8,31,45,.64)' : 'rgba(248,253,253,.86)',
    surfaceStrong: light ? 'rgba(8,31,45,.82)' : 'rgba(248,253,253,.96)',
    line: light ? 'rgba(255,255,255,.18)' : 'rgba(16,47,70,.12)',
    accent: accentColor,
  };
}

function drawSoftBackground(ctx: CanvasRenderingContext2D, palette: Palette, treatment: ShareTextTreatment) {
  const gradient = ctx.createLinearGradient(0, 0, STORY_WIDTH, STORY_HEIGHT);
  if (treatment === 'light') {
    gradient.addColorStop(0, '#09293a');
    gradient.addColorStop(.58, '#123c50');
    gradient.addColorStop(1, '#0a202f');
  } else {
    gradient.addColorStop(0, '#f5fbfa');
    gradient.addColorStop(.58, '#e8f5f5');
    gradient.addColorStop(1, '#dceef2');
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  ctx.globalAlpha = .11;
  ctx.fillStyle = palette.accent;
  ctx.beginPath();
  ctx.arc(900, 260, 380, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawMinimal(ctx: CanvasRenderingContext2D, palette: Palette, data: ShareComposition) {
  const y = data.hero ? 780 : 850;
  surface(ctx, 92, y - 260, 896, data.callout ? 760 : 530, 54, palette.surfaceStrong);
  label(ctx, data.eyebrow, 150, y - 174, palette.accent);
  if (data.hero) {
    hero(ctx, data.hero, 150, y - 42, palette);
    fitted(ctx, data.title, 150, y + 116, 760, 58, palette.ink, 720);
  } else {
    fitted(ctx, data.title, 150, y - 78, 760, 70, palette.ink, 720);
    if (data.subtitle) wrapped(ctx, data.subtitle, 150, y + 10, 760, 34, 2, palette.muted, 520);
  }
  if (data.hero && data.metrics.length) drawMetrics(ctx, data.metrics, 150, y + 190, 780, palette);
  if (data.callout) drawCallout(ctx, data.callout, 150, y + 270, 780, palette);
  if (data.meta) small(ctx, data.meta, 150, y + (data.callout ? 460 : 360), palette.faint);
}

function drawStack(ctx: CanvasRenderingContext2D, palette: Palette, data: ShareComposition) {
  surface(ctx, 82, 340, 916, data.hero ? 600 : 520, 52, palette.surfaceStrong);
  label(ctx, data.eyebrow, 140, 430, palette.accent);
  fitted(ctx, data.title, 140, 525, 790, 74, palette.ink, 720);
  if (data.subtitle) wrapped(ctx, data.subtitle, 140, 585, 770, 32, 2, palette.muted, 500);
  if (data.hero) hero(ctx, data.hero, 140, 760, palette);
  if (data.meta) small(ctx, data.meta, 140, data.hero ? 860 : 735, palette.faint);
  if (data.metrics.length) {
    surface(ctx, 82, 985, 916, 250, 46, palette.surface);
    drawMetrics(ctx, data.metrics, 130, 1060, 820, palette);
  }
  if (data.callout) {
    surface(ctx, 82, 1270, 916, 330, 46, palette.surfaceStrong);
    drawCallout(ctx, data.callout, 140, 1350, 790, palette);
  }
}

function drawSignature(ctx: CanvasRenderingContext2D, palette: Palette, data: ShareComposition) {
  surface(ctx, 70, 280, 840, data.hero ? 760 : 650, 64, palette.surfaceStrong);
  ctx.fillStyle = palette.accent;
  ctx.beginPath();
  ctx.roundRect(70, 280, 18, data.hero ? 760 : 650, 9);
  ctx.fill();
  label(ctx, data.eyebrow, 144, 390, palette.accent);
  fitted(ctx, data.title, 144, 500, 690, 82, palette.ink, 730);
  if (data.subtitle) wrapped(ctx, data.subtitle, 144, 580, 680, 34, 2, palette.muted, 500);
  if (data.hero) hero(ctx, data.hero, 144, 790, palette);
  if (data.metrics.length) drawMetrics(ctx, data.metrics, 144, data.hero ? 930 : 760, 700, palette);
  if (data.meta) small(ctx, data.meta, 144, data.hero ? 1010 : 870, palette.faint);
  if (data.callout) {
    surface(ctx, 210, 1190, 800, 350, 52, palette.surfaceStrong);
    drawCallout(ctx, data.callout, 270, 1280, 680, palette);
  }
}

function drawBodyFlow(ctx: CanvasRenderingContext2D, palette: Palette, flow: ShareComposition['flow'], layout: ShareLayout) {
  const y = layout === 'minimal' ? 520 : layout === 'stack' ? 260 : 1040;
  const variants = {
    movement: [80, y + 180, 320, y - 100, 720, y + 60, 1030, y - 190],
    rest: [40, y, 280, y - 200, 570, y + 230, 1000, y - 40],
    balance: [60, y + 100, 350, y - 120, 680, y + 120, 1020, y - 80],
    progress: [50, y + 160, 350, y + 80, 650, y - 40, 1030, y - 190],
  }[flow];
  ctx.save();
  ctx.strokeStyle = palette.accent;
  ctx.globalAlpha = .72;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(variants[0], variants[1]);
  ctx.bezierCurveTo(variants[2], variants[3], variants[4], variants[5], variants[6], variants[7]);
  ctx.stroke();
  [0.28, .61, .9].forEach((portion) => {
    const x = 80 + 920 * portion;
    const nodeY = y + Math.sin(portion * Math.PI * 2) * 65;
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.arc(x, nodeY, 14, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function hero(ctx: CanvasRenderingContext2D, value: NonNullable<ShareComposition['hero']>, x: number, y: number, palette: Palette) {
  ctx.textAlign = 'left';
  ctx.fillStyle = palette.ink;
  ctx.font = `750 150px ${FONT}`;
  ctx.fillText(value.value, x, y);
  if (value.unit) {
    const width = ctx.measureText(value.value).width;
    ctx.fillStyle = palette.muted;
    ctx.font = `650 34px ${FONT}`;
    ctx.fillText(value.unit, x + width + 18, y - 12);
  }
  if (value.label) label(ctx, value.label, x, y + 58, palette.accent);
}

function drawMetrics(ctx: CanvasRenderingContext2D, metrics: ShareMetric[], x: number, y: number, width: number, palette: Palette) {
  const shown = metrics.slice(0, 3);
  if (!shown.length) return;
  const column = width / shown.length;
  shown.forEach((metric, index) => {
    const metricX = x + column * index;
    if (index > 0) {
      ctx.fillStyle = palette.line;
      ctx.fillRect(metricX - 22, y - 28, 2, 120);
    }
    label(ctx, metric.label, metricX, y, palette.faint);
    ctx.textAlign = 'left';
    ctx.fillStyle = palette.ink;
    ctx.font = `700 48px ${FONT}`;
    ctx.fillText(metric.value, metricX, y + 64);
    if (metric.unit) {
      const valueWidth = ctx.measureText(metric.value).width;
      ctx.fillStyle = palette.muted;
      ctx.font = `600 22px ${FONT}`;
      ctx.fillText(metric.unit, metricX + valueWidth + 8, y + 62);
    }
  });
}

function drawCallout(ctx: CanvasRenderingContext2D, callout: NonNullable<ShareComposition['callout']>, x: number, y: number, width: number, palette: Palette) {
  label(ctx, callout.eyebrow, x, y, palette.accent);
  fitted(ctx, callout.title, x, y + 64, width, 48, palette.ink, 700);
  if (callout.detail) wrapped(ctx, callout.detail, x, y + 114, width, 29, 2, palette.muted, 500);
}

function surface(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string) {
  ctx.save();
  ctx.shadowColor = 'rgba(4,25,38,.18)';
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
  ctx.restore();
}

function label(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, color: string) {
  ctx.textAlign = 'left';
  ctx.fillStyle = color;
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText(value.toUpperCase(), x, y);
}

function small(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, color: string) {
  ctx.textAlign = 'left';
  ctx.fillStyle = color;
  ctx.font = `550 24px ${FONT}`;
  ctx.fillText(value, x, y);
}

function fitted(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth: number, initial: number, color: string, weight: number) {
  let size = initial;
  ctx.font = `${weight} ${size}px ${FONT}`;
  while (size > 34 && ctx.measureText(value).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${FONT}`;
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function wrapped(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number, color: string, weight: number) {
  ctx.font = `${weight} ${Math.round(lineHeight * .75)}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    let last = visible[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    visible[maxLines - 1] = `${last}…`;
  }
  visible.forEach((text, index) => ctx.fillText(text, x, y + index * lineHeight));
}

function drawBrand(ctx: CanvasRenderingContext2D, palette: Palette) {
  drawBrandLockup(ctx, 986, 1800, 26, palette.ink, palette.accent);
}

function drawBrandLockup(ctx: CanvasRenderingContext2D, right: number, baseline: number, fontSize: number, ink: string, accent: string) {
  const text = 'WHOLEMATE';
  ctx.save();
  ctx.textAlign = 'right';
  ctx.fillStyle = ink;
  ctx.font = `700 ${fontSize}px ${FONT}`;
  const textWidth = ctx.measureText(text).width;
  ctx.fillText(text, right, baseline);
  drawWholeMateMark(ctx, right - textWidth - fontSize * 1.55, baseline - fontSize * 1.08, fontSize * 1.25, accent);
  ctx.restore();
}

function drawWholeMateMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  const scale = size / 512;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.lineWidth = 58;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(150, 105);
  ctx.bezierCurveTo(90, 140, 62, 215, 76, 292);
  ctx.bezierCurveTo(88, 360, 137, 410, 201, 423);
  ctx.bezierCurveTo(228, 429, 244, 407, 257, 379);
  ctx.bezierCurveTo(270, 351, 279, 331, 294, 331);
  ctx.bezierCurveTo(309, 331, 318, 351, 331, 379);
  ctx.bezierCurveTo(344, 407, 360, 429, 387, 423);
  ctx.bezierCurveTo(420, 414, 454, 364, 436, 292);
  ctx.bezierCurveTo(450, 215, 422, 140, 362, 105);
  ctx.stroke();
  ctx.restore();
}
