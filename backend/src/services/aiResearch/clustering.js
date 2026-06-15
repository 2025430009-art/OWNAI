import {
  ResearchSolverError, assertArray, assertNumbers, euclidean, nearZero, mean, rand, randInt,
} from './algorithms.js';

// ─── 3. CLUSTERING ─────────────────────────────────────────────────────────────

/** K-Means++ initialization + Lloyd iterations — O(iter·k·n·d) */
export function kMeansPlusPlus({ data, k, maxIterations = 100 }) {
  assertArray('data', data);
  assertNumbers(data.flat());
  if (k > data.length) throw new ResearchSolverError('k cannot exceed data size', 'INVALID_INPUT');
  const centroids = [data[randInt(data.length)]];
  while (centroids.length < k) {
    const dists = data.map((p) => Math.min(...centroids.map((c) => euclidean(p, c) ** 2)));
    const total = dists.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    for (let i = 0; i < data.length; i += 1) {
      r -= dists[i];
      if (r <= 0) { centroids.push([...data[i]]); break; }
    }
    if (centroids.length < k && r > 0) centroids.push([...data[data.length - 1]]);
  }
  let assignments = Array(data.length).fill(0);
  for (let iter = 0; iter < maxIterations; iter += 1) {
    let changed = false;
    for (let i = 0; i < data.length; i += 1) {
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c += 1) {
        const d = euclidean(data[i], centroids[c]);
        if (d < bestDist) { bestDist = d; best = c; }
      }
      if (assignments[i] !== best) { assignments[i] = best; changed = true; }
    }
    const sums = Array.from({ length: k }, () => Array(data[0].length).fill(0));
    const counts = Array(k).fill(0);
    data.forEach((p, i) => {
      counts[assignments[i]] += 1;
      p.forEach((v, d) => { sums[assignments[i]][d] += v; });
    });
    for (let c = 0; c < k; c += 1) {
      if (counts[c] > 0) centroids[c] = sums[c].map((s) => s / counts[c]);
    }
    if (!changed) break;
  }
  return { algorithm: 'kmeans_plus_plus', centroids, assignments, k };
}

/** DBSCAN — O(n²) */
export function dbscan({ data, eps = 0.5, minPts = 3 }) {
  assertArray('data', data);
  const labels = Array(data.length).fill(-1);
  let clusterId = 0;
  const regionQuery = (idx) => data.map((p, i) => (euclidean(data[idx], p) <= eps ? i : -1)).filter((i) => i >= 0);
  for (let i = 0; i < data.length; i += 1) {
    if (labels[i] !== -1) continue;
    const neighbors = regionQuery(i);
    if (neighbors.length < minPts) { labels[i] = -2; continue; }
    labels[i] = clusterId;
    const seeds = neighbors.filter((n) => n !== i);
    let s = 0;
    while (s < seeds.length) {
      const q = seeds[s];
      s += 1;
      if (labels[q] === -2) labels[q] = clusterId;
      if (labels[q] !== -1) continue;
      labels[q] = clusterId;
      const qNeighbors = regionQuery(q);
      if (qNeighbors.length >= minPts) seeds.push(...qNeighbors.filter((n) => !seeds.includes(n)));
    }
    clusterId += 1;
  }
  return { algorithm: 'dbscan', labels: labels.map((l) => (l === -2 ? -1 : l)), clusters: clusterId, eps, minPts };
}

