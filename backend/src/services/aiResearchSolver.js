/**
 * OWNAI AI Research Problem Solver
 * Unified dispatcher for optimization, ML, NLP, graph, RL, statistics, signal, and combinatorial algorithms.
 * All algorithms implemented from first principles — no external ML libraries.
 */

export { ResearchSolverError } from './aiResearch/algorithms.js';

import { ResearchSolverError } from './aiResearch/algorithms.js';
import {
  geneticAlgorithm, particleSwarmOptimization, simulatedAnnealing, gradientDescent, antColonyOptimization,
} from './aiResearch/algorithms.js';
import {
  decisionTree, randomForest, naiveBayes, knn, svm, logisticRegression,
} from './aiResearch/classification.js';
import {
  kMeansPlusPlus, dbscan, hierarchicalClustering, gaussianMixtureModel, optics,
} from './aiResearch/clustering.js';
import {
  regression, arima, holtWinters, randomForestRegression, gaussianProcessRegression,
  pca, tsne, umap, lda, autoencoder,
} from './aiResearch/regression.js';
import {
  aStar, dijkstra, ac3, backtrackingCSP, minimaxAlphaBeta,
} from './aiResearch/search.js';
import {
  tfidf, levenshtein, ngramModel, textRankSummarize, sentimentAnalysis, namedEntityRecognition,
} from './aiResearch/nlp.js';
import {
  pageRank, louvain, girvanNewman, centrality, fordFulkerson, edmondsKarp, primMST, kruskalMST,
} from './aiResearch/graph.js';
import {
  qLearning, sarsa, monteCarlo, reinforce as reinforcePolicy, deepQLearning,
} from './aiResearch/reinforcement.js';
import {
  metropolisHastings, tTest, chiSquare, anova, bootstrap, abTest, anomalyDetection,
} from './aiResearch/statistics.js';
import {
  fft, haarWavelet, sobelEdge, laplacianEdge, cannyEdge, convolve2d, colorQuantization,
} from './aiResearch/signal.js';
import {
  knapsack01, knapsackFractional, binPackingFFD, johnsonsRule, welshPowell, dsatur, hungarian,
} from './aiResearch/combinatorial.js';
import { buildSafeObjective } from '../utils/safeExpression.js';

/** Registry of all supported algorithms by category */
export const ALGORITHM_REGISTRY = {
  optimization: [
    'genetic_algorithm', 'particle_swarm', 'simulated_annealing',
    'gradient_descent_sgd', 'gradient_descent_adam', 'gradient_descent_rmsprop', 'ant_colony',
  ],
  classification: [
    'id3', 'c4.5', 'random_forest', 'naive_bayes_gaussian', 'naive_bayes_multinomial',
    'knn', 'svm_linear', 'svm_rbf', 'svm_polynomial', 'logistic_regression',
  ],
  clustering: ['kmeans_plus_plus', 'dbscan', 'hierarchical_clustering', 'gaussian_mixture_model', 'optics'],
  regression: [
    'regression_none', 'regression_ridge', 'regression_lasso', 'regression_elasticnet',
    'arima', 'holt_winters', 'random_forest_regression', 'gaussian_process_regression',
  ],
  dimensionality_reduction: ['pca', 'tsne', 'umap', 'lda', 'autoencoder'],
  search: ['a_star', 'dijkstra', 'ac3', 'backtracking_csp', 'minimax_alpha_beta'],
  nlp: ['tfidf', 'levenshtein', 'ngram', 'textrank', 'sentiment_lexicon', 'ner_hmm'],
  graph: [
    'pagerank', 'louvain', 'girvan_newman', 'centrality',
    'ford_fulkerson', 'edmonds_karp', 'prim_mst', 'kruskal_mst',
  ],
  reinforcement: ['q_learning', 'sarsa', 'monte_carlo', 'reinforce', 'dqn'],
  statistics: [
    'metropolis_hastings', 't_test', 'chi_square', 'anova',
    'bootstrap', 'ab_test', 'anomaly_zscore', 'anomaly_iqr', 'isolation_forest',
  ],
  signal: ['fft', 'haar_wavelet', 'sobel', 'laplacian', 'canny', 'convolution', 'kmeans_color_quantization'],
  combinatorial: [
    'knapsack_01', 'knapsack_fractional', 'bin_packing_ffd', 'johnsons_rule',
    'welsh_powell', 'dsatur', 'hungarian',
  ],
};

