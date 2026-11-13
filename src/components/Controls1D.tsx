import React from 'react';
import { Play, Pause, SkipForward, Crosshair, Paintbrush, Eraser } from 'lucide-react';
import { PotentialPreset1D, SimParams1D } from '../physics/tdse1d';

export interface DisplayOptions1D {
  showDensity: boolean;
  showRealImag: boolean;
  phaseColoring: boolean;
  drawMode: boolean;
}

interface Controls1DProps {
  params: SimParams1D;
  display: DisplayOptions1D;
  isRunning: boolean;
  speed: number;
  onParamChange: (patch: Partial<SimParams1D>, resetWavepacket?: boolean) => void;
  onPresetChange: (preset: PotentialPreset1D) => void;
  onDisplayChange: (patch: Partial<DisplayOptions1D>) => void;
  onToggleRun: () => void;
  onStep: () => void;
  onSpeedChange: (speed: number) => void;
  onMeasure: () => void;
  onClearCustomPotential: () => void;
}

interface SliderRowProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  precision?: number;
  onChange: (val: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  precision = 1,
  onChange,
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between gap-2 text-xs">
      <label htmlFor={id} className="text-slate-300 font-medium">
        {label}
      </label>
      <span dir="ltr" className="font-mono tabular-nums text-slate-200">
        {value.toFixed(precision)} <span className="text-slate-400 text-[11px]">{unit}</span>
      </span>
    </div>
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="quantum-slider w-full"
    />
  </div>
);

const PRESET_OPTIONS: { value: PotentialPreset1D; label: string }[] = [
  { value: 'barrier', label: 'سد پتانسیل (تونل‌زنی کوانتومی)' },
  { value: 'double-barrier', label: 'سد دوتایی (تشدید تداخلی)' },
  { value: 'step', label: 'پتانسیل پله‌ای' },
  { value: 'harmonic', label: 'نوسانگر هماهنگ کوانتومی' },
  { value: 'square-well', label: 'چاه پتانسیل متناهی' },
  { value: 'free', label: 'ذره آزاد (پخش بسته موج)' },
  { value: 'custom', label: 'پتانسیل سفارشی (ترسیم دستی)' },
];

