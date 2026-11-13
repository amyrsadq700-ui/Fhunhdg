export type PotentialPreset1D =
  | 'barrier'
  | 'double-barrier'
  | 'step'
  | 'harmonic'
  | 'square-well'
  | 'free'
  | 'custom';

export interface SimParams1D {
  preset: PotentialPreset1D;
  k0: number; // Initial momentum (wavevector)
  x0: number; // Initial packet center
  sigma: number; // Initial packet width
  mass: number; // Particle mass (atomic units, hbar = 1)
  barrierHeight: number; // V0
  barrierWidth: number; // Width of barrier / well
  barrierCenter: number; // Center x of barrier
  absorbingBoundaries: boolean;
}

export interface Observables1D {
  time: number;
  norm: number;
  meanX: number;
  deltaX: number;
  meanP: number;
  meanEnergy: number;
  reflectionProb: number;
  barrierProb: number;
  transmissionProb: number;
  maxDensity: number;
}

export interface TelemetryPoint1D {
  time: number;
  transmission: number;
  reflection: number;
  deltaX: number;
}

export interface State1D {
  readonly n: number;
  readonly xMin: number;
  readonly xMax: number;
  readonly dx: number;
  readonly dt: number;
  readonly x: Float64Array;
  readonly psiRe: Float64Array;
  readonly psiIm: Float64Array;
  readonly potential: Float64Array;
  readonly cap: Float64Array; // Complex absorbing potential profile
  params: SimParams1D;
  time: number;
  stepCount: number;
  lastMeasurementX: number | null;
  // Scratch buffers for zero-allocation Thomas algorithm
  privateCPrimeRe: Float64Array;
  privateCPrimeIm: Float64Array;
  privateDPrimeRe: Float64Array;
  privateDPrimeIm: Float64Array;
  privateRhsRe: Float64Array;
  privateRhsIm: Float64Array;
}

export const DEFAULT_PARAMS_1D: SimParams1D = {
  preset: 'barrier',
  k0: 3.2,
  x0: -10.0,
  sigma: 1.8,
  mass: 1.0,
  barrierHeight: 5.5,
  barrierWidth: 1.8,
  barrierCenter: 0.0,
  absorbingBoundaries: false,
};

export function buildPotential1D(
  x: Float64Array,
  params: SimParams1D,
  out: Float64Array
): void {
  const n = x.length;
  const { preset, barrierHeight, barrierWidth, barrierCenter } = params;
  const halfW = barrierWidth * 0.5;

  for (let i = 0; i < n; i++) {
    const xi = x[i];
    let v = 0;

    switch (preset) {
      case 'free': {
        v = 0;
        break;
      }
      case 'barrier': {
        if (Math.abs(xi - barrierCenter) <= halfW) {
          v = barrierHeight;
        }
        break;
      }
      case 'double-barrier': {
        const gap = Math.max(2.0, barrierWidth * 1.6);
        const wSingle = Math.max(0.4, barrierWidth * 0.45);
        if (
          Math.abs(xi - (barrierCenter - gap)) <= wSingle ||
          Math.abs(xi - (barrierCenter + gap)) <= wSingle
        ) {
          v = barrierHeight;
        }
        break;
      }
      case 'step': {
        if (xi >= barrierCenter) {
          v = barrierHeight;
        }
        break;
      }
      case 'harmonic': {
        // V(x) = 0.5 * k * (x - barrierCenter)^2, scaled by barrierHeight
        const kSpring = Math.max(0.02, barrierHeight * 0.035);
        const dxCenter = xi - barrierCenter;
        v = 0.5 * kSpring * dxCenter * dxCenter;
        break;
      }
      case 'square-well': {
        const wellHalf = Math.max(2.5, barrierWidth * 2.5);
        if (Math.abs(xi - barrierCenter) > wellHalf) {
          v = Math.max(2.0, barrierHeight);
        }
        break;
      }
      case 'custom': {
        // Preserve existing potential array for custom painting
        v = out[i];
        break;
      }
    }

    out[i] = v;
  }
}

