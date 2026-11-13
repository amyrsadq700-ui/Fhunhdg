import { useCallback, useEffect, useRef, useState } from 'react';
import { Header, SimMode } from './components/Header';
import { Canvas1D } from './components/Canvas1D';
import { Canvas2D } from './components/Canvas2D';
import { Controls1D, DisplayOptions1D } from './components/Controls1D';
import { Controls2D, DisplayOptions2D } from './components/Controls2D';
import { TelemetryTray } from './components/TelemetryTray';
import { TheoryModal } from './components/TheoryModal';
import {
  DEFAULT_PARAMS_1D,
  Observables1D,
  PotentialPreset1D,
  SimParams1D,
  State1D,
  TelemetryPoint1D,
  computeObservables1D,
  createState1D,
  measurePosition1D,
  resetState1D,
  stepState1D,
  updatePotentialParams1D,
} from './physics/tdse1d';
import {
  DEFAULT_PARAMS_2D,
  Observables2D,
  SimParams2D,
  State2D,
  computeObservables2D,
  createState2D,
  resetState2D,
  stepState2D,
  updateGeometry2D,
} from './physics/tdse2d';

const PRESET_LABELS: Record<PotentialPreset1D, string> = {
  barrier: 'سد پتانسیل (تونل‌زنی)',
  'double-barrier': 'سد دوتایی تشدیدی',
  step: 'پتانسیل پله‌ای',
  harmonic: 'نوسانگر هماهنگ',
  'square-well': 'چاه پتانسیل متناهی',
  free: 'ذره آزاد',
  custom: 'پتانسیل سفارشی',
};

