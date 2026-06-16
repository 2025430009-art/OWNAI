import { getPool, isDatabaseAvailable } from '../db/index.js';

export class ResearchError extends Error {
  constructor(message, code = 'RESEARCH_ERROR', status = 400) {
    super(message);
    this.name = 'ResearchError';
    this.code = code;
    this.status = status;
  }
}

export const PHASE_NAMES = [
  'Problem identification',
  'Mathematical foundation',
  'Simulation framework',
  'RTL implementation',
  'Experimental results',
  'LaTeX writing',
  'Review and revision',
  'Publication and impact',
];

function assertDb() {
  if (!isDatabaseAvailable()) {
    throw new ResearchError('Research features require PostgreSQL', 'DB_UNAVAILABLE', 503);
  }
}

function userId(req) {
  const id = req.user?.id;
  if (id == null || id === 'api-key') {
    throw new ResearchError('Authenticated user account required', 'AUTH_REQUIRED', 401);
  }
  return id;
}

export async function assertProjectAccess(projectId, req) {
  assertDb();
  const { rows } = await getPool().query(
    'SELECT * FROM research_projects WHERE id = $1 AND user_id = $2',
    [projectId, userId(req)],
  );
  if (!rows[0]) {
    throw new ResearchError('Project not found', 'NOT_FOUND', 404);
  }
  return rows[0];
}

export async function createProject(req, data) {
  assertDb();
  const { rows } = await getPool().query(
    `INSERT INTO research_projects
      (user_id, title, research_question, target_journal, domain, success_criteria)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      userId(req),
      data.title,
      data.research_question ?? null,
      data.target_journal ?? null,
      data.domain ?? null,
      JSON.stringify(data.success_criteria ?? {}),
    ],
  );
  return rows[0];
}

export async function listProjects(req) {
  assertDb();
  const { rows } = await getPool().query(
    `SELECT * FROM research_projects
     WHERE user_id = $1
     ORDER BY updated_at DESC`,
    [userId(req)],
  );
  return rows;
}

export async function getProjectDetail(projectId, req) {
  const project = await assertProjectAccess(projectId, req);
  const pool = getPool();

  const [phases, counts] = await Promise.all([
    pool.query(
      'SELECT * FROM paper_phases WHERE project_id = $1 ORDER BY phase_number',
      [projectId],
    ),
    pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM research_papers WHERE project_id = $1) AS paper_count,
         (SELECT COUNT(*)::int FROM math_derivations WHERE project_id = $1) AS derivation_count`,
      [projectId],
    ),
  ]);

  return {
    project,
    phases: phases.rows,
    paper_count: counts.rows[0].paper_count,
    derivation_count: counts.rows[0].derivation_count,
  };
}

export async function updateProject(projectId, req, data) {
  await assertProjectAccess(projectId, req);
  const fields = [];
  const values = [];
  let idx = 1;

  const allowed = ['title', 'research_question', 'target_journal', 'domain', 'phase', 'status', 'success_criteria'];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(key === 'success_criteria' ? JSON.stringify(data[key]) : data[key]);
    }
  }

  if (!fields.length) {
    throw new ResearchError('No updatable fields provided');
  }

  fields.push(`updated_at = now()`);
  values.push(projectId, userId(req));

  const { rows } = await getPool().query(
    `UPDATE research_projects SET ${fields.join(', ')}
     WHERE id = $${idx++} AND user_id = $${idx}
     RETURNING *`,
    values,
  );
  return rows[0];
}

export async function deleteProject(projectId, req) {
  await assertProjectAccess(projectId, req);
  await getPool().query(
    'DELETE FROM research_projects WHERE id = $1 AND user_id = $2',
    [projectId, userId(req)],
  );
  return { deleted: true };
}