/**
 * Build a numeric fitness function from a string expression.
 * Variables: x0, x1, ... or x for single dimension.
 * @param {string} expression
 * @param {number} dimensions
 */
function buildObjective(expression, dimensions = 1) {
  let evaluate;
  try {
    evaluate = buildSafeObjective(expression, dimensions);
  } catch (error) {
    throw new ResearchSolverError(error.message, error.code || 'EVAL_ERROR');
  }
  return (point) => {
    try {
      return evaluate(point);
    } catch (error) {
      throw new ResearchSolverError(error.message, error.code || 'EVAL_ERROR');
    }
  };
}

function buildGradient(expression, dimensions = 1) {
  const h = 1e-6;
  const f = buildObjective(expression, dimensions);
  return (point) => point.map((_, d) => {
    const up = [...point];
    const down = [...point];
    up[d] += h;
    down[d] -= h;
    return (f(up) - f(down)) / (2 * h);
  });
}

function requireAlgorithm(algorithm, category) {
  if (!algorithm) throw new ResearchSolverError('algorithm field is required', 'INVALID_INPUT');
  const allowed = ALGORITHM_REGISTRY[category];
  if (!allowed?.includes(algorithm)) {
    throw new ResearchSolverError(
      `Unknown algorithm '${algorithm}' for ${category}. Supported: ${allowed?.join(', ')}`,
      'UNKNOWN_ALGORITHM',
    );
  }
}

/** Category 1: Optimization — dispatches GA, PSO, SA, GD, ACO */
export function optimize(params) {
  const { algorithm, expression, bounds, initial, distances, options = {} } = params;
  requireAlgorithm(algorithm, 'optimization');

  if (algorithm === 'genetic_algorithm') {
    const dims = bounds?.length || 1;
    const fitness = expression ? buildObjective(expression, dims) : options.fitnessFn;
    if (!fitness && !options.fitness_matrix) {
      throw new ResearchSolverError('expression or fitness data required', 'INVALID_INPUT');
    }
    return geneticAlgorithm({
      fitness: fitness || ((ind) => -ind.reduce((s, v) => s + v ** 2, 0)),
      dimensions: dims,
      bounds: bounds || [[-10, 10]],
      ...options,
    });
  }

  if (algorithm === 'particle_swarm') {
    const fitness = buildObjective(expression || 'x^2', bounds?.length || 1);
    return particleSwarmOptimization({ fitness, bounds: bounds || [[-10, 10]], ...options });
  }

  if (algorithm === 'simulated_annealing') {
    const fitness = buildObjective(expression || 'x^2', bounds?.length || 1);
    const init = initial || (bounds || [[-10, 10]]).map(([lo, hi]) => (lo + hi) / 2);
    return simulatedAnnealing({ fitness, initial: init, bounds: bounds || [[-10, 10]], ...options });
  }

  if (algorithm.startsWith('gradient_descent_')) {
    const variant = algorithm.replace('gradient_descent_', '');
    const gradient = buildGradient(expression || 'x^2', (initial || [1]).length);
    return gradientDescent({ gradient, initial: initial || [1], variant, ...options });
  }

  if (algorithm === 'ant_colony') {
    if (!distances) throw new ResearchSolverError('distances matrix required for ant_colony', 'INVALID_INPUT');
    return antColonyOptimization({ distances, ...options });
  }

  throw new ResearchSolverError(`Optimization algorithm not implemented: ${algorithm}`, 'NOT_IMPLEMENTED');
}

