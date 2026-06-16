import argparse
import os
from datetime import datetime, timezone
import yaml
from transformers import (
    DataCollatorForLanguageModeling,
    Trainer,
    TrainingArguments,
)

from data.dataset import (
    build_pretrain_dataset,
    extract_texts_for_tokenizer,
    load_books_like_dataset,
)
from data.tokenizer import load_hf_tokenizer, train_bpe_on_texts
from models.transformer import build_decoder_model


def make_run_id(prefix):
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    return f"{prefix}-{ts}"


def maybe_setup_wandb(cfg, run_name):
    if cfg["training"]["log_with"] != "wandb":
        return None
    try:
        import wandb  # pylint: disable=import-outside-toplevel
    except Exception:
        return None
    return wandb.init(
        project=cfg.get("wandb_project", "transformer-pretrain"),
        name=run_name,
        config=cfg,
        reinit=True,
    )


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


def main(config_path):
    with open(config_path, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    os.makedirs(cfg["output_dir"], exist_ok=True)
    run_name = make_run_id(cfg.get("run_name_prefix", "pt"))
    tokenizer_path = cfg.get("tokenizer_path", f"{cfg['output_dir']}/tokenizer.json")
    raw_ds = load_books_like_dataset(cfg["data"]["dataset_name"])
    text_col = cfg["data"].get("text_column", "text")

    if not os.path.exists(tokenizer_path):
        texts = extract_texts_for_tokenizer(
            raw_ds,
            text_column=text_col,
            sample_size=cfg["data"].get("tokenizer_sample_size", 200000),
        )
        train_bpe_on_texts(
            texts,
            vocab_size=cfg["model"]["vocab_size"],
            save_path=tokenizer_path,
        )

    tokenizer = load_hf_tokenizer(
        tokenizer_path=tokenizer_path,
        max_seq_len=cfg["model"]["max_seq_len"],
    )

    train_ds = build_pretrain_dataset(
        raw_ds,
        tokenizer=tokenizer,
        text_column=text_col,
        block_size=cfg["data"]["context_window"],
    )

    model = build_decoder_model(
        vocab_size=cfg["model"]["vocab_size"],
        max_seq_len=cfg["model"]["max_seq_len"],
    )

    args = TrainingArguments(
        output_dir=cfg["output_dir"],
        run_name=run_name,
        logging_dir=cfg.get("logging_dir", os.path.join(cfg["output_dir"], "logs")),
        per_device_train_batch_size=cfg["training"]["batch_size"],
        num_train_epochs=cfg["training"]["epochs"],
        learning_rate=float(cfg["training"]["learning_rate"]),
        warmup_steps=int(cfg["training"]["warmup_steps"]),
        lr_scheduler_type="cosine",
        weight_decay=float(cfg["training"]["weight_decay"]),
        logging_steps=50,
        save_steps=500,
        save_total_limit=3,
        report_to=[cfg["training"]["log_with"]],
        fp16=bool(cfg["training"].get("fp16", False)),
        bf16=bool(cfg["training"].get("bf16", False)),
        dataloader_pin_memory=True,
    )
    collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)
    wandb_run = maybe_setup_wandb(cfg, run_name)
    trainer = Trainer(model=model, args=args, train_dataset=train_ds, data_collator=collator)
    resume_ckpt = cfg.get("resume_from_checkpoint")
    trainer.train(resume_from_checkpoint=resume_ckpt)
    trainer.save_model(f"{cfg['output_dir']}/latest")
    tokenizer.save_pretrained(f"{cfg['output_dir']}/latest")
    maybe_log_wandb_artifact(wandb_run, f"{run_name}-model", f"{cfg['output_dir']}/latest")
    if wandb_run is not None:
        wandb_run.finish()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config/pretrain_config.yaml")
    main(parser.parse_args().config)