export const Controls1D: React.FC<Controls1DProps> = ({
  params,
  display,
  isRunning,
  speed,
  onParamChange,
  onPresetChange,
  onDisplayChange,
  onToggleRun,
  onStep,
  onSpeedChange,
  onMeasure,
  onClearCustomPotential,
}) => {
  return (
    <aside
      aria-label="کنترل پارامترهای شبیه‌ساز یک‌بعدی"
      className="w-full lg:w-[356px] shrink-0 bg-[#0C111C] border-t lg:border-t-0 lg:border-r border-slate-800 flex flex-col justify-between overflow-y-auto"
    >
      <div className="p-4 sm:p-5 space-y-5">
        {/* Execution Bar */}
        <section className="space-y-3 pb-4 border-b border-slate-800/80">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-300">کنترل اجرا</h2>
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

          <button
            type="button"
            onClick={onMeasure}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-md border border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 transition-colors"
          >
            <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
            <span>اندازه‌گیری مکان ذره (فروپاشی تابع موج)</span>
          </button>
        </section>

        {/* Potential Preset */}
        <section className="space-y-3 pb-4 border-b border-slate-800/80">
          <div className="space-y-1.5">
            <label htmlFor="preset-select-1d" className="block text-xs font-semibold text-slate-300">
              پیکربندی پتانسیل V(x)
            </label>
            <select
              id="preset-select-1d"
              value={params.preset}
              onChange={(e) => onPresetChange(e.target.value as PotentialPreset1D)}
              className="w-full px-3 py-2 text-xs bg-[#07090E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-cyan-400"
            >
              {PRESET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              aria-pressed={display.drawMode}
              onClick={() => onDisplayChange({ drawMode: !display.drawMode })}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border transition-colors ${
                display.drawMode
                  ? 'border-amber-400 bg-amber-500/15 text-amber-200'
                  : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Paintbrush className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{display.drawMode ? 'خروج از حالت ترسیم' : 'ترسیم پتانسیل روی نمودار'}</span>
            </button>

            {params.preset === 'custom' && (
              <button
                type="button"
                onClick={onClearCustomPotential}
                aria-label="پاک کردن پتانسیل سفارشی"
                title="پاک کردن پتانسیل"
                className="px-2.5 py-2 text-xs rounded-md border border-slate-700 bg-slate-900 text-slate-300 hover:text-rose-300 hover:border-rose-500/40 transition-colors"
              >
                <Eraser className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </section>

        {/* Wavepacket Parameters */}
        <section className="space-y-3.5 pb-4 border-b border-slate-800/80">
          <h2 className="text-xs font-semibold text-slate-300">پارامترهای بسته موج اولیه</h2>

          <SliderRow
            id="slider-k0"
            label="تکانه اولیه (k₀)"
            value={params.k0}
            min={-6.0}
            max={6.5}
            step={0.1}
            unit="ℏ/a₀"
            onChange={(val) => onParamChange({ k0: val }, true)}
          />

          <SliderRow
            id="slider-sigma"
            label="پهنای بسته موج (σ)"
            value={params.sigma}
            min={0.6}
            max={4.0}
            step={0.1}
            unit="nm"
            onChange={(val) => onParamChange({ sigma: val }, true)}
          />

          <SliderRow
            id="slider-x0"
            label="مکان اولیه (x₀)"
            value={params.x0}
            min={-20}
            max={15}
            step={0.5}
            unit="nm"
            onChange={(val) => onParamChange({ x0: val }, true)}
          />

          <SliderRow
            id="slider-mass"
            label="جرم موثر ذره (m)"
            value={params.mass}
            min={0.4}
            max={3.0}
            step={0.1}
            unit="mₑ"
            onChange={(val) => onParamChange({ mass: val }, false)}
          />
        </section>

        {/* Barrier Parameters */}
        <section className="space-y-3.5 pb-4 border-b border-slate-800/80">
          <h2 className="text-xs font-semibold text-slate-300">تنظیمات سد / میدان پتانسیل</h2>

          <SliderRow
            id="slider-v0"
            label="ارتفاع / عمق پتانسیل (V₀)"
            value={params.barrierHeight}
            min={-6.0}
            max={15.0}
            step={0.2}
            unit="eV"
            onChange={(val) => onParamChange({ barrierHeight: val }, false)}
          />

          <SliderRow
            id="slider-width"
            label="پهنای سد / چاه"
            value={params.barrierWidth}
            min={0.4}
            max={6.0}
            step={0.1}
            unit="nm"
            onChange={(val) => onParamChange({ barrierWidth: val }, false)}
          />

          <SliderRow
            id="slider-center"
            label="مرکز پتانسیل"
            value={params.barrierCenter}
            min={-12}
            max={12}
            step={0.5}
            unit="nm"
            onChange={(val) => onParamChange({ barrierCenter: val }, false)}
          />
        </section>

        {/* Visualization Options */}
        <section className="space-y-2.5">
          <h2 className="text-xs font-semibold text-slate-300">لایه‌های نمایش گرافیکی</h2>

          <label className="flex items-center justify-between gap-3 py-1 cursor-pointer text-xs text-slate-300">
            <span>چگالی احتمال |ψ(x,t)|²</span>
            <input
              type="checkbox"
              checked={display.showDensity}
              onChange={(e) => onDisplayChange({ showDensity: e.target.checked })}
              className="w-4 h-4 accent-cyan-400 rounded"
            />
          </label>

          <label className="flex items-center justify-between gap-3 py-1 cursor-pointer text-xs text-slate-300">
            <span>بخش‌های حقیقی و موهومی Re(ψ), Im(ψ)</span>
            <input
              type="checkbox"
              checked={display.showRealImag}
              onChange={(e) => onDisplayChange({ showRealImag: e.target.checked })}
              className="w-4 h-4 accent-cyan-400 rounded"
            />
          </label>

          <label className="flex items-center justify-between gap-3 py-1 cursor-pointer text-xs text-slate-300">
            <span>رنگ‌آمیزی فاز موج کوانتومی arg(ψ)</span>
            <input
              type="checkbox"
              checked={display.phaseColoring}
              onChange={(e) => onDisplayChange({ phaseColoring: e.target.checked })}
              className="w-4 h-4 accent-cyan-400 rounded"
            />
          </label>

          <label className="flex items-center justify-between gap-3 py-1 cursor-pointer text-xs text-slate-300">
            <span>مرزهای جاذب (بدون بازگشت از دیواره)</span>
            <input
              type="checkbox"
              checked={params.absorbingBoundaries}
              onChange={(e) => onParamChange({ absorbingBoundaries: e.target.checked }, false)}
              className="w-4 h-4 accent-cyan-400 rounded"
            />
          </label>
        </section>
      </div>
    </aside>
  );
};
