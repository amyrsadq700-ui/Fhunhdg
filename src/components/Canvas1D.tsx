import React, { useEffect, useRef, useState } from 'react';
import { State1D, Observables1D, paintPotential1D } from '../physics/tdse1d';
import { DisplayOptions1D } from './Controls1D';

interface Canvas1DProps {
  stateRef: React.MutableRefObject<State1D>;
  observablesRef: React.MutableRefObject<Observables1D>;
  display: DisplayOptions1D;
  renderTick: number; // Triggers redraw when paused or reset
  onPotentialPainted: () => void;
}

interface ProbeData {
  x: number;
  v: number;
  density: number;
  px: number;
  py: number;
}

function hslToRgbCss(hDeg: number, s: number, l: number, alpha = 1): string {
  return `hsla(${Math.round(hDeg)}, ${s}%, ${l}%, ${alpha})`;
}

export const Canvas1D: React.FC<Canvas1DProps> = ({
  stateRef,
  observablesRef,
  display,
  renderTick,
  onPotentialPainted,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const displayRef = useRef(display);
  displayRef.current = display;

  const [probe, setProbe] = useState<ProbeData | null>(null);

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

    ctx.save();
    ctx.scale(dpr, dpr);

    // Layout geometry inside canvas
    const padLeft = 52;
    const padRight = 24;
    const padTop = 28;
    const padBottom = 38;
    const plotW = Math.max(100, width - padLeft - padRight);
    const plotH = Math.max(100, height - padTop - padBottom);
    const baseY = padTop + plotH * 0.72; // y for V=0 and |psi|^2=0
    const posHeight = baseY - padTop; // headroom above baseline
    const negHeight = padTop + plotH - baseY; // room below baseline for wells / Re / Im

    // 1. Background
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, 0, width, height);

    const state = stateRef.current;
    const obs = observablesRef.current;
    const { n, xMin, xMax, x, psiRe, psiIm, potential } = state;

    const mapX = (wx: number) => padLeft + ((wx - xMin) / (xMax - xMin)) * plotW;
    const vScale = posHeight / 16.0; // 16 eV maps to top of plot
    const mapV = (v: number) => {
      const clamped = Math.max(-8, Math.min(18, v));
      return baseY - clamped * vScale;
    };

    // 2. Coordinate Grid
    ctx.strokeStyle = '#151E30';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = -20; gx <= 20; gx += 5) {
      const px = mapX(gx);
      ctx.moveTo(px, padTop);
      ctx.lineTo(px, padTop + plotH);
    }
    for (let gv = -4; gv <= 16; gv += 4) {
      const py = mapV(gv);
      if (py >= padTop && py <= padTop + plotH) {
        ctx.moveTo(padLeft, py);
        ctx.lineTo(padLeft + plotW, py);
      }
    }
    ctx.stroke();

    // Baseline (V = 0)
    ctx.strokeStyle = '#293548';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(padLeft, baseY);
    ctx.lineTo(padLeft + plotW, baseY);
    ctx.stroke();

    // Axis Labels (force LTR direction so units like "12 eV" are never reversed)
    ctx.direction = 'ltr';
    ctx.fillStyle = '#64748B';
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let gx = -20; gx <= 20; gx += 10) {
      const px = mapX(gx);
      ctx.fillText(`${gx}`, px, padTop + plotH + 8);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let gv = 0; gv <= 12; gv += 4) {
      const py = mapV(gv);
      ctx.fillText(`${gv} eV`, padLeft - 8, py);
    }
    ctx.fillText('nm', padLeft - 8, padTop + plotH + 14);

    // 3. Absorbing boundary zone hint
    if (state.params.absorbingBoundaries) {
      const marginW = (4.5 / (xMax - xMin)) * plotW;
      ctx.fillStyle = 'rgba(100, 116, 139, 0.08)';
      ctx.fillRect(padLeft, padTop, marginW, plotH);
      ctx.fillRect(padLeft + plotW - marginW, padTop, marginW, plotH);
    }

    // 4. Potential V(x) fill and stroke
    ctx.beginPath();
    ctx.moveTo(mapX(x[0]), baseY);
    for (let i = 0; i < n; i++) {
      ctx.lineTo(mapX(x[i]), mapV(potential[i]));
    }
    ctx.lineTo(mapX(x[n - 1]), baseY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const px = mapX(x[i]);
      const py = mapV(potential[i]);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 5. Particle Energy <E> reference dashed line
    const clampedEnergy = Math.max(-6, Math.min(16, obs.meanEnergy));
    const energyY = mapV(clampedEnergy);
    if (energyY >= padTop && energyY <= padTop + plotH) {
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, energyY);
      ctx.lineTo(padLeft + plotW, energyY);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`⟨E⟩ = ${obs.meanEnergy.toFixed(2)} eV`, padLeft + 8, energyY - 4);
    }

    // Determine adaptive density scaling so wavepacket remains crisp and readable
    const peakScale = Math.max(0.32, obs.maxDensity * 1.15);
    const densityHeightScale = (posHeight * 0.86) / peakScale;
    const ampScale = Math.min(negHeight * 0.78, posHeight * 0.42) / Math.sqrt(peakScale);

    // 6. Optional Re(psi) & Im(psi) oscillations
    if (displayRef.current.showRealImag) {
      // Re(psi)
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const px = mapX(x[i]);
        const py = baseY - psiRe[i] * ampScale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.75)';
      ctx.lineWidth = 1.3;
      ctx.stroke();

      // Im(psi)
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const px = mapX(x[i]);
        const py = baseY - psiIm[i] * ampScale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = 'rgba(129, 140, 248, 0.75)';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }

    // 7. Probability Density |psi(x,t)|^2
    if (displayRef.current.showDensity) {
      ctx.beginPath();
      ctx.moveTo(mapX(x[0]), baseY);
      for (let i = 0; i < n; i++) {
        const prob = psiRe[i] * psiRe[i] + psiIm[i] * psiIm[i];
        const py = Math.max(padTop, baseY - prob * densityHeightScale);
        ctx.lineTo(mapX(x[i]), py);
      }
      ctx.lineTo(mapX(x[n - 1]), baseY);
      ctx.closePath();

      if (displayRef.current.phaseColoring) {
        const phaseGrad = ctx.createLinearGradient(padLeft, 0, padLeft + plotW, 0);
        const stops = 36;
        for (let s = 0; s <= stops; s++) {
          const frac = s / stops;
          const idx = Math.min(n - 1, Math.round(frac * (n - 1)));
          const phase = Math.atan2(psiIm[idx], psiRe[idx]);
          const hue = ((phase + Math.PI) / (2 * Math.PI)) * 360;
          phaseGrad.addColorStop(frac, hslToRgbCss(hue, 72, 54, 0.36));
        }
        ctx.fillStyle = phaseGrad;
      } else {
        const grad = ctx.createLinearGradient(0, padTop, 0, baseY);
        grad.addColorStop(0, 'rgba(6, 182, 212, 0.42)');
        grad.addColorStop(1, 'rgba(6, 182, 212, 0.04)');
        ctx.fillStyle = grad;
      }
      ctx.fill();

      // Crisp probability envelope line
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const prob = psiRe[i] * psiRe[i] + psiIm[i] * psiIm[i];
        const px = mapX(x[i]);
        const py = Math.max(padTop, baseY - prob * densityHeightScale);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = displayRef.current.phaseColoring ? '#E2E8F0' : '#22D3EE';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 8. Expectation <x> +/- deltaX indicator
    const meanPx = mapX(obs.meanX);
    const leftSigmaPx = Math.max(padLeft, mapX(obs.meanX - obs.deltaX));
    const rightSigmaPx = Math.min(padLeft + plotW, mapX(obs.meanX + obs.deltaX));
    const indicatorY = baseY + 14;

    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(leftSigmaPx, indicatorY);
    ctx.lineTo(rightSigmaPx, indicatorY);
    ctx.moveTo(leftSigmaPx, indicatorY - 4);
    ctx.lineTo(leftSigmaPx, indicatorY + 4);
    ctx.moveTo(rightSigmaPx, indicatorY - 4);
    ctx.lineTo(rightSigmaPx, indicatorY + 4);
    ctx.stroke();

    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.arc(meanPx, indicatorY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // 9. Last Born measurement marker
    if (state.lastMeasurementX !== null) {
      const mPx = mapX(state.lastMeasurementX);
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = '#FB7185';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mPx, padTop);
      ctx.lineTo(mPx, baseY);
      ctx.stroke();
      ctx.restore();
    }

    // 10. Plot border
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    ctx.strokeRect(padLeft, padTop, plotW, plotH);

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

  const clientToWorld = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;

    const padLeft = 52;
    const padRight = 24;
    const padTop = 28;
    const padBottom = 38;
    const plotW = Math.max(100, rect.width - padLeft - padRight);
    const plotH = Math.max(100, rect.height - padTop - padBottom);
    const baseY = padTop + plotH * 0.72;
    const posHeight = baseY - padTop;
    const vScale = posHeight / 16.0;

    const { xMin, xMax } = stateRef.current;
    const wx = xMin + ((px - padLeft) / plotW) * (xMax - xMin);
    const wv = (baseY - py) / vScale;

    return { px, py, wx, wv, inPlot: px >= padLeft && px <= padLeft + plotW && py >= padTop && py <= padTop + plotH };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!displayRef.current.drawMode) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const coords = clientToWorld(e.clientX, e.clientY);
    if (coords && coords.inPlot) {
      paintPotential1D(stateRef.current, coords.wx, coords.wv, 1.6);
      onPotentialPainted();
      drawFrame();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const coords = clientToWorld(e.clientX, e.clientY);
    if (!coords || !coords.inPlot) {
      setProbe(null);
      return;
    }

    if (isDrawingRef.current && displayRef.current.drawMode) {
      paintPotential1D(stateRef.current, coords.wx, coords.wv, 1.6);
      onPotentialPainted();
      drawFrame();
    }

    const st = stateRef.current;
    const idx = Math.max(
      0,
      Math.min(
        st.n - 1,
        Math.round(((coords.wx - st.xMin) / (st.xMax - st.xMin)) * (st.n - 1))
      )
    );
    const density = st.psiRe[idx] * st.psiRe[idx] + st.psiIm[idx] * st.psiIm[idx];
    setProbe({
      x: st.x[idx],
      v: st.potential[idx],
      density,
      px: coords.px,
      py: coords.py,
    });
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[300px] lg:min-h-0 select-none"
    >
      <canvas
        ref={canvasRef}
        data-testid="quantum-canvas-1d"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          isDrawingRef.current = false;
          setProbe(null);
        }}
        className={`w-full h-full block ${
          display.drawMode ? 'cursor-cell' : 'cursor-crosshair'
        }`}
      />

      {/* Legend Overlay (Bottom Left) */}
      <div
        dir="rtl"
        className="pointer-events-none absolute bottom-11 left-4 flex flex-wrap items-center gap-4 px-3 py-1.5 rounded bg-[#07090E]/85 border border-slate-800 text-[11px] text-slate-300"
      >
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-cyan-400 inline-block" aria-hidden="true" />
          <span>چگالی احتمال |ψ|²</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-amber-400 inline-block" aria-hidden="true" />
          <span>پتانسیل V(x)</span>
        </span>
        {display.showRealImag && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-emerald-400 inline-block" aria-hidden="true" />
              <span>Re(ψ)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-indigo-400 inline-block" aria-hidden="true" />
              <span>Im(ψ)</span>
            </span>
          </>
        )}
      </div>

      {/* Crosshair Coordinate Probe */}
      {probe && (
        <div
          dir="ltr"
          className="pointer-events-none absolute top-3 left-4 px-2.5 py-1.5 rounded bg-[#07090E]/90 border border-slate-700 font-mono text-[11px] text-slate-200 tabular-nums"
        >
          x = {probe.x.toFixed(2)} nm · V = {probe.v.toFixed(2)} eV · |ψ|² = {probe.density.toFixed(3)}
        </div>
      )}

      {display.drawMode && (
        <div className="pointer-events-none absolute bottom-11 right-4 px-3 py-1.5 rounded bg-amber-500/15 border border-amber-500/40 text-[11px] text-amber-200">
          برای ترسیم یا تغییر پتانسیل V(x) روی نمودار کلیک کرده و بکشید
        </div>
      )}
    </div>
  );
};
