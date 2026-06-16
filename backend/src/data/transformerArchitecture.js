/** GPT-style Transformer decoder architecture — Section 3.1 & 3.3 reference */

export const TRANSFORMER_ARCHITECTURE = {
  id: 'gpt-decoder-12l',
  name: '12-Layer Transformer Decoder',
  section: '3.1',
  summary:
    'Generative pre-trained Transformer decoder with masked self-attention, learned positional embeddings, and task-specific input transformations for fine-tuning.',
  layers: 12,
  hiddenSize: 768,
  attentionHeads: 12,
  feedForwardInner: 3072,
  activation: 'GELU',
  positionalEmbeddings: 'learned',
  tokenizer: {
    type: 'BPE',
    merges: 40000,
    label: 'BytePair Encoding (40k merges)',
  },
  dropout: {
    residual: 0.1,
    embedding: 0.1,
    attention: 0.1,
  },
  weightInit: {
    distribution: 'normal',
    mean: 0,
    std: 0.02,
    label: 'N(0, 0.02)',
  },
  normalization: 'LayerNorm (applied before each sub-layer block)',
  attention: 'Masked multi-head self-attention (causal / decoder-only)',
  optimization: {
    optimizer: 'Adam',
    maxLearningRate: 2.5e-4,
    warmupUpdates: 2000,
    schedule: 'Linear warmup to max LR, then cosine annealing to 0',
    epochs: 100,
    batchSize: 64,
    sequenceLength: 512,
  },
  regularization: {
    dropoutRate: 0.1,
    weightDecay: 0.01,
    weightDecayScope: 'All non-bias and non-gain weights',
    weightDecayVariant: 'Modified L2 regularization',
  },
  preprocessing: {
    textCleaning: 'ftfy',
    tokenizer: 'spaCy tokenizer + BPE',
    notes: 'Raw BooksCorpus text cleaned, punctuation and whitespace standardized',
  },
  stack: [
    'Text & position embeddings',
    'Masked multi-head self-attention',
    'Residual + LayerNorm',
    'Feed-forward (3072-dim inner)',
    'Residual + LayerNorm',
  ],
};

export const UNSUPERVISED_PRETRAINING = {
  section: '3.2',
  objective: 'Standard causal language modeling (next-token prediction)',
  dataset: 'BooksCorpus or similar long contiguous text corpora',
  contextWindow: 512,
  batchSize: 64,
  optimizer: 'Adam',
  learningRate: 2.5e-4,
  lrSchedule: 'Linear warmup over first 2000 updates, then cosine decay to 0',
  warmupSteps: 2000,
  epochs: 100,
  regularization: {
    method: 'Modified L2 regularization (weight decay)',
    weight: 0.01,
    scope: 'All non-bias and non-gain weights',
  },
  tokenizer: {
    method: 'BytePair Encoding (BPE)',
    merges: 40000,
    implementation: 'HuggingFace tokenizers',
  },
};

export const TASK_INPUT_TRANSFORMS = {
  section: '3.3',
  summary:
    'Traversal-style input formatting: structured tasks are linearized into token sequences with start ⟨s⟩, delimiter $, and extract ⟨e⟩ tokens.',
  specialTokens: {
    start: '⟨s⟩',
    end: '⟨e⟩',
    delimiter: '$',
  },
  tasks: [
    {
      id: 'classification',
      name: 'Classification',
      format: '[Start] Text [Extract]',
      description: 'Single text sequence with start and extract tokens.',
    },
    {
      id: 'entailment',
      name: 'Entailment',
      format: 'premise + delimiter + hypothesis',
      description: 'Textual Entailment input is the premise followed by a delimiter token and the hypothesis.',
    },
    {
      id: 'similarity',
      name: 'Similarity',
      format: '(sentence1 + delimiter + sentence2) and (sentence2 + delimiter + sentence1)',
      description: 'Both sentence orders are processed independently, then outputs are added element-wise before classification.',
    },
    {
      id: 'multiple-choice',
      name: 'QA / Commonsense',
      format: 'context + question + delimiter + answer_k (for each answer)',
      description: 'For QA and commonsense reasoning, each candidate answer is scored from a separate sequence and normalized with softmax over answers.',
    },
  ],
};

export const EVALUATION_TASKS = {
  section: '3.5',
  categories: [
    {
      id: 'nli',
      name: 'NLI',
      datasets: ['SNLI', 'MultiNLI', 'QNLI', 'RTE', 'SciTail'],
    },
    {
      id: 'qa',
      name: 'QA',
      datasets: ['RACE', 'Story Cloze'],
    },
    {
      id: 'similarity',
      name: 'Similarity',
      datasets: ['MRPC', 'QQP', 'STS-B'],
    },
    {
      id: 'classification',
      name: 'Classification',
      datasets: ['CoLA', 'SST-2'],
    },
  ],
};

export const IMPLEMENTATION_REQUIREMENTS = {
  section: '3.6',
  stack: {
    framework: 'PyTorch',
    modelBase: 'HuggingFace Transformers',
  },
  modules: [
    'Data loading',
    'Model definition',
    'Unsupervised pre-training',
    'Supervised fine-tuning',
    'Evaluation',
  ],
  trainingOps: {
    checkpointing: true,
    logging: ['Weights & Biases (W&B)', 'TensorBoard'],
    gpuSupport: true,
  },
  dataPipeline: {
    datasetScript: 'Script to download and preprocess BooksCorpus or alternatives',
    tokenizerTraining: 'Train BPE tokenizer',
  },
  inference: {
    zeroShotHeuristics: true,
    notes: 'Include zero-shot evaluation heuristics for tasks without direct supervised labels',
  },
};

export const DELIVERABLES = {
  section: '3.7',
  items: [
    'Full Python codebase with requirements.txt',
    'Training scripts for pre-training and fine-tuning',
    'README with setup and run instructions',
    'Sample commands to reproduce paper results',
  ],
};

export const SUPERVISED_FINETUNING = {
  section: '3.4',
  head: {
    type: 'Linear classification head',
    placement: 'On top of the final transformer layer representation',
  },
  objective: {
    primary: 'Cross-entropy classification loss',
    auxiliary: 'Language modeling loss',
    lambda: 0.5,
    combined: 'L_total = L_ce + 0.5 * L_lm',
  },
  learningRate: 6.25e-5,
  batchSize: 32,
  epochs: 3,
  earlyStopping: true,
  dropout: {
    classifier: 0.1,
  },
  lrSchedule: {
    type: 'Linear decay',
    warmupFraction: 0.002,
    warmupLabel: 'Warmup over 0.2% of total steps',
  },
};

export function getTransformerArchitectureReference() {
  return {
    architecture: TRANSFORMER_ARCHITECTURE,
    pretraining: UNSUPERVISED_PRETRAINING,
    taskTransforms: TASK_INPUT_TRANSFORMS,
    finetuning: SUPERVISED_FINETUNING,
    evaluation: EVALUATION_TASKS,
    implementation: IMPLEMENTATION_REQUIREMENTS,
    deliverables: DELIVERABLES,
  };
}
