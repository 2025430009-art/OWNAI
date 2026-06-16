import { useEffect, useState } from 'react';
import { getTransformerArchitecture } from '../../api/client.js';

function SpecRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-stone-100 py-2 last:border-0 dark:border-slate-800">
      <dt className="text-sm text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-800 dark:text-slate-200">{value}</dd>
    </div>
  );
}

export default function TransformerArchitecturePanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getTransformerArchitecture()
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return <p className="text-sm text-slate-400">Architecture reference unavailable offline.</p>;
  }

  if (!data) {
    return <p className="text-sm text-slate-400">Loading model architecture…</p>;
  }

  const { architecture: arch, pretraining, taskTransforms, finetuning, evaluation, implementation, deliverables } = data;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">
          Section {arch.section} — Model Architecture
        </p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{arch.name}</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{arch.summary}</p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Core hyperparameters</h3>
        <dl className="mt-3">
          <SpecRow label="Layers" value={arch.layers} />
          <SpecRow label="Hidden size" value={`${arch.hiddenSize}-dim`} />
          <SpecRow label="Attention heads" value={arch.attentionHeads} />
          <SpecRow label="Feed-forward inner" value={`${arch.feedForwardInner}-dim`} />
          <SpecRow label="Activation" value={arch.activation} />
          <SpecRow label="Positional embeddings" value={arch.positionalEmbeddings} />
          <SpecRow label="Tokenizer" value={arch.tokenizer.label} />
          <SpecRow label="Dropout" value={`${arch.dropout.residual} (residual, embed, attn)`} />
          <SpecRow label="Weight init" value={arch.weightInit.label} />
          <SpecRow label="Normalization" value={arch.normalization} />
          <SpecRow label="Attention type" value={arch.attention} />
        </dl>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Training setup</h3>
        <dl className="mt-3">
          <SpecRow label="Optimizer" value={arch.optimization.optimizer} />
          <SpecRow label="Max learning rate" value={arch.optimization.maxLearningRate} />
          <SpecRow label="LR schedule" value={arch.optimization.schedule} />
          <SpecRow label="Warmup updates" value={arch.optimization.warmupUpdates} />
          <SpecRow label="Epochs" value={arch.optimization.epochs} />
          <SpecRow label="Batch size" value={arch.optimization.batchSize} />
          <SpecRow label="Sequence length" value={`${arch.optimization.sequenceLength} tokens`} />
          <SpecRow label="Weight decay" value={arch.regularization.weightDecay} />
          <SpecRow label="Weight decay scope" value={arch.regularization.weightDecayScope} />
        </dl>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Text preprocessing</h3>
        <dl className="mt-3">
          <SpecRow label="Cleaning library" value={arch.preprocessing.textCleaning} />
          <SpecRow label="Tokenizer pipeline" value={arch.preprocessing.tokenizer} />
          <SpecRow label="Notes" value={arch.preprocessing.notes} />
        </dl>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
          Section {pretraining.section} — Unsupervised pre-training
        </p>
        <dl className="mt-3">
          <SpecRow label="Objective" value={pretraining.objective} />
          <SpecRow label="Dataset" value={pretraining.dataset} />
          <SpecRow label="Context window" value={`${pretraining.contextWindow} tokens`} />
          <SpecRow label="Batch size" value={`${pretraining.batchSize} sequences`} />
          <SpecRow label="Optimizer" value={pretraining.optimizer} />
          <SpecRow label="Learning rate" value={pretraining.learningRate} />
          <SpecRow label="LR schedule" value={pretraining.lrSchedule} />
          <SpecRow label="Warmup steps" value={pretraining.warmupSteps} />
          <SpecRow label="Epochs" value={pretraining.epochs} />
          <SpecRow label="Regularization" value={`${pretraining.regularization.method}, w=${pretraining.regularization.weight}`} />
          <SpecRow label="Reg. scope" value={pretraining.regularization.scope} />
          <SpecRow label="Tokenizer" value={`${pretraining.tokenizer.method}, ${pretraining.tokenizer.merges} merges (${pretraining.tokenizer.implementation})`} />
        </dl>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
          Section {finetuning.section} — Supervised fine-tuning
        </p>
        <dl className="mt-3">
          <SpecRow label="Classification head" value={finetuning.head.type} />
          <SpecRow label="Head placement" value={finetuning.head.placement} />
          <SpecRow label="Objective" value={finetuning.objective.primary} />
          <SpecRow label="Auxiliary objective" value={`${finetuning.objective.auxiliary} (lambda=${finetuning.objective.lambda})`} />
          <SpecRow label="Combined loss" value={finetuning.objective.combined} />
          <SpecRow label="Learning rate" value={finetuning.learningRate} />
          <SpecRow label="Batch size" value={finetuning.batchSize} />
          <SpecRow label="Epochs" value={finetuning.epochs} />
          <SpecRow label="Early stopping" value={finetuning.earlyStopping ? 'Enabled' : 'Disabled'} />
          <SpecRow label="Classifier dropout" value={finetuning.dropout.classifier} />
          <SpecRow label="LR schedule" value={`${finetuning.lrSchedule.type} (${finetuning.lrSchedule.warmupLabel})`} />
        </dl>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Decoder block (×{arch.layers})</h3>
        <ol className="mt-3 space-y-2">
          {arch.stack.map((step, i) => (
            <li key={step} className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-800 dark:bg-teal-950 dark:text-teal-200">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
          Section {taskTransforms.section} — Task-specific input transforms
        </p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{taskTransforms.summary}</p>
        <p className="mt-3 text-xs text-slate-400">
          Tokens: start {taskTransforms.specialTokens.start}, delimiter {taskTransforms.specialTokens.delimiter}, extract {taskTransforms.specialTokens.end}
        </p>
        <div className="mt-4 space-y-3">
          {taskTransforms.tasks.map((task) => (
            <div key={task.id} className="rounded-lg bg-stone-50 p-3 dark:bg-slate-800/60">
              <p className="text-sm font-medium text-slate-800 dark:text-white">{task.name}</p>
              <p className="mt-1 font-mono text-xs text-teal-700 dark:text-teal-300">{task.format}</p>
              <p className="mt-1 text-xs text-slate-500">{task.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-600">
          Section {evaluation.section} — Evaluation tasks
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {evaluation.categories.map((group) => (
            <div key={group.id} className="rounded-lg bg-stone-50 p-3 dark:bg-slate-800/60">
              <p className="text-sm font-medium text-slate-800 dark:text-white">{group.name}</p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                {group.datasets.join(', ')}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-600">
          Section {implementation.section} — Implementation requirements
        </p>
        <dl className="mt-3">
          <SpecRow label="Framework" value={implementation.stack.framework} />
          <SpecRow label="Model base" value={implementation.stack.modelBase} />
          <SpecRow label="Checkpointing" value={implementation.trainingOps.checkpointing ? 'Required' : 'Optional'} />
          <SpecRow label="Logging" value={implementation.trainingOps.logging.join(' or ')} />
          <SpecRow label="GPU support" value={implementation.trainingOps.gpuSupport ? 'Required' : 'Optional'} />
          <SpecRow label="Dataset script" value={implementation.dataPipeline.datasetScript} />
          <SpecRow label="Tokenizer training" value={implementation.dataPipeline.tokenizerTraining} />
          <SpecRow label="Zero-shot heuristics" value={implementation.inference.zeroShotHeuristics ? 'Included' : 'Not included'} />
        </dl>
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Modular code structure</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {implementation.modules.map((m) => (
              <span
                key={m}
                className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {m}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{implementation.inference.notes}</p>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          Section {deliverables.section} — Deliverables
        </p>
        <ul className="mt-3 space-y-2">
          {deliverables.items.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
