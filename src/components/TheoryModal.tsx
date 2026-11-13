import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface TheoryModalProps {
  open: boolean;
  onClose: () => void;
}

export const TheoryModal: React.FC<TheoryModalProps> = ({ open, onClose }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      aria-labelledby="theory-modal-title"
      className="m-auto w-[min(92vw,720px)] max-h-[85vh] rounded-lg border border-slate-700 bg-[#0C111C] text-slate-100 p-0 shadow-2xl backdrop:bg-black/75"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <h2 id="theory-modal-title" className="text-base font-bold text-slate-100">
          مبانی فیزیکی و معادلات شبیه‌سازی
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="بستن پنجره مبانی فیزیکی"
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="p-5 space-y-5 overflow-y-auto max-h-[calc(85vh-64px)] text-sm leading-relaxed text-slate-300">
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-cyan-300">
            ۱. معادله شرودینگر وابسته به زمان (روش کرانک-نیکلسون)
          </h3>
          <p>
            تحول زمانی تابع موج کوانتومی <span dir="ltr" className="font-mono text-slate-100">ψ(x, t)</span> با حل عددی و یکانی (حافظ پایستگی احتمال) معادله شرودینگر محاسبه می‌شود:
          </p>
          <div
            dir="ltr"
            className="px-4 py-2.5 rounded bg-[#07090E] border border-slate-800 font-mono text-xs sm:text-sm text-cyan-200 overflow-x-auto"
          >
            iℏ ∂ψ/∂t = [ -ℏ²/(2m) ∇² + V(x, t) ] ψ(x, t)
          </div>
          <p className="text-xs text-slate-400">
            الگوریتم کرانک-نیکلسون نرم کل احتمال ∫|ψ|²dx را در طول زمان برابر با ۱.۰۰۰۰ نگه می‌دارد.
          </p>
        </section>

        <section className="space-y-2 pt-3 border-t border-slate-800/80">
          <h3 className="text-sm font-semibold text-amber-300">
            ۲. تونل‌زنی کوانتومی و سد پتانسیل
          </h3>
          <p>
            برخلاف مکانیک کلاسیک که در آن ذره با انرژی کمتر از ارتفاع سد (<span dir="ltr" className="font-mono">⟨E⟩ &lt; V₀</span>) به طور کامل بازتاب می‌شود، در مکانیک کوانتومی تابع موج به صورت نمایی داخل سد نفوذ کرده و با احتمال غیرصفر <span dir="ltr" className="font-mono text-cyan-300">T &gt; 0</span> از سد عبور می‌کند.
          </p>
        </section>

        <section className="space-y-2 pt-3 border-t border-slate-800/80">
          <h3 className="text-sm font-semibold text-cyan-300">
            ۳. اصل عدم قطعیت و فروپاشی تابع موج (قاعده بورن)
          </h3>
          <p>
            پهنای مکانی <span dir="ltr" className="font-mono">Δx</span> و عدم قطعیت تکانه <span dir="ltr" className="font-mono">Δp</span> همواره در نامساوی هایزنبرگ صدق می‌کنند:
          </p>
          <div
            dir="ltr"
            className="px-4 py-2.5 rounded bg-[#07090E] border border-slate-800 font-mono text-xs sm:text-sm text-slate-200"
          >
            Δx · Δp ≥ ℏ / 2
          </div>
          <p className="text-xs text-slate-400">
            هنگام فشردن دکمه «اندازه‌گیری مکان ذره»، مکان بر اساس توزیع احتمال |ψ(x,t)|² نمونه‌برداری شده و تابع موج در آن نقطه متمرکز می‌شود؛ بلافاصله پس از فروپاشی، به دلیل افزایش Δp، بسته موج دوباره پخش می‌شود.
          </p>
        </section>

        <section className="space-y-2 pt-3 border-t border-slate-800/80">
          <h3 className="text-sm font-semibold text-cyan-300">
            ۴. آزمایش دوشکاف و کاهش همدوسی (Which-Path)
          </h3>
          <p>
            در حالت دو بعدی، موج پس از عبور از دو شکاف با خود تداخل کرده و نوارهای روشن و تاریک سازنده/مخرب روی پرده آشکارساز تشکیل می‌دهد. با فعال کردن «آشکارساز مسیر»، فاز نسبی بین دو مسیر از بین رفته و الگوی تداخلی به جمع کلاسیک دو تک‌شکاف تبدیل می‌شود.
          </p>
        </section>
      </div>
    </dialog>
  );
};
