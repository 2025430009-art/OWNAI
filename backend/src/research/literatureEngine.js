/**
 * Phase 1 — literature search and gap analysis prompt/response engine.
 */

export class LiteratureEngineError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LiteratureEngineError';
  }
}

const RESPONSE_JSON_SCHEMA = `{
  "papers": [{
    "title": "string",
    "authors": ["string"],
    "journal": "string",
    "year": 2020,
    "doi_guess": "string or null",
    "key_contribution": "string",
    "limitation_gap": "string",
    "category": "adder|multiplier|transform|codec|nn_hw|fuzzy|survey",
    "citation_key": "R1"
  }],
  "dimensions": ["string1", "string2", "string3"],
  "gap_matrix": [{
    "citation_key": "R1",
    "dimension": "string1",
    "value": "string",
    "is_gap": true,
    "gap_score": 0.0
  }],
  "proposed_contribution": {
    "title_extension": "string",
    "novel_idea": "string",
    "new_formula": "string",
    "expected_improvement": "string",
    "supersedes": ["R1", "R2"]
  }
}`;

const PAPER_REQUIRED_FIELDS = [
  'title',
  'authors',
  'journal',
  'year',
  'key_contribution',
  'limitation_gap',
  'category',
  'citation_key',
];

/**
 * @param {string} domain
 * @param {string} keywords
 * @param {Array<object>} [existingPapers]
 * @returns {string}
 */
export function buildLiteratureSearchPrompt(domain, keywords, existingPapers = []) {
  const domainText = domain?.trim() || 'general engineering';
  const keywordText = keywords?.trim() || 'approximate computing';

  const existingBlock = existingPapers.length > 0
    ? [
      '',
      'Papers already in the project database (do NOT repeat these — find DIFFERENT works):',
      ...existingPapers.map((p, i) => {
        const authors = Array.isArray(p.authors) ? p.authors.join(', ') : p.authors || 'Unknown';
        return `${i + 1}. ${authors} — "${p.title}" (${p.journal || 'N/A'}, ${p.year || 'N/A'}) DOI: ${p.doi || p.doi_guess || 'N/A'}`;
      }),
    ].join('\n')
    : '';

  return [
    'You are an IEEE senior researcher performing Phase 1: literature survey and gap analysis.',
    '',
    `Research domain: ${domainText}`,
    `Keywords: ${keywordText}`,
    existingBlock,
    '',
    'Tasks (complete ALL):',
    '1. List exactly 8 of the most relevant IEEE/ACM peer-reviewed papers for this domain and keywords.',
    '2. For each paper provide: full citation metadata, one-line key contribution, one-line limitation/gap (what they did NOT do).',
    '3. Suggest exactly 3 gap-matrix dimensions spanning methods, metrics, and applications (use clear column names).',
    '4. Score every (paper × dimension) cell with a textual value, is_gap boolean, and gap_score float in [0,1].',
    '5. Propose ONE unique contribution combining gaps from at least two cited works — with a derived formula and quantified expected improvement.',
    '',
    'Respond with ONLY valid JSON matching this schema (no markdown fences, no commentary):',
    RESPONSE_JSON_SCHEMA,
    '',
    'Rules:',
    '- citation_key must be R1..R8 matching paper order.',
    '- gap_matrix must include every citation_key × dimension combination (24 cells for 8 papers × 3 dimensions).',
    '- gap_score = (novelty × importance) / max(difficulty, 0.1); normalize to [0,1].',
    '- category must be one of: adder, multiplier, transform, codec, nn_hw, fuzzy, survey.',
    '- Prefer IEEE TCSVT, TVLSI, TCAS-I, TCAD, ACM TODAES, Elsevier VLSIJ when applicable.',
  ].filter(Boolean).join('\n');
}

/**
 * @param {Array<object>} papers
 * @param {string[]} dimensions
 * @returns {string}
 */