export function buildCap1D(n: number, x: Float64Array, xMin: number, xMax: number): Float64Array {
  const cap = new Float64Array(n);
  const margin = 4.5;
  const strength = 2.5;
  for (let i = 0; i < n; i++) {
    const dLeft = x[i] - xMin;
    const dRight = xMax - x[i];
    if (dLeft < margin) {
      const s = (margin - dLeft) / margin;
      cap[i] = strength * s * s * s;
    } else if (dRight < margin) {
      const s = (margin - dRight) / margin;
      cap[i] = strength * s * s * s;
    }
  }
  return cap;
}

export function initGaussianWavepacket1D(
  state: State1D,
  x0: number,
  sigma: number,
  k0: number
): void {
  const { n, x, dx, psiRe, psiIm } = state;
  let normSq = 0;
  const invTwoSigmaSq = 1 / (2 * sigma * sigma);

  for (let i = 0; i < n; i++) {
    if (i === 0 || i === n - 1) {
      psiRe[i] = 0;
      psiIm[i] = 0;
      continue;
    }
    const dx0 = x[i] - x0;
    const env = Math.exp(-dx0 * dx0 * invTwoSigmaSq * 0.5);
    const phase = k0 * dx0;
    psiRe[i] = env * Math.cos(phase);
    psiIm[i] = env * Math.sin(phase);
    normSq += (psiRe[i] * psiRe[i] + psiIm[i] * psiIm[i]) * dx;
  }

  const invNorm = normSq > 0 ? 1 / Math.sqrt(normSq) : 1;
  for (let i = 1; i < n - 1; i++) {
    psiRe[i] *= invNorm;
    psiIm[i] *= invNorm;
  }
}

export function createState1D(
  params: SimParams1D = DEFAULT_PARAMS_1D,
  n = 420,
  xMin = -28,
  xMax = 28,
  dt = 0.02
): State1D {
  const dx = (xMax - xMin) / (n - 1);
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = xMin + i * dx;
  }

  const potential = new Float64Array(n);
  buildPotential1D(x, params, potential);

  const state: State1D = {
    n,
    xMin,
    xMax,
    dx,
    dt,
    x,
    psiRe: new Float64Array(n),
    psiIm: new Float64Array(n),
    potential,
    cap: buildCap1D(n, x, xMin, xMax),
    params: { ...params },
    time: 0,
    stepCount: 0,
    lastMeasurementX: null,
    privateCPrimeRe: new Float64Array(n),
    privateCPrimeIm: new Float64Array(n),
    privateDPrimeRe: new Float64Array(n),
    privateDPrimeIm: new Float64Array(n),
    privateRhsRe: new Float64Array(n),
    privateRhsIm: new Float64Array(n),
  };

  initGaussianWavepacket1D(state, params.x0, params.sigma, params.k0);
  return state;
}

export function resetState1D(state: State1D, newParams?: Partial<SimParams1D>): void {
  if (newParams) {
    state.params = { ...state.params, ...newParams };
  }
  if (state.params.preset !== 'custom') {
    buildPotential1D(state.x, state.params, state.potential);
  }
  initGaussianWavepacket1D(
    state,
    state.params.x0,
    state.params.sigma,
    state.params.k0
  );
  state.time = 0;
  state.stepCount = 0;
  state.lastMeasurementX = null;
}

export function updatePotentialParams1D(
  state: State1D,
  newParams: Partial<SimParams1D>
): void {
  state.params = { ...state.params, ...newParams };
  if (state.params.preset !== 'custom') {
    buildPotential1D(state.x, state.params, state.potential);
  }
}

/**
 * Advances the 1D wavefunction by one Crank-Nicolson step of duration dt.
 * Solves (I + i*dt/2 * H) psi^{n+1} = (I - i*dt/2 * H) psi^n
 * using the complex Thomas algorithm with zero heap allocations.
 */