export default function App() {
  const [mode, setMode] = useState<SimMode>('1d');
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(1);
  const [theoryOpen, setTheoryOpen] = useState<boolean>(false);
  const [renderTick, setRenderTick] = useState<number>(0);

  // 1D State & Params
  const [params1D, setParams1D] = useState<SimParams1D>(DEFAULT_PARAMS_1D);
  const [display1D, setDisplay1D] = useState<DisplayOptions1D>({
    showDensity: true,
    showRealImag: false,
    phaseColoring: false,
    drawMode: false,
  });
  const state1DRef = useRef<State1D>(createState1D(DEFAULT_PARAMS_1D));
  const obs1DRef = useRef<Observables1D>(computeObservables1D(state1DRef.current));
  const [obs1D, setObs1D] = useState<Observables1D>(obs1DRef.current);
  const [history1D, setHistory1D] = useState<TelemetryPoint1D[]>([
    {
      time: obs1DRef.current.time,
      transmission: obs1DRef.current.transmissionProb,
      reflection: obs1DRef.current.reflectionProb,
      deltaX: obs1DRef.current.deltaX,
    },
  ]);

  // 2D State & Params
  const [params2D, setParams2D] = useState<SimParams2D>(DEFAULT_PARAMS_2D);
  const [display2D, setDisplay2D] = useState<DisplayOptions2D>({
    colorMode: 'density',
  });
  const state2DRef = useRef<State2D>(createState2D(DEFAULT_PARAMS_2D));
  const obs2DRef = useRef<Observables2D>(computeObservables2D(state2DRef.current));
  const [obs2D, setObs2D] = useState<Observables2D>(obs2DRef.current);

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;
  const speedRef = useRef(speed);
  speedRef.current = speed;

  // Main physics simulation loop (throttles React UI commits to ~12 Hz)
  useEffect(() => {
    let rafId = 0;
    let lastUiSync = 0;

    const tick = (now: number) => {
      if (isRunningRef.current) {
        const sp = speedRef.current;
        if (modeRef.current === '1d') {
          const steps = sp < 1 ? 1 : sp > 1 ? 4 : 2;
          for (let i = 0; i < steps; i++) {
            stepState1D(state1DRef.current);
          }
          obs1DRef.current = computeObservables1D(state1DRef.current);

          if (now - lastUiSync >= 85) {
            lastUiSync = now;
            const snap = obs1DRef.current;
            setObs1D(snap);
            setHistory1D((prev) => {
              const next = [
                ...prev,
                {
                  time: snap.time,
                  transmission: snap.transmissionProb,
                  reflection: snap.reflectionProb,
                  deltaX: snap.deltaX,
                },
              ];
              return next.length > 90 ? next.slice(next.length - 90) : next;
            });
          }
        } else {
          const steps = sp < 1 ? 1 : sp > 1 ? 5 : 3;
          for (let i = 0; i < steps; i++) {
            stepState2D(state2DRef.current, true);
          }
          obs2DRef.current = computeObservables2D(state2DRef.current);

          if (now - lastUiSync >= 95) {
            lastUiSync = now;
            setObs2D(obs2DRef.current);
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const syncObservablesNow = useCallback(() => {
    if (modeRef.current === '1d') {
      const snap = computeObservables1D(state1DRef.current);
      obs1DRef.current = snap;
      setObs1D(snap);
    } else {
      const snap = computeObservables2D(state2DRef.current);
      obs2DRef.current = snap;
      setObs2D(snap);
    }
    setRenderTick((t) => t + 1);
  }, []);

  const handleReset = useCallback(() => {
    if (modeRef.current === '1d') {
      resetState1D(state1DRef.current);
      const snap = computeObservables1D(state1DRef.current);
      obs1DRef.current = snap;
      setObs1D(snap);
      setHistory1D([
        {
          time: snap.time,
          transmission: snap.transmissionProb,
          reflection: snap.reflectionProb,
          deltaX: snap.deltaX,
        },
      ]);
    } else {
      resetState2D(state2DRef.current);
      const snap = computeObservables2D(state2DRef.current);
      obs2DRef.current = snap;
      setObs2D(snap);
    }
    setRenderTick((t) => t + 1);
  }, []);

  const handleStep = useCallback(() => {
    if (modeRef.current === '1d') {
      stepState1D(state1DRef.current);
      const snap = computeObservables1D(state1DRef.current);
      obs1DRef.current = snap;
      setObs1D(snap);
      setHistory1D((prev) => {
        const next = [
          ...prev,
          {
            time: snap.time,
            transmission: snap.transmissionProb,
            reflection: snap.reflectionProb,
            deltaX: snap.deltaX,
          },
        ];
        return next.length > 90 ? next.slice(next.length - 90) : next;
      });
    } else {
      stepState2D(state2DRef.current, true);
      const snap = computeObservables2D(state2DRef.current);
      obs2DRef.current = snap;
      setObs2D(snap);
    }
    setRenderTick((t) => t + 1);
  }, []);

  // 1D handlers
  const handleParamChange1D = useCallback(
    (patch: Partial<SimParams1D>, resetWavepacket = false) => {
      setParams1D((prev) => {
        const next = { ...prev, ...patch };
        if (resetWavepacket) {
          resetState1D(state1DRef.current, next);
          const snap = computeObservables1D(state1DRef.current);
          obs1DRef.current = snap;
          setObs1D(snap);
          setHistory1D([
            {
              time: snap.time,
              transmission: snap.transmissionProb,
              reflection: snap.reflectionProb,
              deltaX: snap.deltaX,
            },
          ]);
        } else {
          updatePotentialParams1D(state1DRef.current, next);
          const snap = computeObservables1D(state1DRef.current);
          obs1DRef.current = snap;
          setObs1D(snap);
        }
        setRenderTick((t) => t + 1);
        return next;
      });
    },
    []
  );

  const handlePresetChange1D = useCallback((preset: PotentialPreset1D) => {
    setParams1D((prev) => {
      let overrides: Partial<SimParams1D> = { preset };
      if (preset === 'harmonic') {
        overrides = {
          preset,
          x0: -6.5,
          k0: 0.0,
          sigma: 1.6,
          barrierHeight: 5.0,
          barrierCenter: 0,
        };
      } else if (preset === 'square-well') {
        overrides = {
          preset,
          x0: -2.0,
          k0: 2.2,
          sigma: 1.4,
          barrierHeight: 10.0,
          barrierWidth: 3.2,
          barrierCenter: 0,
        };
      } else if (preset === 'barrier' || preset === 'double-barrier' || preset === 'step') {
        overrides = {
          preset,
          x0: -10.0,
          k0: 3.2,
          sigma: 1.8,
          barrierHeight: 5.5,
          barrierWidth: 1.8,
          barrierCenter: 0,
        };
      } else if (preset === 'free') {
        overrides = {
          preset,
          x0: -10.0,
          k0: 2.8,
          sigma: 1.5,
        };
      }
      const next = { ...prev, ...overrides };
      resetState1D(state1DRef.current, next);
      const snap = computeObservables1D(state1DRef.current);
      obs1DRef.current = snap;
      setObs1D(snap);
      setHistory1D([
        {
          time: snap.time,
          transmission: snap.transmissionProb,
          reflection: snap.reflectionProb,
          deltaX: snap.deltaX,
        },
      ]);
      setDisplay1D((d) => ({ ...d, drawMode: preset === 'custom' }));
      setRenderTick((t) => t + 1);
      return next;
    });
  }, []);

  const handleMeasure1D = useCallback(() => {
    measurePosition1D(state1DRef.current);
    syncObservablesNow();
  }, [syncObservablesNow]);

  const handleClearCustomPotential = useCallback(() => {
    state1DRef.current.potential.fill(0);
    syncObservablesNow();
  }, [syncObservablesNow]);

  const handlePotentialPainted = useCallback(() => {
    if (params1D.preset !== 'custom') {
      setParams1D((prev) => ({ ...prev, preset: 'custom' }));
    }
    obs1DRef.current = computeObservables1D(state1DRef.current);
    setObs1D(obs1DRef.current);
  }, [params1D.preset]);

  // 2D handlers
  const handleParamChange2D = useCallback(
    (patch: Partial<SimParams2D>, resetWave = false) => {
      setParams2D((prev) => {
        const next = { ...prev, ...patch };
        if (resetWave) {
          resetState2D(state2DRef.current, next);
        } else {
          updateGeometry2D(state2DRef.current, next);
        }
        const snap = computeObservables2D(state2DRef.current);
        obs2DRef.current = snap;
        setObs2D(snap);
        setRenderTick((t) => t + 1);
        return next;
      });
    },
    []
  );

  const currentStep =
    mode === '1d' ? state1DRef.current.stepCount : state2DRef.current.stepCount;

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col bg-[#07090E] text-slate-100">
      <Header
        mode={mode}
        onModeChange={(nextMode) => {
          setMode(nextMode);
          setRenderTick((t) => t + 1);
        }}
        onOpenTheory={() => setTheoryOpen(true)}
        onReset={handleReset}
      />

      <main
        data-sim-mode={mode}
        data-sim-running={isRunning ? 'true' : 'false'}
        data-sim-step={currentStep}
        className="flex-1 flex flex-col min-h-0"
      >
        {/* Asymmetric Split Console */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* Primary Visualization Viewport */}
          <section
            aria-label="نمای گرافیکی شبیه‌سازی کوانتومی"
            className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#090D16]"
          >
            {/* Compact Viewport Status Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-2 border-b border-slate-800/80 bg-[#0A0F1A] shrink-0">
              <div className="flex items-center gap-2.5 text-xs text-slate-300">
                <span
                  className={`font-medium ${
                    isRunning ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {isRunning ? '● در حال اجرا' : '⏸ متوقف'}
                </span>
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
                <span className="text-slate-200 font-medium">
                  {mode === '1d'
                    ? PRESET_LABELS[params1D.preset]
                    : params2D.whichPathDetector
                    ? 'آزمایش دوشکاف · آشکارساز مسیر فعال'
                    : 'آزمایش دوشکاف · برهم‌نهی همدوس'}
                </span>
              </div>

              <div dir="ltr" className="font-mono text-xs text-slate-400 tabular-nums">
                t = {(mode === '1d' ? obs1D.time : obs2D.time).toFixed(2)} fs
              </div>
            </div>

            {/* Canvas Stage */}
            <div className="flex-1 relative min-h-[300px] lg:min-h-0">
              {mode === '1d' ? (
                <Canvas1D
                  stateRef={state1DRef}
                  observablesRef={obs1DRef}
                  display={display1D}
                  renderTick={renderTick}
                  onPotentialPainted={handlePotentialPainted}
                />
              ) : (
                <Canvas2D
                  stateRef={state2DRef}
                  observablesRef={obs2DRef}
                  display={display2D}
                  renderTick={renderTick}
                />
              )}
            </div>
          </section>

          {/* Parameter Control Deck */}
          {mode === '1d' ? (
            <Controls1D
              params={params1D}
              display={display1D}
              isRunning={isRunning}
              speed={speed}
              onParamChange={handleParamChange1D}
              onPresetChange={handlePresetChange1D}
              onDisplayChange={(patch) =>
                setDisplay1D((prev) => ({ ...prev, ...patch }))
              }
              onToggleRun={() => setIsRunning((r) => !r)}
              onStep={handleStep}
              onSpeedChange={setSpeed}
              onMeasure={handleMeasure1D}
              onClearCustomPotential={handleClearCustomPotential}
            />
          ) : (
            <Controls2D
              params={params2D}
              display={display2D}
              isRunning={isRunning}
              speed={speed}
              onParamChange={handleParamChange2D}
              onDisplayChange={(patch) =>
                setDisplay2D((prev) => ({ ...prev, ...patch }))
              }
              onToggleRun={() => setIsRunning((r) => !r)}
              onStep={handleStep}
              onSpeedChange={setSpeed}
            />
          )}
        </div>

        {/* Bottom Real-Time Telemetry & Time-Series Tray */}
        {mode === '1d' ? (
          <TelemetryTray
            mode="1d"
            observables={obs1D}
            history={history1D}
            lastMeasurementX={state1DRef.current.lastMeasurementX}
          />
        ) : (
          <TelemetryTray
            mode="2d"
            observables={obs2D}
            whichPathDetector={params2D.whichPathDetector}
          />
        )}
      </main>

      <TheoryModal open={theoryOpen} onClose={() => setTheoryOpen(false)} />
    </div>
  );
}
