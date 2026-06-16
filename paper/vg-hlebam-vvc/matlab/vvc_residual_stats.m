function stats = vvc_residual_stats(residualBlock, params)
%VVC_RESIDUAL_STATS  Variance-gated LOA/ETA and BAM config for one TU.
%   stats = vvc_residual_stats(R, params)

    validateattributes(residualBlock, {'numeric'}, {'2d', 'integer', 'nonempty'});
    if nargin < 2 || isempty(params)
        params = vvc_load_params();
    end

    N = size(residualBlock, 1);
    if size(residualBlock, 2) ~= N
        error('vvc_residual_stats:NotSquare', 'Residual block must be square.');
    end

    r = double(residualBlock(:));
    mu = mean(r);
    sigma2 = mean((r - mu).^2);

    k_loa = adaptive_k(sigma2, params);
    delta_loa = 2^k_loa - 1;
    delta_eta = 2^params.k_eta - 1;

    if sigma2 <= params.variance_threshold_theta && delta_loa <= delta_eta
        mode = 'LOA';
        delta_add = delta_loa;
        bam_V = params.bam_aggressive.V;
        bam_H = params.bam_aggressive.H;
        epsilon_m = params.bam_nmed_aggressive;
        bdrate_contrib = params.bdrate_low_variance;
    else
        mode = 'ETA';
        delta_add = delta_eta;
        bam_V = params.bam_safe.V;
        bam_H = params.bam_safe.H;
        epsilon_m = params.bam_nmed_safe;
        bdrate_contrib = params.bdrate_high_variance;
    end

    M = N;
    T_row_l1 = default_transform_l1(N);
    r_inf = max(abs(r));
    error_bound = M * delta_add + T_row_l1 * epsilon_m * r_inf;

    stats = struct( ...
        'mu', mu, ...
        'sigma2', sigma2, ...
        'k_loa', k_loa, ...
        'mode', mode, ...
        'bam_V', bam_V, ...
        'bam_H', bam_H, ...
        'epsilon_m', epsilon_m, ...
        'delta_loa', delta_loa, ...
        'delta_add', delta_add, ...
        'error_bound', error_bound, ...
        'bdrate_contrib', bdrate_contrib, ...
        'N', N);
end

function k = adaptive_k(sigma2, params)
    ratio = min(max(sigma2 / params.sigma2_max, 0), 1);
    raw = params.k_min + floor((params.k_max - params.k_min) * (1 - ratio)^params.gamma);
    k = min(max(raw, params.k_min), params.k_max);
end

function l1 = default_transform_l1(N)
    l1 = N / sqrt(2);
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
