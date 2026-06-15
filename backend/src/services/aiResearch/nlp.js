import { ResearchSolverError, assertArray, mean, stdDev, rand, dot, softmax } from './algorithms.js';

// ─── 7. NLP ──────────────────────────────────────────────────────────────────

/** TF-IDF vectorization — O(docs·terms) */
export function tfidf({ documents }) {
  assertArray('documents', documents);
  const vocab = [...new Set(documents.flatMap((d) => d.toLowerCase().split(/\s+/)))];
  const tf = documents.map((doc) => {
    const words = doc.toLowerCase().split(/\s+/);
    const counts = {};
    words.forEach((w) => { counts[w] = (counts[w] || 0) + 1; });
    return vocab.map((w) => (counts[w] || 0) / words.length);
  });
  const idf = vocab.map((w) => {
    const df = documents.filter((d) => d.toLowerCase().includes(w)).length;
    return Math.log((documents.length + 1) / (df + 1)) + 1;
  });
  const vectors = tf.map((row) => row.map((t, i) => t * idf[i]));
  return { algorithm: 'tfidf', vocabulary: vocab, vectors, idf };
}

/** Levenshtein distance — O(m·n) */
export function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return { algorithm: 'levenshtein', distance: dp[m][n], similarity: 1 - dp[m][n] / Math.max(m, n) };
}

/** N-gram language model — O(corpus) */
export function ngramModel({ corpus, n = 2 }) {
  assertArray('corpus', corpus);
  const counts = {};
  const contextCounts = {};
  corpus.forEach((text) => {
    const tokens = text.toLowerCase().split(/\s+/);
    for (let i = 0; i <= tokens.length - n; i += 1) {
      const gram = tokens.slice(i, i + n).join(' ');
      const ctx = tokens.slice(i, i + n - 1).join(' ');
      counts[gram] = (counts[gram] || 0) + 1;
      contextCounts[ctx] = (contextCounts[ctx] || 0) + 1;
    }
  });
  const predict = (context) => {
    const ctx = context.toLowerCase();
    const candidates = Object.entries(counts).filter(([g]) => g.startsWith(ctx));
    return candidates.sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g, c]) => ({
      ngram: g,
      probability: c / (contextCounts[ctx] || 1),
    }));
  };
  return { algorithm: 'ngram', n, vocabulary_size: Object.keys(counts).length, predict };
}

/** TextRank extractive summarization — O(sentences²) */
export function textRankSummarize({ text, sentences = 3 }) {
  const sents = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  if (sents.length <= sentences) return { algorithm: 'textrank', summary: sents };
  const sim = (a, b) => {
    const wa = new Set(a.toLowerCase().split(/\s+/));
    const wb = new Set(b.toLowerCase().split(/\s+/));
    const inter = [...wa].filter((w) => wb.has(w)).length;
    return inter / (Math.log(wa.size + 1) + Math.log(wb.size + 1) + 1);
  };
  const scores = Array(sents.length).fill(1);
  for (let iter = 0; iter < 20; iter += 1) {
    const newScores = scores.map((_, i) => {
      let s = 0;
      for (let j = 0; j < sents.length; j += 1) if (i !== j) s += sim(sents[i], sents[j]) * scores[j];
      return 0.85 * s + 0.15;
    });
    newScores.forEach((v, i) => { scores[i] = v; });
  }
  const ranked = sents.map((s, i) => ({ s, score: scores[i], i })).sort((a, b) => b.score - a.score);
  const summary = ranked.slice(0, sentences).sort((a, b) => a.i - b.i).map((r) => r.s);
  return { algorithm: 'textrank', summary };
}

const SENTIMENT_LEXICON = {
  good: 1, great: 1, excellent: 1, love: 1, happy: 1, amazing: 1, wonderful: 1,
  bad: -1, terrible: -1, hate: -1, awful: -1, sad: -1, poor: -1, horrible: -1,
};

/** Sentiment analysis — lexicon-based — O(words) */
export function sentimentAnalysis({ text }) {
  const words = text.toLowerCase().split(/\s+/);
  let score = 0;
  let hits = 0;
  words.forEach((w) => {
    if (SENTIMENT_LEXICON[w] !== undefined) { score += SENTIMENT_LEXICON[w]; hits += 1; }
  });
  const label = score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
  return { algorithm: 'sentiment_lexicon', label, score, confidence: hits ? Math.min(1, Math.abs(score) / hits) : 0 };
}

/** Rule-based + HMM NER — simplified Viterbi — O(n·states²) */
export function namedEntityRecognition({ text }) {
  const tokens = text.split(/\s+/);
  const states = ['O', 'B-PER', 'I-PER', 'B-LOC', 'I-LOC'];
  const trans = { O: { O: 0.8, 'B-PER': 0.1, 'B-LOC': 0.1 }, 'B-PER': { O: 0.3, 'I-PER': 0.7 }, 'I-PER': { O: 0.2, 'I-PER': 0.8 }, 'B-LOC': { O: 0.3, 'I-LOC': 0.7 }, 'I-LOC': { O: 0.2, 'I-LOC': 0.8 } };
  const emit = (token, state) => {
    if (state === 'B-PER' && /^[A-Z]/.test(token)) return 0.8;
    if (state === 'B-LOC' && /city|town|street/i.test(token)) return 0.7;
    if (state === 'O') return 0.9;
    return 0.1;
  };
  const viterbi = [];
  viterbi[0] = {};
  states.forEach((s) => { viterbi[0][s] = { prob: Math.log(emit(tokens[0], s) + 1e-10), path: [s] }; });
  for (let t = 1; t < tokens.length; t += 1) {
    viterbi[t] = {};
    states.forEach((s) => {
      let best = { prob: -Infinity, path: [] };
      states.forEach((prev) => {
        const p = viterbi[t - 1][prev].prob + Math.log((trans[prev]?.[s] || 0.01) + 1e-10) + Math.log(emit(tokens[t], s) + 1e-10);
        if (p > best.prob) best = { prob: p, path: [...viterbi[t - 1][prev].path, s] };
      });
      viterbi[t][s] = best;
    });
  }
  const last = viterbi[tokens.length - 1];
  const bestState = states.reduce((a, b) => (last[a].prob > last[b].prob ? a : b));
  const tags = last[bestState].path;
  const entities = [];
  tags.forEach((tag, i) => {
    if (tag.startsWith('B-')) entities.push({ text: tokens[i], type: tag.slice(2), start: i });
  });
  return { algorithm: 'ner_hmm', tokens, tags, entities };
}
