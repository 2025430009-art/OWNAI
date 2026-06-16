import torch
import torch.nn as nn
from transformers import GPT2Config, GPT2LMHeadModel


def build_decoder_model(vocab_size=40000, max_seq_len=512):
    cfg = GPT2Config(
        vocab_size=vocab_size,
        n_positions=max_seq_len,
        n_ctx=max_seq_len,
        n_embd=768,
        n_layer=12,
        n_head=12,
        n_inner=3072,
        resid_pdrop=0.1,
        embd_pdrop=0.1,
        attn_pdrop=0.1,
        activation_function="gelu",
    )
    model = GPT2LMHeadModel(cfg)
    model.apply(_init_weights)
    return model


def _init_weights(module):
    if isinstance(module, (nn.Linear, nn.Embedding)):
        module.weight.data.normal_(mean=0.0, std=0.02)
    if isinstance(module, nn.Linear) and module.bias is not None:
        module.bias.data.zero_()
