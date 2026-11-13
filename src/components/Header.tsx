import React from 'react';
import { RotateCcw } from 'lucide-react';

export type SimMode = '1d' | '2d';

interface HeaderProps {
  mode: SimMode;
  onModeChange: (mode: SimMode) => void;
  onOpenTheory: () => void;
  onReset: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  onModeChange,
  onOpenTheory,
  onReset,
}) => {
  return (
    <header className="flex items-center justify-between gap-2 sm:gap-8 px-3 sm:px-6 h-14 shrink-0 border-b border-slate-800 bg-[#07090E]">
      {/* Zone 1: Single-line brand wordmark */}
      <span className="text-sm sm:text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0">
        آزمایشگاه کوانتوم
      </span>

      {/* Zone 2: Concise single-line navigation links */}
      <nav aria-label="بخش‌های شبیه‌ساز" className="flex items-center gap-3 sm:gap-6">
        <button
          type="button"
          onClick={() => onModeChange('1d')}
          aria-current={mode === '1d' ? 'page' : undefined}
          className={`relative py-4 text-[11px] sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-cyan-400 ${
            mode === '1d'
              ? 'text-cyan-400'
              : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          <span className="hidden sm:inline">بسته موج و تونل‌زنی</span>
          <span className="sm:hidden">یک‌بعدی</span>
          {mode === '1d' && (
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-0.5 bg-cyan-400"
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => onModeChange('2d')}
          aria-current={mode === '2d' ? 'page' : undefined}
          className={`relative py-4 text-[11px] sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-cyan-400 ${
            mode === '2d'
              ? 'text-cyan-400'
              : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          <span className="hidden sm:inline">آزمایش دوشکاف</span>
          <span className="sm:hidden">دوشکاف</span>
          {mode === '2d' && (
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-0.5 bg-cyan-400"
            />
          )}
        </button>

        <button
          type="button"
          onClick={onOpenTheory}
          className="py-4 text-[11px] sm:text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-cyan-400"
        >
          <span className="hidden sm:inline">مبانی فیزیکی</span>
          <span className="sm:hidden">مبانی</span>
        </button>
      </nav>

      {/* Zone 3: Single primary action */}
      <div className="shrink-0">
        <button
          type="button"
          onClick={onReset}
          aria-label="بازنشانی شبیه‌سازی"
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-4 py-2 text-xs font-medium text-slate-950 bg-cyan-400 rounded-md hover:bg-cyan-300 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">بازنشانی شبیه‌سازی</span>
          <span className="sm:hidden">بازنشانی</span>
        </button>
      </div>
    </header>
  );
};
