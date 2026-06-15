import { ResearchSolverError, assertArray, nearZero } from './algorithms.js';

// ─── 12. COMBINATORIAL OPTIMIZATION ─────────────────────────────────────────

/** 0/1 Knapsack via DP — O(n·W) */
export function knapsack01({ weights, values, capacity }) {
  assertArray('weights', weights);
  assertArray('values', values, weights.length);
  const n = weights.length;
  const dp = Array.from({ length: n + 1 }, () => Array(capacity + 1).fill(0));
  for (let i = 1; i <= n; i += 1) {
    for (let w = 0; w <= capacity; w += 1) {
      dp[i][w] = dp[i - 1][w];
      if (weights[i - 1] <= w) {
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - weights[i - 1]] + values[i - 1]);
      }
    }
  }
  const selected = [];
  let w = capacity;
  for (let i = n; i > 0; i -= 1) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selected.push(i - 1);
      w -= weights[i - 1];
    }
  }
  return { algorithm: 'knapsack_01', max_value: dp[n][capacity], selected_items: selected.reverse() };
}

/** Fractional knapsack — greedy — O(n log n) */
export function knapsackFractional({ weights, values, capacity }) {
  const items = weights.map((wt, i) => ({ i, wt, val: values[i], ratio: values[i] / wt }));
  items.sort((a, b) => b.ratio - a.ratio);
  let remaining = capacity;
  let total = 0;
  const fractions = [];
  for (const item of items) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, item.wt);
    total += take * item.ratio;
    fractions.push({ index: item.i, fraction: take / item.wt });
    remaining -= take;
  }
  return { algorithm: 'knapsack_fractional', max_value: total, fractions };
}

/** First-Fit Decreasing bin packing — O(n log n) */
export function binPackingFFD({ items, binCapacity }) {
  assertArray('items', items);
  const sorted = [...items].sort((a, b) => b - a);
  const bins = [];
  for (const item of sorted) {
    if (item > binCapacity) throw new ResearchSolverError(`Item ${item} exceeds bin capacity`, 'INVALID_INPUT');
    let placed = false;
    for (const bin of bins) {
      if (bin.remaining >= item) {
        bin.items.push(item);
        bin.remaining -= item;
        placed = true;
        break;
      }
    }
    if (!placed) bins.push({ items: [item], remaining: binCapacity - item });
  }
  return { algorithm: 'bin_packing_ffd', bins: bins.length, packing: bins };
}

/** Johnson's rule for 2-machine flow shop — O(n log n) */
export function johnsonsRule({ jobs }) {
  assertArray('jobs', jobs);
  const group1 = jobs.filter((j) => j.machine1 <= j.machine2).sort((a, b) => a.machine1 - b.machine1);
  const group2 = jobs.filter((j) => j.machine1 > j.machine2).sort((a, b) => b.machine2 - a.machine2);
  const sequence = [...group1, ...group2];
  let m1Time = 0;
  let m2Time = 0;
  sequence.forEach((job) => {
    m1Time += job.machine1;
    m2Time = Math.max(m2Time, m1Time) + job.machine2;
  });
  return { algorithm: 'johnsons_rule', sequence, makespan: m2Time };
}

/** Welsh-Powell graph coloring — O(V²) */
export function welshPowell({ graph }) {
  const nodes = Object.keys(graph);
  const degree = Object.fromEntries(nodes.map((n) => [n, Object.keys(graph[n] || {}).length]));
  const sorted = [...nodes].sort((a, b) => degree[b] - degree[a]);
  const colors = {};
  let maxColor = 0;
  for (const node of sorted) {
    const neighborColors = new Set(Object.keys(graph[node] || {}).map((nb) => colors[nb]).filter((c) => c !== undefined));
    let c = 0;
    while (neighborColors.has(c)) c += 1;
    colors[node] = c;
    maxColor = Math.max(maxColor, c);
  }
  return { algorithm: 'welsh_powell', colors, chromatic_number: maxColor + 1 };
}

/** DSATUR graph coloring — simplified */
export function dsatur({ graph }) {
  const nodes = Object.keys(graph);
  const saturation = Object.fromEntries(nodes.map((n) => [n, 0]));
  const colors = {};
  while (Object.keys(colors).length < nodes.length) {
    const uncolored = nodes.filter((n) => colors[n] === undefined);
    uncolored.sort((a, b) => saturation[b] - saturation[a] || Object.keys(graph[b] || {}).length - Object.keys(graph[a] || {}).length);
    const node = uncolored[0];
    const used = new Set(Object.keys(graph[node] || {}).map((nb) => colors[nb]).filter((c) => c !== undefined));
    let c = 0;
    while (used.has(c)) c += 1;
    colors[node] = c;
    Object.keys(graph[node] || {}).forEach((nb) => {
      if (colors[nb] !== undefined && !used.has(colors[nb])) saturation[nb] += 1;
    });
  }
  return { algorithm: 'dsatur', colors, chromatic_number: Math.max(...Object.values(colors)) + 1 };
}

/** Hungarian algorithm for assignment — O(n³) */
export function hungarian({ costMatrix }) {
  assertArray('costMatrix', costMatrix);
  const n = costMatrix.length;
  const u = Array(n + 1).fill(0);
  const v = Array(n + 1).fill(0);
  const p = Array(n + 1).fill(0);
  const way = Array(n + 1).fill(0);
  for (let i = 1; i <= n; i += 1) {
    p[0] = i;
    const minv = Array(n + 1).fill(Infinity);
    const used = Array(n + 1).fill(false);
    let j0 = 0;
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j += 1) {
        if (!used[j]) {
          const cur = costMatrix[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
      }
      for (let j = 0; j <= n; j += 1) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }
  const assignment = Array(n).fill(-1);
  for (let j = 1; j <= n; j += 1) assignment[p[j] - 1] = j - 1;
  const totalCost = assignment.reduce((s, col, row) => s + costMatrix[row][col], 0);
  return { algorithm: 'hungarian', assignment, total_cost: totalCost };
}
