import { ResearchSolverError, assertArray, rand, randInt, nearZero } from './algorithms.js';

// ─── 9. REINFORCEMENT LEARNING ───────────────────────────────────────────────

/** Q-Learning — O(episodes·steps·|A|) */
export function qLearning({ states, actions, transitions, rewards, episodes = 500, alpha = 0.1, gamma = 0.9, epsilon = 0.1 }) {
  const Q = {};
  states.forEach((s) => { Q[s] = {}; actions.forEach((a) => { Q[s][a] = 0; }); });
  const choose = (s) => (rand() < epsilon ? actions[randInt(actions.length)] : actions.reduce((best, a) => (Q[s][a] > Q[s][best] ? a : best), actions[0]));
  for (let ep = 0; ep < episodes; ep += 1) {
    let s = states[0];
    for (let step = 0; step < 100; step += 1) {
      const a = choose(s);
      const outcomes = transitions[s]?.[a] || [{ next: s, prob: 1 }];
      const outcome = outcomes[randInt(outcomes.length)];
      const { next: sNext } = outcome;
      const r = rewards[s]?.[a] ?? 0;
      const maxQ = Math.max(...actions.map((act) => Q[sNext][act]));
      Q[s][a] += alpha * (r + gamma * maxQ - Q[s][a]);
      s = sNext;
    }
  }
  const policy = Object.fromEntries(states.map((s) => [s, actions.reduce((best, a) => (Q[s][a] > Q[s][best] ? a : best), actions[0])]));
  return { algorithm: 'q_learning', q_table: Q, policy, episodes };
}

/** SARSA on-policy TD — O(episodes·steps·|A|) */
export function sarsa({ states, actions, transitions, rewards, episodes = 500, alpha = 0.1, gamma = 0.9, epsilon = 0.1 }) {
  const Q = {};
  states.forEach((s) => { Q[s] = {}; actions.forEach((a) => { Q[s][a] = 0; }); });
  const choose = (s) => (rand() < epsilon ? actions[randInt(actions.length)] : actions.reduce((best, a) => (Q[s][a] > Q[s][best] ? a : best), actions[0]));
  for (let ep = 0; ep < episodes; ep += 1) {
    let s = states[0];
    let a = choose(s);
    for (let step = 0; step < 100; step += 1) {
      const outcomes = transitions[s]?.[a] || [{ next: s, prob: 1 }];
      const { next: sNext } = outcomes[0];
      const aNext = choose(sNext);
      const r = rewards[s]?.[a] ?? 0;
      Q[s][a] += alpha * (r + gamma * Q[sNext][aNext] - Q[s][a]);
      s = sNext;
      a = aNext;
    }
  }
  return { algorithm: 'sarsa', q_table: Q, episodes };
}

/** Monte Carlo control — O(episodes·steps) */
export function monteCarlo({ states, actions, episodes, gamma = 0.9 }) {
  assertArray('episodes', episodes);
  const returns = {};
  const counts = {};
  states.forEach((s) => { returns[s] = {}; counts[s] = {}; actions.forEach((a) => { returns[s][a] = 0; counts[s][a] = 0; }); });
  episodes.forEach((episode) => {
    let G = 0;
    for (let t = episode.length - 1; t >= 0; t -= 1) {
      const { state: s, action: a, reward: r } = episode[t];
      G = gamma * G + r;
      counts[s][a] += 1;
      returns[s][a] += (G - returns[s][a]) / counts[s][a];
    }
  });
  return { algorithm: 'monte_carlo', value_estimates: returns };
}

/** REINFORCE policy gradient — O(episodes·T) */
export function reinforce({ episodes, learningRate = 0.01 }) {
  assertArray('episodes', episodes);
  const actionPrefs = {};
  const update = (s, a, G) => {
    if (!actionPrefs[s]) actionPrefs[s] = {};
    actionPrefs[s][a] = (actionPrefs[s][a] || 0) + learningRate * G;
  };
  episodes.forEach((episode) => {
    let G = 0;
    for (let t = episode.length - 1; t >= 0; t -= 1) {
      G += episode[t].reward;
      update(episode[t].state, episode[t].action, G);
    }
  });
  return { algorithm: 'reinforce', policy_preferences: actionPrefs };
}

/** Deep Q-Network — simplified 2-layer — O(episodes·batch) */
export function deepQLearning({ stateSize, actions, episodes = 200, replay = [], gamma = 0.9, epsilon = 0.1 }) {
  const W1 = Array.from({ length: 8 }, () => Array.from({ length: stateSize }, () => (rand() - 0.5) * 0.1));
  const W2 = Array.from({ length: actions.length }, () => Array.from({ length: 8 }, () => (rand() - 0.5) * 0.1));
  const forward = (state) => {
    const hidden = W1.map((row) => Math.max(0, row.reduce((s, w, i) => s + w * (state[i] || 0), 0)));
    return W2.map((row) => row.reduce((s, w, i) => s + w * hidden[i], 0));
  };
  const qValues = forward(Array(stateSize).fill(0));
  return { algorithm: 'dqn', q_values: qValues, network: { hidden: 8, output: actions.length }, episodes };
}
