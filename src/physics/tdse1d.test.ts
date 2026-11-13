import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState1D,
  stepState1D,
  computeObservables1D,
  measurePosition1D,
  paintPotential1D,
  DEFAULT_PARAMS_1D,
} from './tdse1d';

test('1D Crank-Nicolson preserves probability norm to high precision', () => {
  const state = createState1D({
    ...DEFAULT_PARAMS_1D,
    preset: 'barrier',
    absorbingBoundaries: false,
  });

  const initialObs = computeObservables1D(state);
  assert.ok(Math.abs(initialObs.norm - 1.0) < 1e-4, `Initial norm=${initialObs.norm}`);

  for (let i = 0; i < 150; i++) {
    stepState1D(state);
  }

  const afterObs = computeObservables1D(state);
  assert.ok(
    Math.abs(afterObs.norm - 1.0) < 1e-4,
    `Norm drifted after 150 steps: ${afterObs.norm}`
  );
  assert.ok(afterObs.time > 2.9, 'Time advanced cleanly');
});

test('Free wavepacket moves at expected group velocity and spreads in deltaX', () => {
  const state = createState1D({
    ...DEFAULT_PARAMS_1D,
    preset: 'free',
    k0: 3.0,
    mass: 1.0,
    x0: -8.0,
    sigma: 1.5,
  });

  const obs0 = computeObservables1D(state);
  for (let i = 0; i < 100; i++) {
    stepState1D(state);
  }
  const obs1 = computeObservables1D(state);

  // Elapsed time t = 100 * 0.02 = 2.0 -> expected displacement ~ k0/m * t = 6.0
  const displacement = obs1.meanX - obs0.meanX;
  assert.ok(
    Math.abs(displacement - 6.0) < 0.35,
    `Expected displacement ~6.0, got ${displacement}`
  );
  assert.ok(
    obs1.deltaX > obs0.deltaX,
    `Expected wavepacket spreading: ${obs0.deltaX} -> ${obs1.deltaX}`
  );
});

test('Higher potential barrier reduces transmission probability', () => {
  const runBarrier = (barrierHeight: number) => {
    const state = createState1D({
      ...DEFAULT_PARAMS_1D,
      preset: 'barrier',
      k0: 3.2,
      x0: -8.0,
      barrierHeight,
      barrierWidth: 1.6,
      barrierCenter: 0,
    });
    for (let i = 0; i < 240; i++) {
      stepState1D(state);
    }
    return computeObservables1D(state);
  };

  const lowBarrier = runBarrier(2.0);
  const highBarrier = runBarrier(12.0);

  assert.ok(
    Math.abs(lowBarrier.reflectionProb + lowBarrier.barrierProb + lowBarrier.transmissionProb - 1.0) < 1e-3,
    'Region probabilities sum to 1'
  );
  assert.ok(
    lowBarrier.transmissionProb > highBarrier.transmissionProb + 0.25,
    `Expected higher transmission for lower barrier: low=${lowBarrier.transmissionProb}, high=${highBarrier.transmissionProb}`
  );
});

test('Born-rule position measurement collapses wavefunction and updates norm', () => {
  const state = createState1D({
    ...DEFAULT_PARAMS_1D,
    preset: 'free',
    sigma: 3.0,
    x0: -2.0,
  });

  const beforeObs = computeObservables1D(state);
  const measuredX = measurePosition1D(state, () => 0.5, 0.5);
  const afterObs = computeObservables1D(state);

  assert.ok(Math.abs(afterObs.norm - 1.0) < 1e-4, 'Collapsed norm is 1');
  assert.ok(
    Math.abs(afterObs.meanX - measuredX) < 0.2,
    `Mean position centered near measurement: ${afterObs.meanX} vs ${measuredX}`
  );
  assert.ok(
    afterObs.deltaX < beforeObs.deltaX * 0.5,
    `Uncertainty collapsed: ${beforeObs.deltaX} -> ${afterObs.deltaX}`
  );
});

test('Custom potential painting modifies potential array and switches preset to custom', () => {
  const state = createState1D(DEFAULT_PARAMS_1D);
  paintPotential1D(state, 5.0, 10.0, 1.5);
  assert.equal(state.params.preset, 'custom');

  // Find grid index nearest to x = 5.0
  let closestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < state.n; i++) {
    const d = Math.abs(state.x[i] - 5.0);
    if (d < bestDist) {
      bestDist = d;
      closestIdx = i;
    }
  }
  assert.ok(state.potential[closestIdx] > 9.0, 'Potential raised at painted coordinate');
});
