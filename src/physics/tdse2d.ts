export interface SimParams2D {
  kx: number; // Incident wavevector along x
  slitSeparation: number; // Distance between centers of the two slits (grid units)
  slitWidth: number; // Aperture width of each slit (grid units)
  barrierHeight: number; // Potential V0 of the double-slit wall
  whichPathDetector: boolean; // Decoherence / measurement of which slit the particle passes through
}

export interface Observables2D {
  time: number;
  norm: number;
  screenTotalIntensity: number;
  maxDensity: number;
  fringeVisibility: number;
}

export interface State2D {
  readonly nx: number;
  readonly ny: number;
  readonly dx: number;
  readonly dy: number;
  readonly dt: number;
  readonly barrierXIndex: number;
  readonly screenXIndex: number;
  // Coherent wavefunction (when whichPathDetector === false)
  readonly psiRe: Float64Array;
  readonly psiIm: Float64Array;
  // Incoherent channel wavefunctions (when whichPathDetector === true)
  readonly psiTopRe: Float64Array;
  readonly psiTopIm: Float64Array;
  readonly psiBotRe: Float64Array;
  readonly psiBotIm: Float64Array;
  // Potentials & absorbing sponge
  readonly potentialBoth: Float64Array;
  readonly potentialTopOnly: Float64Array;
  readonly potentialBotOnly: Float64Array;
  readonly sponge: Float64Array;
  // Accumulated detector screen profile along y
  readonly screenIntensity: Float64Array;
  // Precomputed Thomas multipliers for constant X and Y kinetic tridiagonal matrices
  readonly cPrimeXRe: Float64Array;
  readonly cPrimeXIm: Float64Array;
  readonly invDenomXRe: Float64Array;
  readonly invDenomXIm: Float64Array;
  readonly cPrimeYRe: Float64Array;
  readonly cPrimeYIm: Float64Array;
  readonly invDenomYRe: Float64Array;
  readonly invDenomYIm: Float64Array;
  // Scratch line buffers
  readonly lineRhsRe: Float64Array;
  readonly lineRhsIm: Float64Array;
  readonly lineSolRe: Float64Array;
  readonly lineSolIm: Float64Array;
  params: SimParams2D;
  time: number;
  stepCount: number;
}

export const DEFAULT_PARAMS_2D: SimParams2D = {
  kx: 4.0,
  slitSeparation: 18,
  slitWidth: 7,
  barrierHeight: 45,
  whichPathDetector: false,
};

function precomputeConstantThomas(
  n: number,
  alpha: number
): {
  cPrimeRe: Float64Array;
  cPrimeIm: Float64Array;
  invDenomRe: Float64Array;
  invDenomIm: Float64Array;
} {
  const cPrimeRe = new Float64Array(n);
  const cPrimeIm = new Float64Array(n);
  const invDenomRe = new Float64Array(n);
  const invDenomIm = new Float64Array(n);

  // Matrix M: subdiagonal = -i*alpha, diag = 1 + 2i*alpha, superdiagonal = -i*alpha
  const aIm = -alpha;
  const cIm = -alpha;
  const bRe = 1.0;
  const bIm = 2.0 * alpha;

  const d1 = bRe * bRe + bIm * bIm;
  invDenomRe[1] = bRe / d1;
  invDenomIm[1] = -bIm / d1;
  cPrimeRe[1] = (cIm * bIm) / d1;
  cPrimeIm[1] = (cIm * bRe) / d1;

  for (let i = 2; i < n - 1; i++) {
    const acRe = -aIm * cPrimeIm[i - 1];
    const acIm = aIm * cPrimeRe[i - 1];
    const mRe = bRe - acRe;
    const mIm = bIm - acIm;
    const mDen = mRe * mRe + mIm * mIm;

    invDenomRe[i] = mRe / mDen;
    invDenomIm[i] = -mIm / mDen;

    if (i < n - 2) {
      cPrimeRe[i] = (cIm * mIm) / mDen;
      cPrimeIm[i] = (cIm * mRe) / mDen;
    }
  }

  return { cPrimeRe, cPrimeIm, invDenomRe, invDenomIm };
}

