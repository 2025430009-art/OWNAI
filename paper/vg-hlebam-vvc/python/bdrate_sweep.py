#!/usr/bin/env python3
"""BD-rate sweep: VG-HLEBAM vs fixed LOA+BAM anchor (+0.31%)."""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "python"))

from vvc_residual_stats import aggregate_bdrate, load_params, synthetic_jvet_blocks


def sweep_theta(params: dict, blocks: list, thetas: list[float]) -> list[dict]:
    rows = []
    for theta in thetas:
        p = dict(params)
        p["variance_threshold_theta"] = theta
        bd = aggregate_bdrate(blocks, p)
        rows.append({"theta": theta, "bdrate_percent": bd})
    return rows


def main() -> None:
    params = load_params()
    blocks = synthetic_jvet_blocks(1000, 2024)
    baseline = params["baseline_bdrate_percent"]

    thetas = [64, 128, 256, 512, 1024, 2048, 4096]
    rows = sweep_theta(params, blocks, thetas)

    best = min(rows, key=lambda r: r["bdrate_percent"])
    out = ROOT / "results" / "bdrate_sweep.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["theta", "bdrate_percent"])
        writer.writeheader()
        writer.writerows(rows)

    summary = {
        "vtm_version": params["vtm_version"],
        "vtm_config": params["vtm_config"],
        "technology_nm": params["technology_nm"],
        "residual_bit_width": params["residual_bit_width"],
        "baseline_bdrate_percent": baseline,
        "best_theta": best["theta"],
        "best_bdrate_percent": best["bdrate_percent"],
        "improvement_pp": baseline - best["bdrate_percent"],
    }
    summary_path = ROOT / "results" / "bdrate_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print("BD-rate sweep complete")
    print(f"  Baseline (fixed LOA+BAM): {baseline:.2f}%")
    print(f"  Best VG-HLEBAM @ theta={best['theta']}: {best['bdrate_percent']:.4f}%")
    print(f"  Gain: {summary['improvement_pp']:.4f} percentage points")
    print(f"  CSV: {out}")
    print(f"  Summary: {summary_path}")


if __name__ == "__main__":
    main()
