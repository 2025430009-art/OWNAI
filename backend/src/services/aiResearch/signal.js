import { ResearchSolverError, assertArray, assertNumbers, mean, rand, randInt } from './algorithms.js';
import { kMeansPlusPlus } from './clustering.js';

// ─── 11. SIGNAL & IMAGE PROCESSING ───────────────────────────────────────────

/** Cooley-Tukey FFT — O(n log n) */
export function fft(signal) {
  assertArray('signal', signal);
  const n = signal.length;
  if (n <= 1) return signal.map((v) => ({ real: v, imag: 0 }));
  if (n % 2 !== 0) throw new ResearchSolverError('FFT requires power-of-2 length signal', 'INVALID_INPUT');
  const even = fft(signal.filter((_, i) => i % 2 === 0));
  const odd = fft(signal.filter((_, i) => i % 2 === 1));
  const result = Array(n);
  for (let k = 0; k < n / 2; k += 1) {
    const angle = (-2 * Math.PI * k) / n;
    const t = { real: Math.cos(angle) * odd[k].real - Math.sin(angle) * odd[k].imag, imag: Math.sin(angle) * odd[k].real + Math.cos(angle) * odd[k].imag };
    result[k] = { real: even[k].real + t.real, imag: even[k].imag + t.imag };
    result[k + n / 2] = { real: even[k].real - t.real, imag: even[k].imag - t.imag };
  }
  return result;
}

/** Haar wavelet transform — O(n) */
export function haarWavelet(signal) {
  assertArray('signal', signal);
  const work = [...signal];
  const coeffs = [];
  let len = work.length;
  while (len > 1) {
    const half = len / 2;
    for (let i = 0; i < half; i += 1) {
      coeffs.push((work[2 * i] + work[2 * i + 1]) / Math.SQRT2);
    }
    for (let i = 0; i < half; i += 1) {
      work[i] = (work[2 * i] - work[2 * i + 1]) / Math.SQRT2;
    }
    len = half;
  }
  return { algorithm: 'haar_wavelet', coefficients: coeffs };
}

/** Sobel edge detection — O(rows·cols) */
export function sobelEdge({ image }) {
  assertArray('image', image);
  const rows = image.length;
  const cols = image[0].length;
  const gx = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
  const gy = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
  const convolve = (kernel) => {
    const out = Array.from({ length: rows - 2 }, () => Array(cols - 2).fill(0));
    for (let i = 1; i < rows - 1; i += 1) {
      for (let j = 1; j < cols - 1; j += 1) {
        let sum = 0;
        for (let ki = 0; ki < 3; ki += 1) {
          for (let kj = 0; kj < 3; kj += 1) sum += kernel[ki][kj] * image[i + ki - 1][j + kj - 1];
        }
        out[i - 1][j - 1] = sum;
      }
    }
    return out;
  };
  const sx = convolve(gx);
  const sy = convolve(gy);
  const magnitude = sx.map((row, i) => row.map((v, j) => Math.sqrt(v ** 2 + sy[i][j] ** 2)));
  return { algorithm: 'sobel', edges: magnitude };
}

/** Laplacian edge detection */
export function laplacianEdge({ image }) {
  const kernel = [[0, 1, 0], [1, -4, 1], [0, 1, 0]];
  const rows = image.length;
  const cols = image[0].length;
  const out = Array.from({ length: rows - 2 }, () => Array(cols - 2).fill(0));
  for (let i = 1; i < rows - 1; i += 1) {
    for (let j = 1; j < cols - 1; j += 1) {
      let sum = 0;
      for (let ki = 0; ki < 3; ki += 1) {
        for (let kj = 0; kj < 3; kj += 1) sum += kernel[ki][kj] * image[i + ki - 1][j + kj - 1];
      }
      out[i - 1][j - 1] = Math.abs(sum);
    }
  }
  return { algorithm: 'laplacian', edges: out };
}

/** Canny edge detection — simplified (Sobel + threshold) */
export function cannyEdge({ image, lowThreshold = 50, highThreshold = 150 }) {
  const { edges } = sobelEdge({ image });
  const result = edges.map((row) => row.map((v) => (v > highThreshold ? 255 : v > lowThreshold ? 128 : 0)));
  return { algorithm: 'canny', edges: result, low_threshold: lowThreshold, high_threshold: highThreshold };
}

/** 2D convolution */
export function convolve2d({ image, kernel }) {
  assertArray('image', image);
  const kRows = kernel.length;
  const kCols = kernel[0].length;
  const padR = Math.floor(kRows / 2);
  const padC = Math.floor(kCols / 2);
  const rows = image.length;
  const cols = image[0].length;
  const out = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      let sum = 0;
      for (let ki = 0; ki < kRows; ki += 1) {
        for (let kj = 0; kj < kCols; kj += 1) {
          const ri = i + ki - padR;
          const cj = j + kj - padC;
          if (ri >= 0 && ri < rows && cj >= 0 && cj < cols) sum += kernel[ki][kj] * image[ri][cj];
        }
      }
      out[i][j] = sum;
    }
  }
  return { algorithm: 'convolution', result: out };
}

/** K-means color quantization */
export function colorQuantization({ pixels, k = 8 }) {
  assertArray('pixels', pixels);
  const { centroids, assignments } = kMeansPlusPlus({ data: pixels, k });
  const palette = centroids.map((c) => c.map((v) => Math.round(v)));
  const quantized = assignments.map((a) => palette[a]);
  return { algorithm: 'kmeans_color_quantization', palette, quantized_pixels: quantized, k };
}