export function buildDoubleSlitPotentials(
  nx: number,
  ny: number,
  barrierXIndex: number,
  params: SimParams2D,
  potBoth: Float64Array,
  potTopOnly: Float64Array,
  potBotOnly: Float64Array
): void {
  potBoth.fill(0);
  potTopOnly.fill(0);
  potBotOnly.fill(0);

  const halfWallThickness = 1; // 3 cells thick wall
  const midY = (ny - 1) * 0.5;
  const halfSep = params.slitSeparation * 0.5;
  const halfSlit = params.slitWidth * 0.5;
  const topCenter = midY - halfSep;
  const botCenter = midY + halfSep;

  for (let ix = barrierXIndex - halfWallThickness; ix <= barrierXIndex + halfWallThickness; ix++) {
    if (ix <= 1 || ix >= nx - 2) continue;
    for (let iy = 1; iy < ny - 1; iy++) {
      const inTopSlit = Math.abs(iy - topCenter) <= halfSlit;
      const inBotSlit = Math.abs(iy - botCenter) <= halfSlit;
      const idx = iy * nx + ix;

      potBoth[idx] = inTopSlit || inBotSlit ? 0 : params.barrierHeight;
      potTopOnly[idx] = inTopSlit ? 0 : params.barrierHeight;
      potBotOnly[idx] = inBotSlit ? 0 : params.barrierHeight;
    }
  }
}

function initGaussian2D(
  nx: number,
  ny: number,
  dx: number,
  dy: number,
  kx: number,
  outRe: Float64Array,
  outIm: Float64Array
): void {
  const x0 = nx * dx * 0.25;
  const y0 = ny * dy * 0.5;
  const sigmaX = 1.65;
  const sigmaY = 3.2;
  let normSq = 0;

  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const idx = iy * nx + ix;
      if (ix === 0 || ix === nx - 1 || iy === 0 || iy === ny - 1) {
        outRe[idx] = 0;
        outIm[idx] = 0;
        continue;
      }
      const x = ix * dx - x0;
      const y = iy * dy - y0;
      const env = Math.exp(
        -0.25 * ((x * x) / (sigmaX * sigmaX) + (y * y) / (sigmaY * sigmaY))
      );
      const phase = kx * x;
      outRe[idx] = env * Math.cos(phase);
      outIm[idx] = env * Math.sin(phase);
      normSq += (outRe[idx] * outRe[idx] + outIm[idx] * outIm[idx]) * dx * dy;
    }
  }

  const invNorm = normSq > 0 ? 1 / Math.sqrt(normSq) : 1;
  for (let i = 0; i < nx * ny; i++) {
    outRe[i] *= invNorm;
    outIm[i] *= invNorm;
  }
}

