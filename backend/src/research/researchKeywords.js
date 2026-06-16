/** Shared research-topic keywords for chat detection and RAG routing. */
export const RESEARCH_KEYWORDS = [
  'IEEE',
  'paper',
  'VLSI',
  'derive',
  'theorem',
  'proof',
  'MATLAB',
  'Verilog',
  'LaTeX',
  'BD-rate',
  'approximate',
  'DCT',
  'transform',
  'adder',
  'multiplier',
  'synthesis',
  'PSNR',
  'gate count',
  'testbench',
  'research',
];

/**
 * @param {string} text
 * @returns {boolean}
 */
export function messageHasResearchKeywords(text) {
  if (!text?.trim()) return false;
  const lower = text.toLowerCase();
  return RESEARCH_KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase()));
}
