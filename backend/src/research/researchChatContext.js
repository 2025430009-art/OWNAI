import { getPool, isDatabaseAvailable } from '../db/index.js';
import { vectorStore } from '../rag/vectorStore.js';
import { logger } from '../utils/logger.js';
import { messageHasResearchKeywords } from './researchKeywords.js';

export { RESEARCH_KEYWORDS, messageHasResearchKeywords } from './researchKeywords.js';

function buildResearchNamespace(userId, projectId) {
  return `research:${userId}:${projectId}`;
}

/**
 * Build a research context prefix for the main chat when keywords match.
 * @param {import('express').Request} req
 * @param {string} userMessage
 * @returns {Promise<string|null>}
 */
export async function enrichWithResearchContext(req, userMessage) {
  if (!messageHasResearchKeywords(userMessage)) return null;

  const userId = req.user?.id;
  if (!userId || userId === 'api-key') return null;
  if (!isDatabaseAvailable()) return null;

  try {
    const pool = getPool();

    const projectRes = await pool.query(
      `SELECT * FROM research_projects
       WHERE user_id = $1 AND status = 'active'
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId],
    );

    if (!projectRes.rows.length) return null;

    const project = projectRes.rows[0];

    const [derivationsRes, papersRes] = await Promise.all([
      pool.query(
        `SELECT name, formula_latex, validated FROM math_derivations
         WHERE project_id = $1 AND validated = true
         ORDER BY created_at`,
        [project.id],
      ),
      pool.query(
        `SELECT title, authors, key_contribution, limitation_gap
         FROM research_papers WHERE project_id = $1
         ORDER BY created_at DESC
         LIMIT 5`,
        [project.id],
      ),
    ]);

    const ragChunks = await vectorStore.search(
      userMessage,
      3,
      buildResearchNamespace(userId, project.id),
    ).catch(() => []);

    const formulaLines = derivationsRes.rows.length
      ? derivationsRes.rows.map((d) => `- ${d.name}: ${d.formula_latex || '(no formula)'}`).join('\n')
      : '- (none validated yet)';

    const paperLines = papersRes.rows.length
      ? papersRes.rows.map((p) => `- "${p.title}" — ${p.key_contribution || 'N/A'}`).join('\n')
      : '- (no papers added yet)';

    const ragLines = ragChunks.length
      ? ragChunks.map((chunk) => `- ${chunk.text.split('\n')[0]}`).join('\n')
      : '';

    const sections = [
      'RESEARCH CONTEXT (user\'s active paper):',
      `Title: ${project.title}`,
      `Domain: ${project.domain || 'N/A'}`,
      `Research question: ${project.research_question || 'N/A'}`,
      `Target journal: ${project.target_journal || 'N/A'}`,
      '',
      'Validated formulas:',
      formulaLines,
      '',
      'Key reference papers:',
      paperLines,
    ];

    if (ragLines) {
      sections.push('', 'Retrieved literature excerpts:', ragLines);
    }

    sections.push(
      '',
      'Use this context to make your response specific to their paper.',
      '---',
      'USER QUESTION: ',
    );

    return sections.join('\n');
  } catch (error) {
    logger.warn('Research context enrichment failed', { error: error.message });
    return null;
  }
}