export function createState2D(
  params: SimParams2D = DEFAULT_PARAMS_2D,
  nx = 136,
  ny = 96,
  dx = 0.2,
  dy = 0.2,
  dt = 0.015
): State2D {
  const total = nx * ny;
  const barrierXIndex = Math.floor(nx * 0.44);
  const screenXIndex = nx - 12;

  const alphaX = dt / (4 * dx * dx);
  const alphaY = dt / (4 * dy * dy);
  const thomasX = precomputeConstantThomas(nx, alphaX);
  const thomasY = precomputeConstantThomas(ny, alphaY);

  const potentialBoth = new Float64Array(total);
  const potentialTopOnly = new Float64Array(total);
  const potentialBotOnly = new Float64Array(total);
  buildDoubleSlitPotentials(
    nx,
    ny,
    barrierXIndex,
    params,
    potentialBoth,
    potentialTopOnly,
    potentialBotOnly
  );

  // Subtle boundary sponge near outer edges (prevents harsh wall echoes at detector screen)
  const sponge = new Float64Array(total);
  sponge.fill(1.0);
  const margin = 8;
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const d = Math.min(ix, nx - 1 - ix, iy, ny - 1 - iy);
      if (d < margin) {
        const s = (margin - d) / margin;
        sponge[iy * nx + ix] = Math.exp(-0.08 * s * s);
      }
    }
  }

  const maxDim = Math.max(nx, ny);
  const state: State2D = {
    nx,
    ny,
    dx,
    dy,
    dt,
    barrierXIndex,
    screenXIndex,
    psiRe: new Float64Array(total),
    psiIm: new Float64Array(total),
    psiTopRe: new Float64Array(total),
    psiTopIm: new Float64Array(total),
    psiBotRe: new Float64Array(total),
    psiBotIm: new Float64Array(total),
    potentialBoth,
    potentialTopOnly,
    potentialBotOnly,
    sponge,
    screenIntensity: new Float64Array(ny),
    cPrimeXRe: thomasX.cPrimeRe,
    cPrimeXIm: thomasX.cPrimeIm,
    invDenomXRe: thomasX.invDenomRe,
    invDenomXIm: thomasX.invDenomIm,
    cPrimeYRe: thomasY.cPrimeRe,
    cPrimeYIm: thomasY.cPrimeIm,
    invDenomYRe: thomasY.invDenomRe,
    invDenomYIm: thomasY.invDenomIm,
    lineRhsRe: new Float64Array(maxDim),
    lineRhsIm: new Float64Array(maxDim),
    lineSolRe: new Float64Array(maxDim),
    lineSolIm: new Float64Array(maxDim),
    params: { ...params },
    time: 0,
    stepCount: 0,
  };

  initGaussian2D(nx, ny, dx, dy, params.kx, state.psiRe, state.psiIm);
  state.psiTopRe.set(state.psiRe);
  state.psiTopIm.set(state.psiIm);
  state.psiBotRe.set(state.psiRe);
  state.psiBotIm.set(state.psiIm);

  return state;
}

export function resetState2D(state: State2D, newParams?: Partial<SimParams2D>): void {
  if (newParams) {
    state.params = { ...state.params, ...newParams };
  }
  buildDoubleSlitPotentials(
    state.nx,
    state.ny,
    state.barrierXIndex,
    state.params,
    state.potentialBoth,
    state.potentialTopOnly,
    state.potentialBotOnly
  );
  initGaussian2D(
    state.nx,
    state.ny,
    state.dx,
    state.dy,
    state.params.kx,
    state.psiRe,
    state.psiIm
  );
  state.psiTopRe.set(state.psiRe);
  state.psiTopIm.set(state.psiIm);
  state.psiBotRe.set(state.psiRe);
  state.psiBotIm.set(state.psiIm);
  state.screenIntensity.fill(0);
  state.time = 0;
  state.stepCount = 0;
}

export function updateGeometry2D(
  state: State2D,
  newParams: Partial<SimParams2D>
): void {
  state.params = { ...state.params, ...newParams };
  buildDoubleSlitPotentials(
    state.nx,
    state.ny,
    state.barrierXIndex,
    state.params,
    state.potentialBoth,
    state.potentialTopOnly,
    state.potentialBotOnly
  );
}

