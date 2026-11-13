import React, { useEffect, useRef, useState } from 'react';
import { State2D, Observables2D } from '../physics/tdse2d';
import { DisplayOptions2D } from './Controls2D';

interface Canvas2DProps {
  stateRef: React.MutableRefObject<State2D>;
  observablesRef: React.MutableRefObject<Observables2D>;
  display: DisplayOptions2D;
  renderTick: number;
}

interface Probe2D {
  x: number;
  y: number;
  density: number;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

export const Canvas2D: React.FC<Canvas2DProps> = ({
  stateRef,
  observablesRef,
  display,
  renderTick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const imageDataRef = useRef<ImageData | null>(null);
  const displayRef = useRef(display);
  displayRef.current = display;

  const [probe, setProbe] = useState<Probe2D | null>(null);

  const drawFrame = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = stateRef.current;
    const {
      nx,
      ny,
      barrierXIndex,
      screenXIndex,
      potentialBoth,
      psiRe,
      psiIm,
      psiTopRe,
      psiTopIm,
      psiBotRe,
      psiBotIm,
      screenIntensity,
      params,
    } = state;

    if (!offscreenRef.current) {
      offscreenRef.current = document.createElement('canvas');
      offscreenRef.current.width = nx;
      offscreenRef.current.height = ny;
    }
    const offscreen = offscreenRef.current;
    if (offscreen.width !== nx || offscreen.height !== ny) {
      offscreen.width = nx;
      offscreen.height = ny;
      imageDataRef.current = null;
    }

    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;
    if (!imageDataRef.current) {
      imageDataRef.current = offCtx.createImageData(nx, ny);
    }
    const imgData = imageDataRef.current;
    const pixels = imgData.data;

    // Adaptive brightness scaling so transmitted fringes remain vivid after hitting barrier
    const obs = observablesRef.current;
    const refMax = Math.max(0.015, obs.maxDensity * 0.55);
    const invRefMax = 1 / refMax;
    const colorMode = displayRef.current.colorMode;

    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        const idx = iy * nx + ix;
        const pIdx = idx * 4;

        if (potentialBoth[idx] > 1.0) {
          // Barrier wall pixels
          pixels[pIdx] = 245;
          pixels[pIdx + 1] = 158;
          pixels[pIdx + 2] = 11;
          pixels[pIdx + 3] = 215;
          continue;
        }

        let density = 0;
        let re = 0;
        let im = 0;
        if (!params.whichPathDetector) {
          re = psiRe[idx];
          im = psiIm[idx];
          density = re * re + im * im;
        } else {
          const r1 = psiTopRe[idx];
          const i1 = psiTopIm[idx];
          const r2 = psiBotRe[idx];
          const i2 = psiBotIm[idx];
          if (ix > barrierXIndex) {
            density = r1 * r1 + i1 * i1 + r2 * r2 + i2 * i2;
          } else {
            density = 0.5 * (r1 * r1 + i1 * i1 + r2 * r2 + i2 * i2);
          }
          re = r1 + r2;
          im = i1 + i2;
        }

        // Gamma-compressed intensity for dynamic range (transmitted wave vs incident wave)
        const normD = Math.min(1, Math.pow(density * invRefMax, 0.45));

        if (colorMode === 'phase' && !params.whichPathDetector) {
          const phase = Math.atan2(im, re);
          const hue = ((phase + Math.PI) / (2 * Math.PI)) * 360;
          const [r, g, b] = hslToRgb(hue, 0.9, 0.1 + normD * 0.52);
          pixels[pIdx] = r;
          pixels[pIdx + 1] = g;
          pixels[pIdx + 2] = b;
          pixels[pIdx + 3] = 255;
        } else {
          // Calibrated Obsidian -> Deep Cobalt -> Cyan -> White density colormap
          const r = Math.round(9 + normD * normD * 220);
          const g = Math.round(13 + normD * 195 + normD * normD * 40);
          const b = Math.round(22 + Math.sqrt(normD) * 215);
          pixels[pIdx] = Math.min(255, r);
          pixels[pIdx + 1] = Math.min(255, g);
          pixels[pIdx + 2] = Math.min(255, b);
          pixels[pIdx + 3] = 255;
        }
      }
    }

    offCtx.putImageData(imgData, 0, 0);

