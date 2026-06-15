import {
  ResearchSolverError, assertArray, assertNumbers, euclidean, entropy, nearZero, mean, stdDev, shuffle, rand, randInt, dot, softmax, clone, matMul, transpose, EPS,
} from './algorithms.js';

// ─── 2. CLASSIFICATION ───────────────────────────────────────────────────────

function buildTree(data, labels, features, depth = 0, maxDepth = 10) {
  const unique = [...new Set(labels)];
  if (unique.length === 1 || depth >= maxDepth || features.length === 0) {
    const counts = {};
    labels.forEach((l) => { counts[l] = (counts[l] || 0) + 1; });
    const pred = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    return { type: 'leaf', prediction: pred, counts };
  }
  let bestGain = -Infinity;
  let bestFeature = null;
  let bestThreshold = null;
  const parentEntropy = entropy(Object.values(labels.reduce((acc, l) => { acc[l] = (acc[l] || 0) + 1; return acc; }, {})));

  for (const f of features) {
    const values = data.map((row) => row[f]).sort((a, b) => a - b);
    const thresholds = [...new Set(values)];
    for (const t of thresholds) {
      const leftIdx = [];
      const rightIdx = [];
      data.forEach((row, i) => {
        if (row[f] <= t) leftIdx.push(i);
        else rightIdx.push(i);
      });
      if (leftIdx.length === 0 || rightIdx.length === 0) continue;
      const leftLabels = leftIdx.map((i) => labels[i]);
      const rightLabels = rightIdx.map((i) => labels[i]);
      const leftEnt = entropy(Object.values(leftLabels.reduce((a, l) => { a[l] = (a[l] || 0) + 1; return a; }, {})));
      const rightEnt = entropy(Object.values(rightLabels.reduce((a, l) => { a[l] = (a[l] || 0) + 1; return a; }, {})));
      const gain = parentEntropy - (leftIdx.length / data.length) * leftEnt - (rightIdx.length / data.length) * rightEnt;
      if (gain > bestGain) { bestGain = gain; bestFeature = f; bestThreshold = t; }
    }
  }
  if (bestFeature === null) {
    const counts = {};
    labels.forEach((l) => { counts[l] = (counts[l] || 0) + 1; });
    return { type: 'leaf', prediction: Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] };
  }
  const leftData = [];
  const leftLabels = [];
  const rightData = [];
  const rightLabels = [];
  data.forEach((row, i) => {
    if (row[bestFeature] <= bestThreshold) { leftData.push(row); leftLabels.push(labels[i]); }
    else { rightData.push(row); rightLabels.push(labels[i]); }
  });
  const remaining = features.filter((f) => f !== bestFeature);
  return {
    type: 'node', feature: bestFeature, threshold: bestThreshold,
    left: buildTree(leftData, leftLabels, remaining, depth + 1, maxDepth),
    right: buildTree(rightData, rightLabels, remaining, depth + 1, maxDepth),
  };
}

function predictTree(tree, row) {
  if (tree.type === 'leaf') return tree.prediction;
  return row[tree.feature] <= tree.threshold ? predictTree(tree.left, row) : predictTree(tree.right, row);
}

/** ID3/C4.5 decision tree — O(n·f·d) */
export function decisionTree({ data, labels, variant = 'id3', maxDepth = 10 }) {
  assertArray('data', data);
  assertArray('labels', labels, data.length);
  const features = Object.keys(data[0] || {}).map(Number).filter((n) => !Number.isNaN(n));
  const featureKeys = features.length ? features : Object.keys(data[0]);
  const tree = buildTree(data, labels, featureKeys, 0, maxDepth);
  const predictions = data.map((row) => predictTree(tree, row));
  const accuracy = predictions.filter((p, i) => p === labels[i]).length / labels.length;
  return { algorithm: variant === 'c4.5' ? 'c4.5' : 'id3', tree, accuracy, predictions };
}

/** Random Forest — O(trees·n·log n) */
export function randomForest({ data, labels, trees = 10, maxDepth = 8, sampleRatio = 0.8 }) {
  assertArray('data', data);
  const forest = [];
  for (let t = 0; t < trees; t += 1) {
    const indices = shuffle(data.map((_, i) => i)).slice(0, Math.floor(data.length * sampleRatio));
    const sample = indices.map((i) => data[i]);
    const sampleLabels = indices.map((i) => labels[i]);
    const { tree } = decisionTree({ data: sample, labels: sampleLabels, maxDepth });
    forest.push(tree);
  }
  const predict = (row) => {
    const votes = forest.map((tree) => predictTree(tree, row));
    const counts = {};
    votes.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  };
  const predictions = data.map(predict);
  const accuracy = predictions.filter((p, i) => p === labels[i]).length / labels.length;
  return { algorithm: 'random_forest', trees: forest.length, accuracy, predictions };
}

