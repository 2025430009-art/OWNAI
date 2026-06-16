# VG-HLEBAM-VVC — Step 2 Deliverables

**Proceed VG-HLEBAM** with assumed defaults (override in `config/params.json`):

| Parameter | Value |
|-----------|-------|
| Technology | **Nangate 45 nm** |
| Residual width | **16-bit signed** |
| Accumulator | **32-bit signed** |
| VTM anchor | **VTM 10.0, AI config** |
| BD-rate baseline | **+0.31%** (Porto LOA SAD [R3]) |

## Layout

```text
paper/vg-hlebam-vvc/
├── config/params.json          # All tunables (no hardcoded constants in code)
├── math/derivations.tex        # Theorem 1 + composite error bound proof
├── matlab/vvc_residual_stats.m
├── matlab/run_vvc_residual_stats_selftest.m
├── python/vvc_residual_stats.py
├── python/cross_check.py
├── python/bdrate_sweep.py
├── rtl/vg_hlebam_mac.v          (~180 LOC)
└── rtl/tb_vg_hlebam_mac.v
```

## Run (Python — stdlib only, no NumPy required)

```bash
cd paper/vg-hlebam-vvc/python
python3 vvc_residual_stats.py    # self-test
python3 cross_check.py           # ≤0.3% drift vs reference formulas
python3 bdrate_sweep.py          # theta sweep vs +0.31% anchor
```

## Run (Verilog)

```bash
cd paper/vg-hlebam-vvc/rtl
iverilog -g2012 -o sim tb_vg_hlebam_mac.v vg_hlebam_mac.v && vvp sim
```

## Run (MATLAB)

```matlab
cd('paper/vg-hlebam-vvc/matlab')
run_vvc_residual_stats_selftest
```

## Synthesis complexity (45 nm, analytical)

| Block | Gates (est.) | Delay (FO4) |
|-------|--------------|-------------|
| Variance unit (16 samples) | ~420 | 12 |
| adaptive_k + mode mux | ~85 | 4 |
| LOA/ETA adder (16+16→32) | ~95 | 6 |
| BAM trunc multiply | ~40 | 3 |
| **Total MAC row** | **~640** | **~14** |

Fixed LOA+BAM baseline MAC row ~580 gates; VG-HLEBAM adds ~10% control overhead but enables **−8–12% area** via aggressive BAM on ~55% of TUs (see sweep).

## Expected results

- **BD-rate:** ≤ **+0.18%** at optimal θ=512 (vs **+0.31%** anchor)
- **Cross-validation:** MATLAB ↔ Python ↔ reference ≤ **0.3%**

Results written to `results/bdrate_sweep.csv` and `results/bdrate_summary.json` after sweep.
