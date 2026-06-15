/**
 * AI Research algorithm implementations — first principles, no external ML libraries.
 * Imported by aiResearchSolver.js dispatcher.
 */

export class ResearchSolverError extends Error {
  constructor(message, code = 'RESEARCH_ERROR') {
    super(message);
    this.name = 'ResearchSolverError';
    this.status = 400;
    this.code = code;
  }
}

export const EPS = 1e-10;

export function nearZero(n) {
  return Math.abs(n) < EPS;
}

export function assertArray(name, arr, minLen = 1) {
  if (!Array.isArray(arr) || arr.length < minLen) {
    throw new ResearchSolverError(`${name} must be an array with length >= ${minLen}`, 'INVALID_INPUT');
  }
}

export function assertNumbers(arr, name = 'values') {
  if (arr.some((v) => typeof v !== 'number' || Number.isNaN(v))) {
    throw new ResearchSolverError(`All ${name} must be valid numbers`, 'INVALID_INPUT');
  }
}

export function euclidean(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

export function manhattan(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += Math.abs(a[i] - b[i]);
  return s;
}

export function dot(a, b) {
  return a.reduce((s, v, i) => s + v * b[i], 0);
}

export function transpose(m) {
  return m[0].map((_, j) => m.map((row) => row[j]));
}

export function matMul(a, b) {
  const rows = a.length;
  const cols = b[0].length;
  const inner = b.length;
  const out = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      let s = 0;
      for (let k = 0; k < inner; k += 1) s += a[i][k] * b[k][j];
      out[i][j] = s;
    }
  }
  return out;
}

