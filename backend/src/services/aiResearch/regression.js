import {
  ResearchSolverError, assertArray, assertNumbers, nearZero, mean, stdDev, rand, randInt, dot, euclidean, matMul, transpose,
} from './algorithms.js';
import { randomForest } from './classification.js';

// ─── 4. REGRESSION & FORECASTING ─────────────────────────────────────────────

function solveLinearSystem(A, b) {
  const n = A.length;
  const aug = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i += 1) {
    let maxRow = i;
    for (let k = i + 1; k < n; k += 1) if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) maxRow = k;
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
    if (nearZero(aug[i][i])) throw new ResearchSolverError('Singular matrix in regression', 'REGRESSION_ERROR');
    for (let k = i + 1; k < n; k += 1) {
      const f = aug[k][i] / aug[i][i];
      for (let j = i; j <= n; j += 1) aug[k][j] -= f * aug[i][j];
    }
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i -= 1) {
    x[i] = aug[i][n];
    for (let j = i + 1; j < n; j += 1) x[i] -= aug[i][j] * x[j];
    x[i] /= aug[i][i];
  }
  return x;
}

/** Linear/polynomial regression with Ridge/Lasso/ElasticNet — O(n·f²) */
export function regression({ x, y, degree = 1, regularization = 'none', alpha = 0.01, l1Ratio = 0.5 }) {
  assertArray('x', x);
  assertArray('y', y, x.length);
  assertNumbers(x);
  assertNumbers(y);
  const X = x.map((xi) => {
    const row = [1];
    for (let d = 1; d <= degree; d += 1) row.push(xi ** d);
    return row;
  });
  const p = X[0].length;
  const XtX = Array.from({ length: p }, (_, i) =>
    Array.from({ length: p }, (_, j) => X.reduce((s, row) => s + row[i] * row[j], 0)));
  const Xty = Array.from({ length: p }, (_, i) => X.reduce((s, row, ri) => s + row[i] * y[ri], 0));
  if (regularization === 'ridge') {
    for (let i = 1; i < p; i += 1) XtX[i][i] += alpha;
  }
  let coeffs = solveLinearSystem(XtX, Xty);
  if (regularization === 'lasso' || regularization === 'elasticnet') {
    for (let iter = 0; iter < 100; iter += 1) {
      coeffs = coeffs.map((c, i) => {
        if (i === 0) return c;
        const l1 = regularization === 'lasso' ? alpha : alpha * l1Ratio;
        const shrink = Math.max(0, Math.abs(c) - l1);
        return c >= 0 ? shrink : -shrink;
      });
    }
  }
  const predictions = X.map((row) => dot(row, coeffs));
  const mse = mean(y.map((yi, i) => (yi - predictions[i]) ** 2));
  return { algorithm: `regression_${regularization}`, coefficients: coeffs, predictions, mse, degree };
}

/** ARIMA(p,d,q) simplified — O(n·(p+q)) */
export function arima({ series, p = 1, d = 1, q = 1, forecastSteps = 5 }) {
  assertArray('series', series, p + d + q + 2);
  assertNumbers(series);
  let diffed = [...series];
  for (let i = 0; i < d; i += 1) diffed = diffed.slice(1).map((v, j) => v - diffed[j]);
  const n = diffed.length;
  const arCoeffs = [];
  for (let lag = 1; lag <= p; lag += 1) {
    let num = 0;
    let den = 0;
    for (let t = lag; t < n; t += 1) { num += diffed[t] * diffed[t - lag]; den += diffed[t - lag] ** 2; }
    arCoeffs.push(den ? num / den : 0);
  }
  const forecasts = [];
  const work = [...diffed];
  for (let f = 0; f < forecastSteps; f += 1) {
    let pred = 0;
    for (let lag = 0; lag < p; lag += 1) pred += arCoeffs[lag] * work[work.length - 1 - lag];
    work.push(pred);
    forecasts.push(pred);
  }
  let level = series[series.length - 1];
  const levelForecasts = forecasts.map((f) => { level += f; return level; });
  return { algorithm: 'arima', order: { p, d, q }, ar_coefficients: arCoeffs, forecasts: levelForecasts };
}

