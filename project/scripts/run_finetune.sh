#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
python3 -m trainers.finetune --config config/finetune_config.yaml
