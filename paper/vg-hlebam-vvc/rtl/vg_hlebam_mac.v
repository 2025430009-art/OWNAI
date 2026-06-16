// VG-HLEBAM-VVC: Variance-gated hybrid LOA/ETA MAC with BAM truncation
// Technology target: Nangate 45nm (synthesis analysis in README)
// Residual width: RES_W (default 16), Accumulator: ACC_W (default 32)

`timescale 1ns / 1ps

module vg_hlebam_mac #(
    parameter integer RES_W       = 16,
    parameter integer ACC_W       = 32,
    parameter integer COEF_W      = 16,
    parameter integer K_MIN       = 2,
    parameter integer K_MAX       = 6,
    parameter integer K_ETA       = 4,
    parameter integer THETA       = 512,
    parameter integer SIGMA2_MAX  = 65536,
    parameter integer BAM_V_AGGR  = 8,
    parameter integer BAM_H_AGGR  = 16,
    parameter integer BAM_V_SAFE  = 4,
    parameter integer BAM_H_SAFE  = 8
) (
    input  wire                        clk,
    input  wire                        rst_n,
    input  wire                        start,
    input  wire signed [RES_W-1:0]     residual_in,
    input  wire signed [COEF_W-1:0]    coef_in,
    input  wire                        residual_valid,
    output reg  signed [ACC_W-1:0]     acc_out,
    output reg                         acc_valid,
    output reg  [3:0]                  k_loa_out,
    output reg                         mode_loa_out,
    output reg  [4:0]                  bam_v_out,
    output reg  [4:0]                  bam_h_out,
    output reg  [31:0]                 sigma2_out
);

    localparam integer SUM_W = RES_W + 2;

    reg signed [SUM_W-1:0] sum_r;
    reg signed [SUM_W-1:0] sum_sq;
    reg [15:0]             sample_count;
    reg signed [SUM_W-1:0] mu;
    reg [31:0]             sigma2;
    reg [3:0]              k_sel;
    reg                    mode_loa;
    reg [4:0]              bam_v;
    reg [4:0]              bam_h;

    wire signed [COEF_W+RES_W-1:0] product_exact;
    wire signed [COEF_W+RES_W-1:0] product_bam;
    wire signed [ACC_W-1:0]        sum_approx;

    assign product_exact = coef_in * residual_in;
    assign product_bam   = bam_multiply(product_exact, bam_v, bam_h);
    assign sum_approx    = loa_eta_add(acc_out, product_bam[ACC_W-1:0], k_sel, mode_loa);

    function automatic [3:0] adaptive_k;
        input [31:0] s2;
        reg [31:0] ratio_q;
        reg [31:0] comp;
        begin
            if (s2 >= SIGMA2_MAX)
                adaptive_k = K_MIN[3:0];
            else begin
                ratio_q = (s2 * 1024) / SIGMA2_MAX;
                comp = ((K_MAX - K_MIN) * (1024 - ratio_q)) >> 10;
                adaptive_k = K_MIN + comp[3:0];
                if (adaptive_k > K_MAX[3:0])
                    adaptive_k = K_MAX[3:0];
            end
        end
    endfunction

    function automatic signed [COEF_W+RES_W-1:0] bam_multiply;
        input signed [COEF_W+RES_W-1:0] p;
        input [4:0] v_cut;
        input [4:0] h_cut;
        reg [4:0] shift_amt;
        begin
            shift_amt = (v_cut >> 1) + (h_cut >> 2);
            if (shift_amt > 15)
                shift_amt = 15;
            bam_multiply = p >>> shift_amt;
        end
    endfunction

    function automatic signed [ACC_W-1:0] loa_eta_add;
        input signed [ACC_W-1:0] acc;
        input signed [ACC_W-1:0] op;
        input [3:0] k;
        input mode_loa;
        reg signed [ACC_W-1:0] op_masked;
        reg signed [ACC_W-1:0] loa_carry;
        begin
            if (mode_loa) begin
                op_masked = op;
                op_masked[k-1:0] = op[k-1:0] | acc[k-1:0];
                loa_carry = {ACC_W{1'b0}};
                if (k >= 1)
                    loa_carry = (op[k-1] & acc[k-1]) ? (1 << k) : 0;
                loa_eta_add = {acc[ACC_W-1:k+1], op_masked[k:0]} + loa_carry;
            end else begin
                op_masked = op;
                op_masked[K_ETA-1:0] = {K_ETA{1'b0}};
                loa_eta_add = acc + op_masked;
            end
        end
    endfunction

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            sum_r         <= 0;
            sum_sq        <= 0;
            sample_count  <= 0;
            mu            <= 0;
            sigma2        <= 0;
            k_sel         <= K_MAX[3:0];
            mode_loa      <= 1'b1;
            bam_v         <= BAM_V_AGGR[4:0];
            bam_h         <= BAM_H_AGGR[4:0];
            acc_out       <= 0;
            acc_valid     <= 1'b0;
            k_loa_out     <= K_MAX[3:0];
            mode_loa_out  <= 1'b1;
            bam_v_out     <= BAM_V_AGGR[4:0];
            bam_h_out     <= BAM_H_AGGR[4:0];
            sigma2_out    <= 0;
        end else begin
            acc_valid <= 1'b0;

            if (start) begin
                sum_r        <= 0;
                sum_sq       <= 0;
                sample_count <= 0;
                acc_out      <= 0;
            end else if (residual_valid) begin
                sum_r        <= sum_r + $signed({{SUM_W-RES_W{residual_in[RES_W-1]}}, residual_in});
                sum_sq       <= sum_sq + $signed(residual_in) * $signed(residual_in);
                sample_count <= sample_count + 1;

                if (sample_count == 16'd1) begin
                    mu <= sum_r + $signed({{SUM_W-RES_W{residual_in[RES_W-1]}}, residual_in});
                end

                if (sample_count >= 16'd15) begin
                    sigma2 <= (sum_sq / 16) - ((mu * mu) / 256);
                    if (sigma2 > SIGMA2_MAX)
                        sigma2 <= SIGMA2_MAX;

                    k_sel <= adaptive_k(sigma2);
                    if (sigma2 <= THETA && ((1 << k_sel) - 1) <= ((1 << K_ETA) - 1)) begin
                        mode_loa <= 1'b1;
                        bam_v    <= BAM_V_AGGR[4:0];
                        bam_h    <= BAM_H_AGGR[4:0];
                    end else begin
                        mode_loa <= 1'b0;
                        bam_v    <= BAM_V_SAFE[4:0];
                        bam_h    <= BAM_H_SAFE[4:0];
                    end
                end

                acc_out      <= sum_approx;
                acc_valid    <= 1'b1;
                k_loa_out    <= k_sel;
                mode_loa_out <= mode_loa;
                bam_v_out    <= bam_v;
                bam_h_out    <= bam_h;
                sigma2_out   <= sigma2;
            end
        end
    end

endmodule