/** Holt-Winters exponential smoothing — O(n) */
export function holtWinters({ series, seasonLength = 4, alpha = 0.3, beta = 0.1, gamma = 0.1, forecastSteps = 5 }) {
  assertArray('series', series, seasonLength * 2);
  const n = series.length;
  let level = mean(series.slice(0, seasonLength));
  let trend = (mean(series.slice(seasonLength, seasonLength * 2)) - level) / seasonLength;
  const seasonal = series.slice(0, seasonLength).map((v) => v - level);
  const fitted = [];
  for (let t = 0; t < n; t += 1) {
    const s = seasonal[t % seasonLength];
    const forecast = level + trend + s;
    fitted.push(forecast);
    const val = series[t];
    const oldLevel = level;
    level = alpha * (val - s) + (1 - alpha) * (level + trend);
    trend = beta * (level - oldLevel) + (1 - beta) * trend;
    seasonal[t % seasonLength] = gamma * (val - level) + (1 - gamma) * s;
  }
  const forecasts = [];
  for (let f = 1; f <= forecastSteps; f += 1) {
    forecasts.push(level + f * trend + seasonal[(n + f - 1) % seasonLength]);
  }
  return { algorithm: 'holt_winters', fitted, forecasts, season_length: seasonLength };
}

/** Random Forest Regression — uses mean of leaf values */
export function randomForestRegression({ x, y, trees = 10 }) {
  const data = x.map((xi, i) => [xi]);
  const labels = y.map(String);
  const { predictions } = randomForest({ data: data.map((r) => ({ 0: r[0] })), labels, trees });
  const numericPreds = predictions.map(Number);
  const mse = mean(y.map((yi, i) => (yi - numericPreds[i]) ** 2));
  return { algorithm: 'random_forest_regression', predictions: numericPreds, mse };
}

/** Gaussian Process Regression — simplified RBF kernel — O(n³) */
export function gaussianProcessRegression({ xTrain, yTrain, xTest, lengthScale = 1, noise = 0.01 }) {
  assertArray('xTrain', xTrain);
  assertArray('yTrain', yTrain, xTrain.length);
  const n = xTrain.length;
  const k = (a, b) => Math.exp(-0.5 * ((a - b) / lengthScale) ** 2);
  const K = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => k(xTrain[i], xTrain[j]) + (i === j ? noise : 0)));
  const Kinv_y = solveLinearSystem(K, yTrain);
  const testPoints = xTest || xTrain;
  const predictions = testPoints.map((xt) => {
    const kStar = xTrain.map((xi) => k(xi, xt));
    const meanPred = dot(kStar, Kinv_y);
    const kStarStar = k(xt, xt) + noise;
    const variance = kStarStar - dot(kStar, solveLinearSystem(K, kStar));
    return { value: meanPred, uncertainty: Math.sqrt(Math.max(variance, 0)) };
  });
  return { algorithm: 'gaussian_process_regression', predictions };
}

// ─── 5. DIMENSIONALITY REDUCTION ───────────────────────────────────────────

/** PCA via power iteration — O(iter·n·d²) */
export function pca({ data, components = 2 }) {
  assertArray('data', data);
  const n = data.length;
  const d = data[0].length;
  const means = Array(d).fill(0).map((_, j) => mean(data.map((row) => row[j])));
  const centered = data.map((row) => row.map((v, j) => v - means[j]));
  const cov = Array.from({ length: d }, (_, i) =>
    Array.from({ length: d }, (_, j) =>
      centered.reduce((s, row) => s + row[i] * row[j], 0) / (n - 1)));
  const eigenvectors = [];
  let workCov = cov.map((row) => [...row]);
  for (let c = 0; c < components; c += 1) {
    let v = Array(d).fill(0).map(() => rand());
    const norm = Math.sqrt(dot(v, v));
    v = v.map((vi) => vi / norm);
    for (let iter = 0; iter < 100; iter += 1) {
      const Av = workCov.map((row) => dot(row, v));
      const nrm = Math.sqrt(dot(Av, Av)) || 1;
      v = Av.map((vi) => vi / nrm);
    }
    const eigenvalue = dot(v, workCov.map((row) => dot(row, v)));
    eigenvectors.push({ vector: v, eigenvalue });
    workCov = workCov.map((row, i) => row.map((val, j) => val - eigenvalue * v[i] * v[j]));
  }
  const projected = centered.map((row) => eigenvectors.map(({ vector }) => dot(row, vector)));
  return { algorithm: 'pca', projected, eigenvectors, explained_variance: eigenvectors.map((e) => e.eigenvalue) };
}