export function softmax(arr) {
  const max = Math.max(...arr);
  const exps = arr.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

export function entropy(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  let h = 0;
  for (const c of counts) {
    if (c > 0) {
      const p = c / total;
      h -= p * Math.log2(p);
    }
  }
  return h;
}

export function rand() {
  return Math.random();
}

export function randInt(n) {
  return Math.floor(rand() * n);
}

export function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function stdDev(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── 1. OPTIMIZATION ─────────────────────────────────────────────────────────

/** Genetic Algorithm — O(g·p·f) where g=generations, p=population, f=fitness cost */
export function geneticAlgorithm({ fitness, dimensions, bounds, populationSize = 50, generations = 100, mutationRate = 0.1, crossoverRate = 0.7, maximize = false }) {
  if (typeof fitness !== 'function') throw new ResearchSolverError('fitness function required', 'INVALID_INPUT');
  const pop = Array.from({ length: populationSize }, () =>
    bounds.map(([lo, hi]) => lo + rand() * (hi - lo)));
  let best = null;
  let bestFit = maximize ? -Infinity : Infinity;

  for (let g = 0; g < generations; g += 1) {
    const scored = pop.map((ind) => ({ ind, fit: fitness(ind) }));
    scored.sort((a, b) => (maximize ? b.fit - a.fit : a.fit - b.fit));
    if (maximize ? scored[0].fit > bestFit : scored[0].fit < bestFit) {
      bestFit = scored[0].fit;
      best = [...scored[0].ind];
    }
    const next = scored.slice(0, Math.ceil(populationSize * 0.2)).map((s) => [...s.ind]);
    while (next.length < populationSize) {
      const p1 = scored[randInt(scored.length)].ind;
      const p2 = scored[randInt(scored.length)].ind;
      const child = [...p1];
      if (rand() < crossoverRate) {
        for (let d = 0; d < dimensions; d += 1) {
          if (rand() < 0.5) child[d] = p2[d];
        }
      }
      for (let d = 0; d < dimensions; d += 1) {
        if (rand() < mutationRate) {
          const [lo, hi] = bounds[d];
          child[d] = lo + rand() * (hi - lo);
        }
      }
      next.push(child);
    }
    pop.splice(0, pop.length, ...next);
  }
  return { algorithm: 'genetic_algorithm', best_solution: best, best_fitness: bestFit, generations };
}

/** Particle Swarm Optimization — O(iter·particles·dim) */
export function particleSwarmOptimization({ fitness, bounds, particles = 30, iterations = 100, w = 0.7, c1 = 1.5, c2 = 1.5, maximize = false }) {
  if (typeof fitness !== 'function') throw new ResearchSolverError('fitness function required', 'INVALID_INPUT');
  const dim = bounds.length;
  const pos = Array.from({ length: particles }, () => bounds.map(([lo, hi]) => lo + rand() * (hi - lo)));
  const vel = Array.from({ length: particles }, () => Array(dim).fill(0));
  const pBest = pos.map((p) => [...p]);
  const pBestFit = pos.map((p) => fitness(p));
  let gBest = [...pBest[0]];
  let gBestFit = pBestFit[0];
  for (let i = 1; i < particles; i += 1) {
    if (maximize ? pBestFit[i] > gBestFit : pBestFit[i] < gBestFit) {
      gBestFit = pBestFit[i];
      gBest = [...pBest[i]];
    }
  }
  for (let iter = 0; iter < iterations; iter += 1) {
    for (let i = 0; i < particles; i += 1) {
      for (let d = 0; d < dim; d += 1) {
        vel[i][d] = w * vel[i][d] + c1 * rand() * (pBest[i][d] - pos[i][d]) + c2 * rand() * (gBest[d] - pos[i][d]);
        pos[i][d] += vel[i][d];
        const [lo, hi] = bounds[d];
        pos[i][d] = Math.max(lo, Math.min(hi, pos[i][d]));
      }
      const fit = fitness(pos[i]);
      if (maximize ? fit > pBestFit[i] : fit < pBestFit[i]) {
        pBestFit[i] = fit;
        pBest[i] = [...pos[i]];
        if (maximize ? fit > gBestFit : fit < gBestFit) {
          gBestFit = fit;
          gBest = [...pos[i]];
        }
      }
    }
  }
  return { algorithm: 'particle_swarm', best_solution: gBest, best_fitness: gBestFit, iterations };
}

/** Simulated Annealing with Metropolis criterion — O(iterations) */
export function simulatedAnnealing({ fitness, initial, bounds, iterations = 1000, initialTemp = 100, coolingRate = 0.995, maximize = false }) {
  if (typeof fitness !== 'function') throw new ResearchSolverError('fitness function required', 'INVALID_INPUT');
  let current = [...initial];
  let currentFit = fitness(current);
  let best = [...current];
  let bestFit = currentFit;
  let temp = initialTemp;
  for (let i = 0; i < iterations; i += 1) {
    const neighbor = current.map((v, d) => {
      const [lo, hi] = bounds[d];
      const delta = (rand() - 0.5) * (hi - lo) * 0.1;
      return Math.max(lo, Math.min(hi, v + delta));
    });
    const neighborFit = fitness(neighbor);
    const delta = neighborFit - currentFit;
    const accept = maximize
      ? delta > 0 || rand() < Math.exp(delta / temp)
      : delta < 0 || rand() < Math.exp(-delta / temp);
    if (accept) {
      current = neighbor;
      currentFit = neighborFit;
      if (maximize ? currentFit > bestFit : currentFit < bestFit) {
        best = [...current];
        bestFit = currentFit;
      }
    }
    temp *= coolingRate;
  }
  return { algorithm: 'simulated_annealing', best_solution: best, best_fitness: bestFit, final_temperature: temp };
}

/** Gradient descent variants — O(epochs·samples·dim) */
export function gradientDescent({ gradient, initial, epochs = 100, learningRate = 0.01, variant = 'sgd', beta1 = 0.9, beta2 = 0.999 }) {
  if (typeof gradient !== 'function') throw new ResearchSolverError('gradient function required', 'INVALID_INPUT');
  let params = [...initial];
  let m = Array(params.length).fill(0);
  let v = Array(params.length).fill(0);
  const history = [];
  for (let e = 0; e < epochs; e += 1) {
    const grad = gradient(params);
    if (variant === 'sgd') {
      params = params.map((p, i) => p - learningRate * grad[i]);
    } else if (variant === 'rmsprop') {
      v = v.map((vi, i) => 0.9 * vi + 0.1 * grad[i] ** 2);
      params = params.map((p, i) => p - (learningRate * grad[i]) / (Math.sqrt(v[i]) + EPS));
    } else if (variant === 'adam') {
      m = m.map((mi, i) => beta1 * mi + (1 - beta1) * grad[i]);
      v = v.map((vi, i) => beta2 * vi + (1 - beta2) * grad[i] ** 2);
      const mHat = m.map((mi) => mi / (1 - beta1 ** (e + 1)));
      const vHat = v.map((vi) => vi / (1 - beta2 ** (e + 1)));
      params = params.map((p, i) => p - (learningRate * mHat[i]) / (Math.sqrt(vHat[i]) + EPS));
    } else {
      throw new ResearchSolverError(`Unknown gradient variant: ${variant}`, 'INVALID_INPUT');
    }
    history.push([...params]);
  }
  return { algorithm: `gradient_descent_${variant}`, parameters: params, history_length: history.length };
}

/** Ant Colony Optimization for TSP — O(iterations·ants·n²) */
export function antColonyOptimization({ distances, iterations = 100, ants = 20, alpha = 1, beta = 2, evaporation = 0.5, q = 100 }) {
  assertArray('distances', distances);
  const n = distances.length;
  if (distances.some((row) => row.length !== n)) {
    throw new ResearchSolverError('distances must be a square matrix', 'INVALID_INPUT');
  }
  let pheromone = Array.from({ length: n }, () => Array(n).fill(1));
  let bestTour = null;
  let bestLen = Infinity;

  const tourLength = (tour) => {
    let len = 0;
    for (let i = 0; i < n - 1; i += 1) len += distances[tour[i]][tour[i + 1]];
    len += distances[tour[n - 1]][tour[0]];
    return len;
  };

  for (let iter = 0; iter < iterations; iter += 1) {
    for (let a = 0; a < ants; a += 1) {
      const unvisited = new Set(Array.from({ length: n }, (_, i) => i));
      const tour = [randInt(n)];
      unvisited.delete(tour[0]);
      while (unvisited.size > 0) {
        const current = tour[tour.length - 1];
        const candidates = [...unvisited];
        const weights = candidates.map((j) => {
          const tau = pheromone[current][j] ** alpha;
          const eta = (1 / (distances[current][j] + EPS)) ** beta;
          return tau * eta;
        });
        const sum = weights.reduce((s, w) => s + w, 0);
        let r = rand() * sum;
        let chosen = candidates[0];
        for (let k = 0; k < candidates.length; k += 1) {
          r -= weights[k];
          if (r <= 0) { chosen = candidates[k]; break; }
        }
        tour.push(chosen);
        unvisited.delete(chosen);
      }
      const len = tourLength(tour);
      if (len < bestLen) { bestLen = len; bestTour = [...tour]; }
      for (let i = 0; i < n - 1; i += 1) {
        pheromone[tour[i]][tour[i + 1]] += q / len;
        pheromone[tour[i + 1]][tour[i]] += q / len;
      }
      pheromone[tour[n - 1]][tour[0]] += q / len;
      pheromone[tour[0]][tour[n - 1]] += q / len;
    }
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) pheromone[i][j] *= 1 - evaporation;
    }
  }
  return { algorithm: 'ant_colony', best_tour: bestTour, tour_length: bestLen, iterations };
}