function advanceSingleWavefunction2D(
  state: State2D,
  psiRe: Float64Array,
  psiIm: Float64Array,
  potential: Float64Array,
  applySponge: boolean
): void {
  const {
    nx,
    ny,
    dx,
    dy,
    dt,
    sponge,
    cPrimeXRe,
    cPrimeXIm,
    invDenomXRe,
    invDenomXIm,
    cPrimeYRe,
    cPrimeYIm,
    invDenomYRe,
    invDenomYIm,
    lineRhsRe,
    lineRhsIm,
    lineSolRe,
    lineSolIm,
  } = state;

  const halfDt = dt * 0.5;
  const alphaX = dt / (4 * dx * dx);
  const alphaY = dt / (4 * dy * dy);
  const total = nx * ny;

  // 1. Half potential phase rotation: exp(-i * V * dt / 2)
  for (let i = 0; i < total; i++) {
    const angle = -potential[i] * halfDt;
    if (angle !== 0) {
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const r = psiRe[i];
      const im = psiIm[i];
      psiRe[i] = r * cosA - im * sinA;
      psiIm[i] = r * sinA + im * cosA;
    }
  }

  // 2. Full Crank-Nicolson step along X for every row iy = 1..ny-2
  const twoAlphaX = 2 * alphaX;
  const aImX = -alphaX;
  for (let iy = 1; iy < ny - 1; iy++) {
    const rowOff = iy * nx;
    for (let ix = 1; ix < nx - 1; ix++) {
      const idx = rowOff + ix;
      const pRe = psiRe[idx];
      const pIm = psiIm[idx];
      const nRe = psiRe[idx - 1] + psiRe[idx + 1];
      const nIm = psiIm[idx - 1] + psiIm[idx + 1];
      lineRhsRe[ix] = pRe + twoAlphaX * pIm - alphaX * nIm;
      lineRhsIm[ix] = pIm - twoAlphaX * pRe + alphaX * nRe;
    }

    // Forward Thomas
    lineSolRe[1] = lineRhsRe[1] * invDenomXRe[1] - lineRhsIm[1] * invDenomXIm[1];
    lineSolIm[1] = lineRhsRe[1] * invDenomXIm[1] + lineRhsIm[1] * invDenomXRe[1];

    for (let ix = 2; ix < nx - 1; ix++) {
      const numRe = lineRhsRe[ix] + aImX * lineSolIm[ix - 1];
      const numIm = lineRhsIm[ix] - aImX * lineSolRe[ix - 1];
      lineSolRe[ix] = numRe * invDenomXRe[ix] - numIm * invDenomXIm[ix];
      lineSolIm[ix] = numRe * invDenomXIm[ix] + numIm * invDenomXRe[ix];
    }

    // Back substitution
    psiRe[rowOff + nx - 2] = lineSolRe[nx - 2];
    psiIm[rowOff + nx - 2] = lineSolIm[nx - 2];
    for (let ix = nx - 3; ix >= 1; ix--) {
      const nextRe = psiRe[rowOff + ix + 1];
      const nextIm = psiIm[rowOff + ix + 1];
      psiRe[rowOff + ix] = lineSolRe[ix] - (cPrimeXRe[ix] * nextRe - cPrimeXIm[ix] * nextIm);
      psiIm[rowOff + ix] = lineSolIm[ix] - (cPrimeXRe[ix] * nextIm + cPrimeXIm[ix] * nextRe);
    }
  }

  // 3. Full Crank-Nicolson step along Y for every column ix = 1..nx-2
  const twoAlphaY = 2 * alphaY;
  const aImY = -alphaY;
  for (let ix = 1; ix < nx - 1; ix++) {
    for (let iy = 1; iy < ny - 1; iy++) {
      const idx = iy * nx + ix;
      const idxPrev = idx - nx;
      const idxNext = idx + nx;
      const pRe = psiRe[idx];
      const pIm = psiIm[idx];
      const nRe = psiRe[idxPrev] + psiRe[idxNext];
      const nIm = psiIm[idxPrev] + psiIm[idxNext];
      lineRhsRe[iy] = pRe + twoAlphaY * pIm - alphaY * nIm;
      lineRhsIm[iy] = pIm - twoAlphaY * pRe + alphaY * nRe;
    }

    lineSolRe[1] = lineRhsRe[1] * invDenomYRe[1] - lineRhsIm[1] * invDenomYIm[1];
    lineSolIm[1] = lineRhsRe[1] * invDenomYIm[1] + lineRhsIm[1] * invDenomYRe[1];

    for (let iy = 2; iy < ny - 1; iy++) {
      const numRe = lineRhsRe[iy] + aImY * lineSolIm[iy - 1];
      const numIm = lineRhsIm[iy] - aImY * lineSolRe[iy - 1];
      lineSolRe[iy] = numRe * invDenomYRe[iy] - numIm * invDenomYIm[iy];
      lineSolIm[iy] = numRe * invDenomYIm[iy] + numIm * invDenomYRe[iy];
    }

    psiRe[(ny - 2) * nx + ix] = lineSolRe[ny - 2];
    psiIm[(ny - 2) * nx + ix] = lineSolIm[ny - 2];
    for (let iy = ny - 3; iy >= 1; iy--) {
      const nextRe = psiRe[(iy + 1) * nx + ix];
      const nextIm = psiIm[(iy + 1) * nx + ix];
      psiRe[iy * nx + ix] = lineSolRe[iy] - (cPrimeYRe[iy] * nextRe - cPrimeYIm[iy] * nextIm);
      psiIm[iy * nx + ix] = lineSolIm[iy] - (cPrimeYRe[iy] * nextIm + cPrimeYIm[iy] * nextRe);
    }
  }

  // 4. Second half potential rotation + optional boundary sponge
  for (let i = 0; i < total; i++) {
    const angle = -potential[i] * halfDt;
    let r = psiRe[i];
    let im = psiIm[i];
    if (angle !== 0) {
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const nr = r * cosA - im * sinA;
      const nim = r * sinA + im * cosA;
      r = nr;
      im = nim;
    }
    if (applySponge) {
      const sp = sponge[i];
      r *= sp;
      im *= sp;
    }
    psiRe[i] = r;
    psiIm[i] = im;
  }
}

