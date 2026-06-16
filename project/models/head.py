import torch.nn as nn


class LinearClassificationHead(nn.Module):
    def __init__(self, hidden_size=768, num_labels=2, dropout=0.1):
        super().__init__()
        self.dropout = nn.Dropout(dropout)
        self.proj = nn.Linear(hidden_size, num_labels)

    def forward(self, hidden_state):
        return self.proj(self.dropout(hidden_state))