/** Agglomerative hierarchical clustering — O(n³) */
export function hierarchicalClustering({ data, k = 2, linkage = 'average' }) {
  assertArray('data', data);
  const clusters = data.map((p, i) => ({ id: i, points: [i], centroid: [...p] }));
  const dist = (a, b) => {
    if (linkage === 'single') return Math.min(...a.points.flatMap((i) => b.points.map((j) => euclidean(data[i], data[j]))));
    if (linkage === 'complete') return Math.max(...a.points.flatMap((i) => b.points.map((j) => euclidean(data[i], data[j]))));
    return euclidean(a.centroid, b.centroid);
  };
  while (clusters.length > k) {
    let minD = Infinity;
    let mergeI = 0;
    let mergeJ = 1;
    for (let i = 0; i < clusters.length; i += 1) {
      for (let j = i + 1; j < clusters.length; j += 1) {
        const d = dist(clusters[i], clusters[j]);
        if (d < minD) { minD = d; mergeI = i; mergeJ = j; }
      }
    }
    const merged = {
      id: clusters[mergeI].id,
      points: [...clusters[mergeI].points, ...clusters[mergeJ].points],
      centroid: clusters[mergeI].centroid.map((v, d) => (v + clusters[mergeJ].centroid[d]) / 2),
    };
    clusters.splice(mergeJ, 1);
    clusters[mergeI] = merged;
  }
  const assignments = Array(data.length).fill(0);
  clusters.forEach((c, ci) => c.points.forEach((pi) => { assignments[pi] = ci; }));
  return { algorithm: 'hierarchical_clustering', assignments, clusters: clusters.length, linkage };
}

/** Gaussian Mixture Model with EM — O(iter·k·n·d) */
export function gaussianMixtureModel({ data, k = 2, maxIterations = 50 }) {
  assertArray('data', data);
  const dim = data[0].length;
  let means = Array.from({ length: k }, (_, i) => [...data[i % data.length]]);
  let covs = Array.from({ length: k }, () => Array(dim).fill(1));
  let weights = Array(k).fill(1 / k);
  let responsibilities = Array.from({ length: data.length }, () => Array(k).fill(1 / k));

  const gaussian = (x, m, cov) => {
    let d = 0;
    for (let i = 0; i < dim; i += 1) d += ((x[i] - m[i]) ** 2) / (cov[i] + EPS);
    return Math.exp(-0.5 * d);
  };

  for (let iter = 0; iter < maxIterations; iter += 1) {
    for (let i = 0; i < data.length; i += 1) {
      const probs = means.map((m, c) => weights[c] * gaussian(data[i], m, covs[c]));
      const sum = probs.reduce((a, b) => a + b, 0) || EPS;
      responsibilities[i] = probs.map((p) => p / sum);
    }
    for (let c = 0; c < k; c += 1) {
      const nk = responsibilities.reduce((s, r) => s + r[c], 0) || EPS;
      weights[c] = nk / data.length;
      means[c] = means[c].map((_, d) => responsibilities.reduce((s, r, i) => s + r[c] * data[i][d], 0) / nk);
      covs[c] = covs[c].map((_, d) => {
        const v = responsibilities.reduce((s, r, i) => s + r[c] * (data[i][d] - means[c][d]) ** 2, 0) / nk;
        return Math.max(v, EPS);
      });
    }
  }
  const assignments = responsibilities.map((r) => r.indexOf(Math.max(...r)));
  return { algorithm: 'gaussian_mixture_model', assignments, means, weights, iterations: maxIterations };
}

/** OPTICS ordering — O(n² log n) simplified */
export function optics({ data, eps = 0.5, minPts = 3 }) {
  assertArray('data', data);
  const ordered = [];
  const visited = new Set();
  const reachability = Array(data.length).fill(Infinity);
  const coreDist = (idx) => {
    const dists = data.map((p, i) => (i === idx ? Infinity : euclidean(data[idx], p))).sort((a, b) => a - b);
    return dists[minPts - 1] || Infinity;
  };
  for (let i = 0; i < data.length; i += 1) {
    if (visited.has(i)) continue;
    visited.add(i);
    ordered.push(i);
    const neighbors = data.map((p, j) => (euclidean(data[i], p) <= eps ? j : -1)).filter((j) => j >= 0);
    if (neighbors.length < minPts) continue;
    const seeds = neighbors.filter((n) => n !== i).sort((a, b) => euclidean(data[i], data[a]) - euclidean(data[i], data[b]));
    for (const n of seeds) {
      if (visited.has(n)) continue;
      const rd = Math.max(coreDist(i), euclidean(data[i], data[n]));
      if (rd < reachability[n]) reachability[n] = rd;
      visited.add(n);
      ordered.push(n);
    }
  }
  return { algorithm: 'optics', ordering: ordered, reachability_distances: reachability };
}