export function stepState1D(state: State1D): void {
  const {
    n,
    dx,
    dt,
    psiRe,
    psiIm,
    potential,
    cap,
    params,
    privateCPrimeRe: cPrimeRe,
    privateCPrimeIm: cPrimeIm,
    privateDPrimeRe: dPrimeRe,
    privateDPrimeIm: dPrimeIm,
    privateRhsRe: rhsRe,
    privateRhsIm: rhsIm,
  } = state;

  const alpha = dt / (4 * params.mass * dx * dx);
  const halfDt = dt * 0.5;
  const useCap = params.absorbingBoundaries;

  // Interior nodes: i = 1 .. n - 2 (with psi[0] = psi[n-1] = 0)
  // Build RHS vector d = (I - i*dt/2 * H) psi^n
  // Note: if absorbing CAP W(x) >= 0 is active, V_eff = V - i*W,
  // so i*dt/2 * (-i*W) = + halfDt * W on LHS and - halfDt * W on RHS.
  for (let i = 1; i < n - 1; i++) {
    const beta = 2 * alpha + halfDt * potential[i];
    const gamma = useCap ? halfDt * cap[i] : 0;

    // (1 - gamma - i*beta) * psi[i] + i*alpha*(psi[i-1] + psi[i+1])
    const pRe = psiRe[i];
    const pIm = psiIm[i];
    const sumNeighRe = psiRe[i - 1] + psiRe[i + 1];
    const sumNeighIm = psiIm[i - 1] + psiIm[i + 1];

    const diagRe = 1 - gamma;
    const diagIm = -beta;

    rhsRe[i] = diagRe * pRe - diagIm * pIm - alpha * sumNeighIm;
    rhsIm[i] = diagRe * pIm + diagIm * pRe + alpha * sumNeighRe;
  }

  // Forward elimination of Thomas algorithm for i = 1 .. n - 2
  // Subdiagonal a = (0, -alpha), Superdiagonal c = (0, -alpha)
  // Diagonal b_i = (1 + gamma_i) + i * (2*alpha + halfDt*V_i)
  const aIm = -alpha;
  const cIm = -alpha;

  {
    const b1Re = 1 + (useCap ? halfDt * cap[1] : 0);
    const b1Im = 2 * alpha + halfDt * potential[1];
    const denom1 = b1Re * b1Re + b1Im * b1Im;

    // c'[1] = (0 + i*cIm) / (b1Re + i*b1Im)
    cPrimeRe[1] = (cIm * b1Im) / denom1;
    cPrimeIm[1] = (cIm * b1Re) / denom1;

    // d'[1] = rhs[1] / b1
    dPrimeRe[1] = (rhsRe[1] * b1Re + rhsIm[1] * b1Im) / denom1;
    dPrimeIm[1] = (rhsIm[1] * b1Re - rhsRe[1] * b1Im) / denom1;
  }

  for (let i = 2; i < n - 1; i++) {
    const biRe = 1 + (useCap ? halfDt * cap[i] : 0);
    const biIm = 2 * alpha + halfDt * potential[i];

    // m = b_i - a_i * c'_{i-1} where a_i = 0 + i*aIm
    // (0 + i*aIm)*(cPrevRe + i*cPrevIm) = -aIm*cPrevIm + i*(aIm*cPrevRe)
    const acRe = -aIm * cPrimeIm[i - 1];
    const acIm = aIm * cPrimeRe[i - 1];
    const mRe = biRe - acRe;
    const mIm = biIm - acIm;
    const mDenom = mRe * mRe + mIm * mIm;

    if (i < n - 2) {
      cPrimeRe[i] = (cIm * mIm) / mDenom;
      cPrimeIm[i] = (cIm * mRe) / mDenom;
    } else {
      cPrimeRe[i] = 0;
      cPrimeIm[i] = 0;
    }

    // num = rhs[i] - a_i * d'_{i-1}
    const adRe = -aIm * dPrimeIm[i - 1];
    const adIm = aIm * dPrimeRe[i - 1];
    const numRe = rhsRe[i] - adRe;
    const numIm = rhsIm[i] - adIm;

    dPrimeRe[i] = (numRe * mRe + numIm * mIm) / mDenom;
    dPrimeIm[i] = (numIm * mRe - numRe * mIm) / mDenom;
  }

  // Back substitution
  psiRe[n - 2] = dPrimeRe[n - 2];
  psiIm[n - 2] = dPrimeIm[n - 2];
  for (let i = n - 3; i >= 1; i--) {
    const nextRe = psiRe[i + 1];
    const nextIm = psiIm[i + 1];
    const cpRe = cPrimeRe[i];
    const cpIm = cPrimeIm[i];
    psiRe[i] = dPrimeRe[i] - (cpRe * nextRe - cpIm * nextIm);
    psiIm[i] = dPrimeIm[i] - (cpRe * nextIm + cpIm * nextRe);
  }

  state.time += dt;
  state.stepCount += 1;
}

