import React from 'react';
import { Observables1D, TelemetryPoint1D } from '../physics/tdse1d';
import { Observables2D } from '../physics/tdse2d';

interface TelemetryTray1DProps {
  mode: '1d';
  observables: Observables1D;
  history: TelemetryPoint1D[];
  lastMeasurementX: number | null;
}

interface TelemetryTray2DProps {
  mode: '2d';
  observables: Observables2D;
  whichPathDetector: boolean;
}

type TelemetryTrayProps = TelemetryTray1DProps | TelemetryTray2DProps;

interface MetricCellProps {
  label: string;
  value: string;
  unit?: string;
  accent?: 'cyan' | 'amber' | 'neutral';
}

const MetricCell: React.FC<MetricCellProps> = ({
  label,
  value,
  unit,
  accent = 'neutral',
}) => {
  const valueColor =
    accent === 'cyan'
      ? 'text-cyan-300'
      : accent === 'amber'
      ? 'text-amber-300'
      : 'text-slate-100';

  return (
    <div className="px-3.5 py-2.5 bg-[#090D16] border border-slate-800/90 rounded-md">
      <div className="text-[11px] text-slate-400 truncate">{label}</div>
      <div dir="ltr" className={`mt-0.5 text-lg font-mono font-semibold tabular-nums ${valueColor}`}>
        {value}
        {unit && <span className="text-[11px] font-normal text-slate-400 ml-1">{unit}</span>}
      </div>
    </div>
  );
};

export const TelemetryTray: React.FC<TelemetryTrayProps> = (props) => {
  if (props.mode === '2d') {
    const { observables, whichPathDetector } = props;
    return (
      <section
        aria-label="تله‌متری لحظه‌ای آزمایش دوشکاف"
        className="border-t border-slate-800 bg-[#0A0F1A] px-4 sm:px-6 py-3.5"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCell
            label="زمان شبیه‌سازی (t)"
            value={observables.time.toFixed(2)}
            unit="fs"
          />
          <MetricCell
            label="کنتراست نوارهای تداخلی (V)"
            value={(observables.fringeVisibility * 100).toFixed(1)}
            unit="%"
            accent={whichPathDetector ? 'amber' : 'cyan'}
          />
          <MetricCell
            label="شدت تجمعی آشکارساز"
            value={observables.screenTotalIntensity.toFixed(2)}
            unit="a.u."
          />
          <MetricCell
            label="پایستگی نرم موج"
            value={observables.norm.toFixed(4)}
          />
        </div>
      </section>
    );
  }

  const { observables, history, lastMeasurementX } = props;

  // Build SVG paths for T(t) and R(t) time-series
  const svgW = 320;
  const svgH = 74;
  const buildPath = (extractor: (p: TelemetryPoint1D) => number) => {
    if (history.length < 2) return '';
    return history
      .map((pt, idx) => {
        const x = (idx / (history.length - 1)) * svgW;
        const y = svgH - Math.max(0, Math.min(1, extractor(pt))) * (svgH - 8) - 4;
        return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const tPath = buildPath((p) => p.transmission);
  const rPath = buildPath((p) => p.reflection);

  return (
    <section
      aria-label="داده‌های لحظه‌ای تابع موج"
      className="border-t border-slate-800 bg-[#0A0F1A] px-4 sm:px-6 py-3.5"
    >
      <div className="flex flex-col xl:flex-row items-stretch gap-3">
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          <MetricCell
            label="احتمال عبور (T)"
            value={(observables.transmissionProb * 100).toFixed(1)}
            unit="%"
            accent="cyan"
          />
          <MetricCell
            label="احتمال بازتاب (R)"
            value={(observables.reflectionProb * 100).toFixed(1)}
            unit="%"
            accent="amber"
          />
          <MetricCell
            label="میانگین مکان ⟨x⟩"
            value={observables.meanX.toFixed(2)}
            unit="nm"
          />
          <MetricCell
            label="عدم قطعیت (Δx)"
            value={observables.deltaX.toFixed(2)}
            unit="nm"
          />
          <MetricCell
            label="انرژی کل ⟨E⟩"
            value={observables.meanEnergy.toFixed(2)}
            unit="eV"
          />
          <MetricCell
            label={lastMeasurementX !== null ? 'آخرین مکان اندازه‌گیری' : 'پایستگی نرم ∫|ψ|²dx'}
            value={
              lastMeasurementX !== null
                ? lastMeasurementX.toFixed(2)
                : observables.norm.toFixed(4)
            }
            unit={lastMeasurementX !== null ? 'nm' : undefined}
          />
        </div>

        {/* Live Time-Series T(t) and R(t) SVG Chart */}
        <div className="xl:w-[350px] shrink-0 px-3.5 py-2 bg-[#090D16] border border-slate-800/90 rounded-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span>روند زمانی ضریب عبور و بازتاب</span>
            <div className="flex items-center gap-3 font-mono">
              <span className="text-cyan-300">— T(t)</span>
              <span className="text-amber-300">-- R(t)</span>
            </div>
          </div>
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full h-[64px] overflow-visible"
            role="img"
            aria-label="نمودار زمانی ضریب عبور و بازتاب"
          >
            <line x1="0" y1={svgH - 4} x2={svgW} y2={svgH - 4} stroke="#1E293B" strokeWidth="1" />
            <line x1="0" y1={svgH * 0.5} x2={svgW} y2={svgH * 0.5} stroke="#151E30" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="0" y1="4" x2={svgW} y2="4" stroke="#151E30" strokeWidth="1" />
            {rPath && (
              <path
                d={rPath}
                fill="none"
                stroke="#F59E0B"
                strokeWidth="1.75"
                strokeDasharray="4 3"
              />
            )}
            {tPath && (
              <path
                d={tPath}
                fill="none"
                stroke="#22D3EE"
                strokeWidth="2"
              />
            )}
          </svg>
        </div>
      </div>
    </section>
  );
};
