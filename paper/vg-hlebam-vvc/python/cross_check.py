#!/usr/bin/env python3
"""Cross-validate Python vs reference formulas; tolerance from params.json."""

from __future__ import annotations

import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "python"))

from vvc_residual_stats import aggregate_bdrate, load_params, synthetic_jvet_blocks, vvc_residual_stats


def pct_diff(a: float, b: float) -> float:
    if b == 0:
        return 0.0 if a == 0 else 100.0
    return abs(a - b) / abs(b) * 100.0


def reference_stats(block: list[list[int]], params: dict) -> dict:
    flat = [v for row in block for v in row]
    mu = sum(flat) / len(flat)
    sigma2 = sum((v - mu) ** 2 for v in flat) / len(flat)
    ratio = min(max(sigma2 / params["sigma2_max"], 0.0), 1.0)
    k_loa = int(
        min(
            max(
                params["k_min"]
                + int((params["k_max"] - params["k_min"]) * (1.0 - ratio) ** params["gamma"]),
                params["k_min"],
            ),
            params["k_max"],
        )
    )
    return {"mu": mu, "sigma2": sigma2, "k_loa": k_loa}


def main() -> None:
    params = load_params()
    tol = params["cross_validate_tolerance_percent"]
    blocks = synthetic_jvet_blocks(200, 99)

    max_sigma_diff = 0.0
    max_k_diff = 0.0
    for block in blocks:
        py = vvc_residual_stats(block, params)
        ref = reference_stats(block, params)
        max_sigma_diff = max(max_sigma_diff, pct_diff(py.sigma2, ref["sigma2"]))
        max_k_diff = max(max_k_diff, pct_diff(py.k_loa, ref["k_loa"]))
        assert py.mode in ("LOA", "ETA")

    py_bd = aggregate_bdrate(blocks, params)
    fixed_bd = params["baseline_bdrate_percent"]

    print(f"max sigma2 pct diff: {max_sigma_diff:.4f}% (tol {tol}%)")
    print(f"max k_loa pct diff:  {max_k_diff:.4f}% (tol {tol}%)")
    print(f"VG-HLEBAM BD-rate:   {py_bd:.4f}%")
    print(f"Fixed LOA baseline:  {fixed_bd:.2f}%")
    print(f"Improvement:         {fixed_bd - py_bd:.4f} pp")

    assert max_sigma_diff <= tol, f"sigma2 drift {max_sigma_diff}% > {tol}%"
    assert max_k_diff <= tol, f"k_loa drift {max_k_diff}% > {tol}%"
    assert py_bd < fixed_bd, "VG-HLEBAM must beat +0.31% anchor"
    print("cross_check PASSED")


if __name__ == "__main__":
    main()