export async function createPaper(projectId, req, data) {
  await assertProjectAccess(projectId, req);
  const { rows } = await getPool().query(
    `INSERT INTO research_papers
      (project_id, user_id, title, authors, journal, year, doi, key_contribution, limitation_gap, category, metrics)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      projectId,
      userId(req),
      data.title,
      data.authors ?? null,
      data.journal ?? null,
      data.year ?? null,
      data.doi ?? null,
      data.key_contribution ?? null,
      data.limitation_gap ?? null,
      data.category ?? null,
      JSON.stringify(data.metrics ?? {}),
    ],
  );
  return rows[0];
}

export async function listPapers(projectId, req, { category, sort }) {
  await assertProjectAccess(projectId, req);
  const conditions = ['project_id = $1'];
  const values = [projectId];
  let idx = 2;

  if (category) {
    conditions.push(`category = $${idx++}`);
    values.push(category);
  }

  const orderBy = sort === 'year' ? 'year DESC NULLS LAST, created_at DESC' : 'created_at DESC';
  const { rows } = await getPool().query(
    `SELECT * FROM research_papers WHERE ${conditions.join(' AND ')} ORDER BY ${orderBy}`,
    values,
  );
  return rows;
}

export async function deletePaper(paperId, req) {
  assertDb();
  const { rows } = await getPool().query(
    `DELETE FROM research_papers p
     USING research_projects rp
     WHERE p.id = $1 AND p.project_id = rp.id AND rp.user_id = $2
     RETURNING p.id`,
    [paperId, userId(req)],
  );
  if (!rows[0]) {
    throw new ResearchError('Paper not found', 'NOT_FOUND', 404);
  }
  return { deleted: true };
}

export async function createGapEntry(projectId, req, data) {
  await assertProjectAccess(projectId, req);
  const { rows } = await getPool().query(
    `INSERT INTO gap_matrix (project_id, paper_id, dimension, value, is_gap, gap_score)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      projectId,
      data.paper_id,
      data.dimension,
      data.value ?? null,
      data.is_gap ?? false,
      data.gap_score ?? null,
    ],
  );
  return rows[0];
}

export async function getGapMatrix(projectId, req) {
  await assertProjectAccess(projectId, req);
  const pool = getPool();

  const [papersRes, cellsRes] = await Promise.all([
    pool.query(
      'SELECT id, title, authors, year, category FROM research_papers WHERE project_id = $1 ORDER BY year DESC NULLS LAST',
      [projectId],
    ),
    pool.query(
      'SELECT id, paper_id, dimension, value, is_gap, gap_score FROM gap_matrix WHERE project_id = $1',
      [projectId],
    ),
  ]);

  const dimensions = [...new Set(cellsRes.rows.map((c) => c.dimension))].sort();
  return {
    dimensions,
    papers: papersRes.rows,
    cells: cellsRes.rows,
  };
}

