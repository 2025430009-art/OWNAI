function run_vvc_residual_stats_selftest()
%RUN_VVC_RESIDUAL_STATS_SELFTEST  Assert core VG-HLEBAM statistics behavior.

    params = vvc_load_params();
    smooth = int16(repmat(3, 8, 8));
    textured = int16(round(100 * randn(8, 8)));

    s1 = vvc_residual_stats(smooth, params);
    s2 = vvc_residual_stats(textured, params);

    assert(s1.sigma2 < s2.sigma2, 'smooth block must have lower variance');
    assert(s1.k_loa >= s2.k_loa, 'smooth block should allow deeper LOA');
    assert(s1.error_bound >= 0 && s2.error_bound >= 0, 'error bound must be non-negative');

    blocks = synthetic_jvet_blocks(500, 42);
    bd = aggregate_bdrate(blocks, params);
    assert(bd < params.baseline_bdrate_percent, ...
        sprintf('VG-HLEBAM BD-rate %.4f should beat baseline %.4f', bd, params.baseline_bdrate_percent));

    fprintf('vvc_residual_stats self-test PASSED (BD-rate=%.4f%% vs baseline %.2f%%)\n', ...
        bd, params.baseline_bdrate_percent);
end

function blocks = synthetic_jvet_blocks(numBlocks, rngSeed)
    rng(rngSeed);
    sizes = [4, 8, 16, 32, 64];
    blocks = cell(numBlocks, 1);
    for i = 1:numBlocks
        N = sizes(randi(numel(sizes)));
        if rand() < 0.45
            blocks{i} = int16(round(80 * randn(N, N)));
        else
            base = int16(randi([-8, 8]));
            blocks{i} = base + int16(round(4 * randn(N, N)));
        end
    end
end

function expectedBdrate = aggregate_bdrate(blocks, params)
    contribs = zeros(numel(blocks), 1);
    ph = 0;
    for i = 1:numel(blocks)
        s = vvc_residual_stats(blocks{i}, params);
        contribs(i) = s.bdrate_contrib;
        if s.sigma2 > params.variance_threshold_theta
            ph = ph + 1;
        end
    end
    expectedBdrate = mean(contribs);
    fprintf('aggregate_bdrate: mean=%.4f%%, p_h=%.3f, n=%d\n', expectedBdrate, ph / numel(blocks), numel(blocks));
end

function params = vvc_load_params()
    cfgPath = fullfile(fileparts(mfilename('fullpath')), '..', 'config', 'params.json');
    raw = fileread(cfgPath);
    j = jsondecode(raw);
    params = struct();
    params.k_min = j.k_min;
    params.k_max = j.k_max;
    params.k_eta = j.k_eta;
    params.gamma = j.gamma;
    params.sigma2_max = j.sigma2_max;
    params.variance_threshold_theta = j.variance_threshold_theta;
    params.bam_aggressive = j.bam_aggressive;
    params.bam_safe = j.bam_safe;
    params.bam_nmed_aggressive = j.bam_nmed_aggressive;
    params.bam_nmed_safe = j.bam_nmed_safe;
    params.bdrate_low_variance = j.bdrate_low_variance;
    params.bdrate_high_variance = j.bdrate_high_variance;
    params.baseline_bdrate_percent = j.baseline_bdrate_percent;
end

run_vvc_residual_stats_selftest();
