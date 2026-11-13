import React from 'react';
import { Play, Pause, SkipForward, Eye, EyeOff } from 'lucide-react';
import { SimParams2D } from '../physics/tdse2d';

export interface DisplayOptions2D {
  colorMode: 'density' | 'phase';
}

interface Controls2DProps {
  params: SimParams2D;
  display: DisplayOptions2D;
  isRunning: boolean;
  speed: number;
  onParamChange: (patch: Partial<SimParams2D>, resetWave?: boolean) => void;
  onDisplayChange: (patch: Partial<DisplayOptions2D>) => void;
  onToggleRun: () => void;
  onStep: () => void;
  onSpeedChange: (speed: number) => void;
}

export const Controls2D: React.FC<Controls2DProps> = ({
  params,
  display,
  isRunning,
  speed,
  onParamChange,
  onDisplayChange,
  onToggleRun,
  onStep,
  onSpeedChange,
}) => {
  return (
    <aside
      aria-label="کنترل پارامترهای آزمایش دوشکاف"
      className="w-full lg:w-[356px] shrink-0 bg-[#0C111C] border-t lg:border-t-0 lg:border-r border-slate-800 flex flex-col justify-between overflow-y-auto"
    >
      <div className="p-4 sm:p-5 space-y-5">
        {/* Execution Bar */}
        <section className="space-y-3 pb-4 border-b border-slate-800/80">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-300">کنترل آزمایش دوشکاف</h2>
            <div className="flex items-center gap-1" role="group" aria-label="سرعت شبیه‌سازی">
              {[0.5, 1, 2].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSpeedChange(s)}
                  className={`px-2 py-1 text-[11px] font-mono rounded transition-colors ${
                    speed === s
                      ? 'bg-slate-700 text-cyan-300 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onToggleRun}
              className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                isRunning
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25'
                  : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
              }`}
            >
              {isRunning ? (
                <>
                  <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>توقف</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>ادامه اجرا</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onStep}
              disabled={isRunning}
              className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium rounded-md border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              <SkipForward className="w-3.5 h-3.5" aria-hidden="true" />
              <span>تک‌گام</span>
            </button>
          </div>
        </section>

        {/* Which-Path Quantum Measurement Toggle */}
        <section className="space-y-2.5 pb-4 border-b border-slate-800/80">
          <h2 className="text-xs font-semibold text-slate-300">آشکارساز مسیر (کاهش همدوسی)</h2>
          <button
            type="button"
            aria-pressed={params.whichPathDetector}
            onClick={() =>
              onParamChange({ whichPathDetector: !params.whichPathDetector }, true)
            }
            className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-medium rounded-md border transition-colors ${
              params.whichPathDetector
                ? 'border-amber-400/60 bg-amber-500/15 text-amber-200'
                : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-2">
              {params.whichPathDetector ? (
                <Eye className="w-4 h-4 text-amber-300" aria-hidden="true" />
              ) : (
                <EyeOff className="w-4 h-4 text-cyan-400" aria-hidden="true" />
              )}
              <span>
                {params.whichPathDetector
                  ? 'آشکارساز مسیر فعال (بدون تداخل)'
                  : 'آشکارساز خاموش (برهم‌نهی همدوس)'}
              </span>
            </span>
          </button>
          <p className="text-[11px] leading-relaxed text-slate-400">
            با فعال شدن آشکارساز مسیر، اطلاعات عبور ذره از شکاف بالا یا پایین ثبت شده و نوارهای تداخلی روی پرده آشکارساز از بین می‌روند.
          </p>
        </section>

        {/* Double-Slit Geometry & Wave Parameters */}
        <section className="space-y-4 pb-4 border-b border-slate-800/80">
          <h2 className="text-xs font-semibold text-slate-300">هندسه شکاف‌ها و موج فرودی</h2>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="slider-2d-kx" className="text-slate-300 font-medium">
                انرژی و تکانه فرودی (kₓ)
              </label>
              <span dir="ltr" className="font-mono tabular-nums text-slate-200">
                {params.kx.toFixed(1)} <span className="text-slate-400 text-[11px]">ℏ/a₀</span>
              </span>
            </div>
            <input
              id="slider-2d-kx"
              type="range"
              min={2.0}
              max={6.5}
              step={0.2}
              value={params.kx}
              onChange={(e) => onParamChange({ kx: parseFloat(e.target.value) }, true)}
              className="quantum-slider w-full"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="slider-2d-sep" className="text-slate-300 font-medium">
                فاصله بین دو شکاف (d)
              </label>
              <span dir="ltr" className="font-mono tabular-nums text-slate-200">
                {(params.slitSeparation * 0.2).toFixed(1)}{' '}
                <span className="text-slate-400 text-[11px]">nm</span>
              </span>
            </div>
            <input
              id="slider-2d-sep"
              type="range"
              min={10}
              max={34}
              step={2}
              value={params.slitSeparation}
              onChange={(e) =>
                onParamChange({ slitSeparation: parseFloat(e.target.value) }, false)
              }
              className="quantum-slider w-full"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="slider-2d-width" className="text-slate-300 font-medium">
                پهنای هر شکاف (a)
              </label>
              <span dir="ltr" className="font-mono tabular-nums text-slate-200">
                {(params.slitWidth * 0.2).toFixed(1)}{' '}
                <span className="text-slate-400 text-[11px]">nm</span>
              </span>
            </div>
            <input
              id="slider-2d-width"
              type="range"
              min={3}
              max={14}
              step={1}
              value={params.slitWidth}
              onChange={(e) =>
                onParamChange({ slitWidth: parseFloat(e.target.value) }, false)
              }
              className="quantum-slider w-full"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="slider-2d-v0" className="text-slate-300 font-medium">
                ارتفاع پتانسیل دیواره (V₀)
              </label>
              <span dir="ltr" className="font-mono tabular-nums text-slate-200">
                {params.barrierHeight.toFixed(0)}{' '}
                <span className="text-slate-400 text-[11px]">eV</span>
              </span>
            </div>
            <input
              id="slider-2d-v0"
              type="range"
              min={10}
              max={80}
              step={5}
              value={params.barrierHeight}
              onChange={(e) =>
                onParamChange({ barrierHeight: parseFloat(e.target.value) }, false)
              }
              className="quantum-slider w-full"
            />
          </div>
        </section>

        {/* Color Mapping Mode */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-slate-300">حالت نمایش میدان موج</h2>
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#07090E] border border-slate-800 rounded-md">
            <button
              type="button"
              onClick={() => onDisplayChange({ colorMode: 'density' })}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                display.colorMode === 'density'
                  ? 'bg-slate-800 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              چگالی احتمال |ψ|²
            </button>
            <button
              type="button"
              onClick={() => onDisplayChange({ colorMode: 'phase' })}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                display.colorMode === 'phase'
                  ? 'bg-slate-800 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              فاز و دامنه (HSL)
            </button>
          </div>
        </section>
      </div>
    </aside>
  );
};
