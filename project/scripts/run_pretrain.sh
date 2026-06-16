#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
python3 -m trainers.pretrain --config config/pretrain_config.yaml
