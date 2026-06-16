import random

from datasets import Dataset, load_dataset


def _synthetic_dataset():
    sample_texts = [
        "The sun was setting over the horizon, painting the sky in shades of orange and red.",
        "The transformer architecture uses attention mechanisms to process sequential data.",
        "GPT models are trained on massive text corpora using self-supervised learning.",
        "The Earth revolves around the Sun, completing one orbit each year.",
        "A journey of a thousand miles begins with a single step.",
        "Machine learning algorithms learn patterns from data.",
        "Climate change is a global challenge that requires collective action.",
        "She opened the old book and began to read the first page with great anticipation.",
    ]
    texts = []
    for _ in range(15000):
        n = random.randint(3, 8)
        texts.append(". ".join(random.sample(sample_texts, n)) + ".")
    ds = Dataset.from_dict({"text": texts})
    print(f"⚠️ Using synthetic dataset (network offline mode)...")
    print(f"✓ Created synthetic dataset with {len(ds):,} examples")
    print(f"Sample: {texts[0][:220]}...")
    print(f"Avg length: {sum(len(t) for t in texts) / len(texts):.0f} chars")
    return ds


def load_books_like_dataset(dataset_name="bookcorpus", split="train"):
    print(f"Loading dataset: {dataset_name}")
    candidates = [dataset_name, "bookcorpus", "wikitext"]
    for candidate in candidates:
        try:
            if candidate == "wikitext":
                return load_dataset("wikitext", "wikitext-103-raw-v1", split="train")
            return load_dataset(candidate, split=split)
        except Exception:
            continue
    return _synthetic_dataset()


def extract_texts_for_tokenizer(dataset, text_column="text", sample_size=10000, num_samples=None):
    # Backward compatibility: num_samples alias.
    target = num_samples if num_samples is not None else sample_size
    if text_column not in dataset.column_names:
        text_column = dataset.column_names[0]
    target = min(int(target), len(dataset))
    print(f"Extracting {target} texts from column '{text_column}' for tokenizer training...")
    texts = dataset[text_column][:target]
    print(f"✓ Extracted {len(texts)} texts")
    return texts


def build_pretrain_dataset(dataset, tokenizer, text_column="text", block_size=512):
    def tokenize_fn(examples):
        return tokenizer(examples[text_column], add_special_tokens=False)

    tokenized = dataset.map(
        tokenize_fn,
        batched=True,
        remove_columns=dataset.column_names,
        desc="Tokenizing pretraining corpus",
    )

    def group_texts(examples):
        concatenated = []
        for ids in examples["input_ids"]:
            concatenated.extend(ids)
        total = (len(concatenated) // block_size) * block_size
        if total == 0:
            return {"input_ids": [], "labels": []}
        input_ids = [concatenated[i : i + block_size] for i in range(0, total, block_size)]
        return {"input_ids": input_ids, "labels": [x[:] for x in input_ids]}

    grouped = tokenized.map(
        group_texts,
        batched=True,
        remove_columns=tokenized.column_names,
        desc=f"Grouping tokens into {block_size}-token blocks",
    )
    return grouped


TASK_SPECS = {
    "mrpc": {"dataset": ("glue", "mrpc"), "text1": "sentence1", "text2": "sentence2", "label": "label"},
    "qqp": {"dataset": ("glue", "qqp"), "text1": "question1", "text2": "question2", "label": "label"},
    "stsb": {"dataset": ("glue", "stsb"), "text1": "sentence1", "text2": "sentence2", "label": "label"},
    "cola": {"dataset": ("glue", "cola"), "text1": "sentence", "text2": None, "label": "label"},
    "sst2": {"dataset": ("glue", "sst2"), "text1": "sentence", "text2": None, "label": "label"},
    "qnli": {"dataset": ("glue", "qnli"), "text1": "question", "text2": "sentence", "label": "label"},
    "rte": {"dataset": ("glue", "rte"), "text1": "sentence1", "text2": "sentence2", "label": "label"},
    "mnli": {"dataset": ("glue", "mnli"), "text1": "premise", "text2": "hypothesis", "label": "label"},
    "multinli": {"dataset": ("glue", "mnli"), "text1": "premise", "text2": "hypothesis", "label": "label"},
    "snli": {"dataset": ("snli", None), "text1": "premise", "text2": "hypothesis", "label": "label"},
}


def load_classification_task(task_name):
    key = task_name.lower()
    if key not in TASK_SPECS:
        raise ValueError(f"Unsupported task: {task_name}")
    spec = TASK_SPECS[key]
    name, subset = spec["dataset"]
    if subset is None:
        ds = load_dataset(name)
    else:
        ds = load_dataset(name, subset)
    return ds, spec


def tokenize_task_dataset(dataset, tokenizer, spec, max_length=512):
    text1 = spec["text1"]
    text2 = spec["text2"]
    label_col = spec["label"]

    def tok(examples):
        if text2:
            enc = tokenizer(examples[text1], examples[text2], truncation=True, max_length=max_length)
        else:
            enc = tokenizer(examples[text1], truncation=True, max_length=max_length)
        enc["labels"] = examples[label_col]
        return enc

    mapped = dataset.map(tok, batched=True, desc="Tokenizing fine-tuning dataset")
    keep = {"input_ids", "attention_mask", "labels"}
    remove = [c for c in mapped["train"].column_names if c not in keep]
    return mapped.remove_columns(remove)
