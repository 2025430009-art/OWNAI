import argparse
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

import evaluate
import torch
import torch.nn as nn
import torch.nn.functional as F
import yaml
from transformers import (
    EarlyStoppingCallback,
    GPT2LMHeadModel,
    Trainer,
    TrainingArguments,
    default_data_collator,
)

from data.dataset import load_classification_task, tokenize_task_dataset
from data.tokenizer import load_hf_tokenizer


def combined_loss(logits, labels, lm_logits, lm_labels, aux_lm_lambda=0.5):
    ce = F.cross_entropy(logits, labels)
    lm = F.cross_entropy(
        lm_logits.view(-1, lm_logits.size(-1)),
        lm_labels.view(-1),
        ignore_index=-100,
    )
    return ce + aux_lm_lambda * lm


def make_run_id(prefix):
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    return f"{prefix}-{ts}"


def maybe_setup_wandb(cfg, run_name, task_name):
    if cfg["training"]["log_with"] != "wandb":
        return None
    try:
        import wandb  # pylint: disable=import-outside-toplevel
    except Exception:
        return None
    run = wandb.init(
        project=cfg.get("wandb_project", "transformer-finetune"),
        name=f"{run_name}-{task_name}",
        config=cfg,
        reinit=True,
    )
    return run


def maybe_log_wandb_artifact(run, artifact_name, path):
    if run is None:
        return
    try:
        import wandb  # pylint: disable=import-outside-toplevel

        artifact = wandb.Artifact(artifact_name, type="model")
        artifact.add_dir(path)
        run.log_artifact(artifact)
    except Exception:
        pass


class GPT2WithClassificationHead(nn.Module):
    def __init__(self, checkpoint, num_labels, classifier_dropout=0.1):
        super().__init__()
        self.lm_model = GPT2LMHeadModel.from_pretrained(checkpoint)
        hidden_size = self.lm_model.config.n_embd
        self.dropout = nn.Dropout(classifier_dropout)
        self.classifier = nn.Linear(hidden_size, num_labels)
        self.config = self.lm_model.config
        self.config.num_labels = num_labels

    def forward(self, input_ids, attention_mask=None, labels=None):
        outputs = self.lm_model.transformer(
            input_ids=input_ids,
            attention_mask=attention_mask,
            use_cache=False,
        )
        hidden = outputs.last_hidden_state
        if attention_mask is not None:
            last_idx = attention_mask.long().sum(dim=1) - 1
            last_idx = last_idx.clamp(min=0)
        else:
            last_idx = torch.full((hidden.size(0),), hidden.size(1) - 1, device=hidden.device, dtype=torch.long)
        pooled = hidden[torch.arange(hidden.size(0), device=hidden.device), last_idx]
        logits = self.classifier(self.dropout(pooled))

        lm_logits = self.lm_model.lm_head(hidden)
        loss = None
        if labels is not None:
            lm_labels = input_ids.clone()
            if attention_mask is not None:
                lm_labels = lm_labels.masked_fill(attention_mask == 0, -100)
            loss = combined_loss(
                logits,
                labels,
                lm_logits[:, :-1, :].contiguous(),
                lm_labels[:, 1:].contiguous(),
                aux_lm_lambda=getattr(self.config, "aux_lm_lambda", 0.5),
            )
        return {"loss": loss, "logits": logits}


