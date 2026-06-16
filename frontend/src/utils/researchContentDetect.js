/** Detect research-relevant patterns in assistant responses. */

export function detectResearchActions(content) {
  if (!content?.trim()) return [];

  const actions = [];

  if (/\\begin\{theorem\}/i.test(content)) {
    actions.push({
      id: 'save-derivation',
      label: 'Save derivation to research project',
      type: 'derivation',
    });
  }

  if (/```(?:matlab|python|verilog)\b/i.test(content)) {
    actions.push({
      id: 'save-simulation',
      label: 'Save to simulation runs',
      type: 'simulation',
    });
  }

  if (/\\begin\{tabular\}/i.test(content)) {
    actions.push({
      id: 'save-table',
      label: 'Save as results table',
      type: 'table',
    });
  }

  if (
    /\\begin\{thebibliography\}/i.test(content)
    || /\\bibliography\{/i.test(content)
    || /@(?:article|inproceedings|book)\{/i.test(content)
    || /\\bibitem/i.test(content)
  ) {
    actions.push({
      id: 'import-papers',
      label: 'Import papers to literature',
      type: 'papers',
    });
  }

  return actions;
}

export function extractTheoremBlock(content) {
  const match = content.match(/\\begin\{theorem\}([\s\S]*?)\\end\{theorem\}/i);
  if (!match) return null;

  const body = match[1].trim();
  const nameMatch = body.match(/\[([^\]]+)\]/);
  const name = nameMatch?.[1] || 'Derived theorem';

  const proofMatch = content.match(/\\begin\{proof\}([\s\S]*?)\\end\{proof\}/i);
  const formulaMatch = content.match(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/);

  return {
    name,
    theorem_statement: body.replace(/\[[^\]]+\]\s*/, '').trim(),
    proof_steps: proofMatch ? [proofMatch[1].trim()] : [],
    formula_latex: formulaMatch ? formulaMatch[1].trim() : null,
  };
}

export function extractCodeBlocks(content) {
  const blocks = [];
  const regex = /```(matlab|python|verilog)\s*\n([\s\S]*?)```/gi;
  let match = regex.exec(content);
  while (match) {
    blocks.push({ tool: match[1].toLowerCase(), code: match[2].trim() });
    match = regex.exec(content);
  }
  return blocks;
}

export function extractTabularBlock(content) {
  const match = content.match(/\\begin\{tabular\}([\s\S]*?)\\end\{tabular\}/i);
  return match ? match[0].trim() : null;
}

export function extractPaperCandidates(content) {
  const papers = [];
  const bibitemRegex = /\\bibitem(?:\[[^\]]*\])?\{([^}]+)\}\s*([^\n\\]+)/gi;
  let match = bibitemRegex.exec(content);
  while (match) {
    papers.push({
      title: match[2].trim().slice(0, 200),
      key_contribution: 'Imported from chat bibliography',
      category: 'survey',
    });
    match = bibitemRegex.exec(content);
  }

  if (!papers.length) {
    const citeRegex = /@(?:article|inproceedings)\{([^,]+),\s*[\s\S]*?title=\{([^}]+)\}/gi;
    match = citeRegex.exec(content);
    while (match) {
      papers.push({
        title: match[2].trim(),
        key_contribution: 'Imported from BibTeX',
        category: 'survey',
      });
      match = citeRegex.exec(content);
    }
  }

  return papers.slice(0, 8);
}

export const RESEARCH_CHAT_TEMPLATES = [
  {
    id: 'literature',
    label: 'Search literature for [topic]',
    prompt: 'Search literature for approximate arithmetic in VVC video coding. List 8 IEEE papers with key contributions and research gaps.',
  },
  {
    id: 'derive',
    label: 'Derive error metrics for [block]',
    prompt: 'Derive PE, ME, and MSE error metrics for a Lower-Part-OR adder with nLPL=3 and WL=16. Provide theorem, proof, and closed-form LaTeX.',
  },
  {
    id: 'matlab',
    label: 'Generate MATLAB code for [function]',
    prompt: 'Generate complete MATLAB code for loa_add.m (WL=8, LPL=3) with exhaustive self-test asserting ME ≈ -0.25.',
  },
  {
    id: 'crossvalidate',
    label: 'Cross-validate MATLAB/Python/Verilog',
    prompt: 'Cross-validate LOA adder metrics across MATLAB, Python, and Verilog. Report PE, ME, MSE and flag any pair exceeding 0.3% deviation.',
  },
];