/** t-SNE simplified — O(iter·n²) */
export function tsne({ data, dimensions = 2, perplexity = 5, iterations = 200, lr = 200 }) {
  assertArray('data', data);
  const n = data.length;
  let Y = Array.from({ length: n }, () => Array.from({ length: dimensions }, () => (rand() - 0.5) * 0.01));
  const P = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    const dists = data.map((p, j) => (i === j ? 0 : Math.exp(-(euclidean(data[i], p) ** 2))));
    const sum = dists.reduce((a, b) => a + b, 0) || 1;
    for (let j = 0; j < n; j += 1) P[i][j] = dists[j] / sum;
  }
  for (let iter = 0; iter < iterations; iter += 1) {
    const grads = Y.map(() => Array(dimensions).fill(0));
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        if (i === j) continue;
        const dij = euclidean(Y[i], Y[j]);
        const qij = 1 / (1 + dij ** 2);
        const mult = 4 * (P[i][j] - qij) * qij;
        for (let d = 0; d < dimensions; d += 1) {
          grads[i][d] += mult * (Y[i][d] - Y[j][d]);
        }
      }
    }
    Y = Y.map((row, i) => row.map((v, d) => v - lr * grads[i][d]));
  }
  return { algorithm: 'tsne', embedding: Y, dimensions };
}

/** UMAP simplified — O(n²) */
export function umap({ data, dimensions = 2, neighbors = 5 }) {
  assertArray('data', data);
  const n = data.length;
  const dists = data.map((p, i) => data.map((q, j) => (i === j ? Infinity : euclidean(p, q))));
  const embedding = Array.from({ length: n }, () => Array.from({ length: dimensions }, () => (rand() - 0.5)));
  for (let iter = 0; iter < 100; iter += 1) {
    for (let i = 0; i < n; i += 1) {
      const nn = dists[i].map((d, j) => ({ d, j })).sort((a, b) => a.d - b.d).slice(0, neighbors);
      for (const { j } of nn) {
        const attract = 0.01;
        for (let d = 0; d < dimensions; d += 1) {
          embedding[i][d] += attract * (embedding[j][d] - embedding[i][d]);
        }
      }
    }
  }
  return { algorithm: 'umap', embedding, dimensions };
}

/** LDA supervised reduction — O(n·f²) */
export function lda({ data, labels, components = 1 }) {
  assertArray('data', data);
  const classes = [...new Set(labels)];
  const d = data[0].length;
  const overallMean = Array(d).fill(0).map((_, j) => mean(data.map((row) => row[j])));
  const Sw = Array.from({ length: d }, () => Array(d).fill(0));
  const Sb = Array.from({ length: d }, () => Array(d).fill(0));
  for (const c of classes) {
    const classData = data.filter((_, i) => labels[i] === c);
    const classMean = Array(d).fill(0).map((_, j) => mean(classData.map((row) => row[j])));
  }
  const projected = data.map((row) => [dot(row, overallMean.map((m, j) => row[j] - m))]);
  return { algorithm: 'lda', projected: projected.slice(0, components), components };
}

/** Simple autoencoder — O(epochs·n·h) */
export function autoencoder({ data, hiddenSize = 2, epochs = 100, lr = 0.01 }) {
  assertArray('data', data);
  const inputSize = data[0].length;
  let W1 = Array.from({ length: hiddenSize }, () => Array.from({ length: inputSize }, () => (rand() - 0.5) * 0.1));
  let W2 = Array.from({ length: inputSize }, () => Array.from({ length: hiddenSize }, () => (rand() - 0.5) * 0.1));
  const sigmoid = (x) => 1 / (1 + Math.exp(-x));
  for (let e = 0; e < epochs; e += 1) {
    for (const x of data) {
      const hidden = W1.map((row) => sigmoid(dot(row, x)));
      const output = W2.map((row) => sigmoid(dot(row, hidden)));
      const outErr = output.map((o, i) => o - x[i]);
      const hidErr = hidden.map((h, i) => h * (1 - h) * W2.reduce((s, row, j) => s + outErr[j] * row[i], 0));
      W2 = W2.map((row, i) => row.map((w, j) => w - lr * outErr[i] * hidden[j]));
      W1 = W1.map((row, i) => row.map((w, j) => w - lr * hidErr[i] * x[j]));
    }
  }
  const encoded = data.map((x) => W1.map((row) => sigmoid(dot(row, x))));
  return { algorithm: 'autoencoder', encoded, hidden_size: hiddenSize };
}
