import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState2D,
  stepState2D,
  computeObservables2D,
  DEFAULT_PARAMS_2D,
} from './tdse2d';

test('2D ADI Crank-Nicolson preserves norm without absorbing sponge', () => {
  const state = createState2D({ ...DEFAULT_PARAMS_2D }, 80, 60, 0.22, 0.22, 0.015);
  const obs0 = computeObservables2D(state);
  assert.ok(Math.abs(obs0.norm - 1.0) < 1e-3, `Initial 2D norm=${obs0.norm}`);

  for (let i = 0; i < 40; i++) {
    stepState2D(state, false);
  }

  const obs1 = computeObservables2D(state);
  assert.ok(
    Math.abs(obs1.norm - 1.0) < 1e-3,
    `2D norm drifted without sponge: ${obs1.norm}`
  );
});

test('2D double-slit barrier has symmetric slit openings and propagates wave to detector screen', () => {
  const state = createState2D(
    {
      ...DEFAULT_PARAMS_2D,
      kx: 5.5,
      slitSeparation: 14,
      slitWidth: 6,
      barrierHeight: 50,
    },
    100,
    72,
    0.2,
    0.2,
    0.015
  );

  // Verify double-slit barrier symmetry along y at barrierXIndex
  const bx = state.barrierXIndex;
  const midY = (state.ny - 1) * 0.5;
  assert.ok(
    state.potentialBoth[Math.round(midY) * state.nx + bx] > 40,
    'Center between slits is blocked by barrier'
  );
  const topSlitY = Math.round(midY - state.params.slitSeparation * 0.5);
  const botSlitY = Math.round(midY + state.params.slitSeparation * 0.5);
  assert.equal(state.potentialBoth[topSlitY * state.nx + bx], 0, 'Top slit is open');
  assert.equal(state.potentialBoth[botSlitY * state.nx + bx], 0, 'Bottom slit is open');

  // Run enough steps for wavepacket to reach detector screen
  for (let i = 0; i < 180; i++) {
    stepState2D(state, true);
  }
  const obs = computeObservables2D(state);
  assert.ok(
    obs.screenTotalIntensity > 1e-4,
    `Detector screen accumulated intensity: ${obs.screenTotalIntensity}`
  );
});

test('2D which-path detector mode evolves both channels cleanly', () => {
  const state = createState2D(
    {
      ...DEFAULT_PARAMS_2D,
      whichPathDetector: true,
      kx: 5.0,
    },
    90,
    64,
    0.2,
    0.2,
    0.015
  );

  for (let i = 0; i < 120; i++) {
    stepState2D(state, true);
  }

  const obs = computeObservables2D(state);
  assert.ok(obs.norm > 0.1 && obs.norm <= 1.01, `Valid norm under which-path=${obs.norm}`);
  assert.ok(Number.isFinite(obs.fringeVisibility), 'Fringe visibility is finite');
});
