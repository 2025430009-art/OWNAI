from pathlib import Path

from tokenizers import Tokenizer, models, pre_tokenizers, trainers
from transformers import PreTrainedTokenizerFast


SPECIAL_TOKENS = ["<pad>", "<s>", "</s>", "<unk>", "<mask>"]


def _build_tokenizer():
    tokenizer = Tokenizer(models.BPE(unk_token="<unk>"))
    tokenizer.pre_tokenizer = pre_tokenizers.ByteLevel()
    return tokenizer


def train_bpe_tokenizer(files, vocab_size=40000, min_frequency=2, save_path="tokenizer.json"):
    tokenizer = _build_tokenizer()
    trainer = trainers.BpeTrainer(
        vocab_size=vocab_size,
        min_frequency=min_frequency,
        special_tokens=SPECIAL_TOKENS,
    )
    tokenizer.train(files=files, trainer=trainer)
    tokenizer.save(save_path)
    return save_path


def train_bpe_on_texts(text_iterable, vocab_size=40000, min_frequency=2, save_path="tokenizer.json"):
    tokenizer = _build_tokenizer()
    trainer = trainers.BpeTrainer(
        vocab_size=vocab_size,
        min_frequency=min_frequency,
        special_tokens=SPECIAL_TOKENS,
    )
    tokenizer.train_from_iterator(text_iterable, trainer=trainer)
    tokenizer.save(save_path)
    return save_path


def load_hf_tokenizer(tokenizer_path="tokenizer.json", max_seq_len=512):
    path = Path(tokenizer_path)
    if not path.exists():
        raise FileNotFoundError(f"Tokenizer not found: {tokenizer_path}")
    return PreTrainedTokenizerFast(
        tokenizer_file=str(path),
        model_max_length=max_seq_len,
        bos_token="<s>",
        eos_token="</s>",
        unk_token="<unk>",
        pad_token="<pad>",
        mask_token="<mask>",
    )