/** Category 2: Classification */
export function classify(params) {
  const { algorithm, data, labels, test, options = {} } = params;
  requireAlgorithm(algorithm, 'classification');

  if (algorithm === 'id3' || algorithm === 'c4.5') {
    return decisionTree({ data, labels, variant: algorithm, ...options });
  }
  if (algorithm === 'random_forest') return randomForest({ data, labels, ...options });
  if (algorithm === 'naive_bayes_gaussian') return naiveBayes({ data, labels, test, type: 'gaussian' });
  if (algorithm === 'naive_bayes_multinomial') return naiveBayes({ data, labels, test, type: 'multinomial' });
  if (algorithm === 'knn') return knn({ data, labels, test, ...options });
  if (algorithm.startsWith('svm_')) {
    const kernel = algorithm.replace('svm_', '');
    return svm({ data, labels, kernel, ...options });
  }
  if (algorithm === 'logistic_regression') return logisticRegression({ data, labels, ...options });

  throw new ResearchSolverError(`Classification algorithm not implemented: ${algorithm}`, 'NOT_IMPLEMENTED');
}

/** Category 3: Clustering */
export function cluster(params) {
  const { algorithm, data, options = {} } = params;
  requireAlgorithm(algorithm, 'clustering');

  const runners = {
    kmeans_plus_plus: () => kMeansPlusPlus({ data, ...options }),
    dbscan: () => dbscan({ data, ...options }),
    hierarchical_clustering: () => hierarchicalClustering({ data, ...options }),
    gaussian_mixture_model: () => gaussianMixtureModel({ data, ...options }),
    optics: () => optics({ data, ...options }),
  };
  const run = runners[algorithm];
  if (!run) throw new ResearchSolverError(`Clustering algorithm not implemented: ${algorithm}`, 'NOT_IMPLEMENTED');
  return run();
}

/** Category 4: Prediction (regression + forecasting) */
export function predict(params) {
  const { algorithm, x, y, series, options = {} } = params;

  if (ALGORITHM_REGISTRY.regression.includes(algorithm)) {
    if (algorithm.startsWith('regression_')) {
      const regularization = algorithm.replace('regression_', '');
      return regression({ x, y, regularization: regularization === 'none' ? 'none' : regularization, ...options });
    }
    if (algorithm === 'arima') return arima({ series, ...options });
    if (algorithm === 'holt_winters') return holtWinters({ series, ...options });
    if (algorithm === 'random_forest_regression') return randomForestRegression({ x, y, ...options });
    if (algorithm === 'gaussian_process_regression') {
      return gaussianProcessRegression({ xTrain: x, yTrain: y, ...options });
    }
  }

  requireAlgorithm(algorithm, 'regression');
  throw new ResearchSolverError(`Prediction algorithm not implemented: ${algorithm}`, 'NOT_IMPLEMENTED');
}

/** Category 5: Dimensionality reduction */
export function reduceDimensions(params) {
  const { algorithm, data, labels, options = {} } = params;
  requireAlgorithm(algorithm, 'dimensionality_reduction');

  const runners = {
    pca: () => pca({ data, ...options }),
    tsne: () => tsne({ data, ...options }),
    umap: () => umap({ data, ...options }),
    lda: () => lda({ data, labels, ...options }),
    autoencoder: () => autoencoder({ data, ...options }),
  };
  return runners[algorithm]?.() ?? (() => { throw new ResearchSolverError(`Not implemented: ${algorithm}`); })();
}

/** Category 6: Search & CSP */
export function search(params) {
  const { algorithm, options = {} } = params;
  requireAlgorithm(algorithm, 'search');

  const runners = {
    a_star: () => aStar(options),
    dijkstra: () => dijkstra(options),
    ac3: () => ac3(options),
    backtracking_csp: () => backtrackingCSP(options),
    minimax_alpha_beta: () => minimaxAlphaBeta(options),
  };
  return runners[algorithm]?.() ?? (() => { throw new ResearchSolverError(`Not implemented: ${algorithm}`); })();
}