export function computeObservables1D(state: State1D): Observables1D {
  const { n, x, dx, psiRe, psiIm, potential, params } = state;
  const halfW = params.barrierWidth * 0.5;
  const leftEdge = params.barrierCenter - halfW;
  const rightEdge = params.barrierCenter + halfW;

  let norm = 0;
  let sumX = 0;
  let sumX2 = 0;
  let sumP = 0;
  let sumE = 0;
  let refl = 0;
  let barr = 0;
  let trans = 0;
  let maxDensity = 0;

  const inv2Dx = 1 / (2 * dx);
  const invDx2 = 1 / (dx * dx);
  const inv2Mass = 1 / (2 * params.mass);

  for (let i = 1; i < n - 1; i++) {
    const re = psiRe[i];
    const im = psiIm[i];
    const prob = re * re + im * im;
    const probDx = prob * dx;

    if (prob > maxDensity) maxDensity = prob;
    norm += probDx;

    const xi = x[i];
    sumX += xi * probDx;
    sumX2 += xi * xi * probDx;

    // Region probabilities relative to barrier
    if (xi < leftEdge) {
      refl += probDx;
    } else if (xi <= rightEdge) {
      barr += probDx;
    } else {
      trans += probDx;
    }

    // Momentum <p> = Im( psi^* dpsi/dx )
    const dRe = (psiRe[i + 1] - psiRe[i - 1]) * inv2Dx;
    const dIm = (psiIm[i + 1] - psiIm[i - 1]) * inv2Dx;
    sumP += (re * dIm - im * dRe) * dx;

    // Energy <H> = <T> + <V>
    const ddRe = (psiRe[i + 1] - 2 * re + psiRe[i - 1]) * invDx2;
    const ddIm = (psiIm[i + 1] - 2 * im + psiIm[i - 1]) * invDx2;
    const kinetic = -inv2Mass * (re * ddRe + im * ddIm);
    const pot = potential[i] * prob;
    sumE += (kinetic + pot) * dx;
  }

  const invNorm = norm > 1e-12 ? 1 / norm : 1;
  const meanX = sumX * invNorm;
  const varianceX = Math.max(0, sumX2 * invNorm - meanX * meanX);
  const deltaX = Math.sqrt(varianceX);

  return {
    time: state.time,
    norm,
    meanX,
    deltaX,
    meanP: sumP * invNorm,
    meanEnergy: sumE * invNorm,
    reflectionProb: refl * invNorm,
    barrierProb: barr * invNorm,
    transmissionProb: trans * invNorm,
    maxDensity,
  };
}

/**
 * Performs a Born-rule position measurement, collapsing the wavefunction into
 * a localized Gaussian around the sampled position x_measured.
 */
export function measurePosition1D(
  state: State1D,
  rng: () => number = Math.random,
  collapseSigma = 0.65
): number {
  const { n, x, dx, psiRe, psiIm } = state;
  let total = 0;
  for (let i = 1; i < n - 1; i++) {
    total += (psiRe[i] * psiRe[i] + psiIm[i] * psiIm[i]) * dx;
  }

  const target = rng() * total;
  let cumulative = 0;
  let measuredX = 0;

  for (let i = 1; i < n - 1; i++) {
    cumulative += (psiRe[i] * psiRe[i] + psiIm[i] * psiIm[i]) * dx;
    if (cumulative >= target) {
      measuredX = x[i];
      break;
    }
  }

  initGaussianWavepacket1D(state, measuredX, collapseSigma, 0);
  state.lastMeasurementX = measuredX;
  return measuredX;
}

/**
 * Modifies potential V(x) smoothly in a brush radius for interactive painting.
 */
export function paintPotential1D(
  state: State1D,
  worldX: number,
  targetV: number,
  brushRadius = 1.4
): void {
  state.params.preset = 'custom';
  const { n, x, potential } = state;
  const clampedV = Math.max(-8, Math.min(18, targetV));
  for (let i = 1; i < n - 1; i++) {
    const dist = Math.abs(x[i] - worldX);
    if (dist <= brushRadius) {
      const weight = 0.5 * (1 + Math.cos((Math.PI * dist) / brushRadius));
      potential[i] = potential[i] * (1 - weight) + clampedV * weight;
    }
  }
}
