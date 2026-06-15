import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  optimize,
  classify,
  cluster,
  predict,
  reduceDimensions,
  search,
  nlp,
  graph,
  inferStatistics,
  solveCombinatorial,
  autoSuggestAlgorithm,
  listAlgorithms,
  ResearchSolverError,
} from '../src/services/aiResearchSolver.js';

describe('aiResearchSolver', () => {
  it('lists all algorithm categories', () => {
    const registry = listAlgorithms();
    assert.ok(registry.optimization.length >= 5);
    assert.ok(registry.classification.length >= 5);
    assert.ok(registry.clustering.length >= 4);
  });

  it('auto-suggests algorithms for TSP', () => {
    const result = autoSuggestAlgorithm({ problemType: 'traveling_salesman' });
    assert.ok(result.recommended.includes('ant_colony'));
    assert.equal(result.primary, 'ant_colony');
  });

  it('runs particle swarm optimization', () => {
    const result = optimize({
      algorithm: 'particle_swarm',
      expression: 'x^2',
      bounds: [[-5, 5]],
      options: { particles: 10, iterations: 20 },
    });
    assert.equal(result.algorithm, 'particle_swarm');
    assert.ok(Math.abs(result.best_solution[0]) < 1);
  });

  it('runs k-means clustering', () => {
    const data = [[0, 0], [0.1, 0.1], [5, 5], [5.1, 5.1]];
    const result = cluster({ algorithm: 'kmeans_plus_plus', data, options: { k: 2 } });
    assert.equal(result.algorithm, 'kmeans_plus_plus');
    assert.equal(result.centroids.length, 2);
  });

  it('runs knn classification', () => {
    const data = [[0], [1], [2], [10], [11], [12]];
    const labels = ['A', 'A', 'A', 'B', 'B', 'B'];
    const result = classify({
      algorithm: 'knn',
      data,
      labels,
      test: [[0.5], [10.5]],
      options: { k: 1 },
    });
    assert.equal(result.algorithm, 'knn');
    assert.equal(result.predictions[0], 'A');
    assert.equal(result.predictions[1], 'B');
  });

  it('runs linear regression', () => {
    const result = predict({
      algorithm: 'regression_none',
      x: [1, 2, 3, 4],
      y: [2, 4, 6, 8],
    });
    assert.ok(result.coefficients);
    assert.ok(result.mse < 0.01);
  });

  it('runs PCA', () => {
    const data = [[2.5, 2.4], [0.7, 0.7], [2.2, 2.9], [1.9, 2.2]];
    const result = reduceDimensions({ algorithm: 'pca', data, options: { components: 1 } });
    assert.equal(result.algorithm, 'pca');
    assert.equal(result.projected[0].length, 1);
  });

  it('runs dijkstra', () => {
    const result = search({
      algorithm: 'dijkstra',
      options: {
        graph: { A: { B: 1, C: 4 }, B: { C: 2 }, C: {} },
        start: 'A',
      },
    });
    assert.equal(result.distances.C, 3);
  });

  it('runs TF-IDF', () => {
    const result = nlp({
      algorithm: 'tfidf',
      options: { documents: ['hello world', 'hello ai'] },
    });
    assert.equal(result.algorithm, 'tfidf');
    assert.ok(result.vocabulary.includes('hello'));
  });

  it('runs PageRank', () => {
    const result = graph({
      algorithm: 'pagerank',
      options: { graph: { A: { B: 1 }, B: { C: 1 }, C: { A: 1 } } },
    });
    assert.ok(result.ranks.A > 0);
  });

  it('runs t-test', () => {
    const result = inferStatistics({
      algorithm: 't_test',
      options: { sample1: [1, 2, 3], sample2: [4, 5, 6] },
    });
    assert.ok(result.t_statistic);
  });

  it('solves 0/1 knapsack', () => {
    const result = solveCombinatorial({
      algorithm: 'knapsack_01',
      options: { weights: [2, 3, 4], values: [3, 4, 5], capacity: 5 },
    });
    assert.equal(result.algorithm, 'knapsack_01');
    assert.ok(result.max_value >= 7);
  });

  it('throws on unknown algorithm', () => {
    assert.throws(() => optimize({ algorithm: 'unknown_algo' }), ResearchSolverError);
  });
});