export async function createDerivation(projectId, req, data) {
  await assertProjectAccess(projectId, req);
  const { rows } = await getPool().query(
    `INSERT INTO math_derivations
      (project_id, name, theorem_statement, proof_steps, formula_latex)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      projectId,
      data.name,
      data.theorem_statement ?? null,
      JSON.stringify(data.proof_steps ?? []),
      data.formula_latex ?? null,
    ],
  );
  return rows[0];
}

export async function validateDerivation(derivationId, req, validationErrorPercent) {
  assertDb();
  const validated = validationErrorPercent < 0.3;
  const { rows } = await getPool().query(
    `UPDATE math_derivations md
     SET validated = $1, validation_error_percent = $2
     FROM research_projects rp
     WHERE md.id = $3 AND md.project_id = rp.id AND rp.user_id = $4
     RETURNING md.*`,
    [validated, validationErrorPercent, derivationId, userId(req)],
  );
  if (!rows[0]) {
    throw new ResearchError('Derivation not found', 'NOT_FOUND', 404);
  }
  return rows[0];
}

export async function listDerivations(projectId, req) {
  await assertProjectAccess(projectId, req);
  const { rows } = await getPool().query(
    'SELECT * FROM math_derivations WHERE project_id = $1 ORDER BY created_at',
    [projectId],
  );
  return rows;
}

export async function createSimulation(projectId, req, data) {
  await assertProjectAccess(projectId, req);
  const { rows } = await getPool().query(
    `INSERT INTO simulation_runs (project_id, tool, parameters, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING *`,
    [projectId, data.tool, JSON.stringify(data.parameters ?? {})],
  );
  return rows[0];
}

export async function updateSimulationResults(simulationId, req, data) {
  assertDb();
  const { rows } = await getPool().query(
    `UPDATE simulation_runs sr
     SET results = $1, status = $2
     FROM research_projects rp
     WHERE sr.id = $3 AND sr.project_id = rp.id AND rp.user_id = $4
     RETURNING sr.*`,
    [JSON.stringify(data.results ?? {}), data.status, simulationId, userId(req)],
  );
  if (!rows[0]) {
    throw new ResearchError('Simulation run not found', 'NOT_FOUND', 404);
  }
  return rows[0];
}

export async function listSimulations(projectId, req, { tool, status }) {
  await assertProjectAccess(projectId, req);
  const conditions = ['project_id = $1'];
  const values = [projectId];
  let idx = 2;

  if (tool) {
    conditions.push(`tool = $${idx++}`);
    values.push(tool);
  }
  if (status) {
    conditions.push(`status = $${idx++}`);
    values.push(status);
  }

  const { rows } = await getPool().query(
    `SELECT * FROM simulation_runs WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
    values,
  );
  return rows;
}

export async function initPhases(projectId, req) {
  await assertProjectAccess(projectId, req);
  const existing = await getPool().query(
    'SELECT * FROM paper_phases WHERE project_id = $1 ORDER BY phase_number',
    [projectId],
  );
  if (existing.rows.length > 0) {
    return existing.rows;
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const created = [];
    for (let i = 0; i < PHASE_NAMES.length; i += 1) {
      const { rows } = await client.query(
        `INSERT INTO paper_phases (project_id, phase_number, phase_name)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [projectId, i, PHASE_NAMES[i]],
      );
      created.push(rows[0]);
    }
    await client.query('COMMIT');
    return created;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function completePhase(phaseId, req, data) {
  assertDb();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE paper_phases pp
       SET completed = true,
           completed_at = now(),
           outputs = $1,
           notes = $2
       FROM research_projects rp
       WHERE pp.id = $3 AND pp.project_id = rp.id AND rp.user_id = $4
       RETURNING pp.*`,
      [JSON.stringify(data.outputs ?? []), data.notes ?? null, phaseId, userId(req)],
    );
    if (!rows[0]) {
      throw new ResearchError('Phase not found', 'NOT_FOUND', 404);
    }

    const phase = rows[0];
    const maxRes = await client.query(
      `SELECT COALESCE(MAX(phase_number), -1)::int AS max_completed
       FROM paper_phases
       WHERE project_id = $1 AND completed = true`,
      [phase.project_id],
    );
    const nextPhase = Math.min(maxRes.rows[0].max_completed + 1, 7);
    await client.query(
      'UPDATE research_projects SET phase = $1, updated_at = now() WHERE id = $2',
      [nextPhase, phase.project_id],
    );

    await client.query('COMMIT');
    return phase;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listPhases(projectId, req) {
  await assertProjectAccess(projectId, req);
  const { rows } = await getPool().query(
    'SELECT * FROM paper_phases WHERE project_id = $1 ORDER BY phase_number',
    [projectId],
  );
  return rows;
}

export async function getProjectForGenerate(projectId, req) {
  return assertProjectAccess(projectId, req);
}

export async function listActiveProjectsForUser(userId) {
  assertDb();
  const { rows } = await getPool().query(
    `SELECT id, title, domain, phase, status, updated_at
     FROM research_projects
     WHERE user_id = $1 AND status = 'active'
     ORDER BY updated_at DESC
     LIMIT 10`,
    [userId],
  );
  return rows;
}
