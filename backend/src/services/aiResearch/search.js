import { ResearchSolverError, assertArray, euclidean, manhattan, nearZero, clone } from './algorithms.js';

// ─── 6. SEARCH & CSP ─────────────────────────────────────────────────────────

/** A* pathfinding — O(E log V) with binary heap simplified */
export function aStar({ graph, start, goal, heuristic = 'manhattan', coords = null }) {
  if (!graph[start] || !graph[goal]) throw new ResearchSolverError('Invalid start or goal node', 'INVALID_INPUT');
  const h = (node) => {
    if (!coords || !coords[node] || !coords[goal]) return 0;
    const fn = heuristic === 'euclidean' ? euclidean : manhattan;
    return fn(coords[node], coords[goal]);
  };
  const open = [{ node: start, f: h(start), g: 0 }];
  const cameFrom = {};
  const gScore = { [start]: 0 };
  const closed = new Set();
  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const { node: current } = open.shift();
    if (current === goal) {
      const path = [current];
      while (cameFrom[path[0]]) path.unshift(cameFrom[path[0]]);
      return { algorithm: 'a_star', path, cost: gScore[goal] };
    }
    closed.add(current);
    for (const [neighbor, cost] of Object.entries(graph[current] || {})) {
      if (closed.has(neighbor)) continue;
      const tentative = gScore[current] + cost;
      if (tentative < (gScore[neighbor] ?? Infinity)) {
        cameFrom[neighbor] = current;
        gScore[neighbor] = tentative;
        const f = tentative + h(neighbor);
        if (!open.find((o) => o.node === neighbor)) open.push({ node: neighbor, f, g: tentative });
      }
    }
  }
  return { algorithm: 'a_star', path: null, message: 'No path found' };
}

/** Dijkstra shortest path — O(V²) */
export function dijkstra({ graph, start }) {
  const dist = {};
  const prev = {};
  const unvisited = new Set(Object.keys(graph));
  for (const v of unvisited) dist[v] = Infinity;
  dist[start] = 0;
  while (unvisited.size > 0) {
    let u = null;
    let minD = Infinity;
    for (const v of unvisited) if (dist[v] < minD) { minD = dist[v]; u = v; }
    if (u === null) break;
    unvisited.delete(u);
    for (const [v, w] of Object.entries(graph[u] || {})) {
      const alt = dist[u] + w;
      if (alt < dist[v]) { dist[v] = alt; prev[v] = u; }
    }
  }
  return { algorithm: 'dijkstra', distances: dist, predecessors: prev };
}

/** AC-3 constraint propagation — O(ed²) */
export function ac3({ variables, domains, constraints }) {
  const queue = constraints.map((c) => [c[0], c[1]]);
  const revised = [];
  while (queue.length > 0) {
    const [xi, xj] = queue.shift();
    let revisedFlag = false;
    for (const vi of [...(domains[xi] || [])]) {
      const hasSupport = (domains[xj] || []).some((vj) =>
        constraints.every(([a, b]) => (a !== xi || b !== xj) || vi !== vj));
      if (!hasSupport) {
        domains[xi] = domains[xi].filter((v) => v !== vi);
        revisedFlag = true;
        if (domains[xi].length === 0) return { algorithm: 'ac3', consistent: false, domains };
      }
    }
    if (revisedFlag) {
      revised.push(xi);
      for (const xk of variables) {
        if (xk !== xi && constraints.some(([a, b]) => (a === xk && b === xi) || (a === xi && b === xk))) {
          queue.push([xk, xi]);
        }
      }
    }
  }
  return { algorithm: 'ac3', consistent: true, domains, revised };
}

/** Backtracking CSP with forward checking — O(d^n) worst case */
export function backtrackingCSP({ variables, domains, constraints }) {
  const assignment = {};
  const isConsistent = (varName, value) => {
    assignment[varName] = value;
    for (const [a, b, op] of constraints) {
      if (assignment[a] !== undefined && assignment[b] !== undefined) {
        if (op === 'neq' && assignment[a] === assignment[b]) return false;
        if (op === 'eq' && assignment[a] !== assignment[b]) return false;
      }
    }
    return true;
  };
  const backtrack = (idx) => {
    if (idx >= variables.length) return { ...assignment };
    const varName = variables[idx];
    for (const value of domains[varName]) {
      if (isConsistent(varName, value)) {
        const result = backtrack(idx + 1);
        if (result) return result;
      }
      delete assignment[varName];
    }
    return null;
  };
  const solution = backtrack(0);
  return { algorithm: 'backtracking_csp', solution, solved: solution !== null };
}

/** Minimax with alpha-beta pruning — O(b^(d/2)) */
export function minimaxAlphaBeta({ tree, depth, maximizingPlayer = true, alpha = -Infinity, beta = Infinity }) {
  const evaluate = (node) => (typeof node === 'number' ? node : null);
  const mm = (node, d, maxPlayer, a, b) => {
    const val = evaluate(node);
    if (val !== null || d === 0) return val ?? 0;
    const children = node.children || [];
    if (maxPlayer) {
      let v = -Infinity;
      for (const child of children) {
        v = Math.max(v, mm(child, d - 1, false, a, b));
        a = Math.max(a, v);
        if (b <= a) break;
      }
      return v;
    }
    let v = Infinity;
    for (const child of children) {
      v = Math.min(v, mm(child, d - 1, true, a, b));
      b = Math.min(b, v);
      if (b <= a) break;
    }
    return v;
  };
  const value = mm(tree, depth, maximizingPlayer, alpha, beta);
  return { algorithm: 'minimax_alpha_beta', value, depth };
}