def main(config_path):
    with open(config_path, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    os.makedirs(cfg["output_dir"], exist_ok=True)
    run_prefix = cfg.get("run_name_prefix", "ft")
    run_id = make_run_id(run_prefix)
    checkpoint = cfg["checkpoint"]
    tokenizer_path = cfg.get("tokenizer_path", os.path.join(checkpoint, "tokenizer.json"))
    tokenizer = load_hf_tokenizer(tokenizer_path=tokenizer_path)
    artifact_root = Path(cfg.get("artifact_dir", os.path.join(cfg["output_dir"], "artifacts")))
    artifact_root.mkdir(parents=True, exist_ok=True)

    current_checkpoint = checkpoint
    resume_checkpoint = cfg.get("resume_from_checkpoint")
    tasks = cfg.get("tasks", [])
    if not tasks:
        raise ValueError("No tasks configured for fine-tuning")

    for task_name in tasks:
        dataset, spec = load_classification_task(task_name)
        tokenized = tokenize_task_dataset(
            dataset,
            tokenizer=tokenizer,
            spec=spec,
            max_length=512,
        )

        num_labels = len(set(tokenized["train"]["labels"]))
        model = GPT2WithClassificationHead(
            checkpoint=current_checkpoint,
            num_labels=max(2, num_labels),
            classifier_dropout=cfg["training"]["classifier_dropout"],
        )
        model.config.aux_lm_lambda = float(cfg["training"]["aux_lm_lambda"])

        metric = evaluate.load("glue", "stsb" if task_name.lower() == "stsb" else task_name.lower()) \
            if task_name.lower() in {"mrpc", "qqp", "qnli", "rte", "sst2", "cola", "stsb"} \
            else evaluate.load("accuracy")

        def compute_metrics(eval_pred):
            preds, labels = eval_pred
            if task_name.lower() == "stsb":
                preds = preds.squeeze(-1)
                return metric.compute(predictions=preds, references=labels)
            pred_ids = preds.argmax(axis=-1)
            try:
                return metric.compute(predictions=pred_ids, references=labels)
            except Exception:  # noqa: BLE001
                acc = float((pred_ids == labels).sum()) / max(len(labels), 1)
                return {"accuracy": acc}

        task_out = os.path.join(cfg["output_dir"], task_name)
        run_name = f"{run_id}-{task_name}"
        warmup_ratio = float(cfg["training"]["warmup_ratio"])
        metric_for_best = "pearson" if task_name.lower() == "stsb" else "accuracy"
        args = TrainingArguments(
            output_dir=task_out,
            run_name=run_name,
            logging_dir=os.path.join(task_out, "logs"),
            per_device_train_batch_size=cfg["training"]["batch_size"],
            per_device_eval_batch_size=cfg["training"]["batch_size"],
            learning_rate=float(cfg["training"]["learning_rate"]),
            num_train_epochs=int(cfg["training"]["epochs"]),
            weight_decay=0.01,
            lr_scheduler_type="linear",
            warmup_ratio=warmup_ratio,
            evaluation_strategy="epoch",
            save_strategy="epoch",
            load_best_model_at_end=True,
            metric_for_best_model=metric_for_best,
            greater_is_better=True,
            report_to=[cfg["training"]["log_with"]],
            logging_steps=25,
            save_total_limit=2,
        )

        callbacks = []
        if cfg["training"].get("early_stopping", True):
            callbacks.append(EarlyStoppingCallback(early_stopping_patience=1))

        eval_split = "validation_matched" if task_name.lower() in {"mnli", "multinli"} else "validation"
        wandb_run = maybe_setup_wandb(cfg, run_name, task_name)
        trainer = Trainer(
            model=model,
            args=args,
            train_dataset=tokenized["train"],
            eval_dataset=tokenized[eval_split],
            data_collator=default_data_collator,
            tokenizer=tokenizer,
            compute_metrics=compute_metrics,
            callbacks=callbacks,
        )
        trainer.train(resume_from_checkpoint=resume_checkpoint)

        latest_path = os.path.join(task_out, "latest")
        trainer.save_model(latest_path)
        tokenizer.save_pretrained(latest_path)
        current_checkpoint = latest_path
        resume_checkpoint = None

        artifact_name = f"{run_name}-model"
        maybe_log_wandb_artifact(wandb_run, artifact_name, latest_path)
        if wandb_run is not None:
            wandb_run.finish()

    final_path = os.path.join(cfg["output_dir"], "latest")
    if os.path.isdir(final_path):
        shutil.rmtree(final_path)
    shutil.copytree(current_checkpoint, final_path)
    tokenizer.save_pretrained(final_path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config/finetune_config.yaml")
    main(parser.parse_args().config)