    ctx.save();
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, 0, width, height);

    const padTop = 26;
    const padBottom = 30;
    const padLeft = 18;
    const padRight = 18;
    const gapBetween = 16;

    const totalInnerW = Math.max(200, width - padLeft - padRight);
    const fieldW = Math.floor((totalInnerW - gapBetween) * 0.77);
    const histW = totalInnerW - gapBetween - fieldW;
    const plotH = Math.max(160, height - padTop - padBottom);

    // Draw 2D Wavefunction Field
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(offscreen, padLeft, padTop, fieldW, plotH);

    // Detector Screen Line inside 2D field
    const screenPx = padLeft + (screenXIndex / (nx - 1)) * fieldW;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(screenPx, padTop);
    ctx.lineTo(screenPx, padTop + plotH);
    ctx.stroke();
    ctx.restore();

    // Which-path detector indicator ring at upper slit
    if (params.whichPathDetector) {
      const barrierPx = padLeft + (barrierXIndex / (nx - 1)) * fieldW;
      const topSlitPy =
        padTop + (((ny - 1) * 0.5 - params.slitSeparation * 0.5) / (ny - 1)) * plotH;
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(barrierPx, topSlitPy, 9, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Field border
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    ctx.strokeRect(padLeft, padTop, fieldW, plotH);

    // Draw Right-Hand Detector Screen Intensity Histogram I(y)
    const histX = padLeft + fieldW + gapBetween;
    ctx.fillStyle = '#070A12';
    ctx.fillRect(histX, padTop, histW, plotH);
    ctx.strokeStyle = '#1E293B';
    ctx.strokeRect(histX, padTop, histW, plotH);

    let maxScreen = 0;
    for (let iy = 0; iy < ny; iy++) {
      if (screenIntensity[iy] > maxScreen) maxScreen = screenIntensity[iy];
    }

    if (maxScreen > 1e-8) {
      const invMaxS = 1 / maxScreen;
      ctx.beginPath();
      ctx.moveTo(histX, padTop);
      for (let iy = 0; iy < ny; iy++) {
        const py = padTop + (iy / (ny - 1)) * plotH;
        const barLen = Math.min(histW - 10, screenIntensity[iy] * invMaxS * (histW - 14));
        ctx.lineTo(histX + barLen, py);
      }
      ctx.lineTo(histX, padTop + plotH);
      ctx.closePath();
      ctx.fillStyle = params.whichPathDetector
        ? 'rgba(245, 158, 11, 0.25)'
        : 'rgba(6, 182, 212, 0.28)';
      ctx.fill();

      ctx.beginPath();
      for (let iy = 0; iy < ny; iy++) {
        const py = padTop + (iy / (ny - 1)) * plotH;
        const barLen = Math.min(histW - 10, screenIntensity[iy] * invMaxS * (histW - 14));
        if (iy === 0) ctx.moveTo(histX + barLen, py);
        else ctx.lineTo(histX + barLen, py);
      }
      ctx.strokeStyle = params.whichPathDetector ? '#FBBF24' : '#22D3EE';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Axis labels
    ctx.direction = 'rtl';
    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px "Vazirmatn", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('میدان موج دو بعدی و دیواره دوشکاف', padLeft + fieldW * 0.5, padTop - 6);
    ctx.fillText('پرده آشکارساز I(y)', histX + histW * 0.5, padTop - 6);

    ctx.restore();
  };

  useEffect(() => {
    let rafId = 0;
    const loop = () => {
      drawFrame();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    drawFrame();
  }, [renderTick, display]);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const padTop = 26;
    const padBottom = 30;
    const padLeft = 18;
    const padRight = 18;
    const gapBetween = 16;
    const totalInnerW = Math.max(200, rect.width - padLeft - padRight);
    const fieldW = Math.floor((totalInnerW - gapBetween) * 0.77);
    const plotH = Math.max(160, rect.height - padTop - padBottom);

    if (px < padLeft || px > padLeft + fieldW || py < padTop || py > padTop + plotH) {
      setProbe(null);
      return;
    }

    const st = stateRef.current;
    const ix = Math.max(
      0,
      Math.min(st.nx - 1, Math.round(((px - padLeft) / fieldW) * (st.nx - 1)))
    );
    const iy = Math.max(
      0,
      Math.min(st.ny - 1, Math.round(((py - padTop) / plotH) * (st.ny - 1)))
    );
    const idx = iy * st.nx + ix;
    const density = st.params.whichPathDetector
      ? 0.5 *
        (st.psiTopRe[idx] * st.psiTopRe[idx] +
          st.psiTopIm[idx] * st.psiTopIm[idx] +
          st.psiBotRe[idx] * st.psiBotRe[idx] +
          st.psiBotIm[idx] * st.psiBotIm[idx])
      : st.psiRe[idx] * st.psiRe[idx] + st.psiIm[idx] * st.psiIm[idx];

    setProbe({
      x: ix * st.dx,
      y: (iy - st.ny * 0.5) * st.dy,
      density,
    });
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[320px] lg:min-h-0 select-none"
    >
      <canvas
        ref={canvasRef}
        data-testid="quantum-canvas-2d"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setProbe(null)}
        className="w-full h-full block cursor-crosshair"
      />

      {probe && (
        <div
          dir="ltr"
          className="pointer-events-none absolute bottom-9 left-6 px-2.5 py-1.5 rounded bg-[#07090E]/90 border border-slate-700 font-mono text-[11px] text-slate-200 tabular-nums"
        >
          x = {probe.x.toFixed(1)} nm · y = {probe.y.toFixed(1)} nm · |ψ|² = {probe.density.toFixed(4)}
        </div>
      )}
    </div>
  );
};
