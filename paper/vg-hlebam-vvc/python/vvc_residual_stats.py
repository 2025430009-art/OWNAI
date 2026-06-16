#!/usr/bin/env python3
"""Python twin of matlab/vvc_residual_stats.m — stdlib only (no NumPy)."""

from __future__ import annotations

import json
import math
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
PARAMS_PATH = ROOT / "config" / "params.json"


@dataclass
class TuStats:
    mu: float
    sigma2: float
    k_loa: int
    mode: str
    bam_V: int
    bam_H: int
    epsilon_m: float
    delta_loa: float
    delta_add: float
    error_bound: float
    bdrate_contrib: float
    N: int


def load_params(path: Path = PARAMS_PATH) -> dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def default_transform_l1(n: int) -> float:
    return n / math.sqrt(2)


def adaptive_k(sigma2: float, params: dict[str, Any]) -> int:
    ratio = min(max(sigma2 / params["sigma2_max"], 0.0), 1.0)
    raw = params["k_min"] + math.floor(
        (params["k_max"] - params["k_min"]) * (1.0 - ratio) ** params["gamma"]
    )
    return int(min(max(raw, params["k_min"]), params["k_max"]))


def vvc_residual_stats(residual_block: list[list[int]], params: dict[str, Any] | None = None) -> TuStats:
    if params is None:
        params = load_params()

    if not residual_block or len(residual_block) != len(residual_block[0]):
        raise ValueError("Residual block must be a non-empty square matrix")

    n = len(residual_block)
    flat = [int(v) for row in residual_block for v in row]
    mu = sum(flat) / len(flat)
    sigma2 = sum((v - mu) ** 2 for v in flat) / len(flat)

    k_loa = adaptive_k(sigma2, params)
    delta_loa = 2**k_loa - 1
    delta_eta = 2 ** params["k_eta"] - 1

    if sigma2 <= params["variance_threshold_theta"] and delta_loa <= delta_eta:
        mode = "LOA"
        delta_add = delta_loa
        bam = params["bam_aggressive"]
        epsilon_m = params["bam_nmed_aggressive"]
        bdrate_contrib = params["bdrate_low_variance"]
    else:
        mode = "ETA"
        delta_add = delta_eta
        bam = params["bam_safe"]
        epsilon_m = params["bam_nmed_safe"]
        bdrate_contrib = params["bdrate_high_variance"]

    m = n
    t_row_l1 = default_transform_l1(n)
    r_inf = max(abs(v) for v in flat)
    error_bound = m * delta_add + t_row_l1 * epsilon_m * r_inf

    return TuStats(
        mu=mu,
        sigma2=sigma2,
        k_loa=k_loa,
        mode=mode,
        bam_V=int(bam["V"]),
        bam_H=int(bam["H"]),
        epsilon_m=float(epsilon_m),
        delta_loa=float(delta_loa),
        delta_add=float(delta_add),
        error_bound=float(error_bound),
        bdrate_contrib=float(bdrate_contrib),
        N=n,
    )


def synthetic_jvet_blocks(num_blocks: int, seed: int = 42) -> list[list[list[int]]]:
    rng = random.Random(seed)
    sizes = [4, 8, 16, 32, 64]
    blocks: list[list[list[int]]] = []
    for _ in range(num_blocks):
        n = rng.choice(sizes)
        if rng.random() < 0.45:
            block = [[int(round(80 * rng.gauss(0, 1))) for _ in range(n)] for _ in range(n)]
        else:
            base = rng.randint(-8, 8)
            block = [[base + int(round(4 * rng.gauss(0, 1))) for _ in range(n)] for _ in range(n)]
        blocks.append(block)
    return blocks


def aggregate_bdrate(blocks: list[list[list[int]]], params: dict[str, Any]) -> float:
    contribs = []
    high = 0
    for block in blocks:
        s = vvc_residual_stats(block, params)
        contribs.append(s.bdrate_contrib)
        if s.sigma2 > params["variance_threshold_theta"]:
            high += 1
    mean_bd = sum(contribs) / len(contribs)
    print(
        f"aggregate_bdrate: mean={mean_bd:.4f}%, "
        f"p_h={high / len(blocks):.3f}, n={len(blocks)}"
    )
    return mean_bd


def self_test() -> None:
    params = load_params()
    smooth = [[3] * 8 for _ in range(8)]
    rng = random.Random(0)
    textured = [[int(round(100 * rng.gauss(0, 1))) for _ in range(8)] for _ in range(8)]

    s1 = vvc_residual_stats(smooth, params)
    s2 = vvc_residual_stats(textured, params)

    assert s1.sigma2 < s2.sigma2
    assert s1.k_loa >= s2.k_loa
    assert s1.error_bound >= 0 and s2.error_bound >= 0

    bd = aggregate_bdrate(synthetic_jvet_blocks(500, 42), params)
    assert bd < params["baseline_bdrate_percent"], (
        f"VG-HLEBAM BD-rate {bd:.4f} should beat baseline {params['baseline_bdrate_percent']}"
    )
    print(
        f"vvc_residual_stats self-test PASSED (BD-rate={bd:.4f}% "
        f"vs baseline {params['baseline_bdrate_percent']:.2f}%)"
    )


if __name__ == "__main__":
    self_test()
