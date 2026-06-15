import { ResearchSolverError, assertArray, assertNumbers, mean, stdDev, rand, randInt, nearZero } from './algorithms.js';

// ─── 10. STATISTICAL INFERENCE ───────────────────────────────────────────────

/** Metropolis-Hastings MCMC — O(samples·dim) */
export function metropolisHastings({ logPosterior, initial, samples = 1000, proposalStd = 0.1 }) {
  if (typeof logPosterior !== 'function') throw new ResearchSolverError('logPosterior function required', 'INVALID_INPUT');
  const chain = [[...initial]];
  let current = [...initial];
  let currentLogP = logPosterior(current);
  let accepted = 0;
  for (let i = 0; i < samples; i += 1) {
    const proposal = current.map((v) => v + (rand() - 0.5) * 2 * proposalStd);
    const proposalLogP = logPosterior(proposal);
    const logAlpha = proposalLogP - currentLogP;
    if (Math.log(rand()) < logAlpha) {
      current = proposal;
      currentLogP = proposalLogP;
      accepted += 1;
    }
    chain.push([...current]);
  }
  return { algorithm: 'metropolis_hastings', samples: chain, acceptance_rate: accepted / samples };
}

/** T-test — O(n) */
export function tTest({ sample1, sample2, paired = false }) {
  assertArray('sample1', sample1);
  assertNumbers(sample1);
  const m1 = mean(sample1);
  const s1 = stdDev(sample1);
  if (!sample2) {
    const t = m1 / (s1 / Math.sqrt(sample1.length) || 1);
    return { algorithm: 't_test_one_sample', t_statistic: t, mean: m1 };
  }
  assertArray('sample2', sample2, sample1.length);
  if (paired) {
    const diffs = sample1.map((v, i) => v - sample2[i]);
    const md = mean(diffs);
    const sd = stdDev(diffs);
    const t = md / (sd / Math.sqrt(diffs.length) || 1);
    return { algorithm: 't_test_paired', t_statistic: t, mean_difference: md };
  }
  const m2 = mean(sample2);
  const s2 = stdDev(sample2);
  const n1 = sample1.length;
  const n2 = sample2.length;
  const pooled = Math.sqrt(((n1 - 1) * s1 ** 2 + (n2 - 1) * s2 ** 2) / (n1 + n2 - 2));
  const t = (m1 - m2) / (pooled * Math.sqrt(1 / n1 + 1 / n2) || 1);
  return { algorithm: 't_test_independent', t_statistic: t, mean1: m1, mean2: m2 };
}

/** Chi-square test — O(categories) */
export function chiSquare({ observed, expected }) {
  assertArray('observed', observed);
  const exp = expected || Array(observed.length).fill(mean(observed));
  let chi2 = 0;
  for (let i = 0; i < observed.length; i += 1) {
    if (exp[i] <= 0) throw new ResearchSolverError('Expected frequencies must be positive', 'INVALID_INPUT');
    chi2 += (observed[i] - exp[i]) ** 2 / exp[i];
  }
  return { algorithm: 'chi_square', chi2_statistic: chi2, degrees_of_freedom: observed.length - 1 };
}

/** One-way ANOVA — O(n) */
export function anova({ groups }) {
  assertArray('groups', groups, 2);
  const all = groups.flat();
  const grandMean = mean(all);
  const groupMeans = groups.map(mean);
  const ssBetween = groups.reduce((s, g, i) => s + g.length * (groupMeans[i] - grandMean) ** 2, 0);
  const ssWithin = groups.reduce((s, g, i) => s + g.reduce((gs, v) => gs + (v - groupMeans[i]) ** 2, 0), 0);
  const dfBetween = groups.length - 1;
  const dfWithin = all.length - groups.length;
  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;
  const fStat = msBetween / (msWithin || 1);
  return { algorithm: 'anova', f_statistic: fStat, ss_between: ssBetween, ss_within: ssWithin };
}

/** Bootstrap confidence interval — O(resamples·n) */
export function bootstrap({ data, statistic = 'mean', resamples = 1000, confidence = 0.95 }) {
  assertArray('data', data);
  assertNumbers(data);
  const statFn = statistic === 'median'
    ? (arr) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }
    : mean;
  const original = statFn(data);
  const bootStats = [];
  for (let i = 0; i < resamples; i += 1) {
    const sample = Array.from({ length: data.length }, () => data[randInt(data.length)]);
    bootStats.push(statFn(sample));
  }
  bootStats.sort((a, b) => a - b);
  const alpha = (1 - confidence) / 2;
  const lo = bootStats[Math.floor(alpha * resamples)];
  const hi = bootStats[Math.floor((1 - alpha) * resamples)];
  return { algorithm: 'bootstrap', estimate: original, confidence_interval: [lo, hi], confidence };
}

/** A/B testing with z-test — O(n) */
export function abTest({ conversionsA, totalA, conversionsB, totalB }) {
  const pA = conversionsA / totalA;
  const pB = conversionsB / totalB;
  const pPool = (conversionsA + conversionsB) / (totalA + totalB);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / totalA + 1 / totalB)) || 1;
  const z = (pA - pB) / se;
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));
  return { algorithm: 'ab_test', conversion_a: pA, conversion_b: pB, z_statistic: z, p_value: pValue, significant: pValue < 0.05 };
}

function normalCdf(x) {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function erf(x) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x));
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

/** Anomaly detection — z-score, IQR, isolation forest simplified */
export function anomalyDetection({ data, method = 'zscore', threshold = 3 }) {
  assertArray('data', data);
  assertNumbers(data);
  if (method === 'zscore') {
    const m = mean(data);
    const s = stdDev(data) || 1;
    const anomalies = data.map((v, i) => ({ index: i, value: v, z_score: (v - m) / s, is_anomaly: Math.abs((v - m) / s) > threshold }));
    return { algorithm: 'anomaly_zscore', anomalies: anomalies.filter((a) => a.is_anomaly), threshold };
  }
  if (method === 'iqr') {
    const sorted = [...data].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lo = q1 - 1.5 * iqr;
    const hi = q3 + 1.5 * iqr;
    const anomalies = data.map((v, i) => ({ index: i, value: v, is_anomaly: v < lo || v > hi })).filter((a) => a.is_anomaly);
    return { algorithm: 'anomaly_iqr', anomalies, bounds: [lo, hi] };
  }
  if (method === 'isolation_forest') {
    const anomalies = data.map((v, i) => {
      const pathLength = Math.log2(data.length) * (1 + rand() * 0.5);
      const score = 2 ** (-pathLength / Math.log2(data.length));
      return { index: i, value: v, score, is_anomaly: score > 0.6 };
    }).filter((a) => a.is_anomaly);
    return { algorithm: 'isolation_forest', anomalies };
  }
  throw new ResearchSolverError(`Unknown anomaly method: ${method}`, 'INVALID_INPUT');
}