/** Category 7: NLP */
export function nlp(params) {
  const { algorithm, options = {} } = params;
  requireAlgorithm(algorithm, 'nlp');

  const runners = {
    tfidf: () => tfidf(options),
    levenshtein: () => levenshtein(options.a, options.b),
    ngram: () => ngramModel(options),
    textrank: () => textRankSummarize(options),
    sentiment_lexicon: () => sentimentAnalysis(options),
    ner_hmm: () => namedEntityRecognition(options),
  };
  return runners[algorithm]?.() ?? (() => { throw new ResearchSolverError(`Not implemented: ${algorithm}`); })();
}

/** Category 8: Graph analysis */
export function graph(params) {
  const { algorithm, options = {} } = params;
  requireAlgorithm(algorithm, 'graph');

  const runners = {
    pagerank: () => pageRank(options),
    louvain: () => louvain(options),
    girvan_newman: () => girvanNewman(options),
    centrality: () => centrality(options),
    ford_fulkerson: () => fordFulkerson(options),
    edmonds_karp: () => edmondsKarp(options),
    prim_mst: () => primMST(options),
    kruskal_mst: () => kruskalMST(options),
  };
  return runners[algorithm]?.() ?? (() => { throw new ResearchSolverError(`Not implemented: ${algorithm}`); })();
}

/** Category 9: Reinforcement learning */
export function reinforcementLearning(params) {
  const { algorithm, options = {} } = params;
  requireAlgorithm(algorithm, 'reinforcement');

  const runners = {
    q_learning: () => qLearning(options),
    sarsa: () => sarsa(options),
    monte_carlo: () => monteCarlo(options),
    reinforce: () => reinforcePolicy(options),
    dqn: () => deepQLearning(options),
  };
  return runners[algorithm]?.() ?? (() => { throw new ResearchSolverError(`Not implemented: ${algorithm}`); })();
}

/** Category 10: Statistical inference */
export function inferStatistics(params) {
  const { algorithm, options = {} } = params;
  requireAlgorithm(algorithm, 'statistics');

  if (algorithm === 't_test') return tTest(options);
  if (algorithm === 'chi_square') return chiSquare(options);
  if (algorithm === 'anova') return anova(options);
  if (algorithm === 'bootstrap') return bootstrap(options);
  if (algorithm === 'ab_test') return abTest(options);
  if (algorithm === 'metropolis_hastings') {
    if (options.logPosteriorExpression) {
      const logPosterior = buildSafeObjective(options.logPosteriorExpression, (options.initial || [0]).length);
      return metropolisHastings({ logPosterior, initial: options.initial, ...options });
    }
    throw new ResearchSolverError('logPosteriorExpression required for metropolis_hastings', 'INVALID_INPUT');
  }
  if (algorithm.startsWith('anomaly_') || algorithm === 'isolation_forest') {
    const method = algorithm.replace('anomaly_', '') === 'zscore' ? 'zscore'
      : algorithm === 'isolation_forest' ? 'isolation_forest' : algorithm.replace('anomaly_', '');
    return anomalyDetection({ data: options.data, method, ...options });
  }

  throw new ResearchSolverError(`Statistics algorithm not implemented: ${algorithm}`, 'NOT_IMPLEMENTED');
}

/** Category 11: Signal processing */
export function processSignal(params) {
  const { algorithm, options = {} } = params;
  requireAlgorithm(algorithm, 'signal');

  const runners = {
    fft: () => ({ algorithm: 'fft', spectrum: fft(options.signal) }),
    haar_wavelet: () => haarWavelet(options.signal),
    sobel: () => sobelEdge(options),
    laplacian: () => laplacianEdge(options),
    canny: () => cannyEdge(options),
    convolution: () => convolve2d(options),
    kmeans_color_quantization: () => colorQuantization(options),
  };
  return runners[algorithm]?.() ?? (() => { throw new ResearchSolverError(`Not implemented: ${algorithm}`); })();
}

