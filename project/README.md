# Transformer Training Project

Minimal runnable training pipeline for:
- Unsupervised causal LM pre-training
- Supervised fine-tuning with classification + auxiliary LM loss
- Evaluation scaffold with zero-shot heuristics

## Setup

```bash
cd project
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Pre-train

```bash
bash scripts/run_pretrain.sh
```

Output checkpoint: `outputs/pretrain/latest`

## Fine-tune (multi-task in one run)

Update `config/finetune_config.yaml` if needed, then:

```bash
bash scripts/run_finetune.sh
```

Output checkpoint: `outputs/finetune/latest`

Fine-tuning iterates through all tasks in `config/finetune_config.yaml` sequentially in one run, carrying the latest checkpoint across tasks.

## Logging

- TensorBoard: set `training.log_with: tensorboard`
- W&B: set `training.log_with: wandb`
- Run naming convention:
  - pretrain: `{run_name_prefix}-{UTC_TIMESTAMP}`
  - finetune: `{run_name_prefix}-{UTC_TIMESTAMP}-{task}`
- Artifact convention (W&B):
  - model artifact name: `{run_name}-model`

## Reproduce-style sample commands

```bash
python3 -m trainers.pretrain --config config/pretrain_config.yaml
python3 -m trainers.finetune --config config/finetune_config.yaml
```

## Notes

- Pre-training tries `bookcorpus` then falls back to `wikitext-103-raw-v1`.
- BPE tokenizer is trained to 40k merges and saved to `outputs/pretrain/tokenizer.json`.
- Fine-tuning supports all configured tasks in one run (`snli`, `multinli`, `qnli`, `rte`, `mrpc`, `qqp`, `stsb`, `cola`, `sst2` by default).