export function buildGapScorePrompt(papers, dimensions) {
  if (!Array.isArray(papers) || papers.length === 0) {
    throw new LiteratureEngineError('papers array is required for gap scoring');
  }
  if (!Array.isArray(dimensions) || dimensions.length === 0) {
    throw new LiteratureEngineError('dimensions array is required for gap scoring');
  }

  const paperList = papers.map((p) => (
    `- ${p.citation_key || p.title}: "${p.title}" — gap noted: ${p.limitation_gap || 'N/A'}`
  )).join('\n');

  const dimensionList = dimensions.map((d, i) => `${i + 1}. ${d}`).join('\n');

  const blankCells = [];
  for (const paper of papers) {
    const key = paper.citation_key || paper.title;
    for (const dimension of dimensions) {
      blankCells.push({ citation_key: key, dimension });
    }
  }

  return [
    'You are scoring a research gap matrix for an IEEE paper.',
    '',
    'Papers:',
    paperList,
    '',
    'Dimensions:',
    dimensionList,
    '',
    'For each (citation_key, dimension) pair below, assign:',
    '- value: short text describing what this paper does in that dimension',
    '- is_gap: true if this dimension exposes a limitation in the paper',
    '- gap_score: (novelty × importance) / max(difficulty, 0.1), normalized to [0,1]',
    '',
    'Pairs to score:',
    JSON.stringify(blankCells, null, 2),
    '',
    'Respond with ONLY valid JSON:',
    '{ "gap_matrix": [{ "citation_key", "dimension", "value", "is_gap", "gap_score" }] }',
  ].join('\n');
}

/**
 * Extract JSON object from raw AI text (handles fences and preamble).
 * @param {string} text
 * @returns {object}
 */
function extractJsonObject(text) {
  if (!text || typeof text !== 'string') {
    throw new LiteratureEngineError('AI response is empty');
  }

  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      throw new LiteratureEngineError('Failed to parse JSON inside markdown code fence');
    }
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      throw new LiteratureEngineError('Failed to parse JSON object from AI response');
    }
  }

  throw new LiteratureEngineError('No JSON object found in AI response');
}

function assertPaper(paper, index) {
  for (const field of PAPER_REQUIRED_FIELDS) {
    if (paper[field] == null || paper[field] === '') {
      throw new LiteratureEngineError(`Paper at index ${index} missing required field: ${field}`);
    }
  }
  if (!Array.isArray(paper.authors) || paper.authors.length === 0) {
    throw new LiteratureEngineError(`Paper at index ${index}: authors must be a non-empty array`);
  }
  if (typeof paper.year !== 'number' || paper.year < 1970 || paper.year > 2100) {
    throw new LiteratureEngineError(`Paper at index ${index}: year must be a valid number`);
  }
}

/**
 * @param {string} aiResponseText
 * @returns {{ papers: object[], dimensions: string[], gap_cells: object[], contribution: object }}
 */