/** Naive Bayes — Gaussian or Multinomial — O(n·f) */
export function naiveBayes({ data, labels, test, type = 'gaussian' }) {
  assertArray('data', data);
  const classes = [...new Set(labels)];
  const priors = {};
  const params = {};
  classes.forEach((c) => {
    priors[c] = labels.filter((l) => l === c).length / labels.length;
    const classData = data.filter((_, i) => labels[i] === c);
    params[c] = classData[0].map((_, f) => {
      const vals = classData.map((row) => row[f]);
      if (type === 'multinomial') {
        const sum = vals.reduce((a, b) => a + b, 0);
        return vals.map((v) => v / sum);
      }
      return { mean: mean(vals), std: stdDev(vals) || 1 };
    });
  });
  const gaussianPdf = (x, m, s) => (1 / (s * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - m) / s) ** 2);
  const predict = (row) => {
    let best = null;
    let bestScore = -Infinity;
    for (const c of classes) {
      let logP = Math.log(priors[c]);
      for (let f = 0; f < row.length; f += 1) {
        if (type === 'multinomial') {
          logP += Math.log((params[c][f][row[f]] || 0) + EPS);
        } else {
          logP += Math.log(gaussianPdf(row[f], params[c][f].mean, params[c][f].std) + EPS);
        }
      }
      if (logP > bestScore) { bestScore = logP; best = c; }
    }
    return best;
  };
  const testData = test || data;
  return { algorithm: `naive_bayes_${type}`, predictions: testData.map(predict), classes };
}

/** K-Nearest Neighbors — O(n·k·d) */
export function knn({ data, labels, test, k = 3, metric = 'euclidean' }) {
  assertArray('data', data);
  const distFn = metric === 'manhattan'
    ? (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0)
    : euclidean;
  const predict = (point) => {
    const dists = data.map((row, i) => ({ dist: distFn(row, point), label: labels[i] }));
    dists.sort((a, b) => a.dist - b.dist);
    const votes = {};
    dists.slice(0, k).forEach(({ label }) => { votes[label] = (votes[label] || 0) + 1; });
    return Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
  };
  return { algorithm: 'knn', k, metric, predictions: (test || data).map(predict) };
}

/** SVM with kernel — simplified SMO-like gradient — O(epochs·n) */
export function svm({ data, labels, kernel = 'linear', degree = 2, gamma = 0.1, epochs = 100, lr = 0.01 }) {
  assertArray('data', data);
  const n = data.length;
  const dim = data[0].length;
  let w = Array(dim).fill(0);
  let b = 0;
  const y = labels.map((l) => (l === labels[0] ? 1 : l > labels[0] ? 1 : -1));
  const K = (xi, xj) => {
    if (kernel === 'linear') return dot(xi, xj);
    if (kernel === 'polynomial') return (dot(xi, xj) + 1) ** degree;
    if (kernel === 'rbf') return Math.exp(-gamma * euclidean(xi, xj) ** 2);
    throw new ResearchSolverError(`Unknown kernel: ${kernel}`, 'INVALID_INPUT');
  };
  for (let e = 0; e < epochs; e += 1) {
    for (let i = 0; i < n; i += 1) {
      let score = b;
      for (let j = 0; j < n; j += 1) score += y[j] * K(data[i], data[j]);
      if (y[i] * score < 1) {
        for (let d = 0; d < dim; d += 1) w[d] += lr * y[i] * data[i][d];
        b += lr * y[i];
      }
    }
  }
  const predict = (row) => {
    let score = b + dot(w, row);
    return score >= 0 ? labels[0] : labels.find((l) => l !== labels[0]) || labels[0];
  };
  return { algorithm: `svm_${kernel}`, predictions: data.map(predict), weights: w, bias: b };
}

/** Logistic Regression — O(epochs·n·f) */
export function logisticRegression({ data, labels, epochs = 200, lr = 0.1, multiclass = false }) {
  assertArray('data', data);
  const dim = data[0].length;
  const classes = [...new Set(labels)];
  if (!multiclass && classes.length === 2) {
    const y = labels.map((l) => (l === classes[1] ? 1 : 0));
    let w = Array(dim).fill(0);
    let b = 0;
    const sigmoid = (z) => 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, z))));
    for (let e = 0; e < epochs; e += 1) {
      for (let i = 0; i < data.length; i += 1) {
        const z = dot(w, data[i]) + b;
        const pred = sigmoid(z);
        const err = pred - y[i];
        w = w.map((wi, d) => wi - lr * err * data[i][d]);
        b -= lr * err;
      }
    }
    const predict = (row) => (sigmoid(dot(w, row) + b) >= 0.5 ? classes[1] : classes[0]);
    return { algorithm: 'logistic_regression', predictions: data.map(predict), weights: w, bias: b };
  }
  const weights = classes.map(() => ({ w: Array(dim).fill(0), b: 0 }));
  for (let e = 0; e < epochs; e += 1) {
    for (let i = 0; i < data.length; i += 1) {
      const scores = weights.map(({ w, b }) => dot(w, data[i]) + b);
      const probs = softmax(scores);
      const trueIdx = classes.indexOf(labels[i]);
      weights.forEach((wt, c) => {
        const err = probs[c] - (c === trueIdx ? 1 : 0);
        wt.w = wt.w.map((wi, d) => wi - lr * err * data[i][d]);
        wt.b -= lr * err;
      });
    }
  }
  const predict = (row) => {
    const scores = weights.map(({ w, b }) => dot(w, row) + b);
    const probs = softmax(scores);
    return classes[probs.indexOf(Math.max(...probs))];
  };
  return { algorithm: 'logistic_regression_multiclass', predictions: data.map(predict), classes };
}
