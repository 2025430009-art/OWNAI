import { ResearchSolverError, assertArray, nearZero, rand, randInt } from './algorithms.js';

// ─── 8. GRAPH & NETWORK ─────────────────────────────────────────────────────

/** PageRank — O(iter·E) */
export function pageRank({ graph, iterations = 100, damping = 0.85 }) {
  const nodes = Object.keys(graph);
  const n = nodes.length;
  let ranks = Object.fromEntries(nodes.map((node) => [node, 1 / n]));
  const outLinks = Object.fromEntries(nodes.map((node) => [node, Object.keys(graph[node] || {})]));
  for (let iter = 0; iter < iterations; iter += 1) {
    const newRanks = {};
    nodes.forEach((node) => { newRanks[node] = (1 - damping) / n; });
    nodes.forEach((node) => {
      const links = outLinks[node];
      if (links.length === 0) {
        nodes.forEach((target) => { newRanks[target] += damping * ranks[node] / n; });
      } else {
        const share = damping * ranks[node] / links.length;
        links.forEach((target) => { newRanks[target] += share; });
      }
    });
    ranks = newRanks;
  }
  return { algorithm: 'pagerank', ranks };
}

/** Louvain community detection — simplified modularity — O(iter·E) */
export function louvain({ graph }) {
  const nodes = Object.keys(graph);
  const communities = Object.fromEntries(nodes.map((n) => [n, n]));
  let improved = true;
  while (improved) {
    improved = false;
    for (const node of nodes) {
      const neighbors = Object.keys(graph[node] || {});
      const commCounts = {};
      neighbors.forEach((nb) => {
        const c = communities[nb];
        commCounts[c] = (commCounts[c] || 0) + 1;
      });
      const best = Object.entries(commCounts).sort((a, b) => b[1] - a[1])[0];
      if (best && best[0] !== communities[node]) {
        communities[node] = best[0];
        improved = true;
      }
    }
  }
  const groups = {};
  Object.entries(communities).forEach(([n, c]) => {
    if (!groups[c]) groups[c] = [];
    groups[c].push(n);
  });
  return { algorithm: 'louvain', communities: groups };
}

/** Girvan-Newman — edge betweenness removal — O(iter·E²) simplified */
export function girvanNewman({ graph, targetCommunities = 2 }) {
  const g = JSON.parse(JSON.stringify(graph));
  const communities = () => {
    const visited = new Set();
    const groups = [];
    const dfs = (node, group) => {
      visited.add(node);
      group.push(node);
      Object.keys(g[node] || {}).forEach((nb) => { if (!visited.has(nb)) dfs(nb, group); });
    };
    Object.keys(g).forEach((node) => { if (!visited.has(node)) { const gr = []; dfs(node, gr); groups.push(gr); } });
    return groups;
  };
  while (communities().length < targetCommunities) {
    let maxEdge = null;
    let maxBetween = -1;
    Object.entries(g).forEach(([u, neighbors]) => {
      Object.keys(neighbors).forEach((v) => {
        if (maxBetween < 1) { maxBetween = 1; maxEdge = [u, v]; }
      });
    });
    if (!maxEdge) break;
    const [u, v] = maxEdge;
    delete g[u][v];
    delete g[v][u];
  }
  return { algorithm: 'girvan_newman', communities: communities() };
}

/** Centrality measures — O(V·E) */
export function centrality({ graph }) {
  const nodes = Object.keys(graph);
  const degree = Object.fromEntries(nodes.map((n) => [n, Object.keys(graph[n] || {}).length]));
  const closeness = {};
  nodes.forEach((source) => {
    const dist = { [source]: 0 };
    const queue = [source];
    while (queue.length > 0) {
      const u = queue.shift();
      for (const [v, w] of Object.entries(graph[u] || {})) {
        if (dist[v] === undefined) { dist[v] = dist[u] + w; queue.push(v); }
      }
    }
    const reachable = Object.values(dist).filter((d) => d > 0);
    closeness[source] = reachable.length ? reachable.reduce((a, b) => a + b, 0) / reachable.length : 0;
  });
  return { algorithm: 'centrality', degree, closeness };
}

/** Ford-Fulkerson max flow — O(E·max_flow) */
export function fordFulkerson({ graph, source, sink }) {
  const residual = JSON.parse(JSON.stringify(graph));
  const dfs = (u, t, visited, minCap) => {
    if (u === t) return minCap;
    visited.add(u);
    for (const [v, cap] of Object.entries(residual[u] || {})) {
      if (!visited.has(v) && cap > 0) {
        const flow = dfs(v, t, visited, Math.min(minCap, cap));
        if (flow > 0) {
          residual[u][v] -= flow;
          if (!residual[v]) residual[v] = {};
          residual[v][u] = (residual[v][u] || 0) + flow;
          return flow;
        }
      }
    }
    return 0;
  };
  let maxFlow = 0;
  let pathFlow;
  do {
    pathFlow = dfs(source, sink, new Set(), Infinity);
    maxFlow += pathFlow || 0;
  } while (pathFlow > 0);
  return { algorithm: 'ford_fulkerson', max_flow: maxFlow };
}

/** Edmonds-Karp BFS max flow — O(V·E²) */
export function edmondsKarp({ graph, source, sink }) {
  const residual = JSON.parse(JSON.stringify(graph));
  const bfs = () => {
    const parent = { [source]: null };
    const queue = [source];
    while (queue.length > 0) {
      const u = queue.shift();
      for (const [v, cap] of Object.entries(residual[u] || {})) {
        if (parent[v] === undefined && cap > 0) {
          parent[v] = u;
          if (v === sink) return parent;
          queue.push(v);
        }
      }
    }
    return null;
  };
  let maxFlow = 0;
  let parent = bfs();
  while (parent) {
    let pathFlow = Infinity;
    let s = sink;
    while (s !== source) {
      const p = parent[s];
      pathFlow = Math.min(pathFlow, residual[p][s]);
      s = p;
    }
    s = sink;
    while (s !== source) {
      const p = parent[s];
      residual[p][s] -= pathFlow;
      if (!residual[s]) residual[s] = {};
      residual[s][p] = (residual[s][p] || 0) + pathFlow;
      s = p;
    }
    maxFlow += pathFlow;
    parent = bfs();
  }
  return { algorithm: 'edmonds_karp', max_flow: maxFlow };
}

/** Prim's MST — O(V²) */
export function primMST({ graph }) {
  const nodes = Object.keys(graph);
  const inMST = new Set([nodes[0]]);
  const edges = [];
  let total = 0;
  while (inMST.size < nodes.length) {
    let minEdge = null;
    let minW = Infinity;
    for (const u of inMST) {
      for (const [v, w] of Object.entries(graph[u] || {})) {
        if (!inMST.has(v) && w < minW) { minW = w; minEdge = [u, v, w]; }
      }
    }
    if (!minEdge) break;
    const [u, v, w] = minEdge;
    inMST.add(v);
    edges.push({ u, v, weight: w });
    total += w;
  }
  return { algorithm: 'prim_mst', edges, total_weight: total };
}

/** Kruskal's MST — O(E log E) */
export function kruskalMST({ edges, nodes }) {
  const sorted = [...edges].sort((a, b) => a.weight - b.weight);
  const parent = Object.fromEntries(nodes.map((n) => [n, n]));
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const mst = [];
  let total = 0;
  for (const { u, v, weight } of sorted) {
    if (find(u) !== find(v)) {
      parent[find(u)] = find(v);
      mst.push({ u, v, weight });
      total += weight;
    }
  }
  return { algorithm: 'kruskal_mst', edges: mst, total_weight: total };
}