export function parseLiteratureResponse(aiResponseText) {
  const data = extractJsonObject(aiResponseText);

  if (!Array.isArray(data.papers)) {
    throw new LiteratureEngineError('Response must include papers array');
  }
  if (data.papers.length < 5 || data.papers.length > 10) {
    throw new LiteratureEngineError(`papers array must contain 5–10 items (got ${data.papers.length})`);
  }
  if (!Array.isArray(data.dimensions) || data.dimensions.length !== 3) {
    throw new LiteratureEngineError('dimensions must be an array of exactly 3 strings');
  }
  if (!Array.isArray(data.gap_matrix)) {
    throw new LiteratureEngineError('Response must include gap_matrix array');
  }
  if (!data.proposed_contribution || typeof data.proposed_contribution !== 'object') {
    throw new LiteratureEngineError('Response must include proposed_contribution object');
  }

  data.papers.forEach((paper, i) => assertPaper(paper, i));

  const citationKeys = new Set(data.papers.map((p) => p.citation_key));
  const expectedPairs = new Set();
  for (const key of citationKeys) {
    for (const dim of data.dimensions) {
      expectedPairs.add(`${key}::${dim}`);
    }
  }

  const gap_cells = [];
  const seenPairs = new Set();

  for (const cell of data.gap_matrix) {
    if (!cell.citation_key || !cell.dimension) {
      throw new LiteratureEngineError('Each gap_matrix cell requires citation_key and dimension');
    }
    if (!citationKeys.has(cell.citation_key)) {
      throw new LiteratureEngineError(`Unknown citation_key in gap_matrix: ${cell.citation_key}`);
    }
    if (!data.dimensions.includes(cell.dimension)) {
      throw new LiteratureEngineError(`Unknown dimension in gap_matrix: ${cell.dimension}`);
    }
    const pairKey = `${cell.citation_key}::${cell.dimension}`;
    if (seenPairs.has(pairKey)) {
      throw new LiteratureEngineError(`Duplicate gap_matrix cell: ${pairKey}`);
    }
    seenPairs.add(pairKey);
    gap_cells.push({
      citation_key: cell.citation_key,
      dimension: cell.dimension,
      value: cell.value ?? '',
      is_gap: Boolean(cell.is_gap),
      gap_score: typeof cell.gap_score === 'number' ? cell.gap_score : 0,
    });
  }

  for (const pairKey of expectedPairs) {
    if (!seenPairs.has(pairKey)) {
      throw new LiteratureEngineError(`Missing gap_matrix cell for ${pairKey.replace('::', ' × ')}`);
    }
  }

  const contribution = {
    title_extension: data.proposed_contribution.title_extension ?? '',
    novel_idea: data.proposed_contribution.novel_idea ?? '',
    new_formula: data.proposed_contribution.new_formula ?? '',
    expected_improvement: data.proposed_contribution.expected_improvement ?? '',
    supersedes: Array.isArray(data.proposed_contribution.supersedes)
      ? data.proposed_contribution.supersedes
      : [],
  };

  return {
    papers: data.papers,
    dimensions: data.dimensions,
    gap_cells,
    contribution,
  };
}

/**
 * @param {Array<object>} papers
 * @param {string[]} dimensions
 * @param {Array<object>} cells
 * @returns {object}
 */
export function buildGapMatrixTable(papers, dimensions, cells) {
  if (!Array.isArray(papers) || !Array.isArray(dimensions) || !Array.isArray(cells)) {
    throw new LiteratureEngineError('papers, dimensions, and cells arrays are required');
  }

  const cellMap = new Map();
  for (const cell of cells) {
    cellMap.set(`${cell.citation_key}::${cell.dimension}`, cell);
  }

  let total_gaps = 0;
  let highest_gap_score = 0;
  let bestGapCell = null;

  const rows = papers.map((paper) => {
    const key = paper.citation_key || paper.title;
    const rowCells = dimensions.map((dimension) => {
      const found = cellMap.get(`${key}::${dimension}`) || {
        dimension,
        value: '',
        is_gap: false,
        gap_score: 0,
      };
      if (found.is_gap) total_gaps += 1;
      if (found.gap_score > highest_gap_score) {
        highest_gap_score = found.gap_score;
        bestGapCell = { paper: key, ...found };
      }
      return {
        dimension,
        value: found.value ?? '',
        is_gap: Boolean(found.is_gap),
        gap_score: typeof found.gap_score === 'number' ? found.gap_score : 0,
      };
    });

    const rowGapSum = rowCells.reduce((sum, c) => sum + (c.is_gap ? c.gap_score : 0), 0);

    return {
      paper_citation_key: key,
      paper_title: paper.title,
      cells: rowCells,
      row_gap_sum: rowGapSum,
    };
  });

  const recommended_direction = bestGapCell
    ? `Focus on ${bestGapCell.dimension} — highest gap (${bestGapCell.paper}, score ${bestGapScoreFixed(highest_gap_score)})`
    : 'No significant gaps identified; refine keywords or dimensions';

  return {
    headers: ['Paper', ...dimensions, 'Gap score'],
    rows,
    total_gaps,
    highest_gap_score,
    recommended_direction,
  };
}

function bestGapScoreFixed(score) {
  return Number(score).toFixed(3);
}
