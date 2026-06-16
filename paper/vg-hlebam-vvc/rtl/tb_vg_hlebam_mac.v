// Testbench for vg_hlebam_mac — smooth vs textured TU stimulus

`timescale 1ns / 1ps

module tb_vg_hlebam_mac;

    localparam integer RES_W  = 16;
    localparam integer ACC_W  = 32;
    localparam integer COEF_W = 16;
    localparam integer N      = 16;

    reg clk;
    reg rst_n;
    reg start;
    reg signed [RES_W-1:0] residual_in;
    reg signed [COEF_W-1:0] coef_in;
    reg residual_valid;
    wire signed [ACC_W-1:0] acc_out;
    wire acc_valid;
    wire [3:0] k_loa_out;
    wire mode_loa_out;
    wire [4:0] bam_v_out;
    wire [4:0] bam_h_out;
    wire [31:0] sigma2_out;

    integer i;
    integer smooth_sigma;
    integer textured_sigma;
    reg signed [RES_W-1:0] smooth_block [0:N-1];
    reg signed [RES_W-1:0] textured_block [0:N-1];

    vg_hlebam_mac #(
        .RES_W(RES_W),
        .ACC_W(ACC_W),
        .COEF_W(COEF_W),
        .K_MIN(2),
        .K_MAX(6),
        .K_ETA(4),
        .THETA(512)
    ) dut (
        .clk(clk),
        .rst_n(rst_n),
        .start(start),
        .residual_in(residual_in),
        .coef_in(coef_in),
        .residual_valid(residual_valid),
        .acc_out(acc_out),
        .acc_valid(acc_valid),
        .k_loa_out(k_loa_out),
        .mode_loa_out(mode_loa_out),
        .bam_v_out(bam_v_out),
        .bam_h_out(bam_h_out),
        .sigma2_out(sigma2_out)
    );

    initial clk = 0;
    always #5 clk = ~clk;

    task automatic run_block;
        input string label;
        input reg signed [RES_W-1:0] block [0:N-1];
        begin
            $display("=== %s ===", label);
            start = 1;
            residual_valid = 0;
            @(posedge clk);
            start = 0;

            for (i = 0; i < N; i = i + 1) begin
                residual_in = block[i];
                coef_in = 16'sd1;
                residual_valid = 1;
                @(posedge clk);
            end
            residual_valid = 0;
            @(posedge clk);
            $display("sigma2=%0d k_loa=%0d mode=%s bam=(%0d,%0d) acc=%0d",
                sigma2_out, k_loa_out, mode_loa_out ? "LOA" : "ETA",
                bam_v_out, bam_h_out, acc_out);
        end
    endtask

    initial begin
        rst_n = 0;
        start = 0;
        residual_valid = 0;
        residual_in = 0;
        coef_in = 0;
        #20 rst_n = 1;

        for (i = 0; i < N; i = i + 1) begin
            smooth_block[i] = 16'sd3;
            textured_block[i] = ($random % 200) - 100;
        end

        run_block("smooth TU", smooth_block);
        smooth_sigma = sigma2_out;

        run_block("textured TU", textured_block);
        textured_sigma = sigma2_out;

        if (smooth_sigma >= textured_sigma) begin
            $display("FAIL: smooth sigma2 (%0d) >= textured (%0d)", smooth_sigma, textured_sigma);
            $fatal(1);
        end
        if (k_loa_out <= 2) begin
            $display("FAIL: textured TU should reduce k_loa, got %0d", k_loa_out);
            $fatal(1);
        end

        $display("tb_vg_hlebam_mac PASSED");
        $finish;
    end

    initial begin
        #50000;
        $display("FAIL: timeout");
        $fatal(1);
    end

endmodule