export function stepState2D(state: State2D, applySponge = true): void {
  const { nx, ny, screenXIndex, screenIntensity, params } = state;

  if (!params.whichPathDetector) {
    advanceSingleWavefunction2D(
      state,
      state.psiRe,
      state.psiIm,
      state.potentialBoth,
      applySponge
    );
    for (let iy = 1; iy < ny - 1; iy++) {
      const idx = iy * nx + screenXIndex;
      const r = state.psiRe[idx];
      const im = state.psiIm[idx];
      screenIntensity[iy] += r * r + im * im;
    }
  } else {
    advanceSingleWavefunction2D(
      state,
      state.psiTopRe,
      state.psiTopIm,
      state.potentialTopOnly,
      applySponge
    );
    advanceSingleWavefunction2D(
      state,
      state.psiBotRe,
      state.psiBotIm,
      state.potentialBotOnly,
      applySponge
    );
    for (let iy = 1; iy < ny - 1; iy++) {
      const idx = iy * nx + screenXIndex;
      const r1 = state.psiTopRe[idx];
      const im1 = state.psiTopIm[idx];
      const r2 = state.psiBotRe[idx];
      const im2 = state.psiBotIm[idx];
      screenIntensity[iy] += r1 * r1 + im1 * im1 + r2 * r2 + im2 * im2;
    }
  }

  state.time += state.dt;
  state.stepCount += 1;
}

export function computeObservables2D(state: State2D): Observables2D {
  const {
    nx,
    ny,
    dx,
    dy,
    params,
    psiRe,
    psiIm,
    psiTopRe,
    psiTopIm,
    psiBotRe,
    psiBotIm,
    screenIntensity,
  } = state;

  let norm = 0;
  let maxDensity = 0;
  const dA = dx * dy;

  if (!params.whichPathDetector) {
    for (let i = 0; i < nx * ny; i++) {
      const d = psiRe[i] * psiRe[i] + psiIm[i] * psiIm[i];
      if (d > maxDensity) maxDensity = d;
      norm += d * dA;
    }
  } else {
    for (let i = 0; i < nx * ny; i++) {
      const d =
        0.5 *
        (psiTopRe[i] * psiTopRe[i] +
          psiTopIm[i] * psiTopIm[i] +
          psiBotRe[i] * psiBotRe[i] +
          psiBotIm[i] * psiBotIm[i]);
      if (d > maxDensity) maxDensity = d;
      norm += d * dA;
    }
  }

  let screenTotal = 0;
  let maxScreen = 0;
  let minCenterScreen = Infinity;
  const centerLow = Math.floor(ny * 0.35);
  const centerHigh = Math.ceil(ny * 0.65);

  for (let iy = 2; iy < ny - 2; iy++) {
    const val = screenIntensity[iy];
    screenTotal += val;
    if (val > maxScreen) maxScreen = val;
    if (iy >= centerLow && iy <= centerHigh && val < minCenterScreen) {
      minCenterScreen = val;
    }
  }

  const fringeVisibility =
    maxScreen > 1e-6 && minCenterScreen < Infinity
      ? Math.max(0, (maxScreen - minCenterScreen) / (maxScreen + minCenterScreen))
      : 0;

  return {
    time: state.time,
    norm,
    screenTotalIntensity: screenTotal,
    maxDensity,
    fringeVisibility,
  };
}