/** Category 12: Combinatorial optimization */
export function solveCombinatorial(params) {
  const { algorithm, options = {} } = params;
  requireAlgorithm(algorithm, 'combinatorial');

  const runners = {
    knapsack_01: () => knapsack01(options),
    knapsack_fractional: () => knapsackFractional(options),
    bin_packing_ffd: () => binPackingFFD(options),
    johnsons_rule: () => johnsonsRule(options),
    welsh_powell: () => welshPowell(options),
    dsatur: () => dsatur(options),
    hungarian: () => hungarian(options),
  };
  return runners[algorithm]?.() ?? (() => { throw new ResearchSolverError(`Not implemented: ${algorithm}`); })();
}

/**
 * Recommend the best algorithm(s) for a given problem type.
 * @param {{ problemType: string, dataSize?: number, dimensions?: number, labeled?: boolean, text?: boolean, graph?: boolean }}
 */
export function autoSuggestAlgorithm({ problemType, dataSize = 100, dimensions = 2, labeled = false, text = false, graph = false }) {
  const suggestions = {
    traveling_salesman: ['ant_colony', 'genetic_algorithm', 'simulated_annealing'],
    continuous_optimization: ['particle_swarm', 'simulated_annealing', 'gradient_descent_adam'],
    resource_allocation: ['knapsack_01', 'hungarian', 'genetic_algorithm'],
    classification: labeled
      ? (dataSize > 1000 ? ['random_forest', 'svm_rbf', 'logistic_regression'] : ['knn', 'naive_bayes_gaussian', 'id3'])
      : ['kmeans_plus_plus', 'dbscan'],
    clustering: dataSize > 500 ? ['dbscan', 'gaussian_mixture_model', 'kmeans_plus_plus'] : ['kmeans_plus_plus', 'hierarchical_clustering'],
    time_series: ['arima', 'holt_winters', 'gaussian_process_regression'],
    regression: ['regression_ridge', 'random_forest_regression', 'gaussian_process_regression'],
    dimensionality_reduction: dimensions > 10 ? ['pca', 'umap'] : ['pca', 'tsne'],
    pathfinding: ['a_star', 'dijkstra'],
    constraint_satisfaction: ['ac3', 'backtracking_csp'],
    nlp: text ? ['tfidf', 'sentiment_lexicon', 'textrank', 'ner_hmm'] : ['levenshtein', 'ngram'],
    network_analysis: graph ? ['pagerank', 'louvain', 'centrality'] : ['pagerank'],
    reinforcement_learning: ['q_learning', 'sarsa', 'dqn'],
    hypothesis_testing: ['t_test', 'chi_square', 'anova', 'bootstrap'],
    anomaly_detection: ['anomaly_zscore', 'anomaly_iqr', 'isolation_forest'],
    signal_processing: ['fft', 'haar_wavelet', 'sobel'],
    bin_packing: ['bin_packing_ffd'],
    graph_coloring: ['dsatur', 'welsh_powell'],
  };

  const normalized = problemType?.toLowerCase().replace(/\s+/g, '_');
  const recommended = suggestions[normalized];

  if (!recommended) {
    return {
      problem_type: problemType,
      message: 'No exact match — returning general recommendations based on flags',
      recommended: [
        ...(labeled ? ['random_forest', 'logistic_regression'] : ['kmeans_plus_plus']),
        ...(text ? ['tfidf', 'sentiment_lexicon'] : []),
        ...(graph ? ['pagerank', 'dijkstra'] : []),
      ],
      available_problem_types: Object.keys(suggestions),
    };
  }

  return {
    problem_type: problemType,
    recommended,
    rationale: `Selected based on problem type '${normalized}' with dataSize=${dataSize}, dimensions=${dimensions}`,
    alternatives: recommended.slice(1),
    primary: recommended[0],
  };
}

/** List all algorithms grouped by category */
export function listAlgorithms() {
  return ALGORITHM_REGISTRY;
}
